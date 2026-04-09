import Link from "next/link";
import { getArtistsByLatestRelease } from "@/lib/queries";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ArtistsPage() {
  const artists = await getArtistsByLatestRelease();

  if (artists.length === 0) {
    return (
      <div className="text-center py-24 text-neutral-400">
        No artists yet — click Sync.
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Artists</h1>
      <ul className="divide-y divide-neutral-800 rounded border border-neutral-800">
        {artists.map((a) => (
          <li key={a.id}>
            <Link
              href={`/artists/${a.id}`}
              className="flex items-center gap-4 px-4 py-3 hover:bg-neutral-900"
            >
              <div className="w-12 h-12 rounded bg-neutral-800 overflow-hidden flex-shrink-0">
                {a.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.imageUrl}
                    alt={a.name}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{a.name}</div>
                <div className="text-xs text-neutral-500 truncate">
                  {a.location ?? ""}
                </div>
              </div>
              <div className="text-right text-xs text-neutral-400">
                <div>{formatDate(a.latestReleaseAt)}</div>
                <div className="text-neutral-600">
                  {a.releaseCount} release{a.releaseCount === 1 ? "" : "s"}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
