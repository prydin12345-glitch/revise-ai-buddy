// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  APPROVAL_REGISTRY,
  approvedPreset,
  auditApprovals,
  evaluateApproval,
  settingsForPlan,
  profileSettingsCanonical,
} from "../functions/_shared/preset-approval";
import { fingerprint } from "../functions/_shared/profile-fingerprint";
import { checksum, canonical } from "../functions/_shared/profile-template";
import {
  templateFromPreset,
  prepareProfileSave,
} from "../functions/_shared/profile-builder-service";
import { BIOLOGY_PAPER_PACKS } from "../functions/_shared/biology-course-packs";

describe("explicit founder adoption and immutable versions", () => {
  it("audits every actual implemented mode/tier, without rewriting any contract", async () => {
    const audit = await auditApprovals();
    expect(audit).toHaveLength(52);
    expect(audit.every((r) => r.ok)).toBe(true);
    expect(
      APPROVAL_REGISTRY.filter((e) => e.status === "approved"),
    ).toHaveLength(48);
    expect(
      APPROVAL_REGISTRY.filter((e) => e.status === "pending"),
    ).toHaveLength(2);
    expect(BIOLOGY_PAPER_PACKS.length).toBeGreaterThan(10);
  });
  for (const entry of APPROVAL_REGISTRY.filter((e) => e.status !== "pending"))
    it("round trips exact version " + entry.id, () => {
      const p = templateFromPreset(entry.id),
        save = prepareProfileSave(p, p.template);
      expect(evaluateApproval(save.settings).status).toBe(entry.status);
      expect(
        evaluateApproval({ ...save.settings, profile_name: "A renamed course" })
          .status,
      ).toBe(entry.status);
      expect(save.settings.paper_blueprint.paperContract.contractVersion).toBe(
        entry.contractVersion,
      );
    });
  it("keeps unfinished Edexcel implementation pending despite passing structural tests", () => {
    for (const e of APPROVAL_REGISTRY.filter((e) => e.status === "pending")) {
      expect(() => approvedPreset(e.id)).toThrow(/not approved/);
      expect(evaluateApproval(JSON.parse(e.settingsCanonical)).status).toBe(
        "not_approved",
      );
    }
  });
  it("matches H420/03 exactly, while wrong course, component, tier, mode and extra media policy remove approval", () => {
    const e = APPROVAL_REGISTRY.find(
        (e) => e.component === "H420/03" && e.mode === "full_mock",
      )!,
      p = approvedPreset(e.id).settings;
    expect(evaluateApproval(p).status).toBe("approved");
    for (const mutation of [
      { assessment_tier: "higher" },
      { time_limit_minutes: 91 },
      { topics: ["Cells"] },
      {
        paper_blueprint: {
          ...p.paper_blueprint,
          paperContract: {
            ...p.paper_blueprint.paperContract,
            paperId: "paper_2",
          },
        },
      },
      {
        paper_blueprint: {
          ...p.paper_blueprint,
          responseFormats: "interactive_v1",
        },
      },
      { exam_board: "AQA" },
      { question_count: 1 },
    ])
      expect(evaluateApproval({ ...p, ...mutation }, e.id).status).toBe(
        "customised",
      );
  });
  it("does not approve name resemblance or copied browser flags", () => {
    expect(
      evaluateApproval({
        profile_name: "OCR A Level Biology Paper 3",
        approved: true,
        preset_id: APPROVAL_REGISTRY[4].id,
      }).status,
    ).toBe("not_approved");
  });
  it("edited and duplicated derivatives only restore a star against the immutable original", () => {
    const e = APPROVAL_REGISTRY.find(
        (e) => e.component === "H420/03" && e.mode === "short_practice",
      )!,
      p = templateFromPreset(e.id),
      edited = structuredClone(p.template);
    edited.durationMinutes++;
    const customised = prepareProfileSave(p, edited);
    expect(customised.approval.status).toBe("customised");
    const duplicateProposal = { ...p, template: edited, profileSettings: null };
    expect(prepareProfileSave(duplicateProposal, edited).approval.status).toBe(
      "customised",
    );
    expect(
      prepareProfileSave(duplicateProposal, p.template).approval.status,
    ).toBe("approved");
  });
  it.each([
    "abc",
    "μm × 10⁶",
    "x".repeat(55),
    "x".repeat(56),
    "x".repeat(64),
    "x".repeat(1000),
  ])("synchronous UTF-8 fingerprint agrees with WebCrypto (%s)", async (s) => {
    expect(fingerprint(s)).toBe(await checksum(s));
  });
  it("has the standard SHA-256 abc digest", () =>
    expect(fingerprint("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    ));
});
