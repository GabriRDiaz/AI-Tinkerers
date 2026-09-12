import { randomBytes } from "node:crypto";
import { z } from "zod";
import { DomainError } from "./domain-error";
import { DocApprovalService } from "./doc-approvals";
import type { DriveDocs } from "./google-clients";
import { expectedOrigin, isLoopbackHost, loopbackDenied } from "./http-guard";

const cookieName = "web-doc-session";
const command = z.discriminatedUnion("operation", [
  z
    .object({
      operation: z.literal("propose"),
      courseId: z.string(),
      courseWorkId: z.string().optional().nullable(),
      title: z.string(),
      details: z.string(),
    })
    .strict(),
  z.object({ operation: z.literal("approve"), proposalId: z.uuid() }).strict(),
  z.object({ operation: z.literal("deny"), proposalId: z.uuid() }).strict(),
]);

export function createDocHandler(options: {
  connect(
    request: Request,
  ): Promise<{ drive: DriveDocs; setCookie?: string } | undefined>;
  directory: string;
  signedOutMessage: string;
}) {
  return async (request: Request) => {
    const url = new URL(request.url);
    const origin = expectedOrigin(request, url);
    if (!isLoopbackHost(origin.hostname)) return loopbackDenied();

    const cookie = request.headers
      .get("cookie")
      ?.split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith(`${cookieName}=`))
      ?.slice(cookieName.length + 1);
    const hasSession = !!cookie && /^[a-f0-9]{64}$/.test(cookie);
    const session = hasSession ? cookie : randomBytes(32).toString("hex");
    const extraCookies: string[] = [];
    const reply = (value: unknown, status = 200) => {
      const headers = new Headers({ "Cache-Control": "no-store" });
      if (!hasSession) {
        headers.append(
          "Set-Cookie",
          `${cookieName}=${session}; HttpOnly; SameSite=Strict; Path=/api/docs; Max-Age=86400${url.protocol === "https:" ? "; Secure" : ""}`,
        );
      }
      for (const cookie of extraCookies) headers.append("Set-Cookie", cookie);
      return Response.json(value, { status, headers });
    };

    if (request.method !== "GET" && request.method !== "POST") {
      return reply({ error: "Method not allowed." }, 405);
    }
    if (
      request.method === "POST" &&
      (request.headers.get("origin") !== origin.origin ||
        !request.headers.get("content-type")?.startsWith("application/json"))
    ) {
      return reply(
        { error: "Use the approval controls from this app's own page." },
        403,
      );
    }
    if (request.method === "POST" && !hasSession) {
      return reply(
        {
          error:
            "Reload the page to start a browser session before proposing or approving.",
        },
        403,
      );
    }
    if (request.method === "GET" && url.searchParams.get("session") === "1") {
      return reply({ status: "ready" });
    }

    try {
      const connection = await options.connect(request);
      if (connection?.setCookie) extraCookies.push(connection.setCookie);
      if (!connection) {
        return reply(
          request.method === "GET"
            ? { status: "signed_out", message: options.signedOutMessage }
            : { error: options.signedOutMessage },
          request.method === "GET" ? 200 : 401,
        );
      }
      const service = new DocApprovalService(
        connection.drive,
        options.directory,
      );
      if (request.method === "GET") {
        const fileId = url.searchParams.get("fileId");
        if (fileId) return reply({ doc: await service.get(fileId) });
        const identity = await connection.drive.identity();
        const courseId = url.searchParams.get("courseId");
        return reply({
          status: "signed_in",
          user: identity,
          docs: courseId ? await service.list(courseId) : [],
        });
      }
      const text = await request.text();
      if (text.length > 12_000) {
        return reply({ error: "The proposal is too large." }, 413);
      }
      const input = command.parse(JSON.parse(text));
      switch (input.operation) {
        case "propose": {
          const { operation: _operation, ...draft } = input;
          return reply({ proposal: await service.propose(session, draft) });
        }
        case "deny":
          await service.deny(session, input.proposalId);
          return reply({ status: "declined" });
        case "approve":
          return reply({ doc: await service.approve(session, input.proposalId) });
      }
    } catch (error) {
      if (error instanceof z.ZodError || error instanceof SyntaxError) {
        return reply(
          {
            error:
              "Invalid request or provider data. Check the course, title, details, and file ID.",
          },
          400,
        );
      }
      const message =
        error instanceof DomainError
          ? error.message
          : "Unable to reach Google Drive or the approval store. Check the server configuration, credentials, permissions, and persistent disk, then refresh.";
      return reply({ error: message }, 502);
    }
  };
}
