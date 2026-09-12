import {
  clearCookieHeader,
  GOOGLE_SESSION_COOKIE,
} from "@/lib/server/google-oauth";
import { expectedOrigin, isLoopbackHost, loopbackDenied } from "@/lib/server/http-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request) {
  const url = new URL(request.url);
  const origin = expectedOrigin(request, url);
  if (!isLoopbackHost(origin.hostname)) return loopbackDenied();
  if (request.headers.get("origin") !== origin.origin) {
    return Response.json(
      { error: "Use the sign-out control from this app's own page." },
      { status: 403 },
    );
  }
  const secure = url.protocol === "https:";
  return Response.json(
    { status: "signed_out" },
    {
      headers: {
        "Cache-Control": "no-store",
        "Set-Cookie": clearCookieHeader(GOOGLE_SESSION_COOKIE, { secure }),
      },
    },
  );
}
