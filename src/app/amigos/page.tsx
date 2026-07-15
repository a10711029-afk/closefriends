"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Ban,
  Check,
  LoaderCircle,
  MessageCircle,
  Search,
  ShieldOff,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { useSession } from "@/hooks/use-session";
import type { FriendRequest, Profile } from "@/lib/database.types";

type Friend = Profile & { friendship_id: string };
type Tab = "amigos" | "pedidos" | "procurar" | "bloqueados";

const tabs: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "amigos", label: "Amigos", icon: Users },
  { id: "pedidos", label: "Pedidos", icon: UserPlus },
  { id: "procurar", label: "Procurar", icon: Search },
  { id: "bloqueados", label: "Bloqueados", icon: ShieldOff },
];

export default function Amigos() {
  const { user, supabase } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("amigos");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [blocked, setBlocked] = useState<Profile[]>([]);
  const [results, setResults] = useState<Profile[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const [{ data: friendsData }, { data: requestsData }, { data: blockedData }] = await Promise.all([
      supabase.rpc("get_my_friends"),
      supabase
        .from("friend_requests")
        .select("*,sender:profiles!friend_requests_sender_id_fkey(*),receiver:profiles!friend_requests_receiver_id_fkey(*)")
        .eq("status", "pending")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order("created_at", { ascending: false }),
      supabase.rpc("get_blocked_users"),
    ]);
    setFriends((friendsData || []) as Friend[]);
    setRequests((requestsData || []) as unknown as FriendRequest[]);
    setBlocked((blockedData || []) as Profile[]);
    setLoading(false);
  }, [user, supabase]);

  useEffect(() => {
    const initialLoad = setTimeout(() => void load(), 0);
    return () => clearTimeout(initialLoad);
  }, [load]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      const value = query.trim();
      if (value.length < 2) {
        setResults([]);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .neq("id", user?.id || "")
        .or(`username.ilike.%${value}%,display_name.ilike.%${value}%`)
        .limit(15);
      setResults((data || []) as Profile[]);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, supabase, user]);

  const incomingCount = useMemo(
    () => requests.filter((request) => request.receiver_id === user?.id).length,
    [requests, user?.id],
  );

  async function action(id: string, fn: () => PromiseLike<{ error: unknown }>) {
    setBusy(id);
    const { error } = await fn();
    if (error) toast.error("Não foi possível concluir a ação.");
    else await load();
    setBusy(null);
  }

  async function start(friendId: string) {
    setBusy(friendId);
    const { data, error } = await supabase.rpc("ensure_direct_conversation", { p_friend_id: friendId });
    if (error) toast.error(error.message);
    else router.push(`/conversa/${data}`);
    setBusy(null);
  }

  return (
    <AppShell>
      <header className="safe-top sticky top-0 z-20 px-4 pb-3 glass">
        <div className="px-1">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--brand)]">A tua rede</p>
          <div className="mt-1 flex items-end justify-between">
            <h1 className="text-[30px] font-bold tracking-[-.04em]">Amigos</h1>
            <span className="rounded-full bg-[var(--brand-soft)] px-3 py-1 text-xs font-bold text-[var(--brand)]">{friends.length} {friends.length === 1 ? "amigo" : "amigos"}</span>
          </div>
        </div>

        <nav aria-label="Secções de amigos" className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`press relative flex shrink-0 items-center gap-2 rounded-2xl px-3.5 py-2.5 text-xs font-bold transition ${tab === id ? "bg-[var(--brand)] text-white shadow-lg shadow-[var(--brand)]/20" : "border hairline bg-[var(--surface)] muted"}`}
            >
              <Icon size={15} />
              {label}
              {id === "pedidos" && incomingCount > 0 && (
                <span className={`grid min-w-5 place-items-center rounded-full px-1 text-[10px] ${tab === id ? "bg-white text-[var(--brand)]" : "bg-[var(--coral)] text-white"}`}>{incomingCount}</span>
              )}
            </button>
          ))}
        </nav>

        {tab === "procurar" && (
          <label className="mt-3 flex items-center gap-3 rounded-2xl border hairline bg-[var(--surface)] px-4 py-3 shadow-sm focus-within:border-[var(--brand)]">
            <Search size={18} className="text-[var(--brand)]" />
            <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm" placeholder="Nome ou @utilizador" />
            {query && <button onClick={() => setQuery("")} aria-label="Limpar pesquisa" className="press grid size-7 place-items-center rounded-full bg-[var(--surface-2)]"><X size={14} /></button>}
          </label>
        )}
      </header>

      <section className="px-4 py-3">
        {loading ? (
          <div className="grid place-items-center py-20"><LoaderCircle className="animate-spin text-[var(--brand)]" /></div>
        ) : tab === "amigos" ? (
          friends.length ? (
            <div>
              <SectionHeading title="Os teus amigos" detail="Toca na mensagem para abrir a conversa" />
              <div className="space-y-2">
                {friends.map((friend) => (
                  <Person
                    key={friend.id}
                    profile={friend}
                    online={isOnline(friend.last_seen)}
                    actions={
                      <>
                        <IconButton label="Enviar mensagem" primary loading={busy === friend.id} onClick={() => void start(friend.id)}><MessageCircle size={18} /></IconButton>
                        <IconButton label="Remover amigo" danger onClick={() => void action(friend.friendship_id, () => supabase.from("friendships").delete().eq("id", friend.friendship_id))}><UserMinus size={17} /></IconButton>
                      </>
                    }
                  />
                ))}
              </div>
            </div>
          ) : (
            <EmptyState icon={Users} title="Ainda sem amigos" description="Procura alguém pelo nome ou nome de utilizador." action={<button onClick={() => setTab("procurar")} className="rounded-2xl bg-[var(--brand)] px-5 py-3 text-sm font-bold text-white">Procurar pessoas</button>} />
          )
        ) : tab === "pedidos" ? (
          requests.length ? (
            <div>
              <SectionHeading title="Pedidos de amizade" detail={incomingCount ? `${incomingCount} por responder` : "Todos os pedidos estão enviados"} />
              <div className="space-y-2">
                {requests.map((request) => {
                  const incoming = request.receiver_id === user?.id;
                  const profile = (incoming ? request.sender : request.receiver) as Profile;
                  return (
                    <Person
                      key={request.id}
                      profile={profile}
                      subtitle={incoming ? "Quer adicionar-te" : "À espera de resposta"}
                      badge={incoming ? "Novo" : "Enviado"}
                      actions={incoming ? (
                        <>
                          <IconButton label="Aceitar pedido" primary loading={busy === request.id} onClick={() => void action(request.id, () => supabase.rpc("respond_friend_request", { p_request_id: request.id, p_accept: true }))}><Check size={18} /></IconButton>
                          <IconButton label="Recusar pedido" onClick={() => void action(request.id, () => supabase.rpc("respond_friend_request", { p_request_id: request.id, p_accept: false }))}><X size={18} /></IconButton>
                        </>
                      ) : (
                        <TextButton onClick={() => void action(request.id, () => supabase.from("friend_requests").update({ status: "cancelled" }).eq("id", request.id))}>Cancelar</TextButton>
                      )}
                    />
                  );
                })}
              </div>
            </div>
          ) : <EmptyState icon={UserPlus} title="Sem pedidos" description="Os novos pedidos de amizade aparecem aqui." />
        ) : tab === "bloqueados" ? (
          blocked.length ? (
            <div>
              <SectionHeading title="Utilizadores bloqueados" detail="Não podem contactar-te nem ver as tuas stories" />
              <div className="space-y-2">
                {blocked.map((profile) => (
                  <Person key={profile.id} profile={profile} subtitle="Utilizador bloqueado" actions={<TextButton onClick={() => void action(profile.id, () => supabase.from("blocks").delete().eq("blocker_id", user!.id).eq("blocked_id", profile.id))}>Desbloquear</TextButton>} />
                ))}
              </div>
            </div>
          ) : <EmptyState icon={Ban} title="Sem bloqueios" description="Não bloqueaste nenhum utilizador." />
        ) : query.trim().length < 2 ? (
          <EmptyState icon={Search} title="Encontra os teus amigos" description="Escreve pelo menos duas letras para pesquisar." />
        ) : results.length ? (
          <div>
            <SectionHeading title="Resultados" detail={`${results.length} ${results.length === 1 ? "pessoa encontrada" : "pessoas encontradas"}`} />
            <div className="space-y-2">
              {results.map((profile) => {
                const friend = friends.find((item) => item.id === profile.id);
                const request = requests.find((item) => item.sender_id === profile.id || item.receiver_id === profile.id);
                return (
                  <Person
                    key={profile.id}
                    profile={profile}
                    online={isOnline(profile.last_seen)}
                    badge={friend ? "Amigo" : request ? "Pendente" : undefined}
                    actions={friend ? (
                      <IconButton label="Enviar mensagem" primary loading={busy === profile.id} onClick={() => void start(profile.id)}><MessageCircle size={18} /></IconButton>
                    ) : request ? null : (
                      <>
                        <IconButton label="Adicionar amigo" primary loading={busy === profile.id} onClick={() => void action(profile.id, () => supabase.from("friend_requests").insert({ sender_id: user!.id, receiver_id: profile.id }))}><UserPlus size={18} /></IconButton>
                        <IconButton label="Bloquear utilizador" danger onClick={() => void action(profile.id, () => supabase.from("blocks").insert({ blocker_id: user!.id, blocked_id: profile.id }))}><Ban size={17} /></IconButton>
                      </>
                    )}
                  />
                );
              })}
            </div>
          </div>
        ) : <EmptyState icon={Search} title="Utilizador não encontrado" description="Confirma o nome e tenta novamente." />}
      </section>
    </AppShell>
  );
}

function isOnline(lastSeen: string | null) {
  return !!lastSeen && Date.now() - new Date(lastSeen).getTime() < 120000;
}

function SectionHeading({ title, detail }: { title: string; detail: string }) {
  return <div className="mb-3 px-1"><h2 className="text-sm font-bold">{title}</h2><p className="mt-0.5 text-xs muted">{detail}</p></div>;
}

function Person({ profile, subtitle, badge, online, actions }: { profile: Profile; subtitle?: string; badge?: string; online?: boolean; actions: React.ReactNode }) {
  return (
    <article className="group flex items-center gap-3 rounded-[22px] border hairline bg-[var(--surface)] p-3 shadow-[0_6px_20px_rgba(30,31,56,.04)] transition hover:-translate-y-0.5 hover:shadow-md">
      <Avatar src={profile.avatar_url} name={profile.display_name} online={online} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2"><h3 className="truncate font-bold">{profile.display_name}</h3>{badge && <span className="shrink-0 rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--brand)]">{badge}</span>}</div>
        <p className="mt-0.5 truncate text-xs muted">{subtitle || `@${profile.username}`}</p>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
    </article>
  );
}

function IconButton({ label, primary, danger, loading, onClick, children }: { label: string; primary?: boolean; danger?: boolean; loading?: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button disabled={loading} onClick={onClick} aria-label={label} title={label} className={`press grid size-10 place-items-center rounded-2xl transition disabled:opacity-50 ${primary ? "bg-[var(--brand)] text-white shadow-md shadow-[var(--brand)]/20" : danger ? "bg-red-500/10 text-red-500" : "bg-[var(--surface-2)]"}`}>{loading ? <LoaderCircle size={17} className="animate-spin" /> : children}</button>;
}

function TextButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className="press rounded-xl bg-[var(--surface-2)] px-3 py-2 text-xs font-bold hover:text-[var(--brand)]">{children}</button>;
}
