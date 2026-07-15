"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Archive,
  ArchiveRestore,
  Bell,
  BellOff,
  Camera,
  CheckCheck,
  MapPin,
  MessageCircle,
  Mic,
  MoreHorizontal,
  Pin,
  PinOff,
  Search,
  UserPlus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingList } from "@/components/ui/loading";
import { StoriesBar } from "@/components/stories/stories-bar";
import { StoryViewer } from "@/components/stories/story-viewer";
import { StoryCreator } from "@/components/stories/story-creator";
import { useSession } from "@/hooks/use-session";
import type { ConversationPreview, Story } from "@/lib/database.types";
import { timeAgo } from "@/lib/utils";

type InboxView = "active" | "archived";

export default function Conversas() {
  const { user, supabase } = useSession();
  const [items, setItems] = useState<ConversationPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [now, setNow] = useState(0);
  const [view, setView] = useState<InboxView>("active");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [stories, setStories] = useState<Story[]>([]);
  const [viewingStory, setViewingStory] = useState<Story | null>(null);
  const [storyIndex, setStoryIndex] = useState(0);
  const [showStoryCreator, setShowStoryCreator] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const [{ data, error }, { data: preferences }, { data: storiesData, error: storiesError }] = await Promise.all([
      supabase.rpc("get_my_conversations"),
      supabase
        .from("conversation_members")
        .select("conversation_id,is_pinned,is_archived,muted_until")
        .eq("user_id", user.id),
      supabase
        .from("stories")
        .select("*, user:profiles!user_id(id, username, display_name, avatar_url)")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false }),
    ]);
    if (!error) {
      const byConversation = new Map((preferences || []).map((item) => [item.conversation_id, item]));
      setItems(((data || []) as ConversationPreview[]).map((conversation) => ({
        ...conversation,
        is_pinned: byConversation.get(conversation.conversation_id)?.is_pinned ?? false,
        is_archived: byConversation.get(conversation.conversation_id)?.is_archived ?? false,
        muted_until: byConversation.get(conversation.conversation_id)?.muted_until ?? null,
      })));
    }
    if (!storiesError) setStories((storiesData || []) as Story[]);
    setLoading(false);
  }, [user, supabase]);

  useEffect(() => {
    if (!user) return;
    const initialLoad = setTimeout(() => void load(), 0);
    const clock = setInterval(() => setNow(Date.now()), 30000);
    const channel = supabase
      .channel(`inbox:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, load)
      .subscribe();
    return () => {
      clearTimeout(initialLoad);
      clearInterval(clock);
      void supabase.removeChannel(channel);
    };
  }, [load, user, supabase]);

  const archivedCount = items.filter((item) => item.is_archived).length;
  const shown = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return items
      .filter((item) => !!item.is_archived === (view === "archived"))
      .filter((item) => `${item.display_name} ${item.username}`.toLowerCase().includes(normalized))
      .sort((a, b) => Number(!!b.is_pinned) - Number(!!a.is_pinned) || new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime());
  }, [items, query, view]);

  async function updatePreference(
    conversationId: string,
    patch: Partial<Pick<ConversationPreview, "is_pinned" | "is_archived" | "muted_until">>,
  ) {
    if (!user) return;
    const { error } = await supabase
      .from("conversation_members")
      .update(patch)
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id);
    if (error) {
      toast.error("Não foi possível atualizar a conversa.");
      return;
    }
    setItems((current) => current.map((item) => item.conversation_id === conversationId ? { ...item, ...patch } : item));
    setMenuFor(null);
  }

  return (
    <AppShell>
      <header className="safe-top sticky top-0 z-20 px-5 pb-3 glass">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--brand)]">CloseChat</p>
            <h1 className="mt-1 text-[30px] font-bold tracking-[-.04em]">Conversas</h1>
          </div>
          <Link href="/amigos" aria-label="Adicionar amigo" className="press grid size-11 place-items-center rounded-2xl bg-[var(--surface)] text-[var(--brand)] shadow-sm">
            <UserPlus size={21} />
          </Link>
        </div>
        <label className="mt-4 flex items-center gap-2 rounded-2xl bg-[var(--surface-2)] px-3.5 py-3">
          <Search size={18} className="muted" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent text-sm" placeholder="Procurar conversas" />
        </label>
        <div className="mt-3 grid grid-cols-2 rounded-2xl bg-[var(--surface-2)] p-1 text-sm font-semibold">
          <button onClick={() => setView("active")} className={`rounded-xl px-3 py-2 transition ${view === "active" ? "bg-[var(--surface)] text-[var(--brand)] shadow-sm" : "muted"}`}>Ativas</button>
          <button onClick={() => setView("archived")} className={`rounded-xl px-3 py-2 transition ${view === "archived" ? "bg-[var(--surface)] text-[var(--brand)] shadow-sm" : "muted"}`}>Arquivadas {archivedCount ? `(${archivedCount})` : ""}</button>
        </div>
      </header>

      <StoriesBar
        onStoryClick={(story) => {
          const index = stories.findIndex((item) => item.id === story.id);
          setStoryIndex(index >= 0 ? index : 0);
          setViewingStory(story);
        }}
        onCreateStory={() => setShowStoryCreator(true)}
      />

      <section className="px-3 pt-2">
        {loading ? <LoadingList /> : shown.length === 0 ? (
          <EmptyState
            icon={view === "archived" ? Archive : MessageCircle}
            title={query ? "Nenhuma conversa encontrada" : view === "archived" ? "Sem conversas arquivadas" : "Ainda sem conversas"}
            description={query ? "Tenta procurar por outro nome." : view === "archived" ? "As conversas que arquivares aparecem aqui." : "Adiciona um amigo e inicia a primeira conversa privada."}
            action={!query && view === "active" && <Link href="/amigos" className="rounded-2xl bg-[var(--brand)] px-5 py-3 text-sm font-bold text-white">Encontrar amigos</Link>}
          />
        ) : (
          <div className="space-y-1.5">
            {shown.map((conversation) => {
              const muted = !!conversation.muted_until && new Date(conversation.muted_until).getTime() > Date.now();
              return (
                <div key={conversation.conversation_id} className="relative flex items-center rounded-[22px] border border-transparent bg-[var(--surface)] shadow-[0_5px_18px_rgba(32,34,65,.04)] hover:border-[var(--line)]">
                  <Link href={`/conversa/${conversation.conversation_id}`} className="press flex min-w-0 flex-1 items-center gap-3 p-3">
                    <Avatar src={conversation.avatar_url} name={conversation.display_name} size="lg" online={!!conversation.last_seen && now - new Date(conversation.last_seen).getTime() < 120000} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <h2 className="truncate font-bold">{conversation.display_name}</h2>
                        {conversation.is_pinned && <Pin size={12} className="shrink-0 text-[var(--brand)]" />}
                        {muted && <BellOff size={12} className="shrink-0 muted" />}
                        <time className={`ml-auto shrink-0 text-[11px] ${conversation.unread_count ? "font-bold text-[var(--brand)]" : "muted"}`}>{timeAgo(conversation.last_message_at)}</time>
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-sm muted">
                        {conversation.last_sender_id === user?.id && <CheckCheck size={15} className="text-[var(--brand)]" />}
                        {conversation.last_message_type === "image" && <Camera size={15} />}
                        {conversation.last_message_type === "voice" && <Mic size={15} />}
                        {conversation.last_message_type === "location" && <MapPin size={15} />}
                        <p className="truncate">{conversation.last_message_type === "image" ? conversation.last_message_text || "Fotografia" : conversation.last_message_type === "voice" ? "Mensagem de voz" : conversation.last_message_type === "location" ? "Localização" : conversation.last_message_text || "Começa a conversar"}</p>
                        {conversation.unread_count > 0 && <span className="ml-auto grid min-w-5 place-items-center rounded-full bg-[var(--brand)] px-1.5 py-0.5 text-[10px] font-bold text-white">{conversation.unread_count}</span>}
                      </div>
                    </div>
                  </Link>
                  <button onClick={() => setMenuFor(menuFor === conversation.conversation_id ? null : conversation.conversation_id)} aria-label="Opções da conversa" className="press mr-2 grid size-10 shrink-0 place-items-center rounded-full hover:bg-[var(--surface-2)]"><MoreHorizontal size={19} /></button>
                  {menuFor === conversation.conversation_id && (
                    <div className="absolute right-2 top-14 z-30 w-56 overflow-hidden rounded-2xl border hairline bg-[var(--surface)] p-1.5 shadow-2xl">
                      <button onClick={() => void updatePreference(conversation.conversation_id, { is_pinned: !conversation.is_pinned })} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium hover:bg-[var(--surface-2)]">{conversation.is_pinned ? <PinOff size={17} /> : <Pin size={17} />}{conversation.is_pinned ? "Desafixar" : "Fixar"}</button>
                      <button onClick={() => void updatePreference(conversation.conversation_id, { muted_until: muted ? null : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() })} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium hover:bg-[var(--surface-2)]">{muted ? <Bell size={17} /> : <BellOff size={17} />}{muted ? "Ativar notificações" : "Silenciar"}</button>
                      <button onClick={() => void updatePreference(conversation.conversation_id, { is_archived: !conversation.is_archived })} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium hover:bg-[var(--surface-2)]">{conversation.is_archived ? <ArchiveRestore size={17} /> : <Archive size={17} />}{conversation.is_archived ? "Desarquivar" : "Arquivar"}</button>
                      <button onClick={() => setMenuFor(null)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm muted hover:bg-[var(--surface-2)]"><X size={17} />Fechar</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {viewingStory && stories.length > 0 && <StoryViewer stories={stories} initialIndex={storyIndex} onClose={() => setViewingStory(null)} />}
      {showStoryCreator && <StoryCreator onClose={() => setShowStoryCreator(false)} onSuccess={load} />}
    </AppShell>
  );
}
