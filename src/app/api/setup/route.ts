import { NextResponse } from "next/server";
import { hasCredentials, saveCredentials } from "@/lib/credentials";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ configured: hasCredentials() });
}

/** Resolve a Bandcamp username to a numeric fan_id by scraping the public profile page. */
async function resolveFanId(username: string): Promise<number | null> {
  const res = await fetch(`https://bandcamp.com/${encodeURIComponent(username)}`, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    },
  });
  if (!res.ok) return null;

  const html = await res.text();
  // The profile page embeds a data-blob JSON attribute containing fan_data.fan_id.
  const match = html.match(/data-blob="([^"]+)"/);
  if (!match) return null;

  try {
    // The attribute value is HTML-entity-encoded JSON.
    const decoded = match[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&");
    const blob = JSON.parse(decoded);
    const fanId = blob?.fan_data?.fan_id;
    return typeof fanId === "number" ? fanId : null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const body = await req.json();
  const { cookie, username } = body as { cookie?: string; username?: string };

  if (!cookie || !username) {
    return NextResponse.json(
      { ok: false, error: "Both cookie and username are required." },
      { status: 400 },
    );
  }

  // Resolve username → fan_id
  const fanId = await resolveFanId(username.trim());
  if (!fanId) {
    return NextResponse.json(
      {
        ok: false,
        error: `Could not find a Bandcamp profile for "${username}". Check the spelling.`,
      },
      { status: 422 },
    );
  }

  // Validate credentials by making a test API call to Bandcamp.
  try {
    const res = await fetch(
      "https://bandcamp.com/api/fancollection/1/following_bands",
      {
        method: "POST",
        headers: {
          cookie: `identity=${cookie}`,
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          accept: "application/json, text/javascript, */*; q=0.01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          fan_id: fanId,
          older_than_token: `${Math.floor(Date.now() / 1000) + 3600}::f::`,
          count: 1,
        }),
      },
    );

    if (!res.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: `Bandcamp returned ${res.status}. Check that your cookie is correct and belongs to this account.`,
        },
        { status: 422 },
      );
    }
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: `Validation failed: ${(err as Error).message}` },
      { status: 500 },
    );
  }

  saveCredentials(cookie, fanId, username.trim());
  return NextResponse.json({ ok: true });
}
