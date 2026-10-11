// Smoke test for @m3a/io: the entry loads, names itself and carries the repository's version.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PACKAGE, VERSION } from "../src/index.ts";

const root = JSON.parse(readFileSync(new URL("../../../package.json", import.meta.url), "utf8")) as { version: string };

describe("@m3a/io", () => {
  it("names itself and shares the repository version", () => {
    expect(PACKAGE).toBe("@m3a/io");
    expect(VERSION).toBe(root.version);
  });
});
