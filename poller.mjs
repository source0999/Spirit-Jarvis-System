#!/usr/bin/env node
/**
 * SpiritOS — Vital Signs Background Service
 * File: C:\SpiritOS\agents\vital_signs\poller.mjs
 *
 * A standalone Node.js daemon that polls system metrics every 2 seconds
 * and writes them to a local JSON file + exposes a tiny HTTP endpoint.
 * Use this if you're NOT running the Next.js API route (e.g., serving
 * the dashboard as a static file with a separate backend).
 *
 * Usage:
 *   npm install systeminformation
 *   node poller.mjs
 *
 * Endpoints:
 *   GET http://localhost:9001/vitals   → latest VitalsPayload JSON
 *   GET http://localhost:9001/history  → last 60 data points (2-min window)
 */

import si from "systeminformation";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Config ───────────────────────────────────────────────────────────────────
const PORT = 9001;
const POLL_MS = 2000;          // 2 second resolution
const HISTORY_MAX = 60;        // 2 minutes of history
const OLLAMA_HOST = "http://localhost:11434";
const RAM_ALERT_PCT = 85;
const VITALS_CACHE = path.join(__dirname, "vitals_cache.json");

// ─── State ────────────────────────────────────────────────────────────────────
let latest = null;
const history = [];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const r2 = (n) => Math.round(n * 100) / 100;

async function pingOllama() {
  const start = Date.now();
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/tags`, {
      signal: AbortSignal.timeout(2500),
    });
    const latencyMs = Date.now() - start;
    if (!res.ok) return { alive: false, latencyMs, activeModel: null, modelCount: 0 };
    const data = await res.json();
    const models = data?.models ?? [];
    const activeModel =
      models.find((m) => m.name.toLowerCase().includes("dolphin"))?.name ??
      models[0]?.name ?? null;
    return { alive: true, latencyMs, activeModel, modelCount: models.length };
  } catch {
    return { alive: false, latencyMs: Date.now() - start, activeModel: null, modelCount: 0 };
  }
}

async function collectVitals() {
  const [cpuLoad, cpuData, memData, cpuTemp, procs, ollama] = await Promise.all([
    si.currentLoad(),
    si.cpu(),
    si.mem(),
    si.cpuTemperature().catch(() => null),
    si.processes(),
    pingOllama(),
  ]);

  const totalGB = r2(memData.total / 1e9);
  const usedGB  = r2(memData.active / 1e9);
  const usedPct = r2((memData.active / memData.total) * 100);

  const topProcesses = (procs.list ?? [])
    .filter((p) => p.memRss > 0)
    .sort((a, b) => b.memRss - a.memRss)
    .slice(0, 3)
    .map((p) => ({
      pid: p.pid,
      name: p.name,
      memMB: r2(p.memRss / 1e6),
      memPercent: r2(p.mem),
      cpu: r2(p.cpu),
    }));

  const payload = {
    ts: Date.now(),
    cpu: {
      usagePercent: r2(cpuLoad.currentLoad ?? 0),
      coreCount: cpuData.cores ?? 6,
      speedGHz: r2(cpuData.speed ?? 3.8),
      tempC: cpuTemp?.main > 0 ? r2(cpuTemp.main) : null,
      model: cpuData.brand ?? "Ryzen 5 7600",
    },
    ram: {
      usedGB,
      totalGB,
      usedPercent: usedPct,
      freeGB: r2((memData.total - memData.active) / 1e9),
      swapUsedGB: r2((memData.swapused ?? 0) / 1e9),
    },
    topProcesses,
    ramAlert: usedPct >= RAM_ALERT_PCT,
    ollama,
  };

  return payload;
}

// ─── Poll Loop ────────────────────────────────────────────────────────────────
async function poll() {
  try {
    const vitals = await collectVitals();
    latest = vitals;
    history.push({ ts: vitals.ts, cpuPct: vitals.cpu.usagePercent, ramPct: vitals.ram.usedPercent });
    if (history.length > HISTORY_MAX) history.shift();
    fs.writeFileSync(VITALS_CACHE, JSON.stringify(vitals));

    if (vitals.ramAlert) {
      const top = vitals.topProcesses.map(
        (p) => `  [${p.pid}] ${p.name} — ${p.memMB.toFixed(0)}MB (${p.memPercent.toFixed(1)}%)`
      ).join("\n");
      console.warn(`\n⚡ SPIRIT HONESTY ALERT — RAM at ${vitals.ram.usedPercent.toFixed(1)}%`);
      console.warn(`Top memory processes:\n${top}`);
      console.warn(`Consider killing one of the above to free headroom for Dolphin.\n`);
    }
  } catch (err) {
    console.error("[Poller]", err.message);
  }
}

// ─── HTTP Server ──────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");

  if (req.url === "/vitals" && latest) {
    res.end(JSON.stringify(latest));
  } else if (req.url === "/history") {
    res.end(JSON.stringify(history));
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: "Not found" }));
  }
});

server.listen(PORT, () => {
  console.log(`\n[Vital Signs Poller] Running on http://localhost:${PORT}`);
  console.log(`  GET /vitals   → latest snapshot`);
  console.log(`  GET /history  → last ${HISTORY_MAX} points\n`);
});

// Start polling immediately then on interval
poll();
setInterval(poll, POLL_MS);
