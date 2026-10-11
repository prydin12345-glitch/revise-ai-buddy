import { build } from "esbuild";
import { fetchReviewedSource } from "./profile-source-fetch.mjs";
const b = await build({
  entryPoints: ["supabase/functions/_shared/profile-source-registry.ts"],
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
});
const { SOURCE_REGISTRY } = await import(
  "data:text/javascript;base64," +
    Buffer.from(b.outputFiles[0].text).toString("base64")
);
if (!process.argv.includes("--refresh")) {
  console.log(
    "Read-only source refresh requires --refresh. No profiles, evidence or approvals are automatically updated.",
  );
  process.exit(0);
}
const source = SOURCE_REGISTRY.find(
  (s) => s.id === process.argv.find((a) => a.startsWith("--source="))?.slice(9),
);
if (!source) throw Error("Choose a registered --source=ID");
for (const document of source.evidence.documents) {
  try {
    const result = await fetchReviewedSource(document.url);
    console.log(
      JSON.stringify({
        source: source.id,
        title: document.title,
        url: result.url,
        previous: document.checksum,
        current: result.checksum,
        changed: result.checksum !== document.checksum,
        reviewRequired: result.checksum !== document.checksum,
      }),
    );
  } catch (error) {
    console.error(document.title + ": " + error.message);
    process.exitCode = 1;
  }
}
