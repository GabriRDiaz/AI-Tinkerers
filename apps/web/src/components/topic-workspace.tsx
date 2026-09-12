"use client";

import { useState, type FormEvent } from "react";
import { DrivePicker } from "@/components/drive-picker";
import { FileCard } from "@/components/file-card";
import { fileKind } from "@/lib/file-kind";
import type { DriveBrowseItem } from "@/lib/pack-types";
import type { useCoursePack } from "@/lib/use-course-pack";

export function TopicWorkspace({
  pack,
}: {
  pack: ReturnType<typeof useCoursePack>;
}) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState<DriveBrowseItem[]>([]);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!notes.length || !title.trim()) return;
    setNotice("");
    try {
      const topic = await pack.createTopic({
        title,
        fileIds: notes.map((file) => file.id),
      });
      setNotes([]);
      setTitle("");
      setNotice(`Topic created: ${topic.title}`);
    } catch {
      // pack.error already carries the message for the page-level alert.
    }
  }

  const topics = pack.pack?.topics ?? [];
  const canCreate = Boolean(title.trim()) && notes.length > 0 && !pack.busy;

  return (
    <div className="ck-topic-workspace">
      <section className="ck-section" aria-labelledby="new-topic-title">
        <div className="ck-section-head">
          <div>
            <h2 id="new-topic-title">New topic</h2>
            <p>
              Name the topic, then pick the Drive notes it should be built from.
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="ck-topic-form">
          <div className="ck-field">
            <label htmlFor="topic-title">Topic title</label>
            <input
              id="topic-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={200}
              placeholder="For example: The cell"
            />
          </div>

          <div className="ck-field">
            <p className="ck-field-label" id="topic-notes-label">
              Topic notes
            </p>
            {notes.length ? (
              <ul className="ck-file-list" aria-labelledby="topic-notes-label">
                {notes.map((file) => (
                  <li key={file.id}>
                    <FileCard
                      file={file}
                      busy={pack.busy}
                      onRemove={() =>
                        setNotes((current) =>
                          current.filter((item) => item.id !== file.id),
                        )
                      }
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="ck-empty-state">
                <strong>No notes selected yet</strong>
                <p>
                  Pick the lesson notes, slides, or worksheets for this topic.
                  They stay on this page until you create the topic.
                </p>
                <button
                  type="button"
                  className="ck-btn"
                  disabled={pack.busy}
                  onClick={() => setOpen(true)}
                >
                  Pick from Drive
                </button>
              </div>
            )}
          </div>

          <div className="ck-step-actions">
            <span />
            <div className="ck-step-actions__end">
              {notes.length ? (
                <button
                  type="button"
                  className="ck-btn"
                  disabled={pack.busy}
                  onClick={() => setOpen(true)}
                >
                  Add more notes
                </button>
              ) : null}
              <button
                className="ck-btn ck-btn--primary"
                disabled={!canCreate}
                type="submit"
              >
                {pack.busy ? "Saving…" : "Create topic"}
              </button>
            </div>
          </div>
        </form>

        <p role="status" className="ck-notice">
          {notice}
        </p>
      </section>

      <section className="ck-section" aria-labelledby="topics-title">
        <div className="ck-section-head">
          <div>
            <h2 id="topics-title">Topics</h2>
            <p>Everything prepared for this course so far.</p>
          </div>
          {topics.length ? (
            <span className="ck-tag">
              {topics.length} topic{topics.length === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
        {topics.length ? (
          <ul className="ck-topic-list">
            {topics.map((topic) => (
              <li key={topic.id} className="ck-topic-card">
                <div className="ck-topic-card-head">
                  <strong>{topic.title}</strong>
                  <time dateTime={new Date(topic.createdAt).toISOString()}>
                    {new Date(topic.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </time>
                </div>
                <ul className="ck-file-chips">
                  {topic.notes.map((file) => (
                    <li key={file.id} className="ck-file-chip">
                      <span aria-hidden="true">
                        {fileKind(file.mimeType).badge}
                      </span>
                      <span>{file.name}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        ) : (
          <div className="ck-empty-state">
            <strong>No topics yet</strong>
            <p>
              The first topic you create appears here with the Drive notes behind
              it.
            </p>
          </div>
        )}
      </section>

      <DrivePicker
        open={open}
        busy={false}
        onClose={() => setOpen(false)}
        onPick={(selected) => {
          setNotes((current) => {
            const seen = new Set(current.map((file) => file.id));
            return [
              ...current,
              ...selected.filter((file) => !seen.has(file.id)),
            ];
          });
          setOpen(false);
        }}
      />
    </div>
  );
}
