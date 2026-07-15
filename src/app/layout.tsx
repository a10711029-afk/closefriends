import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { Toaster } from "sonner";
import { PwaProvider } from "@/components/pwa-provider";
import { NotificationsProvider } from "@/components/notifications-provider";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
export const metadata: Metadata = {
  title: { default: "CloseChat", template: "%s · CloseChat" },
  description: "Conversas privadas entre amigos próximos.", applicationName: "CloseChat",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "CloseChat" },
  formatDetection: { telephone: false }, manifest: "/manifest.webmanifest",
  icons: { icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }], apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }] },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1, viewportFit: "cover", themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f5f6fb" }, { media: "(prefers-color-scheme: dark)", color: "#090a10" }] };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="pt" suppressHydrationWarning><body className={`${geist.variable} antialiased`}><PwaProvider><NotificationsProvider>{children}</NotificationsProvider></PwaProvider><Toaster position="top-center" richColors closeButton /></body></html>; }
