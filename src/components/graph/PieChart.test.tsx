import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  PieChart,
  isPieChartQuestion,
  type PieChartData,
} from "./PieChart";

describe("isPieChartQuestion", () => {
  it("accepts a valid pie chart with segments", () => {
    const data: PieChartData = {
      type: "pie_chart",
      segments: [
        { label: "A", value: 40 },
        { label: "B", value: 60 },
      ],
    };
    expect(isPieChartQuestion(data)).toBe(true);
  });

  it("rejects null, undefined, non-objects, wrong type", () => {
    expect(isPieChartQuestion(null)).toBe(false);
    expect(isPieChartQuestion(undefined)).toBe(false);
    expect(isPieChartQuestion("pie")).toBe(false);
    expect(
      isPieChartQuestion({
        type: "bar_chart",
        segments: [{ label: "A", value: 1 }],
      }),
    ).toBe(false);
  });

  it("rejects empty segments and missing segments", () => {
    expect(isPieChartQuestion({ type: "pie_chart", segments: [] })).toBe(false);
    expect(isPieChartQuestion({ type: "pie_chart" })).toBe(false);
  });
});

describe("<PieChart />", () => {
  it("renders caption, one path per segment, and legend entries", () => {
    const data: PieChartData = {
      type: "pie_chart",
      caption: "Figure 1: Energy mix",
      segments: [
        { label: "Coal", value: 30 },
        { label: "Gas", value: 50 },
        { label: "Renewables", value: 20 },
      ],
    };
    const { container } = render(<PieChart chartData={data} />);
    expect(screen.getByText("Figure 1: Energy mix")).toBeInTheDocument();
    const paths = container.querySelectorAll("svg path");
    expect(paths.length).toBe(3);
    expect(screen.getByText("Coal")).toBeInTheDocument();
    expect(screen.getByText("Gas")).toBeInTheDocument();
    expect(screen.getByText("Renewables")).toBeInTheDocument();
  });

  it("computes percentages even when values do not sum to 100", () => {
    const data: PieChartData = {
      type: "pie_chart",
      segments: [
        { label: "A", value: 1 },
        { label: "B", value: 1 },
        { label: "C", value: 2 },
      ],
    };
    render(<PieChart chartData={data} />);
    // 25% / 25% / 50%
    expect(screen.getAllByText("25%").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("50%").length).toBeGreaterThanOrEqual(1);
  });

  it("returns null when total is zero (all-zero segments)", () => {
    const data: PieChartData = {
      type: "pie_chart",
      segments: [
        { label: "A", value: 0 },
        { label: "B", value: 0 },
      ],
    };
    const { container } = render(<PieChart chartData={data} />);
    // No SVG should be rendered — figure is not produced.
    expect(container.querySelector("svg")).toBeNull();
  });

  it("renders decimal values via tooltip without truncating precision", () => {
    const data: PieChartData = {
      type: "pie_chart",
      segments: [
        { label: "A", value: 12.5 },
        { label: "B", value: 37.5 },
      ],
    };
    const { container } = render(<PieChart chartData={data} />);
    const titles = Array.from(container.querySelectorAll("svg title")).map(
      (t) => t.textContent,
    );
    expect(titles.some((t) => t?.includes("12.5"))).toBe(true);
    expect(titles.some((t) => t?.includes("37.5"))).toBe(true);
  });

  it("renders long segment labels in the legend without crashing", () => {
    const longLabel =
      "Very Long Segment Label That Could Overflow A Narrow Container";
    const data: PieChartData = {
      type: "pie_chart",
      segments: [
        { label: longLabel, value: 60 },
        { label: "Other", value: 40 },
      ],
    };
    render(<PieChart chartData={data} />);
    expect(screen.getByText(longLabel)).toBeInTheDocument();
    expect(screen.getByText("Other")).toBeInTheDocument();
  });

  it("renders a doughnut centre total when isDoughnut is true", () => {
    const data: PieChartData = {
      type: "pie_chart",
      isDoughnut: true,
      segments: [
        { label: "A", value: 25 },
        { label: "B", value: 75 },
      ],
    };
    render(<PieChart chartData={data} />);
    expect(screen.getByText("100")).toBeInTheDocument();
  });
});
