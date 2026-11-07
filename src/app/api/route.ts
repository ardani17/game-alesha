import { NextResponse } from "next/server";

// wajib untuk output: "export" (Capacitor): route GET diekspor sebagai file statis
export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json({ message: "Hello, world!" });
}