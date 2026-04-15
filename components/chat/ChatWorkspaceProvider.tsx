"use client";

import {
  type ChatLogEntry,
  type ChatSessionListItem,
  filterChatLogBySession,
  listChatSessionsFromLog,
} from "@/lib/chat-session";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type ChatWorkspaceValue = {
  ready: boolean;
  allMessages: ChatLogEntry[];
  activeSessionId: string;
  sessionMessages: ChatLogEntry[];
  sidebarSessions: ChatSessionListItem[];
  setActiveSessionId: (id: string) => void;
  newChat: () => void;
  refreshChatLog: () => Promise<void>;
};

const ChatWorkspaceContext = createContext<ChatWorkspaceValue | null>(null);

function newSessionId() {
  return `sess-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

export function ChatWorkspaceProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [allMessages, setAllMessages] = useState<ChatLogEntry[]>([]);
  const [activeSessionId, setActiveSessionIdState] = useState<string>("");
  const [pendingSessionIds, setPendingSessionIds] = useState<string[]>([]);
  const bootstrapped = useRef(false);

  const refreshChatLog = useCallback(async () => {
    const res = await fetch("/api/chat", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { messages?: ChatLogEntry[] };
    setAllMessages(Array.isArray(data.messages) ? data.messages : []);
  }, []);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/chat", { cache: "no-store" });
      const data = (await res.json()) as { messages?: ChatLogEntry[] };
      const msgs = Array.isArray(data.messages) ? data.messages : [];
      setAllMessages(msgs);
      if (!bootstrapped.current) {
        bootstrapped.current = true;
        const sessions = listChatSessionsFromLog(msgs);
        setActiveSessionIdState(sessions[0]?.id ?? newSessionId());
      }
      setReady(true);
    })();
  }, []);

  const sidebarSessions = useMemo(() => {
    const fromLog = listChatSessionsFromLog(allMessages);
    const fromLogIds = new Set(fromLog.map((s) => s.id));
    const drafts: ChatSessionListItem[] = pendingSessionIds
      .filter((id) => !fromLogIds.has(id))
      .map((id) => ({
        id,
        title: "New node",
        updatedAt: 0,
        messageCount: 0,
      }));
    return [...drafts, ...fromLog];
  }, [allMessages, pendingSessionIds]);

  const sessionMessages = useMemo(
    () => filterChatLogBySession(allMessages, activeSessionId),
    [allMessages, activeSessionId],
  );

  const setActiveSessionId = useCallback((id: string) => {
    setActiveSessionIdState(id);
  }, []);

  const newChat = useCallback(() => {
    const id = newSessionId();
    setPendingSessionIds((d) => [id, ...d.filter((x) => x !== id)]);
    setActiveSessionIdState(id);
  }, []);

  const value = useMemo<ChatWorkspaceValue>(
    () => ({
      ready: ready && Boolean(activeSessionId),
      allMessages,
      activeSessionId,
      sessionMessages,
      sidebarSessions,
      setActiveSessionId,
      newChat,
      refreshChatLog,
    }),
    [
      ready,
      activeSessionId,
      allMessages,
      sessionMessages,
      sidebarSessions,
      setActiveSessionId,
      newChat,
      refreshChatLog,
    ],
  );

  return <ChatWorkspaceContext.Provider value={value}>{children}</ChatWorkspaceContext.Provider>;
}

export function useChatWorkspace() {
  const ctx = useContext(ChatWorkspaceContext);
  if (!ctx) throw new Error("useChatWorkspace must be used within ChatWorkspaceProvider");
  return ctx;
}
