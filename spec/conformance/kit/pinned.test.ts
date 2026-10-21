// The kit refuses to certify against vectors that don't match their manifest (WP-10.2): with the manifest check
// answering a mismatch, certify throws a VectorsError naming the file before it asks the implementation anything, so
// no certification is made on edited, missing or extra vectors. (The check itself: runner/runner.test.ts.) T1's files
// share a worker's modules (D125), so the mock is the test's alone: the kit imported afresh under it, then the mock
// and the modules it made dropped, so a file run after this one in the same worker gets the real check.
import { afterAll, describe, expect, it, vi } from "vitest";

describe("a certification is tied to its vectors", () => {
  afterAll(() => {
    vi.doUnmock("../runner/vectors.ts");
    vi.resetModules();
  });

  it("refuses vectors that don't match their manifest, asking nothing", async () => {
    vi.resetModules();
    vi.doMock("../runner/vectors.ts", async (importOriginal) => ({
      ...(await importOriginal<typeof import("../runner/vectors.ts")>()),
      verifyManifest: () => ["tier2/CMU.json does not match the manifest", "tier2/EXTRA.json is not in the manifest"],
    }));
    const { certify, VectorsError } = await import("./kit.ts"), asked: string[] = [];
    const run = certify(async (op) => {
      asked.push(op);
      return {};
    });
    await expect(run).rejects.toThrow(VectorsError);
    await expect(run).rejects.toThrow("spec/vectors/ doesn't match its manifest: tier2/CMU.json does not match the manifest; tier2/EXTRA.json is not in the manifest");
    expect(asked).toEqual([]);
  });
});
