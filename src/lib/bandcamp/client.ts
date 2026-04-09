/**
 * Thin wrapper around Bandcamp's *undocumented* internal fan APIs.
 *
 * These endpoints are not part of the public Bandcamp developer API. They power
 * bandcamp.com itself and require a logged-in session cookie (`identity`).
 * They can break without notice.
 */

import Bottleneck from "bottleneck";
import { getCredentials } from "../credentials";

const BASE = "https://bandcamp.com";

function authHeaders(): HeadersInit {
  const creds = getCredentials();
  if (!creds) {
    throw new Error(
      "Bandcamp credentials not configured. Visit /setup to get started.",
    );
  }
  return {
    cookie: `identity=${creds.cookie}`,
    "user-agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    accept: "application/json, text/javascript, */*; q=0.01",
    "content-type": "application/json",
  };
}

// ---------- Rate limiter ----------
// Bottleneck serialises scheduling so we get controlled concurrency across all
// API calls. 3 concurrent requests with 400ms minimum spacing ≈ 7.5 req/s max,
// which is well within what other Bandcamp tools use successfully.

const limiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: 800,
});

// Separate, slower limiter for tag backfill — runs in the background and
// should never compete with main sync for rate-limit headroom.
export const backfillLimiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: 1500,
});

const MAX_RETRIES = 5;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(path: string, init: RequestInit): Promise<Response> {
  let attempt = 0;
  while (true) {
    const res = await fetch(`${BASE}${path}`, init);
    if (res.status !== 429 || attempt >= MAX_RETRIES) return res;

    // Honor Retry-After if Bandcamp sends one; otherwise exponential backoff.
    const retryAfter = res.headers.get("retry-after");
    let waitMs: number;
    if (retryAfter) {
      const n = Number(retryAfter);
      waitMs = Number.isFinite(n) ? n * 1000 : 5000;
    } else {
      waitMs = Math.min(60_000, 2_000 * 2 ** attempt); // 2s, 4s, 8s, 16s, 32s
    }
    console.warn(
      `bandcamp ${path} → 429, retrying in ${waitMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
    );
    await sleep(waitMs);
    attempt++;
  }
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  return limiter.schedule(async () => {
    const res = await fetchWithRetry(path, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`bandcamp ${path} → ${res.status} ${text.slice(0, 200)}`);
    }
    return (await res.json()) as T;
  });
}

async function getJson<T>(path: string): Promise<T> {
  return limiter.schedule(async () => {
    const res = await fetchWithRetry(path, {
      headers: authHeaders(),
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`bandcamp ${path} → ${res.status} ${text.slice(0, 200)}`);
    }
    return (await res.json()) as T;
  });
}

/** Post using the slow backfill limiter instead of the main one. */
export async function postJsonSlow<T>(path: string, body: unknown): Promise<T> {
  return backfillLimiter.schedule(async () => {
    const res = await fetchWithRetry(path, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`bandcamp ${path} → ${res.status} ${text.slice(0, 200)}`);
    }
    return (await res.json()) as T;
  });
}

// ---------- Followed bands ----------
// POST https://bandcamp.com/api/fancollection/1/following_bands
// body: { fan_id, older_than_token, count }
// older_than_token format: "<unix_seconds>:<band_id>:f::"  (use a far-future ts to start)

export interface FollowingBandsResponse {
  more_available: boolean;
  last_token: string;
  // Bandcamp's actual key (sic).
  followeers: RawFollowedBand[];
}

export interface RawFollowedBand {
  band_id: number;
  name: string;
  url_hints?: { subdomain?: string; custom_domain?: string | null };
  image_id?: number | null;
  location?: string | null;
  date_followed?: string;
}

export async function fetchFollowedBandsPage(
  fanId: number,
  olderThanToken: string,
  count = 100,
): Promise<FollowingBandsResponse> {
  return postJson<FollowingBandsResponse>(
    "/api/fancollection/1/following_bands",
    { fan_id: fanId, older_than_token: olderThanToken, count },
  );
}

// ---------- Band details (includes discography + release dates) ----------
// POST https://bandcamp.com/api/mobile/25/band_details
// body: { band_id }
// Returns the band info plus a discography array where each item already
// has release_date embedded, so we don't need a per-item tralbum lookup.

export interface RawDiscographyItem {
  item_type: "album" | "track" | "a" | "t";
  item_id: number;
  band_id?: number;
  title: string;
  art_id?: number | null;
  band_name?: string;
  release_date?: number | string | null; // unix seconds OR date string, observed both
  bandcamp_url?: string;
  url?: string;
}

export interface BandDetailsResponse {
  band_id: number;
  name?: string;
  bio?: string;
  discography?: RawDiscographyItem[];
  // some payloads nest under different keys; we'll surface unknowns for debugging
  [k: string]: unknown;
}

export async function fetchBandDetails(
  bandId: number,
): Promise<BandDetailsResponse> {
  return postJson<BandDetailsResponse>("/api/mobile/25/band_details", {
    band_id: bandId,
  });
}

export function normalizeItemType(t: RawDiscographyItem["item_type"]): "a" | "t" {
  return t === "album" || t === "a" ? "a" : "t";
}

export function parseReleaseDate(
  v: number | string | null | undefined,
): string | null {
  if (v == null) return null;
  if (typeof v === "number") return new Date(v * 1000).toISOString();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// ---------- Per-release details ----------
// POST https://bandcamp.com/api/mobile/25/tralbum_details
// body: { tralbum_type: "a"|"t", band_id, tralbum_id }
// Returns the page URL and tags (among many other fields).

export interface TralbumDetailsResponse {
  tralbum_id: number;
  tralbum_type: "a" | "t";
  title?: string;
  bandcamp_url?: string;
  tags?: ({ name: string; norm_name?: string; isloc?: boolean } | string)[];
  release_date?: number | string | null;
  [k: string]: unknown;
}

export async function fetchTralbumDetails(
  itemType: "album" | "track" | "a" | "t",
  itemId: number,
  bandId: number,
): Promise<TralbumDetailsResponse> {
  const t = normalizeItemType(itemType);
  return postJson<TralbumDetailsResponse>("/api/mobile/25/tralbum_details", {
    tralbum_type: t,
    band_id: bandId,
    tralbum_id: itemId,
  });
}

/** Same as fetchTralbumDetails but routed through the slow backfill limiter. */
export async function fetchTralbumDetailsSlow(
  itemType: "a" | "t",
  itemId: number,
  bandId: number,
): Promise<TralbumDetailsResponse> {
  return postJsonSlow<TralbumDetailsResponse>(
    "/api/mobile/25/tralbum_details",
    { tralbum_type: itemType, band_id: bandId, tralbum_id: itemId },
  );
}

export function normalizeTags(
  raw: TralbumDetailsResponse["tags"],
): string[] {
  if (!raw) return [];
  return raw
    .filter((t) => typeof t === "string" || !t.isloc) // skip location tags
    .map((t) => (typeof t === "string" ? t : t?.name))
    .filter((s): s is string => !!s);
}

// ---------- Helpers ----------
export function bandImageUrl(imageId: number | null | undefined): string | null {
  if (!imageId) return null;
  return `https://f4.bcbits.com/img/${imageId}_10.jpg`;
}

export function artworkUrl(artId: number | null | undefined): string | null {
  if (!artId) return null;
  return `https://f4.bcbits.com/img/a${artId}_10.jpg`;
}

export function bandUrlFromHints(
  hints: RawFollowedBand["url_hints"],
): string {
  if (!hints) return "";
  if (hints.custom_domain) return `https://${hints.custom_domain}`;
  if (hints.subdomain) return `https://${hints.subdomain}.bandcamp.com`;
  return "";
}
