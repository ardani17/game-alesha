"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Calculator, Palette, Puzzle, RefreshCw, Type } from "lucide-react";
import { Browser } from "@capacitor/browser";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { ColoringSvg } from "@/components/coloring-svg";
import { COLORING_PAGES, suggestedFills } from "@/lib/coloring-pages";
import { openSound } from "@/lib/sounds";
import APP_CONFIG from "@/data/app-config.json";

const LETTER_COLORS = [
  "#EF4444",
  "#F97316",
  "#EAB308",
  "#22C55E",
  "#0EA5E9",
  "#A855F7",
  "#EC4899",
];

const TITLE = "Game Alesha";

export type MenuPick = "draw" | "count" | "letters" | "read" | "match";

/* ------------------------ pembaruan otomatis (GitHub) ------------------------ */

/** Plugin lokal Android (InstallApkPlugin.java) — buka pemasang APK. */
interface InstallApkPlugin {
  install(options: { uri: string }): Promise<void>;
}
const InstallApk = registerPlugin<InstallApkPlugin>("InstallApk");

interface RilisInfo {
  versi: string;
  halaman: string;
  apkUrl: string | null;
}

type UpdState =
  | { status: "idle" }
  | { status: "cek" }
  | { status: "ok"; msg: string }
  | { status: "ada"; rilis: RilisInfo }
  | { status: "unduh"; pct: number }
  | { status: "pasang" }
  | { status: "gagal"; msg: string; halaman?: string };

/** "1.2.0" > "1.1.9"? bandingkan per bagian angka */
function isNewer(a: string, b: string) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0);
  }
  return false;
}

async function ambilRilisTerbaru(): Promise<RilisInfo | null> {
  const repo = APP_CONFIG.githubRepo;
  if (!repo || repo === "USERNAME/REPO") return null;
  const r = await fetch(`https://api.github.com/repos/${repo}/releases/latest`);
  if (!r.ok) throw new Error(String(r.status));
  const rel = (await r.json()) as {
    tag_name?: string;
    html_url?: string;
    assets?: { name?: string; browser_download_url?: string }[];
  };
  const versi = String(rel.tag_name ?? "").replace(/^v/, "");
  const apk = (rel.assets ?? []).find((a) =>
    a.name?.toLowerCase().endsWith(".apk")
  );
  return {
    versi,
    halaman: rel.html_url ?? `https://github.com/${repo}/releases/latest`,
    apkUrl: apk?.browser_download_url ?? null,
  };
}

async function cekPembaruan(): Promise<UpdState> {
  try {
    const rilis = await ambilRilisTerbaru();
    if (rilis === null) {
      return {
        status: "gagal",
        msg: "Repo GitHub belum diatur di src/data/app-config.json",
      };
    }
    if (isNewer(rilis.versi, APP_CONFIG.version)) {
      return { status: "ada", rilis };
    }
    return { status: "ok", msg: `Sudah versi terbaru (v${APP_CONFIG.version})` };
  } catch {
    return { status: "gagal", msg: "Tidak bisa cek — perlu internet" };
  }
}

/** Unduh blob dengan laporan progres (bila server mengirim content-length). */
async function unduhDenganProgres(
  url: string,
  onPct: (n: number) => void
): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const total = Number(res.headers.get("content-length") ?? 0);
  if (!res.body || !total) return res.blob();
  const reader = res.body.getReader();
  const parts: BlobPart[] = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      parts.push(value);
      got += value.byteLength;
      onPct(Math.min(99, Math.round((got / total) * 100)));
    }
  }
  onPct(100);
  return new Blob(parts, { type: "application/vnd.android.package-archive" });
}

function blobKeBase64(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result).split(",")[1] ?? "");
    fr.onerror = () => reject(new Error("gagal membaca berkas unduhan"));
    fr.readAsDataURL(b);
  });
}

/** Main menu: pick a game. Styled like the coloring gallery for one coherent look. */
export function GameMenu({ onPick }: { onPick: (game: MenuPick) => void }) {
  const previewPage =
    COLORING_PAGES.find((p) => p.id === "ikan") ?? COLORING_PAGES[0];
  const [upd, setUpd] = useState<UpdState>({ status: "idle" });

  // cek rilis GitHub otomatis saat aplikasi dibuka (tanpa mengganggu offline)
  useEffect(() => {
    const t = window.setTimeout(async () => {
      if (!navigator.onLine) return;
      setUpd(await cekPembaruan());
    }, 1500);
    return () => window.clearTimeout(t);
  }, []);

  const onCekUpdate = async () => {
    setUpd({ status: "cek" });
    setUpd(await cekPembaruan());
  };

  /**
   * Pembaruan langsung dari dalam aplikasi: unduh APK dari GitHub Releases
   * (dengan progres) lalu buka pemasang Android. Di web, jatuh ke halaman
   * rilis di browser.
   */
  const perbaruiSekarang = async (rilis: RilisInfo) => {
    if (!Capacitor.isNativePlatform() || !rilis.apkUrl) {
      await Browser.open({ url: rilis.halaman });
      return;
    }
    try {
      setUpd({ status: "unduh", pct: 0 });
      const blob = await unduhDenganProgres(rilis.apkUrl, (pct) =>
        setUpd((u) => (u.status === "unduh" ? { status: "unduh", pct } : u))
      );
      const base64 = await blobKeBase64(blob);
      const w = await Filesystem.writeFile({
        path: "pembaruan-gamealesha.apk",
        directory: Directory.Cache,
        data: base64,
      });
      setUpd({ status: "pasang" });
      await InstallApk.install({ uri: w.uri });
      // pemasang sistem terbuka; pengguna tinggal konfirmasi "Install"
    } catch {
      setUpd({
        status: "gagal",
        msg: "Unduhan gagal — periksa koneksi, atau unduh manual:",
        halaman: rilis.halaman,
      });
    }
  };

  const pick = (game: MenuPick) => {
    openSound();
    onPick(game);
  };

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-[#FFF6DE] font-sans text-[#41403c] select-none">
      {/* soft decorative blobs */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-16 -top-16 h-56 w-56 rounded-full bg-[#FFE3EC]" />
        <div className="absolute -right-14 top-10 h-44 w-44 rounded-full bg-[#DFF3FF]" />
        <div className="absolute -left-10 bottom-24 h-40 w-40 rounded-full bg-[#E8F8D8]" />
        <div className="absolute -right-16 bottom-40 h-52 w-52 rounded-full bg-[#FFF0C2]" />
      </div>

      <header className="relative px-4 pt-8 text-center sm:pt-10">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          {[...TITLE].map((ch, i) =>
            ch === " " ? (
              <span key={i}> </span>
            ) : (
              <span key={i} style={{ color: LETTER_COLORS[i % LETTER_COLORS.length] }}>
                {ch}
              </span>
            )
          )}
        </h1>
        <p className="mt-2 text-base font-semibold text-[#9a8757] sm:text-lg">
          Mau main apa hari ini?
        </p>
      </header>

      <main className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center overflow-y-auto px-4 pb-10 pt-6">
        <div className="grid grid-cols-2 gap-4">
          {/* Menggambar (existing coloring & free-draw game) */}
          <motion.button
            type="button"
            whileHover={{ scale: 1.04, rotate: -1 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => pick("draw")}
            aria-label="Menggambar dan mewarnai"
            className="flex flex-col rounded-3xl border-4 border-white bg-gradient-to-br from-amber-300 via-orange-300 to-pink-300 p-3 shadow-[0_8px_0_rgba(180,120,0,0.18)]"
          >
            <div className="grid aspect-square place-items-center rounded-2xl bg-white/35 p-3">
              <ColoringSvg
                page={previewPage}
                fills={suggestedFills(previewPage)}
                strokeWidth={5}
                className="h-full w-full drop-shadow-sm"
              />
            </div>
            <div className="mt-3 flex items-center justify-center gap-1.5">
              <Palette className="h-5 w-5 text-white" strokeWidth={2.4} />
              <p className="text-lg font-extrabold text-white drop-shadow-md">
                Menggambar
              </p>
            </div>
            <p className="text-center text-xs font-semibold text-white/95">
              Mewarnai &amp; gambar bebas
            </p>
          </motion.button>

          {/* Berhitung (new counting game) */}
          <motion.button
            type="button"
            whileHover={{ scale: 1.04, rotate: 1 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => pick("count")}
            aria-label="Berhitung"
            className="flex flex-col rounded-3xl border-4 border-white bg-gradient-to-br from-sky-300 via-indigo-300 to-purple-300 p-3 shadow-[0_8px_0_rgba(80,80,200,0.18)]"
          >
            <div className="grid aspect-square place-items-center rounded-2xl bg-white/35 p-3">
              <div className="flex -rotate-6 flex-col items-center gap-1.5">
                {[
                  { n: 1, c: "#EF4444", e: "🍎" },
                  { n: 2, c: "#FACC15", e: "⭐" },
                  { n: 3, c: "#3B82F6", e: "🎈" },
                ].map((row, i) => (
                  <motion.div
                    key={row.n}
                    animate={{ y: [0, -4, 0] }}
                    transition={{
                      repeat: Infinity,
                      duration: 1.6 + i * 0.3,
                      ease: "easeInOut",
                    }}
                    className="flex items-center gap-2"
                  >
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-white/90 text-xl font-extrabold shadow-sm" style={{ color: row.c }}>
                      {row.n}
                    </span>
                    <span className="text-2xl">{row.e}</span>
                  </motion.div>
                ))}
              </div>
            </div>
            <div className="mt-3 flex items-center justify-center gap-1.5">
              <Calculator className="h-5 w-5 text-white" strokeWidth={2.4} />
              <p className="text-lg font-extrabold text-white drop-shadow-md">
                Berhitung
              </p>
            </div>
            <p className="text-center text-xs font-semibold text-white/95">
              Hitung 1 sampai 5
            </p>
          </motion.button>

          {/* Belajar Huruf */}
          <motion.button
            type="button"
            whileHover={{ scale: 1.04, rotate: -1 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => pick("letters")}
            aria-label="Belajar huruf"
            className="flex flex-col rounded-3xl border-4 border-white bg-gradient-to-br from-lime-300 via-emerald-300 to-teal-300 p-3 shadow-[0_8px_0_rgba(20,150,110,0.18)]"
          >
            <div className="grid aspect-square place-items-center rounded-2xl bg-white/35">
              <div className="flex flex-col items-center leading-none">
                <span className="text-4xl font-extrabold sm:text-5xl">
                  <span style={{ color: "#EF4444" }}>A</span>
                  <span className="text-[0.8em]" style={{ color: "#3B82F6" }}>
                    a
                  </span>
                </span>
                <span className="mt-2 text-2xl sm:text-3xl">🍎</span>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-center gap-1.5">
              <BookOpen className="h-5 w-5 text-white" strokeWidth={2.4} />
              <p className="text-lg font-extrabold text-white drop-shadow-md">
                Belajar Huruf
              </p>
            </div>
            <p className="text-center text-xs font-semibold text-white/95">
              Kenalan dengan A sampai Z
            </p>
          </motion.button>

          {/* Membaca Kata */}
          <motion.button
            type="button"
            whileHover={{ scale: 1.04, rotate: 1 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => pick("read")}
            aria-label="Membaca kata"
            className="flex flex-col rounded-3xl border-4 border-white bg-gradient-to-br from-fuchsia-300 via-pink-300 to-rose-300 p-3 shadow-[0_8px_0_rgba(219,39,119,0.18)]"
          >
            <div className="grid aspect-square place-items-center rounded-2xl bg-white/35 p-3">
              <div className="flex flex-col items-center gap-1.5">
                <div className="flex gap-1">
                  {["A", "P", "E", "L"].map((ch, i) => (
                    <span
                      key={i}
                      className="grid h-8 w-8 place-items-center rounded-lg bg-white/90 text-base font-extrabold shadow-sm"
                      style={{ color: LETTER_COLORS[i % LETTER_COLORS.length] }}
                    >
                      {ch}
                    </span>
                  ))}
                </div>
                <span className="text-3xl">🍎</span>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-center gap-1.5">
              <Type className="h-5 w-5 text-white" strokeWidth={2.4} />
              <p className="text-lg font-extrabold text-white drop-shadow-md">
                Membaca
              </p>
            </div>
            <p className="text-center text-xs font-semibold text-white/95">
              Susun huruf jadi kata
            </p>
          </motion.button>

          {/* Menyamakan Gambar (drag gambar ke pasangannya) */}
          <motion.button
            type="button"
            whileHover={{ scale: 1.04, rotate: -1 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => pick("match")}
            aria-label="Menyamakan gambar"
            className="flex flex-col rounded-3xl border-4 border-white bg-gradient-to-br from-teal-300 via-cyan-300 to-sky-300 p-3 shadow-[0_8px_0_rgba(13,148,136,0.18)]"
          >
            <div className="relative grid aspect-square place-items-center rounded-2xl bg-white/35 p-3">
              <div className="absolute left-1.5 top-2 grid h-14 w-14 -rotate-6 place-items-center rounded-2xl bg-white/90 text-3xl shadow-sm">
                🐟
              </div>
              <div className="absolute -right-0.5 bottom-1.5 grid h-14 w-14 rotate-6 place-items-center rounded-2xl bg-white/90 text-3xl shadow-sm">
                🐟
                <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-emerald-400 text-[10px] font-extrabold text-white ring-2 ring-white">
                  ✓
                </span>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-center gap-1.5">
              <Puzzle className="h-5 w-5 text-white" strokeWidth={2.4} />
              <p className="text-lg font-extrabold text-white drop-shadow-md">
                Menyamakan
              </p>
            </div>
            <p className="text-center text-xs font-semibold text-white/95">
              Jodohkan gambar yang sama
            </p>
          </motion.button>
        </div>

        {/* cek pembaruan via GitHub Releases (opsional, hanya saat online) */}
        <div className="mt-6 flex flex-col items-center gap-2">
          <motion.button
            type="button"
            whileTap={{ scale: 0.94 }}
            onClick={onCekUpdate}
            disabled={upd.status === "cek"}
            aria-label="Cek pembaruan"
            className="flex items-center gap-2 rounded-full bg-white/80 px-5 py-2 text-sm font-bold text-[#9a8757] shadow-sm ring-1 ring-amber-100 transition-colors hover:bg-white disabled:opacity-60"
          >
            <RefreshCw
              className={`h-4 w-4 ${upd.status === "cek" ? "animate-spin" : ""}`}
            />
            Cek pembaruan
            <span className="font-semibold opacity-70">v{APP_CONFIG.version}</span>
          </motion.button>

          {upd.status === "ada" && (
            <div className="flex flex-col items-center gap-2">
              <motion.p
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-sm font-bold text-[#E8590C]"
              >
                ✨ Versi {upd.rilis.versi} tersedia!
              </motion.p>
              <motion.button
                type="button"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => void perbaruiSekarang(upd.rilis)}
                className="rounded-full bg-[#38BDF8] px-6 py-2.5 text-sm font-extrabold text-white shadow-[0_4px_0_rgba(2,132,199,0.9)]"
              >
                ⬇ Perbarui sekarang
              </motion.button>
            </div>
          )}
          {upd.status === "unduh" && (
            <div className="flex w-56 flex-col items-center gap-1.5">
              <p className="text-sm font-bold text-[#9a8757]">
                Mengunduh… {upd.pct}%
              </p>
              <div className="h-3 w-full overflow-hidden rounded-full bg-amber-100 ring-1 ring-amber-200">
                <motion.div
                  className="h-full rounded-full bg-[#38BDF8]"
                  animate={{ width: `${upd.pct}%` }}
                  transition={{ duration: 0.25 }}
                />
              </div>
            </div>
          )}
          {upd.status === "pasang" && (
            <p className="max-w-xs text-center text-sm font-bold text-[#E8590C]">
              Membuka pemasang… tekan <b>Install</b> di layar HP ya! 👇
            </p>
          )}
          {upd.status === "ok" && (
            <p className="text-sm font-semibold text-[#9a8757]">✓ {upd.msg}</p>
          )}
          {upd.status === "gagal" && (
            <div className="flex flex-col items-center gap-1">
              <p className="text-center text-sm font-semibold text-[#c2843c]">
                {upd.msg}
              </p>
              {upd.halaman && (
                <button
                  type="button"
                  onClick={() => void Browser.open({ url: upd.halaman! })}
                  className="text-sm font-bold text-[#0284c7] underline"
                >
                  Buka halaman rilis
                </button>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
