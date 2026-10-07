import { build } from "esbuild";
async function load(path) {
  const r = await build({
    entryPoints: [path],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    logLevel: "silent",
  });
  return import(
    "data:text/javascript;base64," +
      Buffer.from(r.outputFiles[0].text).toString("base64")
  );
}
const api = await load("supabase/functions/_shared/biology-visual-library.ts"),
  pub = await load("supabase/functions/_shared/biology-visual-public.ts"),
  fixtures = await load("supabase/tests/biology-visual-fixtures.ts");
for (const file of [
  ...pub.APPROVED_VISUAL_FILES,
  ...pub.SYNTHETIC_VISUAL_FILES,
])
  await api.verifyVisualBytes(file);
const ids = new Set();
for (const file of pub.APPROVED_VISUAL_FILES) {
  const asset = api.BIOLOGY_ASSET_LEDGER.find(
    (a) => a.assetId === file.assetId && a.version === file.version,
  );
  if (!asset || !asset.roles.length || !asset.levels.length)
    throw new Error(
      "Public production file has no corresponding reviewed ledger record.",
    );
  api.reviewedAsset(
    asset,
    asset.levels[0],
    asset.roles[0],
    api.BIOLOGY_ASSET_LEDGER,
    pub.APPROVED_VISUAL_FILES,
  );
}
for (const a of api.BIOLOGY_ASSET_LEDGER) {
  if (
    a.features !== undefined ||
    a.identityAnswers !== undefined ||
    a.evidenceGuidance !== undefined ||
    a.structures.length ||
    a.organisms.length
  )
    throw new Error(
      "Private scientific/marking annotations must not be committed to the public repository.",
    );
  const id = a.assetId + "v" + a.version;
  if (ids.has(id)) throw new Error("Duplicate immutable asset version.");
  ids.add(id);
  if (a.state === "approved" && a.usage === "production") {
    for (const role of a.roles)
      for (const level of a.levels)
        api.reviewedAsset(
          a,
          level,
          role,
          api.BIOLOGY_ASSET_LEDGER,
          pub.APPROVED_VISUAL_FILES,
        );
  }
}
const consumer = await load(
    "supabase/functions/_shared/biology-visual-assessment.ts",
  ),
  contract = await load(
    "supabase/functions/_shared/ocr-alevel-biology-paper3-contract.ts",
  );
for (const mode of ["full_mock", "short_practice"]) {
  const assets = fixtures.simulatedApprovedAssets(),
    files = fixtures.simulatedApprovedFiles();
  const saved = consumer.selectVisualAssessment(mode, assets, files),
    plan = consumer.applyVisualAssessment(
      contract.buildOcrAlevelPaper3Plan(mode, "not_tiered"),
      saved,
      assets,
      files,
    ),
    rows = await consumer.seededVisualRows(plan, assets, files);
  if (
    plan.totalMarks !== (mode === "full_mock" ? 70 : 20) ||
    plan.durationMinutes !== (mode === "full_mock" ? 90 : 26) ||
    rows.length !== (mode === "full_mock" ? 3 : 2)
  )
    throw new Error("Paper 3 visual-consumer totals/bindings changed.");
  console.log(
    `H420/03 ${mode}: ${plan.totalMarks} marks / ${plan.durationMinutes} minutes / ${rows.length} asset-first parts. Simulated approvals ONLY; not live assets.`,
  );
}
for (const role of ["label", "compare", "observe"]) {
  const f = fixtures.visualFixture(role);
  pub.parseVisualResource(f.resource);
  if (f.key.maxMarks !== f.part.marks)
    throw new Error("Visual private marking mismatch.");
  if (
    JSON.stringify(f.resource).match(
      /accepted|guidance|answer|xylem|phloem|epithelial|muscle|connective/i,
    )
  )
    throw new Error("Answer disclosed in public fixture.");
}
console.log(
  `Biology visual foundation PASS: ${pub.SYNTHETIC_VISUAL_FILES.length} original synthetic fixtures; ${pub.APPROVED_VISUAL_FILES.length} production-approved assets. Checksums, overlays, attribution and normalized response contracts checked offline. No model call. Human legal/scientific review remains required.`,
);
