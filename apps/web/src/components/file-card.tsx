"use client";

import { fileKind, fileMeta } from "@/lib/file-kind";
import type { PackFile } from "@/lib/pack-types";

/** One attached Drive file: kind badge, name, what it is, and a way out. */
export function FileCard({
  file,
  busy,
  onRemove,
}: {
  file: PackFile;
  busy: boolean;
  onRemove: () => void;
}) {
  return (
    <div className="ck-file-card">
      <span className="ck-file-icon" aria-hidden="true">
        {fileKind(file.mimeType).badge}
      </span>
      <div className="ck-file-main">
        <span className="ck-file-name">
          {file.url ? (
            <a href={file.url} target="_blank" rel="noreferrer">
              {file.name}
            </a>
          ) : (
            file.name
          )}
        </span>
        <span className="ck-file-meta">{fileMeta(file)}</span>
      </div>
      <button
        type="button"
        className="ck-btn ck-btn--tiny"
        disabled={busy}
        onClick={onRemove}
      >
        Remove
      </button>
    </div>
  );
}
