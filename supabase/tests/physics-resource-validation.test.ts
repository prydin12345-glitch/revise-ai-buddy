// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  needsCircuitTopology,
  physicsResourceIssues,
} from "../functions/_shared/physics-resource-validation";
import { resolveQuestionResources } from "../functions/_shared/question-resources";

const graph = {
  type: "line_chart",
  xAxisLabel: "Time / s",
  yAxisLabel: "Potential difference / V",
  datasets: [
    {
      label: "Discharge",
      data: [
        { x: 0, y: 12 },
        { x: 2, y: 7.3 },
      ],
    },
  ],
};
const circuit = {
  type: "circuit",
  nodes: [{ id: "a", x: 0, y: 0 }],
  wires: [{ from: "a", to: "a", component: "capacitor" }],
};

describe("Physics circuit relevance", () => {
  it.each([
    "The graph shows how the potential difference across a capacitor changes with time. Use the graph to determine the time constant.",
    "A search coil rotates in a magnetic field. Use the flux-linkage graph to calculate the induced emf.",
    "Define electric potential at a point in a field.",
    "A capacitor of capacitance 80 microfarads stores charge at 12 V. Calculate its energy.",
    "A heater draws a current of 2.0 A from a 12 V supply. Calculate the energy transferred in 30 s.",
  ])("does not invent a circuit for %s", (text) => {
    expect(needsCircuitTopology(text)).toBe(false);
    expect(
      physicsResourceIssues({ question_text: text, diagram_config: circuit }),
    ).toEqual([expect.objectContaining({ code: "invalid_resource" })]);
  });
  it.each([
    "Draw a circuit diagram showing how the ammeter and voltmeter should be connected to the resistor.",
    "The circuit shown contains two resistors in parallel. Calculate the current in the upper branch.",
    "Two resistors are connected in series across a cell. Determine the potential difference across R1.",
    "A potential divider contains an LDR. Explain how its output changes as the light intensity increases.",
  ])("keeps a topology-dependent circuit task: %s", (text) => {
    expect(needsCircuitTopology(text)).toBe(true);
    expect(
      physicsResourceIssues({ question_text: text, diagram_config: circuit }),
    ).toEqual([]);
  });
  it("keeps the valid graph and a table stored only as a figure", () => {
    expect(
      physicsResourceIssues({
        question_text: "Use the graph to find the decay time constant.",
        diagram_config: graph,
      }),
    ).toEqual([]);
    const table = resolveQuestionResources({
      question_text: "The following measurements were recorded.",
      diagram_config: {
        type: "data_table",
        headers: ["Quantity", "Value"],
        rows: [
          ["Voltage / V", 12],
          ["Current / A", 2.0],
        ],
      },
    });
    expect(table.chart?.type).toBe("data_table");
    expect(table.table?.headers).toEqual(["Quantity", "Value"]);
    expect(table.issues).toEqual([]);
  });
});
describe("Physics graph axes", () => {
  it("requires visible labels and rejects conflicting aliases", () => {
    expect(
      physicsResourceIssues({ diagram_config: { ...graph, xAxisLabel: "" } }),
    ).toEqual([expect.objectContaining({ code: "invalid_resource" })]);
    expect(
      physicsResourceIssues({
        diagram_config: { ...graph, xLabel: "Temperature / K" },
      }),
    ).toEqual([expect.objectContaining({ code: "conflicting_resource_data" })]);
  });
  it.each([
    [0, 0],
    [2, 0],
    [0, Infinity],
    ["zero", 10],
  ])("rejects an unusable axis domain %s", (...domain) => {
    expect(
      physicsResourceIssues({ diagram_config: { ...graph, domainX: domain } }),
    ).toEqual([expect.objectContaining({ code: "invalid_resource" })]);
  });
  it("rejects clipping and categorical line graphs", () => {
    expect(
      physicsResourceIssues({
        diagram_config: { ...graph, domainX: [0, 1] },
      })[0].detail,
    ).toMatch(/clips/);
    expect(
      physicsResourceIssues({
        diagram_config: { ...graph, xKind: "categorical" },
      }),
    ).toEqual([expect.objectContaining({ code: "inappropriate_graph" })]);
  });
});
