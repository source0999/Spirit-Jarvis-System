import { NextRequest } from "next/server";
import {
  createOAuthClient,
  generateYouTubeAuthUrl,
  resolveOAuthAppOrigin,
  writeStoredTokens,
} from "@/lib/youtube-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const appOrigin = resolveOAuthAppOrigin();
  const { authUrl, redirectUri } = await generateYouTubeAuthUrl();
  const oauth2Client = await createOAuthClient(redirectUri);
  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    return Response.redirect(authUrl);
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    await writeStoredTokens(tokens);
    return Response.redirect(`${appOrigin}/?sonicAuth=ok`);
  } catch (error) {
    return Response.redirect(
      `${appOrigin}/?sonicAuth=error&reason=${encodeURIComponent(String(error))}`,
    );
  }
}
