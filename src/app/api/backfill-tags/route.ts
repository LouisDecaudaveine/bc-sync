import { NextResponse } from "next/server";
import {
  getBackfillProgress,
  isBackfillRunning,
  runBackfill,
} from "@/lib/backfill";

export const dynamic = "force-dynamic";

/** Start a tag backfill run. */
export async function POST() {
  if (isBackfillRunning()) {
    return NextResponse.json({ ok: true, alreadyRunning: true });
  }
  runBackfill();
  return NextResponse.json({ ok: true, started: true });
}

/** Poll backfill progress. */
export async function GET() {
  return NextResponse.json(getBackfillProgress());
}
