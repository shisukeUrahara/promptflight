import { expect, test } from "vitest";

test("ui runs in jsdom", () => {
  expect(typeof window).toBe("object");
});
