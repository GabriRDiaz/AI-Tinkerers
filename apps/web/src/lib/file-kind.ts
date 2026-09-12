/** Mime-aware labels so Drive files read as documents, not as opaque rows. */

type Kind = { badge: string; name: string };

const GOOGLE_KINDS: Record<string, Kind> = {
  "application/vnd.google-apps.document": { badge: "DOC", name: "Google Doc" },
  "application/vnd.google-apps.spreadsheet": {
    badge: "SHT",
    name: "Google Sheet",
  },
  "application/vnd.google-apps.presentation": {
    badge: "SLD",
    name: "Google Slides",
  },
  "application/vnd.google-apps.form": { badge: "FRM", name: "Google Form" },
  "application/vnd.google-apps.folder": { badge: "DIR", name: "Folder" },
};

const EXACT_KINDS: Record<string, Kind> = {
  "application/pdf": { badge: "PDF", name: "PDF" },
  "application/msword": { badge: "DOC", name: "Word document" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    badge: "DOC",
    name: "Word document",
  },
  "application/vnd.ms-excel": { badge: "SHT", name: "Excel sheet" },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
    badge: "SHT",
    name: "Excel sheet",
  },
  "application/vnd.ms-powerpoint": { badge: "SLD", name: "PowerPoint" },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": {
    badge: "SLD",
    name: "PowerPoint",
  },
  "application/zip": { badge: "ZIP", name: "Archive" },
  "text/csv": { badge: "CSV", name: "CSV" },
};

export function fileKind(mimeType: string | undefined): Kind {
  const mime = (mimeType ?? "").toLowerCase();
  const known = GOOGLE_KINDS[mime] ?? EXACT_KINDS[mime];
  if (known) return known;
  if (mime.startsWith("image/")) return { badge: "IMG", name: "Image" };
  if (mime.startsWith("video/")) return { badge: "VID", name: "Video" };
  if (mime.startsWith("audio/")) return { badge: "AUD", name: "Audio" };
  if (mime.startsWith("text/")) return { badge: "TXT", name: "Text file" };
  return { badge: "FILE", name: "Drive file" };
}

export function formatFileSize(size: number | undefined) {
  if (!size || size <= 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

/** "Google Doc" or "PDF · 240.5 KB" — Drive omits a size for its own formats. */
export function fileMeta(file: { mimeType?: string; size?: number }) {
  return [fileKind(file.mimeType).name, formatFileSize(file.size)]
    .filter(Boolean)
    .join(" · ");
}
