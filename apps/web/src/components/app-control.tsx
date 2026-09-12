"use client";

import { useFrontendTool, useAgentContext } from "@copilotkit/react-core/v2";
import { z } from "zod";
import { classroomContext, findCourse } from "@/lib/classroom-context";
import type { ClassroomControls } from "@/lib/use-classroom";

async function toolResult<T>(action: () => Promise<T>) {
  try {
    return await action();
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Classroom or Drive operation failed. Check the page for setup details.",
    };
  }
}

export function AppControl({ classroom }: { classroom: ClassroomControls }) {
  const {
    selectedCourseId,
    selectedAssignmentId,
    courses,
    assignments,
    docs,
    propose,
    retrieve,
    selectCourse,
    selectAssignment,
  } = classroom;

  useAgentContext({
    description:
      "The Google Classroom page currently visible to the user, including the selected course, assignments, and Drive documents this app created. CRITICAL: propose_drive_doc only prepares a proposal. Only the user's approval button saves it; prose/chat approval never executes a write. Use retrieve_drive_doc or refresh_drive_docs for real reads. Never claim a file was saved without a Drive record. Never invent file links.",
    value: {
      auth: classroom.auth?.status ?? "unknown",
      user: classroom.user ?? null,
      authError:
        classroom.auth && classroom.auth.status !== "signed_in"
          ? classroom.auth.message
          : classroom.error || null,
      ...classroomContext(
        courses,
        selectedCourseId,
        assignments,
        selectedAssignmentId,
        docs,
      ),
      proposal: classroom.proposal ?? null,
      lastResult: classroom.notice,
    },
  });

  useFrontendTool(
    {
      name: "select_course",
      description:
        "Open an existing Classroom course already returned for this user. Use an ID from availableCourses.",
      parameters: z.object({ courseId: z.string() }),
      handler: async ({ courseId }) => {
        const course = findCourse(courses, courseId);
        if (!course) {
          throw new Error(
            `Unknown course ${courseId}. Choose one of the courses shown on the page.`,
          );
        }
        selectCourse(course.id);
        return `Opened ${course.name}. The visible details and agent context now show this course.`;
      },
    },
    [courses, selectCourse],
  );

  useFrontendTool(
    {
      name: "select_assignment",
      description:
        "Highlight an assignment from the selected course. Use an ID from the page assignments list.",
      parameters: z.object({ assignmentId: z.string() }),
      handler: async ({ assignmentId }) => {
        const assignment = assignments.find((item) => item.id === assignmentId);
        if (!assignment) {
          throw new Error(
            "Unknown assignment. Use an ID from the assignments currently listed for this course.",
          );
        }
        selectAssignment(assignment.id);
        return `Selected assignment: ${assignment.title}.`;
      },
    },
    [assignments, selectAssignment],
  );

  useFrontendTool(
    {
      name: "propose_drive_doc",
      description:
        "Prepare a Google Doc from the selected course context. Show the exact title and body for the user's approval button. Does not save anything. CRITICAL: wait for the user to click Approve & create in Drive on the page.",
      parameters: z.object({
        courseId: z.string().trim().min(1),
        courseWorkId: z.string().trim().min(1).optional(),
        title: z.string().trim().min(1).max(200),
        details: z.string().trim().min(1).max(4000),
      }),
      handler: async (draft) =>
        toolResult(async () => ({
          status: "pending_approval",
          proposal: await propose(draft),
        })),
    },
    [propose],
  );

  useFrontendTool(
    {
      name: "retrieve_drive_doc",
      description:
        "Retrieve an existing Drive document created by this app, by its actual file ID. Read-only; never creates a duplicate.",
      parameters: z.object({ id: z.string().trim().min(1) }),
      handler: async ({ id }) => toolResult(() => retrieve(id)),
    },
    [retrieve],
  );

  useFrontendTool(
    {
      name: "refresh_drive_docs",
      description:
        "Read Drive documents this app created for the currently selected course. Use after approval or browser refresh to verify persistence.",
      parameters: z.object({}),
      handler: async () => toolResult(() => classroom.refreshDocs()),
    },
    [classroom.refreshDocs],
  );

  return null;
}
