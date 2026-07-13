import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CloseChat — entre amigos",
    short_name: "CloseChat",
    description: "Mensagens e fotografias privadas entre amigos.",
    start_url: "/conversas?source=pwa",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f5f6fb",
    theme_color: "#5b5cf0",
    categories: ["social", "communication"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
