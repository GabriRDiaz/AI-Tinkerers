import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDocHandler } from "./doc-http";
import type { DriveDocs } from "./google-clients";
import type { DriveDoc } from "../classroom-types";

const origin = "http://127.0.0.1:3100";
const cookie = `web-doc-session=${"a".repeat(64)}`;

class FakeDrive implements DriveDocs {
  docs: DriveDoc[] = [];
  async identity() {
    return { email: "teacher@school.edu", name: "Teacher" };
  }
  async list() {
    return this.docs;
  }
  async browse() {
    return { files: [], nextPageToken: null };
  }
  async inspect(id: string) {
    const doc = this.docs.find((item) => item.id === id);
    if (!doc) throw new Error("missing");
    return {
      id: doc.id,
      name: doc.title,
      mimeType: "application/vnd.google-apps.document",
      size: 0,
      url: doc.url,
      folder: false,
    };
  }
  async get(id: string) {
    const doc = this.docs.find((item) => item.id === id);
    if (!doc) throw new Error("missing");
    return doc;
  }
  async create(
    draft: {
      title: string;
      description: string;
      courseId: string;
    },
    beforeWrite: () => Promise<void>,
  ) {
    await beforeWrite();
    const doc = {
      id: "drive-file-1",
      title: draft.title,
      description: draft.description,
      url: "https://docs.google.com/document/d/drive-file-1",
      courseId: draft.courseId,
    };
    this.docs.push(doc);
    return doc;
  }
}

function post(body: unknown, headers: HeadersInit = {}) {
  return new Request(`${origin}/api/docs`, {
    method: "POST",
    headers: {
      origin,
      "content-type": "application/json",
      cookie,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

async function fixture(t: TestContext, connected = true) {
  const directory = await mkdtemp(join(tmpdir(), "web-docs-http-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const drive = new FakeDrive();
  const handler = createDocHandler({
    connect: async () => (connected ? { drive } : undefined),
    directory,
    signedOutMessage: "Sign in with Google.",
  });
  return { handler, drive };
}

test("loopback hosts only", async (t) => {
  const { handler } = await fixture(t);
  const response = await handler(
    new Request("http://example.test/api/docs", {
      headers: { host: "example.test" },
    }),
  );
  assert.equal(response.status, 403);
});

test("signed-out reads explain the gap; writes are unauthorized", async (t) => {
  const { handler } = await fixture(t, false);
  const read = await handler(
    new Request(`${origin}/api/docs?courseId=bio-1`, { headers: { cookie } }),
  );
  assert.equal(read.status, 200);
  assert.deepEqual(await read.json(), {
    status: "signed_out",
    message: "Sign in with Google.",
  });
  const write = await handler(
    post({
      operation: "propose",
      courseId: "bio-1",
      title: "Rubric",
      details: "Score the lab.",
    }),
  );
  assert.equal(write.status, 401);
});

test("session handshake sets a cookie once", async (t) => {
  const { handler } = await fixture(t);
  const first = await handler(new Request(`${origin}/api/docs?session=1`));
  assert.match(first.headers.get("set-cookie")!, /web-doc-session=/);
  const second = await handler(
    new Request(`${origin}/api/docs?session=1`, { headers: { cookie } }),
  );
  assert.equal(second.headers.get("set-cookie"), null);
});

test("cross-origin posts are rejected", async (t) => {
  const { handler } = await fixture(t);
  const response = await handler(
    post(
      { operation: "propose", courseId: "bio-1", title: "A", details: "B" },
      { origin: "http://evil.test" },
    ),
  );
  assert.equal(response.status, 403);
});

test("approve creates a Drive record that GET can read back", async (t) => {
  const { handler, drive } = await fixture(t);
  const proposed = await handler(
    post({
      operation: "propose",
      courseId: "bio-1",
      title: "Lab rubric",
      details: "Score the onion cell drawings.",
    }),
  );
  const { proposal } = await proposed.json();
  const approved = await handler(
    post({ operation: "approve", proposalId: proposal.id }),
  );
  const { doc } = await approved.json();
  assert.equal(doc.id, "drive-file-1");
  assert.equal(drive.docs.length, 1);
  const listed = await handler(
    new Request(`${origin}/api/docs?courseId=bio-1`, { headers: { cookie } }),
  );
  const body = await listed.json();
  assert.equal(body.docs[0].id, "drive-file-1");
});
