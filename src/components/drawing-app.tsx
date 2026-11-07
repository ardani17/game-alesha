"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Brush,
  Camera,
  Download,
  Eraser,
  Hand,
  House,
  Pencil,
  Trash2,
  Undo2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { ColorPalette } from "@/components/color-palette";
import { ColoringSvg } from "@/components/coloring-svg";
import { Confetti, SparkleLayer, type SparkleBurst } from "@/components/confetti";
import { PencilLayer, type CursorHandle, type CursorKind } from "@/components/pencil-cursor";
import { ToolButton } from "@/components/tool-button";
import { COLORING_PAGES, suggestedFills } from "@/lib/coloring-pages";
import type { ShapeDef } from "@/lib/coloring-pages";
import {
  clickSound,
  openSound,
  popSound,
  setMuted,
  tadaSound,
  undoSound,
} from "@/lib/sounds";

/* ---------------------------------- data ---------------------------------- */

/**
 * Coloring works like a REAL crayon: the picture outlines are a hollow SVG on
 * top and the color lives on a paint canvas underneath. Every finger sweep
 * lays down a soft semi-transparent stroke clipped inside the region under
 * it, so color appears exactly where the child rubs and deepens pass after
 * pass — never as an instant fill. Regions are detected geometrically
 * (Path2D hit-testing in reverse paint order), so strokes always stay inside
 * the lines, and background areas that sit under other shapes paint through
 * a precomputed mask so they never bleed into the shapes above them.
 */

/** vivid colors for the main shapes */
const KID_COLORS = [
  "#EF4444", // merah
  "#F97316", // oranye
  "#FACC15", // kuning
  "#22C55E", // hijau
  "#A3E635", // hijau muda
  "#14B8A6", // toska
  "#3B82F6", // biru
  "#A855F7", // ungu
  "#EC4899", // pink
  "#F472B6", // pink muda
  "#B45309", // cokelat
];

/** soft pastels for big background areas (sky, grass, sand…) */
const BG_COLORS = [
  "#CDEBFF", "#E0F2FE", "#E8F8D8", "#D9F7F0",
  "#FFF3BF", "#FEF9C3", "#FFE8CC", "#FFE3EC",
  "#F3E8FF", "#FFE4E6", "#FFF6D6", "#EDE9FE",
];

const CARD_COLORS = [
  "#FF8FAB",
  "#7DD3FC",
  "#C77DFF",
  "#FF9F2E",
  "#FF6B6B",
  "#8CD867",
  "#4ADE80",
  "#F9A8D4",
];

const LETTER_COLORS = [
  "#EF4444",
  "#F97316",
  "#EAB308",
  "#22C55E",
  "#0EA5E9",
  "#A855F7",
  "#EC4899",
];

const TITLE = "Yuk Mewarnai!";

type View = "gallery" | "color" | "draw";
type DrawTool = "brush" | "eraser";

/** hit-test sampling distance (px) while the finger sweeps */
const RUB_STEP = 14;

/* --------------------------- crayon paint engine --------------------------- */

/** paint canvas resolution — the viewBox is 400, 2× keeps crayon strokes crisp */
const PAINT_SIZE = 800;
/** crayon tip width (paint px): overlapping sweeps build up color slowly */
const BRUSH_W = 34;
/** each pass lays down a translucent coat, like the pressure of a real pencil */
const BRUSH_ALPHA = 0.5;
/** grid used to measure how much of every region is actually painted */
const CELL_GRID = 50;
/** a region counts as "colored" once this fraction of its cells hold paint */
const DONE_RATIO = 0.4;
/** resolution of the PNG snapshots kept for undo + localStorage */
const STORE_SIZE = 400;
/** how many undo snapshots to keep (each holds a small PNG data URL) */
const UNDO_LIMIT = 10;

function pickRandom(pool: string[], avoid?: string) {
  const options = avoid ? pool.filter((c) => c !== avoid) : pool;
  return options[Math.floor(Math.random() * options.length)];
}

/** one crayon segment (or dot when from === to) drawn with a soft coat */
function strokeSeg(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  color: string
) {
  ctx.save();
  ctx.globalAlpha = BRUSH_ALPHA;
  ctx.strokeStyle = color;
  ctx.lineWidth = BRUSH_W;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  // nudge zero-length segments so the round cap still renders a dot
  ctx.lineTo(to.x === from.x && to.y === from.y ? to.x + 0.01 : to.x, to.y);
  ctx.stroke();
  ctx.restore();
}

type RoundRectPath = Path2D & {
  roundRect?: (x: number, y: number, w: number, h: number, r: number) => void;
};

/** parse an SVG `transform` list; every bundled page only uses rotate(a x y) */
function transformMatrix(t: string): DOMMatrix {
  try {
    return new DOMMatrix(t);
  } catch {
    // very old WebView without the string constructor: hand-roll rotate()
    const m = t.match(/rotate\(\s*(-?[\d.]+)(?:\s+(-?[\d.]+)\s+(-?[\d.]+))?\s*\)/);
    if (!m) return new DOMMatrix();
    const deg = Number(m[1]);
    const cx = Number(m[2] ?? 0);
    const cy = Number(m[3] ?? 0);
    return new DOMMatrix()
      .translate(cx, cy)
      .rotate(deg)
      .translate(-cx, -cy);
  }
}

/** Path2D of one shape in viewBox units (0..400), its SVG transform applied */
function shapePath(s: ShapeDef): Path2D | null {
  const a = s.attrs;
  let p: Path2D;
  switch (s.el) {
    case "path":
      p = new Path2D(String(a.d));
      break;
    case "circle":
      p = new Path2D();
      p.arc(Number(a.cx), Number(a.cy), Number(a.r), 0, Math.PI * 2);
      break;
    case "ellipse":
      p = new Path2D();
      p.ellipse(
        Number(a.cx), Number(a.cy),
        Number(a.rx), Number(a.ry),
        0, 0, Math.PI * 2
      );
      break;
    case "rect": {
      p = new Path2D();
      const x = Number(a.x), y = Number(a.y);
      const w = Number(a.width), h = Number(a.height);
      const r = Number(a.rx) || 0;
      const rp = p as RoundRectPath;
      if (r > 0 && typeof rp.roundRect === "function") rp.roundRect(x, y, w, h, r);
      else p.rect(x, y, w, h);
      break;
    }
    case "polygon": {
      p = new Path2D();
      const pts = String(a.points)
        .split(/[\s,]+/)
        .filter(Boolean)
        .map(Number);
      for (let i = 0; i + 1 < pts.length; i += 2) {
        if (i === 0) p.moveTo(pts[0], pts[1]);
        else p.lineTo(pts[i], pts[i + 1]);
      }
      p.closePath();
      break;
    }
    default:
      return null; // "line" decorations are never colorable
  }
  const t = typeof a.transform === "string" ? a.transform : undefined;
  if (!t) return p;
  const q = new Path2D();
  q.addPath(p, transformMatrix(t));
  return q;
}

interface RegionKit {
  ids: string[];
  shapeById: Record<string, ShapeDef>;
  /** region outline in paint-canvas coords (PAINT_SIZE) */
  paths: Record<string, Path2D>;
  /** regions partly UNDER other shapes paint through these alpha masks */
  masks: Record<string, HTMLCanvasElement>;
  /** CELL_GRID² grid: index into ids of the topmost region covering each cell (-1 = none) */
  cellOwner: Int16Array;
  /** cells owned by each region (parallel to ids) */
  cellTotals: number[];
  hit: (x: number, y: number) => string | null;
}

/**
 * Precomputes everything the crayon engine needs for one page: scaled region
 * paths, occlusion masks for underlapping regions (e.g. the sky behind the
 * bird) and the ownership grid used to measure painting progress.
 */
function buildRegionKit(page: { shapes: ShapeDef[] }): RegionKit {
  const colorables = page.shapes.filter((s) => s.colorable && s.id);
  const ids: string[] = [];
  const shapeById: Record<string, ShapeDef> = {};
  const paths: Record<string, Path2D> = {};
  const basePaths: Path2D[] = [];
  for (const s of colorables) {
    const base = shapePath(s);
    if (!base) continue;
    const big = new Path2D();
    big.addPath(base, new DOMMatrix([2, 0, 0, 2, 0, 0])); // viewBox 400 -> PAINT_SIZE
    ids.push(s.id as string);
    shapeById[s.id as string] = s;
    paths[s.id as string] = big;
    basePaths.push(big);
  }

  // rasterize each region on the small grid (document order, so later shapes
  // overwrite earlier cells = topmost region owns the cell, like SVG painting)
  const cells = document.createElement("canvas");
  cells.width = CELL_GRID;
  cells.height = CELL_GRID;
  const cctx = cells.getContext("2d", { willReadFrequently: true })!;
  const presence: Uint8Array[] = [];
  const k = CELL_GRID / PAINT_SIZE;
  for (const p of basePaths) {
    cctx.save();
    // clear in identity space first — clearRect follows the transform too
    cctx.setTransform(1, 0, 0, 1, 0, 0);
    cctx.clearRect(0, 0, CELL_GRID, CELL_GRID);
    cctx.setTransform(k, 0, 0, k, 0, 0);
    cctx.fillStyle = "#fff";
    cctx.fill(p);
    cctx.restore();
    const data = cctx.getImageData(0, 0, CELL_GRID, CELL_GRID).data;
    const pres = new Uint8Array(CELL_GRID * CELL_GRID);
    for (let i = 0; i < pres.length; i++) pres[i] = data[i * 4 + 3] > 32 ? 1 : 0;
    presence.push(pres);
  }
  const cellOwner = new Int16Array(CELL_GRID * CELL_GRID).fill(-1);
  for (let i = 0; i < ids.length; i++) {
    const pres = presence[i];
    for (let c = 0; c < cellOwner.length; c++) if (pres[c]) cellOwner[c] = i;
  }
  const cellTotals = new Array<number>(ids.length).fill(0);
  for (let c = 0; c < cellOwner.length; c++) {
    const o = cellOwner[c];
    if (o >= 0) cellTotals[o]++;
  }

  // occlusion masks: any region with cells stolen by a shape above it paints
  // through a mask with those shapes erased, so its color never shows through
  const masks: Record<string, HTMLCanvasElement> = {};
  for (let i = 0; i < ids.length; i++) {
    const underlaps = presence[i].some((v, c) => v && cellOwner[c] !== i);
    if (!underlaps) continue;
    const mask = document.createElement("canvas");
    mask.width = STORE_SIZE;
    mask.height = STORE_SIZE;
    const mctx = mask.getContext("2d")!;
    const mk = STORE_SIZE / PAINT_SIZE;
    mctx.setTransform(mk, 0, 0, mk, 0, 0);
    mctx.fillStyle = "#fff";
    mctx.fill(basePaths[i]);
    mctx.globalCompositeOperation = "destination-out";
    for (let j = i + 1; j < basePaths.length; j++) mctx.fill(basePaths[j]);
    masks[ids[i]] = mask;
  }

  // dedicated 1×1 context purely for geometric hit-testing (identity transform)
  const hitCtx = document.createElement("canvas").getContext("2d")!;
  const hit = (x: number, y: number) => {
    for (let i = ids.length - 1; i >= 0; i--) {
      if (hitCtx.isPointInPath(paths[ids[i]], x, y)) return ids[i];
    }
    return null;
  };

  return { ids, shapeById, paths, masks, cellOwner, cellTotals, hit };
}

/** one finger's crayon stroke */
interface StrokeState {
  /** last sampled client position */
  x: number;
  y: number;
  /** last painted canvas point, for continuous segments */
  lastPt: { x: number; y: number } | null;
  /** regionId -> crayon color chosen for this stroke (magic rainbow mode) */
  colors: Map<string, string>;
  /** color of the pencil cursor */
  color: string;
}

/* ---------------------------------- hint ----------------------------------- */

/** Wiggling-hand hint shown until the child rubs for the very first time. */
function HintPill({ text }: { text: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.25 } }}
      className="pointer-events-none absolute left-1/2 top-3 z-30 -translate-x-1/2"
    >
      <div className="flex items-center gap-2 whitespace-nowrap rounded-full bg-white/95 px-4 py-2 text-sm font-bold text-[#9a8757] shadow-lg ring-2 ring-amber-200 sm:text-base">
        <motion.span
          animate={{ x: [-5, 5, -5], rotate: [-8, 8, -8] }}
          transition={{ repeat: Infinity, duration: 1.1, ease: "easeInOut" }}
          className="inline-flex"
        >
          <Hand className="h-5 w-5 text-amber-500" fill="#FDE68A" />
        </motion.span>
        {text}
      </div>
    </motion.div>
  );
}

/* ---------------------------------- app ------------------------------------ */

/** saved crayon work per page: a downscaled PNG snapshot + completed regions */
interface PaintSave {
  img: string | null;
  done: string[];
}
type PaintStore = Record<string, PaintSave>;

const STORE_KEY = "yuk-mewarnai-v2";
const LEGACY_STORE_KEY = "yuk-mewarnai-v1";

function loadStore(): { paints?: PaintStore; draw?: string | null } {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
    // migrate from the v1 instant-fill store: keep the free-draw picture,
    // the old solid region fills are obsolete under the crayon engine
    const legacy = window.localStorage.getItem(LEGACY_STORE_KEY);
    if (legacy) return { draw: (JSON.parse(legacy)?.draw as string | null) ?? null };
    return {};
  } catch {
    return {};
  }
}

export function DrawingApp({ onExit }: { onExit?: () => void }) {
  const [view, setView] = useState<View>("gallery");
  const [pageIndex, setPageIndex] = useState(0);
  const [paints, setPaints] = useState<PaintStore>(() => loadStore().paints ?? {});
  const paintsRef = useRef(paints);
  const [undoStack, setUndoStack] = useState<PaintSave[]>([]);
  const [muted, setMutedUi] = useState(false);
  /** pencil color picked from the palette box; null = magic rainbow mode */
  const [pickedColor, setPickedColor] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState<{ on: boolean; msg: string }>({
    on: false,
    msg: "",
  });
  const [bursts, setBursts] = useState<SparkleBurst[]>([]);
  const [hintRubDone, setHintRubDone] = useState(false);
  const [hintDrawDone, setHintDrawDone] = useState(false);
  const celebratedRef = useRef<string | null>(null);
  const celebrateTimer = useRef<number | null>(null);

  // crayon painting state (multi-touch: one stroke per finger)
  const svgWrapRef = useRef<HTMLDivElement>(null);
  const paintRef = useRef<HTMLCanvasElement>(null);
  const scratchRef = useRef<HTMLCanvasElement | null>(null);
  const kitRef = useRef<RegionKit | null>(null);
  const doneRef = useRef<Set<string>>(new Set());
  const strokePointers = useRef<Map<number, StrokeState>>(new Map());
  const gestureSnapped = useRef(false);
  const lastBuzz = useRef(0);

  // colored-pencil cursors that follow each finger / the mouse
  const rubCursorRef = useRef<CursorHandle>(null);
  const rubIdleColor = useRef("#EF4444");
  const drawCursorRef = useRef<CursorHandle>(null);

  // free draw state
  const [tool, setTool] = useState<DrawTool>("brush");
  const [canUndoDraw, setCanUndoDraw] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawPointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const hue = useRef(0);
  const snapshots = useRef<string[]>([]);
  const savedDraw = useRef<string | null>(loadStore().draw ?? null);

  /** persist crayon paintings + free-draw canvas so a reload never destroys the child's work */
  const persist = useCallback((drawData?: string | null) => {
    try {
      const draw = drawData !== undefined ? drawData : savedDraw.current;
      window.localStorage.setItem(
        STORE_KEY,
        JSON.stringify({ paints: paintsRef.current, draw })
      );
    } catch {
      /* storage full or unavailable: ignore */
    }
  }, []);

  useEffect(() => {
    paintsRef.current = paints;
    persist();
  }, [paints, persist]);

  const page = COLORING_PAGES[pageIndex];

  /** (re)initialize the crayon canvas when a coloring page is opened */
  useEffect(() => {
    if (view !== "color" || !paintRef.current) return;
    const c = paintRef.current;
    if (c.width !== PAINT_SIZE) {
      c.width = PAINT_SIZE;
      c.height = PAINT_SIZE;
    } else {
      c.getContext("2d")?.clearRect(0, 0, PAINT_SIZE, PAINT_SIZE);
    }
    kitRef.current = null; // rebuild paths for the new page lazily
    const saved = paintsRef.current[page.id];
    doneRef.current = new Set(saved?.done ?? []);
    if (saved?.img) {
      const ctx = c.getContext("2d");
      const img = new Image();
      img.onload = () => ctx?.drawImage(img, 0, 0, PAINT_SIZE, PAINT_SIZE);
      img.src = saved.img;
    }
  }, [view, pageIndex, page.id]);

  /* ------------------------------- celebration ------------------------------ */

  const showCelebrate = useCallback((msg: string) => {
    setCelebrate({ on: true, msg });
    if (celebrateTimer.current) window.clearTimeout(celebrateTimer.current);
    celebrateTimer.current = window.setTimeout(
      () => setCelebrate({ on: false, msg: "" }),
      2800
    );
  }, []);

  /* -------------------------------- navigation ------------------------------ */

  const openColoring = (i: number) => {
    const target = COLORING_PAGES[i];
    const done = paintsRef.current[target.id]?.done.length ?? 0;
    const total = target.shapes.filter((s) => s.colorable && s.id).length;
    // a picture that is already complete celebrates silently (no confetti on open)
    celebratedRef.current = done >= total && total > 0 ? target.id : null;
    setPageIndex(i);
    setUndoStack([]);
    setView("color");
    openSound();
  };

  const openDraw = () => {
    setView("draw");
    openSound();
  };

  const goGallery = () => {
    strokePointers.current.clear();
    gestureSnapped.current = false;
    setView("gallery");
    clickSound();
  };

  const toggleMute = () => {
    const m = !muted;
    setMutedUi(m);
    setMuted(m);
    if (!m) popSound(1.1);
  };

  /** picking a color from the palette box */
  const pickColor = (c: string | null) => {
    setPickedColor(c);
    // choosing a color always switches the free-draw tool back to the pencil
    if (tool === "eraser") setTool("brush");
    popSound(0.8 + Math.random() * 0.6);
  };

  /* -------------------------------- sparkles -------------------------------- */

  const addSparkle = useCallback(
    (clientX: number, clientY: number, sparkColor: string) => {
      const rect = svgWrapRef.current?.getBoundingClientRect();
      if (!rect) return;
      const id = Date.now() + Math.random();
      setBursts((b) => [
        ...b.slice(-8),
        { id, x: clientX - rect.left, y: clientY - rect.top, color: sparkColor },
      ]);
      window.setTimeout(() => {
        setBursts((b) => b.filter((s) => s.id !== id));
      }, 620);
    },
    []
  );

  /* ----------------------------- crayon engine ------------------------------- */

  /** lazily build (and cache) the region kit for the current page */
  const getKit = useCallback(() => {
    if (!kitRef.current) kitRef.current = buildRegionKit(page);
    return kitRef.current;
  }, [page]);

  /** reusable scratch surface for painting through occlusion masks */
  const ensureScratch = () => {
    if (!scratchRef.current) {
      const s = document.createElement("canvas");
      s.width = PAINT_SIZE;
      s.height = PAINT_SIZE;
      scratchRef.current = s;
    }
    return scratchRef.current;
  };

  /** client coords -> paint-canvas coords */
  const clientToPaint = (clientX: number, clientY: number) => {
    const rect = svgWrapRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: ((clientX - rect.left) / rect.width) * PAINT_SIZE,
      y: ((clientY - rect.top) / rect.height) * PAINT_SIZE,
    };
  };

  /** gentle haptic buzz, throttled (not every dab) */
  const buzz = () => {
    const now = Date.now();
    if (now - lastBuzz.current > 90 && typeof navigator !== "undefined") {
      lastBuzz.current = now;
      try {
        navigator.vibrate?.(12);
      } catch {
        /* vibration not supported */
      }
    }
  };

  /** downscaled PNG of the current paint canvas (undo + localStorage) */
  const snapshotPaint = (): string | null => {
    const c = paintRef.current;
    if (!c) return null;
    const t = document.createElement("canvas");
    t.width = STORE_SIZE;
    t.height = STORE_SIZE;
    const tctx = t.getContext("2d");
    if (!tctx) return null;
    tctx.drawImage(c, 0, 0, STORE_SIZE, STORE_SIZE);
    return t.toDataURL("image/png");
  };

  /** remember the pre-gesture state once per gesture for undo */
  const ensureGestureSnapshot = () => {
    if (gestureSnapped.current) return;
    gestureSnapped.current = true;
    setUndoStack((prev) => [
      ...prev.slice(-(UNDO_LIMIT - 1)),
      { img: snapshotPaint(), done: [...doneRef.current] },
    ]);
  };

  /** one crayon segment, clipped inside its region (or masked for underlaps) */
  const crayonDab = useCallback(
    (
      from: { x: number; y: number },
      to: { x: number; y: number },
      regionId: string,
      color: string
    ) => {
      const ctx = paintRef.current?.getContext("2d");
      const kit = getKit();
      if (!ctx) return;
      const mask = kit.masks[regionId];
      if (mask) {
        // region sits partly under other shapes: stroke on a scratch layer,
        // keep only stroke ∩ mask, then stamp it onto the paint canvas
        const sctx = ensureScratch().getContext("2d");
        if (!sctx) return;
        sctx.setTransform(1, 0, 0, 1, 0, 0);
        sctx.globalCompositeOperation = "source-over";
        sctx.clearRect(0, 0, PAINT_SIZE, PAINT_SIZE);
        strokeSeg(sctx, from, to, color);
        sctx.globalCompositeOperation = "destination-in";
        sctx.setTransform(2, 0, 0, 2, 0, 0); // mask canvas is STORE_SIZE
        sctx.drawImage(mask, 0, 0);
        sctx.setTransform(1, 0, 0, 1, 0, 0);
        sctx.globalCompositeOperation = "source-over";
        ctx.drawImage(scratchRef.current as HTMLCanvasElement, 0, 0);
      } else {
        ctx.save();
        ctx.clip(kit.paths[regionId]);
        strokeSeg(ctx, from, to, color);
        ctx.restore();
      }
    },
    [getKit]
  );

  /**
   * Look up the region under a paint-canvas point and pick this stroke's
   * crayon color for it. Returns null over gaps between regions.
   */
  const paintAt = useCallback(
    (x: number, y: number, stroke: StrokeState) => {
      const kit = getKit();
      const id = kit.hit(x, y);
      if (!id) return null;
      const existing = stroke.colors.get(id);
      if (existing) return { id, color: existing, isNew: false };
      // a picked color paints every rubbed area; magic mode pops random colors
      const palette = kit.shapeById[id]?.bg ? BG_COLORS : KID_COLORS;
      const color = pickedColor ?? pickRandom(palette);
      stroke.colors.set(id, color);
      // rising "musical scale" pops while the sweep colors more areas
      popSound(0.72 + (stroke.colors.size % 9) * 0.11 + Math.random() * 0.05);
      return { id, color, isNew: true };
    },
    [getKit, pickedColor]
  );

  /** measure real paint coverage, mark regions complete, persist the canvas */
  const finishGesture = useCallback(() => {
    gestureSnapped.current = false;
    const c = paintRef.current;
    const ctx = c?.getContext("2d");
    const kit = getKit();
    if (!c || !ctx) return;

    // count painted cells per region on a downscaled copy of the canvas
    const grid = document.createElement("canvas");
    grid.width = CELL_GRID;
    grid.height = CELL_GRID;
    const gctx = grid.getContext("2d", { willReadFrequently: true });
    if (!gctx) return;
    gctx.drawImage(c, 0, 0, CELL_GRID, CELL_GRID);
    const data = gctx.getImageData(0, 0, CELL_GRID, CELL_GRID).data;
    const counts = new Array<number>(kit.ids.length).fill(0);
    for (let i = 0; i < kit.cellOwner.length; i++) {
      const o = kit.cellOwner[i];
      if (o >= 0 && data[i * 4 + 3] > 48) counts[o]++;
    }
    let newlyDone = 0;
    kit.ids.forEach((id, i) => {
      if (doneRef.current.has(id)) return;
      if (kit.cellTotals[i] > 0 && counts[i] >= kit.cellTotals[i] * DONE_RATIO) {
        doneRef.current.add(id);
        newlyDone++;
      }
    });
    if (newlyDone > 0) popSound(1.5);

    const save: PaintSave = { img: snapshotPaint(), done: [...doneRef.current] };
    paintsRef.current = { ...paintsRef.current, [page.id]: save };
    setPaints(paintsRef.current);

    // confetti party when EVERY area of the picture just got colored
    if (
      save.done.length >= kit.ids.length &&
      kit.ids.length > 0 &&
      celebratedRef.current !== page.id
    ) {
      celebratedRef.current = page.id;
      tadaSound();
      showCelebrate("Semua area sudah berwarna!");
    }
  }, [getKit, page.id, showCelebrate]);

  const onRubDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const stroke: StrokeState = {
      x: e.clientX,
      y: e.clientY,
      lastPt: null,
      colors: new Map(),
      color: pickedColor ?? pickRandom(KID_COLORS),
    };
    strokePointers.current.set(e.pointerId, stroke);
    // pressing the pencil down leaves the first soft crayon dot
    const p = clientToPaint(e.clientX, e.clientY);
    if (p) {
      const r = paintAt(p.x, p.y, stroke);
      if (r) {
        ensureGestureSnapshot();
        crayonDab(p, p, r.id, r.color);
        stroke.color = r.color;
        addSparkle(e.clientX, e.clientY, r.color);
        buzz();
      }
    }
    rubIdleColor.current = stroke.color;
    // a colored pencil appears under the finger straight away
    rubCursorRef.current?.show(e.pointerId, e.clientX, e.clientY, "pencil", stroke.color);
    setHintRubDone(true);
  };

  const onRubMove = (e: React.PointerEvent<HTMLDivElement>) => {
    // a mouse stroke ends the moment no button is held (guards stale strokes)
    if (e.pointerType === "mouse" && e.buttons === 0) {
      strokePointers.current.delete(e.pointerId);
      // hovering mouse: the pencil replaces the plain cursor
      rubCursorRef.current?.show(
        e.pointerId,
        e.clientX,
        e.clientY,
        "pencil",
        pickedColor ?? rubIdleColor.current
      );
      return;
    }
    const p = strokePointers.current.get(e.pointerId);
    if (!p) return;

    // use coalesced events for buttery-smooth fast swipes
    const native = e.nativeEvent as PointerEvent & {
      getCoalescedEvents?: () => PointerEvent[];
    };
    const points = native.getCoalescedEvents?.().length
      ? native.getCoalescedEvents()
      : [native];

    for (const pt of points) {
      const dx = pt.clientX - p.x;
      const dy = pt.clientY - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 1) continue;
      // sample along the segment so the crayon lays down a continuous coat
      const steps = Math.min(Math.max(1, Math.ceil(dist / RUB_STEP)), 40);
      for (let i = 1; i <= steps; i++) {
        const cx = p.x + (dx * i) / steps;
        const cy = p.y + (dy * i) / steps;
        const cp = clientToPaint(cx, cy);
        if (!cp) continue;
        const r = paintAt(cp.x, cp.y, p);
        if (!r) {
          p.lastPt = cp; // keep gliding; clipping leaves the gaps unpainted
          continue;
        }
        ensureGestureSnapshot();
        crayonDab(p.lastPt ?? cp, cp, r.id, r.color);
        p.lastPt = cp;
        p.color = r.color;
        if (r.isNew) {
          addSparkle(cx, cy, r.color);
          buzz();
        }
      }
      p.x = pt.clientX;
      p.y = pt.clientY;
    }

    // the pencil takes on the color of the area it just painted
    rubIdleColor.current = p.color;
    rubCursorRef.current?.show(e.pointerId, e.clientX, e.clientY, "pencil", p.color);
  };

  const onRubUp = (e: React.PointerEvent<HTMLDivElement>) => {
    strokePointers.current.delete(e.pointerId);
    rubCursorRef.current?.hide(e.pointerId);
    if (strokePointers.current.size === 0) finishGesture();
  };

  /* ------------------------------ coloring tools ---------------------------- */

  /** redraw the paint canvas + completion set from a snapshot */
  const restorePaint = (save: PaintSave) => {
    const ctx = paintRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, PAINT_SIZE, PAINT_SIZE);
    doneRef.current = new Set(save.done);
    if (save.img) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, PAINT_SIZE, PAINT_SIZE);
      img.src = save.img;
    }
    paintsRef.current = { ...paintsRef.current, [page.id]: save };
    setPaints(paintsRef.current);
  };

  const undoColoring = () => {
    celebratedRef.current = null; // allow the confetti party again
    setUndoStack((prev) => {
      const last = prev[prev.length - 1];
      if (last) {
        restorePaint(last);
        undoSound();
      }
      return prev.slice(0, -1);
    });
  };

  const resetColoring = () => {
    celebratedRef.current = null; // allow the confetti party again
    setUndoStack((prev) => [
      ...prev.slice(-(UNDO_LIMIT - 1)),
      { img: snapshotPaint(), done: [...doneRef.current] },
    ]);
    restorePaint({ img: null, done: [] });
    undoSound();
  };

  const celebrateDownload = (dataUrl: string, filename: string) => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    tadaSound();
    showCelebrate("Karyamu sudah disimpan!");
  };

  const saveColoring = () => {
    const svg = svgWrapRef.current?.querySelector("svg");
    const paint = paintRef.current;
    if (!svg || !paint) return;
    const c = document.createElement("canvas");
    c.width = 1000;
    c.height = 1000;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    // the crayon coats first, then the hollow outlines are stamped on top
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, 1000, 1000);
    ctx.drawImage(paint, 0, 0, 1000, 1000);
    const crayonOnly = c.toDataURL("image/png");
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", "1000");
    clone.setAttribute("height", "1000");
    const data = new XMLSerializer().serializeToString(clone);
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(data)}`;
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, 1000, 1000);
      celebrateDownload(c.toDataURL("image/png"), `yuk-mewarnai-${page.id}.png`);
    };
    img.onerror = () => celebrateDownload(crayonOnly, `yuk-mewarnai-${page.id}.png`);
    img.src = url;
  };

  /* ------------------------------ magic brush ------------------------------- */

  const ctx2d = () => canvasRef.current?.getContext("2d") ?? null;

  const clearCanvasWhite = () => {
    const ctx = ctx2d();
    if (!ctx || !canvasRef.current) return;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  };

  // init / restore canvas whenever draw view mounts
  useEffect(() => {
    if (view !== "draw" || !canvasRef.current) return;
    if (canvasRef.current.width !== 1000) {
      canvasRef.current.width = 1000;
      canvasRef.current.height = 750;
    }
    const ctx = ctx2d();
    if (!ctx) return;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, 1000, 750);
    setCanUndoDraw(snapshots.current.length > 0);
    if (savedDraw.current) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, 1000, 750);
      img.src = savedDraw.current;
    }
  }, [view]);

  // swap the cursor graphic when the tool changes (pencil <-> eraser)
  useEffect(() => {
    drawCursorRef.current?.hideAll();
  }, [tool]);

  const snapshot = () => {
    const c = canvasRef.current;
    if (!c) return;
    const data = c.toDataURL("image/png");
    snapshots.current = [...snapshots.current.slice(-19), data];
    savedDraw.current = data;
    setCanUndoDraw(true);
  };

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) * c.width) / rect.width,
      y: ((e.clientY - rect.top) * c.height) / rect.height,
    };
  };

  /** the pencil paints the picked color (or a rainbow); eraser wipes to white */
  const strokeStyleFor = (): { style: string; width: number } => {
    if (tool === "eraser") return { style: "#FFFFFF", width: 36 };
    if (pickedColor) return { style: pickedColor, width: 20 };
    return { style: `hsl(${Math.round(hue.current)}, 92%, 55%)`, width: 20 };
  };

  const drawDot = (x: number, y: number) => {
    const ctx = ctx2d();
    if (!ctx) return;
    const { style, width } = strokeStyleFor();
    ctx.fillStyle = style;
    ctx.beginPath();
    ctx.arc(x, y, width / 2, 0, Math.PI * 2);
    ctx.fill();
  };

  const drawSeg = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const ctx = ctx2d();
    if (!ctx) return;
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    if (tool !== "eraser" && !pickedColor)
      hue.current = (hue.current + dist * 1.4) % 360;
    const { style, width } = strokeStyleFor();
    ctx.strokeStyle = style;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  };

  /** which cursor graphic fits the active tool */
  const drawCursorKind = (): CursorKind => (tool === "eraser" ? "eraser" : "pencil");

  const onCanvasDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (drawPointers.current.size === 0) snapshot(); // one snapshot per stroke
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = getPos(e);
    drawPointers.current.set(e.pointerId, p);
    drawDot(p.x, p.y);
    popSound(1.3 + Math.random() * 0.3);
    setHintDrawDone(true);
    // the colored pencil appears under the finger straight away
    drawCursorRef.current?.show(
      e.pointerId,
      e.clientX,
      e.clientY,
      drawCursorKind(),
      strokeStyleFor().style
    );
  };

  const onCanvasMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === "mouse" && e.buttons === 0) {
      drawPointers.current.delete(e.pointerId);
      // hovering mouse: the pencil replaces the plain cursor
      drawCursorRef.current?.show(
        e.pointerId,
        e.clientX,
        e.clientY,
        drawCursorKind(),
        strokeStyleFor().style
      );
      return;
    }
    const prev = drawPointers.current.get(e.pointerId);
    if (!prev) return;
    const p = getPos(e);
    drawSeg(prev, p);
    drawPointers.current.set(e.pointerId, p);
    // the pencil keeps changing color together with the rainbow stroke
    drawCursorRef.current?.show(
      e.pointerId,
      e.clientX,
      e.clientY,
      drawCursorKind(),
      strokeStyleFor().style
    );
  };

  const onCanvasUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawPointers.current.delete(e.pointerId);
    drawCursorRef.current?.hide(e.pointerId);
    savedDraw.current = canvasRef.current?.toDataURL("image/png") ?? null;
    persist(savedDraw.current);
  };

  const undoDraw = () => {
    const last = snapshots.current.pop();
    const ctx = ctx2d();
    if (!ctx || !canvasRef.current) return;
    if (!last) {
      clearCanvasWhite();
      setCanUndoDraw(false);
    } else {
      savedDraw.current = last;
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, 1000, 750);
      };
      img.src = last;
      setCanUndoDraw(snapshots.current.length > 0);
    }
    persist(last ?? null);
    undoSound();
  };

  const clearDraw = () => {
    snapshot();
    clearCanvasWhite();
    savedDraw.current = null;
    persist(null);
    undoSound();
  };

  const saveDraw = () => {
    const data = canvasRef.current?.toDataURL("image/png");
    if (data) celebrateDownload(data, "gambar-bebas.png");
  };

  /* -------------------------------- gallery --------------------------------- */

  if (view === "gallery") {
    return (
      <div className="relative flex h-dvh flex-col overflow-hidden bg-[#FFF6DE] font-sans text-[#41403c] select-none">
        {/* soft decorative blobs */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-16 -top-16 h-56 w-56 rounded-full bg-[#FFE3EC]" />
          <div className="absolute -right-14 top-10 h-44 w-44 rounded-full bg-[#DFF3FF]" />
          <div className="absolute -left-10 bottom-24 h-40 w-40 rounded-full bg-[#E8F8D8]" />
          <div className="absolute -right-16 bottom-40 h-52 w-52 rounded-full bg-[#FFF0C2]" />
        </div>

        <header className="relative px-4 pt-7 text-center">
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
            Pilih gambar, lalu gesek-gesek jarinya untuk mewarnai!
          </p>
          {onExit && (
            <div className="absolute left-4 top-6">
              <ToolButton
                label="Kembali ke menu"
                onClick={() => {
                  clickSound();
                  onExit();
                }}
              >
                <House className="h-6 w-6" />
              </ToolButton>
            </div>
          )}
          <div className="absolute right-4 top-6">
            <ToolButton label={muted ? "Nyalakan suara" : "Matikan suara"} onClick={toggleMute}>
              {muted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
            </ToolButton>
          </div>
        </header>

        <main className="relative mx-auto w-full max-w-5xl flex-1 overflow-y-auto px-4 pb-10 pt-5">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {/* free draw card */}
            <motion.button
              type="button"
              whileHover={{ scale: 1.04, rotate: -1 }}
              whileTap={{ scale: 0.96 }}
              onClick={openDraw}
              aria-label="Gambar bebas"
              className="flex flex-col rounded-3xl border-4 border-white bg-gradient-to-br from-amber-300 via-orange-300 to-pink-300 p-3 shadow-[0_8px_0_rgba(180,120,0,0.18)]"
            >
              <div className="grid aspect-square place-items-center rounded-2xl bg-white/35">
                <div className="relative">
                  <Brush className="h-20 w-20 text-[#E8590C] sm:h-24 sm:w-24" strokeWidth={1.6} />
                  <span className="absolute -right-3 -top-2 h-6 w-6 rounded-full bg-[#EF4444] ring-2 ring-white" />
                  <span className="absolute -left-4 top-6 h-5 w-5 rounded-full bg-[#3B82F6] ring-2 ring-white" />
                  <span className="absolute -bottom-1 left-2 h-4 w-4 rounded-full bg-[#22C55E] ring-2 ring-white" />
                </div>
              </div>
              <div className="mt-2 rounded-full bg-white/90 py-1.5 text-center text-sm font-bold text-[#E8590C] sm:text-base">
                Gambar Bebas
              </div>
            </motion.button>

            {COLORING_PAGES.map((p, i) => (
              <motion.button
                key={p.id}
                type="button"
                whileHover={{ scale: 1.04, rotate: i % 2 ? 1 : -1 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => openColoring(i)}
                aria-label={`Mewarnai ${p.name}`}
                className="flex flex-col rounded-3xl border-4 bg-white p-3 shadow-[0_8px_0_rgba(0,0,0,0.07)]"
                style={{ borderColor: CARD_COLORS[i % CARD_COLORS.length] }}
              >
                <div className="overflow-hidden rounded-2xl">
                  <ColoringSvg
                    page={p}
                    fills={suggestedFills(p)}
                    strokeWidth={8}
                    className="block h-auto w-full"
                  />
                </div>
                <div
                  className="mt-2 rounded-full py-1.5 text-center text-sm font-bold text-white sm:text-base"
                  style={{ backgroundColor: CARD_COLORS[i % CARD_COLORS.length] }}
                >
                  {p.name}
                </div>
              </motion.button>
            ))}
          </div>
        </main>

        {celebrate.on && <Celebration msg={celebrate.msg} />}
      </div>
    );
  }

  /* --------------------------- coloring / drawing --------------------------- */

  const isDraw = view === "draw";

  return (
    <div
      className="flex h-dvh flex-col overflow-hidden bg-[#FFF6DE] font-sans text-[#41403c] select-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      <header className="flex items-center gap-2 px-3 pt-3 sm:px-5">
        <ToolButton label="Kembali" onClick={goGallery}>
          <ArrowLeft className="h-6 w-6" />
        </ToolButton>
        <h2
          className="hidden min-w-0 flex-1 truncate text-center text-lg font-bold sm:block sm:text-2xl"
          style={{ color: isDraw ? "#E8590C" : CARD_COLORS[pageIndex % CARD_COLORS.length] }}
        >
          {isDraw ? "Gambar Bebas" : `Mewarnai ${page.name}`}
        </h2>
        <div className="min-w-0 flex-1 sm:hidden" aria-hidden />
        <ToolButton
          label="Batal langkah terakhir"
          onClick={isDraw ? undoDraw : undoColoring}
          disabled={isDraw ? !canUndoDraw : undoStack.length === 0}
        >
          <Undo2 className="h-6 w-6" />
        </ToolButton>
        <ToolButton label={isDraw ? "Bersihkan kanvas" : "Hapus semua warna"} onClick={isDraw ? clearDraw : resetColoring}>
          <Trash2 className="h-6 w-6" />
        </ToolButton>
        <ToolButton label="Simpan gambar" onClick={isDraw ? saveDraw : saveColoring}>
          {isDraw ? <Download className="h-6 w-6" /> : <Camera className="h-6 w-6" />}
        </ToolButton>
        <ToolButton label={muted ? "Nyalakan suara" : "Matikan suara"} onClick={toggleMute}>
          {muted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
        </ToolButton>
      </header>

      {isDraw ? (
        <main className="flex min-h-0 flex-1 flex-col gap-2 p-3">
          <div className="flex justify-center gap-2" role="group" aria-label="Pilih alat">
            {(
              [
                { t: "brush" as DrawTool, label: "Pensil Warna", icon: <Pencil className="h-6 w-6" /> },
                { t: "eraser" as DrawTool, label: "Hapus", icon: <Eraser className="h-6 w-6" /> },
              ]
            ).map(({ t, label, icon }) => {
              const active = tool === t;
              return (
                <motion.button
                  key={t}
                  type="button"
                  whileTap={{ scale: 0.92 }}
                  onClick={() => {
                    setTool(t);
                    clickSound();
                  }}
                  aria-pressed={active}
                  className={`flex h-14 items-center gap-2 rounded-full px-5 text-base font-bold shadow-md transition-colors touch-manipulation sm:h-16 sm:px-7 sm:text-lg ${
                    active
                      ? "bg-amber-500 text-white ring-4 ring-amber-200"
                      : "bg-white text-[#7c6a4a] ring-1 ring-amber-100"
                  }`}
                >
                  {icon}
                  <span className="hidden sm:inline">{label}</span>
                </motion.button>
              );
            })}
          </div>
          <ColorPalette colors={KID_COLORS} value={pickedColor} onChange={pickColor} />
          <div className="relative grid min-h-0 flex-1 place-items-center">
            <canvas
              ref={canvasRef}
              width={1000}
              height={750}
              onPointerDown={onCanvasDown}
              onPointerMove={onCanvasMove}
              onPointerUp={onCanvasUp}
              onPointerCancel={onCanvasUp}
              onPointerLeave={(e) => drawCursorRef.current?.hide(e.pointerId)}
              style={{ width: "min(100%, calc((100dvh - 315px) * 4 / 3))", height: "auto" }}
              className="cursor-none touch-none rounded-[2rem] border-4 border-white bg-white shadow-[0_10px_30px_rgba(120,90,0,0.16)]"
              aria-label="Kertas gambar"
            />
            <PencilLayer ref={drawCursorRef} />
            <AnimatePresence>
              {!hintDrawDone && <HintPill key="hint-draw" text="Gesek jari untuk menggambar!" />}
            </AnimatePresence>
          </div>
        </main>
      ) : (
        <main className="flex min-h-0 flex-1 flex-col gap-2 p-3">
          {/* palette lives ABOVE the paper: little fingers sliding off the
              bottom of the picture can never press a color by accident */}
          <ColorPalette colors={KID_COLORS} value={pickedColor} onChange={pickColor} />
          <div className="grid min-h-0 flex-1 place-items-center">
            <div
              ref={svgWrapRef}
              onPointerDown={onRubDown}
              onPointerMove={onRubMove}
              onPointerUp={onRubUp}
              onPointerCancel={onRubUp}
              onPointerLeave={(e) => rubCursorRef.current?.hide(e.pointerId)}
              onContextMenu={(e) => e.preventDefault()}
              style={{ width: "min(100%, 620px, calc(100dvh - 240px))", aspectRatio: "1 / 1" }}
              className="relative cursor-none touch-none select-none overflow-hidden rounded-[2rem] border-4 border-white bg-white shadow-[0_10px_30px_rgba(120,90,0,0.16)]"
              aria-label={`Area mewarnai ${page.name}, gesek jari untuk mewarnai`}
              role="img"
            >
              {/* the crayon paint lives under the hollow outlines */}
              <canvas
                ref={paintRef}
                width={PAINT_SIZE}
                height={PAINT_SIZE}
                className="absolute inset-0 h-full w-full"
                aria-hidden="true"
              />
              <ColoringSvg
                page={page}
                outlineOnly
                className="relative block h-full w-full"
              />
              <PencilLayer ref={rubCursorRef} />
              <SparkleLayer bursts={bursts} />
            <AnimatePresence>
              {!hintRubDone && <HintPill key="hint-rub" text="Gesek-gesek untuk mewarnai!" />}
            </AnimatePresence>
            </div>
          </div>
        </main>
      )}

      {celebrate.on && <Celebration msg={celebrate.msg} />}
    </div>
  );
}

/* ------------------------------- celebration -------------------------------- */

function Celebration({ msg }: { msg: string }) {
  return (
    <>
      <Confetti />
      <div className="pointer-events-none fixed inset-0 z-[70] grid place-items-center p-6">
        <motion.div
          initial={{ scale: 0.4, opacity: 0, rotate: -6 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 18 }}
          className="rounded-[2rem] border-8 border-yellow-300 bg-white px-10 py-8 text-center shadow-2xl"
          role="status"
        >
          <motion.div
            animate={{ rotate: [0, -12, 12, 0] }}
            transition={{ repeat: Infinity, duration: 1.2 }}
            className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-yellow-100"
          >
            <svg viewBox="0 0 24 24" className="h-12 w-12" aria-hidden>
              <path
                d="M12 2l2.9 6.26L21.5 9.3l-4.75 4.4 1.15 6.55L12 17l-5.9 3.25 1.15-6.55L2.5 9.3l6.6-1.04z"
                fill="#FDE047"
                stroke="#F59E0B"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
          </motion.div>
          <div className="mt-3 text-5xl font-bold text-amber-600">Hebat!</div>
          <div className="mt-1 text-lg font-semibold text-[#9a8757]">{msg}</div>
        </motion.div>
      </div>
    </>
  );
}
