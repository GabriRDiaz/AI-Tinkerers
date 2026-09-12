"use client";

import { useState, type ReactNode } from "react";
import { DrivePicker } from "@/components/drive-picker";
import type { DriveBrowseItem, PackFile } from "@/lib/pack-types";

export function FileStep({
  title,
  description,
  files,
  busy,
  onAttach,
  onRemove,
  leading,
  trailing,
}: {
  title: string;
  description: string;
  files: PackFile[];
  busy: boolean;
  onAttach: (fileIds: string[]) => Promise<unknown>;
  onRemove: (id: string) => void;
  leading?: ReactNode;
  trailing?: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  async function pick(selected: DriveBrowseItem[]) {
    await onAttach(selected.map((file) => file.id));
    setOpen(false);
  }

  return (
    <section className="ck-file-step" aria-labelledby="step-title">
      <h2 id="step-title">{title}</h2>
      <p>{description}</p>
      {files.length ? (
        <ul className="ck-task-list">
          {files.map((file) => (
            <li key={file.id}>
              <span aria-hidden="true">○</span>
              <div className="ck-file-row">
                <div>
                  <strong>
                    {file.url ? (
                      <a href={file.url} target="_blank" rel="noreferrer">
                        {file.name}
                      </a>
                    ) : (
                      file.name
                    )}
                  </strong>
                  <span className="ck-muted">
                    {file.size ? `${(file.size / 1024).toFixed(1)} KB` : "Google Drive"}
                  </span>
                </div>
                <button
                  type="button"
                  className="ck-btn ck-btn--tiny"
                  disabled={busy}
                  onClick={() => onRemove(file.id)}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="ck-empty">No Drive files in this step yet.</p>
      )}
      <div className="ck-step-actions">
        {leading ?? <span />}
        <div className="ck-step-actions__end">
          <button
            type="button"
            className="ck-btn ck-btn--primary"
            disabled={busy}
            onClick={() => setOpen(true)}
          >
            Pick from Drive
          </button>
          {trailing}
        </div>
      </div>
      <DrivePicker
        open={open}
        busy={busy}
        onClose={() => setOpen(false)}
        onPick={pick}
      />
    </section>
  );
}
