"use client";

import { TapButton } from "@/components/ui/TapButton";
import { Cpu, CornerDownLeft, Mic, Volume2 } from "lucide-react";
import { motion } from "framer-motion";
import { CHAT_DRAFT_STORAGE_KEY, NEURAL_CHAT_INPUT_LAYOUT_ID } from "@/lib/chat-handoff";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";

export default function DashboardChatLauncher() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const activated = useRef(false);

  const openChat = useCallback(() => {
    if (activated.current) return;
    activated.current = true;
    router.push("/chat");
  }, [router]);

  return (
    <div className="w-full border border-white/5 bg-black/40 rounded-2xl backdrop-blur-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Cpu size={16} className="text-cyan-300/90" />
          <h2 className="text-xs font-bold text-cyan-400/80 uppercase tracking-[0.22em]">SPIRIT</h2>
        </div>
        <div className="text-[10px] uppercase tracking-widest text-cyan-300/80">tap to expand</div>
      </div>

      <div className="p-4 sm:p-5">
        <motion.div
          layoutId={NEURAL_CHAT_INPUT_LAYOUT_ID}
          className="w-full flex flex-wrap items-center gap-2 rounded-xl border border-white/5 bg-black/50 px-3 py-2"
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
        >
          <span className="text-[10px] text-cyan-400/70 font-mono">$</span>
          <input
            value={input}
            onChange={(e) => {
              const v = e.target.value;
              setInput(v);
              sessionStorage.setItem(CHAT_DRAFT_STORAGE_KEY, v);
              if (!activated.current) openChat();
            }}
            onFocus={() => {
              sessionStorage.setItem(CHAT_DRAFT_STORAGE_KEY, input);
              openChat();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                sessionStorage.setItem(CHAT_DRAFT_STORAGE_KEY, input);
                openChat();
              }
            }}
            placeholder="Type a command…"
            className="basis-full sm:basis-auto min-w-0 sm:min-w-[180px] flex-1 bg-transparent outline-none text-[12px] text-cyan-100/90 font-mono placeholder:text-cyan-700/60"
            autoComplete="off"
          />
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
            onClick={() => {
              sessionStorage.setItem(CHAT_DRAFT_STORAGE_KEY, input);
              openChat();
            }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-cyan-400/30 text-[10px] uppercase tracking-widest text-cyan-200/90 hover:bg-cyan-500/10"
          >
            Open chat <CornerDownLeft size={14} />
          </TapButton>
        </motion.div>
      </div>
    </div>
  );
}
