import {
  googleOAuthConfigured,
  googleOAuthSetupMessage,
} from "@/lib/server/google-oauth";
import { publicUser, requireGoogleClients } from "@/lib/server/google-request";
import { DomainError } from "@/lib/server/domain-error";
import { expectedOrigin, isLoopbackHost, loopbackDenied } from "@/lib/server/http-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = expectedOrigin(request, url);
  if (!isLoopbackHost(origin.hostname)) return loopbackDenied();
  if (!googleOAuthConfigured()) {
    return Response.json({
      status: "unconfigured",
      message: googleOAuthSetupMessage(),
    });
  }
  try {
    const connection = await requireGoogleClients(request);
    if (!connection) {
      return Response.json({
        status: "signed_out",
        message: "Sign in with Google to load Classroom courses and Drive files.",
      });
    }
    return Response.json(
      { status: "signed_in", user: publicUser(connection.session) },
      {
        headers: {
          "Cache-Control": "no-store",
          ...(connection.setCookie ? { "Set-Cookie": connection.setCookie } : {}),
        },
      },
    );
  } catch (error) {
    const message =
      error instanceof DomainError
        ? error.message
        : "Unable to verify the Google session. Sign in again.";
    return Response.json({ status: "signed_out", message }, { status: 200 });
  }
}
