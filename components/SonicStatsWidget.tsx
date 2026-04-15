"use client";

import { TapButton } from "@/components/ui/TapButton";
import type { SonicContext, SonicTrack } from "@/lib/sonic-types";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type RankedTrackRow = {
  rank: number;
  songTitle: string;
  artistName: string;
  playCount: number;
  albumArtUrl?: string;
};

type LedgerStats = {
  topSongLast24h: { songTitle: string; artistName: string; playCount: number } | null;
  allTimeTopSong: { songTitle: string; artistName: string; playCount: number } | null;
  allTimeTopArtist: { artistName: string; playCount: number } | null;
};

type LedgerPayload = {
  updatedAt: number;
  activeTrack?: boolean;
  stats: LedgerStats;
  totalArchivedPlays: number;
  totalTrackedSongs: number;
  topTracks: RankedTrackRow[];
};

type SonicSyncOk = {
  ok: true;
  source?: string;
  topTracks?: SonicTrack[];
  sonic?: SonicContext;
  ledgerUpdatedAt?: number;
};

type SonicSyncErr = {
  ok: false;
  needsAuth?: boolean;
  error?: string;
};

export default function SonicStatsWidget() {
  const [ledger, setLedger] = useState<LedgerPayload | null>(null);
  const [sonic, setSonic] = useState<SonicContext | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const loadLedger = useCallback(async () => {
    try {
      const res = await fetch("/api/sonic-ledger");
      if (!res.ok) return;
      const json = (await res.json()) as LedgerPayload;
      setLedger(json);
    } catch {
      // soft-fail
    }
  }, []);

  const loadSonicContext = useCallback(async () => {
    try {
      const res = await fetch("/api/sonic-context");
      if (!res.ok) return;
      const json = (await res.json()) as SonicContext;
      setSonic(json);
    } catch {
      // soft-fail
    }
  }, []);

  const forceSyncYouTube = useCallback(async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch("/api/sonic-sync", { cache: "no-store" });
      const json = (await res.json()) as SonicSyncOk | SonicSyncErr;
      if (!res.ok || !("ok" in json) || json.ok === false) {
        const err = json as SonicSyncErr;
        setSyncError(
          err.needsAuth || res.status === 401
            ? "YouTube not authenticated — open /api/sonic-auth"
            : err.error ?? `Sync failed (HTTP ${res.status})`,
        );
        return;
      }
      if (json.sonic) setSonic(json.sonic);
      await loadLedger();
    } catch (e) {
      setSyncError(String(e));
    } finally {
      setSyncing(false);
    }
  }, [loadLedger]);

  useEffect(() => {
    const boot = window.setTimeout(() => {
      void loadLedger();
      void loadSonicContext();
    }, 0);
    const timer = setInterval(() => {
      void loadLedger();
      void loadSonicContext();
    }, 30000);
    return () => {
      window.clearTimeout(boot);
      clearInterval(timer);
    };
  }, [loadLedger, loadSonicContext]);

  const isCold = !ledger || ledger.totalTrackedSongs === 0;
  const lastLedgerLabel =
    ledger?.updatedAt && ledger.updatedAt > 0
      ? new Date(ledger.updatedAt).toLocaleString()
      : "Never";

  const mood = sonic?.mood;
  const moodHint = sonic?.moodHint;

  const displayTracks = ledger?.topTracks?.length ? ledger.topTracks.slice(0, 10) : [];

  return (
    <div className="w-full rounded-2xl border border-white/5 bg-black/35 backdrop-blur-xl p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4 border-b border-white/5 pb-2">
        <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-[0.2em] inline-flex items-center gap-2">
          SONG_STATS
          {ledger?.activeTrack && (
            <span className="inline-flex items-end gap-1 h-3" aria-hidden>
              <span className="w-0.5 h-2 bg-cyan-400/85 animate-pulse" />
              <span className="w-0.5 h-3 bg-cyan-300/90 animate-pulse [animation-delay:120ms]" />
              <span className="w-0.5 h-1.5 bg-cyan-500/80 animate-pulse [animation-delay:240ms]" />
              <span className="w-0.5 h-2.5 bg-cyan-300/90 animate-pulse [animation-delay:360ms]" />
            </span>
          )}
        </h3>
        <div className="flex items-center gap-2 sm:gap-3">
          <TapButton
            type="button"
            onClick={() => void forceSyncYouTube()}
            disabled={syncing}
            aria-label="Force sync YouTube now"
            title="Force sync YouTube now"
            className="p-2 rounded-lg border border-cyan-500/35 bg-cyan-950/40 text-cyan-300 hover:bg-cyan-500/15 disabled:opacity-50 shrink-0"
          >
            <RefreshCw size={16} className={syncing ? "animate-spin" : ""} strokeWidth={1.75} />
          </TapButton>
          <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-600/90">
            Ledger sync · every 30m
          </span>
        </div>
      </div>

      {syncError && (
        <p className="mb-3 text-[11px] text-amber-300/90 font-mono">
          Sync: {syncError}
          {(syncError.includes("authenticated") || syncError.includes("sonic-auth")) && (
            <span className="block mt-1">
              <a href="/api/sonic-auth" className="text-cyan-400 underline">
                /api/sonic-auth
              </a>
            </span>
          )}
        </p>
      )}

      <div className="rounded-xl border border-white/5 bg-black/35 p-3 sm:p-4 mb-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-400/70 mb-2">Mood</p>
        <p className="font-mono text-[12px] text-cyan-100/90">
          <span className="text-cyan-400">{mood ?? "—"}</span>
          {moodHint && (
            <span className="block mt-1 text-[11px] text-cyan-200/70">{moodHint}</span>
          )}
          {!mood && !moodHint && (
            <span className="text-cyan-600/80">
              Mood updates after a background YouTube sync (or when sonic context has been written).
            </span>
          )}
        </p>
      </div>

      <div className="rounded-xl border border-white/5 bg-black/35 p-3 sm:p-4 mb-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-400/70 mb-3">
          On repeat (ledger, by playCount)
        </p>
        {displayTracks.length > 0 ? (
          <ul className="space-y-2">
            {displayTracks.map((row) => (
              <li
                key={`${row.rank}-${row.songTitle}`}
                className="flex items-center gap-3 rounded-lg border border-white/5 bg-black/40 px-2 py-2"
              >
                {row.albumArtUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- remote YouTube thumbs; avoid next/image domain config
                  <img
                    src={row.albumArtUrl}
                    alt=""
                    width={40}
                    height={40}
                    className="h-10 w-10 shrink-0 rounded object-cover border border-white/10"
                  />
                ) : (
                  <div className="h-10 w-10 shrink-0 rounded bg-cyan-950/40 border border-white/10" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-[12px] text-cyan-100/90">{row.songTitle}</p>
                  <p className="truncate font-mono text-[10px] text-cyan-500/80">
                    {row.artistName}
                    <span className="text-cyan-400/60"> · {row.playCount}×</span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="font-mono text-[11px] text-cyan-600/80">
            No plays in the ledger yet — authenticate YouTube and wait for the next sync.
          </p>
        )}
      </div>

      <div className="rounded-xl border border-cyan-900/30 bg-black/45 p-3 sm:p-4">
        <div className="space-y-2 font-mono text-[11px] text-cyan-100/90 leading-relaxed">
          <p>
            {">"} CURRENT_LOOP:{" "}
            {ledger?.stats.topSongLast24h
              ? `${ledger.stats.topSongLast24h.songTitle} (${ledger.stats.topSongLast24h.playCount} in 24h)`
              : "n/a"}
          </p>
          <p>
            {">"} ALL_TIME_GOAT:{" "}
            {ledger?.stats.allTimeTopSong
              ? `${ledger.stats.allTimeTopSong.songTitle} — ${ledger.stats.allTimeTopSong.artistName} (${ledger.stats.allTimeTopSong.playCount}×)`
              : "n/a"}
          </p>
          <p>{">"} TOTAL_ARCHIVED_PLAYS: {ledger?.totalArchivedPlays ?? 0}</p>
        </div>
      </div>

      <div className="mt-3 space-y-1 text-[10px] text-cyan-300/60 font-mono">
        <p>
          Ledger last update: <span className="text-cyan-200/80">{lastLedgerLabel}</span>
        </p>
      </div>

      {isCold && (
        <p className="mt-2 text-[11px] text-amber-300/90 font-mono">
          Song Ledger is cold. Visit{" "}
          <a href="/api/sonic-auth" className="text-cyan-400 underline">
            /api/sonic-auth
          </a>{" "}
          to prime the engine.
        </p>
      )}
    </div>
  );
}
