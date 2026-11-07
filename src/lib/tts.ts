// Pemutar suara lafalan: file MP3 neural Bahasa Indonesia (hasil
// `python scripts/generate_tts.py` via edge-tts) dengan fallback ke
// Web Speech API bila file belum tersedia.

/* ------------- voice Bahasa Indonesia (fallback Web Speech) ------------- */

let idVoice: SpeechSynthesisVoice | null = null;
let voicesHooked = false;

function findIndonesianVoice(): SpeechSynthesisVoice | null {
  try {
    const voices = window.speechSynthesis.getVoices();
    return (
      // prioritas: voice dengan kode bahasa id-ID / id (mis. "Google Bahasa
      // Indonesia", "Microsoft Andika - Indonesian (Indonesia)", "Damayanti")
      voices.find((v) => /^id([-_]|$)/i.test(v.lang ?? "")) ??
      voices.find((v) => /indonesia/i.test(v.name ?? "")) ??
      null
    );
  } catch {
    return null;
  }
}

function resolveIndonesianVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return null;
  }
  if (!voicesHooked) {
    voicesHooked = true;
    try {
      // Chromium memuat daftar voice secara asinkron
      window.speechSynthesis.addEventListener?.("voiceschanged", () => {
        idVoice = findIndonesianVoice();
      });
    } catch {
      /* ignore */
    }
  }
  if (!idVoice) idVoice = findIndonesianVoice();
  return idVoice;
}

/** Fallback terakhir: Web Speech API dengan voice Indonesia bila tersedia. */
export function speakFallback(text: string) {
  try {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "id-ID";
    const voice = resolveIndonesianVoice();
    if (voice) {
      try {
        u.voice = voice;
      } catch {
        // sebagian webview menolak assignment voice — biarkan `lang`
        // yang menentukan suara (jangan batalkan lafalan)
      }
    }
    u.rate = 0.85;
    u.pitch = 1.15;
    synth.speak(u);
  } catch {
    /* speech not available on this device */
  }
}

/* -------------------------- pemutar MP3 berantai -------------------------- */

const cache = new Map<string, HTMLAudioElement>();
let current: HTMLAudioElement | null = null;
/** naik setiap kali suara baru diputar/mengganti — membatalkan antrean lama */
let token = 0;

/** Hentikan semua lafalan (MP3 & speech) yang sedang/antre berjalan. */
export function stopVoice() {
  token++;
  try {
    current?.pause();
  } catch {
    /* ignore */
  }
  current = null;
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* ignore */
  }
}

function getClip(url: string): HTMLAudioElement {
  let a = cache.get(url);
  if (!a) {
    a = new Audio(url);
    a.preload = "auto";
    cache.set(url, a);
  }
  return a;
}

/** Putar satu klip; resolve `true` setelah selesai, `false` bila gagal. */
function playClipAndWait(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    let a: HTMLAudioElement;
    try {
      a = getClip(url);
    } catch {
      return resolve(false);
    }
    current = a;
    a.currentTime = 0;
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      a.onended = a.onerror = null;
      resolve(ok);
    };
    a.onended = () => finish(true);
    a.onerror = () => finish(false);
    try {
      const p = a.play();
      if (p) p.catch(() => finish(false));
    } catch {
      finish(false);
    }
  });
}

/**
 * Putar satu klip atau beberapa klip MP3 berurutan. Bila klip pertama gagal
 * (mis. file belum digenerate/terhapus), jatuh ke Web Speech API.
 */
export async function playVoice(
  clips: string | string[],
  fallbackText?: string
) {
  const list = Array.isArray(clips) ? clips : [clips];
  stopVoice();
  const my = token;
  for (const url of list) {
    if (my !== token) return; // digantikan suara baru
    const ok = await playClipAndWait(url);
    if (my !== token) return;
    if (!ok) {
      if (fallbackText) speakFallback(fallbackText);
      return;
    }
  }
}
