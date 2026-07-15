"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell,
  BellRing,
  ChevronRight,
  LogOut,
  Pencil,
  ShieldCheck,
  Smartphone,
  UserRound,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Avatar } from "@/components/ui/avatar";
import { useSession } from "@/hooks/use-session";
import type { Profile } from "@/lib/database.types";

export default function Perfil() {
  const { user, supabase } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [friendCount, setFriendCount] = useState(0);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [previewsEnabled, setPreviewsEnabled] = useState(true);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    if (!user) return;
    setNotificationPermission("Notification" in window ? Notification.permission : "unsupported");
    setStandalone(window.matchMedia("(display-mode: standalone)").matches);
    void Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.rpc("get_my_friends"),
      supabase.from("push_subscriptions").select("previews_enabled").eq("user_id", user.id).limit(1),
    ]).then(([profileResult, friendsResult, subscriptionResult]) => {
      setProfile(profileResult.data as Profile | null);
      setFriendCount(friendsResult.data?.length || 0);
      if (subscriptionResult.data?.[0]) setPreviewsEnabled(subscriptionResult.data[0].previews_enabled);
    });
    void supabase.from("profiles").update({ last_seen: new Date().toISOString() }).eq("id", user.id);
  }, [user, supabase]);

  async function requestNotifications() {
    if (!("Notification" in window)) {
      toast.error("Este dispositivo não suporta notificações web.");
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === "granted") {
      window.dispatchEvent(new Event("closechat:notifications-enabled"));
      toast.success("Notificações ativadas.");
    }
    else toast.error("A permissão de notificações não foi concedida.");
  }

  async function togglePreviews() {
    if (!user) return;
    const next = !previewsEnabled;
    const { error } = await supabase
      .from("push_subscriptions")
      .update({ previews_enabled: next })
      .eq("user_id", user.id);
    if (error) {
      toast.error("Não foi possível guardar a preferência.");
      return;
    }
    setPreviewsEnabled(next);
  }

  const permissionLabel = notificationPermission === "granted"
    ? "Ativas"
    : notificationPermission === "denied"
      ? "Bloqueadas no dispositivo"
      : notificationPermission === "unsupported"
        ? "Não suportadas"
        : "Por ativar";

  return (
    <AppShell>
      <header className="safe-top flex items-center justify-between px-5 pb-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--brand)]">Conta</p>
          <h1 className="mt-1 text-[30px] font-bold tracking-[-.04em]">Perfil e definições</h1>
        </div>
        <Link href="/perfil/editar" aria-label="Editar perfil" className="press grid size-11 place-items-center rounded-2xl bg-[var(--surface)] text-[var(--brand)] shadow-sm">
          <Pencil size={20} />
        </Link>
      </header>

      <section className="space-y-5 px-4">
        <div className="card relative overflow-hidden px-5 py-6">
          <div className="absolute -right-12 -top-12 size-40 rounded-full bg-[var(--brand)]/10 blur-2xl" />
          <div className="relative flex items-center gap-4">
            <Avatar src={profile?.avatar_url} name={profile?.display_name} size="xl" online />
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-xl font-bold">{profile?.display_name || "A carregar…"}</h2>
              <p className="mt-0.5 truncate text-sm font-semibold text-[var(--brand)]">@{profile?.username || "utilizador"}</p>
              <div className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[var(--surface-2)] px-3 py-1.5 text-xs">
                <Users size={15} /> <strong>{friendCount}</strong> <span className="muted">amigos</span>
              </div>
            </div>
          </div>
          {profile?.bio && <p className="relative mt-4 border-t hairline pt-4 text-sm leading-6 muted">{profile.bio}</p>}
          <Link href="/perfil/editar" className="press relative mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--brand)] px-4 py-3 text-sm font-bold text-white">
            <Pencil size={17} /> Editar perfil
          </Link>
        </div>

        <SettingsGroup title="Notificações" subtitle="Escolhe como queres ser avisado de novas mensagens.">
          <SettingRow icon={BellRing} label="Estado das notificações" detail={permissionLabel} />
          {notificationPermission !== "granted" && notificationPermission !== "unsupported" && (
            <button onClick={() => void requestNotifications()} className="press mx-3 mb-3 flex w-[calc(100%-1.5rem)] items-center justify-center gap-2 rounded-xl bg-[var(--brand-soft)] px-4 py-3 text-sm font-bold text-[var(--brand)]">
              <Bell size={17} /> Ativar notificações
            </button>
          )}
          <SettingToggle icon={Bell} label="Mostrar pré-visualização" detail="Inclui parte da mensagem na notificação" checked={previewsEnabled} onChange={() => void togglePreviews()} />
        </SettingsGroup>

        <SettingsGroup title="Privacidade e aplicação" subtitle="O CloseChat mantém as conversas limitadas aos teus amigos.">
          <SettingRow icon={ShieldCheck} label="Privacidade das conversas" detail="Só amigos" />
          <SettingRow icon={Smartphone} label="Aplicação" detail={standalone ? "Instalada" : "Versão web"} />
          <SettingRow icon={UserRound} label="Dados do perfil" detail="Nome, foto e biografia" href="/perfil/editar" />
        </SettingsGroup>

        <button onClick={() => void supabase.auth.signOut()} className="press flex w-full items-center justify-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/8 py-4 font-bold text-red-500">
          <LogOut size={19} /> Terminar sessão
        </button>
        <p className="pb-7 text-center text-[11px] muted">CloseChat · privado por definição</p>
      </section>
    </AppShell>
  );
}

function SettingsGroup({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="px-1 text-sm font-bold">{title}</h2>
      <p className="mt-1 px-1 text-xs leading-5 muted">{subtitle}</p>
      <div className="mt-3 overflow-hidden rounded-[24px] border hairline bg-[var(--surface)]">{children}</div>
    </section>
  );
}

function SettingRow({ icon: Icon, label, detail, href }: { icon: typeof UserRound; label: string; detail: string; href?: string }) {
  const content = (
    <>
      <span className="grid size-10 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]"><Icon size={18} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="mt-0.5 block truncate text-xs muted">{detail}</span>
      </span>
      {href && <ChevronRight size={17} className="muted" />}
    </>
  );
  const className = "flex items-center gap-3 border-b hairline p-3.5 last:border-0";
  return href ? <Link href={href} className={className}>{content}</Link> : <div className={className}>{content}</div>;
}

function SettingToggle({ icon: Icon, label, detail, checked, onChange }: { icon: typeof Bell; label: string; detail: string; checked: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} role="switch" aria-checked={checked} className="flex w-full items-center gap-3 p-3.5 text-left">
      <span className="grid size-10 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]"><Icon size={18} /></span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{label}</span><span className="mt-0.5 block text-xs muted">{detail}</span></span>
      <span className={`relative h-7 w-12 rounded-full transition ${checked ? "bg-[var(--brand)]" : "bg-[var(--surface-2)]"}`}><span className={`absolute top-1 size-5 rounded-full bg-white shadow transition ${checked ? "left-6" : "left-1"}`} /></span>
    </button>
  );
}
