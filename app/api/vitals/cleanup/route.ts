import { exec } from "node:child_process";
import { promisify } from "node:util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execAsync = promisify(exec);

async function killIfRunning(imageName: string) {
  try {
    const { stdout } = await execAsync(`taskkill /F /IM ${imageName} /T`);
    return { imageName, ok: true, output: stdout.trim() };
  } catch (error) {
    return { imageName, ok: false, output: String(error) };
  }
}

export async function POST() {
  const [opera, discord] = await Promise.all([
    killIfRunning("opera.exe"),
    killIfRunning("discord.exe"),
  ]);

  return Response.json(
    {
      ok: opera.ok || discord.ok,
      actions: [opera, discord],
      ts: Date.now(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
