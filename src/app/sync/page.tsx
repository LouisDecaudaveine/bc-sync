"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

interface SyncProgress {
  phase: "idle" | "bands" | "discographies" | "done" | "error";
  totalBands: number;
  bandsDone: number;
  bandsSkipped: number;
  releasesAdded: number;
  releasesProcessed: number;
  currentBand: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
}

interface BackfillProgress {
  running: boolean;
  processed: number;
  remaining: number;
  errors: number;
}

interface StatusResponse {
  running: boolean;
  progress: SyncProgress;
  backfill: BackfillProgress;
}

function computePct(p: SyncProgress): number {
  if (p.phase === "idle") return 0;
  if (p.phase === "done") return 100;
  if (p.phase === "bands") return 5;
  // discographies: 10 → 100 based on bandsDone / totalBands
  if (p.totalBands === 0) return 10;
  return Math.min(100, 10 + (90 * p.bandsDone) / p.totalBands);
}

export default function SyncPage() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const startedRef = useRef(false);

  // Poll status every second while running, every 30s otherwise.
  useEffect(() => {
    let cancelled = false;
    let id: ReturnType<typeof setInterval>;
    async function poll() {
      try {
        const res = await fetch("/api/sync/status", { cache: "no-store" });
        const json = (await res.json()) as StatusResponse;
        if (!cancelled) setStatus(json);
      } catch {
        // ignore transient errors
      }
    }
    poll();
    id = setInterval(poll, 1_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Auto-start a sync the first time we land on the page if none is running
  // and the previous one is finished.
  useEffect(() => {
    if (!status || startedRef.current) return;
    const idleOrDone =
      !status.running &&
      (status.progress.phase === "idle" ||
        status.progress.phase === "done" ||
        status.progress.phase === "error");
    if (idleOrDone) {
      startedRef.current = true;
      void startSync();
    } else if (status.running) {
      startedRef.current = true; // already running, just observe
    }
  }, [status]);

  async function startSync() {
    setStarting(true);
    setStartError(null);
    try {
      const res = await fetch("/api/refresh", { method: "POST" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "failed to start");
    } catch (err) {
      setStartError((err as Error).message);
      startedRef.current = false;
    } finally {
      setStarting(false);
    }
  }

  const p = status?.progress;
  const bf = status?.backfill;
  const pct = p ? computePct(p) : 0;
  const isDone = p?.phase === "done";
  const isError = p?.phase === "error";
  const running = !!status?.running;

  return (
    <div className="max-w-2xl mx-auto py-12">
      <h1 className="text-2xl font-semibold tracking-tight mb-2">Syncing</h1>
      <p className="text-sm text-neutral-400 mb-8">
        Fetching your followed artists and their discographies from Bandcamp.
        Recently synced artists are skipped. Tags are backfilled in the
        background after sync completes.
      </p>

      <div className="rounded border border-neutral-800 p-6 bg-neutral-900/50">
        <div className="flex justify-between items-baseline mb-2">
          <span className="text-sm font-medium">
            {phaseLabel(p?.phase ?? "idle")}
          </span>
          <span className="text-sm tabular-nums text-neutral-400">
            {pct.toFixed(0)}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-neutral-800 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              isError ? "bg-red-500" : isDone ? "bg-green-500" : "bg-blue-500"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
          <dt className="text-neutral-500">Bands</dt>
          <dd className="tabular-nums text-right">
            {p?.bandsDone ?? 0} / {p?.totalBands ?? 0}
            {(p?.bandsSkipped ?? 0) > 0 && (
              <span className="text-neutral-600 ml-1">
                ({p?.bandsSkipped} skipped)
              </span>
            )}
          </dd>
          <dt className="text-neutral-500">New releases</dt>
          <dd className="tabular-nums text-right">{p?.releasesAdded ?? 0}</dd>
          <dt className="text-neutral-500">Releases processed</dt>
          <dd className="tabular-nums text-right">{p?.releasesProcessed ?? 0}</dd>
          {p?.currentBand && running && (
            <>
              <dt className="text-neutral-500">Current band</dt>
              <dd className="text-right truncate">{p.currentBand}</dd>
            </>
          )}
          {p?.startedAt && (
            <>
              <dt className="text-neutral-500">Started</dt>
              <dd className="text-right">
                {new Date(p.startedAt).toLocaleTimeString()}
              </dd>
            </>
          )}
        </dl>

        {/* Tag backfill status */}
        {bf && (bf.running || bf.processed > 0) && (
          <div className="mt-4 pt-4 border-t border-neutral-800">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-neutral-500">
                Tag backfill
              </span>
              <span className="tabular-nums text-neutral-400">
                {bf.running ? (
                  <>{bf.processed} done, {bf.remaining} left</>
                ) : (
                  <>{bf.processed} tags fetched{bf.errors > 0 && `, ${bf.errors} errors`}</>
                )}
              </span>
            </div>
          </div>
        )}

        {isError && (
          <p className="mt-4 text-sm text-red-400">Error: {p?.error}</p>
        )}
        {startError && (
          <p className="mt-4 text-sm text-red-400">{startError}</p>
        )}

        <div className="mt-6 flex gap-3">
          {!running && (
            <button
              onClick={startSync}
              disabled={starting}
              className="rounded border border-neutral-700 px-3 py-1.5 text-xs hover:bg-neutral-800 disabled:opacity-50"
            >
              {starting ? "Starting…" : isDone || isError ? "Sync again" : "Start sync"}
            </button>
          )}
          {isDone && (
            <Link
              href="/releases"
              className="rounded bg-blue-600 hover:bg-blue-500 px-3 py-1.5 text-xs"
            >
              View releases →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function phaseLabel(phase: SyncProgress["phase"]): string {
  switch (phase) {
    case "idle":
      return "Idle";
    case "bands":
      return "Fetching followed artists…";
    case "discographies":
      return "Fetching discographies…";
    case "done":
      return "Done";
    case "error":
      return "Failed";
  }
}
