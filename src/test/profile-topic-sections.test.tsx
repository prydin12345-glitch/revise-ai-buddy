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
  {
    page: 9,
    text: "Paper 1 What's assessed Sections 1 - 5 and 6.1 (Periodic motion)",
  },
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
    expect(
      resolveSectionTopic(LABEL, pages)!.topics.map((t) => t.title),
    ).toEqual([
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

  it("does not choose a majority title when one section number names different topics", () => {
    const conflicting = [
      { page: 1, text: "3.1 Mechanics" },
      { page: 2, text: "3.1 Mechanics" },
      { page: 3, text: "3.1 Electricity" },
    ];
    expect(resolveSectionTopic("Section 1", conflicting)).toBeNull();
  });

  const evidence = (): ProfileEvidence => ({
    version: 1,
    identity: {
      country: "GB",
      educationSystem: "UK",
      stage: "Secondary",
      qualification: "A-level",
      subject: "Physics",
      organisation: "AQA",
      course: "7408",
      component: "7408/1",
      specificationVersion: "v1.4",
      tier: null,
    },
    documents: [
      {
        id: "upload-1",
        checksum: "a".repeat(64),
        title: "Spec",
        url: null,
        version: "1.4",
        kind: "specification",
        authority: "owner_supplied",
        retrievedOn: "unknown",
        state: "active",
        applicableCohort: "2016",
        locations: [
          { id: "loc-2", page: 9, section: "Paper 1", text: pages[1].text },
        ],
      },
    ],
    facts: {
      marks: null,
      durationMinutes: null,
      topics: [LABEL],
      tier: null,
      calculator: "unknown",
      formats: [],
      selection: "unknown",
      mathsRequirement: null,
      practicalRequirement: null,
    },
    claims: [
      {
        field: "topics",
        documentId: "upload-1",
        locationId: "loc-2",
        quote: LABEL,
        rule: "mandatory",
      },
    ],
    unresolved: [],
    conflicts: [],
  });

  it("resolves combined-source headings only within the selected course", () => {
    const label = "Sections 7 and 8";
    const e = evidence();
    e.identity.component = "7408/2";
    e.facts.topics = [label];
    e.documents[0].locations[0].text =
      "Paper 2 What's assessed Sections 7 and 8";
    e.claims[0].quote = label;
    const expanded = expandSectionTopics(e, [
      {
        id: "upload-1",
        pages: [
          {
            page: 8,
            text: "AS Physics (7407)\nPaper 1 (7407/1)\n3.7 AS-only waves\n3.8 AS-only electricity",
          },
          {
            page: 9,
            text: "A-level Physics (7408)\nPaper 2 What's assessed Sections 7 and 8\n3.7 Fields\n3.8 Nuclear physics",
          },
        ],
      },
    ]);
    expect(expanded.facts.topics).toEqual(["Fields", "Nuclear physics"]);
    expect(
      expanded.documents[0].locations.slice(1).map((location) => location.page),
    ).toEqual([9, 9]);
    expect(() => validateEvidence(expanded)).not.toThrow();
  });
  it("does not use AS-only headings to fill missing A-level section names", () => {
    const label = "Sections 7 and 8";
    const e = evidence();
    e.identity.component = "7408/2";
    e.facts.topics = [label];
    e.documents[0].locations[0].text =
      "Paper 2 What's assessed Sections 7 and 8";
    e.claims[0].quote = label;
    const expanded = expandSectionTopics(e, [
      {
        id: "upload-1",
        pages: [
          {
            page: 8,
            text: "AS Physics (7407)\nPaper 1 (7407/1)\n3.7 AS-only waves\n3.8 AS-only electricity",
          },
          {
            page: 9,
            text: "A-level Physics (7408)\nPaper 2 What's assessed Sections 7 and 8",
          },
        ],
      },
    ]);
    expect(expanded.facts.topics).toEqual([label]);
    expect(expanded.documents[0].locations).toEqual(e.documents[0].locations);
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
    expect(() =>
      assertTopicScope({ topics: ["Waves", "Astrophysics"] }, ["Waves"]),
    ).toThrow();
    expect(() =>
      assertTopicScope(
        { topics: ["Waves", "Astrophysics"], addedTopics: ["Astrophysics"] },
        ["Waves"],
      ),
    ).not.toThrow();
    expect(() =>
      assertTopicScope({ topics: ["Waves"], addedTopics: ["Waves"] }, [
        "Waves",
      ]),
    ).toThrow();
  });
  it("labels a narrowed source scope Custom and keeps a mere reorder unchanged", () => {
    const t: any = {
      mode: "full_mock",
      topics: ["Waves", "Electricity"],
      sections: [],
    };
    expect(applyTopicEdit(t, ["Waves"], ["Waves", "Electricity"]).mode).toBe(
      "custom",
    );
    expect(
      applyTopicEdit(t, ["Electricity", "Waves"], ["Waves", "Electricity"])
        .mode,
    ).toBe("full_mock");
  });
  it("records additions and moves parts off removed topics", () => {
    const t: any = {
      topics: [LABEL],
      sections: [{ groups: [{ parts: [{ topic: LABEL }, { topic: LABEL }] }] }],
    };
    const next = applyTopicEdit(t, ["Waves", "Electricity"], [LABEL]);
    expect(next.addedTopics).toEqual(["Waves", "Electricity"]);
    expect(next.mode).toBe("custom");
    expect(next.sections[0].groups[0].parts.map((p) => p.topic)).toEqual([
      "Waves",
      "Electricity",
    ]);
  });
});

import { render, screen, fireEvent } from "@testing-library/react";
import { BuilderFollowupQuestions } from "@/components/profiles/BuilderFollowupQuestions";

describe("page follow-up question", () => {
  it("accepts a typed range like 8-10 even when suggested pages exist", () => {
    let sent: Record<string, string> | null = null;
    render(
      <BuilderFollowupQuestions
        jobId="j"
        summary={[]}
        onChange={() => {}}
        onAnswer={(a) => (sent = a)}
        items={[
          {
            field: "source_pages",
            question: "Which PDF page?",
            choices: [{ value: "1:9", label: "Page 9" }],
          },
        ]}
      />,
    );
    fireEvent.change(screen.getByLabelText("Which PDF page?"), {
      target: { value: "8-10" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(sent).toEqual({ source_pages: "8-10" });
  });
});
