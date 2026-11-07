// Generator ikon PWA tanpa dependensi eksternal.
// Menghasilkan PNG lewat encoder minimal (zlib bawaan Node) dengan
// supersampling 4x agar tepian bentuk halus.
//
// Jalankan: node scripts/generate-icons.mjs
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
// mkdirSync dipakai juga untuk res Android di bawah
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const outDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "icons"
);
mkdirSync(outDir, { recursive: true });

// ---------- Encoder PNG minimal ----------
const CRC_TABLE = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1;
  CRC_TABLE[n] = c;
}

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0; // filter: none
    rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- Primitif gambar ----------
const inRoundedRect = (x, y, x0, y0, x1, y1, r) => {
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
};

const inCircle = (x, y, cx, cy, r) => {
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
};

// Glyph gamepad dalam kotak satuan [0,1]²: badan putih dengan
// d-pad dan tombol sebagai cutout (memperlihatkan warna latar).
const inBody = (u, v) => inRoundedRect(u, v, 0.02, 0.3, 0.98, 0.7, 0.17);
const inDetail = (u, v) =>
  // d-pad (kiri)
  inRoundedRect(u, v, 0.195, 0.39, 0.265, 0.61, 0.035) ||
  inRoundedRect(u, v, 0.11, 0.465, 0.35, 0.535, 0.035) ||
  // tombol (kanan)
  inCircle(u, v, 0.7, 0.42, 0.05) ||
  inCircle(u, v, 0.825, 0.58, 0.05);

// ---------- Render ----------
const SS = 4; // supersampling per sumbu (16 sub-piksel per piksel)
const GRADIENT_TOP = [139, 92, 246]; // #8b5cf6
const GRADIENT_BOTTOM = [67, 56, 202]; // #4338ca

function renderIcon(size, { bgRadius = 0, glyphSize = 0.74 }) {
  const rgba = Buffer.alloc(size * size * 4);
  const half = glyphSize / 2;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = (px + (sx + 0.5) / SS) / size;
          const v = (py + (sy + 0.5) / SS) / size;
          const bgIn =
            bgRadius === 0 || inRoundedRect(u, v, 0, 0, 1, 1, bgRadius);
          const gu = (u - 0.5) / half + 0.5;
          const gv = (v - 0.5) / half + 0.5;
          const inGlyphBox =
            gu >= 0 && gu <= 1 && gv >= 0 && gv <= 1;
          const gl =
            inGlyphBox &&
            inBody(gu, gv) &&
            !(inGlyphBox && inDetail(gu, gv));
          if (!bgIn && !gl) continue; // tetap transparan
          const t = GRADIENT_TOP.map((c, i) => c + (GRADIENT_BOTTOM[i] - c) * v);
          const cov = gl ? 1 : 0;
          r += 255 * cov + t[0] * (1 - cov);
          g += 255 * cov + t[1] * (1 - cov);
          b += 255 * cov + t[2] * (1 - cov);
          a += Math.max(bgIn ? 1 : 0, cov);
        }
      }
      const i = (py * size + px) * 4;
      rgba[i] = Math.round(r / (SS * SS));
      rgba[i + 1] = Math.round(g / (SS * SS));
      rgba[i + 2] = Math.round(b / (SS * SS));
      rgba[i + 3] = Math.round((a / (SS * SS)) * 255);
    }
  }
  return rgba;
}

const targets = [
  { file: "icon-192.png", size: 192, bgRadius: 0.225, glyphSize: 0.74 },
  { file: "icon-512.png", size: 512, bgRadius: 0.225, glyphSize: 0.74 },
  { file: "icon-512-maskable.png", size: 512, bgRadius: 0, glyphSize: 0.6 },
  { file: "apple-touch-icon.png", size: 180, bgRadius: 0, glyphSize: 0.72 },
];

for (const t of targets) {
  const png = encodePng(t.size, t.size, renderIcon(t.size, t));
  writeFileSync(join(outDir, t.file), png);
  console.log(`OK ${t.file} (${t.size}x${t.size})`);
}

// Ikon launcher Android ( Capacitor mipmap): persegi penuh tanpa sudut membulat
// (Android memotong sendiri), glyph sedikit lebih kecil agar aman di mask launcher.
const androidRes = join(outDir, "..", "..", "android", "app", "src", "main", "res");
try {
  const densities = [
    { dir: "mipmap-mdpi", size: 48 },
    { dir: "mipmap-hdpi", size: 72 },
    { dir: "mipmap-xhdpi", size: 96 },
    { dir: "mipmap-xxhdpi", size: 144 },
    { dir: "mipmap-xxxhdpi", size: 192 },
  ];
  for (const d of densities) {
    const png = encodePng(d.size, d.size, renderIcon(d.size, { bgRadius: 0, glyphSize: 0.72 }));
    const dir = join(androidRes, d.dir);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "ic_launcher.png"), png);
    writeFileSync(join(dir, "ic_launcher_round.png"), png);
    console.log(`OK android/${d.dir}/ic_launcher(_round).png (${d.size})`);
  }
} catch {
  console.log("LEWATI ikon Android (folder android/ belum ada)");
}
