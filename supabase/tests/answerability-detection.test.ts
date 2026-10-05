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

import { hasAssessedTask as conditionalTask } from '../functions/_shared/question-contract-validator';
import { it as cit, expect as cexpect } from 'vitest';
cit('accepts a conditional calculation stem with givens before the command', () => {
  cexpect(conditionalTask("If 20 eyepiece units measured 150 micrometres (µm) with a ×10 objective lens, and the cell's diameter was 8 eyepiece units, calculate the actual diameter of the cell.")).toBe(true);
  cexpect(conditionalTask('Given that the mean was 12, the median was 10, and the range was 4, explain what this shows.')).toBe(true);
  cexpect(conditionalTask("If 20 eyepiece units measured 150 micrometres, the cell's diameter was 8 eyepiece units.")).toBe(false);
});
