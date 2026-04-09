import { NextResponse } from "next/server";
import { getSyncProgress, isSyncRunning } from "@/lib/sync";
import { getBackfillProgress } from "@/lib/backfill";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    running: isSyncRunning(),
    progress: getSyncProgress(),
    backfill: getBackfillProgress(),
  });
}
