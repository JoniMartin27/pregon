import { NextResponse } from "next/server";
import { captureSnapshots } from "@/lib/snapshot";

// Endpoint para capturar tracción periódicamente (apunta aquí un cron / Task
// Scheduler mientras la app corre):  GET http://localhost:4040/api/snapshot
export const dynamic = "force-dynamic";

export async function GET() {
  const result = await captureSnapshots();
  return NextResponse.json({ ok: true, ...result });
}
