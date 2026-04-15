import si from "systeminformation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface DriveInfo {
  id: string;
  label: string;
  mount: string;
  fsType: string;
  sizeBytes: number;
  usedBytes: number;
  usedPercent: number;
  health: "healthy" | "warning" | "offline";
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizePercent(value?: number) {
  if (typeof value !== "number") return 0;
  return Math.max(0, Math.min(100, round2(value)));
}

function inferHealth(usagePercent: number): DriveInfo["health"] {
  if (usagePercent >= 90) return "warning";
  return "healthy";
}

export async function GET() {
  try {
    const [fileSystems, layouts] = await Promise.all([si.fsSize(), si.diskLayout()]);

    const anyLayoutOffline = layouts.some((layout) => {
      const status = layout.smartStatus?.toLowerCase();
      return status === "predicted failure" || status === "failure";
    });

    const mainPcDrives: DriveInfo[] = fileSystems.map((drive, index) => {
      const usedPercent = normalizePercent(drive.use);
      const health = anyLayoutOffline ? "warning" : inferHealth(usedPercent);
      const label = drive.label?.trim() || drive.fs || `Drive ${index + 1}`;
      return {
        id: `${drive.mount}-${index}`,
        label,
        mount: drive.mount,
        fsType: drive.type,
        sizeBytes: drive.size,
        usedBytes: drive.used,
        usedPercent,
        health,
      };
    });

    const payload = {
      ts: Date.now(),
      mainPc: mainPcDrives,
    };

    return Response.json(payload, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return Response.json(
      { error: "Failed to collect storage metrics.", detail: String(error) },
      { status: 500 },
    );
  }
}
