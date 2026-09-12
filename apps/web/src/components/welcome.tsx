"use client";

import { ONBOARDING_STEPS } from "@/lib/onboarding-steps";
import type { ClassroomControls } from "@/lib/use-classroom";

/** Signed-out landing: what this does, then a single way in. */
export function Welcome({ classroom }: { classroom: ClassroomControls }) {
  const unconfiguredMessage =
    classroom.auth?.status === "unconfigured" ? classroom.auth.message : "";
  const params =
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search);
  const googleError = params?.get("google_error");

  return (
    <main className="ck-welcome">
      <div className="ck-welcome-hero">
        <p className="ck-eyebrow">Google Classroom · Drive</p>
        <h1>Prepare a course from the files you already have</h1>
        <p className="ck-intro">
          Attach the contents, syllabus, and student list from Drive once. After
          that, every topic you add is grounded in the real course.
        </p>
      </div>

      <section className="ck-welcome-card" aria-labelledby="welcome-title">
        <h2 className="ck-sr-only" id="welcome-title">
          How it works
        </h2>
        <ol className="ck-welcome-steps">
          {ONBOARDING_STEPS.map((step, index) => (
            <li key={step.slot} className="ck-welcome-step">
              <span className="ck-welcome-step-index" aria-hidden="true">
                {index + 1}
              </span>
              <strong>{step.label}</strong>
              <p>{step.emptyHint}</p>
            </li>
          ))}
        </ol>

        {unconfiguredMessage ? (
          <div className="ck-setup-note">
            <strong>Google OAuth is not configured</strong>
            <p>{unconfiguredMessage}</p>
          </div>
        ) : (
          <div className="ck-welcome-cta">
            <a
              className="ck-btn ck-btn--primary ck-btn--google"
              href="/api/auth/google"
            >
              Sign in with Google
            </a>
            <p className="ck-local-note">
              We need the Classroom account so documents attach to the right
              course. Nothing is written to Drive without your approval.
            </p>
          </div>
        )}

        {googleError || classroom.error ? (
          <p role="alert" className="ck-error">
            {googleError || classroom.error}
          </p>
        ) : null}
      </section>
    </main>
  );
}
