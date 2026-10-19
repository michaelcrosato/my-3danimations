// The adopt bot's whole proof (PLAN.md WP-9.1: "an improvement shows its diff and is adopted as a new version"), run
// under M3A_FULL=1 alone (minutes: `M3A_FULL=1 npx vitest run tools/intake/adopt.full.test.ts`). In a scratch copy of
// the whole repository, the owner adopts an improvement of a migrated clip (QUATERNIUS_3D2DGE/Walk_Loop, the intake's
// fixture) and of an imported one (MESH2MOTION/Dance_Charleston, which the import keeps as migrated); the bot writes
// each, regenerates the derived files there with the repository's commands, prints its pull request and merges it on
// the gates (a dry run); then the repository's own checks pass on the result: npm run migrate -- --check, npm run
// import -- --check --set MESH2MOTION, npm run library -- check, npm run qa -- --check, npm run qa -- library --check,
// and the library's own test.
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { serialize, type Clip } from "@m3a/core";
import { contentHash, localStore, type IntakeStore } from "../../packages/tools/src/intake/index.ts";
import { intakeFiles } from "../../packages/tools/src/node/intake.ts";
import { adopt, dryRun } from "./adopt.ts";
import { bindRigs } from "./check.ts";
import { fixtures } from "./fixtures.ts";
import { LOCAL_OWNER, libraryAt } from "./host.ts";
import { scratchRepo } from "./write.ts";

const FULL = process.env.M3A_FULL === "1", today = () => "2026-10-19", dirs: string[] = [];
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

/** An improvement of library clip `id` as a contributor sends it: its head turned 3 degrees, its description new. */
function improved(lib: ReturnType<typeof libraryAt>, id: string): string {
  const got = lib.library.clip(id), [set, name] = id.split("/") as [string, string];
  const clip = { ...got.clip, desc: `${got.clip.desc}, the head turned a little`, keys: got.clip.keys.map((k) => ({ ...k, head: (k as unknown as { head: number[] }).head.map((v, i) => (i ? v : v + 3)) })), provenance: { ...got.clip.provenance, orig: id, method: "edited", ai: "humanEdits", producer: { tool: "m3a-adopt-proof", version: "1" }, intake: { by: "tools/intake/adopt.full.test.ts (michaelcrosato)", improves: { id, sha256: contentHash(lib.source.read(set, `${name}.json`)) } } } } as Clip;
  delete clip.review;
  return serialize(clip);
}

describe.runIf(FULL)("the adopt bot in a scratch copy of the whole repository", () => {
  it("adopts an improvement of a migrated clip and of an imported one, and the library's checks pass on what it merges", async () => {
    const R = scratchRepo(), S = mkdtempSync(join(tmpdir(), "m3a-adopt-store-"));
    dirs.push(R, S);
    const store = (role: "contributor" | "checker" | "owner", id?: string): IntakeStore => localStore({ files: intakeFiles(S), role, ...(id ? { id } : {}), today });
    const lib = libraryAt(join(R, "library/sets")), sent = [{ improves: "QUATERNIUS_3D2DGE/Walk_Loop", text: fixtures(lib, "improvement")[0]!.text }, { improves: "MESH2MOTION/Dance_Charleston", text: improved(lib, "MESH2MOTION/Dance_Charleston") }];
    for (const x of sent) {
      const s = await store("contributor", "proof").submit({ kind: "clip", text: x.text, improves: x.improves });
      await store("checker").advance(s.id, "checking");
      await store("checker").advance(s.id, "awaiting review", { report: { gates: [] } });
      await store("owner", LOCAL_OWNER).decide(s.id, { as: "adopt", hash: s.content, note: "the proof", date: today() });
    }
    const printed: string[] = [], out = await adopt({ store: store("checker"), owner: LOCAL_OWNER, checkout: R, prs: dryRun((t) => void printed.push(t)), today, rigs: await bindRigs() });
    process.stdout.write(`${printed.join("\n")}\n`);
    expect(out.map((o) => [o.outcome, o.clip, o.why])).toEqual(expect.arrayContaining(sent.map((x) => ["merged", x.improves, null])));
    expect(printed.join("\n").match(/\n {2}- regenerated with the repository's commands \(npm run library -- lock; npm run qa -- library --baseline\): [^\n]+\n {2}- (the distributions: none worse than recorded|worse than recorded)/g)).toHaveLength(2);
    const checks = [["migrate", "--check"], ["import", "--check", "--set", "MESH2MOTION"], ["library", "check"], ["qa", "--check"], ["qa", "library", "--check"], ["test", "tools/migrate/library"]];
    const ran = checks.map(([script, ...args]) => {
      const r = spawnSync("npm", ["run", script!, "--", ...args], { cwd: R, encoding: "utf8", maxBuffer: 1 << 26 }), said = `${r.stdout}`.split("\n").find((l) => /^\S+.*: (PASS|FAIL)/.test(l)) ?? `${r.stdout}${r.stderr}`.trim().split("\n").slice(-3).join(" ");
      process.stdout.write(`npm run ${script} -- ${args.join(" ")}: exit ${r.status}: ${said}\n`);
      return [`${script} ${args.join(" ")}`, r.status];
    });
    expect(ran).toEqual(checks.map(([script, ...args]) => [`${script} ${args.join(" ")}`, 0]));
  }, 900_000);
});
