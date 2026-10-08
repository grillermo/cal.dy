import { describe, expect, it } from "vitest";
import { isFinalAttempt } from "./isFinalAttempt";

describe("isFinalAttempt", () => {
  it("is false on the first and second run of three", () => {
    expect(isFinalAttempt(0, 3)).toBe(false);
    expect(isFinalAttempt(1, 3)).toBe(false);
  });

  it("is true on the third run of three, before attempts is incremented", () => {
    expect(isFinalAttempt(2, 3)).toBe(true);
  });

  it("is true for a single-attempt task", () => {
    expect(isFinalAttempt(0, 1)).toBe(true);
  });
});
