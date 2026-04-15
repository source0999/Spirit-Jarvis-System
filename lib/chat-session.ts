/**
 * Chat session helpers + types — safe for Client Components (no Node builtins).
 */

export type ChatRole = "user" | "assistant";

/** Messages without `sessionId` are grouped as legacy (pre–multi-session). */
export const CHAT_LEGACY_SESSION_ID = "__legacy__";

export interface ChatLogEntry {
  id: string;
  role: ChatRole;
  content: string;
  ts: number;
  sessionId?: string;
}

export type ChatSessionListItem = {
  id: string;
  title: string;
  /** Last activity in session (NODE_SYNC–style anchor for sidebar grouping). */
  updatedAt: number;
  messageCount: number;
};

/** Group sessions by calendar day vs older (Archived). */
export function groupSessionsByNodeSync(
  sessions: ChatSessionListItem[],
  nowMs: number = Date.now(),
): { today: ChatSessionListItem[]; yesterday: ChatSessionListItem[]; archived: ChatSessionListItem[] } {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today0 = startOfDay(new Date(nowMs));
  const yesterday0 = today0 - 86400000;
  const today: ChatSessionListItem[] = [];
  const yesterday: ChatSessionListItem[] = [];
  const archived: ChatSessionListItem[] = [];
  for (const s of sessions) {
    const t = s.updatedAt;
    if (t >= today0) today.push(s);
    else if (t >= yesterday0) yesterday.push(s);
    else archived.push(s);
  }
  return { today, yesterday, archived };
}

/** Filter sessions/messages by case-insensitive substring in title (and optional snippet from messages index). */
export function filterSessionsBySearch(
  sessions: ChatSessionListItem[],
  query: string,
  contentBySessionId?: Map<string, string>,
): ChatSessionListItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return sessions;
  return sessions.filter((s) => {
    if (s.title.toLowerCase().includes(q)) return true;
    const blob = contentBySessionId?.get(s.id);
    return blob ? blob.toLowerCase().includes(q) : false;
  });
}

export function resolveEntrySessionId(entry: ChatLogEntry): string {
  const s = entry.sessionId?.trim();
  return s && s.length > 0 ? s : CHAT_LEGACY_SESSION_ID;
}

export function filterChatLogBySession(log: ChatLogEntry[], sessionId: string): ChatLogEntry[] {
  return log.filter((m) => resolveEntrySessionId(m) === sessionId);
}

export function listChatSessionsFromLog(log: ChatLogEntry[]): ChatSessionListItem[] {
  const map = new Map<string, ChatLogEntry[]>();
  for (const m of log) {
    const id = resolveEntrySessionId(m);
    const arr = map.get(id);
    if (arr) arr.push(m);
    else map.set(id, [m]);
  }
  const out: ChatSessionListItem[] = [];
  for (const [id, msgs] of map) {
    const updatedAt = Math.max(...msgs.map((x) => (typeof x.ts === "number" ? x.ts : 0)));
    const firstUser = msgs.find((x) => x.role === "user");
    const raw = firstUser?.content?.trim() ?? "";
    const title =
      raw.length > 0
        ? raw.length > 56
          ? `${raw.slice(0, 56)}…`
          : raw
        : id === CHAT_LEGACY_SESSION_ID
          ? "Archive"
          : "New node";
    out.push({ id, title, updatedAt, messageCount: msgs.length });
  }
  out.sort((a, b) => b.updatedAt - a.updatedAt);
  return out;
}
