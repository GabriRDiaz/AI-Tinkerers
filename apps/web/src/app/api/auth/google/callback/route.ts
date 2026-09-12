import {
  clearCookieHeader,
  exchangeCode,
  GOOGLE_OAUTH_STATE_COOKIE,
  readCookie,
  sessionCookie,
} from "@/lib/server/google-oauth";
import { expectedOrigin, isLoopbackHost, loopbackDenied } from "@/lib/server/http-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = expectedOrigin(request, url);
  if (!isLoopbackHost(origin.hostname)) return loopbackDenied();
  const secure = url.protocol === "https:";
  const home = `${origin.protocol}//${origin.host}/`;
  const fail = (reason: string) =>
    new Response(null, {
      status: 302,
      headers: {
        Location: `${home}?google_error=${encodeURIComponent(reason)}`,
        "Set-Cookie": clearCookieHeader(GOOGLE_OAUTH_STATE_COOKIE, {
          path: "/api/auth",
          secure,
        }),
        "Cache-Control": "no-store",
      },
    });

  const error = url.searchParams.get("error");
  if (error) return fail("Google sign-in was cancelled or denied.");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expected = readCookie(request, GOOGLE_OAUTH_STATE_COOKIE);
  if (!code || !state || !expected || state !== expected) {
    return fail("The Google sign-in state did not match. Try again.");
  }

  try {
    const session = await exchangeCode(code);
    const headers = new Headers({
      Location: home,
      "Cache-Control": "no-store",
    });
    headers.append("Set-Cookie", sessionCookie(session, secure));
    headers.append(
      "Set-Cookie",
      clearCookieHeader(GOOGLE_OAUTH_STATE_COOKIE, {
        path: "/api/auth",
        secure,
      }),
    );
    return new Response(null, { status: 302, headers });
  } catch {
    return fail("Google sign-in failed. Check OAuth credentials and try again.");
  }
}
