"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type ChatDrawerContextValue = {
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
};

const ChatDrawerContext = createContext<ChatDrawerContextValue | null>(null);

export function ChatDrawerProvider({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const toggleDrawer = useCallback(() => setDrawerOpen((o) => !o), []);

  const value = useMemo(
    () => ({ drawerOpen, openDrawer, closeDrawer, toggleDrawer }),
    [drawerOpen, openDrawer, closeDrawer, toggleDrawer],
  );

  return <ChatDrawerContext.Provider value={value}>{children}</ChatDrawerContext.Provider>;
}

export function useChatDrawer() {
  const ctx = useContext(ChatDrawerContext);
  if (!ctx) throw new Error("useChatDrawer must be used within ChatDrawerProvider");
  return ctx;
}
