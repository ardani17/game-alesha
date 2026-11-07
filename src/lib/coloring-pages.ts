// Coloring page definitions: each page is a list of SVG shapes.
// Colorable shapes are filled by RUBBING a finger over them (gesek-gesek).
// `bg: true` marks big background areas (sky, grass, sand…) which receive
// soft pastel colors instead of vivid ones.
// `sug` is the suggested fill used for the colorful gallery thumbnail.

export type ShapeEl = "path" | "circle" | "ellipse" | "rect" | "polygon" | "line";

export interface ShapeDef {
  /** unique id within the page (required for colorable shapes) */
  id?: string;
  el: ShapeEl;
  attrs: Record<string, string | number>;
  /** fill-by-rubbing region */
  colorable?: boolean;
  /** big background area — gets soft pastel colors instead of vivid ones */
  bg?: boolean;
  /** suggested fill for the gallery thumbnail */
  sug?: string;
  /** fixed fill for non-colorable shapes ("none" default) */
  fill?: string;
  stroke?: string;
  /** stroke width (default 6) */
  sw?: number;
  noStroke?: boolean;
}

export interface ColoringPage {
  id: string;
  name: string;
  shapes: ShapeDef[];
}

const OUTLINE = "#41403c";

const sunRays = (cx: number, cy: number, r: number): ShapeDef[] =>
  [0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
    const rad = (a * Math.PI) / 180;
    const x1 = cx + Math.cos(rad) * (r + 6);
    const y1 = cy + Math.sin(rad) * (r + 6);
    const x2 = cx + Math.cos(rad) * (r + 20);
    const y2 = cy + Math.sin(rad) * (r + 20);
    return {
      el: "line",
      attrs: { x1, y1, x2, y2 },
      stroke: "#F6A723",
      sw: 7,
    };
  });

/* ------------------------------------------------------------------ */
/* 1. Burung Beo (parrot) — like the reference image                   */
/* ------------------------------------------------------------------ */
const parrot: ColoringPage = {
  id: "beo",
  name: "Burung Beo",
  shapes: [
    { id: "sky", el: "rect", attrs: { x: 0, y: 0, width: 400, height: 400 }, colorable: true, bg: true, sug: "#CDEBFF" },
    { id: "ekor1", el: "ellipse", attrs: { cx: 160, cy: 332, rx: 17, ry: 62, transform: "rotate(24 160 332)" }, colorable: true, sug: "#E5484D" },
    { id: "ekor2", el: "ellipse", attrs: { cx: 186, cy: 336, rx: 17, ry: 64, transform: "rotate(12 186 336)" }, colorable: true, sug: "#F76B15" },
    { id: "dahan", el: "rect", attrs: { x: -12, y: 306, width: 424, height: 30, rx: 15 }, colorable: true, sug: "#96674A" },
    { id: "daun1", el: "ellipse", attrs: { cx: 46, cy: 332, rx: 36, ry: 14, transform: "rotate(-16 46 332)" }, colorable: true, sug: "#46A758" },
    { id: "daun2", el: "ellipse", attrs: { cx: 354, cy: 334, rx: 36, ry: 14, transform: "rotate(14 354 334)" }, colorable: true, sug: "#46A758" },
    { id: "badan", el: "ellipse", attrs: { cx: 210, cy: 228, rx: 74, ry: 90 }, colorable: true, sug: "#58B368" },
    { id: "sayap", el: "ellipse", attrs: { cx: 190, cy: 240, rx: 40, ry: 66, transform: "rotate(-14 190 240)" }, colorable: true, sug: "#E5484D" },
    { id: "kaki1", el: "ellipse", attrs: { cx: 186, cy: 314, rx: 16, ry: 10 }, colorable: true, sug: "#F5A623" },
    { id: "kaki2", el: "ellipse", attrs: { cx: 236, cy: 314, rx: 16, ry: 10 }, colorable: true, sug: "#F5A623" },
    { id: "kepala", el: "circle", attrs: { cx: 212, cy: 112, r: 58 }, colorable: true, sug: "#FFC93C" },
    { id: "jambul1", el: "ellipse", attrs: { cx: 190, cy: 52, rx: 12, ry: 22, transform: "rotate(-20 190 52)" }, colorable: true, sug: "#E5484D" },
    { id: "jambul2", el: "ellipse", attrs: { cx: 212, cy: 46, rx: 12, ry: 24 }, colorable: true, sug: "#F76B15" },
    { id: "jambul3", el: "ellipse", attrs: { cx: 232, cy: 54, rx: 11, ry: 20, transform: "rotate(20 232 54)" }, colorable: true, sug: "#FFC93C" },
    { id: "pipi1", el: "circle", attrs: { cx: 184, cy: 130, r: 11 }, colorable: true, sug: "#FF8FAB" },
    { id: "pipi2", el: "circle", attrs: { cx: 241, cy: 130, r: 11 }, colorable: true, sug: "#FF8FAB" },
    {
      id: "paruh",
      el: "path",
      attrs: { d: "M 218 106 C 248 94 264 112 257 130 C 252 143 236 141 229 134 C 223 128 219 118 218 106 Z" },
      colorable: true,
      sug: "#FF6B35",
    },
    { el: "circle", attrs: { cx: 229, cy: 103, r: 13 }, fill: "#FFFFFF" },
    { el: "circle", attrs: { cx: 229, cy: 103, r: 5.5 }, fill: OUTLINE, noStroke: true },
  ],
};

/* ------------------------------------------------------------------ */
/* 2. Ikan (fish)                                                      */
/* ------------------------------------------------------------------ */
const fish: ColoringPage = {
  id: "ikan",
  name: "Ikan",
  shapes: [
    { id: "air", el: "rect", attrs: { x: 0, y: 0, width: 400, height: 400 }, colorable: true, bg: true, sug: "#BEE7FF" },
    { id: "pasir", el: "path", attrs: { d: "M -5 342 Q 100 322 200 337 Q 300 352 405 332 L 405 405 L -5 405 Z" }, colorable: true, bg: true, sug: "#FFE3B3" },
    { id: "rumput1", el: "ellipse", attrs: { cx: 56, cy: 298, rx: 11, ry: 32, transform: "rotate(-10 56 298)" }, colorable: true, sug: "#46A758" },
    { id: "rumput2", el: "ellipse", attrs: { cx: 68, cy: 254, rx: 10, ry: 30, transform: "rotate(10 68 254)" }, colorable: true, sug: "#2F9E44" },
    { id: "rumput3", el: "ellipse", attrs: { cx: 372, cy: 300, rx: 11, ry: 32, transform: "rotate(12 372 300)" }, colorable: true, sug: "#46A758" },
    { id: "rumput4", el: "ellipse", attrs: { cx: 384, cy: 256, rx: 10, ry: 28, transform: "rotate(-10 384 256)" }, colorable: true, sug: "#2F9E44" },
    { id: "ekor", el: "polygon", attrs: { points: "268,200 352,132 338,200 352,268" }, colorable: true, sug: "#E5484D" },
    { id: "badan", el: "ellipse", attrs: { cx: 185, cy: 200, rx: 100, ry: 70 }, colorable: true, sug: "#FF9F2E" },
    { id: "garis1", el: "rect", attrs: { x: 142, y: 140, width: 25, height: 122, rx: 12, transform: "rotate(6 154 200)" }, colorable: true, sug: "#FFF7ED" },
    { id: "garis2", el: "rect", attrs: { x: 206, y: 142, width: 23, height: 118, rx: 11, transform: "rotate(-6 218 200)" }, colorable: true, sug: "#FFF7ED" },
    { id: "sirip atas", el: "path", attrs: { d: "M 148 134 Q 185 76 226 132 Z" }, colorable: true, sug: "#E5484D" },
    { id: "sirip bawah", el: "path", attrs: { d: "M 162 258 Q 186 288 212 256 Z" }, colorable: true, sug: "#E5484D" },
    { id: "sirip samping", el: "ellipse", attrs: { cx: 172, cy: 250, rx: 22, ry: 15, transform: "rotate(-30 172 250)" }, colorable: true, sug: "#FF6B35" },
    { id: "gelembung1", el: "circle", attrs: { cx: 302, cy: 102, r: 15 }, colorable: true, sug: "#E7F6FF" },
    { id: "gelembung2", el: "circle", attrs: { cx: 332, cy: 68, r: 10 }, colorable: true, sug: "#E7F6FF" },
    { id: "gelembung3", el: "circle", attrs: { cx: 284, cy: 58, r: 7 }, colorable: true, sug: "#E7F6FF" },
    { el: "circle", attrs: { cx: 100, cy: 180, r: 15 }, fill: "#FFFFFF" },
    { el: "circle", attrs: { cx: 100, cy: 180, r: 6.5 }, fill: OUTLINE, noStroke: true },
    { el: "path", attrs: { d: "M 92 222 Q 103 231 114 222" }, fill: "none" },
  ],
};

/* ------------------------------------------------------------------ */
/* 3. Kupu-kupu (butterfly)                                            */
/* ------------------------------------------------------------------ */
const butterfly: ColoringPage = {
  id: "kupu",
  name: "Kupu-Kupu",
  shapes: [
    { id: "latar", el: "rect", attrs: { x: 0, y: 0, width: 400, height: 400 }, colorable: true, bg: true, sug: "#F3FAE1" },
    { id: "matahari", el: "circle", attrs: { cx: 46, cy: 48, r: 26 }, colorable: true, sug: "#FFC93C" },
    ...sunRays(46, 48, 32),
    { id: "rumput", el: "path", attrs: { d: "M -5 400 L -5 362 Q 60 332 120 362 Q 180 332 240 362 Q 300 332 360 362 Q 382 348 405 362 L 405 400 Z" }, colorable: true, bg: true, sug: "#8CD867" },
    { id: "sayap kiri atas", el: "ellipse", attrs: { cx: 126, cy: 154, rx: 74, ry: 58, transform: "rotate(-22 126 154)" }, colorable: true, sug: "#FF8FAB" },
    { id: "sayap kanan atas", el: "ellipse", attrs: { cx: 274, cy: 154, rx: 74, ry: 58, transform: "rotate(22 274 154)" }, colorable: true, sug: "#FF8FAB" },
    { id: "sayap kiri bawah", el: "ellipse", attrs: { cx: 140, cy: 266, rx: 56, ry: 48, transform: "rotate(18 140 266)" }, colorable: true, sug: "#C77DFF" },
    { id: "sayap kanan bawah", el: "ellipse", attrs: { cx: 260, cy: 266, rx: 56, ry: 48, transform: "rotate(-18 260 266)" }, colorable: true, sug: "#C77DFF" },
    { id: "bintik1", el: "circle", attrs: { cx: 112, cy: 140, r: 17 }, colorable: true, sug: "#FFF3BF" },
    { id: "bintik2", el: "circle", attrs: { cx: 288, cy: 140, r: 17 }, colorable: true, sug: "#FFF3BF" },
    { id: "bintik3", el: "circle", attrs: { cx: 140, cy: 270, r: 12 }, colorable: true, sug: "#FF6B6B" },
    { id: "bintik4", el: "circle", attrs: { cx: 260, cy: 270, r: 12 }, colorable: true, sug: "#FF6B6B" },
    { id: "badan", el: "ellipse", attrs: { cx: 200, cy: 212, rx: 16, ry: 82 }, colorable: true, sug: "#6E5773" },
    { id: "kepala", el: "circle", attrs: { cx: 200, cy: 120, r: 18 }, colorable: true, sug: "#6E5773" },
    { el: "path", attrs: { d: "M 192 106 Q 180 78 164 70" }, fill: "none", stroke: "#6E5773" },
    { el: "path", attrs: { d: "M 208 106 Q 220 78 236 70" }, fill: "none", stroke: "#6E5773" },
    { el: "circle", attrs: { cx: 164, cy: 70, r: 6 }, fill: "#6E5773" },
    { el: "circle", attrs: { cx: 236, cy: 70, r: 6 }, fill: "#6E5773" },
    { el: "circle", attrs: { cx: 194, cy: 118, r: 3.5 }, fill: OUTLINE, noStroke: true },
    { el: "circle", attrs: { cx: 206, cy: 118, r: 3.5 }, fill: OUTLINE, noStroke: true },
  ],
};

/* ------------------------------------------------------------------ */
/* 4. Kucing (cat)                                                     */
/* ------------------------------------------------------------------ */
const cat: ColoringPage = {
  id: "kucing",
  name: "Kucing",
  shapes: [
    { id: "latar", el: "rect", attrs: { x: 0, y: 0, width: 400, height: 400 }, colorable: true, bg: true, sug: "#FFF0D9" },
    { id: "bola", el: "circle", attrs: { cx: 334, cy: 340, r: 25 }, colorable: true, sug: "#FF8FAB" },
    { el: "path", attrs: { d: "M 314 334 q 20 -12 40 0 M 318 348 q 16 -10 32 0" }, fill: "none", stroke: "#D6336C", sw: 4 },
    {
      id: "ekor",
      el: "path",
      attrs: { d: "M 282 288 C 342 300 364 268 353 234 C 349 219 330 221 333 238 C 337 262 318 277 282 272 Z" },
      colorable: true,
      sug: "#FF9F2E",
    },
    { id: "telinga kiri", el: "polygon", attrs: { points: "140,112 122,40 192,84" }, colorable: true, sug: "#FF9F2E" },
    { id: "telinga kanan", el: "polygon", attrs: { points: "260,112 278,40 208,84" }, colorable: true, sug: "#FF9F2E" },
    { id: "badan", el: "ellipse", attrs: { cx: 200, cy: 282, rx: 92, ry: 72 }, colorable: true, sug: "#FF9F2E" },
    { id: "perut", el: "ellipse", attrs: { cx: 200, cy: 300, rx: 52, ry: 44 }, colorable: true, sug: "#FFE3B3" },
    { id: "kaki depan", el: "ellipse", attrs: { cx: 156, cy: 348, rx: 24, ry: 15 }, colorable: true, sug: "#FFE3B3" },
    { id: "kaki belakang", el: "ellipse", attrs: { cx: 244, cy: 348, rx: 24, ry: 15 }, colorable: true, sug: "#FFE3B3" },
    { id: "kepala", el: "circle", attrs: { cx: 200, cy: 150, r: 72 }, colorable: true, sug: "#FF9F2E" },
    { id: "telinga dalam kiri", el: "polygon", attrs: { points: "146,100 136,60 178,84" }, colorable: true, sug: "#FF8FAB" },
    { id: "telinga dalam kanan", el: "polygon", attrs: { points: "254,100 264,60 222,84" }, colorable: true, sug: "#FF8FAB" },
    { el: "circle", attrs: { cx: 175, cy: 142, r: 13 }, fill: "#FFFFFF" },
    { el: "circle", attrs: { cx: 175, cy: 142, r: 6 }, fill: OUTLINE, noStroke: true },
    { el: "circle", attrs: { cx: 225, cy: 142, r: 13 }, fill: "#FFFFFF" },
    { el: "circle", attrs: { cx: 225, cy: 142, r: 6 }, fill: OUTLINE, noStroke: true },
    { id: "hidung", el: "path", attrs: { d: "M 190 164 Q 200 158 210 164 Q 206 178 200 178 Q 194 178 190 164 Z" }, colorable: true, sug: "#FF8FAB" },
    { el: "path", attrs: { d: "M 200 178 Q 200 192 186 192 M 200 178 Q 200 192 214 192" }, fill: "none" },
    { el: "line", attrs: { x1: 112, y1: 152, x2: 160, y2: 160 }, fill: "none" },
    { el: "line", attrs: { x1: 108, y1: 174, x2: 158, y2: 174 }, fill: "none" },
    { el: "line", attrs: { x1: 288, y1: 152, x2: 240, y2: 160 }, fill: "none" },
    { el: "line", attrs: { x1: 292, y1: 174, x2: 242, y2: 174 }, fill: "none" },
  ],
};

/* ------------------------------------------------------------------ */
/* 5. Mobil (car)                                                      */
/* ------------------------------------------------------------------ */
const car: ColoringPage = {
  id: "mobil",
  name: "Mobil",
  shapes: [
    { id: "langit", el: "rect", attrs: { x: 0, y: 0, width: 400, height: 400 }, colorable: true, bg: true, sug: "#BEE7FF" },
    { id: "matahari", el: "circle", attrs: { cx: 50, cy: 54, r: 27 }, colorable: true, sug: "#FFC93C" },
    ...sunRays(50, 54, 33),
    { id: "awan", el: "path", attrs: { d: "M 244 86 Q 236 58 264 54 Q 272 32 297 40 Q 316 26 333 44 Q 356 42 357 64 Q 366 84 342 87 Z" }, colorable: true, sug: "#FFFFFF" },
    { id: "rumput", el: "rect", attrs: { x: -5, y: 330, width: 410, height: 75 }, colorable: true, bg: true, sug: "#8CD867" },
    { id: "kabin", el: "path", attrs: { d: "M 122 232 Q 130 182 168 180 L 232 180 Q 270 182 278 238 Z" }, colorable: true, sug: "#E5484D" },
    { id: "badan", el: "path", attrs: { d: "M 55 266 Q 50 234 82 230 L 318 230 Q 352 234 347 266 Q 350 294 318 296 L 84 296 Q 52 294 55 266 Z" }, colorable: true, sug: "#E5484D" },
    { id: "jendela kiri", el: "path", attrs: { d: "M 142 226 Q 148 194 172 192 L 192 192 L 192 226 Z" }, colorable: true, sug: "#CDEBFF" },
    { id: "jendela kanan", el: "path", attrs: { d: "M 210 226 L 210 192 L 230 192 Q 254 194 261 226 Z" }, colorable: true, sug: "#CDEBFF" },
    { id: "roda kiri", el: "circle", attrs: { cx: 122, cy: 296, r: 35 }, colorable: true, sug: "#3F3F46" },
    { id: "roda kanan", el: "circle", attrs: { cx: 288, cy: 296, r: 35 }, colorable: true, sug: "#3F3F46" },
    { id: "velg kiri", el: "circle", attrs: { cx: 122, cy: 296, r: 14 }, colorable: true, sug: "#E9ECEF" },
    { id: "velg kanan", el: "circle", attrs: { cx: 288, cy: 296, r: 14 }, colorable: true, sug: "#E9ECEF" },
  ],
};

/* ------------------------------------------------------------------ */
/* 6. Rumah (house)                                                    */
/* ------------------------------------------------------------------ */
const house: ColoringPage = {
  id: "rumah",
  name: "Rumah",
  shapes: [
    { id: "langit", el: "rect", attrs: { x: 0, y: 0, width: 400, height: 400 }, colorable: true, bg: true, sug: "#BEE7FF" },
    { id: "matahari", el: "circle", attrs: { cx: 50, cy: 52, r: 26 }, colorable: true, sug: "#FFC93C" },
    ...sunRays(50, 52, 32),
    { id: "awan", el: "path", attrs: { d: "M 258 74 Q 250 48 276 44 Q 284 24 307 31 Q 324 19 340 35 Q 361 33 362 53 Q 370 72 348 75 Z" }, colorable: true, sug: "#FFFFFF" },
    { id: "rumput", el: "rect", attrs: { x: -5, y: 330, width: 410, height: 75 }, colorable: true, bg: true, sug: "#8CD867" },
    { id: "batang", el: "rect", attrs: { x: 328, y: 252, width: 24, height: 84, rx: 9 }, colorable: true, sug: "#96674A" },
    { id: "pohon", el: "circle", attrs: { cx: 340, cy: 216, r: 53 }, colorable: true, sug: "#58B368" },
    { id: "cerobong", el: "rect", attrs: { x: 252, y: 110, width: 27, height: 48 }, colorable: true, sug: "#96674A" },
    { id: "atap", el: "polygon", attrs: { points: "72,186 200,92 328,186" }, colorable: true, sug: "#E5484D" },
    { id: "dinding", el: "rect", attrs: { x: 96, y: 182, width: 208, height: 150 }, colorable: true, sug: "#FFE3B3" },
    { id: "pintu", el: "path", attrs: { d: "M 154 332 L 154 262 Q 154 238 177 238 Q 200 238 200 262 L 200 332 Z" }, colorable: true, sug: "#96674A" },
    { el: "circle", attrs: { cx: 192, cy: 290, r: 4.5 }, fill: "#5C4326" },
    { id: "jendela kiri", el: "rect", attrs: { x: 112, y: 206, width: 48, height: 48, rx: 7 }, colorable: true, sug: "#CDEBFF" },
    { id: "jendela kanan", el: "rect", attrs: { x: 240, y: 206, width: 48, height: 48, rx: 7 }, colorable: true, sug: "#CDEBFF" },
    { el: "line", attrs: { x1: 136, y1: 208, x2: 136, y2: 252 }, fill: "none" },
    { el: "line", attrs: { x1: 114, y1: 230, x2: 158, y2: 230 }, fill: "none" },
    { el: "line", attrs: { x1: 264, y1: 208, x2: 264, y2: 252 }, fill: "none" },
    { el: "line", attrs: { x1: 242, y1: 230, x2: 286, y2: 230 }, fill: "none" },
  ],
};

/* ------------------------------------------------------------------ */
/* 7. Dino                                                             */
/* ------------------------------------------------------------------ */
const dino: ColoringPage = {
  id: "dino",
  name: "Dino",
  shapes: [
    { id: "latar", el: "rect", attrs: { x: 0, y: 0, width: 400, height: 400 }, colorable: true, bg: true, sug: "#EDF7E1" },
    { id: "bukit", el: "path", attrs: { d: "M -5 400 L -5 344 Q 100 302 200 342 Q 300 302 405 344 L 405 400 Z" }, colorable: true, bg: true, sug: "#B5E48C" },
    { id: "matahari", el: "circle", attrs: { cx: 48, cy: 52, r: 24 }, colorable: true, sug: "#FFC93C" },
    ...sunRays(48, 52, 30),
    {
      id: "ekor",
      el: "path",
      attrs: { d: "M 296 302 Q 366 292 388 240 Q 394 214 373 218 Q 380 242 348 260 Q 318 274 286 278 Z" },
      colorable: true,
      sug: "#58B368",
    },
    { id: "badan", el: "ellipse", attrs: { cx: 200, cy: 272, rx: 96, ry: 72 }, colorable: true, sug: "#58B368" },
    { id: "leher", el: "ellipse", attrs: { cx: 138, cy: 182, rx: 33, ry: 76, transform: "rotate(22 138 182)" }, colorable: true, sug: "#58B368" },
    { id: "kaki kiri", el: "rect", attrs: { x: 143, y: 316, width: 40, height: 62, rx: 18 }, colorable: true, sug: "#74C69D" },
    { id: "kaki kanan", el: "rect", attrs: { x: 217, y: 316, width: 40, height: 62, rx: 18 }, colorable: true, sug: "#74C69D" },
    { id: "perut", el: "ellipse", attrs: { cx: 196, cy: 292, rx: 62, ry: 42 }, colorable: true, sug: "#E9F5DB" },
    { id: "kepala", el: "circle", attrs: { cx: 166, cy: 100, r: 43 }, colorable: true, sug: "#58B368" },
    { id: "moncong", el: "ellipse", attrs: { cx: 202, cy: 112, rx: 23, ry: 16 }, colorable: true, sug: "#74C69D" },
    { el: "circle", attrs: { cx: 155, cy: 90, r: 11 }, fill: "#FFFFFF" },
    { el: "circle", attrs: { cx: 155, cy: 90, r: 5 }, fill: OUTLINE, noStroke: true },
    { el: "circle", attrs: { cx: 202, cy: 106, r: 2.6 }, fill: OUTLINE, noStroke: true },
    { el: "path", attrs: { d: "M 192 124 Q 202 131 213 123" }, fill: "none" },
    { id: "duri1", el: "polygon", attrs: { points: "148,214 162,166 178,212" }, colorable: true, sug: "#FF6B35" },
    { id: "duri2", el: "polygon", attrs: { points: "184,234 200,188 216,230" }, colorable: true, sug: "#FF6B35" },
    { id: "duri3", el: "polygon", attrs: { points: "222,248 240,206 256,244" }, colorable: true, sug: "#FF6B35" },
    { id: "duri4", el: "polygon", attrs: { points: "258,258 277,222 291,254" }, colorable: true, sug: "#FF6B35" },
    { id: "duri5", el: "polygon", attrs: { points: "300,262 316,234 330,258" }, colorable: true, sug: "#FF6B35" },
  ],
};

/* ------------------------------------------------------------------ */
/* 8. Bunga (flower in a pot)                                          */
/* ------------------------------------------------------------------ */
const flower: ColoringPage = {
  id: "bunga",
  name: "Bunga",
  shapes: [
    { id: "latar", el: "rect", attrs: { x: 0, y: 0, width: 400, height: 400 }, colorable: true, bg: true, sug: "#FFF6D6" },
    { id: "matahari", el: "circle", attrs: { cx: 48, cy: 50, r: 26 }, colorable: true, sug: "#FFC93C" },
    ...sunRays(48, 50, 32),
    { id: "awan", el: "path", attrs: { d: "M 268 78 Q 260 52 286 48 Q 294 28 317 35 Q 334 23 350 39 Q 371 37 372 57 Q 380 76 358 79 Z" }, colorable: true, sug: "#FFFFFF" },
    { id: "batang", el: "rect", attrs: { x: 193, y: 168, width: 15, height: 158, rx: 7.5 }, colorable: true, sug: "#46A758" },
    { id: "daun kiri", el: "ellipse", attrs: { cx: 158, cy: 272, rx: 35, ry: 15, transform: "rotate(-24 158 272)" }, colorable: true, sug: "#2F9E44" },
    { id: "daun kanan", el: "ellipse", attrs: { cx: 244, cy: 240, rx: 35, ry: 15, transform: "rotate(24 244 240)" }, colorable: true, sug: "#2F9E44" },
    { id: "mahkota1", el: "ellipse", attrs: { cx: 253, cy: 140, rx: 24, ry: 37, transform: "rotate(90 253 140)" }, colorable: true, sug: "#FF8FAB" },
    { id: "mahkota2", el: "ellipse", attrs: { cx: 237, cy: 177, rx: 24, ry: 37, transform: "rotate(45 237 177)" }, colorable: true, sug: "#C77DFF" },
    { id: "mahkota3", el: "ellipse", attrs: { cx: 200, cy: 192, rx: 24, ry: 37 }, colorable: true, sug: "#FF8FAB" },
    { id: "mahkota4", el: "ellipse", attrs: { cx: 163, cy: 177, rx: 24, ry: 37, transform: "rotate(-45 163 177)" }, colorable: true, sug: "#C77DFF" },
    { id: "mahkota5", el: "ellipse", attrs: { cx: 147, cy: 140, rx: 24, ry: 37, transform: "rotate(-90 147 140)" }, colorable: true, sug: "#FF8FAB" },
    { id: "mahkota6", el: "ellipse", attrs: { cx: 163, cy: 103, rx: 24, ry: 37, transform: "rotate(-135 163 103)" }, colorable: true, sug: "#C77DFF" },
    { id: "mahkota7", el: "ellipse", attrs: { cx: 200, cy: 88, rx: 24, ry: 37 }, colorable: true, sug: "#FF8FAB" },
    { id: "mahkota8", el: "ellipse", attrs: { cx: 237, cy: 103, rx: 24, ry: 37, transform: "rotate(135 237 103)" }, colorable: true, sug: "#C77DFF" },
    { id: "tengah", el: "circle", attrs: { cx: 200, cy: 140, r: 31 }, colorable: true, sug: "#FFC93C" },
    { id: "pot", el: "path", attrs: { d: "M 142 336 L 258 336 L 241 396 L 159 396 Z" }, colorable: true, sug: "#FF8A65" },
    { id: "bibir pot", el: "rect", attrs: { x: 132, y: 322, width: 136, height: 27, rx: 12 }, colorable: true, sug: "#FF7043" },
  ],
};

export const COLORING_PAGES: ColoringPage[] = [
  parrot,
  fish,
  butterfly,
  cat,
  car,
  house,
  dino,
  flower,
];

/** Suggested fills map for thumbnails */
export function suggestedFills(page: ColoringPage): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of page.shapes) {
    if (s.colorable && s.id && s.sug) out[s.id] = s.sug;
  }
  return out;
}
