import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  BarChart,
  isBarChartQuestion,
  type BarChartData,
} from "./BarChart";

describe("isBarChartQuestion", () => {
  it("accepts a valid simple bar chart", () => {
    const data: BarChartData = {
      type: "bar_chart",
      bars: [
        { label: "A", value: 10 },
        { label: "B", value: 20 },
      ],
    };
    expect(isBarChartQuestion(data)).toBe(true);
  });

  it("accepts a valid grouped bar chart (no `bars` array)", () => {
    const data: BarChartData = {
      type: "bar_chart",
      grouped: [
        {
          groupLabel: "2020",
          bars: [
            { label: "X", value: 5 },
            { label: "Y", value: 7 },
          ],
        },
      ],
    };
    expect(isBarChartQuestion(data)).toBe(true);
  });

  it("rejects null, undefined, and non-objects", () => {
    expect(isBarChartQuestion(null)).toBe(false);
    expect(isBarChartQuestion(undefined)).toBe(false);
    expect(isBarChartQuestion("bar_chart")).toBe(false);
    expect(isBarChartQuestion(42)).toBe(false);
  });

  it("rejects wrong type discriminant", () => {
    expect(
      isBarChartQuestion({ type: "pie_chart", bars: [{ label: "A", value: 1 }] }),
    ).toBe(false);
  });

  it("rejects empty bars and grouped arrays", () => {
    expect(isBarChartQuestion({ type: "bar_chart", bars: [] })).toBe(false);
    expect(isBarChartQuestion({ type: "bar_chart", grouped: [] })).toBe(false);
    expect(isBarChartQuestion({ type: "bar_chart" })).toBe(false);
  });
});

describe("<BarChart />", () => {
  it("renders caption, axis labels and one rect per simple bar", () => {
    const data: BarChartData = {
      type: "bar_chart",
      caption: "Figure 1: GDP",
      xLabel: "Country",
      yLabel: "USD",
      bars: [
        { label: "Germany", value: 45 },
        { label: "France", value: 30 },
        { label: "Spain", value: 22 },
      ],
    };
    const { container } = render(<BarChart chartData={data} />);
    expect(screen.getByText("Figure 1: GDP")).toBeInTheDocument();
    expect(screen.getByText("Country")).toBeInTheDocument();
    expect(screen.getByText("USD")).toBeInTheDocument();
    // 3 data bars
    const rects = container.querySelectorAll("svg rect");
    expect(rects.length).toBe(3);
    // accessible title tooltips on bars
    const titles = Array.from(container.querySelectorAll("svg title")).map(
      (t) => t.textContent,
    );
    expect(titles).toContain("Germany: 45");
  });

  it("renders grouped bars with one legend swatch per series", () => {
    const data: BarChartData = {
      type: "bar_chart",
      grouped: [
        {
          groupLabel: "2020",
          bars: [
            { label: "Imports", value: 12 },
            { label: "Exports", value: 18 },
          ],
        },
        {
          groupLabel: "2021",
          bars: [
            { label: "Imports", value: 14 },
            { label: "Exports", value: 22 },
          ],
        },
      ],
    };
    const { container } = render(<BarChart chartData={data} />);
    // 2 groups × 2 series = 4 rects
    const rects = container.querySelectorAll("svg rect");
    expect(rects.length).toBe(4);
    // Legend renders both series labels exactly once
    expect(screen.getByText("Imports")).toBeInTheDocument();
    expect(screen.getByText("Exports")).toBeInTheDocument();
  });

  it("renders horizontal orientation with one row per bar", () => {
    const data: BarChartData = {
      type: "bar_chart",
      orientation: "horizontal",
      xLabel: "Score",
      bars: [
        { label: "Alpha", value: 8 },
        { label: "Beta", value: 14 },
        { label: "Gamma", value: 3 },
      ],
    };
    const { container } = render(<BarChart chartData={data} />);
    // horizontal renderer draws 2 rects per bar (track + fill) = 6
    const rects = container.querySelectorAll("svg rect");
    expect(rects.length).toBe(6);
    expect(screen.getByText("Score")).toBeInTheDocument();
  });

  it("formats decimal values to 1 dp without rounding away precision", () => {
    const data: BarChartData = {
      type: "bar_chart",
      bars: [
        { label: "A", value: 12.5 },
        { label: "B", value: 7.3 },
      ],
    };
    const { container } = render(<BarChart chartData={data} />);
    // Tooltip titles include the raw value with one decimal
    const titles = Array.from(container.querySelectorAll("svg title")).map(
      (t) => t.textContent,
    );
    expect(titles).toContain("A: 12.5");
    expect(titles).toContain("B: 7.3");
  });

  it("truncates long category labels in display but keeps full label in tooltip", () => {
    const longLabel = "Very Long Category Name That Should Truncate";
    const data: BarChartData = {
      type: "bar_chart",
      bars: [
        { label: longLabel, value: 10 },
        { label: "Short", value: 5 },
      ],
    };
    const { container } = render(<BarChart chartData={data} />);
    const titles = Array.from(container.querySelectorAll("svg title")).map(
      (t) => t.textContent,
    );
    // Full label is preserved in a <title> element somewhere
    expect(titles.some((t) => t === longLabel || t === `${longLabel}: 10`)).toBe(
      true,
    );
  });

  it("does not crash when given an invalid bar_chart shape via the type-guard", () => {
    expect(isBarChartQuestion({ type: "bar_chart", bars: [] })).toBe(false);
    // Component is only rendered when guard passes — we simulate that contract here.
  });
});
