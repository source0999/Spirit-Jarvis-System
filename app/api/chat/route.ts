import { filterChatLogBySession } from "@/lib/chat-session";
import { appendChatMessage, readChatLog } from "@/lib/server/chat-log-store";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("sessionId");
  const all = await readChatLog();
  const messages = sessionId ? filterChatLogBySession(all, sessionId) : all;
  return Response.json({ messages }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      id?: string;
      role?: string;
      content?: string;
      sessionId?: string;
    };
    const role = body.role === "user" || body.role === "assistant" ? body.role : null;
    const content = typeof body.content === "string" ? body.content : "";
    if (!role || !content.trim()) {
      return Response.json({ error: "Invalid message" }, { status: 400 });
    }
    const id =
      typeof body.id === "string" && body.id.trim()
        ? body.id.trim()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const sessionId =
      typeof body.sessionId === "string" && body.sessionId.trim() ? body.sessionId.trim() : undefined;
    const saved = await appendChatMessage({ id, role, content: content.trim(), sessionId });
    return Response.json({ message: saved }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 });
  }
}
