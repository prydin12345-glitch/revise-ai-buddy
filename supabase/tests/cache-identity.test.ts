// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  buildBaseCacheKey,
  buildCacheKey,
  isCacheEntryCompatible,
} from "../functions/_shared/cache-utils";

const base = {
  subject: "Biology",
  examBoard: "AQA",
  educationalLevel: "level2",
  assessmentTier: null as string | null,
  topics: ["Cells", "Enzymes"],
  difficulty: "medium",
  questionFormat: "written_only",
  questionCount: 20,
};

const key = async (over: Partial<typeof base> & { variationSlot?: number }) =>
  await buildCacheKey({ ...base, ...over });

describe("cache identity v2", () => {
  it("is stable and namespaced", async () => {
    const a = await key({});
    expect(a).toBe(await key({ topics: ["Enzymes", "Cells"] })); // order-insensitive
    expect(a!.startsWith("v2_")).toBe(true);
    expect(a!.length).toBe(64);
  });

  it("separates every field that used to collide", async () => {
    const keys = await Promise.all([
      key({}),
      key({ difficulty: "hard" }),
      key({ questionFormat: "mcq_only" }),
      key({ questionCount: 21 }),
      key({ variationSlot: 1 }),
      key({ topics: ["Cells"] }),
      key({ examBoard: "OCR" }),
      key({ educationalLevel: "level3_a_level" }),
    ]);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("separates assessment tiers", async () => {
    const unknown = await key({});
    const foundation = await key({ assessmentTier: "foundation" });
    const higher = await key({ assessmentTier: "higher" });
    expect(new Set([unknown, foundation, higher]).size).toBe(3);
  });

  it("reserves room for course, paper, preset and resource versions", async () => {
    const plain = await key({});
    const withCourse = await buildCacheKey({ ...base, courseId: "aqa_gcse_biology" });
    const withPaper = await buildCacheKey({ ...base, paperId: "paper1" });
    const withPreset = await buildCacheKey({ ...base, presetVersion: 2 });
    const withResource = await buildCacheKey({ ...base, resourceVersion: "r3" });
    expect(new Set([plain, withCourse, withPaper, withPreset, withResource]).size).toBe(5);
  });

  it("refuses to cache custom niche subjects or incomplete context", async () => {
    expect(await buildCacheKey({ ...base, isCustomNiche: true })).toBeNull();
    expect(await buildCacheKey({ ...base, examBoard: "" })).toBeNull();
    expect(await buildCacheKey({ ...base, educationalLevel: "" })).toBeNull();
  });

  it("keeps the slot-tracking key distinct from any slot key", async () => {
    const baseKey = await buildBaseCacheKey(base);
    const slots = await Promise.all([0, 1, 2, 3, 4].map((v) => key({ variationSlot: v })));
    expect(slots).not.toContain(baseKey);
    expect(new Set(slots).size).toBe(5);
  });

  it("rejects an incompatible or empty cached row", () => {
    expect(isCacheEntryCompatible({ questions: [{ id: 1 }], exam_board: "AQA", educational_level: "level2", subject: "Biology" }, base)).toBe(true);
    expect(isCacheEntryCompatible({ questions: [], exam_board: "AQA" }, base)).toBe(false);
    expect(isCacheEntryCompatible({ questions: [{ id: 1 }], exam_board: "OCR" }, base)).toBe(false);
    expect(isCacheEntryCompatible(null, base)).toBe(false);
  });
});
