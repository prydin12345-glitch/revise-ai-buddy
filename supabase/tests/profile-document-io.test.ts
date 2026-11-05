// @vitest-environment node
import { it, expect, vi } from "vitest";
import { getDocumentProxy } from "unpdf";
import {
  extractPdfPages,
  extractIndexedPdfPages,
  readLimitedBody,
} from "../functions/_shared/profile-document-io";
function pdf() {
  const stream =
      "BT /F1 12 Tf 30 150 Td (BIO101: Cells and Enzymes. 6 marks. 30 minutes.) Tj ET",
    objects = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    ];
  let file = "%PDF-1.4\n",
    offsets = [0];
  objects.forEach((o, i) => {
    offsets.push(file.length);
    file += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const start = file.length;
  file +=
    "xref\n0 6\n0000000000 65535 f \n" +
    offsets
      .slice(1)
      .map((o) => String(o).padStart(10, "0") + " 00000 n \n")
      .join("") +
    "trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n" +
    start +
    "\n%%EOF";
  return new TextEncoder().encode(file);
}
it("parses a real PDF through the pinned parser with scripts/eval/font rendering disabled", async () => {
  let options: any;
  const pages = await extractPdfPages(pdf(), async (b, o) => {
    options = o;
    return (await getDocumentProxy(b, o)) as any;
  });
  expect(pages[0]).toContain("Cells and Enzymes");
  expect(options).toMatchObject({
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
    useWorkerFetch: false,
  });
});

function readableDocument(texts: string[]) {
  const cleanups = texts.map(() => vi.fn()),
    destroy = vi.fn(async () => {}),
    getPage = vi.fn(async (page: number) => ({
      getTextContent: async () => ({ items: [{ str: texts[page - 1] }] }),
      cleanup: cleanups[page - 1],
    }));
  return {
    document: { numPages: texts.length, getPage, loadingTask: { destroy } },
    cleanups,
    destroy,
    getPage,
  };
}
it("indexes a complete ninety-page specification beyond the legacy text ceiling", async () => {
  const fixture = readableDocument(
    Array.from({ length: 90 }, (_, i) => "Page " + i + " " + "x".repeat(1500)),
  );
  const pages = await extractIndexedPdfPages(
    pdf(),
    async () => fixture.document,
  );
  expect(pages).toHaveLength(90);
  expect(pages.reduce((n, page) => n + page.length, 0)).toBeGreaterThan(45000);
  expect(fixture.getPage).toHaveBeenLastCalledWith(90);
  expect(
    fixture.cleanups.every((cleanup) => cleanup.mock.calls.length === 1),
  ).toBe(true);
  expect(fixture.destroy).toHaveBeenCalledOnce();
});
it("retains legacy extraction rejection while permitting the same indexed source", async () => {
  const fixture = readableDocument(["x".repeat(46000)]);
  await expect(
    extractPdfPages(pdf(), async () => fixture.document),
  ).rejects.toThrow(/shorter/);
  await expect(
    extractIndexedPdfPages(pdf(), async () => fixture.document),
  ).resolves.toHaveLength(1);
});
it("allows 240 indexed pages and rejects page 241 before reading any content", async () => {
  const atLimit = readableDocument(
    Array.from({ length: 240 }, () => "Readable"),
  );
  await expect(
    extractIndexedPdfPages(pdf(), async () => atLimit.document),
  ).resolves.toHaveLength(240);
  const tooMany = readableDocument(
    Array.from({ length: 241 }, () => "Readable"),
  );
  await expect(
    extractIndexedPdfPages(pdf(), async () => tooMany.document),
  ).rejects.toThrow(/too many pages/);
  expect(tooMany.getPage).not.toHaveBeenCalled();
  expect(tooMany.destroy).toHaveBeenCalledOnce();
});
it("rejects oversized extracted text with cleanup rather than keeping a partial index", async () => {
  const fixture = readableDocument(["x".repeat(300000), "x".repeat(300000)]);
  await expect(
    extractIndexedPdfPages(pdf(), async () => fixture.document),
  ).rejects.toThrow(/shorter/);
  expect(
    fixture.cleanups.every((cleanup) => cleanup.mock.calls.length === 1),
  ).toBe(true);
  expect(fixture.destroy).toHaveBeenCalledOnce();
});
it("preserves heading line breaks without enabling document evaluation or external fetches", async () => {
  let options: unknown;
  const destroy = vi.fn(async () => {});
  const pages = await extractIndexedPdfPages(
    pdf(),
    async (_bytes, provided) => {
      options = provided;
      return {
        numPages: 1,
        getPage: async () => ({
          getTextContent: async () => ({
            items: [
              { str: "Paper 1", hasEOL: true },
              { str: "Assessment rules", hasEOL: true },
              { str: "90 marks" },
            ],
          }),
        }),
        loadingTask: { destroy },
      };
    },
  );
  expect(pages[0]).toBe("Paper 1\nAssessment rules\n90 marks ");
  expect(options).toMatchObject({
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
    useWorkerFetch: false,
  });
});
it("keeps the original upload intact when the real parser transfers its working buffer", async () => {
  const bytes = pdf(),
    original = bytes.slice();
  const pages = await extractIndexedPdfPages(
    bytes,
    async (working, options) =>
      (await getDocumentProxy(working, options)) as any,
  );
  expect(pages[0]).toContain("Cells and Enzymes");
  expect(bytes).toEqual(original);
});
it("gives a readable-text action for scanned PDFs and an unlock action for encrypted PDFs", async () => {
  const empty = readableDocument(["  ", ""]);
  await expect(
    extractIndexedPdfPages(pdf(), async () => empty.document),
  ).rejects.toThrow(/no readable text/);
  expect(empty.destroy).toHaveBeenCalledOnce();
  await expect(
    extractIndexedPdfPages(pdf(), async () => {
      const error = new Error("Need a password");
      error.name = "PasswordException";
      throw error;
    }),
  ).rejects.toThrow(/locked/);
});
it("rejects incorrect PDF signatures and oversized files without starting the parser", async () => {
  const load = vi.fn();
  await expect(
    extractIndexedPdfPages(new TextEncoder().encode("hello"), load),
  ).rejects.toThrow(/not a readable PDF/);
  await expect(
    extractIndexedPdfPages(new Uint8Array(3000001), load),
  ).rejects.toThrow(/3 MB/);
  expect(load).not.toHaveBeenCalled();
});
it("bounds a stalled page and destroys its parser after timing out", async () => {
  const destroy = vi.fn(async () => {}),
    cleanup = vi.fn();
  await expect(
    extractIndexedPdfPages(
      pdf(),
      async () => ({
        numPages: 1,
        getPage: async () => ({
          getTextContent: async () => new Promise(() => {}),
          cleanup,
        }),
        loadingTask: { destroy },
      }),
      5,
    ),
  ).rejects.toThrow(/timed out/);
  expect(cleanup).toHaveBeenCalledOnce();
  expect(destroy).toHaveBeenCalledOnce();
});
it("cleans up the actual parser loadingTask API on success and rejection", async () => {
  const destroy = vi.fn(async () => {}),
    load = async () => ({
      numPages: 121,
      getPage: vi.fn(),
      loadingTask: { destroy },
    });
  await expect(extractPdfPages(pdf(), load as any)).rejects.toThrow(
    /too many pages/,
  );
  expect(destroy).toHaveBeenCalledOnce();
});
it("destroys a late-loaded parser after timeout without background extraction", async () => {
  const destroy = vi.fn(async () => {}),
    getPage = vi.fn();
  await expect(
    extractPdfPages(
      pdf(),
      (async () => {
        await new Promise((r) => setTimeout(r, 12));
        return { numPages: 1, getPage, loadingTask: { destroy } };
      }) as any,
      2,
    ),
  ).rejects.toThrow(/timed out/);
  await new Promise((r) => setTimeout(r, 20));
  expect(destroy).toHaveBeenCalledOnce();
  expect(getPage).not.toHaveBeenCalled();
});
it("limits actual streamed request bytes and cancels the reader", async () => {
  let cancelled = false;
  const stream = new ReadableStream({
    start(c) {
      c.enqueue(new Uint8Array(8));
      c.enqueue(new Uint8Array(8));
    },
    cancel() {
      cancelled = true;
    },
  });
  await expect(readLimitedBody(stream, 10)).rejects.toThrow(/too large/);
  expect(cancelled).toBe(true);
});
it("bounds a stalled document/request body", async () => {
  await expect(
    readLimitedBody(new ReadableStream({ start() {} }), 10, 5),
  ).rejects.toThrow(/timed out/);
});
it("extracts bounded UTF-8 body bytes intact", async () => {
  const bytes = new TextEncoder().encode("μm");
  const result = await readLimitedBody(
    new ReadableStream({
      start(c) {
        c.enqueue(bytes);
        c.close();
      },
    }),
    10,
  );
  expect(new TextDecoder().decode(result)).toBe("μm");
});
