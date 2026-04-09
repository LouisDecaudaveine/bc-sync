import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "store.sqlite");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS bands (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  url        TEXT NOT NULL,
  image_url  TEXT,
  location   TEXT
);

CREATE TABLE IF NOT EXISTS releases (
  id            TEXT PRIMARY KEY,
  band_id       INTEGER NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('album','track')),
  release_date  TEXT,
  artwork_url   TEXT,
  url           TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_releases_date      ON releases(release_date DESC);
CREATE INDEX IF NOT EXISTS idx_releases_band      ON releases(band_id);
CREATE INDEX IF NOT EXISTS idx_releases_band_date ON releases(band_id, release_date DESC);

CREATE TABLE IF NOT EXISTS release_tags (
  release_id  TEXT NOT NULL REFERENCES releases(id) ON DELETE CASCADE,
  tag         TEXT NOT NULL,
  PRIMARY KEY (release_id, tag)
);
CREATE INDEX IF NOT EXISTS idx_tags_tag ON release_tags(tag);

CREATE TABLE IF NOT EXISTS sync_runs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at      TEXT NOT NULL,
  finished_at     TEXT,
  bands_synced    INTEGER NOT NULL DEFAULT 0,
  releases_added  INTEGER NOT NULL DEFAULT 0,
  error           TEXT
);
`;

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  // WAL = concurrent readers during writes; NORMAL sync = fast + crash-safe.
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  migrate(db);
  _db = db;
  return db;
}

// ---------- Migrations ----------
// Each entry runs once. user_version tracks which have been applied.

const MIGRATIONS: string[] = [
  // v1: add last_synced_at to bands so sync can skip recently-synced artists
  `ALTER TABLE bands ADD COLUMN last_synced_at TEXT;`,
  // v2: key-value settings table for storing credentials etc.
  `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);`,
];

function migrate(db: Database.Database): void {
  const current = (db.pragma("user_version", { simple: true }) as number) ?? 0;
  if (current >= MIGRATIONS.length) return;
  const applyFrom = current;
  db.transaction(() => {
    for (let i = applyFrom; i < MIGRATIONS.length; i++) {
      db.exec(MIGRATIONS[i]);
    }
    db.pragma(`user_version = ${MIGRATIONS.length}`);
  })();
}

export function getSetting(key: string): string | undefined {
  const row = getDb()
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value;
}

export function setSetting(key: string, value: string): void {
  getDb()
    .prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)")
    .run(key, value);
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}
