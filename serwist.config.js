// @ts-check
import { serwist } from "@serwist/next/config";

/**
 * Konfigurasi Serwist (configurator mode).
 * Service worker dibangun SETELAH `next build` selesai, sehingga semua rute
 * yang di-prerender otomatis masuk precache. Kompatibel dengan Turbopack.
 * Docs: https://serwist.pages.dev/docs/next/config
 */
export default serwist({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
});
