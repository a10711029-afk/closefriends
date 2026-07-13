"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Ban,
  Check,
  LoaderCircle,
  MessageCircle,
  Search,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { useSession } from "@/hooks/use-session";
import type { FriendRequest, Profile } from "@/lib/database.types";
type Friend = Profile & { friendship_id: string };
type Tab = "amigos" | "pedidos" | "procurar" | "bloqueados";
export default function Amigos() {
  const { user, supabase } = useSession(),
    router = useRouter();
  const [tab, setTab] = useState<Tab>("amigos"),
    [friends, setFriends] = useState<Friend[]>([]),
    [requests, setRequests] = useState<FriendRequest[]>([]),
    [blocked, setBlocked] = useState<Profile[]>([]),
    [results, setResults] = useState<Profile[]>([]),
    [query, setQuery] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!user) return;
    const [{ data: f }, { data: r }, { data: b }] = await Promise.all([
      supabase.rpc("get_my_friends"),
      supabase
        .from("friend_requests")
        .select(
          "*,sender:profiles!friend_requests_sender_id_fkey(*),receiver:profiles!friend_requests_receiver_id_fkey(*)",
        )
        .eq("status", "pending")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order("created_at", { ascending: false }),
      supabase.rpc("get_blocked_users"),
    ]);
    setFriends((f || []) as Friend[]);
    setRequests((r || []) as unknown as FriendRequest[]);
    setBlocked((b || []) as Profile[]);
    setLoading(false);
  }, [user, supabase]);
  useEffect(() => {
    const initialLoad = setTimeout(() => void load(), 0);
    return () => clearTimeout(initialLoad);
  }, [load]);
  useEffect(() => {
    const t = setTimeout(async () => {
      if (query.trim().length < 2) {
        setResults([]);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .neq("id", user?.id || "")
        .or(
          `username.ilike.%${query.trim()}%,display_name.ilike.%${query.trim()}%`,
        )
        .limit(15);
      setResults((data || []) as Profile[]);
    }, 300);
    return () => clearTimeout(t);
  }, [query, supabase, user]);
  async function action(id: string, fn: () => PromiseLike<{ error: unknown }>) {
    setBusy(id);
    const { error } = await fn();
    if (error) toast.error("Não foi possível concluir a ação.");
    else await load();
    setBusy(null);
  }
  async function start(friendId: string) {
    setBusy(friendId);
    const { data, error } = await supabase.rpc("ensure_direct_conversation", {
      p_friend_id: friendId,
    });
    if (error) toast.error(error.message);
    else router.push(`/conversa/${data}`);
    setBusy(null);
  }
  return (
    <AppShell>
      <header className="safe-top sticky top-0 z-20 px-5 pb-3 glass">
        <h1 className="text-[30px] font-bold tracking-[-.04em]">Amigos</h1>
        <div className="mt-4 grid grid-cols-4 rounded-2xl bg-[var(--surface-2)] p-1">
          {(["amigos", "pedidos", "procurar", "bloqueados"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`press rounded-xl py-2 text-xs font-bold capitalize ${tab === t ? "bg-[var(--surface)] shadow-sm" : "muted"}`}
            >
              {t}
              {t === "pedidos" &&
                requests.filter((r) => r.receiver_id === user?.id).length >
                  0 && (
                  <span className="ml-1 rounded-full bg-[var(--coral)] px-1.5 text-[10px] text-white">
                    {requests.filter((r) => r.receiver_id === user?.id).length}
                  </span>
                )}
            </button>
          ))}
        </div>
        {tab === "procurar" && (
          <label className="mt-3 flex items-center gap-2 rounded-2xl bg-[var(--surface)] px-3.5 py-3">
            <Search size={18} className="muted" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-transparent text-sm"
              placeholder="Nome ou @utilizador"
            />
          </label>
        )}
      </header>
      <section className="px-4 py-3">
        {loading ? (
          <div className="grid py-20 place-items-center">
            <LoaderCircle className="animate-spin text-[var(--brand)]" />
          </div>
        ) : tab === "amigos" ? (
          friends.length ? (
            <div className="space-y-2">
              {friends.map((f) => (
                <Person
                  key={f.id}
                  p={f}
                  actions={
                    <>
                      <button
                        onClick={() => start(f.id)}
                        className="grid size-10 place-items-center rounded-full bg-[var(--brand)] text-white"
                      >
                        <MessageCircle size={18} />
                      </button>
                      <button
                        onClick={() =>
                          action(f.friendship_id, () =>
                            supabase
                              .from("friendships")
                              .delete()
                              .eq("id", f.friendship_id),
                          )
                        }
                        className="grid size-10 place-items-center rounded-full bg-[var(--surface-2)] text-[var(--coral)]"
                      >
                        <UserMinus size={18} />
                      </button>
                    </>
                  }
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Users}
              title="Ainda sem amigos"
              description="Procura alguém pelo nome ou nome de utilizador."
            />
          )
        ) : tab === "pedidos" ? (
          requests.length ? (
            <div className="space-y-3">
              {requests.map((r) => {
                const incoming = r.receiver_id === user?.id,
                  p = (incoming ? r.sender : r.receiver) as Profile;
                return (
                  <Person
                    key={r.id}
                    p={p}
                    subtitle={
                      incoming ? "Quer ser teu amigo" : "Pedido enviado"
                    }
                    actions={
                      incoming ? (
                        <>
                          <button
                            disabled={busy === r.id}
                            onClick={() =>
                              action(r.id, () =>
                                supabase.rpc("respond_friend_request", {
                                  p_request_id: r.id,
                                  p_accept: true,
                                }),
                              )
                            }
                            className="grid size-10 place-items-center rounded-full bg-[var(--brand)] text-white"
                          >
                            <Check size={18} />
                          </button>
                          <button
                            onClick={() =>
                              action(r.id, () =>
                                supabase.rpc("respond_friend_request", {
                                  p_request_id: r.id,
                                  p_accept: false,
                                }),
                              )
                            }
                            className="grid size-10 place-items-center rounded-full bg-[var(--surface-2)]"
                          >
                            <X size={18} />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() =>
                            action(r.id, () =>
                              supabase
                                .from("friend_requests")
                                .update({ status: "cancelled" })
                                .eq("id", r.id),
                            )
                          }
                          className="rounded-xl bg-[var(--surface-2)] px-3 py-2 text-xs font-bold"
                        >
                          Cancelar
                        </button>
                      )
                    }
                  />
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={UserPlus}
              title="Sem pedidos"
              description="Os novos pedidos de amizade aparecem aqui."
            />
          )
        ) : tab === "bloqueados" ? (
          blocked.length ? (
            <div className="space-y-2">
              {blocked.map((p) => (
                <Person
                  key={p.id}
                  p={p}
                  subtitle="Bloqueado"
                  actions={
                    <button
                      disabled={busy === p.id}
                      onClick={() =>
                        action(p.id, () =>
                          supabase
                            .from("blocks")
                            .delete()
                            .eq("blocker_id", user!.id)
                            .eq("blocked_id", p.id),
                        )
                      }
                      className="rounded-xl bg-[var(--surface-2)] px-3 py-2 text-xs font-bold"
                    >
                      Desbloquear
                    </button>
                  }
                />
              ))}
            </div>
          ) : (
            <EmptyState icon={Ban} title="Sem bloqueios" description="Não bloqueaste nenhum utilizador." />
          )
        ) : query.length < 2 ? (
          <EmptyState
            icon={Search}
            title="Encontra os teus amigos"
            description="Escreve pelo menos duas letras para pesquisar."
          />
        ) : results.length ? (
          <div className="space-y-2">
            {results.map((p) => {
              const friend = friends.find((f) => f.id === p.id),
                request = requests.find(
                  (r) => r.sender_id === p.id || r.receiver_id === p.id,
                );
              return (
                <Person
                  key={p.id}
                  p={p}
                  actions={
                    friend ? (
                      <button
                        onClick={() => start(p.id)}
                        className="grid size-10 place-items-center rounded-full bg-[var(--brand)] text-white"
                      >
                        <MessageCircle size={18} />
                      </button>
                    ) : request ? (
                      <span className="text-xs font-bold muted">Pendente</span>
                    ) : (
                      <>
                        <button
                          disabled={busy === p.id}
                          onClick={() =>
                            action(p.id, () =>
                              supabase
                                .from("friend_requests")
                                .insert({
                                  sender_id: user!.id,
                                  receiver_id: p.id,
                                }),
                            )
                          }
                          className="grid size-10 place-items-center rounded-full bg-[var(--brand)] text-white"
                        >
                          <UserPlus size={18} />
                        </button>
                        <button
                          title="Bloquear"
                          onClick={() =>
                            action(p.id, () =>
                              supabase
                                .from("blocks")
                                .insert({
                                  blocker_id: user!.id,
                                  blocked_id: p.id,
                                }),
                            )
                          }
                          className="grid size-10 place-items-center rounded-full bg-[var(--surface-2)] text-[var(--coral)]"
                        >
                          <Ban size={17} />
                        </button>
                      </>
                    )
                  }
                />
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={Search}
            title="Utilizador não encontrado"
            description="Confirma o nome e tenta novamente."
          />
        )}
      </section>
    </AppShell>
  );
}
function Person({
  p,
  subtitle,
  actions,
}: {
  p: Profile;
  subtitle?: string;
  actions: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-3xl bg-[var(--surface)] p-3">
      <Avatar src={p.avatar_url} name={p.display_name} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">{p.display_name}</p>
        <p className="truncate text-xs muted">{subtitle || `@${p.username}`}</p>
      </div>
      <div className="flex gap-1">{actions}</div>
    </div>
  );
}
