import { resolve } from "node:path";
import { z } from "zod";
import { DomainError } from "@/lib/server/domain-error";
import { CoursePackStore } from "@/lib/server/course-pack";
import type { DriveDocs } from "@/lib/server/google-clients";
import { requireGoogleClients } from "@/lib/server/google-request";
import { expectedOrigin, isLoopbackHost, loopbackDenied } from "@/lib/server/http-guard";
import { packFileFromBrowse, PACK_SLOTS, type PackFile, type PackSlot } from "@/lib/pack-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const store = new CoursePackStore(
  resolve(process.env.WEB_PACK_DIR || ".data/course-packs"),
);

const bodySchema = z.object({
  intent: z.enum(["document", "topic"]).default("document"),
  courseId: z.string().trim().min(1),
  slot: z.string().optional(),
  title: z.string().optional(),
  fileIds: z.array(z.string().min(1).max(256)).max(20),
});

function reply(value: unknown, status = 200, setCookie?: string) {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...(setCookie ? { "Set-Cookie": setCookie } : {}),
    },
  });
}

async function resolveDriveFiles(drive: DriveDocs, fileIds: string[]) {
  const files: PackFile[] = [];
  const seen = new Set<string>();
  for (const fileId of fileIds) {
    if (seen.has(fileId)) continue;
    seen.add(fileId);
    const item = await drive.inspect(fileId);
    if (item.folder) {
      throw new DomainError("Pick a file from Drive, not a folder.");
    }
    files.push(packFileFromBrowse(item));
  }
  if (!files.length) {
    throw new DomainError("Pick at least one Drive file.");
  }
  return files;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = expectedOrigin(request, url);
  if (!isLoopbackHost(origin.hostname)) return loopbackDenied();
  const courseId = url.searchParams.get("courseId")?.trim();
  if (!courseId) return reply({ error: "Course is required." }, 400);
  try {
    const connection = await requireGoogleClients(request);
    if (!connection) {
      return reply({ error: "Sign in with Google." }, 401);
    }
    const pack = await store.read(connection.session.email, courseId);
    return reply({ pack }, 200, connection.setCookie);
  } catch (error) {
    const message =
      error instanceof DomainError
        ? error.message
        : "Unable to read the course pack.";
    return reply({ error: message }, 502);
  }
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const origin = expectedOrigin(request, url);
  if (!isLoopbackHost(origin.hostname)) return loopbackDenied();
  if (request.headers.get("origin") !== origin.origin) {
    return reply({ error: "Use the controls on this page." }, 403);
  }
  try {
    const connection = await requireGoogleClients(request);
    if (!connection) {
      return reply({ error: "Sign in with Google." }, 401);
    }
    const body = bodySchema.parse(await request.json());
    const files = await resolveDriveFiles(connection.drive, body.fileIds);
    if (body.intent === "topic") {
      const result = await store.addTopic(connection.session.email, body.courseId, {
        title: body.title ?? "",
        notes: files,
      });
      return reply(result, 200, connection.setCookie);
    }
    const slot = String(body.slot ?? "") as PackSlot;
    if (!PACK_SLOTS.includes(slot)) {
      return reply({ error: "Unknown onboarding step." }, 400);
    }
    const result = await store.addFiles(
      connection.session.email,
      body.courseId,
      slot,
      files,
    );
    return reply(result, 200, connection.setCookie);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return reply({ error: "Invalid Drive file selection." }, 400);
    }
    const message =
      error instanceof DomainError
        ? error.message
        : "Unable to attach the Drive file.";
    return reply({ error: message }, 502);
  }
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const origin = expectedOrigin(request, url);
  if (!isLoopbackHost(origin.hostname)) return loopbackDenied();
  if (request.headers.get("origin") !== origin.origin) {
    return reply({ error: "Use the controls on this page." }, 403);
  }
  const courseId = url.searchParams.get("courseId")?.trim();
  const fileId = url.searchParams.get("fileId")?.trim();
  if (!courseId || !fileId) return reply({ error: "File is required." }, 400);
  try {
    const connection = await requireGoogleClients(request);
    if (!connection) {
      return reply({ error: "Sign in with Google." }, 401);
    }
    const pack = await store.removeFile(
      connection.session.email,
      courseId,
      fileId,
    );
    return reply({ pack }, 200, connection.setCookie);
  } catch (error) {
    const message =
      error instanceof DomainError
        ? error.message
        : "Unable to remove the file.";
    return reply({ error: message }, 502);
  }
}
