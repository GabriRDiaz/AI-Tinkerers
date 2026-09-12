import { DomainError } from "@/lib/server/domain-error";
import { requireGoogleClients } from "@/lib/server/google-request";
import { expectedOrigin, isLoopbackHost, loopbackDenied } from "@/lib/server/http-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function reply(value: unknown, status = 200, setCookie?: string) {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...(setCookie ? { "Set-Cookie": setCookie } : {}),
    },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = expectedOrigin(request, url);
  if (!isLoopbackHost(origin.hostname)) return loopbackDenied();
  const folderId = url.searchParams.get("folderId")?.trim() || "root";
  const pageToken = url.searchParams.get("pageToken")?.trim() || undefined;
  const query = url.searchParams.get("q")?.trim() || undefined;
  const shared = url.searchParams.get("view") === "shared";
  try {
    const connection = await requireGoogleClients(request);
    if (!connection) {
      return reply({ error: "Sign in with Google." }, 401);
    }
    const result = await connection.drive.browse(folderId, pageToken, {
      query,
      shared,
    });
    return reply(result, 200, connection.setCookie);
  } catch (error) {
    const message =
      error instanceof DomainError
        ? error.message
        : "Unable to list Google Drive files.";
    return reply({ error: message }, 502);
  }
}
