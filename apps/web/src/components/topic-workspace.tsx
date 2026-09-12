"use client";

import { useState, type FormEvent } from "react";
import { DrivePicker } from "@/components/drive-picker";
import type { DriveBrowseItem } from "@/lib/pack-types";
import type { useCoursePack } from "@/lib/use-course-pack";

export function TopicWorkspace({
  pack,
  title,
  onCreated,
}: {
  pack: ReturnType<typeof useCoursePack>;
  title: string;
  onCreated?: () => void;
}) {
  const [notes, setNotes] = useState<DriveBrowseItem[]>([]);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!notes.length) return;
    const topic = await pack.createTopic({
      title,
      fileIds: notes.map((file) => file.id),
    });
    setNotes([]);
    onCreated?.();
    setNotice(`Topic created: ${topic.title}`);
  }

  const topics = pack.pack?.topics ?? [];

  return (
    <div className="ck-topic-workspace">
      <section className="ck-file-step" aria-labelledby="new-topic-title">
        <h2 id="new-topic-title">Topic notes</h2>
        <p>Pick the Drive files for this topic. The title is set above.</p>
        <form onSubmit={submit} className="ck-task-form ck-task-form--stacked">
          {notes.length ? (
            <ul className="ck-task-list">
              {notes.map((file) => (
                <li key={file.id}>
                  <span aria-hidden="true">○</span>
                  <div className="ck-file-row">
                    <strong>{file.name}</strong>
                    <button
                      type="button"
                      className="ck-btn ck-btn--tiny"
                      onClick={() =>
                        setNotes((current) =>
                          current.filter((item) => item.id !== file.id),
                        )
                      }
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ck-empty">No Drive notes selected yet.</p>
          )}
          <div className="ck-step-actions">
            <button
              type="button"
              className="ck-btn"
              disabled={pack.busy}
              onClick={() => setOpen(true)}
            >
              Pick from Drive
            </button>
            <button
              className="ck-btn ck-btn--primary"
              disabled={pack.busy || !notes.length || !title.trim()}
              type="submit"
            >
              {pack.busy ? "Saving…" : "Create topic"}
            </button>
          </div>
        </form>
        <p role="status" className="ck-notice">
          {notice}
        </p>
      </section>

      <section aria-labelledby="topics-title">
        <h2 id="topics-title">Topics</h2>
        {topics.length ? (
          <ul className="ck-task-list">
            {topics.map((topic) => (
              <li key={topic.id}>
                <span aria-hidden="true">○</span>
                <div>
                  <strong>{topic.title}</strong>
                  <p className="ck-local-note">
                    {topic.notes.map((file) => file.name).join(", ")}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="ck-empty">No topics yet.</p>
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
