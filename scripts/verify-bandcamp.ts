/**
 * One-shot verification of the undocumented Bandcamp endpoints.
 *
 * Usage:
 *   npm run verify
 *
 * Reads BANDCAMP_IDENTITY_COOKIE and BANDCAMP_FAN_ID from .env.local.
 * Fetches the first page of followed bands, prints names, then fetches the
 * discography of the first band and prints its items. No writes.
 */
import { config } from "dotenv";
import {
  fetchBandDetails,
  fetchTralbumDetails,
} from "../src/lib/bandcamp/client";

config({ path: ".env.local" });

const BASE = "https://bandcamp.com";

async function rawFollowing(fanId: number, token: string) {
  const cookie = process.env.BANDCAMP_IDENTITY_COOKIE!;
  const res = await fetch(`${BASE}/api/fancollection/1/following_bands`, {
    method: "POST",
    headers: {
      cookie: `identity=${cookie}`,
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      accept: "application/json, text/javascript, */*; q=0.01",
      "content-type": "application/json",
    },
    body: JSON.stringify({ fan_id: fanId, older_than_token: token, count: 10 }),
  });
  console.log(`   status=${res.status}`);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    console.log(`   non-json body (first 400 chars):\n${text.slice(0, 400)}`);
    return null;
  }
}

async function main() {
  const fanId = Number(process.env.BANDCAMP_FAN_ID);
  if (!fanId) throw new Error("BANDCAMP_FAN_ID missing");
  console.log(`fan_id=${fanId}`);

  const now = Math.floor(Date.now() / 1000) + 3600;
  const t = `${now}::f::`;
  console.log(`\n→ following_bands token="${t}"`);
  const page = await rawFollowing(fanId, t);
  if (!page) return;
  const bands = page.followeers ?? [];
  console.log(`   ✓ ${bands.length} bands (more=${page.more_available})`);
  if (bands.length === 0) return;
  const first = bands[0];

  console.log(`\n→ band_details for ${first.name} (${first.band_id})`);
  const details = await fetchBandDetails(first.band_id);
  const disco = details.discography ?? [];
  console.log(`   ${disco.length} discography items`);
  if (disco.length === 0) return;
  console.log(`   item[0] keys: ${Object.keys(disco[0]).join(", ")}`);

  const item = disco[0];
  console.log(`\n→ tralbum_details for ${item.title}`);
  const td = await fetchTralbumDetails(item.item_type, item.item_id, first.band_id);
  console.log(`   bandcamp_url=${td.bandcamp_url}`);
  console.log(`   tags=${JSON.stringify(td.tags)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
