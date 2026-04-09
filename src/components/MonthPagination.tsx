"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function monthLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

function prevMonth(year: number, month: number): { year: number; month: number } {
  return month === 1
    ? { year: year - 1, month: 12 }
    : { year, month: month - 1 };
}

function nextMonth(year: number, month: number): { year: number; month: number } {
  return month === 12
    ? { year: year + 1, month: 1 }
    : { year, month: month + 1 };
}

function monthParam(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function MonthPagination({
  year,
  month,
  hasNewer,
  hasOlder,
  isUpcoming,
  upcomingCount,
}: {
  year: number;
  month: number;
  hasNewer: boolean;
  hasOlder: boolean;
  isUpcoming: boolean;
  upcomingCount: number;
}) {
  const searchParams = useSearchParams();
  const prev = prevMonth(year, month);
  const next = nextMonth(year, month);

  const linkClass =
    "px-3 py-1.5 text-sm rounded border border-neutral-700 hover:bg-neutral-800 transition-colors";
  const disabledClass =
    "px-3 py-1.5 text-sm rounded border border-neutral-800 text-neutral-600 pointer-events-none";

  return (
    <nav className="flex items-center justify-between" aria-label="Release pagination">
      <div className="flex items-center gap-2">
        {isUpcoming ? (
          <Link href={`/releases`} className={linkClass}>
            Current month
          </Link>
        ) : (
          <>
            <Link
              href={hasOlder ? `/releases?month=${monthParam(prev.year, prev.month)}` : "#"}
              className={hasOlder ? linkClass : disabledClass}
              aria-disabled={!hasOlder}
            >
              <img src="/assets/icons/chevron-left.svg" alt="" className="inline w-4 h-4 mr-1 align-middle" />
              <span className="align-middle">{monthLabel(prev.year, prev.month)}</span>
            </Link>

            <span className="px-3 py-1.5 text-sm font-medium">
              {monthLabel(year, month)}
            </span>

            <Link
              href={hasNewer ? `/releases?month=${monthParam(next.year, next.month)}` : "#"}
              className={hasNewer ? linkClass : disabledClass}
              aria-disabled={!hasNewer}
            >
              <span className="align-middle">{monthLabel(next.year, next.month)}</span>
              <img src="/assets/icons/chevron-right.svg" alt="" className="inline w-4 h-4 ml-1 align-middle" />
            </Link>
          </>
        )}
      </div>

      {upcomingCount > 0 && (
        <Link
          href={isUpcoming ? "/releases" : "/releases?upcoming=true"}
          className={`${linkClass} ${isUpcoming ? "bg-neutral-800 text-white" : ""}`}
        >
          Upcoming ({upcomingCount})
        </Link>
      )}
    </nav>
  );
}
