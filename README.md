# bc sync

A local web app that syncs your followed Bandcamp artists and shows their releases in a browsable feed, organized by month.

![Releases page](public/assets/screenshots/releases-page.png)

## Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd bandcamp-feed
npm install
```

### 2. Create `.env.local`

Copy the example file and fill in your Bandcamp credentials:

```bash
cp .env.local.example .env.local
```

Then edit `.env.local`:

```env
# Required: your Bandcamp session cookie.
# Open bandcamp.com while logged in → DevTools → Application → Cookies → bandcamp.com
# Copy the value of the `identity` cookie.
BANDCAMP_IDENTITY_COOKIE=<your-identity-cookie>

# Required: your numeric Bandcamp fan ID.
# Visit your Bandcamp profile page → View Source → search for "fan_id".
BANDCAMP_FAN_ID=<your-fan-id>

# Optional: how many minutes before a band is considered stale (default: 360).
SYNC_STALE_MINUTES=360
```

### 3. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Initial sync

On first launch, navigate to the **Sync** page (link in the top-right corner of the nav bar, or go to `/sync`). The sync starts automatically and runs in two phases:

1. **Fetching followed artists** -- pulls all bands you follow from Bandcamp
2. **Fetching discographies** -- grabs the full release catalog for each artist (recently synced artists are skipped)

After the main sync completes, **tag backfill** runs in the background to fetch genre tags for each release.

![Sync page](public/assets/screenshots/sync-page.png)

The sync page shows real-time progress: bands processed, new releases found, and the current artist being synced.

## Features

### Browse releases by month

The main **Releases** page shows all releases from your followed artists for the current month. Use the month pagination at the top to navigate between months.

![Releases page](public/assets/screenshots/releases-page.png)

Each release card shows the artwork, title, artist, release date, and genre tags. Clicking a release opens it on Bandcamp.

### Upcoming releases

Click the **Upcoming** button in the top-right to see all future-dated releases sorted by date.

![Upcoming releases](public/assets/screenshots/upcoming-releases.png)

### Per-release refetch

When hovering over a release card, a small sync button appears in the top-right corner of the artwork. Clicking it re-fetches that specific release from Bandcamp, which is useful for:

- **Getting tags** if they weren't backfilled yet
- **Fixing the URL** if the wrong one was stored

![Refetch button](public/assets/screenshots/refetch-button.png)

### Artists

The **Artists** page lists all your followed artists, sorted by most recent release.

## Data storage

All data is stored locally in a SQLite database at `data/store.sqlite`, created automatically on first sync. No external database setup is needed.
