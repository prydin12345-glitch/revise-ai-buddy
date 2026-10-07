import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
// Node 24's supported proxy/system-CA flags retain ordinary TLS verification.
if (process.env.HTTPS_PROXY && !process.execArgv.includes("--use-env-proxy")) {
  const r = spawnSync(
    process.execPath,
    ["--use-env-proxy", "--use-system-ca", ...process.argv.slice(1)],
    { stdio: "inherit" },
  );
  process.exit(r.status ?? 1);
}
const args = process.argv.slice(2),
  get = (k) => args[args.indexOf(k) + 1];
if (
  !args.includes("--page-id") ||
  !/^\d+$/.test(get("--page-id")) ||
  !args.includes("--out")
)
  throw new Error(
    "Usage: node scripts/ingest-biology-visual.mjs --page-id <Commons file page ID> --out <quarantine directory outside checkout>",
  );
const output = resolve(get("--out")),
  root = resolve(".");
if (output === root || output.startsWith(root + "/"))
  throw new Error(
    "Quarantine must be outside the checkout; never download into public/source folders.",
  );
const b = await build({
    entryPoints: ["supabase/functions/_shared/biology-visual-ingestion.ts"],
    bundle: true,
    write: false,
    platform: "node",
    format: "esm",
  }),
  api = await import(
    "data:text/javascript;base64," +
      Buffer.from(b.outputFiles[0].text).toString("base64")
  );
const url = new URL("https://commons.wikimedia.org/w/api.php");
for (const [k, v] of Object.entries({
  action: "query",
  format: "json",
  pageids: get("--page-id"),
  prop: "imageinfo",
  iiprop: "url|size|extmetadata|sha1",
}))
  url.searchParams.set(k, v);
const request = async (u) => {
  const response = await fetch(u, {
    redirect: "error",
    signal: AbortSignal.timeout(30000),
    headers: {
      "User-Agent":
        "Examly-Biology-Asset-Review/1.0 (structured evidence; no hotlinking)",
    },
  });
  if (!response.ok)
    throw new Error(
      `Required domain ${new URL(u).hostname}: HTTP ${response.status}`,
    );
  return response;
};
const data = await (await request(url)).json(),
  page = data?.query?.pages?.[get("--page-id")];
const candidate = api.commonsCandidate(page, new Date().toISOString());
await mkdir(output, { recursive: true });
const evidence = resolve(output, candidate.evidenceId + ".json");
await writeFile(evidence, JSON.stringify(candidate, null, 2), { flag: "wx" });
if (candidate.licence.state !== "review_queue") {
  console.log(
    `${candidate.evidenceId}: ${candidate.licence.state}; evidence saved; no original downloaded.`,
  );
  process.exit(0);
}
const original = await request(candidate.originalUrl),
  type = original.headers.get("content-type")?.split(";")[0];
if (!["image/png", "image/jpeg"].includes(type))
  throw new Error(
    "Only PNG/JPEG originals enter this initial raster quarantine.",
  );
if (Number(original.headers.get("content-length")) > 20000000)
  throw new Error("Original exceeds quarantine size limit.");
const chunks = [];
let size = 0;
for await (const chunk of original.body) {
  size += chunk.length;
  if (size > 20000000)
    throw new Error("Original exceeds quarantine size limit.");
  chunks.push(chunk);
}
const bytes = Buffer.concat(chunks);
if (
  (type === "image/png" &&
    !bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
  (type === "image/jpeg" && !(bytes[0] === 255 && bytes[1] === 216))
)
  throw new Error("Original media signature disagrees with metadata.");
candidate.checksum = createHash("sha256").update(bytes).digest("hex");
candidate.mediaType = type;
candidate.quarantineFile = candidate.evidenceId + ".original";
await writeFile(resolve(output, candidate.quarantineFile), bytes, {
  flag: "wx",
});
await writeFile(evidence, JSON.stringify(candidate, null, 2));
console.log(
  `${candidate.evidenceId}: downloaded original to quarantine, SHA-256 recorded; BOTH reviews pending. Not assessment eligible.`,
);
