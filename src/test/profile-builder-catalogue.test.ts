import { describe, expect, it } from "vitest";
import {
  builderInitialIdentity,
  builderCourses,
  builderPapers,
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
