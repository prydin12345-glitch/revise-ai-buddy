import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import StudyWelcomeBanner from "@/components/dashboard/StudyWelcomeBanner";

afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("the shared study welcome banner", () => {
  it.each([
    [0, 0, "morning"], [11, 59, "morning"],
    [12, 0, "afternoon"], [17, 59, "afternoon"],
    [18, 0, "evening"], [23, 59, "evening"],
  ] as const)("pairs the scene and greeting at local %i:%i", (hour, minute, period) => {
    vi.useFakeTimers().setSystemTime(new Date(2026, 9, 17, hour, minute));
    const { container } = render(<StudyWelcomeBanner name="Prydin Student" />);
    expect(screen.getByText(`Good ${period},`)).toBeVisible();
    expect(container.querySelector("header")).toHaveAttribute("data-period", period);
    expect(screen.getByRole("heading", { level: 1, name: "Prydin" })).toBeVisible();
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector("svg")).toHaveAttribute("focusable", "false");
  });

  it("updates an open banner at noon, evening and midnight without a reload", () => {
    vi.useFakeTimers().setSystemTime(new Date(2026, 9, 17, 11, 59, 59));
    render(<StudyWelcomeBanner name="Prydin" />);
    act(() => vi.advanceTimersByTime(1100));
    expect(screen.getByText("Good afternoon,")).toBeVisible();
    act(() => vi.advanceTimersByTime(6 * 60 * 60 * 1000));
    expect(screen.getByText("Good evening,")).toBeVisible();
    act(() => vi.advanceTimersByTime(6 * 60 * 60 * 1000));
    expect(screen.getByText("Good morning,")).toBeVisible();
  });

  it.each(["focus", "visibilitychange"])("refreshes on %s after a sleeping tab and cleans up its timer", event => {
    vi.useFakeTimers().setSystemTime(new Date(2026, 9, 17, 9));
    const { unmount } = render(<StudyWelcomeBanner name="Prydin" />);
    vi.setSystemTime(new Date(2026, 9, 17, 19));
    fireEvent(event === "focus" ? window : document, new Event(event));
    expect(screen.getByText("Good evening,")).toBeVisible();
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    fireEvent(event === "focus" ? window : document, new Event(event));
    expect(vi.getTimerCount()).toBe(0);
  });
});
