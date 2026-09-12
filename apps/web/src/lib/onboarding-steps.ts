"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CoursePack, PackSlot } from "./pack-types";

export type OnboardingStep = {
  slot: PackSlot;
  /** Short label for the stepper. */
  label: string;
  /** Page heading while this step is open. */
  headline: string;
  description: string;
  emptyHint: string;
};

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    slot: "contents",
    label: "Course contents",
    headline: "Attach the course contents",
    description:
      "Pick the syllabus, units, textbook, or any Drive file that describes what this course covers.",
    emptyHint:
      "The agent reads these files to know which units exist in the course.",
  },
  {
    slot: "syllabus",
    label: "Course syllabus",
    headline: "Attach the course syllabus",
    description:
      "Pick the official plan, calendar, grading criteria, or teaching program from Drive.",
    emptyHint:
      "This is where the schedule and grading rules for the course come from.",
  },
  {
    slot: "students",
    label: "Student list",
    headline: "Attach the student list",
    description:
      "Pick the class roster from Drive (PDF, spreadsheet, or a Classroom export).",
    emptyHint: "The roster is what makes topic notes specific to this class.",
  },
];

export const LAST_STEP = ONBOARDING_STEPS.length - 1;

export function slotCount(pack: CoursePack | undefined, slot: PackSlot) {
  return pack?.[slot].length ?? 0;
}

/**
 * Which onboarding step is open. Lives outside the wizard so the page header can
 * name the step. Each course opens on its first gap, and after that the step only
 * changes when the user asks for it — attaching a file must not move the ground.
 */
export function useOnboardingStep(
  pack: CoursePack | undefined,
  loading: boolean,
) {
  const courseId = pack?.courseId ?? null;
  const firstIncomplete = useMemo(() => {
    const index = ONBOARDING_STEPS.findIndex(
      (step) => slotCount(pack, step.slot) === 0,
    );
    return index === -1 ? LAST_STEP : index;
  }, [pack]);
  const [index, setIndex] = useState(0);
  const opened = useRef<string | null>(null);

  useEffect(() => {
    if (loading || !courseId || opened.current === courseId) return;
    opened.current = courseId;
    setIndex(firstIncomplete);
  }, [courseId, firstIncomplete, loading]);

  const goTo = useCallback((next: number) => {
    setIndex(Math.min(Math.max(next, 0), LAST_STEP));
  }, []);

  const current = Math.min(index, LAST_STEP);
  return {
    steps: ONBOARDING_STEPS,
    index: current,
    step: ONBOARDING_STEPS[current],
    goTo,
  };
}

export type OnboardingState = ReturnType<typeof useOnboardingStep>;
