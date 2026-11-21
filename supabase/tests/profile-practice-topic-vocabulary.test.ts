// @vitest-environment node
import { build } from "esbuild";
import vm from "node:vm";
import { z } from "zod";
import { beforeAll, describe, expect, it } from "vitest";
import { prepareProfileSave } from "../functions/_shared/profile-builder-service";
import { evidenceFingerprint } from "../functions/_shared/profile-evidence";
import { snapshotTemplate } from "../functions/_shared/profile-template-context";
import { checksum } from "../functions/_shared/profile-template";
import { ownerEvidence, syllabus, templateFixture } from "./profile-builder-fixtures";
import { paper2Snapshot } from "./aqa-paper2-fixtures";

const leaves = ["1.1.1 Market research", "1.1.2 Market positioning", "1.1.3 Price elasticity of demand"];
const catalogueTopics = ["Marketing", "People"];
let code: string;

beforeAll(async () => {
  const bundle = await build({
    entryPoints: ["supabase/functions/_shared/practice-generation.ts"],
    bundle: true, write: false, platform: "node", format: "cjs", logLevel: "silent",
    plugins: [{ name: "controlled-practice-transport", setup(builder) {
      builder.onResolve({ filter: /^https:\/\// }, ({ path }) => ({ path, namespace: "fixture" }));
      builder.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({
        loader: "js",
        contents: path.includes("supabase-js") ? "export const createClient=()=>globalThis.client;"
          : path.includes("zod@") ? "export const z=globalThis.z;"
          : path.includes("pdfjs") ? 'export const getDocument=()=>{throw Error("No PDF transport in this fixture")};'
          : (() => { throw Error(`Unexpected external module: ${path}`); })(),
      }));
    } }],
  });
  code = bundle.outputFiles[0].text;
});

async function savedContext() {
  const template = templateFixture(), evidence = await ownerEvidence();
  template.identity = { ...template.identity, subject: "Business", course: "BUS101" };
  template.mode = "full_mock";
  template.topics = [...leaves];
  // The third saved leaf deliberately has no part in the paper layout.
  template.sections[0].groups[0].parts.forEach((part, index) => { part.topic = leaves[index]; });
  const text = syllabus.replace("BIO101", "BUS101").replace("Cells and Enzymes", leaves.join(" and "));
  evidence.identity = template.identity;
  evidence.facts.topics = [...leaves];
  evidence.documents[0].checksum = await checksum(text);
  evidence.documents[0].locations[0].text = text;
  evidence.claims.find((claim) => claim.field === "topics")!.quote = leaves.join(" and ");
  evidence.topicDetails = leaves.map((topic) => ({
    topic, path: ["Marketing"], sources: [{ documentId: evidence.documents[0].id, page: 1, text }],
  }));
  const saved = prepareProfileSave({
    proposalVersion: 1, promptVersion: 1, origin: "source_backed_ai", template,
    evidence, evidenceVersion: await evidenceFingerprint(evidence), presetId: null, profileSettings: null,
  }, template);
  const snapshot = snapshotTemplate({ ...saved.settings, profile_template: saved.context })!;
  return {
    context_version: 2, resolved_by: "server", profile_id: "profile", subject_name: "Business",
    exam_board: template.identity.organisation, educational_tier: template.identity.qualification,
    assessment_tier: "not_tiered", course_id: snapshot.plan!.courseId, paper_id: "Final",
    component_code: "Final", paper_contract: null, profile_template: snapshot,
  };
}

function questions(topic: string, biology = false) {
  return [
    {
      question_number: "1", question_type: "short_answer", marks: 2, subtopic: topic, difficulty_level: "easy",
      question_text: biology ? "Describe how insulin lowers blood glucose concentration." : "Explain how market research can reduce uncertainty for a business.",
      correct_answer: biology ? "Insulin causes cells to absorb glucose and promotes conversion of glucose to glycogen."
        : "Research identifies customer needs. The business can use this evidence when choosing a product to offer.",
    },
    {
      question_number: "2", question_type: "short_answer", marks: 2, subtopic: topic, difficulty_level: "medium",
      question_text: biology ? "Explain why negative feedback is needed to control blood glucose concentration." : "Explain one limitation of a small customer survey for a business decision.",
      correct_answer: biology ? "Negative feedback detects changes from the normal concentration and reverses them to maintain stable conditions."
        : "A small sample may not represent all customers. Demand estimates may therefore be unreliable.",
    },
  ];
}

async function generate(options: {
  requested?: string[]; returnedTopic?: string; invalidAttempts?: number; legacy?: boolean;
} = {}) {
  const context: Record<string, any> = options.legacy ? { ...paper2Snapshot("higher", "short_practice"), profile_id: "profile" } : await savedContext();
  const before = structuredClone(context);
  const requested = options.requested ?? [...leaves];
  const set: Record<string, any> = {
    id: "set", user_id: "owner", profile_id: "profile", subject_id: options.legacy ? "Biology" : "Business",
    exam_board: context.exam_board, educational_tier: context.educational_tier, generation_context: context,
    question_count: 2, question_format: "written_only", difficulty_level: "mixed", notes: "", subtopics: requested,
  };
  const calls: any[] = [], writes: Array<{ table: string; op: string; value: any }> = [], reads: string[] = [], errors: any[] = [];
  const client = { from(table: string) {
    let op = "select", value: any;
    const query: Record<string, any> = {};
    for (const method of ["select", "insert", "update", "upsert", "delete", "eq", "neq", "in", "ilike", "gt", "order", "limit", "single", "maybeSingle"])
      query[method] = (...args: any[]) => {
        if (["insert", "update", "upsert", "delete"].includes(method)) { op = method; value = args[0]; }
        return query;
      };
    query.then = (resolve: any, reject: any) => {
      let data: any = [];
      if (op === "select") {
        reads.push(table);
        if (table === "user_preferences") data = { curriculum_region: "england" };
        if (table === "student_cache_slots" || table === "question_generation_cache") data = null;
        if (table === "subject_subtopics") data = (options.legacy ? ["Homeostasis and response"] : catalogueTopics).map((subtopic) => ({ subtopic }));
      } else {
        writes.push({ table, op, value: structuredClone(value) });
        if (table === "practice_question_sets" && op === "update") Object.assign(set, value);
      }
      return Promise.resolve({ data, error: null }).then(resolve, reject);
    };
    return query;
  } };
  const runtime = {
    module: { exports: {} as { generateQuestionsInBackground: (setId: string, userId: string, row: unknown) => Promise<void> } },
    z, client, Request, Response, Headers, URL, TextEncoder, TextDecoder, crypto, structuredClone,
    setTimeout, clearTimeout, AbortController, AbortSignal,
    console: { log() {}, info() {}, warn() {}, error(...args: any[]) { errors.push(args); } },
    Deno: { env: { get: () => "fixture-only" } },
    fetch: async (url: string, request: { body: string }) => {
      expect(url).toBe("https://ai.gateway.lovable.dev/v1/chat/completions");
      const body = JSON.parse(request.body);
      calls.push(body);
      const rows = calls.length <= (options.invalidAttempts ?? 0) ? []
        : questions(options.returnedTopic ?? requested[0] ?? leaves[0], options.legacy);
      return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: {
        tool_calls: [{ function: { name: "generate_practice_questions", arguments: JSON.stringify({ questions: rows }) } }],
      } }] }));
    },
  };
  vm.runInNewContext(code, runtime);
  await runtime.module.exports.generateQuestionsInBackground("set", "owner", set);
  expect(context).toEqual(before);
  const rows = writes.find((write) => write.table === "practice_questions" && write.op === "insert")?.value;
  return { set, calls, writes, reads, rows, errors, context };
}

function vocabulary(call: any): string[] {
  const prompt = call.messages.map((message: any) => message.content).join("\n");
  const match = prompt.match(/TOPIC TAG CONTROLLED VOCABULARY \(CRITICAL\):[\s\S]*?\n(\[[^\n]*\])\n/);
  expect(match, "the actual provider request must contain the saved leaf vocabulary").not.toBeNull();
  return JSON.parse(match![1]);
}

describe("generic profile practice topic vocabulary through real generation", () => {
  it("uses the complete saved leaf pool instead of catalogue labels or sampled paper parts", async () => {
    const result = await generate({ requested: [], returnedTopic: leaves[2] });
    expect(result.set.extraction_status, JSON.stringify(result.errors)).toBe("completed");
    expect(vocabulary(result.calls[0])).toEqual(leaves);
    expect(result.reads).not.toContain("subject_subtopics");
    expect(result.context.profile_template!.plan!.parts.some((part) => part.topic === leaves[2])).toBe(false);
    expect(result.context.profile_template!.context.evidence).not.toHaveProperty("topicDetails");
    expect(result.rows.map((row: any) => row.subtopic)).toEqual([leaves[2], leaves[2]]);
    expect(result.rows.every((row: any) => row.profile_id === "profile" && row.set_id === "set")).toBe(true);
  });

  it("narrows the provider vocabulary to a requested saved leaf, retaining the original label", async () => {
    const result = await generate({ requested: [leaves[2].toLowerCase()], returnedTopic: leaves[2] });
    expect(result.set.extraction_status, JSON.stringify(result.errors)).toBe("completed");
    expect(vocabulary(result.calls[0])).toEqual([leaves[2]]);
    expect(result.rows.map((row: any) => row.subtopic)).toEqual([leaves[2], leaves[2]]);
  });

  it.each([{ requested: ["PED"] }, { requested: [leaves[0], "PED"] }])("keeps free-text requests inside the full saved scope: $requested", async ({ requested }) => {
    const result = await generate({ requested, returnedTopic: leaves[2] });
    expect(result.set.extraction_status, JSON.stringify(result.errors)).toBe("completed");
    expect(vocabulary(result.calls[0])).toEqual(leaves);
  });

  it.each([
    [leaves[0], "outside the selected quiz topics"],
    [`${leaves[2]} extension`, "outside the saved topic scope"],
    [catalogueTopics[0], "outside the saved topic scope"],
  ])("rejects unsupported generated tag %s before inserting rows", async (returnedTopic, error) => {
    const result = await generate({ requested: [leaves[2]], returnedTopic });
    expect(vocabulary(result.calls[0])).toEqual([leaves[2]]);
    expect(result.set.extraction_status).toBe("failed");
    expect(result.set.extraction_error).toContain(error);
    expect(result.rows).toBeUndefined();
  });

  it("retains the authoritative vocabulary through the simplified third provider attempt", async () => {
    const result = await generate({ requested: [leaves[2]], returnedTopic: leaves[2], invalidAttempts: 2 });
    expect(result.set.extraction_status, JSON.stringify(result.errors)).toBe("completed");
    expect(result.calls).toHaveLength(3);
    for (const call of result.calls) expect(vocabulary(call)).toEqual([leaves[2]]);
    expect(result.rows.map((row: any) => row.subtopic)).toEqual([leaves[2], leaves[2]]);
  });

  it("preserves the subject_subtopics lookup and vocabulary for a legacy reviewed course", async () => {
    const topic = "Homeostasis and response";
    const result = await generate({ legacy: true, requested: [topic], returnedTopic: topic });
    expect(result.set.extraction_status, JSON.stringify(result.errors)).toBe("completed");
    expect(result.reads).toContain("subject_subtopics");
    const prompt = result.calls[0].messages.map((message: any) => message.content).join("\n");
    expect(prompt).toContain(`do not change capitalisation:\n${topic}\n`);
    expect(result.rows.map((row: any) => row.subtopic)).toEqual([topic, topic]);
  });
});
