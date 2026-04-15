"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Cpu, CornerDownLeft, Mic, Volume2 } from "lucide-react";
import { TapButton } from "@/components/ui/TapButton";
import { NEURAL_CHAT_INPUT_LAYOUT_ID } from "@/lib/chat-handoff";
import type { ChatLogEntry } from "@/lib/chat-session";
import { useVisualKeyboardPad } from "@/hooks/useVisualKeyboardPad";

type ChatRole = "user" | "assistant";
type ChatMessage = { id: string; role: ChatRole; content: string };

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const DEFAULT_GREETING =
  "Spirit online. What would you like to work on?";

async function persistMessage(
  entry: { id: string; role: ChatRole; content: string },
  sessionId: string,
) {
  await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...entry, sessionId }),
  });
}

type NeuralCoreChatProps = {
  /** Injected after dashboard handoff (read from sessionStorage on `/chat`). */
  initialDraft?: string;
  /** Framer Motion shared layout id; defaults to handoff id on `/chat`. */
  inputLayoutId?: string;
  workspaceReady: boolean;
  sessionId: string;
  sessionMessages: ChatLogEntry[];
  onMessagesCommitted?: () => void;
};

export default function NeuralCoreChat({
  initialDraft = "",
  inputLayoutId,
  workspaceReady,
  sessionId,
  sessionMessages,
  onMessagesCommitted,
}: NeuralCoreChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const appliedDraftRef = useRef(false);
  const layoutId = inputLayoutId ?? NEURAL_CHAT_INPUT_LAYOUT_ID;
  const kbPad = useVisualKeyboardPad();
  const composerPadBottom = `max(env(safe-area-inset-bottom, 0px), ${kbPad}px)`;

  useEffect(() => {
    if (!workspaceReady) return;
    const loaded: ChatMessage[] = sessionMessages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        id: m.id,
        role: m.role as ChatRole,
        content: m.content,
      }));
    if (loaded.length > 0) {
      setMessages(loaded);
    } else {
      setMessages([{ id: uid(), role: "assistant", content: DEFAULT_GREETING }]);
    }
  }, [workspaceReady, sessionId, sessionMessages]);

  useEffect(() => {
    if (!workspaceReady || appliedDraftRef.current) return;
    if (initialDraft.length === 0) {
      appliedDraftRef.current = true;
      return;
    }
    setInput(initialDraft);
    appliedDraftRef.current = true;
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [workspaceReady, initialDraft]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, thinking]);

  const apiHistory = useCallback((list: ChatMessage[]) => {
    return list.map((m) => ({ role: m.role, content: m.content }));
  }, []);

  async function send() {
    const text = input.trim();
    if (!text || thinking || !workspaceReady) return;

    setError(null);
    setThinking(true);
    setInput("");

    const userMsg: ChatMessage = { id: uid(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    await persistMessage(userMsg, sessionId);

    if (text.toLowerCase() === "clear the deck") {
      try {
        const cleanupRes = await fetch("/api/vitals/cleanup", { method: "POST" });
        if (!cleanupRes.ok) throw new Error(`HTTP ${cleanupRes.status}`);
        const payload = (await cleanupRes.json()) as {
          actions?: Array<{ imageName: string; ok: boolean }>;
        };
        const killed = (payload.actions ?? []).filter((action) => action.ok).map((action) => action.imageName);
        const response =
          killed.length > 0
            ? `Deck cleared. Stopped: ${killed.join(", ")}. RAM should improve on the next vitals poll.`
            : "Cleanup ran; target processes were not running.";
        const assistantMsg: ChatMessage = { id: uid(), role: "assistant", content: response };
        setMessages((prev) => [...prev, assistantMsg]);
        await persistMessage(assistantMsg, sessionId);
        onMessagesCommitted?.();
      } catch (e) {
        const assistantMsg: ChatMessage = {
          id: uid(),
          role: "assistant",
          content: `Cleanup failed: ${String(e)}`,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        await persistMessage(assistantMsg, sessionId);
        onMessagesCommitted?.();
      } finally {
        setThinking(false);
        inputRef.current?.focus();
      }
      return;
    }

    try {
      const thread = [...messages, userMsg];
      const res = await fetch("/api/neural-core", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiHistory(thread) }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { message?: { content?: string } };
      const content = data?.message?.content?.trim() || "(no response)";
      const assistantMsg: ChatMessage = { id: uid(), role: "assistant", content };
      setMessages((prev) => [...prev, assistantMsg]);
      await persistMessage(assistantMsg, sessionId);
      onMessagesCommitted?.();
    } catch (e) {
      setError(String(e));
    } finally {
      setThinking(false);
      inputRef.current?.focus();
    }
  }

  const showThinking = useMemo(() => thinking, [thinking]);

  if (!workspaceReady) {
    return (
      <div className="flex flex-1 min-h-0 w-full bg-transparent p-8 text-center font-mono text-[12px] text-cyan-500/80 items-center justify-center">
        Loading conversation…
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden w-full bg-transparent">
      <style>{`
        .spirit-scroll::-webkit-scrollbar { width: 0px; height: 0px; }
        .spirit-scroll { scrollbar-width: none; -ms-overflow-style: none; }
      `}</style>

      <div className="flex flex-1 min-h-0 flex-col-reverse md:flex-col p-0 max-md:gap-0 max-md:pb-[env(safe-area-inset-bottom)]">
        <motion.div
          layoutId={layoutId}
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
          style={{ paddingBottom: composerPadBottom }}
          className={[
            "shrink-0 w-full md:max-w-[800px] md:mx-auto flex items-end gap-2 rounded-full border border-white/10 bg-black/60 px-4 py-2",
            "backdrop-blur-lg max-md:z-[120] max-md:shadow-[0_-8px_32px_rgba(0,0,0,0.4)]",
            "md:order-3 md:mt-2 max-md:mt-0",
          ].join(" ")}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="Type a command…"
            enterKeyHint="send"
            autoComplete="off"
            autoCorrect="off"
            rows={1}
            className="min-w-0 flex-1 resize-none overflow-y-auto max-h-[120px] md:max-h-[180px] bg-transparent outline-none text-[12px] text-cyan-100/90 font-mono placeholder:text-cyan-700/60 py-1.5"
            disabled={thinking}
          />
          <div className="shrink-0 flex items-center gap-1.5">
            <TapButton
              type="button"
              aria-label="Dictation (placeholder)"
              tabIndex={-1}
              className="p-2 rounded-lg border border-white/5 text-slate-500 pointer-events-none opacity-50"
            >
              <Mic size={16} />
            </TapButton>
            <TapButton
              type="button"
              aria-label="Voice mode (placeholder)"
              tabIndex={-1}
              className="p-2 rounded-lg border border-white/5 text-slate-500 pointer-events-none opacity-50"
            >
              <Volume2 size={16} />
            </TapButton>
            <TapButton
              type="button"
              onClick={() => void send()}
              disabled={thinking || input.trim().length === 0}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-cyan-400/30 text-[10px] uppercase tracking-widest text-cyan-200/90 hover:bg-cyan-500/10 disabled:opacity-40 disabled:hover:bg-transparent"
            >
              Send <CornerDownLeft size={14} />
            </TapButton>
          </div>
        </motion.div>

        <div
          ref={scrollerRef}
          className="spirit-scroll min-h-0 flex-1 overflow-y-auto pr-1 bg-transparent md:order-2 md:max-h-none max-md:mb-2"
        >
          <div className="p-4 sm:p-5 space-y-3 w-full md:max-w-[800px] md:mx-auto">
            {error && (
              <div className="mb-1 text-[11px] text-red-300/80">
                SPIRIT error: {error}. Is Ollama running locally?
              </div>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.role === "assistant" ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={[
                    "max-w-[85%] whitespace-pre-wrap text-[12px] leading-relaxed",
                    "font-mono",
                    m.role === "assistant"
                      ? "text-cyan-100/90 drop-shadow-[0_0_10px_rgba(34,211,238,0.25)]"
                      : "text-cyan-100/90",
                  ].join(" ")}
                >
                  <span
                    className={`block text-[10px] uppercase tracking-widest opacity-60 mb-1 ${m.role === "assistant" ? "text-left" : "text-right"}`}
                  >
                    {m.role === "assistant" ? "spirit" : "operator"}
                  </span>
                  <div className="rounded-xl border border-white/5 bg-black/35 px-4 py-3">
                    {m.content}
                  </div>
                </div>
              </div>
            ))}

            {showThinking && (
              <div className="flex justify-start">
                <div className="max-w-[85%] font-mono text-[12px] text-cyan-200/70">
                  <span className="block text-[10px] uppercase tracking-widest opacity-60 mb-1">
                    spirit
                  </span>
                  <div className="rounded-xl border border-cyan-500/20 bg-black/30 px-4 py-3">
                    Processing…
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div
          className={[
            "hidden md:flex items-center justify-between md:order-1 md:border-b border-white/5 md:px-5 md:py-4 shrink-0",
            showThinking ? "animate-pulse" : "",
          ].join(" ")}
        >
          <div className="flex items-center gap-2">
            <Cpu size={16} className="text-cyan-300/90" />
            <h2 className="text-xs font-bold text-cyan-400/80 uppercase tracking-[0.22em]">
              SPIRIT
            </h2>
          </div>
          <div className="text-[10px] uppercase tracking-widest text-cyan-300/80">
            {showThinking ? "thinking" : "ready"}
          </div>
        </div>
      </div>
    </div>
  );
}
