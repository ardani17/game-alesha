"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { ArrowLeft, MoveRight, Volume2, VolumeX } from "lucide-react";
import { Confetti, SparkleLayer, type SparkleBurst } from "@/components/confetti";
import { ToolButton } from "@/components/tool-button";
import {
  clickSound,
  openSound,
  popSound,
  setMuted,
  tadaSound,
  undoSound,
} from "@/lib/sounds";
import { playVoice, speakFallback, stopVoice } from "@/lib/tts";
import MATCH_ITEMS from "@/data/matching.json";

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

interface MatchItem {
  name: string;
  emoji: string;
  audio?: string;
}

/** PRNG deterministik (mulberry32) — urutan acak stabil, aman untuk hidrasi SSR */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** acak deterministik: seed sama → urutan sama */
function seededShuffle<T>(items: T[], seed: number): T[] {
  const rnd = mulberry32(seed);
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

interface Round {
  cards: MatchItem[];
  targets: MatchItem[];
}

/** ronde 1–2 mulai dari 4 pasangan, setelah itu 5 pasangan */
function makeRound(roundNo: number): Round {
  const count = roundNo < 2 ? 4 : 5;
  const cards = seededShuffle(MATCH_ITEMS, roundNo * 31 + 7).slice(0, count);
  let targets = seededShuffle(cards, roundNo * 31 + 83);
  // jangan biarkan urutan target persis sama dengan kartu
  if (targets.every((t, i) => t.name === cards[i].name)) {
    targets = [...targets.slice(1), targets[0]];
  }
  return { cards, targets };
}

/** toleransi jatuh di sekitar slot target (px) — ramah jari balita */
const DROP_PAD = 24;

/** helper impure di scope modul — hanya dipanggil dari event handler */
const sparkleId = () => Date.now() + Math.random();
const pitchJitter = () => Math.random() * 0.1;

/* ---------------------------------- game ---------------------------------- */

/**
 * Yuk Menyamakan! — tarik kartu gambar di kiri ke pasangannya yang sama di
 * kanan. Pasangan tepat terkunci dengan warna, salah hanya goyang lembut.
 */
export function MatchingGame({ onExit }: { onExit: () => void }) {
  const [roundNo, setRoundNo] = useState(0);
  const round = useMemo(() => makeRound(roundNo), [roundNo]);
  /** nama item yang sudah jodoh */
  const [matched, setMatched] = useState<string[]>([]);
  const [muted, setMutedUi] = useState(false);
  const mutedRef = useRef(false);
  const [bursts, setBursts] = useState<SparkleBurst[]>([]);
  const [done, setDone] = useState(false);
  const [shake, setShake] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const targetRefs = useRef(new Map<string, HTMLDivElement>());
  const advanceTimer = useRef<number | null>(null);
  const shakeTimer = useRef<number | null>(null);

  const total = round.cards.length;

  // never leave pending timers/voice behind
  useEffect(
    () => () => {
      if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
      if (shakeTimer.current) window.clearTimeout(shakeTimer.current);
      stopVoice();
    },
    []
  );

  // instruksi singkat setiap ronde baru (fallback Web Speech, tanpa file MP3)
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (mutedRef.current) return;
      speakFallback("Samakan gambar yang sama!");
    }, 450);
    return () => window.clearTimeout(t);
  }, [roundNo]);

  const pairColor = (item: MatchItem) =>
    LETTER_COLORS[
      (round.cards.findIndex((c) => c.name === item.name) + 1) %
        LETTER_COLORS.length
    ];

  const addSparkle = (clientX: number, clientY: number, color: string) => {
    const rect = boardRef.current?.getBoundingClientRect();
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
    setMatched([]);
    targetRefs.current.clear();
    setRoundNo((r) => r + 1);
    openSound();
  };

  const handleDragEnd = (item: MatchItem, info: PanInfo) => {
    if (done || matched.includes(item.name)) return;
    // posisi pointer dalam koordinat viewport (info.point = koordinat halaman)
    const px = info.point.x - window.scrollX;
    const py = info.point.y - window.scrollY;

    let hit: string | null = null;
    targetRefs.current.forEach((el, name) => {
      if (hit || matched.includes(name)) return;
      const r = el.getBoundingClientRect();
      if (
        px >= r.left - DROP_PAD &&
        px <= r.right + DROP_PAD &&
        py >= r.top - DROP_PAD &&
        py <= r.bottom + DROP_PAD
      ) {
        hit = name;
      }
    });

    if (hit === null) {
      // dilepas di tempat kosong — kartu kembali pelan ke tempatnya
      clickSound();
      return;
    }
    if (hit !== item.name) {
      // salah pasangan: goyang lembut, tanpa hukuman
      undoSound();
      setShake(hit);
      if (shakeTimer.current) window.clearTimeout(shakeTimer.current);
      shakeTimer.current = window.setTimeout(() => setShake(null), 480);
      return;
    }

    // pasangan tepat!
    const next = [...matched, item.name];
    setMatched(next);
    popSound(1.15 + pitchJitter() * 0.1);
    addSparkle(px, py, pairColor(item));
    try {
      navigator.vibrate?.(12);
    } catch {
      /* vibration not supported */
    }
    // lafalkan nama benda yang berhasil dijodohkan
    if (!mutedRef.current) {
      if (item.audio) playVoice(item.audio, item.name);
      else speakFallback(item.name);
    }
    if (next.length === total) {
      setDone(true);
      tadaSound();
      window.setTimeout(() => {
        if (mutedRef.current) return;
        playVoice(
          "/audio/berhitung/hebat.mp3",
          "Hebat! Semua pasangan ketemu!"
        );
      }, 1000);
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
            {[..."Yuk Menyamakan!"].map((ch, i) =>
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
            Tarik gambar ke pasangannya yang sama!
          </p>
        </div>

        <ToolButton label={muted ? "Nyalakan suara" : "Matikan suara"} onClick={toggleMute}>
          {muted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
        </ToolButton>
      </header>

      {/* progres ronde: titik yang tumbuh & berwarna saat pasangan ketemu */}
      <div className="relative flex h-8 shrink-0 items-center justify-center gap-2">
        {round.cards.map((c) => {
          const ok = matched.includes(c.name);
          return (
            <span
              key={c.name}
              className={`h-3 rounded-full transition-all duration-300 ${
                ok ? "w-6" : "w-3 bg-amber-200"
              }`}
              style={ok ? { backgroundColor: pairColor(c) } : undefined}
            />
          );
        })}
      </div>

      <main
        ref={boardRef}
        className="relative mx-auto flex w-full max-w-3xl flex-1 items-center justify-center gap-2 px-3 pb-6 sm:gap-5"
      >
        <SparkleLayer bursts={bursts} />

        {/* kolom kiri: kartu yang ditarik */}
        <section
          aria-label="Kartu gambar untuk ditarik"
          className="flex flex-1 flex-col items-center gap-2 sm:gap-3"
        >
          <p className="text-xs font-bold text-[#9a8757]">Tarik gambar</p>
          {round.cards.map((card, i) => {
            const isMatched = matched.includes(card.name);
            return (
              <motion.div
                key={`card-${roundNo}-${card.name}`}
                drag={!isMatched && !done}
                dragSnapToOrigin
                dragMomentum={false}
                onDragEnd={(_, info) => handleDragEnd(card, info)}
                whileDrag={{ scale: 1.18, zIndex: 40 }}
                initial={{ scale: 0, rotate: -14 }}
                animate={
                  isMatched
                    ? { scale: 0.94, rotate: 0 }
                    : { scale: 1, rotate: [-3, 3, -3] }
                }
                transition={
                  isMatched
                    ? { type: "spring", stiffness: 500, damping: 24 }
                    : {
                        scale: { type: "spring", stiffness: 380, damping: 18, delay: i * 0.06 },
                        rotate: { repeat: Infinity, duration: 2.2 + i * 0.25 },
                      }
                }
                aria-label={`Kartu ${card.name}`}
                className="relative grid h-[62px] w-[62px] touch-none cursor-grab place-items-center rounded-2xl bg-white text-4xl shadow-[0_5px_0_rgba(180,120,0,0.15)] ring-2 ring-amber-100 active:cursor-grabbing sm:h-[76px] sm:w-[76px] sm:text-5xl"
                style={
                  isMatched
                    ? {
                        backgroundColor: `${pairColor(card)}24`,
                        // ring + bayangan bawah memakai warna pasangan
                        boxShadow: `0 0 0 2px ${pairColor(card)}, 0 5px 0 ${pairColor(card)}66`,
                      }
                    : undefined
                }
              >
                <span className={isMatched ? "opacity-95" : undefined}>
                  {card.emoji}
                </span>
                {isMatched && (
                  <motion.span
                    initial={{ scale: 0, y: 6 }}
                    animate={{ scale: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 600, damping: 20 }}
                    className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full text-xs font-extrabold text-white shadow-md ring-2 ring-white sm:h-7 sm:w-7 sm:text-sm"
                    style={{ backgroundColor: pairColor(card) }}
                  >
                    ✓
                  </motion.span>
                )}
              </motion.div>
            );
          })}
        </section>

        {/* petunjuk arah di tengah */}
        <motion.div
          aria-hidden
          animate={{ x: [0, 6, 0] }}
          transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/80 shadow-sm ring-1 ring-amber-100"
        >
          <MoveRight className="h-5 w-5 text-[#c9b27c]" />
        </motion.div>

        {/* kolom kanan: slot pasangan (urutan diacak) */}
        <section
          aria-label="Pasangan gambar"
          className="flex flex-1 flex-col items-center gap-2 sm:gap-3"
        >
          <p className="text-xs font-bold text-[#9a8757]">Ke pasangannya</p>
          {round.targets.map((t, i) => {
            const isMatched = matched.includes(t.name);
            const isShaking = shake === t.name;
            return (
              <motion.div
                key={`target-${roundNo}-${t.name}`}
                ref={(el) => {
                  if (el) targetRefs.current.set(t.name, el);
                  else targetRefs.current.delete(t.name);
                }}
                initial={{ scale: 0, rotate: 14 }}
                animate={
                  isShaking
                    ? { x: [0, -9, 9, -6, 6, 0], scale: 1, rotate: 0 }
                    : isMatched
                      ? { x: 0, scale: [1, 1.18, 1], rotate: 0 }
                      : { x: 0, scale: 1, rotate: 0 }
                }
                transition={
                  isShaking
                    ? { x: { duration: 0.45 } }
                    : {
                        scale: { type: "spring", stiffness: 380, damping: 18, delay: i * 0.06 },
                        rotate: { type: "spring", stiffness: 380, damping: 18, delay: i * 0.06 },
                      }
                }
                aria-label={`Pasangan ${t.name}`}
                className={`relative grid h-[62px] w-[62px] place-items-center rounded-2xl border-2 text-4xl sm:h-[76px] sm:w-[76px] sm:text-5xl ${
                  isMatched
                    ? "border-solid"
                    : "border-dashed border-amber-200 bg-white/70"
                }`}
                style={
                  isMatched
                    ? {
                        backgroundColor: `${pairColor(t)}24`,
                        borderColor: pairColor(t),
                        boxShadow: `0 0 0 2px ${pairColor(t)}, 0 5px 0 ${pairColor(t)}66`,
                      }
                    : undefined
                }
              >
                <span className={isMatched ? "opacity-95" : "opacity-80"}>
                  {t.emoji}
                </span>
                {isMatched && (
                  <motion.span
                    initial={{ scale: 0, y: 6 }}
                    animate={{ scale: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 600, damping: 20 }}
                    className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full text-xs font-extrabold text-white shadow-md ring-2 ring-white sm:h-7 sm:w-7 sm:text-sm"
                    style={{ backgroundColor: pairColor(t) }}
                  >
                    ✓
                  </motion.span>
                )}
              </motion.div>
            );
          })}
        </section>
      </main>

      {/* perayaan + tombol ronde berikutnya */}
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
              <p className="mt-1 text-lg font-bold text-[#9a8757]">
                Semua pasangan ketemu!
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
