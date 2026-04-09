import { getSetting, setSetting } from "./db";

export interface Credentials {
  cookie: string;
  fanId: number;
}

/** Read credentials from DB first, then fall back to process.env. */
export function getCredentials(): Credentials | null {
  const dbCookie = getSetting("bandcamp_identity_cookie");
  const dbFanId = getSetting("bandcamp_fan_id");

  if (dbCookie && dbFanId) {
    const fanId = Number(dbFanId);
    if (Number.isFinite(fanId)) return { cookie: dbCookie, fanId };
  }

  const envCookie = process.env.BANDCAMP_IDENTITY_COOKIE;
  const envFanId = process.env.BANDCAMP_FAN_ID;

  if (envCookie && envFanId) {
    const fanId = Number(envFanId);
    if (Number.isFinite(fanId)) return { cookie: envCookie, fanId };
  }

  return null;
}

export function hasCredentials(): boolean {
  return getCredentials() !== null;
}

export function getUsername(): string | null {
  return getSetting("bandcamp_username") ?? null;
}

export function saveCredentials(
  cookie: string,
  fanId: number,
  username: string,
): void {
  setSetting("bandcamp_identity_cookie", cookie);
  setSetting("bandcamp_fan_id", String(fanId));
  setSetting("bandcamp_username", username);
}

export function updateCookie(cookie: string): void {
  setSetting("bandcamp_identity_cookie", cookie);
}
