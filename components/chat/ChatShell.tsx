"use client";

import ChatSidebar from "@/components/chat/ChatSidebar";
import { ChatDrawerProvider } from "@/components/chat/ChatDrawerContext";
import { ChatWorkspaceProvider } from "@/components/chat/ChatWorkspaceProvider";
import type { ReactNode } from "react";

export default function ChatShell({ children }: { children: ReactNode }) {
  return (
    <ChatWorkspaceProvider>
      <ChatDrawerProvider>
        <div className="flex min-h-[100dvh] md:min-h-screen bg-[#050505] text-slate-300 max-md:h-[100dvh] max-md:overflow-hidden">
          <ChatSidebar />
          <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">{children}</div>
        </div>
      </ChatDrawerProvider>
    </ChatWorkspaceProvider>
  );
}
