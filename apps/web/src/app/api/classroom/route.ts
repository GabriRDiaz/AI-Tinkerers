import { DomainError } from "@/lib/server/domain-error";
import {
  googleOAuthConfigured,
  googleOAuthSetupMessage,
} from "@/lib/server/google-oauth";
import { requireGoogleClients } from "@/lib/server/google-request";
import { expectedOrigin, isLoopbackHost, loopbackDenied } from "@/lib/server/http-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = expectedOrigin(request, url);
  if (!isLoopbackHost(origin.hostname)) return loopbackDenied();
  if (!googleOAuthConfigured()) {
    return Response.json(
      { error: googleOAuthSetupMessage() },
      { status: 503 },
    );
  }
  try {
    const connection = await requireGoogleClients(request);
    if (!connection) {
      return Response.json(
        {
          error: "Sign in with Google to load Classroom courses.",
        },
        { status: 401 },
      );
    }
    const courseId = url.searchParams.get("courseId");
    const payload = courseId
      ? {
          courseId,
          assignments: await connection.classroom.listCourseWork(courseId),
        }
      : { courses: await connection.classroom.listCourses() };
    return Response.json(payload, {
      headers: {
        "Cache-Control": "no-store",
        ...(connection.setCookie ? { "Set-Cookie": connection.setCookie } : {}),
      },
    });
  } catch (error) {
    const message =
      error instanceof DomainError
        ? error.message
        : "Unable to read Google Classroom. Check API enablement, scopes, and the signed-in account.";
    return Response.json({ error: message }, { status: 502 });
  }
}
