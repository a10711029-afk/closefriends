import { AuthGate } from "@/components/auth/auth-gate"; import { BottomNav } from "@/components/bottom-nav";
export function AppShell({children}:{children:React.ReactNode}){return <AuthGate><div className="app-frame app-page">{children}<BottomNav/></div></AuthGate>}
