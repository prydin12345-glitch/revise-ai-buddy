import { MAX_DOCUMENT_PAGES, MAX_EXTRACTED_TEXT } from "./profile-evidence.ts";
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
interface TextDocument {
  numPages: number;
  getPage: (
    page: number,
  ) => Promise<{
    getTextContent: () => Promise<{ items: Array<{ str?: string }> }>;
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
    if (doc.numPages > MAX_DOCUMENT_PAGES)
      throw Error("PDF has too many pages.");
    const pages: string[] = [];
    let chars = 0;
    for (let i = 1; i <= doc.numPages; i++) {
      const p = await beforeDeadline(doc.getPage(i), deadline),
        c = await beforeDeadline(p.getTextContent(), deadline),
        text = c.items.map((x) => x.str ?? "").join(" ");
      chars += text.length;
      if (chars > MAX_EXTRACTED_TEXT)
        throw Error("Upload a shorter syllabus or assessment brief.");
      pages.push(text);
    }
    return pages;
  } finally {
    await doc.loadingTask.destroy();
  }
}
