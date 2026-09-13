import { describe, expect, it } from "vitest";
import { hasAssessedTask } from "../functions/_shared/question-contract-validator.ts";

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

  it("accepts a command after an inline data table on one line", () => {
    expect(
      hasAssessedTask(
        "ATP (mmol/dm³) | Rate 0 | 0 2 | 10 " +
          "Describe the relationship between ATP concentration and the rate of glucose uptake.",
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
