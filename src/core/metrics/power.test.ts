import { describe, expect, test } from "vitest";
import { DEFAULT_SETUP, minDetectableEffect, simulatePower, type PowerSetup } from "./power";

const setup = (n: number, over: Partial<PowerSetup> = {}): PowerSetup => ({ n, ...DEFAULT_SETUP, ...over });

describe("simulatePower", () => {
  test("with no true difference it rejects rarely (about alpha or less)", () => {
    expect(simulatePower(0, setup(90))).toBeLessThan(0.02);
  });
  test("when every disagreement favours B it rejects almost always", () => {
    expect(simulatePower(0.2, setup(90))).toBeGreaterThan(0.95);
  });
  test("power grows with the true difference", () => {
    const p = [0.04, 0.08, 0.12, 0.16].map((d) => simulatePower(d, setup(90)));
    for (let i = 1; i < p.length; i++) expect(p[i]).toBeGreaterThanOrEqual(p[i - 1]);
  });
  test("is deterministic for a seed", () => {
    expect(simulatePower(0.1, setup(90))).toBe(simulatePower(0.1, setup(90)));
  });
  test("a delta above the discordant rate is impossible", () => {
    expect(() => simulatePower(0.3, setup(90))).toThrow(/cannot exceed/);
  });
});

describe("minDetectableEffect", () => {
  test("same seed, same answer", () => {
    expect(minDetectableEffect(setup(90))).toEqual(minDetectableEffect(setup(90)));
  });
  test("falls as N grows", () => {
    const m = [90, 200, 400].map((n) => minDetectableEffect(setup(n)).mde);
    expect(m.every((x) => x !== null)).toBe(true);
    expect(m[0]!).toBeGreaterThan(m[1]!);
    expect(m[1]!).toBeGreaterThan(m[2]!);
  });
  test("reaches the target power at the answer it gives", () => {
    const { mde, powerAtMde } = minDetectableEffect(setup(90));
    expect(powerAtMde!).toBeGreaterThanOrEqual(0.8);
    // one step smaller is below the target
    expect(simulatePower(Math.round((mde! - 0.01) * 100) / 100, setup(90))).toBeLessThan(0.8);
  });
  test("a small sample cannot detect anything within the discordant rate", () => {
    expect(minDetectableEffect(setup(10))).toEqual({ mde: null, powerAtMde: null });
    // The 45 tuning tickets are too few to confirm even a 20-point gap at alpha 0.0125.
    expect(minDetectableEffect(setup(45))).toEqual({ mde: null, powerAtMde: null });
  });
  test("90 holdout tickets detect a gap of about 16 points, no less", () => {
    expect(minDetectableEffect(setup(90)).mde).toBeCloseTo(0.16, 2);
  });
});
