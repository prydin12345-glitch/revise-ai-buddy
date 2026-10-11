import type { ReactElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";

/** Existing course-contract tests exercise settings from the editor's Basics page. */
export function renderProfileBasics(ui: ReactElement) {
  const view = render(ui);
  fireEvent.click(screen.getByRole("button", { name: "Basics" }));
  openPaperDetails();
  return view;
}

export function openPaperDetails() {
  const details = screen.queryByText("Paper details");
  if (details) {
    fireEvent.click(details);
    details.closest("details")?.setAttribute("open", "");
  }
}
