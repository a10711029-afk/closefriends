"use client";

import Link from "next/link";
import { ContactRound, MessagesSquare, UserRound } from "lucide-react";
import { usePathname } from "next/navigation";

const items = [
  { href: "/conversas", label: "Conversas", icon: MessagesSquare },
  { href: "/amigos", label: "Amigos", icon: ContactRound },
  { href: "/perfil", label: "Perfil", icon: UserRound },
];

export function BottomNav() {
  const path = usePathname();

  return (
    <nav aria-label="Navegação principal" className="nav-dock fixed inset-x-3 z-40 mx-auto grid max-w-[398px] grid-cols-3 gap-1 rounded-[28px] border hairline">
      {items.map(({ href, label, icon: Icon }) => {
        const active = path === href || path.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`nav-item press relative flex min-h-14 min-w-0 items-center justify-center gap-2 rounded-[21px] px-2 ${active ? "nav-item-active" : "muted"}`}
          >
            <span className={`nav-icon grid size-9 shrink-0 place-items-center rounded-2xl ${active ? "bg-white/16" : ""}`}>
              <Icon size={20} strokeWidth={active ? 2.5 : 2} />
            </span>
            <span className={`overflow-hidden text-xs font-bold transition-all duration-200 ${active ? "max-w-20 opacity-100" : "max-w-0 opacity-0 sm:max-w-20 sm:opacity-100"}`}>
              {label}
            </span>
            {active && <span aria-hidden="true" className="absolute -bottom-0.5 left-1/2 h-1 w-5 -translate-x-1/2 rounded-full bg-white/80" />}
          </Link>
        );
      })}
    </nav>
  );
}
