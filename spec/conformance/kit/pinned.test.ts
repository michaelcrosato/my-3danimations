// The kit refuses to certify against vectors that don't match their manifest (WP-10.2): with the manifest check
// answering a mismatch, certify throws a VectorsError naming the file before it asks the implementation anything, so
// no certification is made on edited, missing or extra vectors. (The check itself: runner/runner.test.ts.)
import { describe, expect, it, vi } from "vitest";
import { certify, VectorsError } from "./kit.ts";

vi.mock("../runner/vectors.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../runner/vectors.ts")>()),
  verifyManifest: () => ["tier2/CMU.json does not match the manifest", "tier2/EXTRA.json is not in the manifest"],
}));

describe("a certification is tied to its vectors", () => {
  it("refuses vectors that don't match their manifest, asking nothing", async () => {
    const asked: string[] = [];
    const run = certify(async (op) => {
      asked.push(op);
      return {};
    });
    await expect(run).rejects.toThrow(VectorsError);
    await expect(run).rejects.toThrow("spec/vectors/ doesn't match its manifest: tier2/CMU.json does not match the manifest; tier2/EXTRA.json is not in the manifest");
    expect(asked).toEqual([]);
  });
});
