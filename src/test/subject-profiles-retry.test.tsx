import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useSubjectProfiles } from "@/hooks/useSubjectProfiles";

const backend = vi.hoisted(() => ({ fail: true, owners: [] as string[] }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: { id: "alice" } } }) },
  from: (table: string) => {
    const query = {
      select: () => query,
      eq: (_field: string, owner: string) => { backend.owners.push(owner); return query; },
      order: async () => ({ data: table === "subject_exam_profiles" ? [{ id: "profile", subject_name: "Biology", profile_name: "Paper 3", topics: ["Cells"] }] : [], error: backend.fail ? { message: "Read failed" } : null }),
    };
    return query;
  },
} }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("exposes failed profile reads and retry loading without changing or writing profiles", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const { result } = renderHook(() => useSubjectProfiles());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.error).toBe("Couldn’t load exam profiles. Try again.");
  expect(result.current.getProfilesForSubject("Biology")).toEqual([]);
  backend.fail = false;
  await act(async () => { await result.current.retry(); });
  expect(result.current.error).toBeNull();
  expect(result.current.loading).toBe(false);
  expect(result.current.getProfilesForSubject("Biology")).toEqual([expect.objectContaining({ id: "profile" })]);
  expect(backend.owners).toEqual(["alice", "alice", "alice", "alice"]);
});
