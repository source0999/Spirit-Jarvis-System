"use client";

import { useChatDrawer } from "@/components/chat/ChatDrawerContext";
import { TapButton } from "@/components/ui/TapButton";
import {
  filterSessionsBySearch,
  groupSessionsByNodeSync,
  resolveEntrySessionId,
  type ChatSessionListItem,
} from "@/lib/chat-session";
import { AnimatePresence, motion } from "framer-motion";
import { Cpu, Home, MessageSquarePlus, Search, User } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useChatWorkspace } from "@/components/chat/ChatWorkspaceProvider";

function NodeListRow({
  node,
  active,
  onPick,
}: {
  node: ChatSessionListItem;
  active: boolean;
  onPick: (id: string) => void;
}) {
  return (
    <TapButton
      type="button"
      onClick={() => onPick(node.id)}
      className={[
        "w-full text-left rounded-lg px-3 py-2.5",
        "border text-[11px] leading-snug font-mono",
        active
          ? "border-cyan-400/40 bg-black/40 text-cyan-100 shadow-[0_0_16px_rgba(34,211,238,0.08)]"
          : "border-transparent bg-transparent text-cyan-200/75 hover:bg-white/[0.04] hover:border-cyan-900/25",
      ].join(" ")}
    >
      <span className="flex items-start gap-2 pointer-events-none">
        <Cpu
          size={14}
          className={active ? "text-cyan-400 mt-0.5 shrink-0" : "text-cyan-600 mt-0.5 shrink-0"}
        />
        <span className="line-clamp-2">{node.title}</span>
      </span>
      {node.messageCount > 0 && (
        <span className="block mt-1 pl-[1.375rem] text-[9px] uppercase tracking-wider text-cyan-600/85 pointer-events-none">
          {node.messageCount} msg{node.messageCount === 1 ? "" : "s"}
        </span>
      )}
    </TapButton>
  );
}

export default function ChatSidebar() {
  const { activeSessionId, sidebarSessions, setActiveSessionId, newChat, allMessages } =
    useChatWorkspace();
  const [query, setQuery] = useState("");
  const { drawerOpen, closeDrawer } = useChatDrawer();

  const contentBySessionId = useMemo(() => {
    const m = new Map<string, string>();
    for (const msg of allMessages) {
      const sid = resolveEntrySessionId(msg);
      m.set(sid, (m.get(sid) ?? "") + "\n" + (msg.content ?? ""));
    }
    return m;
  }, [allMessages]);

  const filtered = useMemo(
    () => filterSessionsBySearch(sidebarSessions, query, contentBySessionId),
    [sidebarSessions, query, contentBySessionId],
  );

  const { pending, today, yesterday, archived } = useMemo(() => {
    const pend = filtered.filter((s) => s.updatedAt === 0);
    const rest = filtered.filter((s) => s.updatedAt !== 0);
    const g = groupSessionsByNodeSync(rest);
    return { pending: pend, ...g };
  }, [filtered]);

  const pickSession = (id: string) => {
    setActiveSessionId(id);
    closeDrawer();
  };

  const startNewChat = () => {
    newChat();
    closeDrawer();
  };

  const empty =
    pending.length === 0 &&
    today.length === 0 &&
    yesterday.length === 0 &&
    archived.length === 0;

  return (
    <>
      <AnimatePresence>
        {drawerOpen && (
          <motion.div
            key="drawer-backdrop"
            role="presentation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-lg"
            onClick={closeDrawer}
          />
        )}
      </AnimatePresence>

      <aside
        data-open={drawerOpen ? "true" : "false"}
        className={[
          "flex flex-col w-[min(18rem,88vw)] shrink-0 h-full min-h-0 md:h-screen",
          "border-r border-cyan-900/30 bg-black/70 backdrop-blur-lg",
          "font-mono text-slate-300 z-50",
          "transition-transform duration-300 ease-out will-change-transform",
          "max-md:fixed max-md:left-0 max-md:top-0 max-md:shadow-[6px_0_32px_rgba(0,0,0,0.45)]",
          "max-md:-translate-x-full max-md:data-[open=true]:translate-x-0",
          "md:translate-x-0 md:sticky md:top-0",
        ].join(" ")}
      >
        <div className="p-3 border-b border-cyan-900/20 shrink-0">
          <div className="flex items-center gap-3 px-1 py-2 mb-2">
            <Link
              href="/dashboard"
              className="text-cyan-400 hover:text-white transition-colors cursor-pointer"
              aria-label="Home"
              title="Home"
            >
              <Home size={18} strokeWidth={1.75} />
            </Link>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400/90">
              SPIRIT
            </span>
          </div>
          <label className="mb-2 block">
            <span className="sr-only">Search sessions</span>
            <span className="flex items-center gap-2 rounded-lg border border-cyan-900/35 bg-black/40 px-2.5 py-2 backdrop-blur-sm">
              <Search size={14} className="text-cyan-600 shrink-0" strokeWidth={1.75} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search nodes…"
                className="w-full min-w-0 bg-transparent text-[11px] text-cyan-100/90 placeholder:text-cyan-700/55 outline-none"
              />
            </span>
          </label>
          <TapButton
            type="button"
            onClick={() => startNewChat()}
            className={[
              "w-full flex items-center justify-center gap-2 rounded-lg py-2.5 px-3",
              "border border-cyan-500/35 bg-black/40 text-cyan-200/95 text-[11px] uppercase tracking-widest",
              "hover:bg-cyan-500/15 hover:border-cyan-400/45 hover:shadow-[0_0_20px_rgba(34,211,238,0.12)]",
            ].join(" ")}
          >
            <MessageSquarePlus size={16} strokeWidth={1.75} />
            New chat
          </TapButton>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-2 py-3 touch-pan-y">
          {sidebarSessions.length === 0 ? (
            <p className="px-2 text-[11px] text-cyan-700/80">No sessions yet.</p>
          ) : empty ? (
            <p className="px-2 text-[11px] text-cyan-700/80">No sessions match.</p>
          ) : (
            <>
              {pending.length > 0 && (
                <div className="mb-4">
                  <p className="px-2 pb-2 text-[9px] uppercase tracking-[0.25em] text-cyan-600/90">
                    Drafts
                  </p>
                  <div className="space-y-1">
                    {pending.map((node) => (
                      <NodeListRow
                        key={node.id}
                        node={node}
                        active={node.id === activeSessionId}
                        onPick={pickSession}
                      />
                    ))}
                  </div>
                </div>
              )}
              {today.length > 0 && (
                <div className="mb-4">
                  <p className="px-2 pb-2 text-[9px] uppercase tracking-[0.25em] text-cyan-600/90">
                    Today
                  </p>
                  <div className="space-y-1">
                    {today.map((node) => (
                      <NodeListRow
                        key={node.id}
                        node={node}
                        active={node.id === activeSessionId}
                        onPick={pickSession}
                      />
                    ))}
                  </div>
                </div>
              )}
              {yesterday.length > 0 && (
                <div className="mb-4">
                  <p className="px-2 pb-2 text-[9px] uppercase tracking-[0.25em] text-cyan-600/90">
                    Yesterday
                  </p>
                  <div className="space-y-1">
                    {yesterday.map((node) => (
                      <NodeListRow
                        key={node.id}
                        node={node}
                        active={node.id === activeSessionId}
                        onPick={pickSession}
                      />
                    ))}
                  </div>
                </div>
              )}
              {archived.length > 0 && (
                <div className="mb-4">
                  <p className="px-2 pb-2 text-[9px] uppercase tracking-[0.25em] text-cyan-600/90">
                    Archived
                  </p>
                  <div className="space-y-1">
                    {archived.map((node) => (
                      <NodeListRow
                        key={node.id}
                        node={node}
                        active={node.id === activeSessionId}
                        onPick={pickSession}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-3 border-t border-cyan-900/20 shrink-0">
          <div
            className={[
              "flex items-center gap-3 rounded-lg px-2 py-2.5",
              "border border-cyan-900/25 bg-black/50",
            ].join(" ")}
          >
            <div className="h-9 w-9 rounded-full border border-cyan-500/30 bg-gradient-to-br from-cyan-900/60 to-black flex items-center justify-center shrink-0">
              <User size={16} className="text-cyan-400/90" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-cyan-100/90 truncate font-medium">Operator</p>
              <p className="text-[9px] uppercase tracking-widest text-cyan-600/90 truncate">
                Britton Smith
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
