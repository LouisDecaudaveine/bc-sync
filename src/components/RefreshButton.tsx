import Link from "next/link";

export function RefreshButton() {
  return (
    <Link
      href="/sync"
      className="rounded border border-neutral-700 px-3 py-1.5 text-xs hover:bg-neutral-800"
    >
      Sync
    </Link>
  );
}
