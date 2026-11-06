import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import { useWorkspaceSession } from "@/hooks/use-workspace-session";

export const BUILDER_ATTACHMENT_LIMITS = {
  count: 3,
  perFileBytes: 3_000_000,
  totalBytes: 6_000_000,
} as const;

export type BuilderAttachmentStatus =
  | "attached"
  | "reading"
  | "checked"
  | "needs_recheck"
  | "error";
export interface BuilderAttachment {
  id: string;
  name: string;
  size: number;
  contentType: "application/pdf" | "text/plain";
  base64: string;
  status: BuilderAttachmentStatus;
}

interface AttachmentSnapshot {
  files: BuilderAttachment[];
  revision: number;
  busy: boolean;
  readError: string;
}

/** Kept inside the current WorkspaceStore, never serialized to browser storage. */
class AttachmentMemory {
  private snapshot: AttachmentSnapshot = {
    files: [],
    revision: 0,
    busy: false,
    readError: "",
  };
  private listeners = new Set<() => void>();
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private update(value: Partial<AttachmentSnapshot>) {
    this.snapshot = { ...this.snapshot, ...value };
    this.listeners.forEach((listener) => listener());
  }
  beginRead() {
    const revision = this.snapshot.revision + 1;
    this.update({ revision, busy: true, readError: "" });
    return revision;
  }
  completeRead(revision: number, files: BuilderAttachment[]) {
    if (this.snapshot.revision !== revision || !this.snapshot.busy)
      return false;
    this.update({ files, busy: false, readError: "" });
    return true;
  }
  rejectRead(revision: number, readError: string) {
    if (this.snapshot.revision !== revision || !this.snapshot.busy) return;
    this.update({ busy: false, readError });
  }
  cancelRead(revision: number) {
    if (this.snapshot.revision !== revision || !this.snapshot.busy) return;
    this.update({ busy: false });
  }
  remove(id: string) {
    this.update({
      files: this.snapshot.files.filter((file) => file.id !== id),
      revision: this.snapshot.revision + 1,
      busy: false,
      readError: "",
    });
  }
  clear() {
    this.update({
      files: [],
      revision: this.snapshot.revision + 1,
      busy: false,
      readError: "",
    });
  }
  status(status: BuilderAttachmentStatus) {
    if (!this.snapshot.files.some((file) => file.status !== status)) return;
    this.update({
      files: this.snapshot.files.map((file) => ({ ...file, status })),
    });
  }
  clearError() {
    if (this.snapshot.readError) this.update({ readError: "" });
  }
}

const invalidChoice = (files: File[]) => {
  if (files.length > BUILDER_ATTACHMENT_LIMITS.count)
    return "Choose up to 3 PDF or text documents. Your attached files are unchanged.";
  if (files.some((file) => !Number.isSafeInteger(file.size) || file.size <= 0))
    return "Choose a readable, non-empty PDF or text file. Your attached files are unchanged.";
  if (
    files.some((file) => file.size > BUILDER_ATTACHMENT_LIMITS.perFileBytes) ||
    files.reduce((total, file) => total + file.size, 0) >
      BUILDER_ATTACHMENT_LIMITS.totalBytes
  )
    return "Choose files up to 3 MB each and 6 MB together. Your attached files are unchanged.";
  if (
    files.some(
      (file) =>
        !/\.(pdf|txt)$/i.test(file.name) &&
        !["application/pdf", "text/plain"].includes(file.type),
    )
  )
    return "Choose PDF or text files. Your attached files are unchanged.";
  return "";
};

function base64(bytes: Uint8Array) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return btoa(binary);
}

export function useBuilderAttachments({
  accountId,
  subjectName,
}: {
  accountId?: string | null;
  subjectName: string;
}) {
  const { store, ownerId } = useWorkspaceSession();
  const subject = subjectName.trim().toLowerCase();
  const memory = useMemo(() => {
    // A standalone/anonymous builder never retains file bytes in the shared
    // fallback store. A real workspace is replaced on sign-out/account change.
    if (!accountId || ownerId !== accountId || store.ownerId !== accountId)
      return new AttachmentMemory();
    return store.get(
      `profile-builder:attachments:v1:${accountId}:${subject}`,
      () => new AttachmentMemory(),
    );
  }, [store, ownerId, accountId, subject]);
  const snapshot = useSyncExternalStore(
    memory.subscribe,
    memory.getSnapshot,
    memory.getSnapshot,
  );
  const currentMemory = useRef(memory);
  currentMemory.current = memory;
  const ownedRead = useRef<{
    memory: AttachmentMemory;
    revision: number;
  } | null>(null);
  useEffect(
    () => () => {
      const read = ownedRead.current;
      if (read?.memory === memory) memory.cancelRead(read.revision);
    },
    [memory],
  );

  const selectFiles = useCallback(
    async (choice?: FileList | File[] | null) => {
      const files = Array.from(choice ?? []);
      // Browsers can emit an empty change event when the picker is cancelled.
      if (!files.length) return false;
      const revision = memory.beginRead();
      ownedRead.current = { memory, revision };
      const error = invalidChoice(files);
      if (error) {
        memory.rejectRead(revision, error);
        return false;
      }
      try {
        let actualTotal = 0;
        const values: BuilderAttachment[] = [];
        const seen = new Set<string>();
        for (const file of files) {
          const bytes = new Uint8Array(await file.arrayBuffer());
          actualTotal += bytes.length;
          if (
            !bytes.length ||
            bytes.length > BUILDER_ATTACHMENT_LIMITS.perFileBytes ||
            actualTotal > BUILDER_ATTACHMENT_LIMITS.totalBytes
          )
            throw Error(
              "Choose readable files up to 3 MB each and 6 MB together. Your attached files are unchanged.",
            );
          const encoded = base64(bytes);
          if (seen.has(encoded))
            throw Error(
              "Choose each document only once. Your attached files are unchanged.",
            );
          seen.add(encoded);
          values.push({
            id: crypto.randomUUID(),
            name: file.name,
            size: bytes.length,
            contentType:
              file.type === "application/pdf" || /\.pdf$/i.test(file.name)
                ? "application/pdf"
                : "text/plain",
            base64: encoded,
            status: "attached",
          });
        }
        if (currentMemory.current !== memory) {
          memory.cancelRead(revision);
          return false;
        }
        return memory.completeRead(revision, values);
      } catch (error) {
        memory.rejectRead(
          revision,
          error instanceof Error
            ? error.message
            : "Could not read this file. Your attached files are unchanged.",
        );
        return false;
      }
    },
    [memory],
  );

  const remove = useCallback((id: string) => memory.remove(id), [memory]);
  const clear = useCallback(() => memory.clear(), [memory]);
  const markForRecheck = useCallback(
    () => memory.status("needs_recheck"),
    [memory],
  );
  const setStatus = useCallback(
    (status: BuilderAttachmentStatus) => memory.status(status),
    [memory],
  );
  const clearError = useCallback(() => memory.clearError(), [memory]);
  return {
    files: snapshot.files,
    busy: snapshot.busy,
    readError: snapshot.readError,
    selectFiles,
    remove,
    clear,
    markForRecheck,
    setStatus,
    clearError,
  };
}
