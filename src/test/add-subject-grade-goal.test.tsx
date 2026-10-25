import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AddSubjectModal } from "@/components/stats/AddSubjectModal";
import { readSubjectGradeGoal } from "@/lib/subject-grade-goals";

const fixture = vi.hoisted(() => ({ owner: "new-subject-owner", id: "new-subject-id", failInsert: false, inserts: [] as Record<string, unknown>[] }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: { id: fixture.owner } } }) },
  from(table: string) {
    let inserted = false;
    const q: Record<string, unknown> = {};
    for (const method of ["select", "eq", "not", "order", "ilike"]) q[method] = () => q;
    q.insert = (row: Record<string, unknown>) => { inserted = true; fixture.inserts.push(row); return q; };
    q.update = () => q;
    const result = () => table === "subjects" ? { data: [{ id: "biology", name: "Biology", category: "sciences" }], error: null }
      : inserted ? { data: fixture.failInsert ? null : { id: fixture.id }, error: fixture.failInsert ? new Error("Subject insert failed") : null } : { data: [], error: null };
    q.single = () => Promise.resolve(result());
    q.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result()).then(resolve, reject);
    return q;
  },
} }));
vi.mock("@/hooks/useSubjectProfiles", () => ({ useSubjectProfiles: () => ({ addTopic: vi.fn() }) }));
vi.mock("@/hooks/useUserPreferences", () => ({ useUserPreferences: () => ({ preferences: { preferred_educational_level: "a-level", curriculum_region: "uk" } }) }));
vi.mock("@/hooks/useSubjectCategory", () => ({ classifySubjectName: async () => "sciences" }));
vi.mock("@/components/stats/SuggestedTopicsModal", () => ({ SuggestedTopicsModal: () => null }));
vi.mock("@/components/stats/ColourSwatchPicker", () => ({ ColourSwatchPicker: () => <div>Colour picker</div> }));

let count = 0;
beforeEach(() => { localStorage.clear(); fixture.id = `new-subject-${++count}`; fixture.failInsert = false; fixture.inserts = []; });
afterEach(cleanup);
const colours: string[] = [];
const mount = () => render(<AddSubjectModal open onOpenChange={() => {}} existingSubjectNames={[]} existingColours={colours} onSubjectAdded={() => {}} />);
async function fillGoal() {
  const summary = screen.getByText("Starting grade & goal (optional)");
  fireEvent.click(summary);
  await waitFor(() => expect(summary.closest("details")).toHaveAttribute("open"));
  fireEvent.change(screen.getByRole("combobox", { name: /Starting grade/ }), { target: { value: "D" } });
  fireEvent.change(screen.getByRole("combobox", { name: /Target grade/ }), { target: { value: "A" } });
}

it("offers optional grade setup after selecting a subject and saves under the actual inserted ID", async () => {
  mount();
  fireEvent.click(await screen.findByRole("button", { name: "Biology" }));
  await fillGoal();
  // Collapsing progressive details must not discard a completed goal.
  fireEvent.click(screen.getByText("Starting grade & goal (optional)"));
  fireEvent.click(screen.getByRole("button", { name: "Add Subject" }));
  await waitFor(() => expect(readSubjectGradeGoal(fixture.owner, fixture.id)).toMatchObject({ scaleId: "alevel_a_e", startingGrade: "D", targetGrade: "A" }));
  expect(fixture.inserts[0]).toMatchObject({ subject_id: "biology", subject_name: "Biology" });
});

it("uses the same optional setup for a custom subject", async () => {
  mount();
  fireEvent.click(screen.getByRole("button", { name: "Add Custom Subject" }));
  fireEvent.change(screen.getByPlaceholderText("e.g. Music Theory"), { target: { value: "Marine biology" } });
  await fillGoal();
  fireEvent.click(screen.getByRole("button", { name: "Add Subject" }));
  await waitFor(() => expect(readSubjectGradeGoal(fixture.owner, fixture.id)).toMatchObject({ targetGrade: "A" }));
  expect(fixture.inserts[0]).toMatchObject({ is_custom: true, subject_name: "Marine biology" });
});

it("never saves a goal when subject creation failed", async () => {
  fixture.failInsert = true;
  mount();
  fireEvent.click(await screen.findByRole("button", { name: "Biology" }));
  await fillGoal();
  fireEvent.click(screen.getByRole("button", { name: "Add Subject" }));
  await waitFor(() => expect(fixture.inserts).toHaveLength(1));
  await waitFor(() => expect(screen.getByRole("button", { name: "Add Subject" })).not.toBeDisabled());
  expect(readSubjectGradeGoal(fixture.owner, fixture.id)).toEqual({});
});
