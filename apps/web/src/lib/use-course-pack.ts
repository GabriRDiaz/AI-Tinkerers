"use client";

import { useCallback, useEffect, useState } from "react";
import {
  emptyPack,
  packReady,
  type CoursePack,
  type PackSlot,
} from "./pack-types";

async function parsePack(response: Response) {
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || `HTTP ${response.status}`);
  }
  return result.pack as CoursePack;
}

export function useCoursePack(courseId: string | null, signedIn: boolean) {
  const [pack, setPack] = useState<CoursePack | undefined>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!courseId || !signedIn) {
      setPack(undefined);
      return undefined;
    }
    const next = await parsePack(
      await fetch(`/api/pack?courseId=${encodeURIComponent(courseId)}`, {
        cache: "no-store",
      }),
    );
    setPack(next);
    return next;
  }, [courseId, signedIn]);

  useEffect(() => {
    refresh().catch((caught) => {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to load onboarding.",
      );
    });
  }, [refresh]);

  const attach = useCallback(
    async (slot: PackSlot, fileIds: string[]) => {
      if (!courseId) throw new Error("Select a course.");
      setBusy(true);
      setError("");
      try {
        const next = await parsePack(
          await fetch("/api/pack", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              intent: "document",
              courseId,
              slot,
              fileIds,
            }),
          }),
        );
        setPack(next);
        return next;
      } catch (caught) {
        const message =
          caught instanceof Error ? caught.message : "Unable to attach Drive files.";
        setError(message);
        throw caught;
      } finally {
        setBusy(false);
      }
    },
    [courseId],
  );

  const createTopic = useCallback(
    async (input: { title: string; fileIds: string[] }) => {
      if (!courseId) throw new Error("Select a course.");
      setBusy(true);
      setError("");
      try {
        const response = await fetch("/api/pack", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            intent: "topic",
            courseId,
            title: input.title,
            fileIds: input.fileIds,
          }),
        });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || `HTTP ${response.status}`);
        }
        setPack(result.pack);
        return result.topic;
      } catch (caught) {
        const message =
          caught instanceof Error ? caught.message : "Unable to create the topic.";
        setError(message);
        throw caught;
      } finally {
        setBusy(false);
      }
    },
    [courseId],
  );

  const remove = useCallback(
    async (fileId: string) => {
      if (!courseId) return;
      setBusy(true);
      setError("");
      try {
        const next = await parsePack(
          await fetch(
            `/api/pack?courseId=${encodeURIComponent(courseId)}&fileId=${encodeURIComponent(fileId)}`,
            { method: "DELETE" },
          ),
        );
        setPack(next);
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : "Unable to remove the file.",
        );
      } finally {
        setBusy(false);
      }
    },
    [courseId],
  );

  const current = pack ?? (courseId ? emptyPack(courseId) : undefined);

  return {
    pack: current,
    ready: current ? packReady(current) : false,
    error,
    busy,
    refresh,
    attach,
    createTopic,
    remove,
  };
}
