"use client";

import { useEffect } from "react";

const INTERVAL_MS = 30 * 60 * 1000;

/**
 * Background YouTube → ledger sync. Silent (no UI); updates JSON on the server.
 */
export default function SonicSyncScheduler() {
  useEffect(() => {
    const ping = () => {
      void fetch("/api/sonic-sync", { method: "GET", cache: "no-store" }).catch(() => {});
    };
    const id = window.setInterval(ping, INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  return null;
}
