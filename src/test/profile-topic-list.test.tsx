import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  ProfileTopicList,
  type ProfileTopicDetail,
} from "@/components/profiles/ProfileTopicList";

afterEach(cleanup);

const documents = [{ id: "spec", title: "Biology specification" }];
const details: ProfileTopicDetail[] = [
  {
    topic: "Cell membranes", path: ["Biology", "Cells"],
    sources: [{ documentId: "spec", page: 17, text: "Describe diffusion across a partially permeable membrane." }],
  },
  {
    topic: "Cell division", path: ["Biology", "Cells"],
    sources: [{ documentId: "spec", page: 18, text: "Explain the role of mitosis in growth and repair." }],
  },
  {
    topic: "Inflation", path: ["Economics", "Macroeconomics"],
    sources: [{ documentId: "econ", page: 9, text: "Explain how the consumer price index measures inflation." }],
  },
];

const search = (value: string) => fireEvent.change(screen.getByRole("searchbox"), { target: { value } });
const expand = (label: string) => fireEvent.click(screen.getByText(label, { selector: "summary" }));

describe("ProfileTopicList", () => {
  it("renders old flat labels and additions without inventing source detail or a rebuild action", () => {
    render(<ProfileTopicList topics={["Cells", "My revision topic"]} addedTopics={["My revision topic"]} />);
    expect(screen.getByText("Cells")).toBeVisible();
    expect(screen.getByText("Added by you")).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("2 topics");
    expect(screen.queryByText(/PDF page/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Read the syllabus again/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("only offers the source hint when opted in and the displayed topics have no usable details", () => {
    const { rerender } = render(<ProfileTopicList topics={["Cells"]} showSourceHint />);
    expect(screen.getByText(/This profile saved a flat topic list/)).toBeVisible();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    rerender(<ProfileTopicList topics={["Cell membranes"]} details={details} showSourceHint />);
    expect(screen.queryByText(/Read the syllabus again/)).not.toBeInTheDocument();
    rerender(<ProfileTopicList topics={["Cells"]} details={details} showSourceHint />);
    expect(screen.getByText(/Read the syllabus again/)).toBeVisible();
    rerender(<ProfileTopicList topics={[]} showSourceHint />);
    expect(screen.queryByText(/Read the syllabus again/)).not.toBeInTheDocument();
  });

  it("groups exact leaf labels in source order and exposes physical PDF pages and literal outcomes", () => {
    render(<ProfileTopicList topics={["Cell membranes", "Cell division", "Inflation"]} details={details} documents={documents} />);
    expect(screen.getByText("Cell membranes", { selector: "summary" })).not.toBeVisible();
    expand("Biology");
    expand("Cells");
    const membranes = screen.getByText("Cell membranes", { selector: "summary" });
    const division = screen.getByText("Cell division", { selector: "summary" });
    expect(membranes.compareDocumentPosition(division) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expand("Cell membranes");
    expect(screen.getByText("Biology specification · PDF page 17")).toBeVisible();
    expect(screen.getByText(details[0].sources[0].text)).toBeVisible();
    expand("Cells");
    expect(screen.getByText("Cell membranes", { selector: "summary" })).not.toBeVisible();
  });

  it.each([
    ["membranes", "Cell membranes", "1 of 3 topics"],
    ["cells", "Cell division", "2 of 3 topics"],
    ["MITOSIS", "Cell division", "1 of 3 topics"],
    ["biology specification", "Cell membranes", "2 of 3 topics"],
  ])("searches labels, paths, excerpts and document titles: %s", (query, topic, count) => {
    render(<ProfileTopicList topics={details.map((detail) => detail.topic)} details={details} documents={documents} />);
    search(`  ${query}  `);
    expect(screen.getByRole("status")).toHaveTextContent(count);
    expect(screen.getByText(topic, { selector: "summary" })).toBeVisible();
    expect(screen.queryByText("Inflation", { selector: "summary" })).not.toBeInTheDocument();
    if (query === "MITOSIS") expect(screen.getByText(details[1].sources[0].text)).toBeVisible();
  });

  it("finds PED inside the full literal outcome and automatically expands its groups and source details", () => {
    const text = `${"Context ".repeat(290)}Calculate price elasticity of demand (PED) and interpret its value.`;
    render(<ProfileTopicList topics={["Price elasticity of demand", "Costs"]} details={[
      { topic: "Price elasticity of demand", path: ["Business", "Marketing"], sources: [{ documentId: "spec", page: 42, text }] },
    ]} documents={[{ id: "spec", title: "Business specification" }]} />);
    expect(screen.getByText("Marketing", { selector: "summary" })).not.toBeVisible();
    search("PED");
    expect(screen.getByRole("status")).toHaveTextContent("1 of 2 topics");
    expect(screen.getByText("Business", { selector: "summary" })).toBeVisible();
    expect(screen.getByText("Marketing", { selector: "summary" })).toBeVisible();
    expect(screen.getByText("Price elasticity of demand", { selector: "summary" })).toBeVisible();
    expect(screen.getByText(/Calculate price elasticity of demand \(PED\)/)).toBeVisible();
    expect(screen.getByText(/Calculate price elasticity of demand \(PED\)/).textContent).toBe(text);
    expect(screen.getByText("Business specification · PDF page 42")).toBeVisible();
    expect(screen.queryByText("Costs")).not.toBeInTheDocument();
  });

  it("keeps repeated group names under their full paths and supports four levels", () => {
    render(<ProfileTopicList topics={["A", "B"]} details={[
      { topic: "A", path: ["Course A", "Unit", "Section", "Outcomes"], sources: [] },
      { topic: "B", path: ["Course B", "Unit"], sources: [] },
    ]} />);
    search("Unit");
    expect(screen.getAllByText("Unit", { selector: "summary" })).toHaveLength(2);
    const courseA = screen.getByText("Course A", { selector: "summary" }).closest("details")!;
    const courseB = screen.getByText("Course B", { selector: "summary" }).closest("details")!;
    expect(within(courseA).getByText("A")).toBeVisible();
    expect(within(courseA).getByText("Outcomes", { selector: "summary" })).toBeVisible();
    expect(within(courseA).queryByText("B")).not.toBeInTheDocument();
    expect(within(courseB).getByText("B")).toBeVisible();
  });

  it("ignores metadata for removed or differently cased labels and preserves unmatched flat leaves", () => {
    render(<ProfileTopicList topics={["cell membranes", "Cell division", "My topic"]} details={details} />);
    expect(screen.getByText("cell membranes")).toBeVisible();
    expect(screen.getByText("My topic")).toBeVisible();
    expect(screen.queryByText("Cell membranes", { selector: "summary" })).not.toBeInTheDocument();
    expect(screen.queryByText("Economics", { selector: "summary" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("3 topics");
  });

  it("does not attach stale source provenance to student additions", () => {
    render(<ProfileTopicList topics={["Cell membranes"]} addedTopics={["Cell membranes"]} details={details} documents={documents} />);
    expect(screen.getByText("Added by you")).toBeVisible();
    expect(screen.queryByText("Biology", { selector: "summary" })).not.toBeInTheDocument();
    expect(screen.queryByText(/PDF page/)).not.toBeInTheDocument();
  });

  it("renders unknown document references honestly and treats source prose and titles as inert text", () => {
    const text = '<img src=x onerror="alert(1)"> [Open](javascript:alert(1))';
    render(<ProfileTopicList topics={["Topic"]} documents={[{ id: "spec", title: "<script>alert(1)</script>" }]} details={[
      { topic: "Topic", path: [], sources: [
        { documentId: "spec", page: 7, text },
        { documentId: "unknown", page: 8, text: "A second source outcome." },
      ] },
    ]} />);
    expand("Topic");
    const region = screen.getByRole("region", { name: "Profile topics" });
    expect(screen.getByText(text)).toBeVisible();
    expect(screen.getByText("<script>alert(1)</script> · PDF page 7")).toBeVisible();
    expect(screen.getByText("Source document · PDF page 8")).toBeVisible();
    expect(region.querySelector("script, img, a")).toBeNull();
  });

  it("hides invalid page citations and blank excerpts instead of inventing page references", () => {
    render(<ProfileTopicList topics={["Topic"]} details={[
      { topic: "Topic", path: [], sources: [
        { documentId: "spec", page: 0, text: "No physical page" },
        { documentId: "spec", page: 1.5, text: "Fractional page" },
        { documentId: "spec", page: 2, text: " " },
      ] },
    ]} />);
    expect(screen.getByText("Topic")).toBeVisible();
    expect(screen.queryByText(/PDF page/)).not.toBeInTheDocument();
  });

  it("updates from controlled props without mutating caller data or retaining removed leaves", () => {
    const original = structuredClone(details);
    const { rerender } = render(<ProfileTopicList topics={["Cell membranes"]} details={details} />);
    search("division");
    expect(screen.getByText("No topics match your search.")).toBeVisible();
    rerender(<ProfileTopicList topics={["Cell division"]} details={details} />);
    expect(screen.getByText("Cell division", { selector: "summary" })).toBeVisible();
    search("");
    expect(screen.getByRole("status")).toHaveTextContent("1 topic");
    expect(screen.queryByText("Cell membranes", { selector: "summary" })).not.toBeInTheDocument();
    expect(details).toEqual(original);
  });

  it("handles an empty list and 400 leaves with long literal source outcomes", () => {
    const { rerender } = render(<ProfileTopicList topics={[]} />);
    expect(screen.getByText("No topics yet.")).toBeVisible();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    const many = Array.from({ length: 400 }, (_, index): ProfileTopicDetail => ({
      topic: `Topic ${index}`, path: [`Group ${Math.floor(index / 100)}`],
      sources: [{ documentId: "spec", page: index % 120 + 1, text: index === 399 ? "x".repeat(2400) : `Outcome ${index}` }],
    }));
    rerender(<ProfileTopicList topics={many.map((detail) => detail.topic)} details={many} documents={documents} />);
    expect(screen.getByRole("status")).toHaveTextContent("400 topics");
    search("x".repeat(30));
    expect(screen.getByRole("status")).toHaveTextContent("1 of 400 topics");
    expect(screen.getByText("x".repeat(2400))).toBeVisible();
  });
});
