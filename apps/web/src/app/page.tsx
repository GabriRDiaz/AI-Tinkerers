"use client";

import { useEffect, useState } from "react";
import { Onboarding } from "@/components/onboarding";
import { TopicWorkspace } from "@/components/topic-workspace";
import { findCourse } from "@/lib/classroom-context";
import { useClassroom } from "@/lib/use-classroom";
import { useCoursePack } from "@/lib/use-course-pack";

export default function Home() {
  const classroom = useClassroom();
  const course = findCourse(classroom.courses, classroom.selectedCourseId);
  const signedIn = classroom.auth?.status === "signed_in";
  const pack = useCoursePack(classroom.selectedCourseId, signedIn);
  const [topicTitle, setTopicTitle] = useState("");
  const [editingBase, setEditingBase] = useState(false);

  useEffect(() => {
    setEditingBase(false);
  }, [classroom.selectedCourseId]);


  return (
    <main className="ck-workspace">
      <header className="ck-workspace-header">
        <div>
          <p className="ck-eyebrow">Classroom · Onboarding</p>
          <h1>Prepare the course</h1>
          <p className="ck-intro">
            First the base documents from Drive. Then add topic notes.
          </p>
        </div>
        <AuthBadge classroom={classroom} />
      </header>

      <div className="ck-workspace-grid ck-workspace-grid--single">
        <section className="ck-panel" aria-labelledby="course-title">
          {!signedIn ? (
            <SignInPanel classroom={classroom} />
          ) : (
            <>
              <div className="ck-course-fields">
                <div className="ck-incident-picker">
                  <label htmlFor="course-select">Course</label>
                  <select
                    id="course-select"
                    value={classroom.selectedCourseId ?? ""}
                    onChange={(event) =>
                      classroom.selectCourse(event.target.value)
                    }
                    disabled={!classroom.courses.length}
                  >
                    {!classroom.courses.length ? (
                      <option value="">No active courses</option>
                    ) : (
                      classroom.courses.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                          {item.section ? ` · ${item.section}` : ""}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div className="ck-incident-picker">
                  <label htmlFor="topic-title">Topic title</label>
                  <input
                    id="topic-title"
                    value={topicTitle}
                    onChange={(event) => setTopicTitle(event.target.value)}
                    maxLength={200}
                    placeholder="For example: The cell"
                  />
                </div>
              </div>

              {course ? (
                <>
                  <div className="ck-detail">
                    <span className="ck-status-label">
                      {course.courseState ?? "ACTIVE"}
                    </span>
                    <h2 id="course-title">{course.name}</h2>
                    <p>
                      {course.descriptionHeading ||
                        "Attach the three course packs from Drive, then add notes for this topic."}
                    </p>
                    {pack.ready ? (
                      <div className="ck-detail-actions">
                        {editingBase ? (
                          <button
                            type="button"
                            className="ck-btn ck-btn--primary"
                            onClick={() => setEditingBase(false)}
                          >
                            Done
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="ck-btn"
                            onClick={() => setEditingBase(true)}
                          >
                            Edit course documents
                          </button>
                        )}
                      </div>
                    ) : null}
                  </div>
                  {pack.error || classroom.error ? (
                    <p role="alert" className="ck-error">
                      {pack.error || classroom.error}
                    </p>
                  ) : null}
                  {pack.ready && !editingBase ? (
                    <TopicWorkspace
                      pack={pack}
                      title={topicTitle}
                      onCreated={() => setTopicTitle("")}
                    />
                  ) : (
                    <Onboarding
                      pack={pack}
                      onDone={
                        pack.ready ? () => setEditingBase(false) : undefined
                      }
                    />
                  )}
                </>
              ) : (
                <div className="ck-setup-note">
                  <strong>No courses</strong>
                  <p>
                    This account has no active Classroom courses. Create a class
                    and reload.
                  </p>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function AuthBadge({
  classroom,
}: {
  classroom: ReturnType<typeof useClassroom>;
}) {
  if (classroom.auth?.status === "signed_in") {
    return (
      <div className="ck-auth-badge">
        <span className="ck-tag">{classroom.user?.email}</span>
        <button type="button" className="ck-btn" onClick={classroom.signOut}>
          Sign out
        </button>
      </div>
    );
  }
  if (classroom.auth?.status === "unconfigured") {
    return <span className="ck-tag">Google OAuth is not configured</span>;
  }
  return <span className="ck-tag">Signed out</span>;
}

function SignInPanel({
  classroom,
}: {
  classroom: ReturnType<typeof useClassroom>;
}) {
  const params =
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search);
  const googleError = params?.get("google_error");
  return (
    <div className="ck-signin">
      <h2 id="course-title">Sign in with Google</h2>
      <p>
        We need the Classroom account so documents attach to the right course.
      </p>
      {classroom.auth?.status === "unconfigured" ? (
        <div className="ck-setup-note">
          <strong>OAuth is not configured</strong>
          <p>{classroom.auth.message}</p>
        </div>
      ) : (
        <a className="ck-btn ck-btn--primary" href="/api/auth/google">
          Sign in with Google
        </a>
      )}
      {(googleError || classroom.error) && (
        <p role="alert" className="ck-error">
          {googleError || classroom.error}
        </p>
      )}
    </div>
  );
}
