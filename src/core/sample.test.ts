import { expect, test } from "vitest";

test("core runs in node", () => {
  expect(typeof window).toBe("undefined");
});
