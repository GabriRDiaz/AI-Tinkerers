import { resolve } from "node:path";
import { createDocHandler } from "@/lib/server/doc-http";
import { requireGoogleClients } from "@/lib/server/google-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handler = createDocHandler({
  connect: async (request) => {
    const connection = await requireGoogleClients(request);
    if (!connection) return undefined;
    return { drive: connection.drive, setCookie: connection.setCookie };
  },
  directory: resolve(process.env.WEB_DOC_DIR || ".data/web-docs"),
  signedOutMessage:
    "Sign in with Google to propose and save Drive documents for the selected course.",
});

export const GET = handler;
export const POST = handler;
