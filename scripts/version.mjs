// Naikkan versi aplikasi secara konsisten di semua tempat:
//   node scripts/version.mjs 1.2.3
// Mengubah:
//   src/data/app-config.json  -> version (dibaca UI "Cek pembaruan")
//   package.json              -> version
//   android/app/build.gradle  -> versionName + versionCode (maj*10000+min*100+pat)
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const versi = process.argv[2];

if (!versi || !/^\d+\.\d+\.\d+$/.test(versi)) {
  console.error('Pemakaian: node scripts/version.mjs <versi>  contoh: node scripts/version.mjs 1.2.0');
  process.exit(1);
}

const [maj, min, pat] = versi.split(".").map(Number);
const versionCode = maj * 10000 + min * 100 + pat;

// 1) app-config.json
const cfgPath = join(ROOT, "src", "data", "app-config.json");
const cfg = JSON.parse(readFileSync(cfgPath, "utf-8"));
cfg.version = versi;
writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + "\n");

// 2) package.json
const pkgPath = join(ROOT, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
pkg.version = versi;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

// 3) android/app/build.gradle
const gradlePath = join(ROOT, "android", "app", "build.gradle");
let gradle = readFileSync(gradlePath, "utf-8");
gradle = gradle.replace(/versionCode \d+/, `versionCode ${versionCode}`);
gradle = gradle.replace(/versionName "[^"]+"/, `versionName "${versi}"`);
writeFileSync(gradlePath, gradle);

console.log(`OK versi ${versi} (versionCode ${versionCode}) ditulis ke:`);
console.log("  src/data/app-config.json");
console.log("  package.json");
console.log("  android/app/build.gradle");
