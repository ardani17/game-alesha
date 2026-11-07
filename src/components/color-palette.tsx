"use client";

import { motion } from "framer-motion";
import { Check, Rainbow } from "lucide-react";

/** Indonesian color names for the accessibility labels */
const COLOR_NAMES: Record<string, string> = {
  "#EF4444": "Merah",
  "#F97316": "Oranye",
  "#FACC15": "Kuning",
  "#22C55E": "Hijau",
  "#A3E635": "Hijau Muda",
  "#14B8A6": "Toska",
  "#3B82F6": "Biru",
  "#A855F7": "Ungu",
  "#EC4899": "Pink",
  "#F472B6": "Pink Muda",
  "#B45309": "Cokelat",
};

interface ColorPaletteProps {
  colors: string[];
  /** the picked color, or null for the magic rainbow mode */
  value: string | null;
  onChange: (color: string | null) => void;
}

/**
 * Big, toddler-friendly color swatches. The rainbow swatch is the "magic"
 * mode (every rubbed area pops a random cheerful color); tapping one of the
 * colors makes the pencil — and everything it paints — that exact color.
 */
export function ColorPalette({ colors, value, onChange }: ColorPaletteProps) {
  return (
    <div
      role="group"
      aria-label="Pilih warna pensil"
      className="mx-auto flex w-full max-w-[720px] shrink-0 flex-wrap items-center justify-center gap-1.5 rounded-3xl bg-white/85 px-3 py-2 shadow-md ring-1 ring-amber-100 sm:gap-2"
    >
      {/* magic rainbow swatch */}
      <motion.button
        type="button"
        whileTap={{ scale: 0.85 }}
        onClick={() => onChange(null)}
        aria-pressed={value === null}
        aria-label="Warna ajaib"
        title="Warna ajaib"
        className={`relative grid h-11 w-11 shrink-0 place-items-center rounded-full shadow transition-transform sm:h-12 sm:w-12 ${
          value === null
            ? "z-10 scale-110 ring-4 ring-amber-400"
            : "ring-2 ring-white"
        }`}
        style={{
          background:
            "conic-gradient(from 220deg, #EF4444, #F97316, #FACC15, #22C55E, #3B82F6, #A855F7, #EC4899, #EF4444)",
        }}
      >
        <Rainbow className="h-6 w-6 text-white drop-shadow-md" />
        {value === null && (
          <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-amber-400 shadow ring-2 ring-white">
            <Check className="h-3.5 w-3.5 text-white" strokeWidth={3.5} />
          </span>
        )}
      </motion.button>

      {colors.map((c) => {
        const active = value === c;
        return (
          <motion.button
            key={c}
            type="button"
            whileTap={{ scale: 0.85 }}
            onClick={() => onChange(c)}
            aria-pressed={active}
            aria-label={`Warna ${COLOR_NAMES[c] ?? c}`}
            title={`Warna ${COLOR_NAMES[c] ?? c}`}
            className={`relative h-11 w-11 shrink-0 rounded-full shadow transition-transform sm:h-12 sm:w-12 ${
              active
                ? "z-10 scale-110 ring-4 ring-amber-400"
                : "ring-2 ring-white"
            }`}
            style={{ backgroundColor: c }}
          >
            {active && (
              <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-amber-400 shadow ring-2 ring-white">
                <Check className="h-3.5 w-3.5 text-white" strokeWidth={3.5} />
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
