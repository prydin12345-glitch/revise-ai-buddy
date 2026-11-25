import type { ReactElement } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";

/** Course-contract tests use Exam settings, or Setup while creating a profile. */
export function renderProfileBasics(ui: ReactElement) {
  const view = render(ui);
  const settings = screen.queryByRole("button", { name: "Exam settings" });
  if (settings) fireEvent.click(settings);
  openPaperDetails();
  return view;
}

export function openPaperDetails() {
  const summary = screen.queryByText("Paper details");
  const details = summary?.closest("details");
  if (summary && details && !details.open) {
    fireEvent.click(summary);
    details.setAttribute("open", "");
  }
}

export function openMoreQuestionSettings() {
  const summary = screen.getByText("More question settings");
  const details = summary.closest("details");
  if (!details?.open) {
    fireEvent.click(summary);
    details?.setAttribute("open", "");
  }
}

export async function saveProfile(
  name: "Update Profile" | "Create Profile" = "Update Profile",
) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
}
