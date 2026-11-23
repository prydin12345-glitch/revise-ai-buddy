import { expect, it } from "vitest";
import { examProfileCalculatorPolicy } from "@/lib/exam-profile-display";

it.each(["allowed", "not_allowed", "unknown"])("uses the saved AI calculator rule %s even on older scalar settings", calculator => {
  const profile = { calculator_policy: "allowed", profile_template: { template: { calculator } } };
  const original = structuredClone(profile);
  expect(examProfileCalculatorPolicy(profile)).toBe(calculator);
  expect(profile).toEqual(original);
});
it.each(["allowed", "not_allowed", "mixed"])("retains an explicit legacy calculator preference %s", calculator_policy => {
  expect(examProfileCalculatorPolicy({ calculator_policy })).toBe(calculator_policy);
});
it("does not invent a calculator rule when none was saved", () => {
  expect(examProfileCalculatorPolicy({ calculator_policy: null })).toBe("unknown");
});
