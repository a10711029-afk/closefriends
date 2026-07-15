"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Camera,
  CheckCheck,
  MessageCircle,
  Search,
  UserPlus,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingList } from "@/components/ui/loading";
import { StoriesBar } from "@/components/stories/stories-bar";
import { StoryViewer } from "@/components/stories/story-viewer";
import { StoryCreator } from "@/components/stories/story-creator";
import { useSession } from "@/hooks/use-session";
import type { ConversationPreview } from "@/lib/database.types";
import type { Story } from "@/lib/database.types";
import { timeAgo } from "@/lib/utils";
export default function Conversas() {
  const { user, supabase } = useSession();
  const [items, setItems] = useState<ConversationPreview[]>([]),
    [loading, setLoading] = useState(true),
    [query, setQuery] = useState(""),
    [now, setNow] = useState(0),
    [stories, setStories] = useState<Story[]>([]),
    [viewingStory, setViewingStory] = useState<Story | null>(null),
    [storyIndex, setStoryIndex] = useState(0),
    [showStoryCreator, setShowStoryCreator] = useState(false);
  const load = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase.rpc("get_my_conversations");
    if (!error) setItems((data || []) as ConversationPreview[]);
    
    // Load stories
    const { data: storiesData, error: storiesError } = await supabase
      .from("stories")
      .select(`
        *,
        user:profiles!user_id(id, username, display_name, avatar_url)
      `)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });
    
    if (!storiesError) setStories(storiesData || []);
    
    setLoading(false);
  }, [user, supabase]);
  useEffect(() => {
    if (!user) return;
    const initialLoad = setTimeout(() => void load(), 0);
    const clock = setInterval(() => setNow(Date.now()), 30000);
    const channel = supabase
      .channel(`inbox:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        load,
      )
      .subscribe();
    return () => {
      clearTimeout(initialLoad);
      clearInterval(clock);
      void supabase.removeChannel(channel);
    };
  }, [load, user, supabase]);
  const shown = useMemo(
    () =>
      items.filter((i) =>
        `${i.display_name} ${i.username}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [items, query],
  );
  return (
    <AppShell>
      <header className="safe-top sticky top-0 z-20 px-5 pb-3 glass">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--brand)]">
              CloseChat
            </p>
            <h1 className="mt-1 text-[30px] font-bold tracking-[-.04em]">
              Conversas
            </h1>
          </div>
          <Link
            href="/amigos"
            aria-label="Adicionar amigo"
            className="press grid size-11 place-items-center rounded-2xl bg-[var(--surface)] text-[var(--brand)] shadow-sm"
          >
            <UserPlus size={21} />
          </Link>
        </div>
        <label className="mt-4 flex items-center gap-2 rounded-2xl bg-[var(--surface-2)] px-3.5 py-3">
          <Search size={18} className="muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-sm"
            placeholder="Procurar conversas"
          />
        </label>
      </header>
      <StoriesBar
        onStoryClick={(story) => {
          const index = stories.findIndex(s => s.id === story.id);
          setStoryIndex(index >= 0 ? index : 0);
          setViewingStory(story);
        }}
        onCreateStory={() => setShowStoryCreator(true)}
      />
      <section className="px-3 pt-2">
        {loading ? (
          <LoadingList />
        ) : shown.length === 0 ? (
          <EmptyState
            icon={MessageCircle}
            title={
              query ? "Nenhuma conversa encontrada" : "Ainda sem conversas"
            }
            description={
              query
                ? "Tenta procurar por outro nome."
                : "Adiciona um amigo e inicia a primeira conversa privada."
            }
            action={
              !query && (
                <Link
                  href="/amigos"
                  className="rounded-2xl bg-[var(--brand)] px-5 py-3 text-sm font-bold text-white"
                >
                  Encontrar amigos
                </Link>
              )
            }
          />
        ) : (
          <div className="space-y-1">
            {shown.map((c) => (
              <Link
                key={c.conversation_id}
                href={`/conversa/${c.conversation_id}`}
                className="press flex items-center gap-3 rounded-[22px] border border-transparent bg-[var(--surface)] p-3 shadow-[0_5px_18px_rgba(32,34,65,.04)] hover:border-[var(--line)]"
              >
                <Avatar
                  src={c.avatar_url}
                  name={c.display_name}
                  size="lg"
                  online={
                    !!c.last_seen &&
                    now - new Date(c.last_seen).getTime() < 120000
                  }
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="truncate font-bold">{c.display_name}</h2>
                    <time
                      className={`shrink-0 text-[11px] ${c.unread_count ? "font-bold text-[var(--brand)]" : "muted"}`}
                    >
                      {timeAgo(c.last_message_at)}
                    </time>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-sm muted">
                    {c.last_sender_id === user?.id && (
                      <CheckCheck size={15} className="text-[var(--brand)]" />
                    )}
                    {c.last_message_type === "image" && <Camera size={15} />}
                    <p className="truncate">
                      {c.last_message_type === "image"
                        ? c.last_message_text || "Fotografia"
                        : c.last_message_text || "Começa a conversar"}
                    </p>
                    {c.unread_count > 0 && (
                      <span className="ml-auto grid min-w-5 place-items-center rounded-full bg-[var(--brand)] px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {c.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
      {viewingStory && stories.length > 0 && (
        <StoryViewer
          stories={stories}
          initialIndex={storyIndex}
          onClose={() => setViewingStory(null)}
        />
      )}
      {showStoryCreator && (
        <StoryCreator
          onClose={() => setShowStoryCreator(false)}
          onSuccess={load}
        />
      )}
    </AppShell>
  );
}
