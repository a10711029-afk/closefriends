"use client";

import Link from "next/link";
import { MessageCircle, Users, UserRound } from "lucide-react";
import { usePathname } from "next/navigation";

const items = [
  { href: "/conversas", label: "Conversas", icon: MessageCircle },
  { href: "/amigos", label: "Amigos", icon: Users },
  { href: "/perfil", label: "Perfil", icon: UserRound },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav aria-label="Navegação principal" className="nav-dock fixed inset-x-3 bottom-2 z-40 mx-auto flex max-w-[406px] items-center justify-around rounded-[26px] border hairline px-2 py-1.5">
      {items.map(({ href, label, icon: Icon }) => {
        const active = path.startsWith(href);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`press flex min-w-24 flex-col items-center gap-0.5 rounded-2xl px-3 py-1.5 text-[11px] font-semibold ${active ? "text-[var(--brand)]" : "muted"}`}>
            <span className={`grid size-8 place-items-center rounded-xl transition-colors ${active ? "bg-[var(--brand-soft)]" : ""}`}>
              <Icon size={20} strokeWidth={active ? 2.6 : 2} />
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
