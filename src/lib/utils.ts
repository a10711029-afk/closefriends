import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
export function initials(name?: string | null) { return (name || "?").split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase(); }
export function timeAgo(date?: string | null) { if (!date) return ""; const d = new Date(date); const mins = Math.floor((Date.now() - d.getTime()) / 60000); if (mins < 1) return "agora"; if (mins < 60) return `${mins} min`; if (mins < 1440) return `${Math.floor(mins / 60)} h`; return d.toLocaleDateString("pt-PT", { day: "numeric", month: "short" }); }
