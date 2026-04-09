import {
  getEarliestReleaseDate,
  getReleasesByMonth,
  getUpcomingReleases,
} from "@/lib/queries";
import { getLastSync } from "@/lib/store";
import { ReleaseCard } from "@/components/ReleaseCard";
import { MonthPagination } from "@/components/MonthPagination";

export const dynamic = "force-dynamic";

function parseMonth(raw: string | undefined): { year: number; month: number } | null {
  if (!raw) return null;
  const match = raw.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { year, month };
}

export default async function ReleasesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const lastSync = getLastSync();
  const isUpcoming = params.upcoming === "true";

  // Upcoming count is always needed for the nav button.
  const upcoming = getUpcomingReleases();

  if (isUpcoming) {
    if (upcoming.length === 0 && !lastSync) {
      return <EmptyState hasSync={false} />;
    }

    const now = new Date();
    return (
      <div className="space-y-8">
        <MonthPagination
          year={now.getFullYear()}
          month={now.getMonth() + 1}
          hasNewer={false}
          hasOlder={false}
          isUpcoming={true}
          upcomingCount={upcoming.length}
        />
        {upcoming.length === 0 ? (
          <p className="text-center py-24 text-neutral-400">
            No upcoming releases.
          </p>
        ) : (
          <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
            {upcoming.map((r) => (
              <ReleaseCard key={r.id} release={r} />
            ))}
          </ul>
        )}
      </div>
    );
  }

  // Monthly view — default to current month.
  const now = new Date();
  const parsed = parseMonth(
    typeof params.month === "string" ? params.month : undefined,
  );
  const year = parsed?.year ?? now.getFullYear();
  const month = parsed?.month ?? (now.getMonth() + 1);

  const releases = getReleasesByMonth(year, month);
  const earliest = getEarliestReleaseDate();

  // Determine if there are months beyond this one in either direction.
  const earliestDate = earliest ? new Date(earliest) : null;
  const hasOlder =
    !!earliestDate &&
    (year > earliestDate.getFullYear() ||
      (year === earliestDate.getFullYear() &&
        month > earliestDate.getMonth() + 1));

  const latestYear = now.getFullYear();
  const latestMonth = now.getMonth() + 1;
  const hasNewer = year < latestYear || (year === latestYear && month < latestMonth);

  if (releases.length === 0 && upcoming.length === 0 && !lastSync) {
    return <EmptyState hasSync={false} />;
  }

  return (
    <div className="space-y-8">
      <MonthPagination
        year={year}
        month={month}
        hasNewer={hasNewer}
        hasOlder={hasOlder}
        isUpcoming={false}
        upcomingCount={upcoming.length}
      />
      {releases.length === 0 ? (
        <p className="text-center py-24 text-neutral-400">
          No releases this month.
        </p>
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
          {releases.map((r) => (
            <ReleaseCard key={r.id} release={r} />
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyState({ hasSync }: { hasSync: boolean }) {
  return (
    <div className="text-center py-24 text-neutral-400">
      <p className="mb-2">No releases yet.</p>
      <p className="text-sm">
        {hasSync
          ? "Last sync produced no releases — check the server logs."
          : "Click Sync in the header to fetch your followed artists."}
      </p>
    </div>
  );
}
