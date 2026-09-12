import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { DomainError } from "./domain-error";
import {
  emptyPack,
  PACK_SLOTS,
  type CoursePack,
  type CourseTopic,
  type PackFile,
  type PackSlot,
} from "../pack-types";

const MAX_FILES_PER_SLOT = 20;

const fileSchema = z.object({
  id: z.string().min(1).max(256),
  name: z.string().min(1),
  size: z.number().int().nonnegative(),
  mimeType: z.string(),
  url: z.string().nullable().optional().default(null),
});

const packSchema = z.object({
  courseId: z.string(),
  contents: z.array(fileSchema),
  syllabus: z.array(fileSchema),
  students: z.array(fileSchema),
  topics: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      language: z.string(),
      adaptations: z.object({
        tdah: z.boolean(),
        tea: z.boolean(),
        altasCapacidades: z.boolean(),
      }),
      notes: z.array(fileSchema),
      createdAt: z.number(),
    }),
  ),
});

function safeId(value: string) {
  const cleaned = value.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 128);
  if (!cleaned) throw new DomainError("Invalid identifier.");
  return cleaned;
}

function ownerKey(email: string) {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

export function packRoot(directory: string, email: string, courseId: string) {
  return join(directory, ownerKey(email), safeId(courseId));
}

function normalizeFile(file: PackFile): PackFile {
  return {
    id: file.id,
    name: file.name.slice(0, 200) || "Untitled",
    size: file.size,
    mimeType: file.mimeType || "application/octet-stream",
    url: file.url ?? null,
  };
}

function mergeFiles(existing: PackFile[], incoming: PackFile[]) {
  if (existing.length + incoming.length > MAX_FILES_PER_SLOT) {
    throw new DomainError("Too many files in this step.");
  }
  const seen = new Set(existing.map((file) => file.id));
  const next = [...existing];
  for (const file of incoming) {
    if (seen.has(file.id)) continue;
    seen.add(file.id);
    next.push(normalizeFile(file));
  }
  if (next.length > MAX_FILES_PER_SLOT) {
    throw new DomainError("Too many files in this step.");
  }
  return next;
}

export class CoursePackStore {
  constructor(private directory: string) {}

  private paths(email: string, courseId: string) {
    const root = packRoot(this.directory, email, courseId);
    return {
      root,
      manifest: join(root, "pack.json"),
    };
  }

  async read(email: string, courseId: string): Promise<CoursePack> {
    const { manifest } = this.paths(email, courseId);
    try {
      return packSchema.parse(JSON.parse(await readFile(manifest, "utf8")));
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        return emptyPack(courseId);
      }
      if (error instanceof z.ZodError) {
        throw new DomainError("The course pack is corrupt. Pick the Drive files again.");
      }
      throw error;
    }
  }

  private async write(email: string, pack: CoursePack) {
    const { root, manifest } = this.paths(email, pack.courseId);
    await mkdir(root, { recursive: true, mode: 0o700 });
    await writeFile(manifest, JSON.stringify(pack, null, 2), { mode: 0o600 });
  }

  async addFiles(
    email: string,
    courseId: string,
    slot: PackSlot,
    files: PackFile[],
  ) {
    if (!PACK_SLOTS.includes(slot)) {
      throw new DomainError("Unknown onboarding step.");
    }
    if (!files.length) {
      throw new DomainError("Pick at least one Drive file.");
    }
    const pack = await this.read(email, courseId);
    pack[slot] = mergeFiles(pack[slot], files);
    await this.write(email, pack);
    return { pack, added: files.map(normalizeFile) };
  }

  async addTopic(
    email: string,
    courseId: string,
    input: {
      title: string;
      notes: PackFile[];
    },
  ) {
    const title = input.title.trim();
    if (!title) throw new DomainError("The topic needs a title.");
    if (!input.notes.length) {
      throw new DomainError("Pick at least one Drive notes file for this topic.");
    }
    const pack = await this.read(email, courseId);
    if (
      !pack.contents.length ||
      !pack.syllabus.length ||
      !pack.students.length
    ) {
      throw new DomainError(
        "Finish onboarding (contents, syllabus, and students) before creating a topic.",
      );
    }
    const topic: CourseTopic = {
      id: randomUUID(),
      title: title.slice(0, 200),
      language: "en",
      adaptations: { tdah: false, tea: false, altasCapacidades: false },
      notes: mergeFiles([], input.notes),
      createdAt: Date.now(),
    };
    pack.topics.unshift(topic);
    await this.write(email, pack);
    return { pack, topic };
  }

  async removeFile(email: string, courseId: string, fileId: string) {
    z.string().min(1).max(256).parse(fileId);
    const pack = await this.read(email, courseId);
    for (const slot of PACK_SLOTS) {
      pack[slot] = pack[slot].filter((file) => file.id !== fileId);
    }
    pack.topics = pack.topics.map((topic) => ({
      ...topic,
      notes: topic.notes.filter((file) => file.id !== fileId),
    }));
    await this.write(email, pack);
    return pack;
  }
}
