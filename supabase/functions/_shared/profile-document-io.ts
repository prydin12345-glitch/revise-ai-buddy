import { MAX_DOCUMENT_PAGES, MAX_EXTRACTED_TEXT } from "./profile-evidence.ts";
import { INDEXED_DOCUMENT_LIMITS } from "./profile-document-index.ts";
async function beforeDeadline<T>(
  pending: Promise<T>,
  deadline: number,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw Error("Document operation timed out.");
  try {
    return await Promise.race([
      pending,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(Error("Document operation timed out.")),
          remaining,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer!);
  }
}
export async function readLimitedBody(
  stream: ReadableStream<Uint8Array> | null,
  maxBytes: number,
  timeoutMs = 15000,
) {
  if (!stream) throw Error("Missing request body.");
  const reader = stream.getReader(),
    chunks: Uint8Array[] = [];
  let size = 0;
  const deadline = Date.now() + timeoutMs;
  try {
    while (true) {
      const { done, value } = await beforeDeadline(reader.read(), deadline);
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw Error("Document/request is too large.");
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const c of chunks) {
      bytes.set(c, offset);
      offset += c.length;
    }
    return bytes;
  } finally {
    void reader.cancel().catch(() => {});
  }
}
export interface TextDocument {
  numPages: number;
  getPage: (page: number) => Promise<{
    getTextContent: () => Promise<{
      items: Array<{ str?: string; hasEOL?: boolean }>;
    }>;
    cleanup?: () => void | Promise<void>;
  }>;
  loadingTask: { destroy: () => Promise<void> };
}
/** Text extraction only; scripts, font rendering and worker fetch disabled. */
export async function extractPdfPages(
  bytes: Uint8Array,
  load: (
    b: Uint8Array,
    options: Record<string, boolean>,
  ) => Promise<TextDocument>,
  timeoutMs = 20000,
  limits: {
    maxPages: number;
    maxCharacters: number;
    preserveLines?: boolean;
  } = { maxPages: MAX_DOCUMENT_PAGES, maxCharacters: MAX_EXTRACTED_TEXT },
) {
  const deadline = Date.now() + timeoutMs,
    pending = load(bytes, {
      isEvalSupported: false,
      disableFontFace: true,
      useSystemFonts: false,
      useWorkerFetch: false,
    });
  let doc: TextDocument;
  try {
    doc = await beforeDeadline(pending, deadline);
  } catch (e) {
    void pending.then((d) => d.loadingTask.destroy()).catch(() => {});
    throw e;
  }
  try {
    if (!Number.isSafeInteger(doc.numPages) || doc.numPages < 1)
      throw Error("This PDF has no readable pages.");
    if (doc.numPages > limits.maxPages) throw Error("PDF has too many pages.");
    const pages: string[] = [];
    let chars = 0;
    for (let i = 1; i <= doc.numPages; i++) {
      const p = await beforeDeadline(doc.getPage(i), deadline);
      try {
        const c = await beforeDeadline(p.getTextContent(), deadline),
          text = limits.preserveLines
            ? c.items
                .map((x) => (x.str ?? "") + (x.hasEOL ? "\n" : " "))
                .join("")
            : c.items.map((x) => x.str ?? "").join(" ");
        chars += text.length;
        if (chars > limits.maxCharacters)
          throw Error("Upload a shorter syllabus or assessment brief.");
        pages.push(text);
      } finally {
        if (p.cleanup)
          await beforeDeadline(Promise.resolve(p.cleanup()), deadline);
      }
    }
    return pages;
  } finally {
    await doc.loadingTask.destroy();
  }
}

/**
 * The source-ingestion path indexes a whole readable specification before it
 * chooses evidence. Legacy propose requests keep their original limits above.
 */
export async function extractIndexedPdfPages(
  bytes: Uint8Array,
  load: Parameters<typeof extractPdfPages>[1],
  timeoutMs = 20000,
) {
  if (!bytes.length || bytes.length > INDEXED_DOCUMENT_LIMITS.maxBytes)
    throw Error("Upload a readable PDF no larger than 3 MB.");
  if (new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-")
    throw Error("This file is not a readable PDF.");
  let pages: string[];
  try {
    // PDF.js may transfer/detach its input buffer. Keep the caller's original
    // bytes intact for the trusted checksum and duplicate-source detection.
    pages = await extractPdfPages(bytes.slice(), load, timeoutMs, {
      maxPages: INDEXED_DOCUMENT_LIMITS.maxPages,
      maxCharacters: INDEXED_DOCUMENT_LIMITS.maxCharacters,
      preserveLines: true,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      /password|encrypt/i.test(error.name + " " + error.message)
    )
      throw Error("This PDF is locked. Upload an unlocked text-based PDF.");
    throw error;
  }
  if (!pages.some((page) => page.trim()))
    throw Error(
      "This PDF has no readable text. Upload a text-based PDF or text syllabus; scanned pages need a text version.",
    );
  return pages;
}
