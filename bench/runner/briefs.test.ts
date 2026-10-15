// Every brief through the runner (WP-6.6), in T2 only (M3A_FULL=1, D74: it packs and installs the packages once per
// brief): each brief's known-good solution graded in a workspace outside the repository with the packed packages
// installed (a fake trial), B4's on its own avatar; and a B4 variant whose generator seed doesn't give a VRM avatar's
// bone names refused before any trial. Its temporary directory is removed after.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runBrief } from "./main.ts";
import { pack } from "./pack.ts";

describe.runIf(process.env.M3A_FULL === "1")("every brief through the runner", () => {
  const base = mkdtempSync(join(tmpdir(), "m3a-briefs-test-"));
  let packs: Record<string, string> = {};
  beforeAll(() => {
    packs = pack(join(base, "packs"));
  }, 300_000);
  // the packs and six workspaces with their installs: removed after (kept, they filled the disk)
  afterAll(() => rmSync(base, { recursive: true, force: true }));
  for (const name of ["B2", "B3", "B4", "B5", "B6", "B7"]) {
    it(`grades ${name}'s known-good solution through the packed packages (a fake trial)`, async () => {
      const r = await runBrief(name, { trials: 1, base: join(base, name), packs, fake: true });
      expect(r.trials[0]!.pass, r.trials[0]!.failed.join("\n")).toBe(true);
    }, 300_000);
  }
  it("refuses a B4 variant whose seed gives a character another rig's bone names", async () => {
    const dir = join(base, "B4-variant");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "brief.md"), "# B4, reworded\n");
    writeFileSync(join(dir, "character.json"), JSON.stringify({ seed: 41 }));
    await expect(runBrief("B4", { trials: 1, base: join(base, "B4v"), packs, fake: true, variant: dir })).rejects.toThrow(/must have vrm bone names, and seed 41 gives mixamo's/);
  });
});
