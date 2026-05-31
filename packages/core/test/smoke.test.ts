import { describe, it, expect } from "vitest";
import { VERSION } from "../src/index.js";

describe("scaffold", () => {
  it("exposes a semver-like VERSION", () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
