import { promises as fs } from "node:fs";
import path from "node:path";

const LOG_PATH = path.join(process.cwd(), "data", "sync-errors.log");

export async function appendSonicSyncError(context: string, err: unknown) {
  const line = {
    ts: new Date().toISOString(),
    context,
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  };
  const text = `${JSON.stringify(line)}\n`;
  try {
    await fs.mkdir(path.dirname(LOG_PATH), { recursive: true });
    await fs.appendFile(LOG_PATH, text, "utf-8");
  } catch {
    /* avoid breaking sync if logging fails */
  }
}
