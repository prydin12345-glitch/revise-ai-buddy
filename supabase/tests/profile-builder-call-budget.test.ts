import { describe, expect, it } from "vitest";
import { sourceCallBudgetMs } from "../functions/_shared/profile-builder-jobs";

describe("profile builder per-call time budget", () => {
  it("gives the drafting call up to 95 s after a typical ~24 s of reading", () => {
    expect(sourceCallBudgetMs("drafting", 24_000)).toBe(95_000);
  });
  it("caps drafting at what remains of the 120 s total", () => {
    expect(sourceCallBudgetMs("drafting", 60_000)).toBe(60_000);
  });
  it("refuses to start a drafting call with under 30 s left", () => {
    expect(sourceCallBudgetMs("drafting", 95_000)).toBe(0);
  });
  it("keeps reading calls at 45 s", () => {
    expect(sourceCallBudgetMs("reading", 0)).toBe(45_000);
    expect(sourceCallBudgetMs("identifying", 100_000)).toBe(20_000);
  });
});
