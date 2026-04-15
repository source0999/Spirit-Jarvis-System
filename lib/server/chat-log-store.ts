import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import type { ChatLogEntry } from "@/lib/chat-session";

const CHAT_PATH = path.join(process.cwd(), "data", "chat-logs.json");

const EMPTY: ChatLogEntry[] = [];

export async function readChatLog(): Promise<ChatLogEntry[]> {
  try {
    const raw = await fs.readFile(CHAT_PATH, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [...EMPTY];
    return parsed.filter((m): m is ChatLogEntry => {
      if (m == null || typeof m !== "object") return false;
      const e = m as ChatLogEntry;
      if (typeof e.id !== "string") return false;
      if (e.role !== "user" && e.role !== "assistant") return false;
      if (typeof e.content !== "string") return false;
      if (e.sessionId !== undefined && typeof e.sessionId !== "string") return false;
      return true;
    });
  } catch {
    return [...EMPTY];
  }
}

export async function appendChatMessage(entry: Omit<ChatLogEntry, "ts"> & { ts?: number }) {
  const log = await readChatLog();
  const next: ChatLogEntry = {
    ...entry,
    ts: entry.ts ?? Date.now(),
  };
  log.push(next);
  await fs.mkdir(path.dirname(CHAT_PATH), { recursive: true });
  await fs.writeFile(CHAT_PATH, JSON.stringify(log, null, 2), "utf-8");
  return next;
}
