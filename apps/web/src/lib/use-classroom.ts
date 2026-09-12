"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ClassroomAssignment,
  ClassroomCourse,
  DocProposal,
  DriveDoc,
  GoogleAuthStatus,
  GoogleUser,
} from "./classroom-types";
import { requestAuthSession, requestClassroom, requestDocs } from "./google-client";

export function useClassroom() {
  const [auth, setAuth] = useState<GoogleAuthStatus>();
  const [courses, setCourses] = useState<ClassroomCourse[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<ClassroomAssignment[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(
    null,
  );
  const [docs, setDocs] = useState<DriveDoc[]>([]);
  const [proposal, setProposal] = useState<DocProposal>();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [coursesLoaded, setCoursesLoaded] = useState(false);
  const sequence = useRef(0);
  const courseRef = useRef(selectedCourseId);
  courseRef.current = selectedCourseId;

  const loadAuth = useCallback(async () => {
    const status = await requestAuthSession();
    setAuth(status);
    return status;
  }, []);

  const refreshDocs = useCallback(async () => {
    const courseId = courseRef.current;
    if (!courseId) {
      setDocs([]);
      return [];
    }
    const result = await requestDocs<{ docs?: DriveDoc[] }>(
      `?courseId=${encodeURIComponent(courseId)}`,
    );
    const next = result.docs ?? [];
    setDocs(next);
    return next;
  }, []);

  const loadCourses = useCallback(async () => {
    const result = await requestClassroom<{ courses: ClassroomCourse[] }>("");
    setCourses(result.courses);
    setSelectedCourseId((current) => {
      if (current && result.courses.some((course) => course.id === current)) {
        return current;
      }
      return result.courses[0]?.id ?? null;
    });
    setCoursesLoaded(true);
    return result.courses;
  }, []);

  const loadAssignments = useCallback(async (courseId: string) => {
    const result = await requestClassroom<{
      assignments: ClassroomAssignment[];
    }>(`?courseId=${encodeURIComponent(courseId)}`);
    setAssignments(result.assignments);
    setSelectedAssignmentId((current) =>
      current && result.assignments.some((item) => item.id === current)
        ? current
        : null,
    );
    return result.assignments;
  }, []);

  const refresh = useCallback(async () => {
    const request = ++sequence.current;
    setError("");
    try {
      const status = await loadAuth();
      if (request !== sequence.current) return status;
      if (status.status !== "signed_in") {
        setCourses([]);
        setAssignments([]);
        setDocs([]);
        setSelectedCourseId(null);
        setSelectedAssignmentId(null);
        return status;
      }
      await loadCourses();
      if (request !== sequence.current) return status;
      const courseId = courseRef.current;
      if (courseId) {
        await loadAssignments(courseId);
        if (request !== sequence.current) return status;
        await refreshDocs();
      }
      return status;
    } catch (caught) {
      if (request === sequence.current) {
        setCoursesLoaded(true);
        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to load Classroom or Drive.",
        );
      }
      throw caught;
    }
  }, [loadAssignments, loadAuth, loadCourses, refreshDocs]);

  useEffect(() => {
    refresh().catch(() => {});
    return () => {
      sequence.current++;
    };
  }, [refresh]);

  useEffect(() => {
    if (auth?.status !== "signed_in" || !selectedCourseId) return;
    const request = ++sequence.current;
    Promise.all([loadAssignments(selectedCourseId), refreshDocs()]).catch(
      (caught) => {
        if (request === sequence.current) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load the selected course.",
          );
        }
      },
    );
  }, [auth?.status, loadAssignments, refreshDocs, selectedCourseId]);

  const selectCourse = useCallback((courseId: string) => {
    setSelectedCourseId(courseId);
    setSelectedAssignmentId(null);
    setProposal(undefined);
    setNotice("");
  }, []);

  const selectAssignment = useCallback((assignmentId: string | null) => {
    setSelectedAssignmentId(assignmentId);
  }, []);

  const propose = useCallback(
    async (draft: {
      courseId: string;
      courseWorkId?: string | null;
      title: string;
      details: string;
    }) => {
      try {
        const { proposal: next } = await requestDocs<{ proposal: DocProposal }>(
          "",
          { operation: "propose", ...draft },
        );
        setProposal(next);
        setNotice("Review the exact document below. It has not been saved.");
        setError("");
        return next;
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to prepare a Drive document.",
        );
        throw caught;
      }
    },
    [],
  );

  const retrieve = useCallback(async (id: string) => {
    const result = await requestDocs<{ doc: DriveDoc }>(
      `?fileId=${encodeURIComponent(id)}`,
    );
    setNotice(`Retrieved ${result.doc.id} from Drive.`);
    return result.doc;
  }, []);

  const approve = async () => {
    if (!proposal || busy) return;
    setBusy(true);
    setError("");
    try {
      const { doc } = await requestDocs<{ doc: DriveDoc }>("", {
        operation: "approve",
        proposalId: proposal.id,
      });
      setProposal((current) =>
        current?.id === proposal.id ? undefined : current,
      );
      setNotice(`Saved and read back from Drive: ${doc.id}.`);
      await refreshDocs();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to confirm the write. Refresh before retrying.",
      );
    } finally {
      setBusy(false);
    }
  };

  const deny = async () => {
    if (!proposal || busy) return;
    setBusy(true);
    setError("");
    try {
      await requestDocs("", { operation: "deny", proposalId: proposal.id });
      setProposal((current) =>
        current?.id === proposal.id ? undefined : current,
      );
      setNotice("Proposal declined. No Drive file was created.");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to decline proposal.",
      );
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setAuth({
      status: "signed_out",
      message: "Sign in with Google to load Classroom courses and Drive files.",
    });
    setCourses([]);
    setAssignments([]);
    setDocs([]);
    setSelectedCourseId(null);
    setSelectedAssignmentId(null);
    setProposal(undefined);
    setNotice("");
    setCoursesLoaded(false);
  };

  const user: GoogleUser | undefined =
    auth?.status === "signed_in" ? auth.user : undefined;

  return {
    auth,
    user,
    courses,
    coursesLoaded,
    selectedCourseId,
    assignments,
    selectedAssignmentId,
    docs,
    proposal,
    error,
    notice,
    busy,
    refresh,
    refreshDocs,
    selectCourse,
    selectAssignment,
    propose,
    retrieve,
    approve,
    deny,
    signOut,
  };
}

export type ClassroomControls = ReturnType<typeof useClassroom>;
