import {
  getEarliestReleaseDate,
  getReleasesByMonth,
  getUpcomingReleases,
} from "@/lib/queries";
import { getLastSync } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const isUpcoming = searchParams.get("upcoming") === "true";
  const monthParam = searchParams.get("month"); // "YYYY-MM"

  const lastSync = getLastSync();
  const upcoming = getUpcomingReleases();

  if (isUpcoming) {
    return Response.json({ upcoming, lastSync });
  }

  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 1;

  if (monthParam) {
    const match = monthParam.match(/^(\d{4})-(\d{2})$/);
    if (match) {
      year = Number(match[1]);
      month = Number(match[2]);
    }
  }

  const isCurrentMonth =
    year === now.getFullYear() && month === now.getMonth() + 1;
  const releases = getReleasesByMonth(
    year,
    month,
    isCurrentMonth ? now.toISOString() : undefined,
  );
  const earliest = getEarliestReleaseDate();

  const earliestDate = earliest ? new Date(earliest) : null;
  const hasOlder =
    !!earliestDate &&
    (year > earliestDate.getFullYear() ||
      (year === earliestDate.getFullYear() &&
        month > earliestDate.getMonth() + 1));

  const latestYear = now.getFullYear();
  const latestMonth = now.getMonth() + 1;
  const hasNewer =
    year < latestYear || (year === latestYear && month < latestMonth);

  return Response.json({
    releases,
    upcoming,
    year,
    month,
    hasOlder,
    hasNewer,
    lastSync,
  });
}
