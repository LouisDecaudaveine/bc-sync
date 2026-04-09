import { getDb } from "@/lib/db";
import {
  fetchTralbumDetails,
  normalizeTags,
  parseReleaseDate,
} from "@/lib/bandcamp/client";
import { updateReleaseTags } from "@/lib/store";
import { type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST — re-fetch tralbum_details for a release and update its DB row.
 * Body: { releaseId: string }
 */
export async function POST(request: NextRequest) {
  const { releaseId } = (await request.json()) as { releaseId: string };

  const db = getDb();
  const release = db
    .prepare(
      `SELECT id, band_id, type FROM releases WHERE id = ?`,
    )
    .get(releaseId) as
    | { id: string; band_id: number; type: "album" | "track" }
    | undefined;

  if (!release) {
    return Response.json(
      { error: `Release "${releaseId}" not found` },
      { status: 404 },
    );
  }

  // Parse item_id from the release id format: "{type}-{item_id}"
  const itemId = Number(release.id.split("-").slice(1).join("-"));
  if (!Number.isFinite(itemId)) {
    return Response.json(
      { error: `Cannot parse item_id from "${release.id}"` },
      { status: 400 },
    );
  }

  const details = await fetchTralbumDetails(
    release.type,
    itemId,
    release.band_id,
  );

  // Update the release row
  const newUrl = details.bandcamp_url ?? null;
  const newDate = parseReleaseDate(details.release_date);
  const newTags = normalizeTags(details.tags);

  const updates: string[] = [];
  const params: Record<string, unknown> = { id: releaseId };

  if (newUrl) {
    updates.push("url = @url");
    params.url = newUrl;
  }
  if (newDate) {
    updates.push("release_date = @release_date");
    params.release_date = newDate;
  }
  if (details.title) {
    updates.push("title = @title");
    params.title = details.title;
  }

  if (updates.length > 0) {
    db.prepare(
      `UPDATE releases SET ${updates.join(", ")} WHERE id = @id`,
    ).run(params);
  }

  if (newTags.length > 0) {
    updateReleaseTags(releaseId, newTags);
  }

  return Response.json({
    ok: true,
    updated: {
      url: newUrl,
      releaseDate: newDate,
      title: details.title ?? null,
      tags: newTags,
    },
  });
}
