import {
  fetchTralbumDetailsSlow,
  normalizeItemType,
  normalizeTags,
} from "./bandcamp/client";
import { getReleasesWithoutTags, updateReleaseTags } from "./store";

const BATCH_SIZE = 50;

export interface BackfillProgress {
  running: boolean;
  processed: number;
  remaining: number;
  errors: number;
}

const progress: BackfillProgress = {
  running: false,
  processed: 0,
  remaining: 0,
  errors: 0,
};

export function getBackfillProgress(): BackfillProgress {
  return { ...progress };
}

let inflight: Promise<void> | null = null;

/** Kick off a background tag backfill. Idempotent — won't double-run. */
export function runBackfill(): void {
  if (inflight) return;
  inflight = (async () => {
    try {
      await doBackfill();
    } finally {
      inflight = null;
    }
  })();
}

export function isBackfillRunning(): boolean {
  return inflight !== null;
}

async function doBackfill(): Promise<void> {
  progress.running = true;
  progress.processed = 0;
  progress.errors = 0;

  // Process in batches so we don't hold a huge list in memory.
  while (true) {
    const batch = getReleasesWithoutTags(BATCH_SIZE);
    progress.remaining = batch.length;
    if (batch.length === 0) break;

    for (const stub of batch) {
      const itemType = stub.type === "album" ? "a" as const : "t" as const;
      const itemId = Number(stub.id.split("-")[1]);

      try {
        const td = await fetchTralbumDetailsSlow(itemType, itemId, stub.bandId);
        const tags = normalizeTags(td.tags);
        updateReleaseTags(stub.id, tags);
        progress.processed++;
      } catch (err) {
        console.warn(`backfill failed for ${stub.id}:`, err);
        progress.errors++;
        // Write an empty tag set so we don't retry this release forever.
        // The release_tags table will have zero rows — next backfill skips it
        // because the LEFT JOIN check looks for NULL, not empty.
        // To handle this, mark it with a sentinel tag we can filter later.
        updateReleaseTags(stub.id, ["__backfill_failed"]);
      }
      progress.remaining--;
    }
  }

  progress.running = false;
}
