/** Shared Sonic types (safe for client + server). */

export interface SonicTrack {
  title: string;
  artist?: string;
  genre?: string;
  albumArtUrl?: string;
  primaryColor?: string;
  playCount?: number;
}

export interface SonicContext {
  ts: number;
  mood: "aggressive" | "reflective" | "focused" | "neutral";
  moodHint: string;
  primaryColor: string | null;
  topTracks: SonicTrack[];
  loops: SonicTrack[];
}
