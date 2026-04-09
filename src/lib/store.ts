import { getDb } from "./db";
import type { Band, Release, SyncRun } from "./bandcamp/types";

// ---------- bands ----------

const upsertBandStmt = () =>
  getDb().prepare(`
    INSERT INTO bands (id, name, url, image_url, location)
    VALUES (@id, @name, @url, @imageUrl, @location)
    ON CONFLICT(id) DO UPDATE SET
      name      = excluded.name,
      url       = excluded.url,
      image_url = excluded.image_url,
      location  = excluded.location
  `);

export function upsertBand(band: Band): void {
  upsertBandStmt().run(band);
}

export function upsertBands(bands: Band[]): void {
  const stmt = upsertBandStmt();
  const tx = getDb().transaction((rows: Band[]) => {
    for (const b of rows) stmt.run(b);
  });
  tx(bands);
}

// ---------- releases ----------

interface ReleaseRow {
  id: string;
  band_id: number;
  title: string;
  type: "album" | "track";
  release_date: string | null;
  artwork_url: string | null;
  url: string;
}

const upsertReleaseStmt = () =>
  getDb().prepare(`
    INSERT INTO releases (id, band_id, title, type, release_date, artwork_url, url)
    VALUES (@id, @band_id, @title, @type, @release_date, @artwork_url, @url)
    ON CONFLICT(id) DO UPDATE SET
      band_id      = excluded.band_id,
      title        = excluded.title,
      type         = excluded.type,
      release_date = excluded.release_date,
      artwork_url  = excluded.artwork_url,
      url          = excluded.url
  `);

const deleteTagsStmt = () =>
  getDb().prepare(`DELETE FROM release_tags WHERE release_id = ?`);

const insertTagStmt = () =>
  getDb().prepare(
    `INSERT OR IGNORE INTO release_tags (release_id, tag) VALUES (?, ?)`,
  );

const releaseExistsStmt = () =>
  getDb().prepare(`SELECT 1 FROM releases WHERE id = ?`);

/**
 * Upsert a batch of releases inside a single transaction. Returns the number
 * of rows that did not previously exist (i.e. newly added).
 */
export function upsertReleases(releases: Release[]): number {
  if (releases.length === 0) return 0;
  const db = getDb();
  const exists = releaseExistsStmt();
  const upsert = upsertReleaseStmt();
  const delTags = deleteTagsStmt();
  const insTag = insertTagStmt();

  let added = 0;
  const tx = db.transaction((rows: Release[]) => {
    for (const r of rows) {
      const had = exists.get(r.id);
      if (!had) added++;
      upsert.run({
        id: r.id,
        band_id: r.bandId,
        title: r.title,
        type: r.type,
        release_date: r.releaseDate,
        artwork_url: r.artworkUrl,
        url: r.url,
      });
      delTags.run(r.id);
      for (const tag of r.tags) insTag.run(r.id, tag);
    }
  });
  tx(releases);
  return added;
}

/**
 * Look up the existing URL + tags for a set of release ids in one query.
 * Used by sync to skip per-release lookups for releases we already have.
 */
export function getExistingReleaseHints(
  ids: string[],
): Map<string, { url: string; tags: string[] }> {
  const out = new Map<string, { url: string; tags: string[] }>();
  if (ids.length === 0) return out;
  const db = getDb();
  // SQLite has a parameter limit (~32k); 1000 is comfortably safe.
  const CHUNK = 1000;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK);
    const placeholders = slice.map(() => "?").join(",");
    const rows = db
      .prepare(
        `SELECT id, url FROM releases WHERE id IN (${placeholders})`,
      )
      .all(...slice) as { id: string; url: string }[];
    for (const r of rows) out.set(r.id, { url: r.url, tags: [] });

    if (rows.length > 0) {
      const idList = rows.map((r) => r.id);
      const tagPh = idList.map(() => "?").join(",");
      const tagRows = db
        .prepare(
          `SELECT release_id, tag FROM release_tags WHERE release_id IN (${tagPh})`,
        )
        .all(...idList) as { release_id: string; tag: string }[];
      for (const t of tagRows) {
        const cur = out.get(t.release_id);
        if (cur) cur.tags.push(t.tag);
      }
    }
  }
  return out;
}

// ---------- sync runs ----------

export function setLastSync(run: SyncRun): void {
  getDb()
    .prepare(
      `INSERT INTO sync_runs (started_at, finished_at, bands_synced, releases_added, error)
       VALUES (@startedAt, @finishedAt, @bandsSynced, @releasesAdded, @error)`,
    )
    .run(run);
}

export function getLastSync(): SyncRun | null {
  const row = getDb()
    .prepare(
      `SELECT started_at AS startedAt,
              finished_at AS finishedAt,
              bands_synced AS bandsSynced,
              releases_added AS releasesAdded,
              error
       FROM sync_runs
       ORDER BY id DESC
       LIMIT 1`,
    )
    .get() as SyncRun | undefined;
  return row ?? null;
}

// ---------- band sync tracking ----------

/** Mark a band as synced right now. */
export function markBandSynced(bandId: number): void {
  getDb()
    .prepare(`UPDATE bands SET last_synced_at = ? WHERE id = ?`)
    .run(new Date().toISOString(), bandId);
}

/**
 * Return band ids that were synced within the last `withinHours` hours.
 * Used to skip bands during incremental sync.
 */
export function getRecentlySyncedBandIds(withinHours: number): Set<number> {
  const cutoff = new Date(
    Date.now() - withinHours * 60 * 60 * 1000,
  ).toISOString();
  const rows = getDb()
    .prepare(
      `SELECT id FROM bands WHERE last_synced_at IS NOT NULL AND last_synced_at > ?`,
    )
    .all(cutoff) as { id: number }[];
  return new Set(rows.map((r) => r.id));
}

// ---------- tag backfill ----------

export interface ReleaseStub {
  id: string;
  type: "album" | "track";
  bandId: number;
}

/** Releases that have zero tags — candidates for backfill. */
export function getReleasesWithoutTags(limit = 100): ReleaseStub[] {
  return getDb()
    .prepare(
      `SELECT r.id, r.type, r.band_id AS bandId
       FROM releases r
       LEFT JOIN release_tags t ON t.release_id = r.id
       WHERE t.release_id IS NULL
       LIMIT ?`,
    )
    .all(limit) as ReleaseStub[];
}

/** Write tags for a single release (used by backfill). */
export function updateReleaseTags(releaseId: string, tags: string[]): void {
  const db = getDb();
  const del = db.prepare(`DELETE FROM release_tags WHERE release_id = ?`);
  const ins = db.prepare(
    `INSERT OR IGNORE INTO release_tags (release_id, tag) VALUES (?, ?)`,
  );
  db.transaction(() => {
    del.run(releaseId);
    for (const tag of tags) ins.run(releaseId, tag);
  })();
}

// ---------- helpers ----------

export function isStale(lastSync: SyncRun | null, staleMinutes: number): boolean {
  if (!lastSync?.finishedAt) return true;
  const ageMs = Date.now() - new Date(lastSync.finishedAt).getTime();
  return ageMs > staleMinutes * 60_000;
}

// Helper used by queries.ts to map joined rows back into the public Release shape.
export function rowToRelease(
  row: ReleaseRow & { band_name: string; tags: string | null },
): Release {
  return {
    id: row.id,
    bandId: row.band_id,
    bandName: row.band_name,
    title: row.title,
    type: row.type,
    releaseDate: row.release_date,
    artworkUrl: row.artwork_url,
    url: row.url,
    tags: row.tags ? row.tags.split("\u0001") : [],
  };
}
