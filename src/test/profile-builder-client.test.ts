import { beforeEach, expect, it, vi } from "vitest";
import { invokeProfileBuilder } from "@/lib/profile-builder-client";
const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke } },
}));
beforeEach(() => invoke.mockReset());
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
