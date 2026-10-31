import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { Card } from "../Card";
import { Pill } from "./Pill";
import { SectionHeader } from "./SectionHeader";
import { StatTile } from "./StatTile";

describe("Card", () => {
  test("is a labelled region with title, hint and action", () => {
    render(
      <Card title="Verdict" hint="why" action={<button>go</button>}>
        body
      </Card>,
    );
    const region = screen.getByRole("region", { name: "Verdict" });
    expect(region).toHaveTextContent("why");
    expect(region).toHaveTextContent("body");
    expect(screen.getByRole("button", { name: "go" })).toBeInTheDocument();
  });
});

describe("Pill", () => {
  test.each([
    ["success", "text-success"],
    ["danger", "text-danger"],
    ["brand", "text-brand"],
    ["neutral", "text-muted"],
  ] as const)("%s tone uses its text-safe colour", (tone, cls) => {
    render(<Pill tone={tone}>x</Pill>);
    expect(screen.getByText("x")).toHaveClass(cls);
  });
  test("a dot is decorative", () => {
    const { container } = render(<Pill dot>Clean tree</Pill>);
    expect(container.querySelector("[aria-hidden]")).not.toBeNull();
  });
});

test("StatTile shows the value and the label", () => {
  render(<StatTile value="$0.60" label="total API cost" tone="danger" />);
  expect(screen.getByText("$0.60")).toHaveClass("text-danger");
  expect(screen.getByText("total API cost")).toBeInTheDocument();
});

test("SectionHeader renders a level-2 heading", () => {
  render(<SectionHeader title="What we found" hint="three things" />);
  expect(screen.getByRole("heading", { level: 2, name: "What we found" })).toBeInTheDocument();
});
