"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";

export type CursorKind = "pencil" | "eraser";

export interface CursorHandle {
  /** Create / move the pencil that follows a finger or the mouse. */
  show: (
    id: number,
    clientX: number,
    clientY: number,
    kind: CursorKind,
    color?: string
  ) => void;
  hide: (id: number) => void;
  hideAll: () => void;
}

/** pixel size of the pencil illustration */
const PENCIL_SIZE = 96;
/** where the pencil tip sits inside the illustration (the anchored point) */
const PENCIL_ANCHOR = {
  x: 0.1 * PENCIL_SIZE,
  y: 0.96 * PENCIL_SIZE,
};

const ERASER_SIZE = 74;
/** where the eraser bottom edge sits inside the illustration */
const ERASER_ANCHOR = {
  x: 0.45 * ERASER_SIZE,
  y: 0.81 * ERASER_SIZE,
};

/**
 * A smiling colored pencil, tip pointing to the anchored bottom-left corner
 * and the body stretching to the upper right — so the colored tip sits
 * exactly under the child's finger while the funny body stays visible.
 * Body + lead use `currentColor`, so recoloring is a single style write.
 */
function pencilMarkup(): string {
  return `
<div class="pencil-wiggle" style="width:${PENCIL_SIZE}px;height:${PENCIL_SIZE}px;transform-origin:${PENCIL_ANCHOR.x}px ${PENCIL_ANCHOR.y}px">
  <svg width="${PENCIL_SIZE}" height="${PENCIL_SIZE}" viewBox="0 0 100 100" aria-hidden="true">
    <g transform="rotate(45 10 96)">
      <!-- colored lead -->
      <polygon points="6,84 14,84 10,96" fill="currentColor" />
      <polygon points="6,84 14,84 10,96" fill="rgba(0,0,0,0.28)" />
      <!-- wooden cone -->
      <polygon points="5.5,85 14.5,85 16.5,69 3.5,69" fill="#F9E0B0" stroke="#DDAE55" stroke-width="1.2" stroke-linejoin="round" />
      <!-- colored body -->
      <rect x="3.5" y="5" width="13" height="64" rx="3" fill="currentColor" />
      <!-- glossy highlight -->
      <rect x="6.1" y="7.5" width="3.4" height="59" rx="1.7" fill="rgba(255,255,255,0.38)" />
      <!-- outline -->
      <rect x="3.5" y="5" width="13" height="64" rx="3" fill="none" stroke="rgba(0,0,0,0.16)" stroke-width="1" />
      <!-- cute face -->
      <circle cx="8" cy="30" r="1.7" fill="#4A3421" />
      <circle cx="12" cy="30" r="1.7" fill="#4A3421" />
      <path d="M7.7 34.4 Q10 36.9 12.3 34.4" stroke="#4A3421" stroke-width="1.2" fill="none" stroke-linecap="round" />
      <circle cx="6.2" cy="33" r="1" fill="rgba(255,255,255,0.55)" />
      <circle cx="13.8" cy="33" r="1" fill="rgba(255,255,255,0.55)" />
    </g>
  </svg>
</div>`;
}

/** A smiling pink eraser for the eraser tool. */
function eraserMarkup(): string {
  return `
<div class="pencil-wiggle" style="width:${ERASER_SIZE}px;height:${ERASER_SIZE}px;transform-origin:${ERASER_ANCHOR.x}px ${ERASER_ANCHOR.y}px">
  <svg width="${ERASER_SIZE}" height="${ERASER_SIZE}" viewBox="0 0 80 80" aria-hidden="true">
    <g transform="rotate(-16 36 64.8)">
      <rect x="16" y="8" width="40" height="57" rx="11" fill="#FDA4AF" stroke="#F43F5E" stroke-width="2.5" />
      <rect x="16" y="8" width="40" height="25" rx="11" fill="#FFF7F8" stroke="#F43F5E" stroke-width="2.5" />
      <rect x="17.2" y="30" width="37.6" height="2.6" fill="#F43F5E" />
      <circle cx="29" cy="46" r="2.7" fill="#9F1239" />
      <circle cx="43" cy="46" r="2.7" fill="#9F1239" />
      <path d="M29 53 Q36 58.5 43 53" stroke="#9F1239" stroke-width="2.4" fill="none" stroke-linecap="round" />
    </g>
  </svg>
</div>`;
}

interface CursorEntry {
  el: HTMLDivElement;
  kind: CursorKind;
}

/**
 * Overlay that turns every finger / mouse pointer into a smiling colored
 * pencil (or eraser) instead of a plain cursor. Managed imperatively so
 * pointer moves never trigger React re-renders — stays smooth on tablets
 * even with several little fingers rubbing at once.
 */
export const PencilLayer = forwardRef<CursorHandle, { className?: string }>(
  function PencilLayer({ className }, ref) {
    const rootRef = useRef<HTMLDivElement>(null);
    const cursors = useRef<Map<number, CursorEntry>>(new Map());

    useImperativeHandle(
      ref,
      () => ({
        show(id, clientX, clientY, kind, color) {
          const root = rootRef.current;
          if (!root) return;
          let entry = cursors.current.get(id);
          if (!entry) {
            if (cursors.current.size >= 5) return; // never spawn a pencil swarm
            const el = document.createElement("div");
            el.className = "pencil-cursor";
            el.innerHTML = kind === "pencil" ? pencilMarkup() : eraserMarkup();
            root.appendChild(el);
            entry = { el, kind };
            cursors.current.set(id, entry);
          }
          if (entry.kind !== kind) {
            entry.kind = kind;
            entry.el.innerHTML = kind === "pencil" ? pencilMarkup() : eraserMarkup();
          }
          if (color) entry.el.style.color = color;
          const rect = root.getBoundingClientRect();
          const anchor = kind === "pencil" ? PENCIL_ANCHOR : ERASER_ANCHOR;
          entry.el.style.transform = `translate3d(${
            clientX - rect.left - anchor.x
          }px, ${clientY - rect.top - anchor.y}px, 0)`;
        },
        hide(id) {
          const entry = cursors.current.get(id);
          if (!entry) return;
          entry.el.remove();
          cursors.current.delete(id);
        },
        hideAll() {
          for (const entry of cursors.current.values()) entry.el.remove();
          cursors.current.clear();
        },
      }),
      []
    );

    return (
      <div
        ref={rootRef}
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 z-40 ${className ?? ""}`}
      />
    );
  }
);
