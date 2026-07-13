"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCheck,
  Copy,
  Download,
  LoaderCircle,
  MessageCircle,
  Reply,
  Send,
  Trash2,
  X,
  ZoomIn,
} from "lucide-react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { AuthGate } from "@/components/auth/auth-gate";
import { Avatar } from "@/components/ui/avatar";
import { ImagePicker } from "@/components/chat/image-picker";
import { useSession } from "@/hooks/use-session";
import type { Message, Profile } from "@/lib/database.types";
export default function Chat() {
  const { id } = useParams<{ id: string }>(),
    { user, supabase } = useSession();
  const [messages, setMessages] = useState<Message[]>([]),
    [friend, setFriend] = useState<Profile | null>(null),
    [text, setText] = useState(""),
    [loading, setLoading] = useState(true),
    [sending, setSending] = useState(false),
    [typing, setTyping] = useState(false),
    [reply, setReply] = useState<Message | null>(null),
    [lightbox, setLightbox] = useState<string | null>(null),
    [now, setNow] = useState(0);
  const bottom = useRef<HTMLDivElement>(null),
    typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydrateImages = useCallback(
    async (rows: Message[]) =>
      Promise.all(
        rows.map(async (m) => {
          if (m.message_type !== "image" || !m.image_url) return m;
          const { data } = await supabase.storage
            .from("chat-images")
            .createSignedUrl(m.image_url, 3600);
          return { ...m, signed_image_url: data?.signedUrl };
        }),
      ),
    [supabase],
  );
  const load = useCallback(async () => {
    if (!user) return;
    const [{ data: rows, error }, { data: who }] = await Promise.all([
      supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", id)
        .is("deleted_at", null)
        .order("created_at"),
      supabase.rpc("get_conversation_friend", { p_conversation_id: id }),
    ]);
    if (error) {
      toast.error("Não tens acesso a esta conversa.");
      return;
    }
    const messages = await hydrateImages((rows || []) as Message[]);
    setMessages(messages);
    setFriend((Array.isArray(who) ? who[0] : who) as Profile | null);
    
    // Mark messages as read
    const unreadMessages = messages.filter(m => m.sender_id !== user.id && !m.read_at);
    if (unreadMessages.length > 0) {
      await supabase
        .from("messages")
        .update({ read_at: new Date().toISOString() })
        .in("id", unreadMessages.map(m => m.id));
    }
    
    await supabase
      .from("conversation_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", id)
      .eq("user_id", user.id);
    setLoading(false);
  }, [user, supabase, id, hydrateImages]);
  useEffect(() => {
    if (!user) return;
    const initialLoad = setTimeout(() => void load(), 0);
    const clock = setInterval(() => setNow(Date.now()), 30000);
    const channel = supabase
      .channel(`chat:${id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${id}`,
        },
        async ({ new: row }) => {
          const [m] = await hydrateImages([row as Message]);
          setMessages((old) =>
            old.some((x) => x.id === m.id) ? old : [...old, m],
          );
          if (m.sender_id !== user.id) {
            // Mark as read immediately
            await supabase
              .from("messages")
              .update({ read_at: new Date().toISOString() })
              .eq("id", m.id);
            await supabase
              .from("conversation_members")
              .update({ last_read_at: new Date().toISOString() })
              .eq("conversation_id", id)
              .eq("user_id", user.id);
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${id}`,
        },
        ({ new: row }) => {
          const updated = row as Message;
          if (updated.deleted_at) {
            setMessages((old) => old.filter((m) => m.id !== updated.id));
          } else {
            setMessages((old) =>
              old.map((m) => (m.id === updated.id ? { ...m, ...updated } : m))
            );
          }
        },
      )
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload.user_id !== user.id) {
          setTyping(payload.typing);
          if (typingTimer.current) clearTimeout(typingTimer.current);
          typingTimer.current = setTimeout(() => setTyping(false), 1800);
        }
      })
      .subscribe();
    return () => {
      clearTimeout(initialLoad);
      clearInterval(clock);
      void supabase.removeChannel(channel);
    };
  }, [load, user, supabase, id, hydrateImages]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);
  async function sendText() {
    const body = text.trim();
    if (!body || !user || sending) return;
    setSending(true);
    setText("");
    const { error } = await supabase
      .from("messages")
      .insert({
        conversation_id: id,
        sender_id: user.id,
        message_type: "text",
        message_text: body,
        reply_to_message_id: reply?.id || null,
      });
    if (error) {
      setText(body);
      toast.error("Mensagem não enviada.");
    }
    setReply(null);
    setSending(false);
  }
  async function sendImage(file: File, caption: string, viewOnce?: boolean) {
    if (!user) return;
    const messageId = crypto.randomUUID(),
      path = `${id}/${messageId}.webp`;
    const { error: uploadError } = await supabase.storage
      .from("chat-images")
      .upload(path, file, { contentType: "image/webp", upsert: false });
    if (uploadError) {
      toast.error("O upload falhou. Tenta novamente.");
      throw uploadError;
    }
    const { error } = await supabase
      .from("messages")
      .insert({
        id: messageId,
        conversation_id: id,
        sender_id: user.id,
        message_type: "image",
        image_url: path,
        image_caption: caption.trim() || null,
        message_text: caption.trim() || null,
        reply_to_message_id: reply?.id || null,
        view_once: viewOnce || null,
      });
    if (error) {
      await supabase.storage.from("chat-images").remove([path]);
      toast.error("Fotografia não enviada.");
      throw error;
    }
    setReply(null);
  }
  function announceTyping(value: string) {
    setText(value);
    supabase
      .channel(`chat:${id}`)
      .send({
        type: "broadcast",
        event: "typing",
        payload: { user_id: user?.id, typing: !!value },
      });
  }
  async function remove(m: Message) {
    const { error } = await supabase
      .from("messages")
      .update({
        deleted_at: new Date().toISOString(),
        message_text: null,
        image_caption: null,
      })
      .eq("id", m.id);
    if (error) toast.error("Não foi possível apagar.");
    else if (m.image_url)
      await supabase.storage.from("chat-images").remove([m.image_url]);
  }
  const online =
    !!friend?.last_seen &&
    now - new Date(friend.last_seen).getTime() < 120000;
  return (
    <AuthGate>
      <main className="app-frame flex h-dvh flex-col overflow-hidden">
        <header className="safe-top z-20 flex items-center gap-3 border-b hairline px-3 pb-3 glass">
          <Link
            href="/conversas"
            className="press grid size-10 place-items-center rounded-full"
          >
            <ArrowLeft size={23} />
          </Link>
          <Avatar
            src={friend?.avatar_url}
            name={friend?.display_name}
            size="sm"
            online={online}
          />
          <div className="min-w-0">
            <h1 className="truncate font-bold">
              {friend?.display_name || "Conversa"}
            </h1>
            <p className="text-xs muted">
              {typing
                ? "está a escrever…"
                : online
                  ? "online"
                  : friend?.last_seen
                    ? `visto ${new Date(friend.last_seen).toLocaleString("pt-PT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
                    : "offline"}
            </p>
          </div>
        </header>
        <section className="no-scrollbar flex-1 overflow-y-auto px-3 py-4">
          {loading ? (
            <div className="grid h-full place-items-center">
              <LoaderCircle className="animate-spin text-[var(--brand)]" />
            </div>
          ) : messages.length === 0 ? (
            <div className="grid h-full place-items-center text-center">
              <div>
                <MessageCircle className="mx-auto text-[var(--brand)]" />
                <p className="mt-3 font-bold">Começa a conversa</p>
                <p className="mt-1 text-sm muted">
                  As mensagens ficam apenas entre vocês.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {messages.map((m, i) => {
                const own = m.sender_id === user?.id,
                  day = new Date(m.created_at).toLocaleDateString("pt-PT", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  }),
                  prev = i
                    ? new Date(messages[i - 1].created_at).toLocaleDateString(
                        "pt-PT",
                        { day: "numeric", month: "long", year: "numeric" },
                      )
                    : null;
                return (
                  <div key={m.id}>
                    {day !== prev && (
                      <div className="my-4 text-center text-[11px] font-semibold uppercase tracking-wider muted">
                        {day}
                      </div>
                    )}
                    <div
                      className={`group flex ${own ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-[24px] px-4 py-3 shadow-sm ${own ? "rounded-br-sm bg-gradient-to-br from-[var(--brand)] to-[var(--brand)]/90 text-white" : "rounded-bl-sm bg-[var(--surface)] border border-[var(--border)]"}`}
                      >
                        {m.reply_to_message_id && (
                          <div
                            className={`mb-2.5 rounded-xl border-l-3 p-2.5 text-xs ${own ? "border-white/60 bg-white/10" : "border-[var(--brand)]/50 bg-[var(--surface-2)]"}`}
                          >
                            <div className="flex items-center gap-1.5 font-medium">
                              <Reply size={11} />
                              Resposta a uma mensagem
                            </div>
                          </div>
                        )}
                        {m.message_type === "image" && m.signed_image_url && (
                          <div className="relative">
                            {m.view_once && (
                              <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-medium text-white backdrop-blur-sm">
                                <span className="size-1.5 rounded-full bg-red-500 animate-pulse" />
                                Visualização única
                              </div>
                            )}
                            <button
                              onClick={() => setLightbox(m.signed_image_url!)}
                              className="mb-2.5 block overflow-hidden rounded-2xl shadow-sm"
                            >
                              <img
                                src={m.signed_image_url}
                                alt={m.image_caption || "Fotografia"}
                                className="max-h-72 w-full object-cover"
                                loading="lazy"
                              />
                            </button>
                          </div>
                        )}
                        {m.message_text && (
                          <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
                            {m.message_text}
                          </p>
                        )}
                        <div
                          className={`mt-2 flex items-center justify-end gap-1.5 text-[10px] ${own ? "text-white/75" : "muted"}`}
                        >
                          <time>
                            {new Date(m.created_at).toLocaleTimeString(
                              "pt-PT",
                              { hour: "2-digit", minute: "2-digit" },
                            )}
                          </time>
                          {own && (
                            <CheckCheck 
                              size={12} 
                              className={m.read_at ? "text-blue-400" : "text-white/90"} 
                            />
                          )}
                        </div>
                        <div
                          className={`mt-2 flex gap-3 border-t pt-2 text-[10px] ${own ? "border-white/15" : "hairline"}`}
                        >
                          <button
                            onClick={() => setReply(m)}
                            className="flex items-center gap-1.5 opacity-60 hover:opacity-100 transition-opacity"
                          >
                            <Reply size={11} />
                            Responder
                          </button>
                          {m.message_type === "text" && (
                            <button
                              onClick={() =>
                                navigator.clipboard.writeText(
                                  m.message_text || "",
                                )
                              }
                              className="flex items-center gap-1.5 opacity-60 hover:opacity-100 transition-opacity"
                            >
                              <Copy size={11} />
                              Copiar
                            </button>
                          )}
                          {own && (
                            <button
                              onClick={() => remove(m)}
                              className="ml-auto opacity-60 hover:opacity-100 transition-opacity"
                            >
                              <Trash2 size={11} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottom} />
            </div>
          )}
        </section>
        {reply && (
          <div className="flex items-center border-t hairline bg-[var(--surface)] px-4 py-2 text-xs">
            <Reply size={14} className="mr-2 text-[var(--brand)]" />
            <span className="min-w-0 flex-1 truncate">
              {reply.message_text || "Fotografia"}
            </span>
            <button onClick={() => setReply(null)}>
              <X size={16} />
            </button>
          </div>
        )}
        <footer className="safe-bottom flex items-end gap-1 border-t hairline bg-[var(--surface)] px-2 pt-2">
          <ImagePicker onSend={sendImage} />
          <div className="flex min-h-11 flex-1 items-end rounded-[22px] bg-[var(--surface-2)] px-3">
            <textarea
              rows={1}
              value={text}
              onChange={(e) => announceTyping(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendText();
                }
              }}
              className="max-h-28 min-h-11 w-full resize-none bg-transparent py-3 text-[15px]"
              placeholder="Mensagem…"
            />
          </div>
          <button
            onClick={sendText}
            disabled={!text.trim() || sending}
            aria-label="Enviar"
            className="press grid size-11 place-items-center rounded-full bg-[var(--brand)] text-white disabled:opacity-35"
          >
            {sending ? (
              <LoaderCircle size={19} className="animate-spin" />
            ) : (
              <Send size={19} />
            )}
          </button>
        </footer>
        {lightbox && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black animate-in fade-in duration-200">
            <button
              onClick={() => setLightbox(null)}
              className="absolute right-4 top-[max(18px,env(safe-area-inset-top))] grid size-11 place-items-center rounded-full bg-black/40 backdrop-blur-md text-white press"
            >
              <X size={24} />
            </button>
            <div className="relative h-full w-full flex items-center justify-center p-4">
              <img
                src={lightbox}
                alt="Fotografia em ecrã inteiro"
                className="max-h-[85dvh] max-w-full object-contain animate-in zoom-in-95 duration-200"
              />
            </div>
            <div className="absolute bottom-[max(24px,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 flex gap-4">
              <a
                href={lightbox}
                download
                className="grid size-12 place-items-center rounded-full bg-white/20 backdrop-blur-md text-white press hover:bg-white/30 transition-colors"
              >
                <Download size={22} />
              </a>
            </div>
          </div>
        )}
      </main>
    </AuthGate>
  );
}
