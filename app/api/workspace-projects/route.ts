import { promises as fs } from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ProjectMeta {
  name: string;
  relativePath: string;
  lastEditedMs: number;
}

function isAbsolutePath(input: string) {
  return path.isAbsolute(input);
}

export async function GET(request: NextRequest) {
  const selectedDir = request.nextUrl.searchParams.get("dir");

  if (!selectedDir) {
    return Response.json({ error: "Missing 'dir' query parameter." }, { status: 400 });
  }

  if (!isAbsolutePath(selectedDir)) {
    return Response.json({ error: "The selected directory path must be absolute." }, { status: 400 });
  }

  try {
    const rootStat = await fs.stat(selectedDir);
    if (!rootStat.isDirectory()) {
      return Response.json({ error: "Selected path is not a directory." }, { status: 400 });
    }

    const entries = await fs.readdir(selectedDir, { withFileTypes: true });

    const projects = (
      await Promise.all(
        entries
          .filter((entry) => entry.isDirectory())
          .map(async (entry): Promise<ProjectMeta | null> => {
            const absolutePath = path.join(selectedDir, entry.name);
            try {
              const stats = await fs.stat(absolutePath);
              return {
                name: entry.name,
                relativePath: path.relative(selectedDir, absolutePath) || entry.name,
                lastEditedMs: stats.mtimeMs,
              };
            } catch {
              return null;
            }
          }),
      )
    )
      .filter((item): item is ProjectMeta => item !== null)
      .sort((a, b) => b.lastEditedMs - a.lastEditedMs);

    return Response.json(
      {
        root: selectedDir,
        count: projects.length,
        projects,
      },
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    return Response.json(
      { error: "Failed to scan workspace folder.", detail: String(error) },
      { status: 500 },
    );
  }
}
