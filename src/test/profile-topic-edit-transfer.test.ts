import { expect, it } from "vitest";
import { templateFixture } from "../../supabase/tests/profile-builder-fixtures";
import { addProfileTopic, editProfileTopic, removeProfileTopics, restoreProfileSourceTopics,
  restoreProfileTopicState } from "@/lib/profile-topic-edits";

it("renames and notes preserve every canonical topic, question field and assessment detail", () => {
  const generated = templateFixture();
  generated.warnings = ["Original source warning"];
  const before = structuredClone(generated);
  const renamed = editProfileTopic(generated, "Cells", "Cell structures", "My private reminder");
  expect(renamed).toEqual({ ...before, topicEdits: [{ topic: "Cells", label: "Cell structures", notes: "My private reminder" }] });
  expect(generated).toEqual(before);
  expect(editProfileTopic(renamed, "Cells", "Cells", "")).toEqual(before);
});

it("removal reassigns only affected topic tags while preserving stable parts, marks and resource rules", () => {
  const generated = templateFixture();
  const next = removeProfileTopics(generated, ["Cells"], generated.topics);
  expect(next.mode).toBe("custom");
  expect(next.sections[0].groups[0].parts).toEqual(generated.sections[0].groups[0].parts.map(part => ({ ...part, topic: "Enzymes" })));
  expect(next.identity).toEqual(generated.identity);
  expect(() => removeProfileTopics(next, ["Enzymes"], generated.topics)).toThrow("at least one");
});

it("Undo restores topic state without losing timing, question marks or parts edited afterward", () => {
  const original = editProfileTopic(templateFixture(), "Cells", "Cell structures", "Keep this note");
  const removed = removeProfileTopics(original, ["Cells"], original.topics);
  removed.durationMinutes = 42;
  removed.sections[0].groups[0].parts[0].marks = 5;
  removed.sections[0].groups[0].parts.push({ ...removed.sections[0].groups[0].parts[0], id: "new-part", topic: "Enzymes", demand: "AO3" });
  const undone = restoreProfileTopicState(removed, original);
  expect(undone.topics).toEqual(original.topics);
  expect(undone.topicEdits).toEqual(original.topicEdits);
  expect(undone.durationMinutes).toBe(42);
  expect(undone.sections[0].groups[0].parts[0]).toEqual({ ...original.sections[0].groups[0].parts[0], marks: 5 });
  expect(undone.sections[0].groups[0].parts[2]).toEqual(removed.sections[0].groups[0].parts[2]);
});

it("restoring the source scope preserves unrelated edits and restores original part-topic assignments", () => {
  const baseline = editProfileTopic(templateFixture(), "Cells", "Cell structures", "Original note");
  let next = removeProfileTopics(baseline, ["Cells"], baseline.topics);
  next = addProfileTopic(next, "A student addition", baseline.topics);
  next.durationMinutes = 45;
  next.sections[0].groups[0].parts[0].demand = "AO3";
  next.designDecisions.push("Retained design choice");
  const restored = restoreProfileSourceTopics(next, baseline.topics, baseline);
  expect(restored.topics).toEqual(baseline.topics);
  expect(restored.addedTopics).toBeUndefined();
  expect(restored.topicEdits).toEqual(baseline.topicEdits);
  expect(restored.durationMinutes).toBe(45);
  expect(restored.sections[0].groups[0].parts[0]).toEqual({ ...baseline.sections[0].groups[0].parts[0], demand: "AO3" });
  expect(restored.designDecisions).toContain("Retained design choice");
});
