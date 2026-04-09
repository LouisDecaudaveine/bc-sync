# Storage layer

This project stores all band/release data in a local SQLite database, accessed
via [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3). Everything
runs in-process — there is no separate database server to start.

## Why SQLite

- **Embedded** — the entire database is one file at `data/store.sqlite`. No
  daemon, no port, no credentials.
- **Fast at our scale** — indexed lookups over tens of thousands of rows
  return in microseconds. The previous JSON store loaded the entire dataset
  into memory on every page render, which would have collapsed at the
  500–3000 artist / 15k–90k release scale we're targeting.
- **Synchronous API** — `better-sqlite3` is synchronous, which is actually
  simpler than juggling promises for a local file. Inside Next.js Server
  Components and Route Handlers (Node runtime) this is fine.
- **Portable** — the schema is plain SQL. If we ever host this remotely we
  can port to MySQL or Postgres with mostly mechanical changes.

`better-sqlite3` is on Next.js's auto-externalized package list (see
`node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/serverExternalPackages.md`),
so no `next.config` changes are needed for it to load as a native module.

## File layout

```
data/
  store.sqlite        ← the database (gitignored)
  store.sqlite-wal    ← write-ahead log (auto-managed)
  store.sqlite-shm    ← shared-memory file (auto-managed)
  store.json          ← legacy JSON store, kept for fallback after migration
src/lib/
  db.ts               ← connection singleton + schema bootstrap
  store.ts            ← write-side helpers (upserts, sync runs)
  queries.ts          ← read-side helpers (used by pages)
  sync.ts             ← bandcamp sync job — calls store.ts
scripts/
  migrate-json-to-sqlite.ts   ← one-shot import of existing JSON store
```

## Schema

Defined in `src/lib/db.ts` and created automatically the first time `getDb()`
is called.

### `bands`
| column      | type    | notes                            |
|-------------|---------|----------------------------------|
| `id`        | INTEGER | primary key (Bandcamp band id)   |
| `name`      | TEXT    | not null                         |
| `url`       | TEXT    | not null                         |
| `image_url` | TEXT    | nullable                         |
| `location`  | TEXT    | nullable                         |

### `releases`
| column         | type    | notes                                              |
|----------------|---------|----------------------------------------------------|
| `id`           | TEXT    | primary key, format `"a-12345"` / `"t-67890"`      |
| `band_id`      | INTEGER | foreign key → `bands.id`, ON DELETE CASCADE        |
| `title`        | TEXT    | not null                                           |
| `type`         | TEXT    | `'album'` or `'track'` (CHECK constraint)          |
| `release_date` | TEXT    | ISO 8601 string, nullable                          |
| `artwork_url`  | TEXT    | nullable                                           |
| `url`          | TEXT    | not null                                           |

Note that `band_name` is **not** stored on the release row — it's joined
in from `bands` at query time. The `Release` TypeScript type still exposes
`bandName` for the UI; it's populated by `rowToRelease()` in `store.ts`.

Indexes:
- `idx_releases_date` — `release_date DESC`. Powers chronological listings.
- `idx_releases_band` — `band_id`. Powers per-artist queries.
- `idx_releases_band_date` — `(band_id, release_date DESC)`. Powers
  "latest release per band" rollups.

### `release_tags`
| column       | type | notes                                            |
|--------------|------|--------------------------------------------------|
| `release_id` | TEXT | foreign key → `releases.id`, ON DELETE CASCADE   |
| `tag`        | TEXT | not null                                         |

Composite primary key `(release_id, tag)`. Index on `tag` for future
filter-by-tag queries.

### `sync_runs`
| column           | type    | notes                       |
|------------------|---------|-----------------------------|
| `id`             | INTEGER | autoincrement primary key   |
| `started_at`     | TEXT    | ISO 8601                    |
| `finished_at`    | TEXT    | nullable                    |
| `bands_synced`   | INTEGER | default 0                   |
| `releases_added` | INTEGER | default 0                   |
| `error`          | TEXT    | nullable                    |

Each sync run is appended as a new row. `getLastSync()` returns the most
recent one (`ORDER BY id DESC LIMIT 1`).

## Connection lifecycle

`src/lib/db.ts` exports `getDb()`, which returns a lazily-initialized
singleton `Database` instance. On first call it:

1. Creates `data/` if missing.
2. Opens `data/store.sqlite`.
3. Sets pragmas:
   - `journal_mode = WAL` — write-ahead logging. Lets readers run concurrently
     with a writer, which matters because pages query the DB while a sync
     is in progress in the background.
   - `synchronous = NORMAL` — fast and still crash-safe under WAL.
   - `foreign_keys = ON` — SQLite has FKs off by default; this enables them.
4. Runs the schema DDL (all `CREATE TABLE IF NOT EXISTS`, so it's idempotent).

The connection is held for the lifetime of the Node process. Next.js dev mode
hot-reloads modules, so you may see multiple instances during development;
that's harmless because SQLite supports multiple connections to the same file.

## Reading data: `src/lib/queries.ts`

All read-side functions are synchronous (no `async`). The pages still `await`
some of them, which is harmless — `await` on a non-promise just unwraps
to the value.

| function                       | SQL shape                                                              |
|--------------------------------|------------------------------------------------------------------------|
| `getReleasesChronological(n)`  | `ORDER BY release_date DESC LIMIT n` — uses `idx_releases_date`        |
| `getSplitReleases(n)`          | Two queries: `release_date > now ASC` and `release_date <= now DESC LIMIT n` |
| `getArtistsByLatestRelease()`  | `LEFT JOIN releases` + `GROUP BY band` + `MAX(release_date)`           |
| `getArtist(id)`                | One band lookup + all releases for that band                           |

All four use a shared `RELEASE_SELECT` snippet that joins `bands` for
`band_name` and aggregates `release_tags` into a single delimited string
via `group_concat(tag, char(1))`. `rowToRelease()` in `store.ts` splits the
string back into a `string[]`. We use `\u0001` (start-of-heading) as the
delimiter because it can't appear in a real tag.

## Writing data: `src/lib/store.ts`

All writes go through prepared statements created lazily on first use.
Batch operations are wrapped in transactions for speed and atomicity.

| function                     | what it does                                                       |
|------------------------------|--------------------------------------------------------------------|
| `upsertBand(band)`           | Single-row upsert (`INSERT … ON CONFLICT DO UPDATE`)               |
| `upsertBands(bands[])`       | Same, batched in a transaction                                     |
| `upsertReleases(releases[])` | Upserts releases + replaces their tag rows. Returns # newly added. |
| `getExistingReleaseHints(ids)` | Bulk SELECT used by sync to skip per-release URL fetches         |
| `setLastSync(run)`           | Appends a row to `sync_runs`                                       |
| `getLastSync()`              | Returns the most recent sync run                                   |
| `isStale(run, minutes)`      | Pure helper, unchanged from before                                 |
| `rowToRelease(row)`          | Maps a joined SQL row → `Release` (used by `queries.ts`)           |

### Why prepared statements

`db.prepare(...)` compiles a SQL string once and returns a reusable statement.
Reusing it across many `.run()` calls is significantly faster than re-parsing
each time, and it provides parameter binding (no SQL injection).

### Why transactions

`db.transaction(fn)` returns a wrapped function that runs `fn` inside
`BEGIN`/`COMMIT`. If `fn` throws, the transaction rolls back. For sync
this gives us two things:

1. **Speed.** A transaction batches fsyncs — inserting 200 releases inside
   a transaction is roughly 100× faster than 200 individual auto-commit
   inserts.
2. **Atomicity.** A crash mid-band can't leave the DB with half a release's
   tags missing.

## The sync flow

`src/lib/sync.ts` is the only writer. Per band, the loop now does:

1. `upsertBand(band)` — single statement, write the band row.
2. Build a list of candidate release ids from the discography response.
3. `getExistingReleaseHints(ids)` — one batched SELECT to find which
   releases we already have URLs for. Hits `idx_releases` (PK lookup).
4. For each item in the discography, hydrate it into a `Release` object.
   If we already had a URL for it from step 3, skip the per-release HTTP
   call. (This is the same optimization as before, just driven by a SQL
   lookup instead of an in-memory map.)
5. `upsertReleases(hydrated)` — one transaction, all of the band's releases
   in one shot. Returns a count of newly-added rows so we can update sync
   progress.

After all bands are processed (or on error), `setLastSync(run)` appends a
row to `sync_runs`. There is no "flush after every band" anymore — each band
is its own atomic transaction, so a crash mid-sync simply leaves the
already-processed bands persisted and stops.

## Migrating from the old JSON store

Run once:

```bash
npm run migrate:sqlite
```

This reads `data/store.json`, creates `data/store.sqlite` if missing, and
upserts every band, release, and the last sync run into the new schema.
It's idempotent — re-running it just re-upserts the same rows.

The original `store.json` file is left in place. Once you're confident the
new store is working you can delete it (or keep it as a backup; it isn't
read by anything anymore).

## Operational notes

### Inspecting the database

The easiest way is the `sqlite3` CLI:

```bash
sqlite3 data/store.sqlite
sqlite> .tables
sqlite> .schema releases
sqlite> SELECT COUNT(*) FROM releases;
sqlite> SELECT b.name, COUNT(r.id) FROM bands b LEFT JOIN releases r ON r.band_id = b.id GROUP BY b.id ORDER BY 2 DESC LIMIT 10;
```

GUI options: [DB Browser for SQLite](https://sqlitebrowser.org/),
[TablePlus](https://tableplus.com/), or any JetBrains DataGrip-like tool.

### Backups

The DB is one file. Copying `data/store.sqlite` while the app is running is
**not safe** by itself because of the WAL — use one of:

```bash
sqlite3 data/store.sqlite ".backup data/store.backup.sqlite"
```

…or stop the app first and copy all three files (`.sqlite`, `.sqlite-wal`,
`.sqlite-shm`).

### Resetting the database

Delete `data/store.sqlite*` and restart the app (or run any function that
calls `getDb()`). The schema will be recreated empty on first access; then
re-run a sync.

### Concurrency

WAL mode allows any number of concurrent readers and one concurrent writer.
The current architecture has at most one writer at a time anyway (the sync
job is serialized via the in-memory `inflight` promise in `sync.ts`). Pages
read freely while a sync is running.

If you ever spawn a second writer process you may see `SQLITE_BUSY` errors.
The fix is either to serialize writes through one process or to set
`PRAGMA busy_timeout = 5000` so SQLite waits a few seconds before erroring.
We don't need this today.

## Future improvements

- **Tag filtering UI** — the `release_tags` table + `idx_tags_tag` index
  is already in place to support `WHERE tag = ?` queries.
- **Pagination** — page rendering is still `force-dynamic` and queries with
  fixed `LIMIT` clauses. At the upper end of the projected scale (90k
  releases) we may want keyset pagination instead of `LIMIT/OFFSET`.
- **Soft deletes** — currently a band that disappears from your follow
  list will linger in the DB. Adding a `last_seen_at` column on `bands` and
  pruning would handle that cleanly.
- **Schema migrations** — right now schema changes go in the `SCHEMA` DDL
  block in `db.ts`, which only handles additive `CREATE TABLE IF NOT EXISTS`
  changes. For column changes we'd want a migration system (a small `migrations/`
  folder + a `schema_version` table is usually sufficient).
