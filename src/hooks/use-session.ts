"use client";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

const supabase = typeof window === "undefined" ? null : createClient();

export function useSession() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) return;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    const markOnline = (id: string) =>
      supabase.from("profiles").update({ last_seen: new Date().toISOString() }).eq("id", id);
    const activate = (nextUser: User | null) => {
      setUser(nextUser);
      setLoading(false);
      if (heartbeat) clearInterval(heartbeat);
      if (nextUser) {
        void markOnline(nextUser.id);
        heartbeat = setInterval(() => void markOnline(nextUser.id), 60000);
      }
    };
    void supabase.auth.getUser().then(({ data }) => activate(data.user));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => activate(session?.user ?? null));
    return () => { if (heartbeat) clearInterval(heartbeat); data.subscription.unsubscribe(); };
  }, []);

  return { user, loading, supabase: supabase! };
}
