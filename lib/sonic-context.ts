import { promises as fs } from "node:fs";
import path from "node:path";
import type { SonicContext, SonicTrack } from "./sonic-types";

export type { SonicContext, SonicTrack } from "./sonic-types";

const STORE_PATH = path.join(process.cwd(), ".data", "sonic-context.json");

const DEFAULT_CONTEXT: SonicContext = {
  ts: 0,
  mood: "neutral",
  moodHint: "No sonic signal yet.",
  primaryColor: null,
  topTracks: [],
  loops: [],
};

function scoreText(items: SonicTrack[], terms: string[]) {
  const text = items
    .map((item) => `${item.title} ${item.artist ?? ""} ${item.genre ?? ""}`.toLowerCase())
    .join(" ");
  return terms.reduce((score, term) => (text.includes(term) ? score + 1 : score), 0);
}

export function inferMood(topTracks: SonicTrack[], loops: SonicTrack[]) {
  const set = [...loops, ...topTracks];
  const aggressive = scoreText(set, ["phonk", "aggressive", "trap", "drift", "rage", "metal"]);
  const reflective = scoreText(set, ["lofi", "lo-fi", "ambient", "atmospheric", "chill", "jazz"]);
  const focused = scoreText(set, ["synthwave", "instrumental", "techno", "house", "dnb", "drum and bass"]);

  if (aggressive > reflective && aggressive >= focused) {
    return {
      mood: "aggressive" as const,
      moodHint: "User is in a high-octane loop. Be sharper, direct, and challenge weak plans.",
    };
  }
  if (reflective > aggressive && reflective >= focused) {
    return {
      mood: "reflective" as const,
      moodHint: "User seems reflective. Keep critique grounded and steady, with calm precision.",
    };
  }
  if (focused > 0) {
    return {
      mood: "focused" as const,
      moodHint: "User seems locked in. Keep responses concise, technical, and execution-oriented.",
    };
  }
  return {
    mood: "neutral" as const,
    moodHint: "No strong music signal. Stay adaptive and practical.",
  };
}

function pickPrimaryColor(topTracks: SonicTrack[], loops: SonicTrack[]) {
  const first = [...loops, ...topTracks].find((track) => track.primaryColor);
  return first?.primaryColor ?? null;
}

export async function readSonicContext(): Promise<SonicContext> {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<SonicContext>;
    return {
      ...DEFAULT_CONTEXT,
      ...parsed,
      topTracks: Array.isArray(parsed.topTracks) ? parsed.topTracks : [],
      loops: Array.isArray(parsed.loops) ? parsed.loops : [],
    };
  } catch {
    return DEFAULT_CONTEXT;
  }
}

export async function writeSonicContext(input: { topTracks: SonicTrack[]; loops: SonicTrack[] }) {
  const topTracks = input.topTracks.slice(0, 10);
  const loops = input.loops.slice(0, 10);
  const { mood, moodHint } = inferMood(topTracks, loops);
  const primaryColor = pickPrimaryColor(topTracks, loops);

  const payload: SonicContext = {
    ts: Date.now(),
    mood,
    moodHint,
    primaryColor,
    topTracks,
    loops,
  };

  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  await fs.writeFile(STORE_PATH, JSON.stringify(payload, null, 2), "utf-8");
  return payload;
}
