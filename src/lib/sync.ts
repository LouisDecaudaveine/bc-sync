import {
  artworkUrl,
  bandImageUrl,
  bandUrlFromHints,
  fetchBandDetails,
  fetchFollowedBandsPage,
  normalizeItemType,
  parseReleaseDate,
  type RawDiscographyItem,
  type RawFollowedBand,
} from "./bandcamp/client";
import type { Band, Release, SyncRun } from "./bandcamp/types";
import {
  getRecentlySyncedBandIds,
  markBandSynced,
  setLastSync,
  upsertBand,
  upsertReleases,
} from "./store";

const PAGE_SIZE = 100;

// Bands synced within this window are skipped on subsequent syncs.
const SKIP_IF_SYNCED_WITHIN_HOURS = 12;

export type SyncPhase = "idle" | "bands" | "discographies" | "done" | "error";

export interface SyncProgress {
  phase: SyncPhase;
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

const progress: SyncProgress = {
  phase: "idle",
  totalBands: 0,
  bandsDone: 0,
  bandsSkipped: 0,
  releasesAdded: 0,
  releasesProcessed: 0,
  currentBand: null,
  startedAt: null,
  finishedAt: null,
  error: null,
};

export function getSyncProgress(): SyncProgress {
  return { ...progress };
}

let inflight: Promise<SyncRun> | null = null;

export function runSync(): Promise<SyncRun> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      return await doSync();
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function isSyncRunning(): boolean {
  return inflight !== null;
}

async function doSync(): Promise<SyncRun> {
  const fanIdRaw = process.env.BANDCAMP_FAN_ID;
  if (!fanIdRaw) throw new Error("BANDCAMP_FAN_ID not set");
  const fanId = Number(fanIdRaw);

  const run: SyncRun = {
    startedAt: new Date().toISOString(),
    finishedAt: null,
    bandsSynced: 0,
    releasesAdded: 0,
    error: null,
  };

  progress.phase = "bands";
  progress.totalBands = 0;
  progress.bandsDone = 0;
  progress.bandsSkipped = 0;
  progress.releasesAdded = 0;
  progress.releasesProcessed = 0;
  progress.currentBand = null;
  progress.startedAt = run.startedAt;
  progress.finishedAt = null;
  progress.error = null;

  try {
    // 1. Fetch the full follow list (paginated, but few requests).
    const followed = await fetchAllFollowedBands(fanId);
    progress.totalBands = followed.length;
    progress.phase = "discographies";

    // 2. Figure out which bands we can skip (synced recently).
    const recentIds = getRecentlySyncedBandIds(SKIP_IF_SYNCED_WITHIN_HOURS);

    // 3. Process bands concurrently — Bottleneck in client.ts controls the
    //    actual request rate, so we can fire off promises freely here.
    const tasks = followed.map((raw) => syncOneBand(raw, recentIds, run));
    await Promise.all(tasks);
  } catch (err) {
    run.error = (err as Error).message;
    progress.error = run.error;
  } finally {
    run.finishedAt = new Date().toISOString();
    setLastSync(run);
    progress.phase = run.error ? "error" : "done";
    progress.finishedAt = run.finishedAt;
    progress.currentBand = null;
  }
  return run;
}

async function syncOneBand(
  raw: RawFollowedBand,
  recentIds: Set<number>,
  run: SyncRun,
): Promise<void> {
  const band: Band = {
    id: raw.band_id,
    name: raw.name,
    url: bandUrlFromHints(raw.url_hints),
    imageUrl: bandImageUrl(raw.image_id),
    location: raw.location ?? null,
  };

  // Always upsert band metadata (cheap, local write).
  upsertBand(band);

  // Skip the expensive band_details call if we synced this band recently.
  if (recentIds.has(band.id)) {
    progress.bandsSkipped++;
    progress.bandsDone++;
    run.bandsSynced++;
    return;
  }

  progress.currentBand = band.name;

  try {
    const details = await fetchBandDetails(raw.band_id);
    const items = Array.isArray(details.discography)
      ? details.discography
      : [];

    if (items.length === 0) {
      console.warn(
        `band_details: empty discography for ${raw.name} (keys: ${Object.keys(
          details,
        ).join(",")})`,
      );
    }

    const hydrated = items.map((item) => hydrateRelease(band, item));
    const added = upsertReleases(hydrated);

    run.releasesAdded += added;
    progress.releasesAdded += added;
    progress.releasesProcessed += hydrated.length;
  } catch (err) {
    console.warn(`band_details failed for ${raw.name}:`, err);
  }

  markBandSynced(band.id);
  run.bandsSynced++;
  progress.bandsDone++;
}

async function fetchAllFollowedBands(fanId: number): Promise<RawFollowedBand[]> {
  const out: RawFollowedBand[] = [];
  // far-future token to start from the most recently followed
  let token = `${Math.floor(Date.now() / 1000) + 3600}::f::`;
  for (let i = 0; i < 100; i++) {
    const page = await fetchFollowedBandsPage(fanId, token, PAGE_SIZE);
    out.push(...(page.followeers ?? []));
    if (!page.more_available || !page.last_token) break;
    token = page.last_token;
  }
  return out;
}

/**
 * Slugify a title into a Bandcamp URL path segment.
 * Bandcamp URLs follow: {bandUrl}/album/{slug} or {bandUrl}/track/{slug}
 * where the slug is the title lowercased, stripped to [a-z0-9], words joined
 * with hyphens, and leading/trailing hyphens removed.
 */
function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Build a Release from band_details discography data — no extra HTTP call.
 * Tags are left empty; they get backfilled separately.
 * URL is constructed from band URL + slugified title when not provided by the API.
 */
function hydrateRelease(band: Band, item: RawDiscographyItem): Release {
  const t = normalizeItemType(item.item_type);
  const id = `${t}-${item.item_id}`;
  const type = t === "a" ? "album" : "track";

  // Prefer the URL from the API if present; otherwise construct it.
  const url =
    item.bandcamp_url ||
    item.url ||
    (band.url ? `${band.url}/${type}/${slugify(item.title)}` : band.url);

  return {
    id,
    bandId: band.id,
    bandName: band.name,
    title: item.title,
    type,
    releaseDate: parseReleaseDate(item.release_date),
    artworkUrl: artworkUrl(item.art_id ?? null),
    url: url || band.url,
    tags: [],
  };
}
