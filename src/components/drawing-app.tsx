"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
 * Everything is colored by RUBBING (gesek-gesek): the child simply sweeps a
 * finger over the picture and every area under it pops into a cheerful
 * random color. No color picking, no tools — zero frustration for a
 * two-year-old. Rubbing an area again changes its color.
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

function pickRandom(pool: string[], avoid?: string) {
  const options = avoid ? pool.filter((c) => c !== avoid) : pool;
  return options[Math.floor(Math.random() * options.length)];
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

const STORE_KEY = "yuk-mewarnai-v1";

function loadStore(): { fills?: Record<string, Record<string, string>>; draw?: string | null } {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function DrawingApp({ onExit }: { onExit?: () => void }) {
  const [view, setView] = useState<View>("gallery");
  const [pageIndex, setPageIndex] = useState(0);
  const [allFills, setAllFills] = useState<Record<string, Record<string, string>>>(
    () => loadStore().fills ?? {}
  );
  const allFillsRef = useRef(allFills);
  const [undoStack, setUndoStack] = useState<Record<string, string>[]>([]);
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

  // rubbing state (multi-touch: one stroke per finger)
  const svgWrapRef = useRef<HTMLDivElement>(null);
  const strokePointers = useRef<
    Map<number, { x: number; y: number; colored: Set<string>; color: string }>
  >(new Map());
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

  /** persist coloring fills + free-draw canvas so a reload never destroys the child's work */
  const persist = useCallback((drawData?: string | null) => {
    try {
      const draw = drawData !== undefined ? drawData : savedDraw.current;
      window.localStorage.setItem(
        STORE_KEY,
        JSON.stringify({ fills: allFillsRef.current, draw })
      );
    } catch {
      /* storage full or unavailable: ignore */
    }
  }, []);

  useEffect(() => {
    allFillsRef.current = allFills;
    persist();
  }, [allFills, persist]);

  const page = COLORING_PAGES[pageIndex];
  const fills = allFills[page.id] ?? {};

  /** id -> shape lookup for rub hit-testing */
  const regionMap = useMemo(() => {
    const m = new Map<string, ShapeDef>();
    for (const s of page.shapes) if (s.colorable && s.id) m.set(s.id, s);
    return m;
  }, [page]);
  const totalRegions = regionMap.size;

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
    const colored = Object.keys(allFillsRef.current[target.id] ?? {}).length;
    const total = target.shapes.filter((s) => s.colorable && s.id).length;
    // a picture that is already complete celebrates silently (no confetti on open)
    celebratedRef.current = colored >= total ? target.id : null;
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

  /* --------------------------- rub-to-color engine -------------------------- */

  /** Color the region under a point (once per stroke per region). */
  const fillRegionAt = useCallback(
    (clientX: number, clientY: number, stroke: Set<string>) => {
      const hit = document.elementFromPoint(clientX, clientY);
      const region = hit?.closest("[data-region]");
      const shapeId = region?.getAttribute("data-region");
      if (!shapeId || stroke.has(shapeId)) return null;
      stroke.add(shapeId);

      const shape = regionMap.get(shapeId);
      const palette = shape?.bg ? BG_COLORS : KID_COLORS;
      const prevFills = allFillsRef.current[page.id] ?? {};
      // a picked color paints every rubbed area; magic mode pops random colors
      const paint = pickedColor ?? pickRandom(palette, prevFills[shapeId]);
      const nextFills = { ...prevFills, [shapeId]: paint };

      // one undo snapshot per rubbing gesture (even with many fingers)
      if (!gestureSnapped.current) {
        gestureSnapped.current = true;
        setUndoStack((prev) => [...prev.slice(-24), { ...prevFills }]);
      }

      // keep the ref fresh synchronously so rapid rubs in one batch stay correct
      allFillsRef.current = { ...allFillsRef.current, [page.id]: nextFills };
      setAllFills(allFillsRef.current);

      // rising "musical scale" pops while the sweep colors more areas
      popSound(0.72 + (stroke.size % 9) * 0.11 + Math.random() * 0.05);
      addSparkle(clientX, clientY, paint);

      // confetti party when EVERY area of the picture just got colored
      if (
        !(shapeId in prevFills) &&
        Object.keys(nextFills).length >= totalRegions &&
        celebratedRef.current !== page.id
      ) {
        celebratedRef.current = page.id;
        tadaSound();
        showCelebrate("Semua area sudah berwarna!");
      }

      // gentle haptic buzz, throttled (not every fill)
      const now = Date.now();
      if (now - lastBuzz.current > 90 && typeof navigator !== "undefined") {
        lastBuzz.current = now;
        try {
          navigator.vibrate?.(12);
        } catch {
          /* vibration not supported */
        }
      }
      setHintRubDone(true);
      return paint;
    },
    [addSparkle, page.id, pickedColor, regionMap, showCelebrate, totalRegions]
  );

  const onRubDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const stroke = new Set<string>();
    const startColor = pickedColor ?? pickRandom(KID_COLORS);
    strokePointers.current.set(e.pointerId, {
      x: e.clientX,
      y: e.clientY,
      colored: stroke,
      color: startColor,
    });
    // an instant tap already colors the area under the finger
    const paint = fillRegionAt(e.clientX, e.clientY, stroke);
    const color = paint ?? startColor;
    const p = strokePointers.current.get(e.pointerId);
    if (p) p.color = color;
    rubIdleColor.current = color;
    // a colored pencil appears under the finger straight away
    rubCursorRef.current?.show(e.pointerId, e.clientX, e.clientY, "pencil", color);
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

    let lastPaint: string | null = null;
    for (const pt of points) {
      const dx = pt.clientX - p.x;
      const dy = pt.clientY - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 1) continue;
      // sample along the segment so fast swipes never skip an area
      const steps = Math.min(Math.max(1, Math.ceil(dist / RUB_STEP)), 40);
      for (let i = 1; i <= steps; i++) {
        const paint = fillRegionAt(
          p.x + (dx * i) / steps,
          p.y + (dy * i) / steps,
          p.colored
        );
        if (paint) lastPaint = paint;
      }
      p.x = pt.clientX;
      p.y = pt.clientY;
    }

    // the pencil takes on the color of the area it just painted
    if (lastPaint) {
      p.color = lastPaint;
      rubIdleColor.current = lastPaint;
    }
    rubCursorRef.current?.show(e.pointerId, e.clientX, e.clientY, "pencil", p.color);
  };

  const onRubUp = (e: React.PointerEvent<HTMLDivElement>) => {
    strokePointers.current.delete(e.pointerId);
    rubCursorRef.current?.hide(e.pointerId);
    if (strokePointers.current.size === 0) gestureSnapped.current = false;
  };

  /* ------------------------------ coloring tools ---------------------------- */

  const undoColoring = () => {
    celebratedRef.current = null; // allow the confetti party again
    setUndoStack((prev) => {
      const last = prev[prev.length - 1];
      if (last) {
        setAllFills((f) => ({ ...f, [page.id]: last }));
        undoSound();
      }
      return prev.slice(0, -1);
    });
  };

  const resetColoring = () => {
    celebratedRef.current = null; // allow the confetti party again
    setUndoStack((prev) => [...prev.slice(-24), { ...fills }]);
    setAllFills((prev) => ({ ...prev, [page.id]: {} }));
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
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", "1000");
    clone.setAttribute("height", "1000");
    const data = new XMLSerializer().serializeToString(clone);
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(data)}`;
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = 1000;
      c.height = 1000;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, 1000, 1000);
      ctx.drawImage(img, 0, 0, 1000, 1000);
      celebrateDownload(c.toDataURL("image/png"), `yuk-mewarnai-${page.id}.png`);
    };
    img.onerror = () => celebrateDownload(url, `yuk-mewarnai-${page.id}.svg`);
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
              <ColoringSvg page={page} fills={fills} className="block h-full w-full" />
              <PencilLayer ref={rubCursorRef} />
              <SparkleLayer bursts={bursts} />
              <AnimatePresence>
                {!hintRubDone && <HintPill key="hint-rub" text="Gesek-gesek untuk mewarnai!" />}
              </AnimatePresence>
            </div>
          </div>
          <ColorPalette colors={KID_COLORS} value={pickedColor} onChange={pickColor} />
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
