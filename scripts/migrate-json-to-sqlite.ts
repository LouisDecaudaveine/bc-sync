/**
 * One-shot migration: import an existing data/store.json into the new
 * SQLite database at data/store.sqlite.
 *
 * Run with:  npx tsx scripts/migrate-json-to-sqlite.ts
 *
 * Idempotent: re-running will upsert the same rows. The old JSON file is
 * left in place so you can fall back to it if needed.
 */
import fs from "node:fs";
import path from "node:path";
import { getDb, closeDb } from "../src/lib/db";
import { upsertBands, upsertReleases, setLastSync } from "../src/lib/store";
import type { Store } from "../src/lib/bandcamp/types";

const JSON_PATH = path.join(process.cwd(), "data", "store.json");

function main() {
  if (!fs.existsSync(JSON_PATH)) {
    console.error(`No JSON store found at ${JSON_PATH}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(JSON_PATH, "utf8");
  const store = JSON.parse(raw) as Store;

  // Touch the db once up front so the schema is created.
  getDb();

  const bands = Object.values(store.bands ?? {});
  const releases = Object.values(store.releases ?? {}).map((r) => ({
    ...r,
    tags: Array.isArray(r.tags) ? r.tags : [],
  }));

  console.log(`Importing ${bands.length} bands…`);
  upsertBands(bands);

  console.log(`Importing ${releases.length} releases…`);
  const added = upsertReleases(releases);

  if (store.lastSync) {
    console.log(`Importing last sync run from ${store.lastSync.startedAt}…`);
    setLastSync(store.lastSync);
  }

  console.log(`Done. ${added} new releases inserted.`);
  closeDb();
}

main();
