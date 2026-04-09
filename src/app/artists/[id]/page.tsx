import Link from "next/link";
import { notFound } from "next/navigation";
import { getArtist } from "@/lib/queries";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ArtistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const bandId = Number(id);
  if (!Number.isFinite(bandId)) notFound();

  const { band, releases } = await getArtist(bandId);
  if (!band) notFound();

  return (
    <div>
      <Link href="/artists" className="text-xs text-neutral-400 hover:text-white">
        ← Artists
      </Link>
      <header className="mt-4 flex items-center gap-5">
        <div className="w-24 h-24 rounded bg-neutral-800 overflow-hidden flex-shrink-0">
          {band.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={band.imageUrl}
              alt={band.name}
              className="w-full h-full object-cover"
            />
          )}
        </div>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{band.name}</h1>
          {band.location && (
            <p className="text-sm text-neutral-400">{band.location}</p>
          )}
          {band.url && (
            <a
              href={band.url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-neutral-500 hover:text-white"
            >
              {band.url}
            </a>
          )}
        </div>
      </header>

      <h2 className="mt-10 mb-4 text-lg font-semibold">Discography</h2>
      <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
        {releases.map((r) => (
          <li key={r.id}>
            <a href={r.url} target="_blank" rel="noreferrer" className="group">
              <div className="aspect-square bg-neutral-800 rounded overflow-hidden">
                {r.artworkUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.artworkUrl}
                    alt={r.title}
                    className="w-full h-full object-cover group-hover:opacity-90"
                  />
                )}
              </div>
              <div className="mt-2 text-sm font-medium truncate">{r.title}</div>
              <div className="text-[11px] text-neutral-500">
                {formatDate(r.releaseDate)} · {r.type}
              </div>
            </a>
            {r.tags.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {r.tags.slice(0, 4).map((tag) => (
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
        ))}
      </ul>
    </div>
  );
}
