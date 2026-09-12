import type {
  ClassroomAssignment,
  ClassroomCourse,
  DriveDoc,
} from "./classroom-types";

export function findCourse(
  courses: ClassroomCourse[],
  courseId: string | null,
): ClassroomCourse | undefined {
  if (!courseId) return undefined;
  return courses.find((course) => course.id === courseId);
}

export function findAssignment(
  assignments: ClassroomAssignment[],
  assignmentId: string | null,
): ClassroomAssignment | undefined {
  if (!assignmentId) return undefined;
  return assignments.find((item) => item.id === assignmentId);
}

export function classroomContext(
  courses: ClassroomCourse[],
  selectedCourseId: string | null,
  assignments: ClassroomAssignment[],
  selectedAssignmentId: string | null,
  docs: DriveDoc[],
) {
  const selectedCourse = findCourse(courses, selectedCourseId) ?? null;
  const selectedAssignment =
    findAssignment(assignments, selectedAssignmentId) ?? null;
  return {
    dataSource:
      "Live Google Classroom for the signed-in user. Drive documents listed here were created by this app after page approval. A proposal is not a saved file.",
    availableCourses: courses.map(({ id, name, section, courseState }) => ({
      id,
      name,
      section,
      courseState,
    })),
    selectedCourse,
    assignments: assignments.map(
      ({ id, title, state, dueDate, workType }) => ({
        id,
        title,
        state,
        dueDate,
        workType,
      }),
    ),
    selectedAssignment,
    driveDocs: docs.map(({ id, title, url, courseId }) => ({
      id,
      title,
      url,
      courseId,
    })),
  };
}
