"use client";

import { useState, type FormEvent } from "react";
import type { ClassroomControls } from "@/lib/use-classroom";

export function DriveDocs({ classroom }: { classroom: ClassroomControls }) {
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [error, setError] = useState("");
  const [preparing, setPreparing] = useState(false);
  const {
    selectedCourseId,
    selectedAssignmentId,
    docs,
    proposal,
    busy,
    notice,
    auth,
  } = classroom;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCourseId) return;
    setPreparing(true);
    setError("");
    try {
      await classroom.propose({
        courseId: selectedCourseId,
        courseWorkId: selectedAssignmentId,
        title,
        details,
      });
      setTitle("");
      setDetails("");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to prepare proposal.",
      );
    } finally {
      setPreparing(false);
    }
  }

  async function refresh() {
    setError("");
    try {
      await classroom.refreshDocs();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to refresh Drive documents.",
      );
    }
  }

  const signedIn = auth?.status === "signed_in";

  return (
    <section className="ck-followups" aria-labelledby="docs-title">
      <header className="ck-followups-header">
        <div>
          <h2 id="docs-title">Drive documents</h2>
          <p className="ck-local-note">
            Proposals are saved only after page approval. Refresh reads Drive
            again.
          </p>
        </div>
        <span className="ck-tag">Google Drive</span>
      </header>

      {!signedIn ? (
        <div className="ck-setup-note">
          <strong>Sign in to create course documents</strong>
          <p>
            The assistant can only write a Google Doc after you review the exact
            title and body on this page.
          </p>
        </div>
      ) : (
        <p className="ck-local-note">
          Creating as {classroom.user?.name} ({classroom.user?.email}). Files
          listed here were created by this app for the selected course.
        </p>
      )}

      {docs.length ? (
        <ul className="ck-task-list">
          {docs.map((doc) => (
            <li key={doc.id}>
              <span aria-hidden="true">○</span>
              <div>
                <strong>{doc.title}</strong>
                <code className="ck-record-id">{doc.id}</code>
                {doc.url ? (
                  <a href={doc.url} target="_blank" rel="noreferrer">
                    Open in Drive
                  </a>
                ) : (
                  <span className="ck-muted">
                    Drive returned no file link. Use this ID in Drive.
                  </span>
                )}
                <details>
                  <summary>Saved details</summary>
                  <p className="ck-preserve-lines">{doc.description}</p>
                </details>
              </div>
            </li>
          ))}
        </ul>
      ) : signedIn && selectedCourseId ? (
        <p className="ck-empty">No Drive documents yet for this course.</p>
      ) : null}

      <button
        type="button"
        className="ck-btn"
        disabled={busy || !signedIn || !selectedCourseId}
        onClick={refresh}
      >
        Refresh from Drive
      </button>

      <form onSubmit={submit} className="ck-task-form ck-task-form--stacked">
        <label className="ck-sr-only" htmlFor="doc-title">
          New Drive document for the selected course
        </label>
        <input
          id="doc-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={200}
          placeholder="Document title…"
          required
        />
        <label className="ck-sr-only" htmlFor="doc-details">
          Document body
        </label>
        <textarea
          id="doc-details"
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          maxLength={4000}
          placeholder="What should this Google Doc contain?"
          required
          rows={3}
        />
        <button
          className="ck-btn ck-btn--primary"
          disabled={!signedIn || !selectedCourseId || preparing || busy}
          type="submit"
        >
          {preparing ? "Preparing…" : "Review"}
        </button>
      </form>

      {proposal && (
        <section className="ck-approval" aria-label="Approve Drive document">
          <h3>Approve this document in Drive</h3>
          <p>
            Save as {proposal.identityName} ({proposal.identityEmail}). Expires{" "}
            {new Date(proposal.expiresAt).toLocaleTimeString()}.
          </p>
          <strong>{proposal.title}</strong>
          <p className="ck-preserve-lines">{proposal.description}</p>
          <p>This is a real Drive write. Review the exact fields above.</p>
          <div className="ck-approval-actions">
            <button
              type="button"
              className="ck-btn ck-btn--primary"
              disabled={busy}
              onClick={classroom.approve}
            >
              {busy ? "Working…" : "Approve & create in Drive"}
            </button>
            <button
              type="button"
              className="ck-btn"
              disabled={busy}
              onClick={classroom.deny}
            >
              Decline
            </button>
          </div>
        </section>
      )}

      {(error || classroom.error) && (
        <p role="alert" className="ck-error">
          {error || classroom.error}
        </p>
      )}
      <p role="status" className="ck-notice">
        {notice}
      </p>
    </section>
  );
}
