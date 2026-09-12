"use client";

import { useEffect, useMemo, useState } from "react";
import { FileStep } from "@/components/file-step";
import type { PackSlot } from "@/lib/pack-types";
import type { useCoursePack } from "@/lib/use-course-pack";

const STEPS: Array<{
  slot: PackSlot;
  title: string;
  description: string;
}> = [
  {
    slot: "contents",
    title: "1. Course contents",
    description:
      "Pick the syllabus, units, textbook, or any Drive file that describes what this course covers.",
  },
  {
    slot: "syllabus",
    title: "2. Course syllabus",
    description:
      "Pick the official plan, calendar, grading criteria, or teaching program from Drive.",
  },
  {
    slot: "students",
    title: "3. Student list",
    description:
      "Pick the class roster from Drive (PDF, spreadsheet, or a Classroom export).",
  },
];

export function Onboarding({
  pack,
  onDone,
}: {
  pack: ReturnType<typeof useCoursePack>;
  onDone?: () => void;
}) {
  const firstIncomplete = useMemo(() => {
    const index = STEPS.findIndex((step) => pack.pack?.[step.slot].length === 0);
    return index === -1 ? STEPS.length - 1 : index;
  }, [pack.pack]);
  const [stepIndex, setStepIndex] = useState(firstIncomplete);
  const [moved, setMoved] = useState(false);
  useEffect(() => {
    if (!moved) setStepIndex(firstIncomplete);
  }, [firstIncomplete, moved]);
  const step = STEPS[Math.min(stepIndex, STEPS.length - 1)];
  const files = pack.pack?.[step.slot] ?? [];
  const canAdvance = files.length > 0;
  const isLast = stepIndex === STEPS.length - 1;

  return (
    <div className="ck-onboarding">
      <ol className="ck-steps-nav" aria-label="Onboarding steps">
        {STEPS.map((item, index) => {
          const done = (pack.pack?.[item.slot].length ?? 0) > 0;
          return (
            <li key={item.slot}>
              <button
                type="button"
                className={[
                  "ck-step-tab",
                  index === stepIndex ? "ck-step-tab--current" : "",
                  done ? "ck-step-tab--done" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => {
                  setMoved(true);
                  setStepIndex(index);
                }}
              >
                {item.title}
              </button>
            </li>
          );
        })}
      </ol>

      <FileStep
        title={step.title}
        description={step.description}
        files={files}
        busy={pack.busy}
        onAttach={(fileIds) => pack.attach(step.slot, fileIds)}
        onRemove={pack.remove}
        leading={
          <button
            type="button"
            className="ck-btn"
            disabled={stepIndex === 0}
            onClick={() => {
              setMoved(true);
              setStepIndex((value) => Math.max(0, value - 1));
            }}
          >
            Back
          </button>
        }
        trailing={
          !isLast ? (
            <button
              type="button"
              className="ck-btn ck-btn--primary"
              disabled={!canAdvance}
              onClick={() => {
                setMoved(true);
                setStepIndex((value) => value + 1);
              }}
            >
              Continue
            </button>
          ) : onDone ? (
            <button
              type="button"
              className="ck-btn ck-btn--primary"
              disabled={!canAdvance}
              onClick={onDone}
            >
              Done
            </button>
          ) : (
            <p className="ck-local-note">
              {canAdvance
                ? "Onboarding complete. You can create a topic."
                : "Add at least one Drive file to finish."}
            </p>
          )
        }
      />
    </div>
  );
}
