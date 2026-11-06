import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CookieConsent, openCookieSettings } from "@/components/CookieConsent";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

const storageKey = "examly_cookie_consent";
const settleMutations = () =>
  act(async () => {
    await Promise.resolve();
  });
const showBanner = async () => {
  act(() => vi.advanceTimersByTime(1000));
  await settleMutations();
};
function Preview({ modalOpen }: { modalOpen: boolean }) {
  return (
    <MemoryRouter>
      <Dialog open={modalOpen}>
        <DialogContent hideCloseButton>
          <DialogTitle>Build your exam profile</DialogTitle>
          <DialogDescription>Confirm your assessment.</DialogDescription>
          <button>Continue profile</button>
        </DialogContent>
      </Dialog>
      <CookieConsent />
    </MemoryRouter>
  );
}
function modal(role = "dialog") {
  const element = document.createElement("div");
  element.dataset.testModal = "true";
  element.setAttribute("role", role);
  element.setAttribute("data-state", "open");
  document.body.append(element);
  return element;
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  document
    .querySelectorAll("[data-test-modal]")
    .forEach((element) => element.remove());
  vi.useRealTimers();
});

describe("cookie consent while another dialog is open", () => {
  it("defers the first-visit notice for a real Radix dialog, then shows it without changing consent", async () => {
    const view = render(<Preview modalOpen />);
    // The installed Radix dialog uses role/data-state without aria-modal.
    expect(screen.getByRole("dialog")).not.toHaveAttribute("aria-modal");
    await showBanner();
    expect(screen.queryByText("We use cookies")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Continue profile" }),
    ).toBeInTheDocument();
    expect(document.querySelectorAll("button").length).toBe(1);
    expect(localStorage.getItem(storageKey)).toBeNull();

    view.rerender(<Preview modalOpen={false} />);
    await settleMutations();
    expect(screen.getByText("We use cookies")).toBeInTheDocument();
    expect(localStorage.getItem(storageKey)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Necessary only" }));
    expect(JSON.parse(localStorage.getItem(storageKey)!)).toMatchObject({
      necessary: true,
      analytics: false,
      preferences: false,
    });
    expect(screen.queryByText("We use cookies")).not.toBeInTheDocument();
  });

  it("removes an already visible banner and waits for all nested dialogs to close", async () => {
    render(
      <MemoryRouter>
        <CookieConsent />
      </MemoryRouter>,
    );
    await showBanner();
    expect(screen.getByText("We use cookies")).toBeInTheDocument();
    const outer = modal();
    await settleMutations();
    expect(screen.queryByText("We use cookies")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Accept all" }),
    ).not.toBeInTheDocument();
    const confirmation = modal("alertdialog");
    outer.remove();
    await settleMutations();
    expect(screen.queryByText("We use cookies")).not.toBeInTheDocument();
    confirmation.remove();
    await settleMutations();
    expect(screen.getByText("We use cookies")).toBeInTheDocument();
    expect(localStorage.getItem(storageKey)).toBeNull();
  });

  it("queues explicit settings and preserves unsaved choices across a modal interruption", async () => {
    const saved = JSON.stringify({
      necessary: true,
      analytics: false,
      preferences: false,
      savedAt: "2026-11-01T00:00:00.000Z",
    });
    localStorage.setItem(storageKey, saved);
    render(
      <MemoryRouter>
        <CookieConsent />
      </MemoryRouter>,
    );
    const first = modal();
    act(() => openCookieSettings());
    await settleMutations();
    expect(screen.queryByText("Cookie preferences")).not.toBeInTheDocument();
    first.remove();
    await settleMutations();
    expect(screen.getByText("Cookie preferences")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Toggle Analytics cookies" }),
    );
    const second = modal();
    await settleMutations();
    act(() => openCookieSettings());
    expect(localStorage.getItem(storageKey)).toBe(saved);
    expect(screen.queryByText("Cookie preferences")).not.toBeInTheDocument();
    second.remove();
    await settleMutations();
    fireEvent.click(screen.getByRole("button", { name: "Save preferences" }));
    expect(JSON.parse(localStorage.getItem(storageKey)!)).toMatchObject({
      necessary: true,
      analytics: true,
      preferences: false,
    });
  });

  it("ignores hidden, closed and explicitly nonmodal panels while reacting to visibility changes", async () => {
    render(
      <MemoryRouter>
        <CookieConsent />
      </MemoryRouter>,
    );
    const hidden = modal();
    hidden.hidden = true;
    const closed = modal();
    closed.dataset.state = "closed";
    const nonmodal = modal();
    nonmodal.setAttribute("aria-modal", "false");
    const styled = modal();
    styled.style.display = "none";
    await showBanner();
    expect(screen.getByText("We use cookies")).toBeInTheDocument();
    styled.style.display = "block";
    await settleMutations();
    expect(screen.queryByText("We use cookies")).not.toBeInTheDocument();
    styled.style.display = "none";
    await settleMutations();
    expect(screen.getByText("We use cookies")).toBeInTheDocument();
    expect(localStorage.getItem(storageKey)).toBeNull();
  });
});
