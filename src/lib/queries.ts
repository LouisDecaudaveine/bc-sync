import { getDb } from "./db";
import { rowToRelease } from "./store";
import type { Band, Release } from "./bandcamp/types";

// All releases share this select shape — joined to bands for bandName, plus
// tags aggregated into a single \u0001-delimited string we split in rowToRelease.
const RELEASE_SELECT = `
  SELECT
    r.id, r.band_id, r.title, r.type, r.release_date, r.artwork_url, r.url,
    b.name AS band_name,
    (
      SELECT group_concat(t.tag, char(1))
      FROM release_tags t
      WHERE t.release_id = r.id
    ) AS tags
  FROM releases r
  JOIN bands b ON b.id = r.band_id
`;

export function getReleasesChronological(limit = 200): Release[] {
  const rows = getDb()
    .prepare(
      `${RELEASE_SELECT}
       WHERE r.release_date IS NOT NULL
       ORDER BY r.release_date DESC
       LIMIT ?`,
    )
    .all(limit) as Parameters<typeof rowToRelease>[0][];
  return rows.map(rowToRelease);
}

export function getSplitReleases(
  limit = 200,
): { upcoming: Release[]; released: Release[] } {
  const db = getDb();
  const nowIso = new Date().toISOString();

  const upcomingRows = db
    .prepare(
      `${RELEASE_SELECT}
       WHERE r.release_date IS NOT NULL
         AND r.release_date > ?
       ORDER BY r.release_date ASC`,
    )
    .all(nowIso) as Parameters<typeof rowToRelease>[0][];

  const releasedRows = db
    .prepare(
      `${RELEASE_SELECT}
       WHERE r.release_date IS NOT NULL
         AND r.release_date <= ?
       ORDER BY r.release_date DESC
       LIMIT ?`,
    )
    .all(nowIso, limit) as Parameters<typeof rowToRelease>[0][];

  return {
    upcoming: upcomingRows.map(rowToRelease),
    released: releasedRows.map(rowToRelease),
  };
}

/**
 * Releases whose release_date falls within a given month.
 * `from` is inclusive, `to` is exclusive (first day of the next month).
 */
export function getReleasesByMonth(
  year: number,
  month: number,
  /** Optional upper bound (exclusive). Pass `new Date().toISOString()` to exclude upcoming releases. */
  before?: string,
): Release[] {
  const from = `${year}-${String(month).padStart(2, "0")}-01T00:00:00.000Z`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const endOfMonth = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00.000Z`;
  const to = before && before < endOfMonth ? before : endOfMonth;

  const rows = getDb()
    .prepare(
      `${RELEASE_SELECT}
       WHERE r.release_date IS NOT NULL
         AND r.release_date >= ?
         AND r.release_date < ?
       ORDER BY r.release_date DESC`,
    )
    .all(from, to) as Parameters<typeof rowToRelease>[0][];
  return rows.map(rowToRelease);
}

/** All releases with a future release_date, soonest first. */
export function getUpcomingReleases(): Release[] {
  const nowIso = new Date().toISOString();
  const rows = getDb()
    .prepare(
      `${RELEASE_SELECT}
       WHERE r.release_date IS NOT NULL
         AND r.release_date > ?
       ORDER BY r.release_date ASC`,
    )
    .all(nowIso) as Parameters<typeof rowToRelease>[0][];
  return rows.map(rowToRelease);
}

/**
 * Returns the ISO date string of the earliest release in the database,
 * used to stop backward pagination before the first release.
 */
export function getEarliestReleaseDate(): string | null {
  const row = getDb()
    .prepare(
      `SELECT MIN(release_date) AS d FROM releases WHERE release_date IS NOT NULL`,
    )
    .get() as { d: string | null } | undefined;
  return row?.d ?? null;
}

export interface ArtistWithLatest extends Band {
  latestReleaseAt: string | null;
  releaseCount: number;
}

export function getArtistsByLatestRelease(): ArtistWithLatest[] {
  const rows = getDb()
    .prepare(
      `SELECT
         b.id, b.name, b.url, b.image_url AS imageUrl, b.location,
         MAX(r.release_date) AS latestReleaseAt,
         COUNT(r.id)         AS releaseCount
       FROM bands b
       LEFT JOIN releases r ON r.band_id = b.id
       GROUP BY b.id
       ORDER BY latestReleaseAt DESC NULLS LAST`,
    )
    .all() as ArtistWithLatest[];
  return rows;
}

export function getArtist(
  bandId: number,
): { band: Band | null; releases: Release[] } {
  const db = getDb();
  const band = db
    .prepare(
      `SELECT id, name, url, image_url AS imageUrl, location
       FROM bands WHERE id = ?`,
    )
    .get(bandId) as Band | undefined;

  if (!band) return { band: null, releases: [] };

  const rows = db
    .prepare(
      `${RELEASE_SELECT}
       WHERE r.band_id = ?
       ORDER BY r.release_date DESC NULLS LAST`,
    )
    .all(bandId) as Parameters<typeof rowToRelease>[0][];

  return { band, releases: rows.map(rowToRelease) };
}
