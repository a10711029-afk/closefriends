"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/hooks/use-session";
export function AuthGate({children}:{children:React.ReactNode}) { const {user,loading}=useSession(); const router=useRouter(); const path=usePathname(); useEffect(()=>{if(!loading&&!user)router.replace(`/login?next=${encodeURIComponent(path)}`)},[loading,user,router,path]); if(loading||!user)return <div className="grid min-h-dvh place-items-center"><div className="size-9 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--brand)]"/></div>; return children; }
