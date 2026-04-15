import { promises as fs } from "node:fs";
import path from "node:path";
import type { SonicTrack } from "@/lib/sonic-types";

export interface PlayEvent {
  key: string;
  songTitle: string;
  artistName: string;
  ts: number;
}

export interface SonicLedgerEntry {
  key: string;
  artistName: string;
  songTitle: string;
  playCount: number;
  timestamp: number;
  albumArtUrl?: string;
}

/** Ranked track rows derived from entries (all-time). */
export interface RankedTrack {
  rank: number;
  songTitle: string;
  artistName: string;
  playCount: number;
  albumArtUrl?: string;
}

export interface SonicLedger {
  updatedAt: number;
  entries: SonicLedgerEntry[];
  /** Recent play events for rolling windows (e.g. last 24h). */
  playEvents: PlayEvent[];
  /**
   * Last raw HL / activities id list we processed (newest-first). Used to avoid
   * re-counting the same history rows on every background sync.
   */
  lastHistoryTailIds: string[];
  topArtists: Record<string, number>;
  topTracks: RankedTrack[];
}

const LEDGER_PATH = path.join(process.cwd(), "lib", "song-ledger.json");
const LEGACY_LEDGER_PATH = path.join(process.cwd(), "lib", "sonic-ledger.json");
const MAX_PLAY_EVENTS = 4000;

const DEFAULT_LEDGER: SonicLedger = {
  updatedAt: 0,
  entries: [],
  playEvents: [],
  lastHistoryTailIds: [],
  topArtists: {},
  topTracks: [],
};

/**
 * Newest-first watch history: find rows that appeared since `previous` snapshot.
 * If the tail of `current` aligns with the start of `previous`, the prefix of `current` are new plays.
 */
export function diffNewHistoryIds(current: string[], previous: string[] | undefined): string[] {
  if (!previous || previous.length === 0) return current;
  for (let i = 0; i < current.length; i++) {
    const suffix = current.slice(i);
    const maxLen = Math.min(suffix.length, previous.length);
    let ok = true;
    for (let j = 0; j < maxLen; j++) {
      if (suffix[j] !== previous[j]) {
        ok = false;
        break;
      }
    }
    if (ok && maxLen > 0) return current.slice(0, i);
  }
  return current;
}

function trackKey(songTitle: string, artistName: string) {
  return `${songTitle.trim().toLowerCase()}::${artistName.trim().toLowerCase()}`;
}

function safeArtistName(track: SonicTrack) {
  return track.artist?.trim() || "Unknown Artist";
}

function rebuildAggregates(entries: SonicLedgerEntry[]): Pick<SonicLedger, "topArtists" | "topTracks"> {
  const topArtists: Record<string, number> = {};
  for (const e of entries) {
    topArtists[e.artistName] = (topArtists[e.artistName] ?? 0) + e.playCount;
  }
  const sorted = [...entries].sort((a, b) => b.playCount - a.playCount);
  const topTracks: RankedTrack[] = sorted.map((e, i) => ({
    rank: i + 1,
    songTitle: e.songTitle,
    artistName: e.artistName,
    playCount: e.playCount,
    albumArtUrl: e.albumArtUrl,
  }));
  return { topArtists, topTracks };
}

function isValidEntry(x: unknown): x is SonicLedgerEntry {
  if (x == null || typeof x !== "object") return false;
  const e = x as SonicLedgerEntry;
  return (
    typeof e.key === "string" &&
    typeof e.artistName === "string" &&
    typeof e.songTitle === "string" &&
    typeof e.playCount === "number" &&
    typeof e.timestamp === "number" &&
    (e.albumArtUrl === undefined || typeof e.albumArtUrl === "string")
  );
}

function isValidPlayEvent(x: unknown): x is PlayEvent {
  if (x == null || typeof x !== "object") return false;
  const p = x as PlayEvent;
  return (
    typeof p.key === "string" &&
    typeof p.songTitle === "string" &&
    typeof p.artistName === "string" &&
    typeof p.ts === "number"
  );
}

/** Normalize any parsed JSON into a full ledger (never partial / undefined fields). */
function normalizeLedgerFromParsed(parsed: unknown): SonicLedger {
  if (parsed == null || typeof parsed !== "object") {
    return { ...DEFAULT_LEDGER };
  }
  const p = parsed as Record<string, unknown>;
  const entries = Array.isArray(p.entries) ? p.entries.filter(isValidEntry) : [];
  const playEvents = Array.isArray(p.playEvents) ? p.playEvents.filter(isValidPlayEvent) : [];
  const lastHistoryTailIds = Array.isArray(p.lastHistoryTailIds)
    ? p.lastHistoryTailIds.filter((id): id is string => typeof id === "string")
    : [];
  const { topArtists, topTracks } = rebuildAggregates(entries);
  return {
    updatedAt: typeof p.updatedAt === "number" && Number.isFinite(p.updatedAt) ? p.updatedAt : 0,
    entries,
    playEvents,
    lastHistoryTailIds,
    topArtists,
    topTracks,
  };
}

function isEnoent(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT";
}

/** Most-played song in the last `windowMs` from discrete play events. */
export function getTopSongInWindow(ledger: SonicLedger, windowMs: number) {
  const cutoff = Date.now() - windowMs;
  const counts = new Map<string, number>();
  const meta = new Map<string, { songTitle: string; artistName: string }>();

  for (const ev of ledger.playEvents) {
    if (ev.ts < cutoff) continue;
    counts.set(ev.key, (counts.get(ev.key) ?? 0) + 1);
    if (!meta.has(ev.key)) {
      meta.set(ev.key, { songTitle: ev.songTitle, artistName: ev.artistName });
    }
  }

  let bestKey: string | null = null;
  let best = 0;
  for (const [k, n] of counts) {
    if (n > best) {
      best = n;
      bestKey = k;
    }
  }
  if (!bestKey || best === 0) return null;
  const m = meta.get(bestKey)!;
  return { songTitle: m.songTitle, artistName: m.artistName, playCount: best };
}

export async function readSonicLedger(): Promise<SonicLedger> {
  try {
    const raw = await fs.readFile(LEDGER_PATH, "utf-8");
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      parsed = null;
    }
    return normalizeLedgerFromParsed(parsed);
  } catch (err) {
    if (isEnoent(err)) {
      try {
        const legacy = await fs.readFile(LEGACY_LEDGER_PATH, "utf-8");
        const parsed = JSON.parse(legacy) as unknown;
        const migrated = normalizeLedgerFromParsed(parsed);
        await fs.mkdir(path.dirname(LEDGER_PATH), { recursive: true });
        await fs.writeFile(LEDGER_PATH, JSON.stringify(migrated, null, 2), "utf-8");
        return migrated;
      } catch {
        /* proceed to empty ledger bootstrap */
      }
    }
    const empty = { ...DEFAULT_LEDGER };
    if (isEnoent(err)) {
      try {
        await fs.mkdir(path.dirname(LEDGER_PATH), { recursive: true });
        await fs.writeFile(LEDGER_PATH, JSON.stringify(empty, null, 2), "utf-8");
      } catch {
        /* still return empty in memory */
      }
    }
    return empty;
  }
}

export async function writeSonicLedger(ledger: SonicLedger) {
  const { topArtists, topTracks } = rebuildAggregates(ledger.entries);
  const out: SonicLedger = {
    ...ledger,
    playEvents: ledger.playEvents.slice(-MAX_PLAY_EVENTS),
    lastHistoryTailIds: ledger.lastHistoryTailIds ?? [],
    topArtists,
    topTracks,
  };
  await fs.writeFile(LEDGER_PATH, JSON.stringify(out, null, 2), "utf-8");
  return out;
}

/**
 * One ledger increment per history row (true “on repeat”: each watch is +1).
 */
export async function incrementLedgerFromHistoryPlays(
  historyPlays: SonicTrack[],
  opts?: { historyTailIds?: string[] },
) {
  const ledger = await readSonicLedger();
  const byKey = new Map(ledger.entries.map((entry) => [entry.key, entry]));
  const now = Date.now();
  const playEvents = [...ledger.playEvents];

  for (let i = 0; i < historyPlays.length; i++) {
    const track = historyPlays[i];
    const songTitle = track.title?.trim();
    if (!songTitle) continue;
    const artistName = safeArtistName(track);
    const key = trackKey(songTitle, artistName);
    const existing = byKey.get(key);
    /** Newest history rows get timestamps closest to `now` (playlist is newest-first). */
    const ts = now - i;

    if (!existing) {
      byKey.set(key, {
        key,
        artistName,
        songTitle,
        playCount: 1,
        timestamp: ts,
        albumArtUrl: track.albumArtUrl,
      });
    } else {
      existing.playCount += 1;
      existing.timestamp = ts;
      if (track.albumArtUrl && !existing.albumArtUrl) {
        existing.albumArtUrl = track.albumArtUrl;
      }
      byKey.set(key, existing);
    }

    playEvents.push({
      key,
      songTitle,
      artistName,
      ts,
    });
  }

  const entries = [...byKey.values()].sort((a, b) => b.playCount - a.playCount);
  const { topArtists, topTracks } = rebuildAggregates(entries);

  const updated: SonicLedger = {
    updatedAt: now,
    entries,
    playEvents: playEvents.slice(-MAX_PLAY_EVENTS),
    lastHistoryTailIds: opts?.historyTailIds ?? ledger.lastHistoryTailIds ?? [],
    topArtists,
    topTracks,
  };
  await writeSonicLedger(updated);
  return updated;
}

export function getLedgerStats(ledger: SonicLedger) {
  const topSongLast24h = getTopSongInWindow(ledger, 24 * 60 * 60 * 1000);
  const allTimeTopSong = ledger.topTracks[0] ?? null;

  const artistTotals = new Map<string, number>(Object.entries(ledger.topArtists ?? {}));
  if (artistTotals.size === 0) {
    for (const entry of ledger.entries) {
      artistTotals.set(entry.artistName, (artistTotals.get(entry.artistName) ?? 0) + entry.playCount);
    }
  }
  const allTimeTopArtist =
    [...artistTotals.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;

  return {
    topSongLast24h,
    allTimeTopSong: allTimeTopSong
      ? {
          songTitle: allTimeTopSong.songTitle,
          artistName: allTimeTopSong.artistName,
          playCount: allTimeTopSong.playCount,
        }
      : null,
    allTimeTopArtist: allTimeTopArtist
      ? {
          artistName: allTimeTopArtist[0],
          playCount: allTimeTopArtist[1],
        }
      : null,
  };
}
