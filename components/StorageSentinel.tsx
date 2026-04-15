"use client";

import { TapButton } from "@/components/ui/TapButton";
import { HardDrive } from "lucide-react";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface MainDrive {
  id: string;
  label: string;
  mount: string;
  fsType: string;
  sizeBytes: number;
  usedBytes: number;
  usedPercent: number;
  health: "healthy" | "warning" | "offline";
}

interface StoragePayload {
  ts: number;
  mainPc: MainDrive[];
}

const POLL_INTERVAL = 15000;

function formatGb(bytes: number) {
  return `${(bytes / 1e9).toFixed(1)} GB`;
}

function healthColor(health: MainDrive["health"]) {
  if (health === "warning") return "bg-violet-400";
  if (health === "offline") return "bg-violet-700";
  return "bg-violet-500";
}

export default function StorageSentinel() {
  const [storage, setStorage] = useState<StoragePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStorage = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/storage");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as StoragePayload;
      setStorage(data);
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchStorage();
    const timer = setInterval(() => void fetchStorage(), POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [fetchStorage]);

  return (
    <div className="border border-cyan-900/30 bg-black/40 rounded-2xl p-5 backdrop-blur-xl">
      <div className="mb-4 border-b border-cyan-900/20 pb-2 flex items-center justify-between">
        <h2 className="text-xs font-bold text-cyan-400/70 uppercase tracking-[0.2em]">
          Storage_Sentinel
        </h2>
        <TapButton
          type="button"
          onClick={() => void fetchStorage()}
          aria-label="Refresh Storage Sentinel"
          className="p-1 rounded border border-white/5 text-cyan-300/80 hover:text-cyan-200 hover:bg-cyan-500/10 transition-colors"
        >
          <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
        </TapButton>
      </div>

      {error && <p className="text-[11px] text-red-300/80 mb-3">Storage feed error: {error}</p>}

      <div className="space-y-3">
        <p className="text-[10px] text-cyan-300/60 uppercase tracking-wider">Main PC Drives</p>
        {(storage?.mainPc ?? []).length === 0 && (
          <p className="text-[11px] text-cyan-200/60">No active drives detected.</p>
        )}
        {(storage?.mainPc ?? []).map((drive) => (
          <div key={drive.id} className="rounded-lg border border-cyan-900/30 bg-cyan-950/5 p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <HardDrive size={14} className="text-cyan-300/90" />
                <span className="text-[12px] text-cyan-100/90">
                  {drive.label} ({drive.mount})
                </span>
              </div>
              <span className="flex items-center gap-1 text-[10px] text-violet-300">
                <span className={`w-2 h-2 rounded-full ${healthColor(drive.health)}`} />
                {drive.health.toUpperCase()}
              </span>
            </div>
            <div className="h-2 rounded-full bg-cyan-950/40 overflow-hidden border border-cyan-800/40">
              <div
                className="h-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.7)] transition-all duration-500"
                style={{ width: `${drive.usedPercent}%` }}
              />
            </div>
            <div className="mt-2 text-[10px] text-cyan-200/70">
              {formatGb(drive.usedBytes)} / {formatGb(drive.sizeBytes)} used ({drive.usedPercent.toFixed(1)}%)
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
