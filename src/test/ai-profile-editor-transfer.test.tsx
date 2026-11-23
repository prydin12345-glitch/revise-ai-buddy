import { webcrypto } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ExamProfileBuilder } from "@/components/profiles/ExamProfileBuilder";
import { invokeProfileBuilder, rememberPendingBuilderJob } from "@/lib/profile-builder-client";
import { builderInitialIdentity } from "@/lib/profile-builder-resolution";
import { buildHandlerFixture, handlerRuntime } from "../../supabase/tests/profile-builder-handler-runtime";
import { memoryJobStore, ownerKey } from "../../supabase/tests/profile-builder-jobs-fixtures";
import { ownerEvidence } from "../../supabase/tests/profile-builder-fixtures";
import { canonical, checksum, type ProfileTemplate } from "../../supabase/functions/_shared/profile-template";
import { fingerprint } from "../../supabase/functions/_shared/profile-fingerprint";
import type { BuilderProposal } from "../../supabase/functions/_shared/profile-builder-service";

const transport = vi.hoisted(() => {
  // esbuild and Node's TextEncoder must share the Node typed-array realm in jsdom.
  vi.stubGlobal("Uint8Array", Object.getPrototypeOf(Buffer.prototype).constructor);
  return { invoke: vi.fn(), close: vi.fn() };
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  functions: { invoke: transport.invoke },
  auth: { getSession: async () => ({ data: { session: { user: { id: "transfer-owner" } } } }) },
} }));

const owner = "transfer-owner";
const topics = ["1.1.1 The market", "1.1.2 Market research", "4.1.1 Growing economies"];
const roots = ["Theme 1: Marketing and people", "Theme 4: Global business"];
const formats = "Multiple choice questions, short answer questions and extended response questions.";
const cover = [
  "Pearson Edexcel A-level Business (9BS0)", "Version 2026",
  "Paper 1 — Marketing and people (9BS0/01)",
  "12 marks; 37 minutes. Questions are drawn from Themes 1 and 4.",
  formats, "Answer all questions. No calculator allowed.",
].join("\n");
const sourceText = [
  cover, roots[0], "1.1 Meeting customer needs", topics[0],
  "a) Mass and niche markets", "b) Market size and market share",
  "c) Brands and dynamic markets, including uncertainty.",
  topics[1], "a) Primary and secondary research", "b) Qualitative and quantitative evidence",
  roots[1], "4.1 Globalisation", topics[2],
  "a) Gross Domestic Product (GDP)", "b) The growth of international trade, including its final qualification.",
].join("\n");
const alias = "Markets in my own words";
const privateNotes = "Private reminder: draw my own market map before Friday.";
const json = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

/** Two deterministic provider replies, with every request handled in the bundled VM. */
function runtime(calculator: "not_allowed" | "unknown" = "not_allowed") {
  const memory = memoryJobStore();
  const documentText = calculator === "unknown" ? sourceText.replace(" No calculator allowed.", "") : sourceText;
  const coverText = calculator === "unknown" ? cover.replace(" No calculator allowed.", "") : cover;
  let modelDraft: ProfileTemplate | undefined;
  const extraction = async (payload: any) => {
    const evidence = await ownerEvidence();
    evidence.identity = { ...payload.identity, course: "9BS0", specificationVersion: "2026", tier: null };
    evidence.documents[0] = {
      ...evidence.documents[0], id: payload.documents[0].id, checksum: payload.documents[0].checksum,
      title: "Synthetic detailed Business assessment", version: "2026", applicableCohort: "Synthetic 2026 cohort",
      locations: [
        { id: "brief", page: 1, section: "Assessment", text: coverText },
        ...roots.map((root, index) => ({ id: `root-${index}`, page: 1, section: "Content", text: root })),
      ],
    };
    evidence.facts = { ...evidence.facts, marks: 12, durationMinutes: 37, topics: roots,
      tier: null, calculator, formats: ["mcq_single", "short_answer", "long_form"] };
    evidence.claims = [
      ["marks", "12 marks"], ["durationMinutes", "37 minutes"], ["calculator", "No calculator allowed"],
      ["formats", formats], ["selection", "Answer all questions"],
    ].filter(([field]) => calculator !== "unknown" || field !== "calculator")
      .map(([field, quote]) => ({ field, quote, documentId: payload.documents[0].id, locationId: "brief", rule: "mandatory" as const }));
    evidence.claims.push(...roots.map((quote, index) => ({
      field: "topics", quote, documentId: payload.documents[0].id, locationId: `root-${index}`, rule: "mandatory" as const,
    })));
    return { evidence, identityClaims: [
      { field: "course", quote: "9BS0" }, { field: "specificationVersion", quote: "Version 2026" },
    ].map(claim => ({ ...claim, documentId: payload.documents[0].id, locationId: "brief" })) };
  };
  const draft = (payload: any): ProfileTemplate => {
    expect(payload.evidence.facts.topics).toEqual(topics);
    modelDraft = {
      schemaVersion: 1, identity: payload.identity, mode: payload.mode, marks: 12, durationMinutes: 37,
      topics: [...topics], calculator,
      sections: [
        { id: "section-core-original", title: "Core knowledge and analysis", groups: [
          { id: "group-market-original", parts: [
            { id: "market-mcq-original", topic: topics[0], marks: 1, response: "mcq_single", demand: "AO1", resource: "none" },
            { id: "research-table-original", topic: topics[1], marks: 3, response: "short_answer", demand: "AO2", resource: "data_table" },
          ] },
          { id: "group-global-original", parts: [
            { id: "global-graph-original", topic: topics[2], marks: 3, response: "short_answer", demand: "AO3", resource: "graph" },
          ] },
        ] },
        { id: "section-evaluation-original", title: "Extended evaluation", groups: [
          { id: "group-evaluation-original", parts: [
            { id: "market-evaluation-original", topic: topics[0], marks: 5, response: "long_form", demand: "AO3", resource: "none" },
          ] },
        ] },
      ],
      warnings: ["Synthetic owner-supplied source; no official approval is claimed.", "Keep the final source qualification intact."],
      designDecisions: ["Preserve the linked multiple-choice and table parts.", "Assess AO3 through both graph analysis and extended evaluation."],
    };
    return json(modelDraft);
  };
  const r = handlerRuntime([extraction, draft], owner, async (name, args) => {
    const record = () => ({ ...memory.records.get(ownerKey(args.p_owner, args.p_request))!, leaseToken: args.p_token, revision: args.p_revision });
    const change = () => ({ stage: args.p_stage, data: args.p_checkpoint, elapsedMs: args.p_elapsed_ms, ...(args.p_proposal ? { proposal: args.p_proposal } : {}) });
    switch (name) {
      case "read_profile_builder_job": return memory.store.load(args.p_owner, args.p_request);
      case "create_profile_builder_job": return memory.store.create(args.p_owner, args.p_request, args.p_hash, args.p_source_key, args.p_checkpoint, args.p_stage, args.p_elapsed_ms);
      case "cached_profile_builder_source": return memory.store.cached(args.p_owner, args.p_source_key);
      case "acquire_profile_builder_job": return memory.store.acquire(args.p_owner, args.p_request);
      case "commit_profile_builder_job": return memory.store.commit(record(), change());
      case "reserve_profile_builder_job": await memory.store.reserve(record()); return null;
      case "begin_profile_builder_job_call": await memory.store.beginCall(record()); return null;
      case "finish_profile_builder_job_call": {
        const next = await memory.store.finishCall(record(), change(), args.p_usage);
        if (next.stage === "complete") r.receipts.set(args.p_owner + args.p_request, { state: "complete", result: args.p_proposal });
        return next;
      }
      default: throw Error(`Unexpected owned job RPC: ${name}`);
    }
  });
  const calls: Array<{ input: any; result: any }> = [];
  transport.invoke.mockImplementation(async (name, { body }) => {
    expect(name).toBe("profile-builder");
    const result = await r.call(body);
    calls.push({ input: json(body), result: json(result) });
    return result.status < 400 ? { data: result.body, error: null } : {
      data: null, error: { name: "FunctionsHttpError", context: new Response(JSON.stringify(result.body), { status: result.status }) },
    };
  });
  return { ...r, memory, calls, documentText, get modelDraft() { return modelDraft!; } };
}

type Runtime = ReturnType<typeof runtime>;
const props = {
  open: true, accountId: owner, onOpenChange: transport.close, onManual: vi.fn(),
  subjectName: "Business", examBoard: "Edexcel", educationalLevel: "level3", curriculumRegion: "GB",
};

async function generateIntoReview(r: Runtime) {
  const requestId = crypto.randomUUID();
  const identity = { ...builderInitialIdentity({ subject: "Business", board: "Edexcel", level: "level3", region: "GB" }),
    course: "9BS0", component: "Paper 1", specificationVersion: "", tier: null };
  await invokeProfileBuilder({ action: "prepare_source", requestId, identity,
    specificationVersionIntent: "source", mode: "full_mock",
    uploads: [{ contentType: "text/plain", base64: Buffer.from(r.documentText).toString("base64") }],
  });
  const ready = (await invokeProfileBuilder({ action: "advance_source", jobId: requestId })).job!;
  expect(ready, JSON.stringify(ready)).toMatchObject({ stage: "ready", identity: { course: "9BS0", component: "9BS0/01", specificationVersion: "2026", tier: "not_tiered" } });
  expect(r.provider).toHaveLength(1);
  await rememberPendingBuilderJob("Business", requestId);
  const view = render(<ExamProfileBuilder {...props} />);
  fireEvent.click(await screen.findByRole("button", { name: "Resume request" }));
  fireEvent.click(await screen.findByRole("button", { name: "Yes, build it" }));
  await screen.findByRole("region", { name: "AI exam profile editor" });
  await waitFor(() => expect(screen.getByRole("button", { name: "Save profile" })).toBeEnabled());
  const receipt = r.receipts.get(owner + requestId)!;
  const proposal = json(receipt.result as BuilderProposal);
  expect(receipt.state).toBe("complete");
  expect(proposal.origin).toBe("source_backed_ai");
  expect(proposal.template).toEqual(r.modelDraft);
  expect(proposal.template.topics).toEqual(topics);
  expect(proposal.evidence!.topicDetails).toHaveLength(3);
  expect(proposal.evidenceVersion).toBe(fingerprint(canonical(proposal.evidence)));
  expect(proposal.evidence!.documents[0].checksum).toBe(await checksum(r.documentText));
  expect(proposal.evidence!.topicDetails!.flatMap(detail => detail.sources.map(source => source.page))).toEqual([1, 1, 1]);
  expect(JSON.stringify(proposal.evidence!.topicDetails)).toContain("including its final qualification.");
  expect(r.provider).toHaveLength(2);
  expect(r.memory.reservations).toBe(1);
  return { view, proposal, requestId };
}

function tab(name: string) {
  const trigger = screen.getByRole("tab", { name });
  fireEvent.click(trigger);
  expect(trigger).toHaveAttribute("aria-selected", "true");
}

function browseWithoutRequests(r: Runtime) {
  const before = transport.invoke.mock.calls.length;
  tab("Exam settings");
  expect(screen.getByLabelText("Time limit (minutes)")).toHaveValue(37);
  expect(screen.getByLabelText("Total marks")).toHaveValue(12);
  tab("Syllabus & source");
  expect(screen.getByText("Synthetic detailed Business assessment")).toBeVisible();
  expect(screen.getByText(r.modelDraft.warnings[0])).toBeVisible();
  tab("Subtopics 3");
  fireEvent.change(screen.getByRole("searchbox", { name: "Search subtopics and source outcomes" }), { target: { value: "international trade" } });
  expect(screen.getByRole("article", { name: "Growing economies" })).toBeVisible();
  const filter = screen.getByRole("combobox", { name: "Filter by syllabus group" });
  const option = within(filter).getByRole("option", { name: /Theme 1/ }) as HTMLOptionElement;
  fireEvent.change(filter, { target: { value: option.value } });
  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  expect(screen.getAllByRole("article")).toHaveLength(3);
  expect(transport.invoke).toHaveBeenCalledTimes(before);
  expect(r.provider).toHaveLength(2);
}

function saveInput(r: Runtime) {
  return r.calls.filter(call => call.input.action === "save").slice(-1)[0]!;
}

function expectExactSaved(saved: any, proposal: BuilderProposal, template = proposal.template) {
  expect(saved.user_id).toBe(owner);
  expect(saved.topics).toEqual(template.topics);
  expect(saved.calculator_policy).toBe(template.calculator);
  expect(saved.profile_template).toMatchObject({
    resolved_by: "server", version: 1, origin: proposal.origin,
    evidenceVersion: proposal.evidenceVersion, presetId: proposal.presetId,
  });
  expect(saved.profile_template.template).toEqual(template);
  expect(saved.profile_template.evidence).toEqual(proposal.evidence);
  expect(saved.profile_template.evidenceVersion).toBe(fingerprint(canonical(saved.profile_template.evidence)));
}

async function save(r: Runtime, name: "Save profile" | "Save changes") {
  fireEvent.click(screen.getByRole("button", { name }));
  await waitFor(() => expect(transport.close).toHaveBeenCalledWith(false));
  expect(saveInput(r).result.status).toBe(200);
  return json(saveInput(r).result.body.profile);
}

beforeAll(async () => {
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
  Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: vi.fn() });
  await buildHandlerFixture();
});
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); });
afterAll(() => { vi.unstubAllGlobals(); });

describe("actual AI profile editor → client → handler → owned save → reopen", () => {
  it.each(["not_allowed", "unknown"] as const)("transfers every generated template and source field unchanged through save/reopen with calculator %s", async calculator => {
    const r = runtime(calculator);
    const { view, proposal, requestId } = await generateIntoReview(r);
    browseWithoutRequests(r);
    const saved = await save(r, "Save profile");
    expect(saveInput(r).input).toMatchObject({ action: "save", proposalId: requestId, subjectName: "Business", template: proposal.template });
    expectExactSaved(saved, proposal);
    expect(r.profiles.size).toBe(1);
    expect(r.profiles.get(saved.id)).toEqual(saved);
    expect(saved.profile_template.proposalId).toBe(requestId);
    view.unmount();

    transport.close.mockClear();
    const before = transport.invoke.mock.calls.length;
    render(<ExamProfileBuilder {...props} initialProfile={json(saved)} />);
    await screen.findByRole("region", { name: "AI exam profile editor" });
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    browseWithoutRequests(r);
    expect(transport.invoke).toHaveBeenCalledTimes(before);
    expectExactSaved(r.profiles.get(saved.id), proposal);
    expect(r.provider).toHaveLength(2);
  });

  it("persists only alias/private-note metadata, restores a removed topic with Undo, and retains the complete draft after an owned RPC save failure", async () => {
    const r = runtime();
    const generated = await generateIntoReview(r);
    const saved = await save(r, "Save profile");
    generated.view.unmount();
    transport.close.mockClear();
    const view = render(<ExamProfileBuilder {...props} initialProfile={json(saved)} />);
    await screen.findByRole("region", { name: "AI exam profile editor" });
    const before = transport.invoke.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Edit The market" }));
    fireEvent.change(screen.getByLabelText("Subtopic name"), { target: { value: alias } });
    fireEvent.change(screen.getByLabelText(/Your notes/), { target: { value: privateNotes } });
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.getByRole("article", { name: alias })).toBeVisible();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: `Remove ${alias}` }));
    expect(screen.queryByRole("article", { name: alias })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Undo last topic change" }));
    expect(screen.getByRole("article", { name: alias })).toBeVisible();
    expect(screen.getAllByRole("article")).toHaveLength(3);
    expect(transport.invoke).toHaveBeenCalledTimes(before);

    const edited = { ...json(generated.proposal.template), topicEdits: [{ topic: topics[0], label: alias, notes: privateNotes }] };
    vi.spyOn(r.profiles, "set").mockImplementationOnce(() => { throw Error("Synthetic owned RPC save unavailable"); });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await screen.findByRole("alert");
    await waitFor(() => expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled());
    expect(saveInput(r).result.status).toBeGreaterThanOrEqual(400);
    expect(saveInput(r).input.template).toEqual(edited);
    expect(transport.close).not.toHaveBeenCalled();
    expect(screen.getByRole("article", { name: alias })).toBeVisible();
    expectExactSaved(r.profiles.get(saved.id), generated.proposal);

    const updated = await save(r, "Save changes");
    expect(saveInput(r).input.template).toEqual(edited);
    expect(saveInput(r).input.profileId).toBe(saved.id);
    expect(updated.id).toBe(saved.id);
    expectExactSaved(updated, generated.proposal, edited);
    expect(updated.profile_template.template.topics).toEqual(generated.proposal.template.topics);
    expect(updated.profile_template.template.sections).toEqual(generated.proposal.template.sections);
    expect(r.profiles.size).toBe(1);
    view.unmount();

    const beforeReopen = transport.invoke.mock.calls.length;
    render(<ExamProfileBuilder {...props} initialProfile={json(updated)} />);
    await screen.findByRole("article", { name: alias });
    fireEvent.click(screen.getByRole("button", { name: `Edit ${alias}` }));
    expect(screen.getByLabelText("Subtopic name")).toHaveValue(alias);
    expect(screen.getByLabelText(/Your notes/)).toHaveValue(privateNotes);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    expect(transport.invoke).toHaveBeenCalledTimes(beforeReopen);
    expect(r.provider).toHaveLength(2);
    expect(JSON.stringify(r.provider)).not.toContain(privateNotes);
    expect(JSON.stringify(r.provider)).not.toContain(alias);
    expectExactSaved(r.profiles.get(saved.id), generated.proposal, edited);
  });
});
