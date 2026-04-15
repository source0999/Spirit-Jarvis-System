import { promises as fs } from "node:fs";
import path from "node:path";
import { google } from "googleapis";

const SECRET_PATH = path.join(process.cwd(), "client_secret.json");
const TOKEN_PATH = path.join(process.cwd(), ".data", "youtube-tokens.json");

/** Must match an authorized redirect in Google Cloud Console. */
const FALLBACK_OAUTH_REDIRECT_URI = "http://localhost:3000/api/sonic-auth";

function isDisallowedRedirectUrl(candidate: string): boolean {
  try {
    const u = new URL(candidate);
    const h = u.hostname.toLowerCase();
    // Dev servers bound to 0.0.0.0 must not become Google redirect_uri (invalid / mismatched).
    if (h === "0.0.0.0") return true;
    return false;
  } catch {
    return true;
  }
}

/**
 * Hard-coded OAuth redirect guard: `GOOGLE_REDIRECT_URI` or localhost callback only.
 * Never derived from `request.nextUrl.origin` (avoids 0.0.0.0 / dynamic host bugs).
 */
export const REDIRECT_URI = (() => {
  const candidate = (process.env.GOOGLE_REDIRECT_URI?.trim() || FALLBACK_OAUTH_REDIRECT_URI).trim();
  if (isDisallowedRedirectUrl(candidate)) return FALLBACK_OAUTH_REDIRECT_URI;
  return candidate;
})();

type InstalledClient = {
  client_id: string;
  client_secret: string;
  auth_uri: string;
  token_uri: string;
  redirect_uris?: string[];
};

type SecretPayload = {
  web?: InstalledClient;
  installed?: InstalledClient;
};

type StoredTokens = {
  access_token?: string | null;
  refresh_token?: string | null;
  scope?: string | null;
  token_type?: string | null;
  expiry_date?: number | null;
};

export const YOUTUBE_SCOPES = ["https://www.googleapis.com/auth/youtube.readonly"];

async function readClientSecret(): Promise<InstalledClient> {
  const raw = await fs.readFile(SECRET_PATH, "utf-8");
  const parsed = JSON.parse(raw) as SecretPayload;
  const creds = parsed.web ?? parsed.installed;
  if (!creds?.client_id || !creds?.client_secret) {
    throw new Error("Invalid client_secret.json payload.");
  }
  return creds;
}

export async function createOAuthClient(redirectUri: string) {
  const creds = await readClientSecret();
  return new google.auth.OAuth2(creds.client_id, creds.client_secret, redirectUri);
}

/** Same as {@link REDIRECT_URI}; kept for call sites that read a function. */
export function resolveOAuthRedirectUri(): string {
  return REDIRECT_URI;
}

/** Origin for post-auth redirects (e.g. `/?sonicAuth=ok`), aligned with the OAuth redirect host. */
export function resolveOAuthAppOrigin(): string {
  try {
    return new URL(REDIRECT_URI).origin;
  } catch {
    return "http://localhost:3000";
  }
}

export async function generateYouTubeAuthUrl() {
  const redirectUri = REDIRECT_URI;
  const oauth2Client = await createOAuthClient(redirectUri);
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: YOUTUBE_SCOPES,
    prompt: "consent",
  });
  return { authUrl, redirectUri };
}

export async function readStoredTokens(): Promise<StoredTokens | null> {
  try {
    const raw = await fs.readFile(TOKEN_PATH, "utf-8");
    return JSON.parse(raw) as StoredTokens;
  } catch {
    return null;
  }
}

export async function writeStoredTokens(tokens: StoredTokens) {
  await fs.mkdir(path.dirname(TOKEN_PATH), { recursive: true });
  await fs.writeFile(TOKEN_PATH, JSON.stringify(tokens, null, 2), "utf-8");
}

export async function getStoredOAuthClient(redirectUri: string) {
  const tokens = await readStoredTokens();
  if (!tokens) return null;
  const oauth2Client = await createOAuthClient(redirectUri);
  oauth2Client.setCredentials({
    access_token: tokens.access_token ?? undefined,
    refresh_token: tokens.refresh_token ?? undefined,
    scope: tokens.scope ?? undefined,
    token_type: tokens.token_type ?? undefined,
    expiry_date: tokens.expiry_date ?? undefined,
  });
  return oauth2Client;
}
