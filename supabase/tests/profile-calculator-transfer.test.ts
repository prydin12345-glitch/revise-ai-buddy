// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  prepareProfileSave,
  templateFromPreset,
  type BuilderProposal,
} from "../functions/_shared/profile-builder-service";
import { canonical, checksum, compileTemplate } from "../functions/_shared/profile-template";
import { validateEvidence } from "../functions/_shared/profile-evidence";
import { fingerprint } from "../functions/_shared/profile-fingerprint";
import { APPROVAL_REGISTRY, profileSettingsCanonical } from "../functions/_shared/preset-approval";
import {
  resolveSavedTemplate,
  snapshotTemplate,
  templateSnapshotInstructions,
  templateSnapshotPlan,
} from "../functions/_shared/profile-template-context";
import { ownerEvidence, templateFixture } from "./profile-builder-fixtures";

async function proposal(origin: "source_backed_ai" | "model_knowledge_ai"): Promise<BuilderProposal> {
  const template = templateFixture();
  template.calculator = "unknown";
  template.identity.tier = null;
  const evidence = origin === "source_backed_ai" ? await ownerEvidence() : null;
  if (evidence) {
    // This source really is silent about calculator, tier, totals and format.
    const text = "BIO101 Final. Topics: Cells and Enzymes.";
    evidence.identity = { ...template.identity };
    evidence.documents[0].checksum = await checksum(text);
    evidence.documents[0].locations[0].text = text;
    evidence.facts = {
      ...evidence.facts, marks: null, durationMinutes: null, tier: null,
      calculator: "unknown", formats: [], selection: "unknown",
    };
    evidence.claims = evidence.claims.filter(claim => claim.field === "topics");
  }
  return {
    proposalVersion: 1, promptVersion: 1, template, origin, evidence,
    evidenceVersion: evidence ? fingerprint(canonical(validateEvidence(evidence))) : null,
    presetId: null, profileSettings: null,
  };
}

describe("generic profile calculator policy transfer", () => {
  it("preserves a genuinely unknown source rule in new scalar settings and snapshots without inventing source facts", async () => {
    const p = await proposal("source_backed_ai");
    const evidenceBefore = JSON.stringify(p.evidence);
    const saved = prepareProfileSave(p, p.template);
    expect(saved.settings.calculator_policy).toBe("unknown");
    expect(saved.settings.assessment_tier).toBeNull();
    expect(saved.context.template.calculator).toBe("unknown");
    expect(saved.context.evidence).toBe(p.evidence);
    expect(JSON.stringify(saved.context.evidence)).toBe(evidenceBefore);
    expect(saved.context.evidenceVersion).toBe(p.evidenceVersion);
    const profile = JSON.parse(JSON.stringify({ ...saved.settings, profile_template: saved.context }));
    const frozen = snapshotTemplate(profile)!;
    expect(resolveSavedTemplate(profile)?.context.template.calculator).toBe("unknown");
    expect(frozen.context.evidence).toMatchObject({ facts: {
      marks: null, durationMinutes: null, tier: null, calculator: "unknown",
      formats: [], selection: "unknown",
    } });
    expect(templateSnapshotInstructions({ profile_template: frozen })).toContain('"calculator":"unknown"');
    expect(templateSnapshotPlan(frozen)).toEqual(compileTemplate(p.template));
    // Practice layout choices do not verify an authentic full mock.
    expect(() => prepareProfileSave(p, { ...p.template, mode: "full_mock" })).toThrow(/unknown|Resolve/i);
  });

  it.each(["unknown", "allowed", "not_allowed"] as const)(
    "transfers the model-knowledge template's explicit %s value without a fallback", async calculator => {
      const p = await proposal("model_knowledge_ai");
      p.template.calculator = calculator;
      const saved = prepareProfileSave(p, p.template);
      expect(saved.settings.calculator_policy).toBe(calculator);
      expect(saved.context.template.calculator).toBe(calculator);
      expect(saved.context.profileSettingsCanonical).toBe(profileSettingsCanonical(saved.settings));
    },
  );

  it.each(["source_backed_ai", "model_knowledge_ai"] as const)(
    "reads existing %s contexts whose old unknown rule was saved as allowed without changing their binding", async origin => {
      const p = await proposal(origin);
      const saved = prepareProfileSave(p, p.template);
      // Reproduce the exact pre-fix settings/context combination persisted in v1.
      const legacySettings = { ...saved.settings, calculator_policy: "allowed" };
      const legacyCanonical = profileSettingsCanonical(legacySettings);
      const legacy = JSON.parse(JSON.stringify({
        ...legacySettings,
        profile_template: { ...saved.context, profileSettingsCanonical: legacyCanonical },
      }));
      const before = JSON.stringify(legacy);
      const resolved = resolveSavedTemplate(legacy)!;
      expect(resolved.context.profileSettingsCanonical).toBe(legacyCanonical);
      expect(resolved.context.template.calculator).toBe("unknown");
      expect(resolved.plan).toEqual(compileTemplate(p.template));
      const frozen = snapshotTemplate(legacy)!;
      expect(frozen.settingsCanonical).toBe(legacyCanonical);
      expect(frozen.context.template.calculator).toBe("unknown");
      expect(templateSnapshotPlan(frozen)).toEqual(resolved.plan);
      expect(JSON.stringify(legacy)).toBe(before);
      expect(legacy.calculator_policy).toBe("allowed");
      expect(() => resolveSavedTemplate({ ...legacy, calculator_policy: "unknown" })).toThrow(/Settings changed/);
    },
  );

  it("leaves the approved catalogue settings and approval path unchanged", () => {
    const entry = APPROVAL_REGISTRY.find(entry => entry.component === "H420/03" && entry.mode === "full_mock")!;
    const p = templateFromPreset(entry.id);
    const saved = prepareProfileSave(p, p.template);
    expect(saved.approval.status).toBe("approved");
    expect(saved.context.origin).toBe("catalogue");
    expect(saved.settings.calculator_policy).toBe("allowed");
    expect(saved.context.profileSettingsCanonical).toBe(profileSettingsCanonical(saved.settings));
  });
});
