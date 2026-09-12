import assert from "node:assert/strict";
import test from "node:test";
import {
  classroomContext,
  findAssignment,
  findCourse,
} from "./classroom-context";
import type {
  ClassroomAssignment,
  ClassroomCourse,
  DriveDoc,
} from "./classroom-types";

const courses: ClassroomCourse[] = [
  {
    id: "bio-1",
    name: "Biology 101",
    section: "A",
    descriptionHeading: "Cells and systems",
    room: "204",
    courseState: "ACTIVE",
    alternateLink: "https://classroom.google.com/c/bio-1",
  },
  {
    id: "hist-1",
    name: "History",
    section: null,
    descriptionHeading: null,
    room: null,
    courseState: "ACTIVE",
    alternateLink: null,
  },
];

const assignments: ClassroomAssignment[] = [
  {
    id: "cw-1",
    title: "Lab report",
    description: "Write up the onion cell lab.",
    state: "PUBLISHED",
    dueDate: "2026-09-20",
    workType: "ASSIGNMENT",
    alternateLink: null,
  },
];

test("selection changes the shared course and assignment together", () => {
  const biology = classroomContext(courses, "bio-1", assignments, "cw-1", []);
  const history = classroomContext(courses, "hist-1", [], null, []);
  assert.equal(biology.selectedCourse?.name, "Biology 101");
  assert.equal(biology.selectedAssignment?.title, "Lab report");
  assert.equal(history.selectedCourse?.name, "History");
  assert.equal(history.selectedAssignment, null);
  assert.equal(history.availableCourses.length, 2);
});

test("workspace context labels live Classroom data and Drive docs", () => {
  const docs: DriveDoc[] = [
    {
      id: "file-1",
      title: "Lab rubric",
      description: "Grading notes\nagents-everywhere:course:bio-1",
      url: "https://docs.google.com/document/d/file-1",
      courseId: "bio-1",
    },
  ];
  const context = classroomContext(courses, "bio-1", assignments, null, docs);
  assert.equal(findCourse(courses, "missing"), undefined);
  assert.equal(findAssignment(assignments, "missing"), undefined);
  assert.match(context.dataSource, /Live Google Classroom/);
  assert.match(context.dataSource, /Drive/);
  assert.deepEqual(context.driveDocs, [
    {
      id: "file-1",
      title: "Lab rubric",
      url: "https://docs.google.com/document/d/file-1",
      courseId: "bio-1",
    },
  ]);
});
