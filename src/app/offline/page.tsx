import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Offline — Yuk Mewarnai!",
};

export default function OfflinePage() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-background px-6 text-center font-sans">
      <main className="flex max-w-md flex-col items-center gap-6">
        <div className="text-6xl" aria-hidden>
          🎨
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Kamu sedang offline
        </h1>
        <p className="text-base leading-7 text-muted-foreground">
          Koneksi internet tidak tersedia. Gambar yang sudah pernah dibuka tetap
          bisa diwarnai — coba lagi setelah tersambung kembali.
        </p>
      </main>
    </div>
  );
}
