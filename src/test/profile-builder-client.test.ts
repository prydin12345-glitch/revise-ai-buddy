import { beforeEach, expect, it, vi } from "vitest";
import {
  invokeProfileBuilder,
  readPendingBuilderJob,
  rememberPendingBuilderJob,
  clearPendingBuilderJob,
} from "@/lib/profile-builder-client";
const { invoke, getSession } = vi.hoisted(() => ({
  invoke: vi.fn(),
  getSession: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke }, auth: { getSession } },
}));
beforeEach(() => {
  invoke.mockReset();
  getSession.mockReset();
  localStorage.clear();
});
function http(status: number, body: unknown) {
  invoke.mockResolvedValue({
    data: null,
    error: {
      name: "FunctionsHttpError",
      context: new Response(JSON.stringify(body), { status }),
    },
  });
}
it("reports the observed missing Edge Function as a deployment problem, not invalid form data", async () => {
  http(404, { code: "NOT_FOUND", message: "Requested function was not found" });
  await expect(
    invokeProfileBuilder({ action: "propose", requestId: "same-request" }),
  ).rejects.toThrow(/backend service needs to be deployed/);
  expect(invoke).toHaveBeenCalledOnce();
  expect(invoke).toHaveBeenCalledWith("profile-builder", {
    body: { action: "propose", requestId: "same-request" },
  });
});
it("preserves an owned-proposal 404 rather than mislabelling it as a missing function", async () => {
  http(404, { error: "Owned proposal not found; build it again." });
  await expect(invokeProfileBuilder({ action: "save" })).rejects.toThrow(
    "Owned proposal not found; build it again.",
  );
});
it("reports a deployment boot failure without claiming the student typed incorrect details", async () => {
  http(503, { code: "BOOT_ERROR", message: "Function failed to start" });
  await expect(invokeProfileBuilder({ action: "propose" })).rejects.toThrow(
    /backend deployment needs attention/,
  );
});
it("preserves the existing migration and quota diagnostics from the authenticated handler", async () => {
  for (const [status, error] of [
    [
      503,
      "Profile Builder needs its reviewed migration/backend deployment. Existing profiles are unchanged.",
    ],
    [429, "You have reached today’s limit for this feature."],
  ] as const) {
    http(status, { error });
    await expect(invokeProfileBuilder({ action: "propose" })).rejects.toThrow(
      error,
    );
  }
});
it("explains a gateway session failure without weakening authentication", async () => {
  http(401, { code: 401, message: "Invalid JWT" });
  await expect(invokeProfileBuilder({ action: "propose" })).rejects.toThrow(
    /Sign in again/,
  );
});
it.each(["FunctionsFetchError", "FunctionsRelayError"])(
  "handles %s with a safe same-choice retry message and no automatic replay",
  async (name) => {
    invoke.mockResolvedValue({ data: null, error: { name } });
    await expect(invokeProfileBuilder({ action: "propose" })).rejects.toThrow(
      /retry the same profile choice/,
    );
    expect(invoke).toHaveBeenCalledOnce();
  },
);
it("an unreadable server response retains a safe fallback and never creates a profile", async () => {
  invoke.mockResolvedValue({
    data: null,
    error: { context: new Response("gateway response", { status: 502 }) },
  });
  await expect(invokeProfileBuilder({ action: "propose" })).rejects.toThrow(
    /Your saved profiles are unchanged/,
  );
});
it("returns confirmed backend responses unchanged", async () => {
  const data = { proposalId: "receipt", proposal: { origin: "catalogue" } };
  invoke.mockResolvedValue({ data, error: null });
  expect(await invokeProfileBuilder({ action: "propose" })).toBe(data);
});

it("retains only an opaque job receipt and isolates pending builds by account and subject", async () => {
  const first = crypto.randomUUID(),
    second = crypto.randomUUID();
  getSession.mockResolvedValue({
    data: { session: { user: { id: "account-a" } } },
  });
  await rememberPendingBuilderJob("Physics", first);
  await rememberPendingBuilderJob("Chemistry", second);
  expect(await readPendingBuilderJob(" PHYSICS ")).toEqual({ jobId: first });
  expect(await readPendingBuilderJob("Chemistry")).toEqual({ jobId: second });
  const stored = JSON.parse(
    localStorage.getItem(
      "examly:profile-builder:pending:v1:account-a:physics",
    )!,
  );
  expect(Object.keys(stored).sort()).toEqual(["expiresAt", "jobId"]);
  getSession.mockResolvedValue({
    data: { session: { user: { id: "account-b" } } },
  });
  expect(await readPendingBuilderJob("Physics")).toBeNull();
  await clearPendingBuilderJob("Physics");
  getSession.mockResolvedValue({
    data: { session: { user: { id: "account-a" } } },
  });
  expect(await readPendingBuilderJob("Physics")).toEqual({ jobId: first });
  await clearPendingBuilderJob("Physics", second);
  expect(await readPendingBuilderJob("Physics")).toEqual({ jobId: first });
  await clearPendingBuilderJob("Physics", first);
  expect(await readPendingBuilderJob("Physics")).toBeNull();
  expect(invoke).not.toHaveBeenCalled();
});
it("rejects expired, corrupt or malformed pending receipts without a backend call", async () => {
  getSession.mockResolvedValue({
    data: { session: { user: { id: "account-a" } } },
  });
  const key = "examly:profile-builder:pending:v1:account-a:physics";
  for (const value of [
    "not-json",
    JSON.stringify({ jobId: "not-a-receipt", expiresAt: Date.now() + 1000 }),
    JSON.stringify({ jobId: crypto.randomUUID(), expiresAt: Date.now() - 1 }),
  ]) {
    localStorage.setItem(key, value);
    expect(await readPendingBuilderJob("Physics")).toBeNull();
  }
  getSession.mockResolvedValue({ data: { session: null } });
  await rememberPendingBuilderJob("Physics", crypto.randomUUID());
  expect(await readPendingBuilderJob("Physics")).toBeNull();
  expect(localStorage.length).toBe(0);
  expect(invoke).not.toHaveBeenCalled();
});
it("browser storage being unavailable never prevents receipt cleanup or profile saving", async () => {
  getSession.mockResolvedValue({
    data: { session: { user: { id: "account-a" } } },
  });
  const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw Error("Storage disabled");
  });
  const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw Error("Storage disabled");
  });
  await expect(
    rememberPendingBuilderJob("Physics", crypto.randomUUID()),
  ).resolves.toBeUndefined();
  await expect(readPendingBuilderJob("Physics")).resolves.toBeNull();
  await expect(clearPendingBuilderJob("Physics")).resolves.toBeUndefined();
  get.mockRestore();
  set.mockRestore();
});

it("explains rejected assessment fields during a mixed deployment without silently dropping a manual code", async () => {
  invoke.mockResolvedValue({ data: null, error: { context: new Response(JSON.stringify({ error: "Invalid profile input. Check required fields and supported formats." }), { status: 400 }) } });
  await expect(invokeProfileBuilder({ action: "prepare_source", selectedAssessmentId: "source-assessment-fixture", manualComponentCode: { value: "9BS0/01", confirmed: true } })).rejects.toThrow(/backend may need the matching update/);
  expect(invoke).toHaveBeenCalledTimes(1);
  expect(invoke.mock.calls[0][1].body.manualComponentCode.value).toBe("9BS0/01");
});
