"use client";

import { TapButton } from "@/components/ui/TapButton";
import { Folder, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "spirit.boundWorkspace";

interface ProjectItem {
  name: string;
  relativePath: string;
  lastEditedMs: number;
}

function formatRelativeTime(timestamp: number) {
  const deltaMs = timestamp - Date.now();
  const absSeconds = Math.abs(Math.round(deltaMs / 1000));
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (absSeconds < 60) return `Edited ${rtf.format(Math.round(deltaMs / 1000), "second")}`;
  if (absSeconds < 3600) return `Edited ${rtf.format(Math.round(deltaMs / 60000), "minute")}`;
  if (absSeconds < 86400) return `Edited ${rtf.format(Math.round(deltaMs / 3600000), "hour")}`;
  return `Edited ${rtf.format(Math.round(deltaMs / 86400000), "day")}`;
}

export default function ProjectPortalWidget() {
  const [boundDirectory, setBoundDirectory] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProjects = useCallback(
    async (targetDir: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/workspace-projects?dir=${encodeURIComponent(targetDir)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setProjects(data.projects ?? []);
      } catch (err) {
        setError(`Scan failed: ${String(err)}`);
        setProjects([]);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setBoundDirectory(saved);
      void loadProjects(saved);
    }
  }, [loadProjects]);

  const handleBind = () => {
    const proposed = window.prompt("Select Folder: enter absolute path", boundDirectory ?? "C:\\");
    const selected = proposed?.trim();
    if (!selected) return;
    window.localStorage.setItem(STORAGE_KEY, selected);
    setBoundDirectory(selected);
    void loadProjects(selected);
  };

  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => b.lastEditedMs - a.lastEditedMs),
    [projects],
  );

  return (
    <div className="border border-cyan-900/30 bg-black/40 rounded-2xl p-5 backdrop-blur-xl">
      <div className="flex items-center justify-between mb-4 border-b border-cyan-900/20 pb-2">
        <h2 className="text-xs font-bold text-cyan-400/70 uppercase tracking-[0.2em]">Project_Portal</h2>
        <TapButton
          type="button"
          onClick={() => boundDirectory && void loadProjects(boundDirectory)}
          className="text-cyan-400/70 hover:text-cyan-300 transition-colors p-1 rounded"
          aria-label="Refresh projects"
        >
          <RefreshCw size={14} />
        </TapButton>
      </div>

      {!boundDirectory ? (
        <div className="min-h-[220px] flex flex-col items-center justify-center gap-4 text-center">
          <Folder className="text-cyan-500/80" size={28} />
          <p className="text-xs text-cyan-100/70 max-w-[220px]">
            No workspace bound. Select a local folder to list project directories.
          </p>
          <TapButton
            type="button"
            onClick={handleBind}
            className="px-4 py-2 bg-cyan-950/30 hover:bg-cyan-500/10 border border-cyan-500/40 text-cyan-300 text-[11px] uppercase tracking-wider rounded"
          >
            Select Folder
          </TapButton>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-[10px] text-cyan-200/60 break-all">
            Bound: <span className="text-cyan-200/80">{boundDirectory}</span>
          </div>
          <div className="flex gap-2">
            <TapButton
              type="button"
              onClick={handleBind}
              className="px-3 py-1 border border-cyan-500/40 rounded text-[10px] uppercase tracking-wider text-cyan-300 hover:bg-cyan-500/10"
            >
              Select Folder
            </TapButton>
          </div>
          <div className="max-h-[260px] overflow-y-auto pr-1 space-y-2">
            {loading && <p className="text-[11px] text-cyan-300/70">Scanning workspace...</p>}
            {!loading && error && <p className="text-[11px] text-red-300/80">{error}</p>}
            {!loading && !error && sortedProjects.length === 0 && (
              <p className="text-[11px] text-cyan-200/60">No sub-folders found in this workspace.</p>
            )}
            {!loading &&
              !error &&
              sortedProjects.map((project) => (
                <div
                  key={project.relativePath}
                  className="rounded-lg border border-cyan-900/30 bg-cyan-950/5 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <Folder size={14} className="text-cyan-400/80 shrink-0" />
                    <span className="text-[12px] text-cyan-100/90 truncate">{project.name}</span>
                  </div>
                  <p className="text-[10px] text-cyan-300/60 mt-1">{formatRelativeTime(project.lastEditedMs)}</p>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
