// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  applyCatalogueTier,
  modelEvidenceSchema,
  validateEvidence,
} from "../functions/_shared/profile-evidence";
import { resolveCatalogueTier } from "../functions/_shared/profile-catalogue-evidence";
import { canonical, checksum } from "../functions/_shared/profile-template";
import { SOURCE_REGISTRY } from "../functions/_shared/profile-source-registry";
import { ownerEvidence } from "./profile-builder-fixtures";

const identity = {
  country: "GB",
  educationSystem: "England",
  stage: "Secondary",
  qualification: "A-level",
  subject: "Physics",
  organisation: "AQA",
  course: "7408",
  component: "7408/1",
  specificationVersion: "Version 1.4 July 2026",
  tier: "not_tiered" as const,
};
async function physics() {
  const e = await ownerEvidence();
  e.identity = { ...identity };
  const source =
    "7408/1 Physics. 85 marks; 2 hours. Mechanics and Materials. Short and long answer questions. Answer all questions. A calculator is required.";
  e.documents[0] = {
    ...e.documents[0],
    checksum: await checksum(source),
    kind: "specification",
    locations: [
      {
        id: "assessment",
        page: 9,
        section: "Paper 1 assessment",
        text: source,
      },
    ],
  };
  e.facts = {
    marks: 85,
    durationMinutes: 120,
    topics: ["Mechanics", "Materials"],
    tier: null,
    calculator: "allowed",
    formats: ["short_answer", "long_form"],
    selection: "all_compulsory",
    mathsRequirement: null,
    practicalRequirement: null,
  };
  e.claims = [
    ["marks", "85 marks"],
    ["durationMinutes", "2 hours"],
    ["topics", "Mechanics and Materials"],
    ["formats", "Short and long answer questions"],
    ["selection", "Answer all questions"],
    ["calculator", "A calculator is required"],
  ].map(([field, quote]) => ({
    field,
    quote,
    documentId: e.documents[0].id,
    locationId: "assessment",
    rule: "mandatory",
  }));
  return e;
}

describe("catalogue tier provenance", () => {
  it("derives metadata-only A-level Physics tier without inventing a PDF claim", async () => {
    const raw = await physics(),
      before = canonical(raw);
    const e = applyCatalogueTier(raw);
    expect(e.facts.tier).toBe("not_tiered");
    expect(e.identity.tier).toBe("not_tiered");
    expect(e.catalogueFacts).toEqual([
      {
        version: 1,
        field: "tier",
        source: "assessment_catalogue",
        courseId: "aqa_alevel_physics_7408",
        value: "not_tiered",
      },
    ]);
    expect(e.claims.some((c) => c.field === "tier")).toBe(false);
    expect(validateEvidence(e)).toEqual(e);
    expect(canonical(raw)).toBe(before);
  });
  it("resolves Chemistry metadata and existing A-level Biology catalogue entries", () => {
    expect(
      resolveCatalogueTier({
        ...identity,
        subject: "Chemistry",
        course: "7405",
        component: "7405/1",
      })?.courseId,
    ).toBe("aqa_alevel_chemistry_7405");
    expect(
      resolveCatalogueTier({
        ...identity,
        subject: "Biology",
        course: "7402",
        component: "7402/1",
      })?.courseId,
    ).toBe("aqa_alevel_biology_7402");
  });
  it.each([
    { country: "US" },
    { organisation: "OCR" },
    { qualification: "GCSE" },
    { subject: "History" },
    { course: "7407" },
    { course: "A-level Physics" },
  ])(
    "does not derive tier from a loose or different identity %j",
    (changes) => {
      expect(resolveCatalogueTier({ ...identity, ...changes })).toBeNull();
    },
  );
  it("fills a null identity tier only from the exact catalogue", async () => {
    const e = await physics();
    e.identity.tier = null;
    expect(validateEvidence(applyCatalogueTier(e)).identity.tier).toBe(
      "not_tiered",
    );
  });
  it.each(["identity", "facts"] as const)(
    "rejects an explicit Higher contradiction in %s",
    async (field) => {
      const e = await physics();
      e[field].tier = "higher";
      expect(() => applyCatalogueTier(e)).toThrow(/untiered/);
    },
  );
  it("removes a model tier claim when catalogue provenance supplies the fact", async () => {
    const e = await physics();
    e.facts.tier = "not_tiered";
    e.claims.push({
      field: "tier",
      documentId: e.documents[0].id,
      locationId: "assessment",
      quote: "7408/1",
      rule: "mandatory",
    });
    expect(() => validateEvidence(e)).toThrow(/tiers/);
    const fixed = applyCatalogueTier(e);
    expect(validateEvidence(fixed).claims.some((c) => c.field === "tier")).toBe(
      false,
    );
  });
  it("independently rejects forged provenance for another course or value", async () => {
    const valid = applyCatalogueTier(await physics());
    const wrong = structuredClone(valid);
    wrong.catalogueFacts![0].courseId = "aqa_alevel_chemistry_7405";
    expect(() => validateEvidence(wrong)).toThrow(/provenance/);
    const unknown = structuredClone(valid);
    unknown.identity.course = "invented";
    expect(() => validateEvidence(unknown)).toThrow(/provenance/);
    const contradicted = structuredClone(valid);
    contradicted.facts.tier = "higher";
    expect(() => validateEvidence(contradicted)).toThrow(/provenance/);
  });
  it("does not let model JSON nominate catalogue authority", async () => {
    const withProof = applyCatalogueTier(await physics());
    expect(modelEvidenceSchema.safeParse(withProof).success).toBe(false);
    const { catalogueFacts: _discarded, ...raw } = withProof;
    expect(modelEvidenceSchema.safeParse(raw).success).toBe(true);
  });
  it("keeps unknown-course tier facts dependent on literal source evidence", async () => {
    const e = await ownerEvidence();
    const withNoTier = {
      ...e,
      claims: e.claims.filter((claim) => claim.field !== "tier"),
    };
    expect(applyCatalogueTier(withNoTier)).not.toHaveProperty("catalogueFacts");
    expect(() => validateEvidence(withNoTier)).toThrow(
      /mandatory reference: tier/,
    );
    expect(validateEvidence(applyCatalogueTier(e))).toEqual(e);
  });
  it("does not add fields or change canonical fingerprints on existing reviewed evidence", () => {
    for (const source of SOURCE_REGISTRY) {
      expect(canonical(validateEvidence(source.evidence))).toBe(
        canonical(source.evidence),
      );
      expect(validateEvidence(source.evidence)).not.toHaveProperty(
        "catalogueFacts",
      );
    }
  });
});

describe("source claims retain their literal and authority boundaries", () => {
  it.each(["specification", "institution_brief"] as const)(
    "accepts an observed direct topic fact from an active %s",
    async (kind) => {
      const e = applyCatalogueTier(await physics());
      e.documents[0].kind = kind;
      e.claims.find((claim) => claim.field === "topics")!.rule = "observed";
      const before = canonical(e);
      expect(validateEvidence(e)).toEqual(e);
      expect(canonical(e)).toBe(before);
    },
  );
  it.each(["past_paper", "sample", "guidance"] as const)(
    "keeps observed patterns in %s distinct from requirements",
    async (kind) => {
      const e = applyCatalogueTier(await physics());
      e.documents[0].kind = kind;
      e.claims.find((claim) => claim.field === "topics")!.rule = "observed";
      expect(() => validateEvidence(e)).toThrow(/mandatory reference: topics/);
    },
  );
  it("does not use an observed fact from a superseded specification", async () => {
    const e = applyCatalogueTier(await physics());
    e.documents[0].state = "superseded";
    e.claims.forEach((claim) => {
      claim.rule = "observed";
    });
    expect(() => validateEvidence(e)).toThrow(/mandatory reference/);
  });
  it("still rejects a topic that is absent from an observed quote's source location", async () => {
    const e = applyCatalogueTier(await physics());
    e.facts.topics = ["Cosmology"];
    e.claims.find((claim) => claim.field === "topics")!.rule = "observed";
    expect(() => validateEvidence(e)).toThrow(/topic is not supported/);
  });
  it("does not let an observed quote borrow an unquoted value from the location", async () => {
    const e = applyCatalogueTier(await physics());
    const claim = e.claims.find((claim) => claim.field === "topics")!;
    claim.rule = "observed";
    claim.quote = "85 marks";
    expect(() => validateEvidence(e)).toThrow(/topic is not supported/);
  });
  it.each([
    "Answer all questions in Section A. Choose either Question 6 or Question 7 in Section B.",
    "Answer all questions in Section A. Answer one of the following sections.",
    "Answer all questions in Section A and either Section B or Section C.",
    "Answer all questions in Section A and one question from Section B.",
  ])(
    "does not cherry-pick compulsory wording over an explicit exam choice: %s",
    async (text) => {
      const e = applyCatalogueTier(await physics());
      e.documents[0].locations.push({
        id: "choice",
        page: 1,
        section: "Instructions",
        text,
      });
      const claim = e.claims.find((claim) => claim.field === "selection")!;
      claim.locationId = "choice";
      claim.quote = "Answer all questions in Section A";
      claim.rule = "observed";
      expect(() => validateEvidence(e)).toThrow(/Selection rule/);
    },
  );
  it("keeps MCQ answer selection separate from optional exam questions", async () => {
    const e = applyCatalogueTier(await physics());
    e.documents[0].locations[0].text +=
      " Choose one answer for each multiple-choice question.";
    expect(validateEvidence(e).facts.selection).toBe("all_compulsory");
  });
  it("accepts actual official short and long answer format wording", async () => {
    const e = applyCatalogueTier(await physics());
    expect(validateEvidence(e).facts.formats).toEqual([
      "short_answer",
      "long_form",
    ]);
  });
  it("normalises a line break without accepting the unsupported end of a requirement", async () => {
    const e = applyCatalogueTier(await physics());
    e.documents[0].locations[0].text += " Maths at Level 2\nor above.";
    e.facts.mathsRequirement = "Maths at Level 2 or above.";
    e.claims.push({
      field: "mathsRequirement",
      documentId: e.documents[0].id,
      locationId: "assessment",
      quote: "Maths at Level 2 or above.",
      rule: "mandatory",
    });
    expect(validateEvidence(e).facts.mathsRequirement).toBe(
      e.facts.mathsRequirement,
    );
    e.facts.mathsRequirement =
      "Maths at Level 2 or above, equivalent to grade A.";
    expect(() => validateEvidence(e)).toThrow(/Requirement is not supported/);
  });
  it("does not accept a quote extending beyond the actual source", async () => {
    const e = applyCatalogueTier(await physics());
    e.claims.find((claim) => claim.field === "formats")!.quote =
      "Short and long answer questions with guaranteed optional questions.";
    expect(() => validateEvidence(e)).toThrow(/does not resolve/);
  });
  it("does not infer compulsory selection from the absence of choices", async () => {
    const e = applyCatalogueTier(await physics());
    e.claims = e.claims.filter((claim) => claim.field !== "selection");
    expect(() => validateEvidence(e)).toThrow(/mandatory reference: selection/);
  });
});

describe("duration conversion keeps assessment values separate", () => {
  it.each([
    { written: "2 hours", minutes: 120 },
    { written: "1 hour 45 minutes", minutes: 105 },
    { written: "1 hour and 45 min", minutes: 105 },
  ])(
    "reads $written without borrowing the following 85 marks",
    async ({ written, minutes }) => {
      const e = applyCatalogueTier(await physics());
      e.documents[0].locations[0].text =
        e.documents[0].locations[0].text.replace(
          "85 marks; 2 hours.",
          `Written exam: ${written}\n85 marks.`,
        );
      e.claims.find((claim) => claim.field === "durationMinutes")!.quote =
        written;
      e.facts.durationMinutes = minutes;
      expect(validateEvidence(e).facts.durationMinutes).toBe(minutes);
    },
  );
  it("rejects a duration that includes the mark total as minutes", async () => {
    const e = applyCatalogueTier(await physics());
    e.documents[0].locations[0].text = e.documents[0].locations[0].text.replace(
      "85 marks; 2 hours.",
      "Written exam: 2 hours\n85 marks.",
    );
    e.facts.durationMinutes = 205;
    expect(() => validateEvidence(e)).toThrow(/Duration contradicts/);
  });
});

describe("calculator permissions are exam instructions", () => {
  it.each([false, true])(
    "does not cherry-pick equipment from a prohibition, even with another positive cover claim: %s",
    async (hasPositiveCover) => {
      const e = applyCatalogueTier(await physics());
      e.documents[0].locations.push({
        id: "no-calculator",
        page: 1,
        section: "Instructions",
        text: "No calculator allowed.",
      });
      const claim = e.claims.find((claim) => claim.field === "calculator")!;
      claim.locationId = "no-calculator";
      claim.quote = "calculator";
      if (hasPositiveCover) {
        e.claims.push({
          field: "calculator",
          documentId: e.documents[0].id,
          locationId: "assessment",
          quote: "A calculator is required",
          rule: "mandatory",
        });
      }
      expect(() => validateEvidence(e)).toThrow(/Calculator rule/);
    },
  );
  it("keeps the prohibition itself dependent on an explicit quote", async () => {
    const e = applyCatalogueTier(await physics());
    e.facts.calculator = "not_allowed";
    e.documents[0].locations.push({
      id: "no-calculator",
      page: 1,
      section: "Instructions",
      text: "No calculator allowed.",
    });
    const claim = e.claims.find((claim) => claim.field === "calculator")!;
    claim.locationId = "no-calculator";
    claim.quote = "calculator";
    expect(() => validateEvidence(e)).toThrow(/Calculator rule/);
    claim.quote = "No calculator allowed.";
    expect(validateEvidence(e).facts.calculator).toBe("not_allowed");
  });
  it.each([
    { quote: "A calculator is required.", value: "allowed" },
    { quote: "No calculator.", value: "not_allowed" },
  ] as const)(
    "keeps an explicit Mathematics paper cover rule valid: $value",
    async ({ quote, value }) => {
      const e = applyCatalogueTier(await physics());
      e.facts.calculator = value;
      e.documents[0].locations.push({
        id: "mathematics-cover",
        page: 1,
        section: "GCSE Mathematics Paper 1 cover instructions",
        text: quote,
      });
      const claim = e.claims.find((claim) => claim.field === "calculator")!;
      claim.locationId = "mathematics-cover";
      claim.quote = quote;
      expect(validateEvidence(e).facts.calculator).toBe(value);
    },
  );
  it.each([
    "You are expected to use a scientific calculator where appropriate.",
    "You are expected to use a scientific\ncalculator where appropriate.",
  ])(
    "accepts the actual reviewed Paper 1 cover instruction: %s",
    async (quote) => {
      const e = applyCatalogueTier(await physics());
      e.documents[0].locations.push({
        id: "cover-calculator",
        page: 1,
        section: "Information",
        text: quote,
      });
      const claim = e.claims.find((claim) => claim.field === "calculator")!;
      claim.locationId = "cover-calculator";
      claim.quote = quote;
      expect(validateEvidence(e).facts.calculator).toBe("allowed");
    },
  );
  it("does not turn an expected calculation skill into a cover permission", async () => {
    const e = applyCatalogueTier(await physics());
    const quote =
      "You are expected to use a scientific calculator to process numerical data.";
    e.documents[0].locations.push({
      id: "calculator-skill",
      page: 80,
      section: "Information",
      text: quote,
    });
    const claim = e.claims.find((claim) => claim.field === "calculator")!;
    claim.locationId = "calculator-skill";
    claim.quote = quote;
    expect(() => validateEvidence(e)).toThrow(/Calculator rule/);
  });
  it("keeps actual permission and prohibition claims valid", async () => {
    expect(
      validateEvidence(applyCatalogueTier(await physics())).facts.calculator,
    ).toBe("allowed");
    expect(validateEvidence(await ownerEvidence()).facts.calculator).toBe(
      "not_allowed",
    );
  });
  it.each([
    "Use a calculator to process numerical data.",
    "Mathematical skills include using calculators and standard form.",
    "A calculator can estimate the gradient.",
  ])(
    "rejects a mathematical-skill claim as calculator permission: %s",
    async (quote) => {
      const e = applyCatalogueTier(await physics());
      e.documents[0].locations.push({
        id: "maths",
        page: 80,
        section: "Mathematical skills",
        text: quote,
      });
      const claim = e.claims.find((claim) => claim.field === "calculator")!;
      claim.locationId = "maths";
      claim.quote = quote;
      expect(() => validateEvidence(e)).toThrow(/Calculator rule/);
    },
  );
  it("does not borrow an unquoted permission from another part of a location", async () => {
    const e = applyCatalogueTier(await physics());
    e.documents[0].locations[0].text += " Calculator skills are assessed.";
    e.claims.find((claim) => claim.field === "calculator")!.quote =
      "Calculator skills are assessed.";
    expect(() => validateEvidence(e)).toThrow(/Calculator rule/);
  });
  it("does not turn a calculator-free maths exercise into an exam prohibition", async () => {
    const e = applyCatalogueTier(await physics());
    e.facts.calculator = "not_allowed";
    e.documents[0].locations.push({
      id: "maths",
      page: 80,
      section: "Mathematical skills",
      text: "Without a calculator estimate the gradient.",
    });
    const claim = e.claims.find((claim) => claim.field === "calculator")!;
    claim.locationId = "maths";
    claim.quote = "Without a calculator estimate the gradient.";
    expect(() => validateEvidence(e)).toThrow(/Calculator rule/);
  });
  it("does not trust a model-labelled Instructions section as an equipment list", async () => {
    const e = applyCatalogueTier(await physics());
    e.documents[0].locations.push({
      id: "mislabelled-maths",
      page: 80,
      section: "Instructions",
      text: "Use calculators to calculate logarithms.",
    });
    const claim = e.claims.find((claim) => claim.field === "calculator")!;
    claim.locationId = "mislabelled-maths";
    claim.quote = "calculator";
    expect(() => validateEvidence(e)).toThrow(/Calculator rule/);
  });
  it("requires the equipment heading in uploaded text, not just model metadata", async () => {
    const e = applyCatalogueTier(await physics());
    e.documents[0].locations.push({
      id: "unverified-materials-heading",
      page: 1,
      section: "Materials",
      text: "a scientific calculator",
    });
    const claim = e.claims.find((claim) => claim.field === "calculator")!;
    claim.locationId = "unverified-materials-heading";
    claim.quote = "a scientific calculator";
    expect(() => validateEvidence(e)).toThrow(/Calculator rule/);
  });
  it.each([
    "Materials\na scientific calculator",
    "Equipment required: a scientific calculator",
  ])(
    "accepts a scientific calculator in a literal equipment list: %s",
    async (text) => {
      const e = applyCatalogueTier(await physics());
      e.documents[0].locations.push({
        id: "materials",
        page: 1,
        section: "Materials and instructions",
        text,
      });
      const claim = e.claims.find((claim) => claim.field === "calculator")!;
      claim.locationId = "materials";
      claim.quote = "a scientific calculator";
      expect(validateEvidence(e).facts.calculator).toBe("allowed");
    },
  );
});
