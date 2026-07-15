"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    if ("Notification" in window) {
      setPermission(Notification.permission);
      
      if (Notification.permission === "default") {
        // Show a toast to request permission after a delay
        const timer = setTimeout(() => {
          toast("Ativar notificações?", {
            description: "Recebe alertas quando tens novas mensagens",
            action: {
              label: "Ativar",
              onClick: async () => {
                const result = await Notification.requestPermission();
                setPermission(result);
                if (result === "granted") {
                  toast.success("Notificações ativadas!");
                }
              },
            },
          });
        }, 3000);

        return () => clearTimeout(timer);
      }
    }
  }, []);

  return <>{children}</>;
}
