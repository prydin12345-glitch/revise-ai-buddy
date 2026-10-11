import { afterEach, it, expect, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { ExamProfileBuilder } from "@/components/profiles/ExamProfileBuilder";
import { ExamProfileModal } from "@/components/stats/ExamProfileModal";
import { ExamlyApprovalBadge } from "@/components/profiles/ExamlyApprovalBadge";
import { APPROVAL_REGISTRY } from "../../supabase/functions/_shared/preset-approval";
import {
  templateFromPreset,
  prepareProfileSave,
  type BuilderProposal,
} from "../../supabase/functions/_shared/profile-builder-service";
import { SOURCE_REGISTRY } from "../../supabase/functions/_shared/profile-source-registry";
import { fingerprint } from "../../supabase/functions/_shared/profile-fingerprint";
import { canonical } from "../../supabase/functions/_shared/profile-template";
import {
  templateFixture,
  pearsonTemplate,
} from "../../supabase/tests/profile-builder-fixtures";
import type { BuilderApi } from "@/lib/profile-builder-client";
vi.mock("@/hooks/useUserPreferences", () => ({
  useUserPreferences: () => ({
    preferences: { preferred_educational_level: "level3" },
  }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: vi.fn() },
    auth: { getUser: vi.fn(async () => ({ data: { user: null } })) },
    from: vi.fn(),
  },
}));
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
Object.defineProperty(HTMLElement.prototype, "scrollTo", {
  configurable: true,
  value: vi.fn(),
});
afterEach(cleanup);
const entry = APPROVAL_REGISTRY.find(
  (e) => e.component === "H420/03" && e.mode === "short_practice",
)!;
const props = {
  open: true,
  onOpenChange: vi.fn(),
  onManual: vi.fn(),
  subjectName: "Biology",
  examBoard: "OCR",
  educationalLevel: "level3",
};
function memoryApi() {
  const proposals = new Map<string, BuilderProposal>(),
    profiles = new Map<string, any>(),
    calls: any[] = [];
  const api: BuilderApi = async (input) => {
    calls.push(input);
    if (input.action === "propose") {
      let p: BuilderProposal;
      if (input.presetId) p = templateFromPreset(String(input.presetId));
      else {
        const t = input.sourceId ? pearsonTemplate() : templateFixture();
        p = {
          proposalVersion: 1,
          promptVersion: 1,
          template: t,
          origin: input.sourceId ? "source_backed_ai" : "model_knowledge_ai",
          evidence: input.sourceId ? SOURCE_REGISTRY[0].evidence : null,
          evidenceVersion: input.sourceId
            ? fingerprint(canonical(SOURCE_REGISTRY[0].evidence))
            : null,
          presetId: null,
          profileSettings: null,
        };
      }
      proposals.set(String(input.requestId), p);
      return { proposal: p, proposalId: String(input.requestId) };
    }
    if (input.action === "save") {
      const p = proposals.get(String(input.proposalId))!;
      const saved = prepareProfileSave(p, input.template),
        profile = {
          ...saved.settings,
          id: input.profileId ?? crypto.randomUUID(),
          profile_name: input.profileName,
          profile_template: { ...saved.context, proposalId: input.proposalId },
        };
      profiles.set(String(profile.id), profile);
      return { profile, approval: saved.approval };
    }
    throw Error("Unexpected action");
  };
  return { api, calls, proposals, profiles };
}
async function approvedReview(api: BuilderApi) {
  render(<ExamProfileBuilder {...props} api={api} />);
  fireEvent.change(screen.getByLabelText("Approved preset"), {
    target: { value: entry.id },
  });
  fireEvent.click(screen.getByRole("button", { name: "Build profile for me" }));
  await screen.findByLabelText("Profile name");
}
it("uses the existing editor container and keeps the manual route available", () => {
  render(
    <ExamProfileModal
      open
      onOpenChange={vi.fn()}
      subjectName="Biology"
      subjectColor="#378b63"
      examBoard="OCR"
      availableTopics={["Cells"]}
      onSave={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Build profile for me" }));
  expect(screen.getByRole("dialog").className).toContain("sm:max-w-2xl");
  fireEvent.click(screen.getByRole("button", { name: "Manual editor" }));
  expect(
    screen.getByRole("button", { name: "Advanced settings" }),
  ).toBeInTheDocument();
});
it("approved OCR Paper 3 previews its actual marks, parts and an accessible star", async () => {
  const r = memoryApi();
  await approvedReview(r.api);
  expect(
    screen.getByRole("img", { name: "Examly-approved preset" }),
  ).toBeInTheDocument();
  expect(screen.getByText("20", { selector: "strong" })).toBeInTheDocument();
  expect(r.calls[0].presetId).toBe(entry.id);
  expect(screen.getByRole("button", { name: "Confirm & save" })).toBeEnabled();
});
it("editing generation settings removes active approval, and explicit restore recovers it", async () => {
  const r = memoryApi();
  await approvedReview(r.api);
  fireEvent.change(screen.getByLabelText("Time limit (minutes)"), {
    target: { value: "27" },
  });
  expect(
    screen.queryByRole("img", { name: "Examly-approved preset" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByText("Customised from an Examly-approved preset"),
  ).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Restore approved settings" }),
  );
  expect(
    screen.getByRole("img", { name: "Examly-approved preset" }),
  ).toBeInTheDocument();
});
it("rename, confirmation and reopening preserve approval and saved provenance", async () => {
  const r = memoryApi();
  await approvedReview(r.api);
  fireEvent.change(screen.getByLabelText("Profile name"), {
    target: { value: "My renamed paper" },
  });
  expect(
    screen.getByRole("img", { name: "Examly-approved preset" }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Confirm & save" }));
  await waitFor(() => expect(r.profiles.size).toBe(1));
  const profile = [...r.profiles.values()][0];
  cleanup();
  render(
    <ExamProfileBuilder {...props} initialProfile={profile} api={r.api} />,
  );
  expect(screen.getByLabelText("Profile name")).toHaveValue("My renamed paper");
  expect(
    screen.getByRole("img", { name: "Examly-approved preset" }),
  ).toBeInTheDocument();
});
it("invalid edited mark totals block confirmation rather than becoming generation-ready", async () => {
  const r = memoryApi();
  await approvedReview(r.api);
  fireEvent.change(screen.getByLabelText("Total marks"), {
    target: { value: "21" },
  });
  expect(screen.getByRole("button", { name: "Confirm & save" })).toBeDisabled();
  expect(screen.getByRole("alert")).toHaveTextContent(/Achievable marks/);
});
it("a source-backed unsupported course produces an editable draft with no star", async () => {
  const r = memoryApi();
  render(<ExamProfileBuilder {...props} api={r.api} />);
  fireEvent.change(screen.getByLabelText("Registered source"), {
    target: { value: "pearson-9bi0-01-issue4" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Build profile for me" }));
  await screen.findByLabelText("Profile name");
  expect(screen.getByText("Source-backed AI draft")).toBeInTheDocument();
  expect(
    screen.queryByRole("img", { name: "Examly-approved preset" }),
  ).not.toBeInTheDocument();
  expect(screen.getByLabelText("Topics — one per line")).toBeEnabled();
});
it("missing source requires explicit choice and never starts a model-backed proposal", async () => {
  const r = memoryApi();
  render(<ExamProfileBuilder {...props} api={r.api} />);
  for (const [label, value] of [
    ["Country", "US"],
    ["Education system", "Institution"],
    ["Qualification", "Module"],
    ["Course / specification code", "BIO101"],
    ["Paper / unit / module", "Final"],
    ["Specification / cohort version", "2026"],
  ])
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "Build profile for me" }));
  expect(screen.getByRole("alert")).toHaveTextContent(/registered source/);
  expect(r.calls).toHaveLength(0);
});
it("general practice opt-in is labelled honestly and full mock is disabled", () => {
  const r = memoryApi();
  render(<ExamProfileBuilder {...props} api={r.api} />);
  fireEvent.click(screen.getByRole("button", { name: "General practice" }));
  expect(
    screen.getByText(/may not match your real assessment/),
  ).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Assessment mode"), {
    target: { value: "full_mock" },
  });
  expect(
    screen.getByRole("button", { name: "Build profile for me" }),
  ).toBeDisabled();
});
it("a cancelled in-flight response cannot reopen preview or save a profile", async () => {
  let resolve: any;
  const api: BuilderApi = () =>
    new Promise((r) => {
      resolve = r;
    });
  const closed = vi.fn();
  render(<ExamProfileBuilder {...props} onOpenChange={closed} api={api} />);
  fireEvent.change(screen.getByLabelText("Approved preset"), {
    target: { value: entry.id },
  });
  fireEvent.click(screen.getByRole("button", { name: "Build profile for me" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Close profile builder" }),
  );
  resolve({
    proposalId: crypto.randomUUID(),
    proposal: templateFromPreset(entry.id),
  });
  await waitFor(() => expect(closed).toHaveBeenCalledWith(false));
  expect(screen.queryByLabelText("Profile name")).not.toBeInTheDocument();
});
it("a transport retry preserves its idempotency key instead of creating another charged request", async () => {
  const calls: any[] = [],
    api: BuilderApi = async (input) => {
      calls.push(input);
      throw Error("Transport interrupted");
    };
  render(<ExamProfileBuilder {...props} api={api} />);
  fireEvent.change(screen.getByLabelText("Approved preset"), {
    target: { value: entry.id },
  });
  fireEvent.click(screen.getByRole("button", { name: "Build profile for me" }));
  await screen.findByText("Transport interrupted");
  fireEvent.click(screen.getByRole("button", { name: "Build profile for me" }));
  await waitFor(() => expect(calls).toHaveLength(2));
  expect(calls[1].requestId).toBe(calls[0].requestId);
});
it("revoked and source-backed badges never render the gold star", () => {
  render(<ExamlyApprovalBadge approval={{ status: "revoked", entry: null }} />);
  expect(
    screen.queryByRole("img", { name: "Examly-approved preset" }),
  ).not.toBeInTheDocument();
  expect(screen.getByText("Preset approval revoked")).toBeInTheDocument();
});
