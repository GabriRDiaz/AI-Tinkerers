"use client";

import { FileStep } from "@/components/file-step";
import {
  LAST_STEP,
  slotCount,
  type OnboardingState,
} from "@/lib/onboarding-steps";
import type { useCoursePack } from "@/lib/use-course-pack";

export function Onboarding({
  pack,
  onboarding,
  onDone,
}: {
  pack: ReturnType<typeof useCoursePack>;
  onboarding: OnboardingState;
  onDone: () => void;
}) {
  const { steps, index, step, goTo } = onboarding;
  const files = pack.pack?.[step.slot] ?? [];
  const isLast = index === LAST_STEP;
  const missing = steps.filter((item) => slotCount(pack.pack, item.slot) === 0);

  return (
    <div className="ck-onboarding">
      <ol className="ck-stepper" aria-label="Course setup steps">
        {steps.map((item, position) => {
          const count = slotCount(pack.pack, item.slot);
          const done = count > 0;
          return (
            <li key={item.slot}>
              <button
                type="button"
                aria-current={position === index ? "step" : undefined}
                className={[
                  "ck-step-tab",
                  position === index ? "ck-step-tab--current" : "",
                  done ? "ck-step-tab--done" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => goTo(position)}
              >
                <span className="ck-step-bullet" aria-hidden="true">
                  {done ? "✓" : position + 1}
                </span>
                <span className="ck-step-tab-label">
                  {item.label}
                  <span className="ck-sr-only">
                    {done
                      ? ` — ${count} file${count === 1 ? "" : "s"} attached`
                      : " — no files yet"}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <FileStep
        label={step.headline}
        emptyTitle={`Nothing attached for ${lowerFirst(step.label)} yet`}
        emptyHint={step.emptyHint}
        files={files}
        busy={pack.busy}
        onAttach={(fileIds) => pack.attach(step.slot, fileIds)}
        onRemove={pack.remove}
        leading={
          <button
            type="button"
            className="ck-btn ck-btn--ghost"
            disabled={index === 0}
            onClick={() => goTo(index - 1)}
          >
            Back
          </button>
        }
        trailing={
          isLast ? (
            <button
              type="button"
              className="ck-btn ck-btn--primary"
              disabled={Boolean(missing.length) || pack.busy}
              onClick={onDone}
            >
              Finish setup
            </button>
          ) : (
            <button
              type="button"
              className="ck-btn ck-btn--primary"
              disabled={!files.length || pack.busy}
              onClick={() => goTo(index + 1)}
            >
              Continue
            </button>
          )
        }
      />

      {isLast ? (
        missing.length ? (
          <p className="ck-local-note">
            Still needed: {missing.map((item) => item.label).join(", ")}.
          </p>
        ) : (
          <div className="ck-success-banner" role="status">
            <span aria-hidden="true">✓</span>
            <div>
              <strong>All three course documents are attached</strong>
              <p>Finish setup to open the topic workspace for this course.</p>
            </div>
          </div>
        )
      ) : null}
    </div>
  );
}

/** Lower-case a step label so it reads inside a sentence. */
function lowerFirst(label: string) {
  return label.charAt(0).toLowerCase() + label.slice(1);
}
