import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { DomainError } from "./domain-error";
import type { DriveDocs } from "./google-clients";
import type { DocProposal, DriveDoc } from "../classroom-types";

const draftSchema = z
  .object({
    courseId: z.string().trim().min(1).max(128),
    courseWorkId: z.string().trim().min(1).max(128).optional().nullable(),
    title: z.string().trim().min(1).max(200),
    details: z.string().trim().min(1).max(4000),
  })
  .strict();

const storedSchema = z.object({
  id: z.uuid(),
  courseId: z.string(),
  courseWorkId: z.string().nullable(),
  title: z.string(),
  details: z.string(),
  description: z.string(),
  identityEmail: z.string(),
  identityName: z.string(),
  expiresAt: z.number(),
  sessionHash: z.string(),
  actionKey: z.string(),
});

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const marker = (courseId: string) => `agents-everywhere:course:${courseId}`;

function fileExists(error: unknown) {
  return error instanceof Error && "code" in error && error.code === "EEXIST";
}

const uncertain = () =>
  new DomainError(
    "The write outcome is uncertain or still in progress. Refresh to reconcile from Drive. This exact action will not be created again; inspect Drive before starting a different document.",
  );

/** Files are approval/attempt metadata, never a source of saved Drive records. */
export class DocApprovalService {
  constructor(
    private drive: DriveDocs,
    private directory: string,
    private now = Date.now,
  ) {}

  async list(courseId: string) {
    return this.drive.list(courseId);
  }

  async get(id: string) {
    return this.drive.get(id);
  }

  async propose(session: string, input: unknown): Promise<DocProposal> {
    const draft = draftSchema.parse(input);
    const identity = await this.drive.identity();
    const courseWorkId = draft.courseWorkId ?? null;
    const actionKey = hash(
      JSON.stringify([
        identity.email,
        draft.courseId,
        courseWorkId,
        draft.title,
        draft.details,
      ]),
    );
    const proposal = {
      id: randomUUID(),
      courseId: draft.courseId,
      courseWorkId,
      title: draft.title,
      details: draft.details,
      description: `${draft.details}\n\nClassroom course: ${draft.courseId}${
        courseWorkId ? `\nAssignment: ${courseWorkId}` : ""
      }\n${marker(draft.courseId)}\ndoc:${actionKey}`,
      identityEmail: identity.email,
      identityName: identity.name,
      expiresAt: this.now() + 10 * 60_000,
      sessionHash: hash(session),
      actionKey,
    };
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    await writeFile(
      join(this.directory, `${proposal.id}.json`),
      JSON.stringify(proposal),
      { flag: "wx", mode: 0o600 },
    );
    const {
      sessionHash: _session,
      actionKey: _action,
      details: _details,
      ...publicProposal
    } = proposal;
    return publicProposal;
  }

  private async proposal(session: string, id: string) {
    z.uuid().parse(id);
    const proposal = storedSchema.parse(
      JSON.parse(await readFile(join(this.directory, `${id}.json`), "utf8")),
    );
    if (proposal.sessionHash !== hash(session)) {
      throw new DomainError("This proposal belongs to another browser session.");
    }
    if (proposal.expiresAt <= this.now()) {
      throw new DomainError(
        "This proposal expired. Prepare and review a new proposal.",
      );
    }
    return proposal;
  }

  private async decide(id: string, decision: "approved" | "declined") {
    const path = join(this.directory, `${id}.decision`);
    try {
      await writeFile(path, decision, { flag: "wx", mode: 0o600 });
    } catch (error) {
      if (!fileExists(error)) throw error;
    }
    const saved = await readFile(path, "utf8");
    if (saved !== decision) {
      throw new DomainError(`This proposal was already ${saved}.`);
    }
  }

  async deny(session: string, id: string) {
    await this.proposal(session, id);
    await this.decide(id, "declined");
  }

  async approve(session: string, id: string): Promise<DriveDoc> {
    const proposal = await this.proposal(session, id);
    const identity = await this.drive.identity();
    if (identity.email !== proposal.identityEmail) {
      throw new DomainError(
        "The signed-in Google account changed. Prepare a new proposal before approving.",
      );
    }
    await this.decide(id, "approved");
    const reconcile = async () => {
      const found = (await this.drive.list(proposal.courseId)).filter(
        (doc) =>
          doc.title === proposal.title &&
          doc.description === proposal.description,
      );
      if (found.length > 1) {
        throw new DomainError(
          "Drive contains multiple matching documents; inspect Drive before continuing.",
        );
      }
      return found[0];
    };
    const readBack = async (fileId: string) => {
      const record = await this.drive.get(fileId);
      if (
        record.id !== fileId ||
        record.title !== proposal.title ||
        record.description !== proposal.description
      ) {
        throw new DomainError(
          `Drive file ${fileId} differs from the approved fields. Inspect Drive; do not create it again.`,
        );
      }
      return record;
    };
    const existing = await reconcile();
    if (existing) return readBack(existing.id);
    let sent = false;
    let conflict = false;
    let created: DriveDoc;
    try {
      created = await this.drive.create(
        {
          title: proposal.title,
          description: proposal.description,
          details: proposal.details,
          courseId: proposal.courseId,
          courseWorkId: proposal.courseWorkId,
        },
        async () => {
          if (proposal.expiresAt <= this.now()) {
            throw new DomainError(
              "This proposal expired before the write. Nothing was sent.",
            );
          }
          const attempt = join(this.directory, `${proposal.actionKey}.attempt`);
          try {
            await writeFile(attempt, id, { flag: "wx", mode: 0o600 });
          } catch (error) {
            if (!fileExists(error)) throw error;
            conflict = true;
            throw uncertain();
          }
          if (proposal.expiresAt <= this.now()) {
            await unlink(attempt);
            throw new DomainError(
              "This proposal expired before the write. Nothing was sent.",
            );
          }
          sent = true;
        },
      );
    } catch (error) {
      if (conflict) {
        const recovered = await reconcile();
        if (recovered) return readBack(recovered.id);
      }
      if (sent || conflict) throw uncertain();
      throw error;
    }
    try {
      return await readBack(created.id);
    } catch (error) {
      if (error instanceof DomainError) throw error;
      throw new DomainError(
        `Drive created file ${created.id}, but read-back failed. Refresh to retrieve it; do not create it again.`,
      );
    }
  }
}
