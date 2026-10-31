import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import ErrorPage from "./error";
import NotFound from "./not-found";

describe("error page", () => {
  test("shows the digest and retries", () => {
    const retry = vi.fn();
    render(<ErrorPage error={Object.assign(new Error("x"), { digest: "abc123" })} retry={retry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("error id abc123");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledOnce();
  });
  test("a non-Error value still renders", () => {
    render(<ErrorPage error="boom" retry={() => {}} />);
    expect(screen.getByRole("heading", { name: "Something went wrong" })).toBeInTheDocument();
  });
});

test("not-found links to the four pages", () => {
  render(<NotFound />);
  expect(screen.getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual(["/", "/results", "/cases", "/prompts"]);
});
