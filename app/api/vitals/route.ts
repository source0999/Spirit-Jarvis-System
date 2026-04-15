/**
 * SpiritOS — Vital Signs API Route
 * File: app/api/vitals/route.ts  (Next.js App Router)
 *
 * Pulls real-time system metrics via the `systeminformation` package
 * and pings the local Ollama instance for liveness + latency.
 *
 * Install deps:
 *   npm install systeminformation
 *
 * GET /api/vitals
 * Returns: VitalsPayload JSON
 */

import { NextResponse } from "next/server";
import si from "systeminformation";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProcessInfo {
  pid: number;
  name: string;
  memMB: number;
  memPercent: number;
  cpu: number;
}

export interface OllamaStatus {
  alive: boolean;
  latencyMs: number | null;
  activeModel: string | null;
  modelCount: number;
}

export interface VitalsPayload {
  ts: number; // Unix ms

  cpu: {
    usagePercent: number; // 0–100
    coreCount: number;
    speedGHz: number;
    tempC: number | null; // null if sensor unavailable on Windows
    model: string;
  };

  ram: {
    usedGB: number;
    totalGB: number;
    usedPercent: number; // 0–100
    freeGB: number;
    swapUsedGB: number;
  };

  /** Top 3 memory-hungry processes — populated always, drives Smart Kill */
  topProcesses: ProcessInfo[];

  /** Whether RAM has breached the 85% Smart Kill threshold */
  ramAlert: boolean;

  ollama: OllamaStatus;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const OLLAMA_BASE = process.env.OLLAMA_HOST ?? "http://localhost:11434";
const RAM_ALERT_THRESHOLD = 0.85; // 85%

async function pingOllama(): Promise<OllamaStatus> {
  const start = Date.now();
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    const latencyMs = Date.now() - start;

    if (!res.ok) {
      return { alive: false, latencyMs, activeModel: null, modelCount: 0 };
    }

    const data = await res.json();
    const models: { name: string }[] = data?.models ?? [];
    const activeModel =
      models.find((m) =>
        m.name.toLowerCase().includes("dolphin")
      )?.name ??
      models[0]?.name ??
      null;

    return {
      alive: true,
      latencyMs,
      activeModel,
      modelCount: models.length,
    };
  } catch {
    return {
      alive: false,
      latencyMs: Date.now() - start,
      activeModel: null,
      modelCount: 0,
    };
  }
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function GET() {
  try {
    // Fire all data fetches concurrently
    const [cpuLoad, cpuData, memData, cpuTemp, processes, ollamaStatus] =
      await Promise.all([
        si.currentLoad(),
        si.cpu(),
        si.mem(),
        si.cpuTemperature().catch(() => null),
        si.processes(),
        pingOllama(),
      ]);

    // ── CPU
    const usagePercent = round2(cpuLoad.currentLoad ?? 0);
    const tempC =
      cpuTemp?.main != null && cpuTemp.main > 0
        ? round2(cpuTemp.main)
        : null;

    // ── RAM
    const totalGB = round2(memData.total / 1e9);
    const usedGB = round2(memData.active / 1e9);
    const freeGB = round2((memData.total - memData.active) / 1e9);
    const usedPercent = round2((memData.active / memData.total) * 100);
    const swapUsedGB = round2((memData.swapused ?? 0) / 1e9);

    // ── Top 3 memory processes
    const topProcesses: ProcessInfo[] = (processes.list ?? [])
      .filter((p) => p.memRss > 0)
      .sort((a, b) => b.memRss - a.memRss)
      .slice(0, 3)
      .map((p) => ({
        pid: p.pid,
        name: p.name,
        memMB: round2(p.memRss / 1e6),
        memPercent: round2(p.mem),
        cpu: round2(p.cpu),
      }));

    const payload: VitalsPayload = {
      ts: Date.now(),

      cpu: {
        usagePercent,
        coreCount: cpuData.cores ?? cpuLoad.cpus?.length ?? 6,
        speedGHz: round2(cpuData.speed ?? 3.8),
        tempC,
        model: cpuData.brand ?? "Ryzen 5 7600",
      },

      ram: {
        usedGB,
        totalGB,
        usedPercent,
        freeGB,
        swapUsedGB,
      },

      topProcesses,
      ramAlert: usedPercent / 100 >= RAM_ALERT_THRESHOLD,

      ollama: ollamaStatus,
    };

    return NextResponse.json(payload, {
      headers: {
        // Allow the dashboard to poll without CORS issues if served separately
        "Access-Control-Allow-Origin": "*",
        // Short cache — we want near-real-time data
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[Vitals API]", err);
    return NextResponse.json(
      { error: "Failed to collect vitals", detail: String(err) },
      { status: 500 }
    );
  }
}
