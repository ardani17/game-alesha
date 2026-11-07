"use client";

import { useState } from "react";
import { Star } from "lucide-react";

const CONFETTI_COLORS = [
  "#EF4444",
  "#F97316",
  "#FACC15",
  "#4ADE80",
  "#38BDF8",
  "#A855F7",
  "#EC4899",
];

interface Piece {
  left: number;
  delay: number;
  dur: number;
  color: string;
  size: number;
  round: boolean;
}

/** Fullscreen confetti rain (used when saving a masterpiece). */
export function Confetti({ pieces = 90 }: { pieces?: number }) {
  // acak sekali per kemunculan lewat initializer state (bukan saat render)
  const [list] = useState<Piece[]>(() =>
    Array.from({ length: pieces }, () => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.6,
      dur: 1.9 + Math.random() * 1.3,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      size: 9 + Math.random() * 8,
      round: Math.random() > 0.6,
    }))
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden="true">
      {list.map((p, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            left: `${p.left}%`,
            top: "-6%",
            width: p.size,
            height: p.round ? p.size : p.size * 1.5,
            backgroundColor: p.color,
            borderRadius: p.round ? "50%" : 3,
            animation: `confetti-fall ${p.dur}s linear ${p.delay}s forwards`,
          }}
        />
      ))}
      {[15, 45, 75].map((x, i) => (
        <Star
          key={i}
          className="absolute text-yellow-400"
          style={{
            left: `${x}%`,
            top: "18%",
            width: 44 + i * 10,
            height: 44 + i * 10,
            fill: "#FDE047",
            animation: `pop-in 0.45s ease-out ${0.1 + i * 0.12}s both, float-slow 2s ease-in-out ${0.5 + i * 0.2}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

export interface SparkleBurst {
  id: number;
  x: number;
  y: number;
  color: string;
}

/** Tiny star burst where the child just tapped. */
export function SparkleLayer({ bursts }: { bursts: SparkleBurst[] }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden" aria-hidden="true">
      {bursts.map((b) =>
        Array.from({ length: 6 }).map((_, i) => {
          const angle = (i / 6) * Math.PI * 2 + b.id;
          const tx = Math.cos(angle) * 34;
          const ty = Math.sin(angle) * 34;
          const size = 10 + ((b.id + i) % 3) * 5;
          return (
            <Star
              key={`${b.id}-${i}`}
              style={{
                position: "absolute",
                left: b.x - size / 2,
                top: b.y - size / 2,
                width: size,
                height: size,
                fill: b.color,
                color: b.color,
                ["--tx" as string]: `${tx}px`,
                ["--ty" as string]: `${ty}px`,
                animation: `sparkle-out 0.55s ease-out forwards`,
              }}
            />
          );
        })
      )}
    </div>
  );
}
