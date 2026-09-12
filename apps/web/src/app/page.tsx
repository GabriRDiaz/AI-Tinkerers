"use client";

import {
  CopilotChat,
  useConfigureSuggestions,
} from "@copilotkit/react-core/v2";
import { GenerativeUI } from "@/components/generative-ui";
import { AppControl } from "@/components/app-control";
import { DriveDocs } from "@/components/drive-docs";
import { findAssignment, findCourse } from "@/lib/classroom-context";
import { useClassroom } from "@/lib/use-classroom";

export default function Home() {
  const classroom = useClassroom();
  const course = findCourse(classroom.courses, classroom.selectedCourseId);
  const assignment = findAssignment(
    classroom.assignments,
    classroom.selectedAssignmentId,
  );
  const signedIn = classroom.auth?.status === "signed_in";

  useConfigureSuggestions(
    {
      suggestions: signedIn
        ? [
            {
              title: "Summarize this course",
              message:
                "Summarize the selected Google Classroom course using the page context. What needs attention?",
            },
            {
              title: "Propose a Drive doc",
              message:
                "Prepare one useful Google Doc for the selected course or assignment. Show me the proposal before it is saved.",
            },
          ]
        : [],
      available: "before-first-message",
    },
    [signedIn],
  );

  return (
    <>
      <GenerativeUI />
      <AppControl classroom={classroom} />
      <main className="ck-workspace">
        <header className="ck-workspace-header">
          <div>
            <p className="ck-eyebrow">Agents, everywhere · Classroom</p>
            <h1>Classroom assistant</h1>
            <p className="ck-intro">
              Open a course. Ask your assistant. Approve a Drive document.
            </p>
          </div>
          <AuthBadge classroom={classroom} />
        </header>

        <div className="ck-workspace-grid">
          <section className="ck-panel" aria-labelledby="course-title">
            {!signedIn ? (
              <SignInPanel classroom={classroom} />
            ) : (
              <>
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

                {course ? (
                  <div className="ck-detail">
                    <span className="ck-status-label">
                      {course.courseState ?? "ACTIVE"}
                    </span>
                    <h2 id="course-title">{course.name}</h2>
                    <p>
                      {course.descriptionHeading ||
                        "No course heading from Classroom."}
                    </p>
                    <dl className="ck-detail-facts">
                      <div>
                        <dt>Section</dt>
                        <dd>{course.section || "—"}</dd>
                      </div>
                      <div>
                        <dt>Room</dt>
                        <dd>{course.room || "—"}</dd>
                      </div>
                      <div>
                        <dt>Assignments</dt>
                        <dd>{classroom.assignments.length}</dd>
                      </div>
                    </dl>
                    {course.alternateLink ? (
                      <p>
                        <a
                          href={course.alternateLink}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open in Classroom
                        </a>
                      </p>
                    ) : null}

                    <details className="ck-more" key={course.id} open>
                      <summary>Assignments</summary>
                      {classroom.assignments.length ? (
                        <ol className="ck-timeline">
                          {classroom.assignments.map((item) => (
                            <li key={item.id}>
                              <time>{item.dueDate || "No due date"}</time>
                              <div>
                                <button
                                  type="button"
                                  className={
                                    item.id === classroom.selectedAssignmentId
                                      ? "ck-assignment ck-assignment--selected"
                                      : "ck-assignment"
                                  }
                                  onClick={() =>
                                    classroom.selectAssignment(item.id)
                                  }
                                >
                                  <strong>{item.title}</strong>
                                </button>
                                <p>
                                  {item.state || "PUBLISHED"}
                                  {item.workType ? ` · ${item.workType}` : ""}
                                </p>
                              </div>
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <p className="ck-empty">
                          No coursework returned for this course.
                        </p>
                      )}
                      {assignment ? (
                        <p className="ck-local-note">
                          Selected assignment: {assignment.title}
                        </p>
                      ) : null}
                    </details>
                  </div>
                ) : (
                  <div className="ck-setup-note">
                    <strong>No courses to show</strong>
                    <p>
                      This Google account has no active Classroom courses the
                      APIs can list. Join or create a course, then refresh.
                    </p>
                  </div>
                )}

                <DriveDocs classroom={classroom} />
              </>
            )}
          </section>

          <section
            className="ck-panel ck-assistant"
            aria-labelledby="assistant-title"
          >
            <header className="ck-assistant-header">
              <h2 id="assistant-title">Ask assistant</h2>
              <p>
                It can read this course and prepare a Drive document for
                approval.
              </p>
            </header>
            <CopilotChat
              className="ck-chat"
              labels={{
                welcomeMessageText: signedIn
                  ? "What should we do with this course?"
                  : "Sign in with Google to load a course.",
                chatInputPlaceholder: signedIn
                  ? "Ask about this course…"
                  : "Sign in first…",
              }}
            />
          </section>
        </div>
      </main>
    </>
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
    return <span className="ck-tag">Google OAuth not configured</span>;
  }
  return <span className="ck-tag">Not signed in</span>;
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
      <h2 id="course-title">Connect Google Classroom</h2>
      <p>
        Sign in to load your real courses and create a Google Doc in Drive after
        you approve it on this page.
      </p>
      {classroom.auth?.status === "unconfigured" ? (
        <div className="ck-setup-note">
          <strong>Connect a throwaway Google account</strong>
          <p>{classroom.auth.message}</p>
          <ol className="ck-setup-steps">
            <li>
              Create one empty class at{" "}
              <a href="https://classroom.google.com" target="_blank" rel="noreferrer">
                classroom.google.com
              </a>
              .
            </li>
            <li>
              In{" "}
              <a
                href="https://console.cloud.google.com/apis/library"
                target="_blank"
                rel="noreferrer"
              >
                Google Cloud
              </a>
              , enable Classroom API and Drive API.
            </li>
            <li>
              OAuth consent: External, Testing, add that Gmail as a test user.
            </li>
            <li>
              Create a Web client. Redirect URI must be{" "}
              <code>http://127.0.0.1:3100/api/auth/google/callback</code>.
            </li>
            <li>
              Paste <code>GOOGLE_CLIENT_ID</code> and{" "}
              <code>GOOGLE_CLIENT_SECRET</code> into root <code>.env</code> and
              restart the web app.
            </li>
          </ol>
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
