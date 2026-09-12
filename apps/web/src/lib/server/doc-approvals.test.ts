import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DocApprovalService } from "./doc-approvals";
import type { DriveDocs } from "./google-clients";
import type { DriveDoc } from "../classroom-types";

const session = "a".repeat(64);
const input = {
  courseId: "bio-1",
  title: "Lab rubric",
  details: "Score the onion cell drawings.",
};

class FakeDrive implements DriveDocs {
  email = "teacher@school.edu";
  docs: DriveDoc[] = [];
  creates = 0;
  reads = 0;
  failure: "before" | "after" | undefined;
  async identity() {
    return { email: this.email, name: "Teacher" };
  }
  async list(courseId: string) {
    this.reads++;
    return this.docs.filter((doc) => doc.courseId === courseId);
  }
  async browse() {
    return { files: [], nextPageToken: null };
  }
  async inspect(id: string) {
    const doc = this.docs.find((item) => item.id === id);
    if (!doc) throw new Error("not found");
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
    this.reads++;
    const doc = this.docs.find((item) => item.id === id);
    if (!doc) throw new Error("not found");
    return doc;
  }
  async create(
    draft: {
      title: string;
      description: string;
      details: string;
      courseId: string;
    },
    beforeWrite: () => Promise<void>,
  ) {
    await beforeWrite();
    this.creates++;
    if (this.failure === "before") throw new Error("provider unavailable");
    const doc = {
      id: "drive-file-1",
      title: draft.title,
      description: draft.description,
      url: "https://docs.google.com/document/d/drive-file-1",
      courseId: draft.courseId,
    };
    this.docs.push(doc);
    if (this.failure === "after") throw new Error("lost response");
    return doc;
  }
}

async function fixture(t: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), "web-docs-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const provider = new FakeDrive();
  let now = Date.now();
  const service = new DocApprovalService(provider, directory, () => now);
  return {
    service,
    provider,
    directory,
    expire: () => {
      now += 11 * 60_000;
    },
  };
}

test("a proposal performs no write; approval writes exactly the displayed fields and reads back", async (t) => {
  const { service, provider } = await fixture(t);
  const proposal = await service.propose(session, input);
  assert.equal(provider.creates, 0);
  const doc = await service.approve(session, proposal.id);
  assert.equal(doc.title, proposal.title);
  assert.equal(doc.description, proposal.description);
  assert.equal(provider.creates, 1);
  assert.ok(provider.reads > 0);
});

test("missing, foreign-session, denied, and expired proposals cannot write", async (t) => {
  const { service, provider, expire } = await fixture(t);
  await assert.rejects(service.approve(session, "missing"));
  const proposal = await service.propose(session, input);
  await assert.rejects(service.approve("b".repeat(64), proposal.id), /session/);
  await service.deny(session, proposal.id);
  await assert.rejects(service.approve(session, proposal.id), /declined/);
  const next = await service.propose(session, input);
  expire();
  await assert.rejects(service.approve(session, next.id), /expired/);
  assert.equal(provider.creates, 0);
});

test("account changes invalidate the exact consent", async (t) => {
  const { service, provider } = await fixture(t);
  const proposal = await service.propose(session, input);
  provider.email = "other@school.edu";
  await assert.rejects(service.approve(session, proposal.id), /account/);
  assert.equal(provider.creates, 0);
});

test("concurrent approval and restart cannot duplicate a saved file; refresh reads Drive", async (t) => {
  const { service, provider, directory } = await fixture(t);
  const proposal = await service.propose(session, input);
  const results = await Promise.allSettled([
    service.approve(session, proposal.id),
    service.approve(session, proposal.id),
  ]);
  assert.ok(results.some((result) => result.status === "fulfilled"));
  assert.equal(provider.creates, 1);
  const restarted = new DocApprovalService(provider, directory);
  await restarted.approve(session, proposal.id);
  const before = provider.reads;
  assert.equal((await restarted.list("bio-1"))[0].id, provider.docs[0].id);
  assert.ok(provider.reads > before);
  const another = await restarted.propose(session, input);
  await restarted.approve(session, another.id);
  assert.equal(provider.creates, 1);
});

test("an uncertain write is never retried, including after restart and a new proposal", async (t) => {
  const { service, provider, directory } = await fixture(t);
  const proposal = await service.propose(session, input);
  provider.failure = "before";
  await assert.rejects(service.approve(session, proposal.id), /uncertain/);
  provider.failure = undefined;
  const restarted = new DocApprovalService(provider, directory);
  await assert.rejects(restarted.approve(session, proposal.id), /uncertain/);
  const another = await restarted.propose(session, input);
  await assert.rejects(restarted.approve(session, another.id), /uncertain/);
  assert.equal(provider.creates, 1);
});

test("a lost create reply is reconciled from Drive without a second create", async (t) => {
  const { service, provider, directory } = await fixture(t);
  const proposal = await service.propose(session, input);
  provider.failure = "after";
  await assert.rejects(service.approve(session, proposal.id), /uncertain/);
  const restarted = new DocApprovalService(provider, directory);
  const doc = await restarted.approve(session, proposal.id);
  assert.equal(doc.id, provider.docs[0].id);
  assert.equal(provider.creates, 1);
});

test("invalid proposal inputs fail before provider writes", async (t) => {
  const { service, provider } = await fixture(t);
  await assert.rejects(service.propose(session, { ...input, courseId: "" }));
  await assert.rejects(service.propose(session, { ...input, title: " " }));
  await assert.rejects(
    service.propose(session, { ...input, details: "x".repeat(4001) }),
  );
  assert.equal(provider.creates, 0);
});

test("create failure before the write guard remains retryable", async (t) => {
  const { service, provider } = await fixture(t);
  const original = provider.create.bind(provider);
  provider.create = async () => {
    throw new Error("schema unavailable");
  };
  const proposal = await service.propose(session, input);
  await assert.rejects(service.approve(session, proposal.id), /schema/);
  provider.create = original;
  await service.approve(session, proposal.id);
  assert.equal(provider.creates, 1);
});

test("read-back fields must match the exact approved payload", async (t) => {
  const { service, provider } = await fixture(t);
  const original = provider.get.bind(provider);
  provider.get = async (id) => ({
    ...(await original(id)),
    title: "Unexpected changed title",
  });
  const proposal = await service.propose(session, input);
  await assert.rejects(
    service.approve(session, proposal.id),
    /differs from the approved fields/,
  );
  assert.equal(provider.creates, 1);
});
