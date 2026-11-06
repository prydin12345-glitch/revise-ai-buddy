import { describe, expect, it } from "vitest";
import {
  builderInitialIdentity,
  builderCourses,
  builderPapers,
  builderFindAssessment,
  builderAssessmentKind,
  builderAssessmentDisplay,
  builderAssessmentLabel,
  builderValidateComponentCode,
  builderBoardLabel,
  resolveBuilderChoice,
} from "@/lib/profile-builder-resolution";
import { ASSESSMENT_METADATA_COURSES } from "../../supabase/functions/_shared/profile-assessment-options";
import { approvalCatalogue } from "../../supabase/functions/_shared/preset-approval";

const physics = () =>
  builderInitialIdentity({
    subject: "Physics",
    level: "level3",
    board: "aqa",
    region: "GB",
  });

describe("assessment names and technical identities", () => {
  it("offers all AQA A-level Physics assessments without guessing a GCSE course", () => {
    const identity = physics();
    expect(identity.organisation).toBe("AQA");
    expect(builderCourses(identity).map((course) => course.id)).toEqual([
      "aqa_alevel_physics_7408",
    ]);
    expect(
      builderPapers(identity).map((paper) => [
        paper.id,
        paper.label,
        paper.componentCode,
        paper.kind,
      ]),
    ).toEqual([
      ["paper_1", "Paper 1", "7408/1", "Paper"],
      ["paper_2", "Paper 2", "7408/2", "Paper"],
      ["paper_3", "Paper 3", "7408/3", "Paper"],
    ]);
    const resolved = resolveBuilderChoice(
      { ...identity, component: "paper_1" },
      "short_practice",
    );
    expect(resolved.identity).toMatchObject({
      course: "7408",
      component: "7408/1",
      qualification: "A-level",
      tier: "not_tiered",
      specificationVersion: "v1.4-july-2026",
    });
    expect(resolved.sourceId).toBe("");
    expect(resolved.presetId).toBe("");
    expect(
      approvalCatalogue().some(
        (entry) => entry.course === "aqa_alevel_physics_7408",
      ),
    ).toBe(false);
  });
  it("preserves teaching-date context for source verification while resolving the known assessment", () => {
    const version = "First teaching 2015, first exams 2017";
    const resolved = resolveBuilderChoice(
      { ...physics(), component: "Paper 1", specificationVersion: version },
      "short_practice",
    );
    expect(resolved.identity).toMatchObject({
      qualification: "A-level",
      organisation: "AQA",
      course: "7408",
      component: "7408/1",
      specificationVersion: version,
    });
    expect(resolved.presetId).toBe("");
    expect(resolved.sourceId).toBe("");
  });
  it.each([
    "Paper 1",
    "paper 1",
    "PAPER 1",
    "(Paper 1)",
    " ( Paper1 ) ",
    "paper_1",
    "7408/1",
  ])("resolves an explicit known alias %s", (value) => {
    expect(builderFindAssessment(physics(), value)?.id).toBe("paper_1");
    expect(
      resolveBuilderChoice({ ...physics(), component: value }, "short_practice")
        .identity.component,
    ).toBe("7408/1");
  });
  it("recognises the builder's legacy generic placeholder without guessing an explicit different course", () => {
    expect(
      builderFindAssessment(
        { ...physics(), course: "A-level Physics" },
        "Paper 1",
      )?.id,
    ).toBe("paper_1");
    expect(builderPapers({ ...physics(), course: "7407" })).toEqual([]);
  });
  it("rejects misspellings, wrong qualification codes and invented papers rather than guessing", () => {
    for (const value of [
      "Papper 1",
      "Paper 11",
      "8463/1H",
      "7407/1",
      "Paper 0",
    ]) {
      expect(builderFindAssessment(physics(), value)).toBeNull();
      expect(() =>
        resolveBuilderChoice(
          { ...physics(), component: value },
          "short_practice",
        ),
      ).toThrow(/Which paper or assessment/);
    }
  });
  it("keeps human selection unchanged while validating Advanced code overrides", () => {
    const identity = { ...physics(), component: "paper_1" };
    const before = JSON.stringify(identity);
    expect(
      builderValidateComponentCode(identity, "paper_1", " 7408 / 1 "),
    ).toBeNull();
    expect(builderValidateComponentCode(identity, "paper_1", "7408/2")).toMatch(
      /does not match Paper 1/,
    );
    expect(
      builderValidateComponentCode(identity, "paper_1", "8463/1H"),
    ).toMatch(/does not match Paper 1/);
    expect(JSON.stringify(identity)).toBe(before);
    expect(builderAssessmentDisplay(identity)).toBe("Paper 1");
  });
  it("requires exactly one explicit Physics Paper 3 option and preserves it in existing identity storage", () => {
    const identity = { ...physics(), component: "paper_3" };
    const option = builderPapers(identity)[2];
    expect(option.requiredOptions?.map((item) => item.label)).toEqual([
      "Astrophysics",
      "Medical physics",
      "Engineering physics",
      "Turning points in physics",
      "Electronics",
    ]);
    expect(() => resolveBuilderChoice(identity, "short_practice")).toThrow(
      /Choose the optional topic/,
    );
    expect(() =>
      resolveBuilderChoice(
        { ...identity, module: "Unknown option" },
        "short_practice",
      ),
    ).toThrow(/Choose the optional topic/);
    for (const module of ["astrophysics", "Astrophysics"]) {
      const resolved = resolveBuilderChoice(
        { ...identity, module },
        "short_practice",
      );
      expect(resolved.identity).toMatchObject({
        component: "7408/3",
        module: "Astrophysics",
      });
      expect(builderAssessmentLabel(resolved.identity)).toContain(
        "Paper 3 · Astrophysics",
      );
    }
  });
  it("displays concise Unit options and named assessments from existing course definitions", () => {
    const wjec = builderInitialIdentity({
      subject: "Biology",
      level: "level2",
      board: "wjec",
      region: "GB",
      courseId: "wjec_gcse_biology_wales_3400",
    });
    const options = builderPapers(wjec);
    expect(options.length).toBeGreaterThan(0);
    expect(
      options.every(
        (option) =>
          option.kind === "Unit" &&
          option.label.startsWith("Unit ") &&
          !option.label.includes("WJEC GCSE"),
      ),
    ).toBe(true);
    expect(builderAssessmentKind(wjec)).toBe("Unit");
    const ocr = builderInitialIdentity({
      subject: "Biology",
      level: "level3",
      board: "ocr",
      region: "GB",
      courseId: "ocr_alevel_biology_a_h420",
    });
    expect(builderFindAssessment(ocr, "Unified biology")?.id).toBe("paper_3");
    expect(
      builderPapers(ocr).every((paper) => !paper.label.startsWith("OCR")),
    ).toBe(true);
    expect(
      builderAssessmentKind({ ...physics(), subject: "Unknown course" }),
    ).toBe("Assessment");
  });
  it("offers Chemistry's official named papers from the correct A-level qualification", () => {
    const identity = builderInitialIdentity({
      subject: "Chemistry",
      level: "level3",
      board: "AQA",
      region: "GB",
    });
    expect(builderPapers(identity).map((paper) => paper.label)).toEqual([
      "Paper 1 — Inorganic and physical chemistry",
      "Paper 2 — Organic and physical chemistry",
      "Paper 3",
    ]);
    expect(
      resolveBuilderChoice(
        { ...identity, component: "Paper 1" },
        "short_practice",
      ).identity.course,
    ).toBe("7405");
  });
  it("uses only deterministic board aliases and preserves institutions", () => {
    expect(builderBoardLabel("aqa")).toBe("AQA");
    expect(builderBoardLabel("edexcel")).toBe("Pearson Edexcel");
    expect(builderBoardLabel("Example University")).toBe("Example University");
    expect(builderCourses({ ...physics(), country: "US" })).toEqual([]);
    expect(
      ASSESSMENT_METADATA_COURSES.every(
        (course) => course.source.accessedOn === "2026-11-06",
      ),
    ).toBe(true);
  });
});
