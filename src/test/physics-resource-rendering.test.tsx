import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { act } from "react";
import ReactDOM from "react-dom/client";
import jsPDF from "jspdf";
import { getCircuitConfig } from "@/components/circuit/getCircuitConfig";
import { detectCircuitConfig } from "@/components/circuit/circuit-detector";
import { LineChart, axisLabels } from "@/components/graph/LineChart";
const capture = vi.hoisted(() => ({ html: [] as string[] }));
vi.mock("html2canvas", () => ({
  default: async (element: HTMLElement) => {
    capture.html.push(element.innerHTML);
    return { width: 600, height: 320, toDataURL: () => "" };
  },
}));
vi.mock("recharts", async (importOriginal) => {
  const original = await importOriginal<typeof import("recharts")>(),
    React = await import("react");
  return {
    ...original,
    ResponsiveContainer: ({ children }: any) =>
      React.cloneElement(children, { width: 600, height: 320 }),
  };
});
import { generateExamPDF } from "@/lib/exam-pdf-generator";
import { exportedPDFText } from './pdf-test-utils';
const graph = {
  type: "line_chart" as const,
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
beforeEach(() => {
  capture.html = [];
  const createRoot = ReactDOM.createRoot.bind(ReactDOM);
  vi.spyOn(ReactDOM, "createRoot").mockImplementation((container, options) => {
    const root = createRoot(container, options);
    return {
      render: (children) => act(() => root.render(children)),
      unmount: () => act(() => root.unmount()),
    };
  });
  vi.spyOn(
    jsPDF.API as unknown as Pick<jsPDF, "addImage">,
    "addImage",
  ).mockImplementation(function () {
    return this;
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("no client-injected ghost circuit", () => {
  it.each([
    "The capacitor discharge graph shows potential difference against time. Use the graph to determine the time constant.",
    "A search coil rotates in a magnetic field. From the flux graph calculate the induced emf.",
    "A capacitor of capacitance 80 microfarads stores energy at 12 V. Calculate the energy stored.",
  ])(
    "suppresses both inferred and saved decoration for %s",
    (question_text) => {
      expect(
        detectCircuitConfig(
          question_text,
          "Capacitors and induction",
          "Physics",
        ),
      ).toBeNull();
      expect(
        getCircuitConfig({ question_text, diagram_config: graph }, "Physics"),
      ).toBeNull();
      expect(
        getCircuitConfig({ question_text, diagram_config: circuit }, "Physics"),
      ).toBeNull();
    },
  );
  it("does not give a completed inferred answer to a circuit drawing task", () => {
    expect(
      detectCircuitConfig(
        "Draw a circuit diagram with a cell, resistor, ammeter and voltmeter.",
        "Circuits",
        "Physics",
      ),
    ).toBeNull();
  });
  it("retains an explicit topology-dependent saved circuit", () => {
    const question_text =
      "In the circuit shown below, two resistors are connected in parallel. Determine the current in branch R1.";
    expect(
      getCircuitConfig({ question_text, diagram_config: circuit }, "Physics"),
    ).toEqual(circuit);
  });
  it("preserves the Biology guard and does not invent another resource beside a supplied chart", () => {
    const question_text =
      "The circuit shown contains resistors connected in series. Calculate the current.";
    expect(
      getCircuitConfig({ question_text, diagram_config: circuit }, "Biology"),
    ).toBeNull();
    expect(
      getCircuitConfig({ question_text, diagram_config: graph }, "Physics"),
    ).toBeNull();
  });
});
describe("axis-label aliases through actual SVG and PDF routing", () => {
  it("trims labels and falls back from an empty canonical alias", () => {
    expect(axisLabels({ ...graph, xLabel: "   " })).toEqual({
      xLabel: "Time / s",
      yLabel: "Potential difference / V",
    });
  });
  it("renders alternate names as visible SVG text", () => {
    render(<LineChart chartData={graph} />);
    expect(screen.getByText("Time / s").closest("svg")).not.toBeNull();
    expect(
      screen.getByText("Potential difference / V").closest("svg"),
    ).not.toBeNull();
  });
  it("captures the same visible labels for printable/PDF output and prints the figure-only measurements table", async () => {
    const pdf = await generateExamPDF(
      {
        title: "Original Physics resource test",
        subject: "Physics",
        questions: [
          {
            id: "graph",
            question_number: "1",
            question_type: "short_answer",
            marks: 2,
            question_text:
              "Use the graph to determine the decay time constant.",
            diagram_config: graph,
          },
          {
            id: "table",
            question_number: "2",
            question_type: "short_answer",
            marks: 2,
            question_text:
              "The following measurements were recorded. Calculate the electrical energy.",
            diagram_config: {
              type: "data_table",
              headers: ["Quantity", "Value"],
              rows: [
                ["Potential difference / V", "12.0"],
                ["Current / A", "2.0"],
              ],
            },
          },
        ],
      },
      { includeWorkingSpace: false },
    );
    expect(capture.html).toHaveLength(1);
    expect(capture.html[0]).toContain("Time / s");
    expect(capture.html[0]).toContain("Potential difference / V");
    expect(capture.html[0]).not.toContain("capacitor");
    expect(pdf.output()).toContain("(12.0)");
    expect(pdf.output()).toContain("(2.0)");
  });
});


// The exported paper must preserve the same choices used for screen marking.
import {templateFixture} from "../../supabase/tests/profile-builder-fixtures";
import {prepareProfileSave} from "../../supabase/functions/_shared/profile-builder-service";
import {snapshotTemplate} from "../../supabase/functions/_shared/profile-template-context";
function protectedProfileContext() {
  const template=templateFixture();
  template.identity.subject="Physics";
  const saved=prepareProfileSave({proposalVersion:1,promptVersion:1,origin:"model_knowledge_ai",template,evidence:null,evidenceVersion:null,presetId:null,profileSettings:null},template);
  return {context_version:2,resolved_by:"server",subject_name:"Physics",profile_template:snapshotTemplate({...saved.settings,profile_template:saved.context})};
}
const mcqPdfQuestion=(question_text:string,options:string[])=>({id:"mcq",question_number:"1",question_type:"mcq",marks:1,question_text,options:options.map((text,i)=>({label:String.fromCharCode(65+i),text}))});
describe("Physics PDF mathematical choices",()=>{
  it("renders nested unit exponents as superscripts rather than raw braces",async()=>{
    const pdf=await generateExamPDF({title:"Original unit fixture",subject:"Physics",questions:[mcqPdfQuestion("Which units are equivalent to tesla?",[String.raw`$\mathrm{N\,A^{-1}\,m^{-1}}$`,"tesla", "joule", "watt"])]},{includeWorkingSpace:false});
    expect(pdf.output()).not.toContain("m^{-1}");
    expect(pdf.output()).toContain("( m)");
    expect(pdf.output().split("(-1) Tj").length - 1).toBe(2);
  });
  it("stops a protected-profile export whose inline list contradicts saved A-D choices",async()=>{
    await expect(generateExamPDF({title:"Saved choices",subject:"Physics",generation_context:protectedProfileContext(),questions:[mcqPdfQuestion("Which capacitance is correct?\nA) 100 μF\nB) 80 μF\nC) 120 μF\nD) 140 μF",["80 μF","100 μF","120 μF","140 μF"])]})).rejects.toThrow(/inline and saved choices disagree/);
  });
  it("prints one matching inline/saved choice set with equivalent mathematical notation",async()=>{
    const options=[String.raw`$80\,\mu\mathrm{F}$`,"100 μF","120 μF","140 μF"];
    const pdf=await generateExamPDF({title:"Same saved choices",subject:"Physics",generation_context:protectedProfileContext(),questions:[mcqPdfQuestion("Which capacitance is correct?\nA) 80 μF\nB) 100 μF\nC) 120 μF\nD) 140 μF",options)]},{includeWorkingSpace:false});
    expect(pdf.output().split("(A" + String.fromCharCode(92) + ")) Tj").length - 1).toBe(1);
  });
  it("retains ohm units, uppercase quantities and acceleration dimensions in the exported text",async()=>{
    const pdf=await generateExamPDF({title:"Explicit units",subject:"Physics",questions:[{id:"units",question_number:"1",question_type:"short_answer",marks:2,question_text:String.raw`A resistor has resistance $5\,\Omega$. Calculate $\Delta E$ when the magnetic flux $\Phi$ changes. The stated acceleration is 9.8 m/s2.`}]},{includeWorkingSpace:false});
    const text = await exportedPDFText(pdf);
    expect(text).toContain("5 Ω");expect(text).toContain("Δ E");expect(text).toContain("Φ");expect(pdf.output()).toContain("(-2)");
    expect(pdf.output()).not.toContain("(-1)");
  });
  it("omits a saved decorative circuit from a calculation-only PDF",async()=>{
    await generateExamPDF({title:"No decorative circuit",subject:"Physics",questions:[{id:"decorative",question_number:"1",question_type:"short_answer",marks:2,question_text:"A capacitor stores charge at 12 V. Calculate the stored energy.",diagram_config:circuit}]},{includeWorkingSpace:false});
    expect(capture.html).toHaveLength(0);
  });
});
