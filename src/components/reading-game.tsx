"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Volume2, VolumeX } from "lucide-react";
import { Confetti } from "@/components/confetti";
import { ToolButton } from "@/components/tool-button";
import {
  clickSound,
  popSound,
  setMuted,
  tadaSound,
  undoSound,
} from "@/lib/sounds";
import { playVoice, stopVoice } from "@/lib/tts";
import WORDS from "@/data/reading.json";

const LETTER_COLORS = [
  "#EF4444",
  "#F97316",
  "#EAB308",
  "#22C55E",
  "#0EA5E9",
  "#A855F7",
  "#EC4899",
];

/** kata ronde pseudo-acak deterministik (aman untuk hidrasi SSR) */
function wordForRound(no: number) {
  return WORDS[(no * 7) % WORDS.length];
}

/** susunan ubin pseudo-acak deterministik: dibalik / diputar */
function tilesForRound(word: string, no: number) {
  const letters = word.toUpperCase().split("");
  if (no % 2 === 0) return [...letters].reverse();
  const rot = (no % letters.length) + 1;
  return [...letters.slice(rot), ...letters.slice(0, rot)];
}

/* ---------------------------------- game ---------------------------------- */

/**
 * Yuk Membaca! — gambar menjadi petunjuk, huruf tersusun acak; sentuh
 * huruf satu per satu sesuai urutan kata. Setiap huruf dilafalkan, dan
 * kata utuh diucapkan saat selesai disusun.
 */
export function ReadingGame({ onExit }: { onExit: () => void }) {
  const [roundNo, setRoundNo] = useState(0);
  const word = wordForRound(roundNo);
  const letters = useMemo(
    () => word.word.toUpperCase().split(""),
    [word.word]
  );
  const tiles = useMemo(() => tilesForRound(word.word, roundNo), [word.word, roundNo]);

  const [placed, setPlaced] = useState(0);
  const [usedTiles, setUsedTiles] = useState<number[]>([]);
  const [muted, setMutedUi] = useState(false);
  const mutedRef = useRef(false);
  const [done, setDone] = useState(false);
  const [shake, setShake] = useState<number | null>(null);
  const advanceTimer = useRef<number | null>(null);

  const kataUrl = `/audio/membaca/kata/${word.word.toLowerCase()}.mp3`;

  const sayWord = useCallback(() => {
    if (mutedRef.current) return;
    playVoice(kataUrl, word.word);
  }, [kataUrl, word.word]);

  // ucapkan kata setiap ronde baru
  useEffect(() => {
    const t = window.setTimeout(sayWord, 450);
    return () => window.clearTimeout(t);
  }, [roundNo, sayWord]);

  // never leave a pending auto-advance behind
  useEffect(
    () => () => {
      if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
      stopVoice();
    },
    []
  );

  const nextRound = () => {
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    advanceTimer.current = null;
    setDone(false);
    setPlaced(0);
    setUsedTiles([]);
    setRoundNo((r) => r + 1);
    clickSound();
  };

  const tapTile = (ch: string, tileIdx: number) => {
    if (done) return;
    const expected = letters[placed];
    if (ch === expected) {
      popSound(1.2);
      if (!mutedRef.current) {
        playVoice(
          `/audio/membaca/huruf/${encodeURIComponent(ch)}.mp3`,
          ch
        );
      }
      const next = placed + 1;
      setPlaced(next);
      setUsedTiles((u) => [...u, tileIdx]);
      if (next === letters.length) {
        setDone(true);
        tadaSound();
        // setelah fanfare: "Hebat! Apel!"
        window.setTimeout(() => {
          if (mutedRef.current) return;
          playVoice(
            ["/audio/berhitung/hebat.mp3", kataUrl],
            `Hebat! ${word.word}!`
          );
        }, 1000);
        advanceTimer.current = window.setTimeout(nextRound, 4600);
      }
    } else {
      // huruf belum tepat: goyang lembut, tanpa hukuman
      undoSound();
      setShake(tileIdx);
      window.setTimeout(
        () => setShake((s) => (s === tileIdx ? null : s)),
        450
      );
    }
  };

  const toggleMute = () => {
    const next = !muted;
    setMutedUi(next);
    mutedRef.current = next;
    setMuted(next);
    if (next) {
      stopVoice();
    } else {
      clickSound();
    }
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

      <header className="relative flex items-center gap-3 px-4 pt-6 sm:pt-7">
        <ToolButton label="Kembali ke menu" onClick={() => { clickSound(); onExit(); }}>
          <ArrowLeft className="h-6 w-6" />
        </ToolButton>

        <div className="min-w-0 flex-1 text-center">
          <h1 className="truncate text-3xl font-bold tracking-tight sm:text-4xl">
            {[..."Yuk Membaca!"].map((ch, i) =>
              ch === " " ? (
                <span key={i}> </span>
              ) : (
                <span key={i} style={{ color: LETTER_COLORS[i % LETTER_COLORS.length] }}>
                  {ch}
                </span>
              )
            )}
          </h1>
          <p className="mt-1 text-sm font-semibold text-[#9a8757] sm:text-base">
            Susun hurufnya jadi kata, dari kiri ke kanan!
          </p>
        </div>

        <ToolButton label={muted ? "Nyalakan suara" : "Matikan suara"} onClick={toggleMute}>
          {muted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
        </ToolButton>
      </header>

      <main className="relative mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 px-4 pb-10">
        {/* kartu gambar — sentuh untuk mendengar kata */}
        <motion.button
          type="button"
          whileTap={{ scale: 0.94 }}
          onClick={sayWord}
          aria-label={`Dengarkan kata ${word.word}`}
          className="flex flex-col items-center rounded-[2rem] border-4 border-white bg-white px-10 py-4 shadow-[0_8px_0_rgba(180,120,0,0.15)] ring-2 ring-amber-100"
        >
          <span className="text-7xl sm:text-8xl">{word.emoji}</span>
          <span className="mt-1 flex items-center gap-1.5 text-sm font-bold text-[#9a8757]">
            <Volume2 className="h-4 w-4" />
            Dengarkan katanya
          </span>
        </motion.button>

        {/* slot kata (huruf samar sebagai panduan) */}
        <div className="flex flex-wrap justify-center gap-2">
          {letters.map((ch, i) => {
            const filled = i < placed;
            const c = LETTER_COLORS[i % LETTER_COLORS.length];
            return (
              <div
                key={i}
                className="grid h-14 w-12 place-items-center rounded-2xl text-2xl font-extrabold sm:h-16 sm:w-14 sm:text-3xl"
                style={
                  filled
                    ? {
                        backgroundColor: c,
                        color: "#fff",
                        boxShadow: "0 4px 0 rgba(0,0,0,0.12)",
                      }
                    : {
                        border: "3px dashed #e8d9b5",
                        backgroundColor: "rgba(255,255,255,0.55)",
                        color: "#e8d9b5",
                      }
                }
              >
                {ch}
              </div>
            );
          })}
        </div>

        {/* ubin huruf acak */}
        <div className="flex max-w-xl flex-wrap justify-center gap-2.5">
          {tiles.map((ch, i) => {
            const isUsed = usedTiles.includes(i);
            const isShaking = shake === i;
            return (
              <motion.button
                key={`${roundNo}-${i}`}
                type="button"
                initial={{ scale: 0, y: 14 }}
                animate={
                  isShaking
                    ? { x: [0, -8, 8, -5, 5, 0], scale: 1, y: 0 }
                    : { x: 0, scale: isUsed ? 0.85 : 1, y: 0 }
                }
                transition={
                  isShaking ? { duration: 0.4 } : { type: "spring", stiffness: 400, damping: 20, delay: i * 0.05 }
                }
                whileTap={{ scale: 0.88 }}
                onClick={() => tapTile(ch, i)}
                aria-label={`Huruf ${ch}`}
                className={`grid h-14 w-14 touch-manipulation place-items-center rounded-2xl text-2xl font-extrabold shadow-[0_5px_0_rgba(180,120,0,0.15)] ring-2 transition-opacity sm:h-16 sm:w-16 sm:text-3xl ${
                  isUsed
                    ? "pointer-events-none opacity-25 ring-amber-100"
                    : "bg-white ring-amber-100 hover:ring-amber-200"
                }`}
                style={{ color: LETTER_COLORS[i % LETTER_COLORS.length] }}
              >
                {ch}
              </motion.button>
            );
          })}
        </div>
      </main>

      {/* perayaan kata selesai disusun */}
      <AnimatePresence>
        {done && (
          <>
            <Confetti />
            <motion.div
              initial={{ scale: 0.4, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.7, opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 22 }}
              className="fixed inset-x-0 bottom-10 z-[61] mx-auto w-fit rounded-[2rem] border-4 border-amber-200 bg-white px-8 py-6 text-center shadow-2xl"
            >
              <p className="text-2xl font-extrabold text-[#E8590C]">Hebat! 🎉</p>
              <p className="mt-1 flex items-center justify-center gap-1 text-4xl font-extrabold sm:text-5xl">
                {word.word.split("").map((ch, i) => (
                  <span key={i} style={{ color: LETTER_COLORS[i % LETTER_COLORS.length] }}>
                    {ch}
                  </span>
                ))}
              </p>
              <span className="mt-1 inline-block text-5xl">{word.emoji}</span>
              <motion.button
                type="button"
                whileTap={{ scale: 0.92 }}
                onClick={nextRound}
                className="mt-3 rounded-full bg-[#38BDF8] px-6 py-2.5 text-lg font-extrabold text-white shadow-[0_5px_0_rgba(2,132,199,0.9)] active:translate-y-0.5"
              >
                Lagi ➜
              </motion.button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
