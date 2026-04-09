"use client";

import { useQuery } from "@tanstack/react-query";
import type { Release } from "@/lib/bandcamp/types";
import { ReleaseCard } from "@/components/ReleaseCard";
import { MonthPagination } from "@/components/MonthPagination";

interface ReleasesResponse {
  releases: Release[];
  upcoming: Release[];
  year: number;
  month: number;
  hasOlder: boolean;
  hasNewer: boolean;
  lastSync: unknown;
}

interface UpcomingResponse {
  upcoming: Release[];
  lastSync: unknown;
}

export function ReleasesView({
  monthParam,
  isUpcoming,
}: {
  monthParam: string | undefined;
  isUpcoming: boolean;
}) {
  if (isUpcoming) {
    return <UpcomingView />;
  }
  return <MonthlyView monthParam={monthParam} />;
}

function UpcomingView() {
  const { data, isLoading } = useQuery<UpcomingResponse>({
    queryKey: ["releases", "upcoming"],
    queryFn: () =>
      fetch("/api/releases?upcoming=true").then((r) => r.json()),
  });

  if (isLoading || !data) {
    return <LoadingState />;
  }

  const { upcoming, lastSync } = data;

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

function MonthlyView({ monthParam }: { monthParam: string | undefined }) {
  const { data, isLoading } = useQuery<ReleasesResponse>({
    queryKey: ["releases", "month", monthParam ?? "current"],
    queryFn: () => {
      const params = new URLSearchParams();
      if (monthParam) params.set("month", monthParam);
      return fetch(`/api/releases?${params}`).then((r) => r.json());
    },
  });

  if (isLoading || !data) {
    return <LoadingState />;
  }

  const { releases, upcoming, year, month, hasOlder, hasNewer, lastSync } =
    data;

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

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-24 text-neutral-500">
      Loading releases…
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
