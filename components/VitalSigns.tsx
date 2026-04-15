"use client";
/**
 * SpiritOS — Vital Signs Component
 * File: components/VitalSigns.tsx
 *
 * Glassmorphic matrix aesthetic. Polls /api/vitals every 2s (Next.js route)
 * OR http://localhost:9001/vitals (standalone poller).
 *
 * Set NEXT_PUBLIC_VITALS_URL in .env.local to override the endpoint:
 *   NEXT_PUBLIC_VITALS_URL=http://localhost:9001/vitals
 *
 * No external charting library — pure SVG sparklines for zero bundle cost.
 */

import { TapButton } from "@/components/ui/TapButton";
import { useEffect, useRef, useState, useCallback } from "react";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface ProcessInfo {
  pid: number;
  name: string;
  memMB: number;
  memPercent: number;
  cpu: number;
}
interface OllamaStatus {
  alive: boolean;
  latencyMs: number | null;
  activeModel: string | null;
  modelCount: number;
}
interface VitalsPayload {
  ts: number;
  cpu: { usagePercent: number; coreCount: number; speedGHz: number; tempC: number | null; model: string };
  ram: { usedGB: number; totalGB: number; usedPercent: number; freeGB: number; swapUsedGB: number };
  topProcesses: ProcessInfo[];
  ramAlert: boolean;
  ollama: OllamaStatus;
}
interface HistoryPoint { ts: number; cpuPct: number; ramPct: number }

// ─── Constants ─────────────────────────────────────────────────────────────────
const VITALS_URL =
  process.env.NEXT_PUBLIC_VITALS_URL ?? "/api/vitals";
const HISTORY_URL =
  process.env.NEXT_PUBLIC_VITALS_URL?.replace("/vitals", "/history") ?? null;
const POLL_MS = 2000;
const HISTORY_LEN = 60;

// ─── Sparkline ─────────────────────────────────────────────────────────────────
function Sparkline({
  data,
  color,
  fillColor,
  height = 48,
}: {
  data: number[];
  color: string;
  fillColor: string;
  height?: number;
}) {
  if (data.length < 2) return null;
  const w = 300;
  const h = height;
  const pad = 2;
  const xs = data.map((_, i) => pad + (i / (data.length - 1)) * (w - pad * 2));
  const ys = data.map((v) => h - pad - (v / 100) * (h - pad * 2));
  const line = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  const area = `${line} L${xs[xs.length - 1].toFixed(1)},${h} L${xs[0].toFixed(1)},${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: "100%", height }}>
      <defs>
        <linearGradient id={`fg-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fillColor} stopOpacity="0.35" />
          <stop offset="100%" stopColor={fillColor} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#fg-${color.replace("#", "")})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ─── Ring Gauge ────────────────────────────────────────────────────────────────
function RingGauge({ value, color, size = 72 }: { value: number; color: string; size?: number }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth="5"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.4s ease" }}
      />
    </svg>
  );
}

// ─── Smart Kill Alert ──────────────────────────────────────────────────────────
function SmartKillAlert({ procs, ramPct }: { procs: ProcessInfo[]; ramPct: number }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div style={{
      border: "1px solid rgba(255,60,60,0.5)",
      borderRadius: 12,
      background: "rgba(255,20,20,0.07)",
      backdropFilter: "blur(12px)",
      padding: "14px 16px",
      marginBottom: 16,
      position: "relative",
      animation: "alertPulse 2s ease-in-out infinite",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 13, color: "#ff5555", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 500, letterSpacing: "0.08em" }}>
          ⚡ SPIRIT HONESTY PROTOCOL — RAM {ramPct.toFixed(1)}% CRITICAL
        </span>
        <TapButton
          type="button"
          onClick={() => setDismissed(true)}
          className="ml-auto bg-transparent border-0 text-white/30 cursor-pointer text-base leading-none p-1 rounded min-w-[2rem]"
        >
          ×
        </TapButton>
      </div>
      <p style={{ fontSize: 11, color: "rgba(255,200,200,0.75)", marginBottom: 10, fontFamily: "'IBM Plex Mono', monospace", lineHeight: 1.6 }}>
        Spirit is memory-constrained. Kill one of these to free headroom for Dolphin:
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {procs.map((p, i) => (
          <div key={p.pid} style={{
            display: "flex", alignItems: "center", gap: 10,
            background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "6px 10px",
          }}>
            <span style={{ fontSize: 10, color: "#ff5555", fontFamily: "'IBM Plex Mono', monospace", minWidth: 14 }}>
              {i + 1}.
            </span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", fontFamily: "'IBM Plex Mono', monospace", flex: 1 }}>
              {p.name}
            </span>
            <span style={{ fontSize: 11, color: "#ff9999", fontFamily: "'IBM Plex Mono', monospace" }}>
              {p.memMB.toFixed(0)}MB
            </span>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'IBM Plex Mono', monospace" }}>
              PID {p.pid}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function VitalSigns() {
  const [vitals, setVitals] = useState<VitalsPayload | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>("");
  const localHistory = useRef<HistoryPoint[]>([]);

  const fetchVitals = useCallback(async () => {
    try {
      const res = await fetch(VITALS_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: VitalsPayload = await res.json();
      setVitals(data);
      setError(null);
      setLastUpdate(new Date().toLocaleTimeString());

      // Build local history if standalone poller history endpoint unavailable
      if (!HISTORY_URL) {
        localHistory.current.push({
          ts: data.ts,
          cpuPct: data.cpu.usagePercent,
          ramPct: data.ram.usedPercent,
        });
        if (localHistory.current.length > HISTORY_LEN) localHistory.current.shift();
        setHistory([...localHistory.current]);
      }
    } catch (e) {
      setError(String(e));
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    if (!HISTORY_URL) return;
    try {
      const res = await fetch(HISTORY_URL);
      if (res.ok) setHistory(await res.json());
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchVitals();
    fetchHistory();
    const iv1 = setInterval(fetchVitals, POLL_MS);
    const iv2 = setInterval(fetchHistory, POLL_MS * 2);
    return () => { clearInterval(iv1); clearInterval(iv2); };
  }, [fetchVitals, fetchHistory]);

  const cpuHistory = history.map((h) => h.cpuPct);
  const ramHistory = history.map((h) => h.ramPct);

  const cpuColor  = "#22d3ee"; // cyan
  const ramColor  = vitals?.ramAlert ? "#ff5555" : "#a78bfa"; // red if alert, else purple
  const ollamaColor = vitals?.ollama.alive ? "#4ade80" : "#f87171";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Rajdhani:wght@400;500;600&display=swap');

        .vs-root { font-family: 'Rajdhani', sans-serif; }

        @keyframes alertPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,60,60,0); }
          50% { box-shadow: 0 0 18px 2px rgba(255,60,60,0.25); }
        }
        @keyframes scanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .vs-card {
          background: rgba(10, 10, 20, 0.65);
          backdrop-filter: blur(16px);
          border: 0.5px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          padding: 16px 18px;
          animation: fadeSlideIn 0.4s ease both;
        }
        .vs-card:hover {
          border-color: rgba(255,255,255,0.18);
        }
        .vs-label {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.35);
        }
        .vs-value {
          font-size: 32px;
          font-weight: 600;
          line-height: 1.1;
          letter-spacing: -0.01em;
        }
        .vs-sub {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11px;
          color: rgba(255,255,255,0.4);
        }
        .ollama-dot {
          display: inline-block;
          width: 7px; height: 7px;
          border-radius: 50%;
          margin-right: 6px;
          animation: blink 2s infinite;
        }
        .grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        @media (max-width: 640px) {
          .grid-2 { grid-template-columns: 1fr; }
          .vs-value { font-size: 28px; }
        }
        .scanline-overlay {
          position: absolute; inset: 0; overflow: hidden;
          pointer-events: none; border-radius: 12px; opacity: 0.03;
        }
        .scanline-bar {
          width: 100%; height: 3px;
          background: linear-gradient(to bottom, transparent, #22d3ee, transparent);
          animation: scanline 6s linear infinite;
        }
      `}</style>

      <div className="vs-root" style={{ color: "white" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <h1 style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 500, letterSpacing: "0.15em", color: "#22d3ee", marginBottom: 2 }}>
              SPIRIT OS — VITAL SIGNS
            </h1>
            <p className="vs-sub" style={{ fontSize: 10 }}>
              {vitals?.cpu.model ?? "—"} · {lastUpdate ? `SYNC ${lastUpdate}` : "CONNECTING..."}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span className="ollama-dot" style={{ background: ollamaColor, animationPlayState: vitals?.ollama.alive ? "running" : "paused" }} />
            <span className="vs-label" style={{ fontSize: 10 }}>
              {vitals?.ollama.alive ? vitals.ollama.activeModel ?? "OLLAMA ACTIVE" : "OLLAMA OFFLINE"}
            </span>
          </div>
        </div>

        {/* Smart Kill Alert */}
        {vitals?.ramAlert && (
          <SmartKillAlert procs={vitals.topProcesses} ramPct={vitals.ram.usedPercent} />
        )}

        {/* Error state */}
        {error && (
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#f87171", marginBottom: 16, padding: "10px 14px", border: "0.5px solid rgba(248,113,113,0.3)", borderRadius: 8, background: "rgba(248,113,113,0.05)" }}>
            FEED ERROR — {error}. Is /api/vitals running?
          </div>
        )}

        {/* Main gauges */}
        <div className="grid-2" style={{ marginBottom: 12 }}>

          {/* CPU Card */}
          <div className="vs-card" style={{ position: "relative", animationDelay: "0ms" }}>
            <div className="scanline-overlay"><div className="scanline-bar" /></div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div>
                <div className="vs-label" style={{ marginBottom: 4 }}>CPU Load</div>
                <div className="vs-value" style={{ color: cpuColor }}>
                  {vitals ? `${vitals.cpu.usagePercent.toFixed(1)}%` : "—"}
                </div>
                <div className="vs-sub" style={{ marginTop: 3 }}>
                  {vitals ? `${vitals.cpu.coreCount} cores · ${vitals.cpu.speedGHz}GHz` : "Ryzen 5 7600"}
                </div>
                {vitals?.cpu.tempC && (
                  <div className="vs-sub" style={{ marginTop: 2, color: vitals.cpu.tempC > 80 ? "#f87171" : "rgba(255,255,255,0.4)" }}>
                    {vitals.cpu.tempC}°C
                  </div>
                )}
              </div>
              <div style={{ position: "relative" }}>
                <RingGauge value={vitals?.cpu.usagePercent ?? 0} color={cpuColor} size={68} />
                <div style={{
                  position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 500, color: cpuColor,
                }}>
                  {vitals ? `${Math.round(vitals.cpu.usagePercent)}` : "—"}
                </div>
              </div>
            </div>
            <Sparkline data={cpuHistory} color={cpuColor} fillColor={cpuColor} height={44} />
          </div>

          {/* RAM Card */}
          <div className="vs-card" style={{ position: "relative", animationDelay: "80ms" }}>
            <div className="scanline-overlay"><div className="scanline-bar" style={{ animationDelay: "3s" }} /></div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div>
                <div className="vs-label" style={{ marginBottom: 4 }}>RAM Usage</div>
                <div className="vs-value" style={{ color: ramColor }}>
                  {vitals ? `${vitals.ram.usedPercent.toFixed(1)}%` : "—"}
                </div>
                <div className="vs-sub" style={{ marginTop: 3 }}>
                  {vitals ? `${vitals.ram.usedGB.toFixed(1)} / ${vitals.ram.totalGB.toFixed(0)} GB` : "16 GB"}
                </div>
                <div className="vs-sub" style={{ marginTop: 2 }}>
                  {vitals ? `${vitals.ram.freeGB.toFixed(1)} GB free` : "—"}
                </div>
              </div>
              <div style={{ position: "relative" }}>
                <RingGauge value={vitals?.ram.usedPercent ?? 0} color={ramColor} size={68} />
                <div style={{
                  position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 500, color: ramColor,
                }}>
                  {vitals ? `${Math.round(vitals.ram.usedPercent)}` : "—"}
                </div>
              </div>
            </div>
            <Sparkline data={ramHistory} color={ramColor} fillColor={ramColor} height={44} />
          </div>
        </div>

        {/* Ollama Status Bar */}
        <div className="vs-card" style={{ marginBottom: 12, animationDelay: "140ms" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <div>
              <div className="vs-label" style={{ marginBottom: 3 }}>Ollama</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span className="ollama-dot" style={{ background: ollamaColor, width: 6, height: 6, animationPlayState: vitals?.ollama.alive ? "running" : "paused" }} />
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: ollamaColor, fontWeight: 500 }}>
                  {vitals?.ollama.alive ? "ALIVE" : "OFFLINE"}
                </span>
              </div>
            </div>
            <div>
              <div className="vs-label" style={{ marginBottom: 3 }}>Active Model</div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "rgba(255,255,255,0.8)" }}>
                {vitals?.ollama.activeModel ?? "—"}
              </div>
            </div>
            <div>
              <div className="vs-label" style={{ marginBottom: 3 }}>Latency</div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: vitals?.ollama.latencyMs && vitals.ollama.latencyMs < 200 ? "#4ade80" : "#f59e0b" }}>
                {vitals?.ollama.latencyMs != null ? `${vitals.ollama.latencyMs}ms` : "—"}
              </div>
            </div>
            <div>
              <div className="vs-label" style={{ marginBottom: 3 }}>Models</div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "rgba(255,255,255,0.8)" }}>
                {vitals?.ollama.modelCount ?? "—"}
              </div>
            </div>
          </div>
        </div>

        {/* Top Processes */}
        <div className="vs-card" style={{ animationDelay: "200ms" }}>
          <div className="vs-label" style={{ marginBottom: 12 }}>Memory — Top Processes</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[...(vitals?.topProcesses ?? []), null, null, null].slice(0, 3).map((p, i) => {
              const filled = !!p?.name;
              const barPct = p?.memPercent ?? 0;
              const isHeavy = barPct > 15;
              return (
                <div key={p?.pid ?? i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "rgba(255,255,255,0.25)", minWidth: 14 }}>{i + 1}</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: filled ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.12)", minWidth: 140 }}>
                    {p?.name ?? "—"}
                  </span>
                  <div style={{ flex: 1, height: 3, background: "rgba(255,255,255,0.07)", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ width: `${barPct}%`, height: "100%", background: isHeavy ? "#f87171" : "#a78bfa", borderRadius: 2, transition: "width 0.4s ease" }} />
                  </div>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: filled ? (isHeavy ? "#f87171" : "rgba(255,255,255,0.5)") : "rgba(255,255,255,0.1)", minWidth: 55, textAlign: "right" }}>
                    {p?.memMB != null ? `${p.memMB.toFixed(0)}MB` : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="vs-label" style={{ fontSize: 9 }}>
            SPIRIT OS · BODY NODE: SEED (MAIN) · {history.length * (POLL_MS / 1000)}s HISTORY
          </span>
          <span className="vs-label" style={{ fontSize: 9, color: vitals?.ramAlert ? "#f87171" : "rgba(255,255,255,0.2)" }}>
            {vitals?.ramAlert ? "⚡ SMART KILL ACTIVE" : "ALL SYSTEMS NOMINAL"}
          </span>
        </div>
      </div>
    </>
  );
}
