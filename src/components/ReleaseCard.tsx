import Link from "next/link";
import type { Release } from "@/lib/bandcamp/types";
import { formatDate } from "@/lib/format";
import { LazyImage } from "./LazyImage";
import { RefetchReleaseButton } from "./RefetchReleaseButton";

export function ReleaseCard({ release: r }: { release: Release }) {
  return (
    <li>
      <a
        href={r.url}
        target="_blank"
        rel="noreferrer"
        className="group block"
      >
        <div className="aspect-square bg-neutral-800 rounded overflow-hidden relative">
          <RefetchReleaseButton releaseId={r.id} />
          {r.artworkUrl ? (
            <LazyImage
              src={r.artworkUrl}
              alt={r.title}
              className="absolute inset-0 group-hover:opacity-90"
            />
          ) : (
            <div className="absolute inset-0 bg-neutral-800" />
          )}
        </div>
        <div className="mt-2 text-sm font-medium truncate group-hover:text-white">
          {r.title}
        </div>
      </a>
      <Link
        href={`/artists/${r.bandId}`}
        className="block text-xs text-neutral-400 truncate hover:text-white"
      >
        {r.bandName}
      </Link>
      <div className="text-[11px] text-neutral-500">
        {formatDate(r.releaseDate)}
      </div>
      {r.tags.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {r.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </li>
  );
}
