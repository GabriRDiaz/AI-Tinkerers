import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CoursePackStore } from "./course-pack";

async function fixture(t: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), "course-pack-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return new CoursePackStore(directory);
}

test("onboarding files persist per teacher and course", async (t) => {
  const store = await fixture(t);
  const empty = await store.read("profe@school.edu", "bio-1");
  assert.equal(empty.contents.length, 0);
  const { pack } = await store.addFiles("profe@school.edu", "bio-1", "contents", [
    {
      id: "drive-contents-1",
      name: "temario.pdf",
      size: 4,
      mimeType: "application/pdf",
      url: "https://drive.google.com/file/d/drive-contents-1/view",
    },
  ]);
  assert.equal(pack.contents[0].name, "temario.pdf");
  assert.equal(pack.contents[0].id, "drive-contents-1");
  const other = await store.read("profe@school.edu", "hist-1");
  assert.equal(other.contents.length, 0);
});

test("a topic cannot be created before the three onboarding slots are filled", async (t) => {
  const store = await fixture(t);
  await assert.rejects(
    store.addTopic("profe@school.edu", "bio-1", {
      title: "Célula",
      notes: [
        {
          id: "drive-notes-1",
          name: "apuntes.pdf",
          size: 1,
          mimeType: "application/pdf",
          url: null,
        },
      ],
    }),
    /onboarding/,
  );
});

test("after onboarding a topic stores notes", async (t) => {
  const store = await fixture(t);
  await store.addFiles("profe@school.edu", "bio-1", "contents", [
    { id: "c1", name: "c.pdf", size: 1, mimeType: "application/pdf", url: null },
  ]);
  await store.addFiles("profe@school.edu", "bio-1", "syllabus", [
    { id: "p1", name: "p.pdf", size: 1, mimeType: "application/pdf", url: null },
  ]);
  await store.addFiles("profe@school.edu", "bio-1", "students", [
    { id: "a1", name: "a.csv", size: 1, mimeType: "text/csv", url: null },
  ]);
  const { topic, pack } = await store.addTopic("profe@school.edu", "bio-1", {
    title: "La célula",
    notes: [
      {
        id: "n1",
        name: "unidad1.pdf",
        size: 1,
        mimeType: "application/pdf",
        url: null,
      },
    ],
  });
  assert.equal(topic.title, "La célula");
  assert.equal(pack.topics[0].notes[0].name, "unidad1.pdf");
});
