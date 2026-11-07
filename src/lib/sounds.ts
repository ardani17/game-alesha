// Fun sound effects for toddlers using Web Audio API (no audio files needed).
let ctx: AudioContext | null = null;
let muted = false;

export function setMuted(m: boolean) {
  muted = m;
}

export function isMuted() {
  return muted;
}

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

interface ToneOpts {
  freq: number;
  endFreq?: number;
  dur?: number;
  type?: OscillatorType;
  delay?: number;
  gain?: number;
}

function tone({
  freq,
  endFreq,
  dur = 0.14,
  type = "sine",
  delay = 0,
  gain = 0.22,
}: ToneOpts) {
  const a = ac();
  if (!a || muted) return;
  const t0 = a.currentTime + delay;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

/** Short playful "pop" (color pick / region fill). pitch 0.6 - 1.6 */
export function popSound(pitch = 1) {
  tone({ freq: 520 * pitch, endFreq: 180 * pitch, dur: 0.13, type: "triangle" });
}

/** Gentle click for tool buttons */
export function clickSound() {
  tone({ freq: 700, endFreq: 500, dur: 0.07, type: "square", gain: 0.12 });
}

/** Happy rising "boop" when opening a page */
export function openSound() {
  tone({ freq: 330, endFreq: 660, dur: 0.18, type: "sine" });
}

/** Celebration fanfare when saving */
export function tadaSound() {
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  notes.forEach((f, i) =>
    tone({ freq: f, dur: 0.22, type: "triangle", delay: i * 0.09, gain: 0.25 })
  );
  tone({ freq: 1568, dur: 0.35, type: "sine", delay: 0.4, gain: 0.18 });
}

/** Sad-but-soft "whoosh" for undo / clear */
export function undoSound() {
  tone({ freq: 400, endFreq: 220, dur: 0.16, type: "sine", gain: 0.15 });
}
