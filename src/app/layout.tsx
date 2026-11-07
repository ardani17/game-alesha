import type { Metadata, Viewport } from "next";
import { Fredoka } from "next/font/google";
import { SerwistProvider } from "@serwist/next/react";
import { Capacitor } from "@capacitor/core";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Game Alesha — Bermain & Belajar untuk Balita",
  description:
    "Kumpulan permainan balita: menggambar & mewarnai dengan gesekan jari, berhitung 1–5, dan belajar huruf A–Z bersama suara. Bisa diinstal dan jalan offline.",
  keywords: [
    "mewarnai",
    "menggambar",
    "berhitung",
    "belajar huruf",
    "alfabet",
    "membaca",
    "anak",
    "balita",
    "belajar warna",
    "belajar angka",
  ],
  applicationName: "Game Alesha",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Game Alesha",
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      {
        url: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#FFF6DE",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body
        className={`${fredoka.variable} antialiased bg-background text-foreground font-sans`}
      >
        <SerwistProvider
          swUrl="/sw.js"
          disable={
            process.env.NODE_ENV === "development" || Capacitor.isNativePlatform()
          }
        >
          {children}
          <Toaster />
        </SerwistProvider>
      </body>
    </html>
  );
}
