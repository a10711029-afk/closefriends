"use client";

import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useSession } from "@/hooks/use-session";

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user, supabase } = useSession();
  const prompted = useRef(false);
<<<<<<< HEAD
  const pushReady = useRef(false);
=======
>>>>>>> a7427ac59fd52b756eb16471061647561cd4b01c

  const subscribe = useCallback(async () => {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!user || !publicKey || !("serviceWorker" in navigator) || !("PushManager" in window)) return false;

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new Error("Invalid push subscription");

    const { error } = await supabase.from("push_subscriptions").upsert({
      user_id: user.id,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth_key: json.keys.auth,
    }, { onConflict: "endpoint" });
    if (error) throw error;
<<<<<<< HEAD
    pushReady.current = true;
=======
>>>>>>> a7427ac59fd52b756eb16471061647561cd4b01c
    return true;
  }, [supabase, user]);

  useEffect(() => {
    if (!user || !("Notification" in window)) return;

    if (Notification.permission === "granted") {
      void subscribe().catch((error) => console.error("Push subscription failed:", error));
      return;
    }
    if (Notification.permission !== "default" || prompted.current) return;

    prompted.current = true;
    const timer = window.setTimeout(() => {
      toast("Ativar notificações?", {
        description: "Recebe novas mensagens mesmo com a app fechada.",
        duration: 10000,
        action: {
          label: "Ativar",
          onClick: async () => {
            try {
              const permission = await Notification.requestPermission();
              if (permission === "granted" && await subscribe()) toast.success("Notificações ativadas.");
              else if (permission === "denied") toast.error("As notificações ficaram bloqueadas nas definições do dispositivo.");
            } catch (error) {
              console.error("Notification setup failed:", error);
              toast.error("Não foi possível ativar as notificações.");
            }
          },
        },
      });
    }, 2500);

    return () => window.clearTimeout(timer);
  }, [subscribe, user]);
<<<<<<< HEAD

  useEffect(() => {
    if (!user || !("Notification" in window) || Notification.permission !== "granted") return;

    const channel = supabase
      .channel(`local-notifications:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async ({ new: row }) => {
          const message = row as { sender_id?: string; conversation_id?: string; message_type?: string; message_text?: string | null };
          if (!message.sender_id || message.sender_id === user.id || pushReady.current) return;
          if (document.visibilityState === "visible" && window.location.pathname === `/conversa/${message.conversation_id}`) return;

          const [{ data: sender }, registration] = await Promise.all([
            supabase.from("profiles").select("display_name").eq("id", message.sender_id).single(),
            navigator.serviceWorker.ready,
          ]);
          const body = message.message_type === "image"
            ? "Enviou uma fotografia"
            : message.message_type === "voice"
              ? "Enviou uma mensagem de voz"
              : message.message_type === "location"
                ? "Partilhou uma localização"
                : message.message_text || "Nova mensagem";
          await registration.showNotification(sender?.display_name || "CloseChat", {
            body,
            icon: "/icons/icon-192.png",
            badge: "/icons/icon-192.png",
            data: { url: `/conversa/${message.conversation_id}` },
          });
        },
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [supabase, user]);
=======
>>>>>>> a7427ac59fd52b756eb16471061647561cd4b01c

  return <>{children}</>;
}
