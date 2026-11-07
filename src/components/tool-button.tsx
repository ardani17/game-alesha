"use client";

import { motion } from "framer-motion";

/** Round icon button shared across games (back / mute / menu…). */
export function ToolButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.88 }}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="grid h-12 w-12 shrink-0 touch-manipulation place-items-center rounded-full bg-white text-[#7c6a4a] shadow-md ring-1 ring-amber-100 transition-colors hover:bg-amber-50 active:bg-amber-100 disabled:opacity-40 sm:h-14 sm:w-14"
    >
      {children}
    </motion.button>
  );
}
