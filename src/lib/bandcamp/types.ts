export type BandId = number;

export interface Band {
  id: BandId;
  name: string;
  url: string;
  imageUrl: string | null;
  location: string | null;
}

export type ReleaseType = "album" | "track";

export interface Release {
  id: string; // `${type}-${item_id}`
  bandId: BandId;
  bandName: string;
  title: string;
  type: ReleaseType;
  releaseDate: string | null; // ISO
  artworkUrl: string | null;
  url: string;
  tags: string[];
}

export interface SyncRun {
  startedAt: string;
  finishedAt: string | null;
  bandsSynced: number;
  releasesAdded: number;
  error: string | null;
}

export interface Store {
  bands: Record<BandId, Band>;
  releases: Record<string, Release>;
  lastSync: SyncRun | null;
}
