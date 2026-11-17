import { describe, expect, it } from "vitest";
import {
  builderInitialIdentity,
  builderCourses,
  builderPapers,
  builderSelectedCourse,
  resolveBuilderChoice,
} from "@/lib/profile-builder-resolution";
import { SOURCE_REGISTRY } from "../../supabase/functions/_shared/profile-source-registry";

describe("student-facing reviewed assessment resolution", () => {
  it("does not use a saved school exam board as a university institution", () => {
    expect(
      builderInitialIdentity({
        subject: "Biology",
        board: "AQA",
        level: "undergrad",
        region: "GB",
      }),
    ).toMatchObject({ stage: "University", organisation: "", course: "" });
  });
  for (const subject of ["Physics", "Chemistry"]) {
    for (const component of ["paper_1", "paper_2"]) {
      for (const tier of ["foundation", "higher"] as const) {
        it(`resolves ${subject} ${component} ${tier} without student-entered codes`, () => {
          const initial = builderInitialIdentity({
            subject,
            board: "AQA",
            level: "level2",
            region: "GB",
          });
          expect(builderCourses(initial)).toHaveLength(1);
          expect(builderPapers(initial).map((paper) => paper.id)).toEqual([
            "paper_1",
            "paper_2",
          ]);
          const resolved = resolveBuilderChoice(
            { ...initial, component, tier },
            "short_practice",
          );
          expect(resolved.presetId).toBe("");
          const source = SOURCE_REGISTRY.find(
            (entry) => entry.id === resolved.sourceId,
          )!;
          expect(source).toBeDefined();
          expect(resolved.identity).toEqual(source.evidence.identity);
          expect(resolved.identity.course).toBe(
            subject === "Physics" ? "8463" : "8462",
          );
          expect(resolved.identity.component).toMatch(
            new RegExp(
              `/${component.endsWith("1") ? 1 : 2}${tier === "higher" ? "H" : "F"}$`,
            ),
          );
          expect(source.evidence.facts).toMatchObject({
            marks: 100,
            durationMinutes: 105,
            tier,
          });
        });
      }
    }
  }
  it("requires an explicit tier and retains Combined Science as a distinct unresolved course", () => {
    const initial = builderInitialIdentity({
      subject: "Physics",
      board: "AQA",
      level: "level2",
      region: "GB",
    });
    expect(() =>
      resolveBuilderChoice({ ...initial, component: "paper_1" }, "full_mock"),
    ).toThrow(/Foundation or Higher/);
    expect(
      builderCourses({ ...initial, subject: "Combined Science: Physics" }),
    ).toEqual([]);
  });
  it("does not silently replace saved versions or route international context into an English source", () => {
    const initial = builderInitialIdentity({
      subject: "Chemistry",
      board: "AQA",
      level: "level2",
      region: "GB",
    });
    const old = resolveBuilderChoice(
      {
        ...initial,
        component: "paper_1",
        tier: "higher",
        specificationVersion: "v1.1-2019-10-04",
      },
      "short_practice",
    );
    expect(old.sourceId).toBe("");
    expect(old.identity.specificationVersion).toBe("v1.1-2019-10-04");
    const international = resolveBuilderChoice(
      {
        ...initial,
        country: "US",
        educationSystem: "US",
        course: "8462",
        component: "8462/1H",
        tier: "higher",
      },
      "short_practice",
    );
    expect(international.sourceId).toBe("");
    expect(international.identity.country).toBe("US");
  });
});

it("preserves unknown A-level tiers and uses explicit catalogue tier facts only", () => {
  const unknown = builderInitialIdentity({ subject: "Business", board: "Edexcel", level: "level3", region: "GB" });
  expect(unknown).toMatchObject({ tier: null, course: "" });
  expect(resolveBuilderChoice({ ...unknown, component: "Paper 1" }, "short_practice").identity).toMatchObject({
    tier: null, course: "A-level Business", specificationVersion: "Not verified",
  });
  const explicit = builderInitialIdentity({ subject: "Business", board: "Edexcel", level: "level3", region: "GB", tier: "higher" });
  expect(explicit.tier).toBe("higher");
  const known = builderInitialIdentity({ subject: "Physics", board: "AQA", level: "level3", region: "GB" });
  expect(known).toMatchObject({ course: "7408", tier: "not_tiered" });
});

it("resolves saved course codes with typography and leaves unknown explicit courses unresolved", () => {
  const initial = builderInitialIdentity({ subject: "Biology", board: "Pearson Edexcel", level: "level3", region: "GB", courseId: " 9bI0 " });
  expect(initial.course).toBe("9BI0");
  expect(builderSelectedCourse({ ...initial, course: " 9bi0 " })?.id).toBe("pearson_edexcel_alevel_biology_b_9bi0");
  const physics = builderInitialIdentity({ subject: "Physics", board: "AQA", level: "level3", region: "GB" });
  expect(builderSelectedCourse({ ...physics, course: "A-level Physics" })?.specificationCode).toBe("7408");
  expect(builderSelectedCourse({ ...physics, course: "Another course" })).toBeNull();
});
