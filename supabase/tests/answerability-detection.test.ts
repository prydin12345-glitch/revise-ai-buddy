import { describe, expect, it } from "vitest";
import {
  hasAssessedTask,
  normalizeRepairPart,
} from "../functions/_shared/question-contract-validator.ts";

describe("hasAssessedTask — real generated stems", () => {
  it("accepts a command that follows a bracketed aside", () => {
    expect(
      hasAssessedTask(
        "An experiment investigated the effect of temperature on a digestive enzyme. " +
          "(Assume a graph is present showing an optimum at 40°C and a sharp decrease afterwards.) " +
          "Explain the effect of temperature on the enzyme's activity as shown in the graph.",
      ),
    ).toBe(true);
  });

  it("accepts a command that follows a markdown table", () => {
    expect(
      hasAssessedTask(
        "The results are shown below:\n\n| Condition | Rate (g/hr) |\n|---|---|\n| 20°C | 5.2 |\n\n" +
          "Analyse the provided data to describe how temperature affects transpiration.",
      ),
    ).toBe(true);
  });

  it("still rejects context-only stems", () => {
    expect(
      hasAssessedTask(
        "A new antibiotic was tested against three bacterial strains. The table shows the diameter " +
          "of the zone of inhibition produced by the antibiotic on agar plates.",
      ),
    ).toBe(false);
    expect(
      hasAssessedTask(
        "They measured the diameter of the zone of inhibition after 24 hours of incubation.",
      ),
    ).toBe(false);
  });
});

describe("normalizeRepairPart", () => {
  it("accepts Gemini's expected_answer alias without losing the repaired task", () => {
    expect(normalizeRepairPart({
      question_number: "4(d)",
      context: "The graph gives oxygen production at six light intensities.",
      task: "Describe the effect of increasing light intensity on oxygen production.",
      expected_answer: "The rate rises and then levels off.",
    })).toEqual({
      questionNumber: "4(d)",
      questionText: "The graph gives oxygen production at six light intensities.\n\nDescribe the effect of increasing light intensity on oxygen production.",
      correctAnswer: "The rate rises and then levels off.",
      options: undefined,
    });
  });

  it("rejects a repair that still has no assessed task", () => {
    expect(normalizeRepairPart({
      question_number: "4(d)",
      context: "The graph shows the results.",
      expected_answer: "The rate rises.",
    })).toBeNull();
  });
});
