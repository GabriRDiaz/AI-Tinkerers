import { randomBytes } from "node:crypto";
import {
  authorizationUrl,
  cookieHeader,
  googleOAuthConfigured,
  googleOAuthSetupMessage,
  GOOGLE_OAUTH_STATE_COOKIE,
} from "@/lib/server/google-oauth";
import { expectedOrigin, isLoopbackHost, loopbackDenied } from "@/lib/server/http-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const url = new URL(request.url);
  const origin = expectedOrigin(request, url);
  if (!isLoopbackHost(origin.hostname)) return loopbackDenied();
  if (!googleOAuthConfigured()) {
    return Response.json({ error: googleOAuthSetupMessage() }, { status: 503 });
  }
  const state = randomBytes(24).toString("hex");
  const secure = url.protocol === "https:";
  return new Response(null, {
    status: 302,
    headers: {
      Location: authorizationUrl(state),
      "Set-Cookie": cookieHeader(GOOGLE_OAUTH_STATE_COOKIE, state, {
        maxAge: 600,
        path: "/api/auth",
        secure,
      }),
      "Cache-Control": "no-store",
    },
  });
}
