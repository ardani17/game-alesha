# Generate lafalan dengan voice neural Bahasa Indonesia GRATIS dari
# Microsoft Edge (edge-tts): id-ID-GadisNeural.
#
# Prasyarat : python -m pip install edge-tts
# Jalankan  : python scripts/generate_tts.py
# Hasil     (semuanya di-precache service worker -> tetap bunyi offline):
#   public/audio/huruf/{A..Z}.mp3      -> "A. A untuk Apel." dst.
#   public/audio/angka/{1..5}.mp3      -> "satu" .. "lima"
#   public/audio/berhitung/*.mp3       -> "Ada berapa", "Hebat!", nama benda
import asyncio
import json
import sys
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parent.parent
LETTERS_JSON = ROOT / "src" / "data" / "letters.json"
COUNTING_JSON = ROOT / "src" / "data" / "counting.json"
READING_JSON = ROOT / "src" / "data" / "reading.json"
AUDIO_DIR = ROOT / "public" / "audio"

# Voice neural Bahasa Indonesia (gratis via layanan Read Aloud Edge):
#   id-ID-GadisNeural (perempuan, ramah) / id-ID-ArdiNeural (laki-laki)
VOICE = "id-ID-GadisNeural"

NUMBER_WORDS = ["satu", "dua", "tiga", "empat", "lima"]


async def make(text: str, out: Path) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    for attempt in (1, 2, 3):
        try:
            await edge_tts.Communicate(text, VOICE).save(str(out))
            print(f"OK {out.relative_to(ROOT)}  <-  {text}")
            return
        except Exception as e:  # noqa: BLE001 - retry lalu gagal jelas
            print(f"RETRY({attempt}) {out.name}: {e}", file=sys.stderr)
            await asyncio.sleep(1.5)
    sys.exit(f"GAGAL membuat audio: {out.name}")


async def main() -> None:
    letters = json.loads(LETTERS_JSON.read_text(encoding="utf-8"))
    counting = json.loads(COUNTING_JSON.read_text(encoding="utf-8"))

    # Belajar Huruf: satu file per huruf
    for item in letters:
        text = f"{item['ch']}. {item['ch']} untuk {item['word']}."
        await make(text, AUDIO_DIR / "huruf" / f"{item['ch']}.mp3")

    # Berhitung: angka 1-5 + frasa + nama benda
    for n, word in enumerate(NUMBER_WORDS, start=1):
        await make(word, AUDIO_DIR / "angka" / f"{n}.mp3")
    await make("Ada berapa", AUDIO_DIR / "berhitung" / "ada-berapa.mp3")
    await make("Hebat!", AUDIO_DIR / "berhitung" / "hebat.mp3")
    for item in counting:
        await make(item["name"], AUDIO_DIR / "berhitung" / f"{item['name']}.mp3")

    # Belajar Membaca: nama huruf A-Z + kata-kata (dari reading.json)
    reading = json.loads(READING_JSON.read_text(encoding="utf-8"))
    for item in letters:
        await make(item["ch"], AUDIO_DIR / "membaca" / "huruf" / f"{item['ch']}.mp3")
    for item in reading:
        slug = item["word"].lower()
        await make(item["word"], AUDIO_DIR / "membaca" / "kata" / f"{slug}.mp3")

    total = len(letters) * 2 + len(NUMBER_WORDS) + 2 + len(counting) + len(reading)
    print(f"\nSelesai: {total} file MP3 di {AUDIO_DIR}")


if __name__ == "__main__":
    asyncio.run(main())
