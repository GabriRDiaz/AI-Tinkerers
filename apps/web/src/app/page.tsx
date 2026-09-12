"use client";

import { useEffect, useState } from "react";
import { Onboarding } from "@/components/onboarding";
import { TopicWorkspace } from "@/components/topic-workspace";
import { Welcome } from "@/components/welcome";
import { findCourse } from "@/lib/classroom-context";
import {
  ONBOARDING_STEPS,
  slotCount,
  useOnboardingStep,
} from "@/lib/onboarding-steps";
import type { ClassroomCourse } from "@/lib/classroom-types";
import { useClassroom } from "@/lib/use-classroom";
import { useCoursePack } from "@/lib/use-course-pack";

export default function Home() {
  const classroom = useClassroom();
  const course = findCourse(classroom.courses, classroom.selectedCourseId);
  const signedIn = classroom.auth?.status === "signed_in";
  const pack = useCoursePack(classroom.selectedCourseId, signedIn);
  const onboarding = useOnboardingStep(pack.pack, pack.loading);
  // "auto" follows the pack; once the user is in setup they stay there until they
  // click Finish, so attaching the last file does not yank the wizard away.
  const [phase, setPhase] = useState<"auto" | "setup" | "workspace">("auto");

  useEffect(() => {
    setPhase("auto");
  }, [classroom.selectedCourseId]);

  useEffect(() => {
    if (phase === "auto" && !pack.loading && !pack.ready) setPhase("setup");
  }, [pack.loading, pack.ready, phase]);

  if (!classroom.auth) return <BootScreen />;
  if (!signedIn) return <Welcome classroom={classroom} />;

  const wizard = phase === "setup" || (phase === "auto" && !pack.ready);

  return (
    <>
      <TopBar classroom={classroom} />
      <main className="ck-workspace">
        {!classroom.coursesLoaded ? (
          <>
            <PageHeader
              eyebrow="Course setup"
              title="Loading your courses"
              intro="Reading the active courses for this Google account."
            />
            <PackSkeleton />
          </>
        ) : !course ? (
          <>
            <PageHeader
              eyebrow="Google Classroom"
              title="No active courses"
              intro="This account has no active Classroom courses. Create a class in Classroom, then reload this page."
            />
            <section className="ck-panel">
              <div className="ck-setup-note">
                <strong>Nothing to prepare yet</strong>
                <p>
                  Courses come from the signed-in account. If you just created
                  one, reload to pick it up.
                </p>
              </div>
              {classroom.error ? (
                <p role="alert" className="ck-error">
                  {classroom.error}
                </p>
              ) : null}
            </section>
          </>
        ) : pack.loading ? (
          <>
            <PageHeader
              eyebrow="Course setup"
              title="Loading the course"
              intro="Reading which Drive files are already attached to this course."
            />
            <PackSkeleton />
          </>
        ) : wizard ? (
          <>
            <PageHeader
              eyebrow={`Course setup · Step ${onboarding.index + 1} of ${ONBOARDING_STEPS.length}`}
              title={onboarding.step.headline}
              intro={onboarding.step.description}
            />
            <section className="ck-panel ck-panel--flush">
              <CourseBar classroom={classroom} course={course} />
              <div className="ck-panel-body">
                <Onboarding
                  pack={pack}
                  onboarding={onboarding}
                  onDone={() => setPhase("workspace")}
                />
                {pack.error || classroom.error ? (
                  <p role="alert" className="ck-error">
                    {pack.error || classroom.error}
                  </p>
                ) : null}
              </div>
            </section>
          </>
        ) : (
          <>
            <PageHeader
              eyebrow={`Course workspace · ${course.courseState ?? "ACTIVE"}`}
              title={course.name}
              intro={
                course.descriptionHeading ||
                "Course documents are attached. Add a topic and pick the Drive notes it should use."
              }
            />
            <section className="ck-panel ck-panel--flush">
              <CourseBar classroom={classroom} course={course} />
              <div className="ck-panel-body">
                <div className="ck-section-head">
                  <div className="ck-chip-row">
                    {ONBOARDING_STEPS.map((step) => (
                      <span key={step.slot} className="ck-chip ck-chip--done">
                        <span className="ck-chip-check" aria-hidden="true">
                          ✓
                        </span>
                        {step.label}
                        {" · "}
                        {slotCount(pack.pack, step.slot)}
                      </span>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="ck-btn ck-btn--tiny"
                    onClick={() => setPhase("setup")}
                  >
                    Edit course documents
                  </button>
                </div>
                <TopicWorkspace pack={pack} />
                {pack.error || classroom.error ? (
                  <p role="alert" className="ck-error">
                    {pack.error || classroom.error}
                  </p>
                ) : null}
              </div>
            </section>
          </>
        )}
      </main>
    </>
  );
}

function PageHeader({
  eyebrow,
  title,
  intro,
}: {
  eyebrow: string;
  title: string;
  intro: string;
}) {
  return (
    <header className="ck-workspace-header">
      <div>
        <p className="ck-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="ck-intro">{intro}</p>
      </div>
    </header>
  );
}

function TopBar({ classroom }: { classroom: ReturnType<typeof useClassroom> }) {
  return (
    <div className="ck-topbar">
      <div className="ck-brand">
        <span className="ck-brand-mark" aria-hidden="true">
          CP
        </span>
        <div>
          <strong>Course Prep</strong>
          <span>Google Classroom · Drive</span>
        </div>
      </div>
      <div className="ck-auth-badge">
        <span className="ck-tag">{classroom.user?.email}</span>
        <button
          type="button"
          className="ck-btn ck-btn--tiny"
          onClick={classroom.signOut}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

function CourseBar({
  classroom,
  course,
}: {
  classroom: ReturnType<typeof useClassroom>;
  course: ClassroomCourse;
}) {
  return (
    <div className="ck-panel-bar">
      <div className="ck-field">
        <label htmlFor="course-select">Course</label>
        <select
          id="course-select"
          value={classroom.selectedCourseId ?? ""}
          onChange={(event) => classroom.selectCourse(event.target.value)}
        >
          {classroom.courses.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
              {item.section ? ` · ${item.section}` : ""}
            </option>
          ))}
        </select>
      </div>
      <span className="ck-tag">{course.courseState ?? "ACTIVE"}</span>
    </div>
  );
}

function BootScreen() {
  return (
    <main className="ck-welcome" aria-busy="true">
      <p className="ck-sr-only">Checking your Google session…</p>
      <div className="ck-welcome-card ck-skeleton-stack">
        <div className="ck-skeleton ck-skeleton--title" />
        <div className="ck-skeleton ck-skeleton--line" />
        <div className="ck-skeleton ck-skeleton--row" />
        <div className="ck-skeleton ck-skeleton--row" />
      </div>
    </main>
  );
}

function PackSkeleton() {
  return (
    <section className="ck-panel ck-skeleton-stack" aria-busy="true">
      <p className="ck-sr-only">Loading the course documents…</p>
      <div className="ck-skeleton ck-skeleton--line" />
      <div className="ck-skeleton ck-skeleton--title" />
      <div className="ck-skeleton ck-skeleton--row" />
      <div className="ck-skeleton ck-skeleton--row" />
    </section>
  );
}
