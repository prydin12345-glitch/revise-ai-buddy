import { describe, expect, it } from "vitest";
import {
  expandSectionTopics,
  isSectionReferenceTopic,
  parseSectionRefs,
  resolveSectionTopic,
} from "../../supabase/functions/_shared/profile-topic-sections";
import {
  assertTopicScope,
  validateEvidence,
  type ProfileEvidence,
} from "../../supabase/functions/_shared/profile-evidence";
import { applyTopicEdit } from "@/lib/profile-topic-edits";

const LABEL = "Sections 1 - 5 and 6.1 (Periodic motion)";
const pages = [
  {
    page: 3,
    text: "Contents\n1 Introduction 5\n2 Specification at a glance 9\n3 Subject content 13\n3.1 Measurements and their errors 13\n3.2 Particles and radiation 15",
  },
  { page: 9, text: "Paper 1 What's assessed Sections 1 - 5 and 6.1 (Periodic motion)" },
  {
    page: 14,
    text: "3.1 Measurements and their errors\n3.1.1 Use of SI units\n3.2 Particles and radiation\n3.3 Waves\n3.4 Mechanics and materials\n3.5 Electricity\n3.6 Further mechanics and thermal physics\n3.6.1 Periodic motion",
  },
];

describe("section-number topics", () => {
  it("detects pointers but not real topic names", () => {
    expect(isSectionReferenceTopic(LABEL)).toBe(true);
    expect(isSectionReferenceTopic("Topics 1 to 4")).toBe(true);
    expect(isSectionReferenceTopic("Waves")).toBe(false);
    expect(isSectionReferenceTopic("3.3 Waves")).toBe(false);
  });
  it("expands ranges", () => {
    expect(parseSectionRefs(LABEL)).toEqual(["1", "2", "3", "4", "5", "6.1"]);
  });
  it("picks the numbering scheme that matches the hint, not the intro chapters", () => {
    expect(resolveSectionTopic(LABEL, pages)!.topics.map((t) => t.title)).toEqual([
      "Measurements and their errors",
      "Particles and radiation",
      "Waves",
      "Mechanics and materials",
      "Electricity",
      "Periodic motion",
    ]);
  });
  it("leaves the pointer when headings are missing", () => {
    expect(resolveSectionTopic(LABEL, [pages[1]])).toBeNull();
  });

  const evidence = (): ProfileEvidence => ({
    version: 1,
    identity: {
      country: "GB", educationSystem: "UK", stage: "Secondary", qualification: "A-level",
      subject: "Physics", organisation: "AQA", course: "7408", component: "7408/1",
      specificationVersion: "v1.4", tier: null,
    },
    documents: [{
      id: "upload-1", checksum: "a".repeat(64), title: "Spec", url: null, version: "1.3",
      kind: "specification", authority: "owner_supplied", retrievedOn: "unknown",
      state: "active", applicableCohort: "2016",
      locations: [{ id: "loc-2", page: 9, section: "Paper 1", text: pages[1].text }],
    }],
    facts: {
      marks: null, durationMinutes: null, topics: [LABEL], tier: null, calculator: "unknown",
      formats: [], selection: "unknown", mathsRequirement: null, practicalRequirement: null,
    },
    claims: [{ field: "topics", documentId: "upload-1", locationId: "loc-2", quote: LABEL, rule: "mandatory" }],
    unresolved: [], conflicts: [],
  });

  it("replaces the pointer with quote-backed named topics that pass validation", () => {
    const e = expandSectionTopics(evidence(), [{ id: "upload-1", pages }]);
    expect(e.facts.topics).toHaveLength(6);
    expect(e.facts.topics).not.toContain(LABEL);
    expect(() => validateEvidence(e)).not.toThrow();
  });
});

describe("student topic edits", () => {
  it("allows added topics only when recorded as additions", () => {
    expect(() => assertTopicScope({ topics: ["Waves", "Astrophysics"] }, ["Waves"])).toThrow();
    expect(() =>
      assertTopicScope({ topics: ["Waves", "Astrophysics"], addedTopics: ["Astrophysics"] }, ["Waves"]),
    ).not.toThrow();
    expect(() =>
      assertTopicScope({ topics: ["Waves"], addedTopics: ["Waves"] }, ["Waves"]),
    ).toThrow();
  });
  it("records additions and moves parts off removed topics", () => {
    const t: any = {
      topics: [LABEL],
      sections: [{ groups: [{ parts: [{ topic: LABEL }, { topic: LABEL }] }] }],
    };
    const next = applyTopicEdit(t, ["Waves", "Electricity"], [LABEL]);
    expect(next.addedTopics).toEqual(["Waves", "Electricity"]);
    expect(next.sections[0].groups[0].parts.map((p) => p.topic)).toEqual(["Waves", "Electricity"]);
  });
});

import { render, screen, fireEvent } from "@testing-library/react";
import { BuilderFollowupQuestions } from "@/components/profiles/BuilderFollowupQuestions";

describe("page follow-up question", () => {
  it("accepts a typed range like 8-10 even when suggested pages exist", () => {
    let sent: Record<string, string> | null = null;
    render(
      <BuilderFollowupQuestions
        jobId="j" summary={[]} onChange={() => {}}
        onAnswer={(a) => (sent = a)}
        items={[{ field: "source_pages", question: "Which PDF page?", choices: [{ value: "1:9", label: "Page 9" }] }]}
      />,
    );
    fireEvent.change(screen.getByLabelText("Which PDF page?"), { target: { value: "8-10" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(sent).toEqual({ source_pages: "8-10" });
  });
});
