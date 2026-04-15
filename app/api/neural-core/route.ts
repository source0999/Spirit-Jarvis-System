import { NextRequest } from "next/server";
import { readSonicContext } from "@/lib/sonic-context";
import { getLedgerStats, readSonicLedger } from "@/lib/sonic-ledger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatRole = "system" | "user" | "assistant";
type ChatMessage = { role: ChatRole; content: string };
type OllamaChatResponse = { message?: { content?: string } };

const OLLAMA_BASE = process.env.OLLAMA_HOST ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "dolphin-mistral";

const HONESTY_PROTOCOL = `You are Spirit, a high-end lab assistant for Britton Smith: grounded, technical, and efficient.

Tone: Direct, calm, and precise. Avoid theatrical "hacker" clichés, forced edginess, or performative mystique. No cringe cyberpunk roleplay.

Priorities: Answer with clear reasoning, cite concrete facts from the provided context when relevant, and separate observations from recommendations.

Expertise: Modern web development (React/Next.js), local tooling, hardware projects (e.g. consoles), and home-lab / NAS setups when applicable.

When data is missing, say what is unknown and suggest the smallest next step to obtain it.`;

function buildSonicContextBlock(sonic: Awaited<ReturnType<typeof readSonicContext>>) {
  const topTracks = sonic.topTracks
    .slice(0, 3)
    .map((track) => `${track.title}${track.artist ? ` - ${track.artist}` : ""}`)
    .join(", ");
  const loops = sonic.loops
    .slice(0, 3)
    .map((track) => `${track.title}${track.artist ? ` - ${track.artist}` : ""}`)
    .join(", ");

  return [
    "Dynamic Context:",
    `- Sonic mood: ${sonic.mood}`,
    `- Mood hint: ${sonic.moodHint}`,
    `- Top tracks: ${topTracks || "n/a"}`,
    `- Active loops: ${loops || "n/a"}`,
    "",
    "Conversation constraints:",
    "- Reference music analytics only when it helps the user’s question; do not derail technical work with trivia.",
  ].join("\n");
}

function buildLedgerContextBlock(ledger: Awaited<ReturnType<typeof readSonicLedger>>) {
  const stats = getLedgerStats(ledger);
  const topSongs = ledger.topTracks
    .slice(0, 5)
    .map((row) => `${row.songTitle} - ${row.artistName} (${row.playCount})`)
    .join(", ");
  const topArtistLines = Object.entries(ledger.topArtists)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, n]) => `${name}: ${n}`)
    .join(", ");

  return [
    "Read-only music analytics (all-time, from local ledger):",
    `- Distinct tracks recorded: ${ledger.entries.length}`,
    `- Total plays recorded (sum): ${ledger.entries.reduce((s, e) => s + e.playCount, 0)}`,
    `- Top tracks (by playCount): ${topSongs || "n/a"}`,
    `- Top artists (by total plays): ${topArtistLines || "n/a"}`,
    `- Heaviest loop (last 24h, from play events): ${
      stats.topSongLast24h
        ? `${stats.topSongLast24h.songTitle} - ${stats.topSongLast24h.artistName} (${stats.topSongLast24h.playCount} plays in window)`
        : "n/a"
    }`,
    `- All-time top song (by playCount): ${
      stats.allTimeTopSong
        ? `${stats.allTimeTopSong.songTitle} - ${stats.allTimeTopSong.artistName} (${stats.allTimeTopSong.playCount})`
        : "n/a"
    }`,
    `- All-time top artist (by total plays): ${
      stats.allTimeTopArtist
        ? `${stats.allTimeTopArtist.artistName} (${stats.allTimeTopArtist.playCount})`
        : "n/a"
    }`,
    "",
    "You may answer questions about play counts, top artists, and listening history using this data. Keep commentary factual and concise.",
  ].join("\n");
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { messages?: ChatMessage[] };
    const incoming = body.messages ?? [];
    const sonic = await readSonicContext();
    const ledger = await readSonicLedger();
    const systemPrompt = `${HONESTY_PROTOCOL}\n\n${buildSonicContextBlock(sonic)}\n\n${buildLedgerContextBlock(ledger)}`;

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...incoming.filter((m) => m && typeof m.content === "string" && (m.role === "user" || m.role === "assistant")),
    ];

    const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages,
        stream: false,
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return Response.json(
        { error: `Ollama error HTTP ${res.status}`, detail: text },
        { status: 502 },
      );
    }

    const data = (await res.json()) as OllamaChatResponse;
    const content = data.message?.content ?? "";

    return Response.json(
      {
        model: OLLAMA_MODEL,
        message: { role: "assistant" as const, content: String(content) },
        ts: Date.now(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      { error: "Failed to reach Neural Core.", detail: String(error) },
      { status: 500 },
    );
  }
}

