// @vitest-environment node
import { it, expect, vi } from "vitest";
import { getDocumentProxy } from "unpdf";
import {
  extractPdfPages,
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
