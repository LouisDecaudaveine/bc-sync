import { NextResponse } from "next/server";
import { isSyncRunning, runSync } from "@/lib/sync";
import { runBackfill } from "@/lib/backfill";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  if (isSyncRunning()) {
    return NextResponse.json({ ok: true, alreadyRunning: true });
  }
  // Fire and forget — the client polls /api/sync/status for progress.
  // After sync completes, kick off a slow tag backfill in the background.
  runSync()
    .then(() => {
      runBackfill();
    })
    .catch((err) => {
      console.error("sync failed:", err);
    });
  return NextResponse.json({ ok: true, started: true });
}
