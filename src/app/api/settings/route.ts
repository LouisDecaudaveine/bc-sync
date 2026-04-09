import { NextResponse } from "next/server";
import {
  getCredentials,
  getUsername,
  updateCookie,
} from "@/lib/credentials";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Return current account info (no secrets). */
export async function GET() {
  const creds = getCredentials();
  const username = getUsername();
  return NextResponse.json({
    configured: !!creds,
    username,
  });
}

/** PATCH: update cookie only. DELETE: wipe all data and credentials. */
export async function PATCH(req: Request) {
  const { cookie } = (await req.json()) as { cookie?: string };
  if (!cookie?.trim()) {
    return NextResponse.json(
      { ok: false, error: "Cookie is required." },
      { status: 400 },
    );
  }

  const creds = getCredentials();
  if (!creds) {
    return NextResponse.json(
      { ok: false, error: "No account configured. Use /setup first." },
      { status: 400 },
    );
  }

  // Validate the new cookie against the existing fan_id.
  try {
    const res = await fetch(
      "https://bandcamp.com/api/fancollection/1/following_bands",
      {
        method: "POST",
        headers: {
          cookie: `identity=${cookie.trim()}`,
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          accept: "application/json, text/javascript, */*; q=0.01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          fan_id: creds.fanId,
          older_than_token: `${Math.floor(Date.now() / 1000) + 3600}::f::`,
          count: 1,
        }),
      },
    );

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `Bandcamp returned ${res.status}. Is this cookie still valid?` },
        { status: 422 },
      );
    }
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: `Validation failed: ${(err as Error).message}` },
      { status: 500 },
    );
  }

  updateCookie(cookie.trim());
  return NextResponse.json({ ok: true });
}

/** Wipe all synced data and credentials so the user can start fresh. */
export async function DELETE() {
  const db = getDb();
  db.exec(`
    DELETE FROM release_tags;
    DELETE FROM releases;
    DELETE FROM bands;
    DELETE FROM sync_runs;
    DELETE FROM settings;
  `);
  return NextResponse.json({ ok: true });
}
