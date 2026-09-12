"use client";

import { useState, type ReactNode } from "react";
import { DrivePicker } from "@/components/drive-picker";
import { FileCard } from "@/components/file-card";
import type { DriveBrowseItem, PackFile } from "@/lib/pack-types";

export function FileStep({
  label,
  emptyTitle,
  emptyHint,
  files,
  busy,
  onAttach,
  onRemove,
  leading,
  trailing,
}: {
  label: string;
  emptyTitle: string;
  emptyHint: string;
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
    <section className="ck-file-step" aria-label={label}>
      {files.length ? (
        <ul className="ck-file-list">
          {files.map((file) => (
            <li key={file.id}>
              <FileCard
                file={file}
                busy={busy}
                onRemove={() => onRemove(file.id)}
              />
            </li>
          ))}
        </ul>
      ) : (
        <div className="ck-empty-state">
          <strong>{emptyTitle}</strong>
          <p>{emptyHint}</p>
          <button
            type="button"
            className="ck-btn"
            disabled={busy}
            onClick={() => setOpen(true)}
          >
            Pick from Drive
          </button>
        </div>
      )}

      <p role="status" className="ck-notice">
        {busy ? "Adding files…" : ""}
      </p>

      <div className="ck-step-actions">
        {leading ?? <span />}
        <div className="ck-step-actions__end">
          {files.length ? (
            <button
              type="button"
              className="ck-btn"
              disabled={busy}
              onClick={() => setOpen(true)}
            >
              Add more files
            </button>
          ) : null}
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
