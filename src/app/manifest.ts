import type { MetadataRoute } from "next";

// wajib untuk output: "export" (Capacitor)
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Game Alesha",
    short_name: "Game Alesha",
    description:
      "Permainan balita: menggambar & mewarnai, berhitung 1–5, dan belajar huruf A–Z. Bisa diinstal dan jalan offline.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "id",
    background_color: "#FFF6DE",
    theme_color: "#FFF6DE",
    categories: ["education", "entertainment", "games"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
