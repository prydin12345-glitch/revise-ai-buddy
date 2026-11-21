// @vitest-environment node
import { expect, it } from "vitest";
import { indexDocumentPages } from "../functions/_shared/profile-document-index";

const selection = { component: "9BS0/01", componentAliases: ["Paper 1"], course: "9BS0", qualification: "A-level" };
it.each([":", ""])("bounds a paper's allocation before named content headings with delimiter %j", delimiter => {
  const pages = ["A-level Business (9BS0)\nPaper 1 (9BS0/01)\nThemes 1 and 4\n100 marks\n120 minutes",
    `Theme 1${delimiter} Marketing\n1.1 Customers\n1.1.1 Research\na) Primary research`,
    `Theme 2${delimiter} Finance\n2.1 Finance\n2.1.1 Loans\na) Borrowing`,
    `Theme 4${delimiter} Global business\n4.1 Globalisation\n4.1.1 Growth\na) Trade`];
  // Put overview and content on the same physical page: content cannot extend
  // the overview's explicit allocation merely through proximity.
  const input = [pages.join("\n")];
  expect(indexDocumentPages(input, selection)).not.toHaveProperty("topicContent");
  const index = indexDocumentPages(input, { ...selection, includeTopicContent: true });
  expect(index.coverage.complete).toBe(true);
  const text = index.topicContent!.map(span => span.text).join("\n");
  expect(text).toContain("Primary research");
  expect(text).toContain("Trade");
  expect(text).not.toContain("Borrowing");
  for (const span of index.topicContent!) expect(input[span.page - 1]).toContain(span.text);
});

it("keeps scientific notation in a single literal content span without duplicate windows", () => {
  const body = "1.1.1 Scientific comparison\na) Compare E = mc² and H₂O.\n3.0 × 10⁸\n2.0 x 10⁵\n4.0 E+3\nb) Read the values from the table.";
  const input = ["A-level Business (9BS0)\nPaper 1 (9BS0/01)\nThemes 1 and 4\n100 marks\n120 minutes",
    `Theme 1: Marketing\n1.1 Customers\n${body}`,
    "Theme 4: Global business\n4.1 Globalisation\n4.1.1 Growth\na) Trade"];
  const result = indexDocumentPages(input, { ...selection, includeTopicContent: true });
  const content = result.topicContent!.filter(span => span.page === 2);
  expect(content).toHaveLength(1);
  expect(content[0].text).toContain(body);
  expect(content[0].text.match(/Scientific comparison/g)).toHaveLength(1);
});
