import { getLedgerStats, readSonicLedger } from "@/lib/sonic-ledger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ledger = await readSonicLedger();
  const stats = getLedgerStats(ledger);
  const totalArchivedPlays = ledger.entries.reduce((sum, entry) => sum + entry.playCount, 0);
  return Response.json(
    {
      updatedAt: ledger.updatedAt,
      stats,
      activeTrack: stats.topSongLast24h !== null,
      totalTrackedSongs: ledger.entries.length,
      totalArchivedPlays,
      topArtists: ledger.topArtists,
      topTracks: ledger.topTracks.slice(0, 25),
      topSongs: ledger.entries.slice(0, 10),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
