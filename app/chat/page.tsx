"use client";

import { useChatWorkspace } from "@/components/chat/ChatWorkspaceProvider";
import NeuralCoreChat from "@/components/NeuralCoreChat";
import { CHAT_DRAFT_STORAGE_KEY } from "@/lib/chat-handoff";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

function ChatMain({ initialDraft }: { initialDraft: string }) {
  const { ready, sessionMessages, activeSessionId, refreshChatLog } = useChatWorkspace();

  if (!ready) {
    return (
      <div className="flex-1 flex items-center justify-center font-mono text-cyan-500/80 text-sm p-8">
        Initializing neural link…
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeSessionId}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 4 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        className="flex-1 min-h-0 h-full flex flex-col w-full"
      >
        <NeuralCoreChat
          initialDraft={initialDraft}
          workspaceReady={ready}
          sessionId={activeSessionId}
          sessionMessages={sessionMessages}
          onMessagesCommitted={refreshChatLog}
        />
      </motion.div>
    </AnimatePresence>
  );
}

function ChatHeader() {
  return (
    <header className="hidden md:flex h-16 w-full shrink-0" />
  );
}

export default function ChatPage() {
  const [draft, setDraft] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => {
      const raw = sessionStorage.getItem(CHAT_DRAFT_STORAGE_KEY) ?? "";
      sessionStorage.removeItem(CHAT_DRAFT_STORAGE_KEY);
      setDraft(raw);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  if (draft === null) {
    return (
      <div className="flex-1 flex items-center justify-center font-mono text-cyan-500/80 text-sm">
        Loading…
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen max-md:min-h-[100dvh] md:pl-[280px] flex flex-col flex-1 min-h-0 overflow-hidden">
      <ChatHeader />
      <ChatMain initialDraft={draft} />
    </div>
  );
}
