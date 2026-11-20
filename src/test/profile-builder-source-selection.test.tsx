import { webcrypto } from "node:crypto";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ExamProfileBuilder } from "@/components/profiles/ExamProfileBuilder";
import { WorkspaceContext, WorkspaceStore } from "@/hooks/use-workspace-session";
import { buildHandlerFixture, handlerRuntime } from "../../supabase/tests/profile-builder-handler-runtime";
import { memoryJobStore, ownerKey } from "../../supabase/tests/profile-builder-jobs-fixtures";
import { ownerEvidence } from "../../supabase/tests/profile-builder-fixtures";

const { invoke, NativeUint8Array } = vi.hoisted(() => {
  // esbuild and WebCrypto run in Node while the form runs in jsdom. Use the
  // encoder's native byte-array realm at this test boundary, not a DOM wrapper.
  const NativeUint8Array = new TextEncoder().encode("").constructor;
  vi.stubGlobal("Uint8Array", NativeUint8Array);
  return { invoke: vi.fn(), NativeUint8Array };
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));
beforeAll(buildHandlerFixture);
beforeEach(() => {
  vi.stubGlobal("Uint8Array", NativeUint8Array);
  vi.stubGlobal("crypto", webcrypto);
  invoke.mockReset();
  localStorage.clear();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const owner = "synthetic-selection-owner";
const titles = ["Marketing, people and global businesses", "Business activities, decisions and strategy", "Investigating business in a competitive environment"];
// Synthetic facts, deliberately distinct from the official PDF. This regression
// exercises the real form/inspection/request/handler path, not model quality.
const text = ["Pearson Edexcel A-level Business (9BS0)", "Version 2026",
  ...titles.map((title, i) => `Paper ${i + 1}: ${title} (9BS0/0${i + 1})\n6 marks; 30 minutes.\nTopics: Marketing and People.\nShort structured answers.\nAnswer all questions. No calculator allowed.`),
].join("\n");

function runtime() {
  const memory = memoryJobStore();
  const extraction = async (payload: any) => {
    const evidence = await ownerEvidence();
    const source = payload.documents[0], selectedText = source.pages.map((page: any) => page.text).join("\n");
    const number = Number(payload.identity.component.slice(-1));
    const assessment = source.pages.find((page: any) => page.text.includes(`9BS0/0${number}`));
    const cover = source.pages.find((page: any) => page.text.includes("Version 2026"));
    expect(selectedText).toContain(`9BS0/0${number}`);
    for (const sibling of [1, 2, 3].filter(n => n !== number)) expect(selectedText).not.toContain(`9BS0/0${sibling}`);
    evidence.identity = { ...payload.identity, course: "9BS0", specificationVersion: "2026", tier: null,
      component: `Paper ${number}`, organisation: "Edexcel", country: "UK", subject: "Business" };
    evidence.documents[0] = { ...evidence.documents[0], id: source.id, checksum: source.checksum,
      title: "Synthetic selected Business assessment", version: "2026",
      // Cover and paper may be separate spans on the same physical page.
      // Keep both literal; joining them must not create a fabricated quote.
      locations: [{ id: "brief", page: 1, section: "Assessment", text: assessment.text },
        ...(cover === assessment ? [] : [{ id: "cover", page: 1, section: "Source cover", text: cover.text }])],
    };
    evidence.facts.topics = ["Marketing", "People"];
    evidence.facts.tier = null;
    evidence.claims = evidence.claims.filter(claim => claim.field !== "tier").map(claim => ({
      ...claim, documentId: source.id, quote: claim.field === "topics" ? "Marketing and People" : claim.quote,
    }));
    return { evidence, identityClaims: [{ field: "specificationVersion", quote: "Version 2026", documentId: source.id, locationId: cover === assessment ? "brief" : "cover" }] };
  };
  const r = handlerRuntime([extraction], owner, async (name, args) => {
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
      case "finish_profile_builder_job_call": return memory.store.finishCall(record(), change(), args.p_usage);
      default: throw Error(`Unexpected job RPC ${name}`);
    }
  });
  invoke.mockImplementation(async (name, { body }) => {
    expect(name).toBe("profile-builder");
    const result = await r.call(body);
    return result.status < 400 ? { data: result.body, error: null } : {
      data: null, error: { name: "FunctionsHttpError", context: new Response(JSON.stringify(result.body), { status: result.status }) },
    };
  });
  return { ...r, memory };
}

async function upload(subject = "Business", courseId?: string) {
  const r = runtime(), store = new WorkspaceStore(owner);
  render(<WorkspaceContext.Provider value={{ ownerId: owner, ready: true, store }}>
    <ExamProfileBuilder open onOpenChange={vi.fn()} onManual={vi.fn()} accountId={owner}
      subjectName={subject} examBoard="Edexcel" educationalLevel="level3" curriculumRegion="GB" courseId={courseId} />
  </WorkspaceContext.Provider>);
  expect(screen.getByLabelText("Course / specification code")).toHaveValue(courseId ?? "9BS0");
  expect(screen.getByText("Full paper profile.")).toBeVisible();
  expect(invoke).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Upload syllabus" }));
  const bytes = new TextEncoder().encode(text);
  fireEvent.change(screen.getByLabelText("Syllabus or assessment brief"), { target: { files: [{
    name: "synthetic-business.txt", type: "text/plain", size: bytes.length, arrayBuffer: async () => bytes.buffer,
  }] } });
  await screen.findByRole("option", { name: `Paper 1 — ${titles[0]}` });
  return r;
}

it.each([0, 1, 2])("the actual form submits reviewed paper %s and binds its owned source, retaining upload and known tier", async index => {
  const r = await upload(index === 1 ? "Business Studies" : "Business");
  const option = screen.getByRole("option", { name: `Paper ${index + 1} — ${titles[index]}` }) as HTMLOptionElement;
  const selectedId = option.value;
  expect(selectedId).toBe(`paper_${index + 1}`);
  fireEvent.change(screen.getByRole("combobox", { name: "Paper" }), { target: { value: selectedId } });
  await waitFor(() => expect(screen.getByLabelText("Course / specification code")).toHaveValue("9BS0"));
  await waitFor(() => expect(screen.queryByText("Finding assessment names in your attached files…")).not.toBeInTheDocument());
  expect(screen.getByRole("combobox", { name: "Paper" })).toHaveValue(selectedId);
  expect(screen.getByLabelText("Paper / component code")).toHaveValue(`9BS0/0${index + 1}`);
  // A disabled placeholder must also be a no-op if a scripted event reaches it.
  const placeholder = within(screen.getByRole("combobox", { name: "Paper" })).getByRole("option", { name: "Choose your paper" });
  expect(placeholder).toBeDisabled();
  fireEvent.change(screen.getByRole("combobox", { name: "Paper" }), { target: { value: "" } });
  expect(screen.getByRole("combobox", { name: "Paper" })).toHaveValue(selectedId);
  await waitFor(() => expect(screen.getByRole("button", { name: "Read syllabus" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Read syllabus" }));
  await waitFor(() => expect([...r.memory.records.values()][0]?.stage).toMatch(/ready|failed|needs_details/));
  const record = [...r.memory.records.values()][0];
  expect(record.stage, JSON.stringify({ needs: record.data.needs, issues: record.data.validationIssues })).toBe("ready");
  await screen.findByRole("button", { name: "Yes, build it" });
  const prepare = invoke.mock.calls.map(call => call[1].body).find(body => body.action === "prepare_source");
  expect(prepare).toMatchObject({ mode: "full_mock", identity: { course: "9BS0", component: `9BS0/0${index + 1}`, tier: "not_tiered" } });
  // The catalogue option is a UI choice. Only the owned upload may supply a
  // source assessment ID; the handler binds it from the exact component code.
  expect(prepare).not.toHaveProperty("selectedAssessmentId");
  expect(record.data.selectedAssessmentId).toBe(record.data.sourceAssessment?.id);
  expect(record.data.selectedAssessmentId).toEqual(expect.any(String));
  expect(record.data.selectedAssessmentId).not.toBe(selectedId);
  expect(record.data.sourceAssessment).toMatchObject({ componentCode: `9BS0/0${index + 1}` });
  expect(record.data.sourceAssessment?.references).toEqual(expect.arrayContaining([
    expect.objectContaining({ documentId: record.data.documents[0].id, checksum: record.data.documents[0].checksum }),
  ]));
  expect(prepare.uploads).toHaveLength(1);
  expect(atob(prepare.uploads[0].base64)).toBe(text);
  expect(screen.getByText("synthetic-business.txt")).toBeVisible();
  expect(screen.queryByText(/The selected assessment could not be verified/)).not.toBeInTheDocument();
  expect([...r.memory.records.values()][0]).toMatchObject({ stage: "ready", data: { mode: "full_mock", identity: { course: "9BS0", component: `9BS0/0${index + 1}`, tier: "not_tiered" } } });
  expect(r.provider).toHaveLength(1);
});

it("keeps an explicitly entered course constraint and does not turn a manual reference into a source course", async () => {
  await upload();
  fireEvent.change(screen.getByLabelText("Course / specification code"), { target: { value: "CUSTOM123" } });
  await waitFor(() => expect(screen.queryByText("Finding assessment names in your attached files…")).not.toBeInTheDocument());
  // An unsupported explicit course may yield no options. It must not be silently
  // overwritten with the uploaded course or trigger a backend/model request.
  expect(screen.getByLabelText("Course / specification code")).toHaveValue("CUSTOM123");
  expect(invoke).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole("combobox", { name: /^(Assessment|Paper)$/ }), { target: { value: "__manual" } });
  fireEvent.change(screen.getByLabelText("Assessment name (manual)"), { target: { value: "Manual paper" } });
  fireEvent.change(screen.getByLabelText("Paper / component code"), { target: { value: "9BS0/01" } });
  expect(screen.getByLabelText("Course / specification code")).toHaveValue("CUSTOM123");
  expect(invoke).not.toHaveBeenCalled();
});
