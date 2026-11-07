"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, ChevronLeft, ChevronRight, Volume2, VolumeX } from "lucide-react";
import { ToolButton } from "@/components/tool-button";
import { clickSound, popSound, setMuted } from "@/lib/sounds";
import { playVoice, stopVoice } from "@/lib/tts";
import LETTERS from "@/data/letters.json";

/* ---------------------------------- data ---------------------------------- */

const LETTER_COLORS = [
  "#EF4444",
  "#F97316",
  "#EAB308",
  "#22C55E",
  "#0EA5E9",
  "#A855F7",
  "#EC4899",
];

/** A–Z with toddler-friendly Indonesian words (sumber: src/data/letters.json) */

/* ---------------------------------- game ---------------------------------- */

/**
 * Yuk Kenal Huruf! — one big letter card per tap: the letter bounces and is
 * spoken aloud ("A. A untuk Apel."), with arrows and an A–Z strip to jump around.
 */
export function LettersGame({ onExit }: { onExit: () => void }) {
  const [index, setIndex] = useState(0);
  const [muted, setMutedUi] = useState(false);
  const mutedRef = useRef(false);
  const cur = LETTERS[index];
  const color = LETTER_COLORS[index % LETTER_COLORS.length];
  const lowerColor = LETTER_COLORS[(index + 3) % LETTER_COLORS.length];

  const say = useCallback((ch: string) => {
    const c = LETTERS.find((l) => l.ch === ch) ?? LETTERS[0];
    if (mutedRef.current) return;
    // MP3 neural Bahasa Indonesia; jatuh ke Web Speech bila file hilang
    playVoice(
      `/audio/huruf/${encodeURIComponent(c.ch)}.mp3`,
      `${c.ch}. ${c.ch} untuk ${c.word}.`
    );
  }, []);

  // introduce the letter every time the card changes
  useEffect(() => {
    const t = window.setTimeout(() => say(LETTERS[index].ch), 350);
    return () => window.clearTimeout(t);
  }, [index, say]);

  // never leave speech running after leaving the game
  useEffect(() => {
    return () => stopVoice();
  }, []);

  const go = (dir: 1 | -1) => {
    clickSound();
    setIndex((i) => (i + dir + LETTERS.length) % LETTERS.length);
  };

  const jumpTo = (i: number) => {
    if (i === index) {
      say(cur.ch);
      return;
    }
    clickSound();
    setIndex(i);
  };

  const tapCard = () => {
    popSound(1.1);
    say(cur.ch);
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
          <ChevronLeft className="h-6 w-6" />
        </ToolButton>

        <div className="min-w-0 flex-1 text-center">
          <h1 className="truncate text-3xl font-bold tracking-tight sm:text-4xl">
            {[..."Yuk Kenal Huruf!"].map((ch, i) =>
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
            Sentuh hurufnya, dengarkan, lalu ulangi!
          </p>
        </div>

        <ToolButton label={muted ? "Nyalakan suara" : "Matikan suara"} onClick={toggleMute}>
          {muted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
        </ToolButton>
      </header>

      <main className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-6 px-4 pb-10">
        <div className="flex w-full items-center justify-center gap-3 sm:gap-5">
          <motion.button
            type="button"
            whileTap={{ scale: 0.88 }}
            onClick={() => go(-1)}
            aria-label="Huruf sebelumnya"
            className="grid h-14 w-14 shrink-0 touch-manipulation place-items-center rounded-full bg-white text-[#7c6a4a] shadow-[0_6px_0_rgba(180,120,0,0.15)] ring-2 ring-amber-100 sm:h-20 sm:w-20"
          >
            <ChevronLeft className="h-8 w-8 sm:h-11 sm:w-11" />
          </motion.button>

          <AnimatePresence mode="popLayout">
            <motion.button
              key={index}
              type="button"
              initial={{ scale: 0.4, opacity: 0, rotate: -8 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.6, opacity: 0, rotate: 8 }}
              transition={{ type: "spring", stiffness: 380, damping: 24 }}
              whileTap={{ scale: 0.94 }}
              onClick={tapCard}
              aria-label={`Huruf ${cur.ch} untuk ${cur.word}`}
              className="flex w-52 shrink-0 flex-col items-center rounded-[2.5rem] border-4 border-white bg-white px-5 py-6 shadow-[0_10px_0_rgba(180,120,0,0.15)] ring-2 ring-amber-100 sm:w-64 sm:py-8"
            >
              <motion.span
                animate={{ y: [0, -10, 0] }}
                transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
                className="text-[6rem] font-extrabold leading-none sm:text-[7.5rem]"
                style={{ color }}
              >
                {cur.ch}
                <span className="text-[0.6em]" style={{ color: lowerColor }}>
                  {cur.ch.toLowerCase()}
                </span>
              </motion.span>
              <span className="mt-3 text-6xl sm:text-7xl">{cur.emoji}</span>
              <span className="mt-3 text-center text-xl font-extrabold sm:text-2xl">
                {cur.ch} untuk <span style={{ color }}>{cur.word}</span>
              </span>
            </motion.button>
          </AnimatePresence>

          <motion.button
            type="button"
            whileTap={{ scale: 0.88 }}
            onClick={() => go(1)}
            aria-label="Huruf berikutnya"
            className="grid h-14 w-14 shrink-0 touch-manipulation place-items-center rounded-full bg-white text-[#7c6a4a] shadow-[0_6px_0_rgba(180,120,0,0.15)] ring-2 ring-amber-100 sm:h-20 sm:w-20"
          >
            <ChevronRight className="h-8 w-8 sm:h-11 sm:w-11" />
          </motion.button>
        </div>

        {/* A–Z quick jump strip */}
        <div className="w-full max-w-xl">
          <div className="flex flex-wrap justify-center gap-2">
            {LETTERS.map((l, i) => {
              const active = i === index;
              const c = LETTER_COLORS[i % LETTER_COLORS.length];
              return (
                <motion.button
                  key={l.ch}
                  type="button"
                  whileTap={{ scale: 0.85 }}
                  onClick={() => jumpTo(i)}
                  aria-label={`Lompat ke huruf ${l.ch}`}
                  className="grid h-10 w-10 touch-manipulation place-items-center rounded-2xl text-lg font-extrabold shadow-sm transition-colors"
                  style={
                    active
                      ? { backgroundColor: c, color: "#fff" }
                      : { backgroundColor: "rgba(255,255,255,0.9)", color: c }
                  }
                >
                  {l.ch}
                </motion.button>
              );
            })}
          </div>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-sm font-semibold text-[#9a8757]">
            <BookOpen className="h-4 w-4" />
            {index + 1} dari {LETTERS.length} huruf
          </p>
        </div>
      </main>
    </div>
  );
}
