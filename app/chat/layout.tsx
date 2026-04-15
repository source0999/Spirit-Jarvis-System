import ChatShell from "@/components/chat/ChatShell";
import type { ReactNode } from "react";

export default function ChatLayout({ children }: { children: ReactNode }) {
  return <ChatShell>{children}</ChatShell>;
}
