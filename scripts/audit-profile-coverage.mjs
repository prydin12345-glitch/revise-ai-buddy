import { build } from "esbuild";
const b = await build({
  entryPoints: ["supabase/functions/_shared/preset-approval.ts"],
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  logLevel: "silent",
});
const api = await import(
  "data:text/javascript;base64," +
    Buffer.from(b.outputFiles[0].text).toString("base64")
);
const audit = await api.auditApprovals();
const layouts = await build({
  entryPoints: ["src/lib/paperPresets.ts"],
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  logLevel: "silent",
});
const { BLUEPRINT_PRESETS } = await import(
  "data:text/javascript;base64," +
    Buffer.from(layouts.outputFiles[0].text).toString("base64")
);
const report = {
  registryVersion: 1,
  presets: api.APPROVAL_REGISTRY.map((e) => ({
    ...e,
    settingsCanonical: undefined,
    starred: ["approved", "superseded"].includes(e.status),
    audit: audit.find((a) => a.id === e.id)?.ok,
  })),
  pendingLayouts: BLUEPRINT_PRESETS.map((e) => ({
    id: e.id,
    label: e.label,
    implementation: "src/lib/paperPresets.ts",
    status: "pending",
    starred: false,
    reason:
      "Legacy layout exists; no immutable course/tier/version contract and explicit completed approval evidence.",
  })),
  pendingVariants: [
    {
      id: "ocr_h420_03_visual_v1",
      implementation: "supabase/functions/_shared/biology-visual-plan.ts",
      status: "pending",
      starred: false,
      reason:
        "Reviewed visual assets exist; a distinct immutable preset fingerprint/approval record is not yet registered.",
    },
    {
      id: "interactive_v1",
      implementation: "supabase/functions/_shared/response-format-policy.ts",
      status: "pending",
      starred: false,
      reason:
        "Response conversion is implemented; generation-affecting policy changes are not covered by the default paper approval fingerprints.",
    },
  ],
  unsupported: [
    "WJEC Unit 3 practical assessment",
    "Pearson Edexcel A Level Biology A 9BN0",
    "Pearson Edexcel Biology B Papers 2/3",
    "Unregistered international/institution components",
  ],
  sourceBacked: [
    {
      course: "Pearson Edexcel A Level Biology B",
      component: "9BI0/01",
      starred: false,
      source: "pearson-9bi0-01-issue4",
    },
  ],
};
if (process.argv.includes("--json"))
  console.log(JSON.stringify(report, null, 2));
else
  console.table(
    report.presets.map((e) => ({
      id: e.id,
      status: e.status,
      star: e.starred ? "★" : "",
      audit: e.audit ? "PASS" : "FAIL",
    })),
  );
if (!process.argv.includes("--json"))
  console.log(
    `${report.pendingLayouts.length} legacy layout entries remain pending; no star. Source-backed coverage does not confer approval.`,
  );
if (audit.some((a) => !a.ok)) process.exitCode = 1;
