"use client";

import { useEffect, useState, type FormEvent } from "react";
import { requestDriveBrowse } from "@/lib/google-client";
import type { DriveBrowseItem } from "@/lib/pack-types";

type Crumb = { id: string; name: string };
type View = "mine" | "shared";

export function DrivePicker({
  open,
  busy,
  onClose,
  onPick,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onPick: (files: DriveBrowseItem[]) => Promise<void> | void;
}) {
  const [view, setView] = useState<View>("mine");
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [folderId, setFolderId] = useState("root");
  const [crumbs, setCrumbs] = useState<Crumb[]>([{ id: "root", name: "My Drive" }]);
  const [files, setFiles] = useState<DriveBrowseItem[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, DriveBrowseItem>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setView("mine");
    setQuery("");
    setActiveQuery("");
    setFolderId("root");
    setCrumbs([{ id: "root", name: "My Drive" }]);
    setSelected({});
    setError("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    requestDriveBrowse(folderId, undefined, {
      query: activeQuery || undefined,
      shared: !activeQuery && view === "shared",
    })
      .then((result) => {
        if (cancelled) return;
        setFiles(result.files);
        setNextPageToken(result.nextPageToken);
      })
      .catch((caught) => {
        if (cancelled) return;
        setFiles([]);
        setNextPageToken(null);
        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to list Drive files.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeQuery, folderId, open, view]);

  async function loadMore() {
    if (!nextPageToken || loading) return;
    setLoading(true);
    try {
      const result = await requestDriveBrowse(folderId, nextPageToken, {
        query: activeQuery || undefined,
        shared: !activeQuery && view === "shared",
      });
      setFiles((current) => [...current, ...result.files]);
      setNextPageToken(result.nextPageToken);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to list Drive files.",
      );
    } finally {
      setLoading(false);
    }
  }

  function openFolder(item: DriveBrowseItem) {
    setActiveQuery("");
    setQuery("");
    setView("mine");
    setFolderId(item.id);
    setCrumbs((current) => [...current, { id: item.id, name: item.name }]);
  }

  function jumpTo(index: number) {
    const crumb = crumbs[index];
    setActiveQuery("");
    setQuery("");
    setView("mine");
    setFolderId(crumb.id);
    setCrumbs((current) => current.slice(0, index + 1));
  }

  function switchView(next: View) {
    setView(next);
    setActiveQuery("");
    setQuery("");
    setFolderId("root");
    setCrumbs([
      {
        id: "root",
        name: next === "shared" ? "Shared with me" : "My Drive",
      },
    ]);
  }

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActiveQuery(query.trim());
  }

  function toggle(item: DriveBrowseItem) {
    setSelected((current) => {
      const next = { ...current };
      if (next[item.id]) delete next[item.id];
      else next[item.id] = item;
      return next;
    });
  }

  const chosen = Object.values(selected);

  if (!open) return null;

  return (
    <div className="ck-picker-backdrop" role="presentation" onClick={onClose}>
      <div
        className="ck-picker"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drive-picker-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="ck-picker-header">
          <h3 id="drive-picker-title">Pick from Google Drive</h3>
          <button type="button" className="ck-btn" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="ck-picker-toolbar">
          <button
            type="button"
            className={view === "mine" && !activeQuery ? "ck-btn ck-btn--primary" : "ck-btn"}
            onClick={() => switchView("mine")}
          >
            My Drive
          </button>
          <button
            type="button"
            className={view === "shared" && !activeQuery ? "ck-btn ck-btn--primary" : "ck-btn"}
            onClick={() => switchView("shared")}
          >
            Shared with me
          </button>
          <form onSubmit={search} className="ck-picker-search">
            <label htmlFor="drive-search" className="ck-sr-only">
              Search Drive
            </label>
            <input
              id="drive-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search Drive"
            />
            <button type="submit" className="ck-btn">
              Search
            </button>
          </form>
        </div>
        <nav className="ck-picker-crumbs" aria-label="Folder path">
          {activeQuery ? (
            <span>Search results for “{activeQuery}”</span>
          ) : (
            crumbs.map((crumb, index) => (
              <button
                key={`${crumb.id}-${index}`}
                type="button"
                className="ck-picker-crumb"
                disabled={index === crumbs.length - 1}
                onClick={() => jumpTo(index)}
              >
                {crumb.name}
              </button>
            ))
          )}
        </nav>
        {error ? (
          <p role="alert" className="ck-error">
            {error}
          </p>
        ) : null}
        {loading && !files.length ? (
          <p className="ck-empty">Loading Drive files…</p>
        ) : files.length ? (
          <ul className="ck-picker-list">
            {files.map((item) => (
              <li key={item.id}>
                {item.folder && !activeQuery ? (
                  <button
                    type="button"
                    className="ck-picker-folder"
                    onClick={() => openFolder(item)}
                  >
                    <span aria-hidden="true">📁</span>
                    <strong>{item.name}</strong>
                  </button>
                ) : (
                  <label className="ck-picker-file">
                    <input
                      type="checkbox"
                      checked={Boolean(selected[item.id])}
                      onChange={() => toggle(item)}
                    />
                    <span>
                      <strong>{item.name}</strong>
                      <span className="ck-muted">
                        {item.size
                          ? `${(item.size / 1024).toFixed(1)} KB`
                          : item.mimeType}
                      </span>
                    </span>
                  </label>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="ck-empty">
            No Drive files here. Try Shared with me or search. If you just
            granted Drive access, sign out and sign in again.
          </p>
        )}
        <div className="ck-step-actions">
          {nextPageToken ? (
            <button
              type="button"
              className="ck-btn"
              disabled={loading}
              onClick={loadMore}
            >
              Load more
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            className="ck-btn ck-btn--primary"
            disabled={busy || !chosen.length}
            onClick={async () => {
              await onPick(chosen);
            }}
          >
            {busy
              ? "Adding…"
              : chosen.length
                ? `Add ${chosen.length} file${chosen.length === 1 ? "" : "s"}`
                : "Add selected"}
          </button>
        </div>
      </div>
    </div>
  );
}
