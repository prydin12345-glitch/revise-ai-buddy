// @vitest-environment node
import { expect, it } from "vitest";
import { extract, boundaryHandler } from "./aqa-alevel-runtime";
import { ocrPaper3Fixture } from "./ocr-alevel-paper3-fixtures";
import { selectVisualAssessment } from "../functions/_shared/biology-visual-assessment";
import {
  simulatedApprovedAssets,
  simulatedApprovedFiles,
} from "./biology-visual-fixtures";
const scenario = (mode: "full_mock" | "short_practice") => {
  const f = ocrPaper3Fixture(mode);
  return {
    ...f,
    snapshot: {
      ...f.snapshot,
      response_formats: "interactive_v1",
      visual_assets: selectVisualAssessment(
        mode,
        simulatedApprovedAssets(),
        simulatedApprovedFiles(),
      ),
    },
  };
};
it.each(["full_mock", "short_practice"] as const)(
  "actual %s extraction seeds reviewed visuals, batches remaining parts and commits keys atomically",
  async (mode) => {
    const f = scenario(mode),
      r = await extract({ visualFixtures: true }, mode, "paper_3", f);
    expect(String(r.error ?? "")).toBe("");
    expect(r.exam.extraction_status).toBe("completed");
    expect(r.drafts.reduce((s, q) => s + q.marks, 0)).toBe(f.plan.totalMarks);
    expect(
      r.responseDrafts,
      JSON.stringify(
        r.drafts.map((q) => ({
          n: q.question_number,
          kind: q.diagram_config?.kind,
          carrier: q.correct_answer?.includes("examly_response_v1"),
        })),
      ),
    ).toHaveLength(mode === "full_mock" ? 3 : 2);
    expect(r.aiCalls.length).toBeLessThanOrEqual(26);
    for (const call of r.generationCalls) {
      const p = call.messages.map((m: any) => m.content).join("\n");
      expect(p).toContain("IMMUTABLE VISUAL SIBLINGS");
      expect(p.split("IMMUTABLE VISUAL SIBLINGS")[1]).not.toMatch(
        /xylem|phloem|epithelial tissue|muscle tissue|connective tissue/,
      );
    }
    const h = await boundaryHandler(
      "publish-exam",
      r.drafts,
      mode,
      "paper_3",
      f.snapshot,
      r.responseDrafts,
      true,
    );
    const response = await h.run({ draftId: "exam" });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      examId: "exam",
      questionsPublished: f.plan.partCount,
    });
    const atomic = h.writes.find(
      (w) => w.table === "commit_generated_responses",
    );
    expect(atomic).toBeTruthy();
    expect(atomic!.value.p_rows).toHaveLength(f.plan.partCount);
    const visuals = atomic!.value.p_rows.filter(
      (p: any) => p.response?.definition.revision === "visual_v1",
    );
    expect(visuals).toHaveLength(mode === "full_mock" ? 3 : 2);
    for (const v of visuals) {
      expect(v.question.correct_answer).toBeNull();
      expect(
        v.question.diagram_config.resources[0].panels[0].asset.checksum,
      ).toHaveLength(64);
      expect(JSON.stringify(v.question)).not.toMatch(
        /xylem|phloem|accepted|guidance/,
      );
    }
  },
);
it("unapproved assets block before even one model request", async () => {
  const f = scenario("short_practice"),
    r = await extract(false, "short_practice", "paper_3", f);
  expect(r.error).toBeTruthy();
  expect(r.aiCalls).toHaveLength(0);
  expect(r.exam.extraction_status).not.toBe("completed");
});
it("truncation preserves asset IDs, immutable versions and all scored totals", async () => {
  const f = scenario("short_practice"),
    r = await extract(
      { visualFixtures: true, truncateFirstBatch: true },
      "short_practice",
      "paper_3",
      f,
    );
  expect(String(r.error ?? "")).toBe("");
  expect(r.responseDrafts).toHaveLength(2);
  expect(r.drafts.reduce((s, q) => s + q.marks, 0)).toBe(20);
  expect(r.aiCalls.length).toBeLessThanOrEqual(26);
});
it("changed visual sources cannot pass the final publication boundary", async () => {
  const f = scenario("short_practice"),
    r = await extract({ visualFixtures: true }, "short_practice", "paper_3", f);
  const changed = structuredClone(r.drafts);
  changed.find(
    (q) => q.diagram_config?.kind === "biology_visual",
  ).diagram_config.panels[0].asset.version = 99;
  const h = await boundaryHandler(
    "publish-exam",
    changed,
    "short_practice",
    "paper_3",
    f.snapshot,
    r.responseDrafts,
    true,
  );
  expect((await h.run({ draftId: "exam" })).status).toBeGreaterThanOrEqual(400);
  expect(h.writes.some((w) => w.table === "commit_generated_responses")).toBe(
    false,
  );
});
