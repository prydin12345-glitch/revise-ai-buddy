import { describe, it, expect } from "vitest";
import {
  repeatedConceptDefects,
  definedConcept,
  recalledConcepts,
  repeatedSentence,
  coveredTasksNote,
} from "../functions/_shared/paper-repetition";
import { resolveQuestionResources } from "../functions/_shared/question-resources";

const graph = {
  type: "line_chart",
  xAxisLabel: "Time / s",
  yAxisLabel: "p.d. / V",
  datasets: [
    {
      label: "V",
      data: [
        { x: 0, y: 12 },
        { x: 2, y: 7.3 },
      ],
    },
  ],
};

describe("paper repetition", () => {
  it("finds the defined concept", () => {
    expect(
      definedConcept(
        "Define electric potential at a point in an electric field.",
      ),
    ).toBe("electric potential");
    expect(
      definedConcept(
        "Which statement correctly defines the electric potential at a point?",
      ),
    ).toBe("electric potential");
    expect(
      definedConcept(
        "Which statement correctly defines gravitational potential at a point?",
      ),
    ).toBe("gravitational potential");
  });
  it("flags the same definition in a different question, not the first one", () => {
    const d = repeatedConceptDefects([
      {
        id: "a",
        question_number: "2(a)",
        root_question_number: "2",
        marks: 2,
        question_text:
          "Define electric potential at a point in an electric field.",
      },
      {
        id: "b",
        question_number: "11",
        marks: 1,
        question_text:
          "Which statement correctly defines gravitational potential at a point?",
      },
      {
        id: "c",
        question_number: "20",
        marks: 1,
        question_text:
          "Which statement correctly defines the electric potential at a point in an electric field?",
      },
    ]);
    expect(d.map((x) => x.partId)).toEqual(["c"]);
  });
  it("flags identical graph data reused by another question", () => {
    const d = repeatedConceptDefects([
      {
        id: "a",
        question_number: "13",
        marks: 1,
        question_text: "Find C.",
        diagram_config: graph,
      },
      {
        id: "b",
        question_number: "18",
        marks: 1,
        question_text: "Find R.",
        diagram_config: { ...graph, xAxisLabel: "Time t (s)" },
      },
    ]);
    expect(d.map((x) => x.partId)).toEqual(["b"]);
  });
  it("flags a sentence written twice in one stem", () => {
    expect(
      repeatedSentence(
        "At which distance from the charge is the potential zero?\n\nAt which distance from the $charge$ is the potential zero?",
      ),
    ).not.toBeNull();
  });
  it("leaves a healthy paper alone", () => {
    expect(
      repeatedConceptDefects([
        {
          id: "a",
          question_number: "1",
          marks: 1,
          question_text: "State Faraday's law.",
        },
        {
          id: "b",
          question_number: "2",
          marks: 1,
          question_text: "Calculate the time constant.",
        },
      ]),
    ).toEqual([]);
    expect(
      coveredTasksNote([
        { question_number: "1", marks: 1, question_text: "Ctx\nDefine X." },
      ]),
    ).toContain("Q1: Define X.");
  });
});

describe("graph labels and stored tables", () => {
  it("shows a table stored only as the figure", () => {
    const r = resolveQuestionResources({
      question_text: "The following measurements were recorded.",
      table_data: null,
      diagram_config: {
        type: "data_table",
        headers: ["Quantity", "Value"],
        rows: [
          ["Mass", "0.750 kg"],
          ["Time", "300 s"],
        ],
      },
    } as any);
    expect(r.issues).toEqual([]);
    expect(r.chart?.type).toBe("data_table");
  });
});

describe("whole-paper task diversity without fuzzy topic bans", () => {
  const part = (
    number: string,
    question_text: string,
    extra: Record<string, any> = {},
  ) => ({
    id: number,
    question_number: number,
    marks: 1,
    question_text,
    ...extra,
  });
  it.each([
    [
      "State two assumptions of the kinetic theory of an ideal gas.",
      "Which statement is an assumption of the molecular model of an ideal gas?",
    ],
    [
      "State Faraday's law of electromagnetic induction.",
      "Which statement correctly states Faraday's law?",
    ],
    [
      "State the function of a moderator in a nuclear reactor.",
      "What is the purpose of the moderator in a nuclear reactor?",
    ],
    [
      "State what a moderator does in a reactor.",
      "What is the role of a moderator in a reactor?",
    ],
    [
      "Explain what is meant by electric potential at a point.",
      "Which statement correctly defines the electrostatic potential at a point?",
    ],
  ])("flags a clear written/MCQ recall repeat: %s", (written, mcq) => {
    expect(
      repeatedConceptDefects([part("1(a)", written), part("20", mcq)]).map(
        (d) => d.partId,
      ),
    ).toEqual(["20"]);
  });
  it("does not confuse different applications with a repeated law or assumption recall", () => {
    const rows = [
      part("1", "State Faraday's law."),
      part(
        "2",
        "Use Faraday's law to calculate the induced emf when the flux changes by 0.040 Wb in 0.020 s.",
      ),
      part("3", "State one assumption of the ideal gas model."),
      part("4", "Calculate the rms speed of ideal gas molecules at 350 K."),
      part("5", "Explain why graphite is a suitable moderator material."),
      part("6", "What is the purpose of a moderator in a reactor?"),
    ];
    expect(repeatedConceptDefects(rows)).toEqual([]);
  });
  it("treats different alpha/proton radius conditions as different comparisons", () => {
    const first =
      "Protons and alpha particles enter a magnetic field at the same speed. Compare their radii.";
    const repeated =
      "An alpha particle and a proton have the same speed in a magnetic field. What is the ratio of their radii?";
    const different =
      "An alpha particle and a proton have the same momentum in a magnetic field. What is the ratio of their radii?";
    expect(
      repeatedConceptDefects([
        part("2(c)", first),
        part("16", repeated),
        part("17", different),
      ]).map((d) => d.partId),
    ).toEqual(["16"]);
  });
  it("also rejects repeated definitions within one parent without rejecting linked applications", () => {
    expect(
      repeatedConceptDefects([
        part("2(a)", "Define electric potential at a point.", {
          root_question_number: "2",
        }),
        part("2(b)", "Which statement defines electric potential at a point?", {
          root_question_number: "2",
        }),
        part(
          "2(c)",
          "Calculate the electric potential 0.20 m from the charge.",
          { root_question_number: "2" },
        ),
      ]).map((d) => d.partId),
    ).toEqual(["2(b)"]);
  });
  it("preserves mathematical signs, exponents and unit case when comparing exact tasks/sentences", () => {
    expect(
      repeatedSentence(
        "The particle has a charge of +2 C. The particle has a charge of -2 C.",
      ),
    ).toBeNull();
    expect(
      repeatedConceptDefects([
        part(
          "1",
          "Calculate the charge stored on a capacitor of 80 mF at 10 V.",
        ),
        part(
          "2",
          "Calculate the charge stored on a capacitor of 80 MF at 10 V.",
        ),
        part("3", "Calculate the value of y when y = x^2 and x = 3."),
        part("4", "Calculate the value of y when y = x^3 and x = 3."),
      ]),
    ).toEqual([]);
  });
  it("flags identical complete task/data while allowing the same instruction in a different scenario", () => {
    const stem =
      "A coil has 200 turns and an area of 0.040 square metres. Calculate its flux linkage at 0.20 T.";
    expect(
      repeatedConceptDefects([
        part("1", stem),
        part("2", stem),
        part("3", stem.replace("200", "300")),
      ]).map((d) => d.partId),
    ).toEqual(["2"]);
  });
  it("distinguishes data with different physical axes or units, including SI prefix case", () => {
    expect(
      repeatedConceptDefects([
        part("1", "Use the graph to estimate the initial voltage.", {
          diagram_config: graph,
        }),
        part("2", "Use the graph to estimate the initial pressure.", {
          chart_data: { ...graph, yAxisLabel: "Pressure / Pa" },
        }),
        part("3", "Use the time readings measured in milliseconds.", {
          chart_data: { ...graph, xAxisLabel: "Time / ms" },
        }),
        part("4", "Read the conductance scale.", {
          chart_data: { ...graph, xAxisLabel: "Time / mS" },
        }),
      ]),
    ).toEqual([]);
  });
  it("checks every chart/table payload and includes headers and units in table identity", () => {
    const table = {
      type: "data_table",
      headers: ["Time", "Voltage"],
      units: ["s", "V"],
      rows: [
        [0, 12],
        [2, 7.3],
      ],
    };
    expect(
      repeatedConceptDefects([
        part("1", "Read the original measurements.", { table_data: table }),
        part("2", "Read different measurements.", {
          table_data: { ...table, units: ["s", "mV"] },
        }),
        part("3", "Read the pressure measurements.", {
          table_data: {
            ...table,
            headers: ["Time", "Pressure"],
            units: ["s", "Pa"],
          },
        }),
        part("4", "Read the same original measurements.", {
          chart_data: table,
        }),
      ]).map((d) => d.partId),
    ).toEqual(["4"]);
  });
  it("allows a parent group to share one dataset for distinct tasks", () => {
    expect(
      repeatedConceptDefects([
        part("2(a)", "Read the initial voltage.", {
          root_question_number: "2",
          diagram_config: graph,
        }),
        part("2(b)", "Calculate the discharge time constant.", {
          root_question_number: "2",
          diagram_config: graph,
        }),
      ]),
    ).toEqual([]);
  });
  it("uses a trusted plan, not model-assigned figure IDs, for intentional cross-parent sharing", () => {
    const rows = [
      part("1", "Read the initial voltage.", {
        diagram_config: { ...graph, resourceId: "same" },
      }),
      part("2", "Calculate its time constant.", {
        diagram_config: { ...graph, resourceId: "same" },
      }),
    ];
    expect(repeatedConceptDefects(rows)).toHaveLength(1);
    const plan = {
      parts: [
        { questionNumber: "1", resourceId: "reviewed-shared" },
        { questionNumber: "2", resourceId: "reviewed-shared" },
      ],
    } as any;
    expect(repeatedConceptDefects(rows, plan)).toEqual([]);
  });
  it("tracks all 50 scored parts with complete ordinary instructions and resource identities", () => {
    const rows = Array.from({ length: 50 }, (_, i) =>
      part(
        String(i + 1),
        `Original scenario ${i + 1}.\nCalculate the current at the specified instant and explain your choice of equation.`,
        i === 49 ? { chart_data: graph } : {},
      ),
    );
    const note = coveredTasksNote(rows);
    for (let n = 1; n <= 50; n++) expect(note).toContain(`Q${n}`);
    expect(note).toContain(
      "Calculate the current at the specified instant and explain your choice of equation.",
    );
    expect(note).toContain("graph#");
    expect(note).not.toContain("correct_answer");
    expect(note.length).toBeLessThan(21_000);
  });
  it("bounds exceptionally long task notes without losing the later task identifiers", () => {
    const rows = Array.from({ length: 50 }, (_, i) =>
      part(
        String(i + 1),
        "Explain " + "an independently checked mechanism ".repeat(500),
      ),
    );
    const note = coveredTasksNote(rows);
    expect(note).toContain("Q50:");
    expect(note).toContain("characters]");
    expect(note.length).toBeLessThan(21_000);
  });
  it("does not fingerprint generic context-only mentions as recall", () => {
    expect(
      recalledConcepts(
        "A circuit is described using the kinetic theory and a moderator. Calculate its output.",
      ),
    ).toEqual([]);
  });
  it("ignores a contextual definition, law or assumption when the actual task is a different application", () => {
    expect(
      recalledConcepts(
        "Using the definition of electric potential at a point, calculate the energy change.",
      ),
    ).toEqual([]);
    expect(
      recalledConcepts(
        "The kinetic theory assumes an ideal gas model. Calculate the rms speed at 400 K.",
      ),
    ).toEqual([]);
    expect(
      recalledConcepts(
        "Faraday's law states a relationship between induced emf and flux. Calculate the coil area.",
      ),
    ).toEqual([]);
    expect(
      recalledConcepts(
        "The function of a moderator is to slow neutrons. Calculate the number remaining after absorption.",
      ),
    ).toEqual([]);
  });
  it("tracks both explicit definitions in a multi-task part", () => {
    expect(
      repeatedConceptDefects([
        part(
          "1(a)",
          "Define electric potential at a point. Define gravitational potential at a point.",
        ),
        part(
          "20",
          "Which statement correctly defines gravitational potential at a point?",
        ),
      ]).map((d) => d.partId),
    ).toEqual(["20"]);
  });
});


describe("recall boundaries preserve physical applications", () => {
  const part=(question_number:string,question_text:string)=>({id:question_number,question_number,marks:2,question_text});
  it.each([
    "Explain which assumption of the ideal gas model is no longer valid at very high pressures.",
    "State which assumption of the ideal gas model fails at low temperatures.",
    "Explain a limitation of the kinetic theory assumption for a real gas.",
  ])("allows an ideal-gas application after a recall task: %s", application => {
    expect(repeatedConceptDefects([part("1","State two assumptions of the ideal gas model."),part("2",application)])).toEqual([]);
  });
  it("allows a Faraday scaling application stated without calculation",()=>{
    expect(repeatedConceptDefects([
      part("1","State Faraday's law."),
      part("2","State how doubling the number of turns affects induced emf using Faraday's law."),
    ])).toEqual([]);
  });
  it("still detects recall embedded alongside a different application",()=>{
    expect(repeatedConceptDefects([
      part("1","State Faraday's law."),
      part("2","State Faraday's law. Calculate the induced emf for a flux change of 0.040 Wb in 0.020 s."),
    ]).map(defect=>defect.partId)).toEqual(["2"]);
  });
});
