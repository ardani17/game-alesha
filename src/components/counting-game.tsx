"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Volume2, VolumeX } from "lucide-react";
import { Confetti, SparkleLayer, type SparkleBurst } from "@/components/confetti";
import { ToolButton } from "@/components/tool-button";
import {
  clickSound,
  openSound,
  popSound,
  setMuted,
  tadaSound,
} from "@/lib/sounds";
import { playVoice, stopVoice } from "@/lib/tts";
import COUNT_SETS from "@/data/counting.json";

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

const NUMBER_WORDS = ["satu", "dua", "tiga", "empat", "lima"];

/** friendly things to count (sumber: src/data/counting.json) */

interface CountItem {
  key: string;
  emoji: string;
  seed: number;
  dur: number;
}

interface Round {
  n: number;
  name: string;
  items: CountItem[];
}

/** first rounds gently climb 1→5, afterwards random 2–5 */
function makeRound(roundNo: number): Round {
  const n = roundNo < 5 ? roundNo + 1 : 2 + Math.floor(Math.random() * 4);
  const set = COUNT_SETS[Math.floor(Math.random() * COUNT_SETS.length)];
  const items: CountItem[] = Array.from({ length: n }, (_, i) => ({
    key: `${roundNo}-${i}`,
    emoji: set.emojis[i % set.emojis.length],
    seed: Math.random() * Math.PI * 2,
    dur: 1.6 + Math.random() * 1.2,
  }));
  return { n, name: set.name, items };
}

/** helper impure di scope modul — hanya dipanggil dari event handler */
const sparkleId = () => Date.now() + Math.random();
const pitchJitter = () => Math.random() * 0.05;

/* ---------------------------------- game ---------------------------------- */

/**
 * Yuk Berhitung! — tap each object one by one; every touch pops a rising
 * note and pins its number badge, until the whole group is counted.
 */
export function CountingGame({ onExit }: { onExit: () => void }) {
  const [roundNo, setRoundNo] = useState(0);
  const round = useMemo(() => makeRound(roundNo), [roundNo]);
  /** indices of the items already counted, in tap order */
  const [tapped, setTapped] = useState<number[]>([]);
  const [muted, setMutedUi] = useState(false);
  const mutedRef = useRef(false);
  const [bursts, setBursts] = useState<SparkleBurst[]>([]);
  const [done, setDone] = useState(false);
  const itemsRef = useRef<HTMLDivElement>(null);
  const advanceTimer = useRef<number | null>(null);

  const count = tapped.length;
  const complete = count === round.n;

  // never leave a pending auto-advance behind
  useEffect(
    () => () => {
      if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
      stopVoice();
    },
    []
  );

  // tanyakan "Ada berapa …?" setiap ronde baru dengan suara Indonesia
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (mutedRef.current) return;
      playVoice(
        [
          "/audio/berhitung/ada-berapa.mp3",
          `/audio/berhitung/${encodeURIComponent(round.name)}.mp3`,
        ],
        `Ada berapa ${round.name}?`
      );
    }, 450);
    return () => window.clearTimeout(t);
  }, [round]);

  const addSparkle = (clientX: number, clientY: number, color: string) => {
    const rect = itemsRef.current?.getBoundingClientRect();
    if (!rect) return;
    const id = sparkleId();
    setBursts((b) => [
      ...b.slice(-8),
      { id, x: clientX - rect.left, y: clientY - rect.top, color },
    ]);
    window.setTimeout(() => {
      setBursts((b) => b.filter((s) => s.id !== id));
    }, 620);
  };

  const nextRound = () => {
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    advanceTimer.current = null;
    setDone(false);
    setTapped([]);
    setRoundNo((r) => r + 1);
    openSound();
  };

  const tapItem = (i: number, e: React.PointerEvent<HTMLButtonElement>) => {
    if (tapped.includes(i) || complete) return;
    const nextCount = tapped.length + 1;
    setTapped([...tapped, i]);
    // rising "musical scale" exactly like the coloring pops
    popSound(0.72 + ((nextCount - 1) % 9) * 0.11 + pitchJitter());
    addSparkle(
      e.clientX,
      e.clientY,
      LETTER_COLORS[(nextCount - 1) % LETTER_COLORS.length]
    );
    try {
      navigator.vibrate?.(12);
    } catch {
      /* vibration not supported */
    }
    // lafalkan angka yang baru dihitung ("satu", "dua", …)
    if (!mutedRef.current) {
      playVoice(
        `/audio/angka/${nextCount}.mp3`,
        NUMBER_WORDS[nextCount - 1]
      );
    }
    if (nextCount === round.n) {
      setDone(true);
      tadaSound();
      // setelah fanfare: "Hebat! {n} {nama}" dengan suara Indonesia
      window.setTimeout(() => {
        if (mutedRef.current) return;
        playVoice(
          [
            "/audio/berhitung/hebat.mp3",
            `/audio/angka/${round.n}.mp3`,
            `/audio/berhitung/${encodeURIComponent(round.name)}.mp3`,
          ],
          `Hebat! ${NUMBER_WORDS[round.n - 1]} ${round.name}!`
        );
      }, 1000);
      // beri waktu frasa selesai terdengar sebelum ronde berikutnya
      advanceTimer.current = window.setTimeout(nextRound, 5200);
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
            {[..."Yuk Berhitung!"].map((ch, i) =>
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
            Ada berapa {round.name}? Sentuh satu-satu ya!
          </p>
        </div>

        <ToolButton label={muted ? "Nyalakan suara" : "Matikan suara"} onClick={toggleMute}>
          {muted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
        </ToolButton>
      </header>

      {/* the running count grows with every touch */}
      <div className="relative grid h-24 shrink-0 place-items-center sm:h-28">
        <AnimatePresence mode="popLayout">
          {count > 0 ? (
            <motion.span
              key={count}
              initial={{ scale: 0.3, opacity: 0, rotate: -10 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 1.6, opacity: 0 }}
              transition={{ type: "spring", stiffness: 520, damping: 22 }}
              className="text-7xl font-extrabold drop-shadow-sm sm:text-8xl"
              style={{ color: LETTER_COLORS[(count - 1) % LETTER_COLORS.length] }}
            >
              {count}
            </motion.span>
          ) : (
            <motion.span
              key="ask"
              animate={{ scale: [1, 1.12, 1] }}
              transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
              className="grid h-16 w-16 place-items-center rounded-full bg-white/80 text-4xl font-extrabold text-[#c9b27c] shadow-sm ring-2 ring-amber-100 sm:h-20 sm:w-20"
            >
              ?
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <main
        ref={itemsRef}
        className="relative mx-auto flex w-full max-w-3xl flex-1 flex-wrap content-center items-center justify-center gap-4 px-4 pb-8 sm:gap-6"
      >
        <SparkleLayer bursts={bursts} />

        {round.items.map((item, i) => {
          const order = tapped.indexOf(i);
          const isTapped = order !== -1;
          return (
            <motion.button
              key={item.key}
              type="button"
              initial={{ scale: 0, rotate: -14 }}
              animate={
                isTapped
                  ? { scale: 0.92, rotate: 0 }
                  : { scale: 1, rotate: [-3, 3, -3] }
              }
              transition={
                isTapped
                  ? { type: "spring", stiffness: 500, damping: 26 }
                  : {
                      scale: { type: "spring", stiffness: 380, damping: 18, delay: i * 0.07 },
                      rotate: { repeat: Infinity, duration: item.dur, delay: item.seed },
                    }
              }
              onPointerDown={(e) => tapItem(i, e)}
              aria-label={`Hitung ${round.name} nomor ${tapped.length + (isTapped ? 0 : 1)}`}
              className="relative grid h-24 w-24 touch-manipulation place-items-center rounded-3xl bg-white text-6xl shadow-[0_6px_0_rgba(180,120,0,0.15)] ring-2 ring-amber-100 transition-shadow hover:ring-amber-200 sm:h-28 sm:w-28 sm:text-7xl"
            >
              <span className={isTapped ? "opacity-95" : undefined}>{item.emoji}</span>

              {/* the pinned count badge appears in tap order */}
              {isTapped && (
                <motion.span
                  initial={{ scale: 0, y: 6 }}
                  animate={{ scale: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 600, damping: 20 }}
                  className="absolute -right-2 -top-2 grid h-9 w-9 place-items-center rounded-full text-lg font-extrabold text-white shadow-md ring-2 ring-white sm:h-10 sm:w-10 sm:text-xl"
                  style={{
                    backgroundColor: LETTER_COLORS[order % LETTER_COLORS.length],
                  }}
                >
                  {order + 1}
                </motion.span>
              )}
            </motion.button>
          );
        })}
      </main>

      {/* celebration + the finished number, then the next group rolls in */}
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
              <p className="mt-1 text-6xl font-extrabold sm:text-7xl" style={{ color: LETTER_COLORS[(round.n - 1) % LETTER_COLORS.length] }}>
                {round.n}
              </p>
              <p className="text-lg font-bold text-[#9a8757]">
                {NUMBER_WORDS[round.n - 1]} {round.name}!
              </p>
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
