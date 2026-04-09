import { ReleasesView } from "./client";

export default async function ReleasesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const isUpcoming = params.upcoming === "true";
  const monthParam =
    typeof params.month === "string" ? params.month : undefined;

  return <ReleasesView monthParam={monthParam} isUpcoming={isUpcoming} />;
}
