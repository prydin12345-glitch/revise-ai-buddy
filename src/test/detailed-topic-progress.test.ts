import { expect, it } from "vitest";
import { summariseStatsTopics, type StatsTopicAnswer } from "@/lib/subject-profile-stats";

it("keeps weak subtopics distinct and never assigns historical theme marks to their children", () => {
  const row = (topic: string, score: number): StatsTopicAnswer => ({
    topic, score, marks: 10, source: "quiz", subject: "Business", profileId: "synthetic-profile",
    questionId: topic, parentId: "synthetic-quiz", date: "2026-11-20T12:00:00Z",
  });
  const topics = summariseStatsTopics([
    row("1.1.2 Market research", 2), row("1.1.3 Market positioning", 9),
    row("Theme 1: Marketing and people", 10),
  ], new Date("2026-11-21T12:00:00Z"));
  expect(topics).toHaveLength(3);
  expect(topics.find(topic => topic.topic === "1.1.2 Market research"))
    .toMatchObject({ practiceScore: 20, practiceQuestionCount: 1, mastery: "weak" });
  expect(topics.find(topic => topic.topic === "1.1.3 Market positioning"))
    .toMatchObject({ practiceScore: 90, practiceQuestionCount: 1, mastery: "strong" });
});
