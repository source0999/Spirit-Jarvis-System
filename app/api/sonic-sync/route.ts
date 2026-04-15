import { readSonicContext, SonicTrack, writeSonicContext } from "@/lib/sonic-context";
import {
  diffNewHistoryIds,
  incrementLedgerFromHistoryPlays,
  readSonicLedger,
  type RankedTrack,
} from "@/lib/sonic-ledger";
import { appendSonicSyncError } from "@/lib/sync-error-log";
import { getStoredOAuthClient, resolveOAuthRedirectUri } from "@/lib/youtube-auth";
import { google } from "googleapis";
import type { youtube_v3 } from "googleapis";
import { promises as fs } from "node:fs";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** YouTube video category "Music" */
const MUSIC_CATEGORY_ID = "10";
/** Drop Shorts and ultra-short clips */
const MIN_DURATION_SECONDS = 60;
/** Cap how many history rows we process per sync (API + ledger cost). */
const MAX_HISTORY_ITEMS = 200;
const RAW_DEBUG_PATH = path.join(process.cwd(), "data", "raw_debug.json");

type SyncBody = {
  topTracks?: SonicTrack[];
  loops?: SonicTrack[];
  source?: string;
};

type YouTubeSnippet = {
  title?: string | null;
  channelTitle?: string | null;
  categoryId?: string | null;
  thumbnails?: {
    maxres?: { url?: string };
    standard?: { url?: string };
    high?: { url?: string };
    medium?: { url?: string };
    default?: { url?: string };
  };
};

async function writeRawDebug(payload: unknown) {
  try {
    await fs.mkdir(path.dirname(RAW_DEBUG_PATH), { recursive: true });
    await fs.writeFile(RAW_DEBUG_PATH, JSON.stringify(payload, null, 2), "utf-8");
  } catch (e) {
    await appendSonicSyncError("writeRawDebug", e);
  }
}

function isoDurationToSeconds(iso?: string | null): number {
  if (!iso) return 0;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  const h = parseInt(m[1] || "0", 10);
  const min = parseInt(m[2] || "0", 10);
  const s = parseInt(m[3] || "0", 10);
  return h * 3600 + min * 60 + s;
}

function thumbs(sn?: YouTubeSnippet | null) {
  return (
    sn?.thumbnails?.maxres?.url ??
    sn?.thumbnails?.standard?.url ??
    sn?.thumbnails?.high?.url ??
    sn?.thumbnails?.medium?.url ??
    sn?.thumbnails?.default?.url
  );
}

/**
 * Music-like videos: category "10" (Music), or YouTube-marked licensed content
 * (common when uploaders omit the Music category).
 */
function isMusicLikeVideo(item: youtube_v3.Schema$Video | null | undefined): boolean {
  const sn = item?.snippet as YouTubeSnippet | undefined;
  if (!sn) return false;
  if (String(sn.categoryId ?? "") === MUSIC_CATEGORY_ID) return true;
  if (item?.contentDetails?.licensedContent === true) return true;
  return false;
}

/** Music / licensed long-form; excludes Shorts (&lt; 60s). */
function videoResourceToTrack(
  item: youtube_v3.Schema$Video | null | undefined,
): SonicTrack | null {
  const sn = item?.snippet as YouTubeSnippet | undefined;
  if (!sn?.title) return null;
  if (!isMusicLikeVideo(item)) return null;
  const sec = isoDurationToSeconds(item?.contentDetails?.duration ?? null);
  if (sec < MIN_DURATION_SECONDS) return null;
  return {
    title: sn.title,
    artist: sn.channelTitle ?? undefined,
    albumArtUrl: thumbs(sn),
  };
}

/** Any category long-form ≥ MIN_DURATION_SECONDS (Watch History fallback when Music filter is empty). */
function videoResourceToTrackLongFormAnyCategory(
  item: youtube_v3.Schema$Video | null | undefined,
): SonicTrack | null {
  const sn = item?.snippet as YouTubeSnippet | undefined;
  if (!sn?.title) return null;
  const sec = isoDurationToSeconds(item?.contentDetails?.duration ?? null);
  if (sec < MIN_DURATION_SECONDS) return null;
  return {
    title: sn.title,
    artist: sn.channelTitle ?? undefined,
    albumArtUrl: thumbs(sn),
  };
}

async function videoIdToTrackMap(
  youtube: youtube_v3.Youtube,
  ids: string[],
): Promise<Map<string, SonicTrack | null>> {
  const map = new Map<string, SonicTrack | null>();
  const unique = [...new Set(ids)];
  for (let i = 0; i < unique.length; i += 50) {
    const batch = unique.slice(i, i + 50);
    if (batch.length === 0) continue;
    const res = await youtube.videos.list({
      id: batch,
      part: ["snippet", "contentDetails"],
    });
    for (const id of batch) {
      map.set(id, null);
    }
    for (const item of res.data.items ?? []) {
      const id = item.id;
      if (!id) continue;
      map.set(id, videoResourceToTrack(item));
    }
  }
  return map;
}

async function videoIdToLongFormTrackMap(
  youtube: youtube_v3.Youtube,
  ids: string[],
): Promise<Map<string, SonicTrack | null>> {
  const map = new Map<string, SonicTrack | null>();
  const unique = [...new Set(ids)];
  for (let i = 0; i < unique.length; i += 50) {
    const batch = unique.slice(i, i + 50);
    if (batch.length === 0) continue;
    const res = await youtube.videos.list({
      id: batch,
      part: ["snippet", "contentDetails"],
    });
    for (const id of batch) {
      map.set(id, null);
    }
    for (const item of res.data.items ?? []) {
      const id = item.id;
      if (!id) continue;
      map.set(id, videoResourceToTrackLongFormAnyCategory(item));
    }
  }
  return map;
}

/**
 * Most recent Watch History rows (newest first) that resolve to long-form tracks, up to `limit`.
 */
async function takeRecentLongFormFromWatchHistory(
  youtube: youtube_v3.Youtube,
  orderedRawIds: string[],
  limit: number,
): Promise<SonicTrack[]> {
  const out: SonicTrack[] = [];
  for (let i = 0; i < orderedRawIds.length && out.length < limit; i += 50) {
    const chunk = orderedRawIds.slice(i, i + 50);
    const map = await videoIdToLongFormTrackMap(youtube, chunk);
    for (const id of chunk) {
      const t = map.get(id);
      if (t) {
        out.push(t);
        if (out.length >= limit) break;
      }
    }
  }
  return out;
}

/**
 * Watch History playlist (HL) or fallback to account activities.
 * Order is preserved, including duplicate video IDs (each row = one play).
 */
async function fetchHistoryVideoIdsOrdered(youtube: youtube_v3.Youtube): Promise<string[]> {
  const ids: string[] = [];
  try {
    let pageToken: string | undefined;
    do {
      const res = await youtube.playlistItems.list({
        playlistId: "HL",
        part: ["snippet"],
        maxResults: 50,
        pageToken,
      });
      for (const item of res.data.items ?? []) {
        const id = item.snippet?.resourceId?.videoId;
        if (typeof id === "string" && id.length > 0) {
          ids.push(id);
          if (ids.length >= MAX_HISTORY_ITEMS) break;
        }
      }
      pageToken = res.data.nextPageToken ?? undefined;
      if (ids.length >= MAX_HISTORY_ITEMS) break;
    } while (pageToken);
    return ids;
  } catch {
    let actToken: string | undefined;
    do {
      const activityRes = await youtube.activities.list({
        mine: true,
        part: ["contentDetails"],
        maxResults: 50,
        pageToken: actToken,
      });
      for (const act of activityRes.data.items ?? []) {
        const upload = act.contentDetails?.upload?.videoId;
        if (typeof upload === "string" && upload.length > 0) {
          ids.push(upload);
          if (ids.length >= MAX_HISTORY_ITEMS) break;
        }
      }
      actToken = activityRes.data.nextPageToken ?? undefined;
      if (ids.length >= MAX_HISTORY_ITEMS) break;
    } while (actToken);
    return ids;
  }
}

function mapIdsToMusicTracks(orderedIds: string[], idToTrack: Map<string, SonicTrack | null>): SonicTrack[] {
  const out: SonicTrack[] = [];
  for (const id of orderedIds) {
    const t = idToTrack.get(id);
    if (t) out.push(t);
  }
  return out;
}

function rankedRowsToSonicTracks(rows: RankedTrack[]): SonicTrack[] {
  return rows.slice(0, 10).map((row) => ({
    title: row.songTitle,
    artist: row.artistName,
    albumArtUrl: row.albumArtUrl,
  }));
}

function buildLoopsFromRecent(recentTracks: SonicTrack[]) {
  const counts = new Map<string, SonicTrack>();
  for (const track of recentTracks) {
    const key = `${track.title}::${track.artist ?? ""}`;
    const existing = counts.get(key);
    if (!existing) {
      counts.set(key, { ...track, playCount: 1 });
    } else {
      existing.playCount = (existing.playCount ?? 1) + 1;
    }
  }
  return [...counts.values()]
    .filter((track) => (track.playCount ?? 0) > 1)
    .sort((a, b) => (b.playCount ?? 0) - (a.playCount ?? 0))
    .slice(0, 10);
}

async function pushToMem0(contextSummary: string) {
  const apiKey = process.env.MEM0_API_KEY;
  if (!apiKey) return { pushed: false, reason: "missing_api_key" };

  try {
    const res = await fetch("https://api.mem0.ai/v1/memories/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${apiKey}`,
      },
      body: JSON.stringify({
        user_id: "britton-smith",
        messages: [
          {
            role: "system",
            content: "Sonic Sentinel refresh. Treat this as long-term preference memory.",
          },
          {
            role: "user",
            content: contextSummary,
          },
        ],
      }),
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      return { pushed: false, reason: `mem0_http_${res.status}` };
    }
    return { pushed: true as const };
  } catch {
    return { pushed: false, reason: "mem0_network_error" };
  }
}

function buildSummary(topTracks: SonicTrack[], loops: SonicTrack[], moodHint: string) {
  const tops = topTracks
    .slice(0, 5)
    .map((track) => `${track.title}${track.artist ? ` - ${track.artist}` : ""}`)
    .join(", ");
  const looped = loops
    .slice(0, 5)
    .map((track) => `${track.title}${track.artist ? ` - ${track.artist}` : ""}`)
    .join(", ");

  return `Mood hint: ${moodHint}\nOn-repeat (ledger): ${tops || "n/a"}\nRecent multi-play window: ${looped || "n/a"}`;
}

async function syncFromYouTube() {
  console.log("Starting YouTube Data Sync (history → ledger)");
  const redirectUri = resolveOAuthRedirectUri();
  const authClient = await getStoredOAuthClient(redirectUri);
  if (!authClient) {
    return {
      ok: false as const,
      needsAuth: true as const,
      authUrl: resolveOAuthRedirectUri(),
      error: "YouTube not authenticated yet.",
    };
  }

  const youtube = google.youtube({ version: "v3", auth: authClient });

  const ledgerPeek = await readSonicLedger();
  let orderedRawIds: string[];
  try {
    orderedRawIds = await fetchHistoryVideoIdsOrdered(youtube);
  } catch (e) {
    await appendSonicSyncError("fetchHistoryVideoIdsOrdered", e);
    throw e;
  }
  const newIds = diffNewHistoryIds(orderedRawIds, ledgerPeek.lastHistoryTailIds);
  let rawFirstBatch: youtube_v3.Schema$VideoListResponse | null = null;
  try {
    const sampleIds = orderedRawIds.slice(0, 25);
    if (sampleIds.length > 0) {
      const rawRes = await youtube.videos.list({
        id: sampleIds,
        part: ["snippet", "contentDetails"],
      });
      rawFirstBatch = rawRes.data;
    }
  } catch (e) {
    await appendSonicSyncError("sonic-sync.raw-sample", e);
  }
  let idToTrack: Map<string, SonicTrack | null>;
  try {
    idToTrack = await videoIdToTrackMap(youtube, orderedRawIds);
  } catch (e) {
    await appendSonicSyncError("videoIdToTrackMap", e);
    throw e;
  }
  let historyPlays = mapIdsToMusicTracks(newIds, idToTrack);
  if (historyPlays.length === 0 && (newIds.length > 0 || ledgerPeek.entries.length === 0)) {
    await appendSonicSyncError(
      "sync.fallback_long_history",
      new Error(
        "No Music/licensed items available for ledger increment; using 5 most recent Watch History plays ≥60s (all categories).",
      ),
    );
    historyPlays = await takeRecentLongFormFromWatchHistory(youtube, orderedRawIds, 5);
  }
  let recentWindowPlays = mapIdsToMusicTracks(orderedRawIds, idToTrack);
  if (recentWindowPlays.length === 0 && orderedRawIds.length > 0) {
    recentWindowPlays = await takeRecentLongFormFromWatchHistory(youtube, orderedRawIds, 5);
  }
  await writeRawDebug({
    ts: new Date().toISOString(),
    orderedRawIdsCount: orderedRawIds.length,
    newIdsCount: newIds.length,
    historyMusicPlaysCount: historyPlays.length,
    recentMusicWindowCount: recentWindowPlays.length,
    sampleOrderedIds: orderedRawIds.slice(0, 25),
    rawSample: rawFirstBatch,
  });
  const ledger = await incrementLedgerFromHistoryPlays(historyPlays, {
    historyTailIds: orderedRawIds,
  });
  const topTracks = rankedRowsToSonicTracks(ledger.topTracks);
  const loops = buildLoopsFromRecent(recentWindowPlays);
  // Context write must happen after ledger increment so UI reads fresh track aggregates.
  const context = await writeSonicContext({ topTracks, loops });
  const summary = buildSummary(context.topTracks, context.loops, context.moodHint);
  const mem0 = await pushToMem0(summary);

  return {
    ok: true as const,
    source: "youtube-oauth-history",
    topTracks,
    currentTrack: recentWindowPlays[0] ?? null,
    historyMusicPlays: recentWindowPlays.length,
    newHistoryPlaysApplied: historyPlays.length,
    ledgerUpdatedAt: ledger.updatedAt,
    sonic: context,
    mem0,
  };
}

export async function GET() {
  try {
    const result = await syncFromYouTube();
    if (!result.ok) {
      return Response.json(result, { status: 401, headers: { "Cache-Control": "no-store" } });
    }
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    void appendSonicSyncError("sonic-sync.GET", error);
    const fallback = await readSonicContext();
    return Response.json(
      {
        ok: false,
        error: "Failed to sync Sonic Sentinel from YouTube.",
        detail: String(error),
        sonic: fallback,
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SyncBody;
    const topTracks = Array.isArray(body.topTracks) ? body.topTracks : [];
    const loops = Array.isArray(body.loops) ? body.loops : [];

    const context = await writeSonicContext({ topTracks, loops });
    const summary = buildSummary(context.topTracks, context.loops, context.moodHint);
    const mem0 = await pushToMem0(summary);

    return Response.json(
      {
        ok: true,
        source: body.source ?? "unknown",
        sonic: context,
        mem0,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    void appendSonicSyncError("sonic-sync.POST", error);
    const fallback = await readSonicContext();
    return Response.json(
      {
        ok: false,
        error: "Failed to sync Sonic Sentinel refresh.",
        detail: String(error),
        sonic: fallback,
      },
      { status: 500 },
    );
  }
}
