import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { DonutRing, HealthBar, MiniBars, RangeBar, SplitBar } from "./charts";

describe("charts say what they show", () => {
  test("DonutRing", () => {
    render(<DonutRing value={0.906} label="few-json accuracy" colorClass="text-v-few-json" />);
    expect(screen.getByRole("img", { name: "few-json accuracy: 90.6%" })).toBeInTheDocument();
  });
  test("RangeBar places the band and names the interval", () => {
    const { container } = render(<RangeBar lo={0.8} hi={0.9} point={0.85} label="acc" barClass="bg-v-few-json" />);
    expect(screen.getByRole("img", { name: "acc: 85.0%, 95% interval 80.0% to 90.0%" })).toBeInTheDocument();
    const band = container.querySelector(".bg-v-few-json") as HTMLElement;
    expect(band.style.left).toBe("80%");
    expect(parseFloat(band.style.width)).toBeCloseTo(10, 5);
  });
  test("HealthBar clamps to 0..100%", () => {
    const { container } = render(<HealthBar value={1.4} label="x" barClass="bg-x" />);
    expect((container.querySelector(".bg-x") as HTMLElement).style.width).toBe("100%");
  });
  test("SplitBar shares the bar by count and labels both sides", () => {
    const { container } = render(<SplitBar a={3} b={10} aLabel="only zero-json" bLabel="only few-json" aClass="bg-a" bClass="bg-b" />);
    expect(screen.getByRole("img", { name: "only zero-json: 3; only few-json: 10" })).toBeInTheDocument();
    expect(parseFloat((container.querySelector(".bg-a") as HTMLElement).style.width)).toBeCloseTo((3 / 13) * 100, 5);
    expect(screen.getByText("only few-json 10")).toBeInTheDocument();
  });
  test("SplitBar with no disagreements draws no segments", () => {
    const { container } = render(<SplitBar a={0} b={0} aLabel="a" bLabel="b" aClass="bg-a" bClass="bg-b" />);
    expect(container.querySelector(".bg-a")).toBeNull();
  });
  test("MiniBars lists every value in its label", () => {
    render(<MiniBars values={[{ label: "clear", value: 0.9 }, { label: "noisy", value: 0.6 }]} max={1} label="accuracy by type" barClass="bg-x" format={(v) => `${Math.round(v * 100)}%`} />);
    expect(screen.getByRole("img", { name: "accuracy by type: clear 90%, noisy 60%" })).toBeInTheDocument();
  });
});
