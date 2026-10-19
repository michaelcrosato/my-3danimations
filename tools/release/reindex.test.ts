// The owner's review keeps the registry index whole (WP-9.4 with WP-8.2a): in a scratch checkout (one library set, its
// lock and its index, and the repository's index command), `m3a review approve` on a sampled clip writes the clip, its
// set's content id and the lock, and regenerates library/index.json with that command, as the adopt bot does, so
// `npm run index -- --check` passes on what it leaves and the set has a new version; when the index refuses the change,
// the review writes nothing and says why.
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Clip } from "@m3a/core";
import { directory, lockLibrary, sha256 } from "../../packages/library/src/node.ts";
import { motionHash } from "../../packages/tools/src/intake/index.ts";
import { nodeHost } from "../../packages/tools/src/node.ts";
import { nodeReviewHost } from "../../packages/tools/src/node/intake.ts";
import { Registry } from "../../packages/tools/src/registry/index.ts";
import { REVIEW } from "../../packages/tools/src/tools/index.ts";
import { ROOT } from "../run/cli.ts";
import { buildIndex, indexText, type RegistryIndex } from "./index.ts";

const SET = "QUATERNIUS_3D2DGE", today = () => "2026-10-19";
let R: string;
const file = (p: string) => readFileSync(join(R, p), "utf8");
const ref = (name: string) => `${SET}/${name}@${motionHash(JSON.parse(file(`library/sets/${SET}/${name}.json`)) as Clip).slice(0, 12)}`;
const review = (args: object) => new Registry(REVIEW).call("review", args, { host: { ...nodeHost(R), intake: () => nodeReviewHost(R, { today }) } });
const index = (...args: string[]) => spawnSync(process.execPath, ["tools/release/main.ts", ...args], { cwd: R, encoding: "utf8" });
/** The files a review may change in the scratch checkout, by path. */
const written = () => Object.fromEntries(["library/sets.lock.json", "library/index.json", ...readdirSync(join(R, "library/sets", SET)).map((f) => `library/sets/${SET}/${f}`)].map((p) => [p, file(p)]));

beforeAll(() => {
  R = mkdtempSync(join(tmpdir(), "m3a-reindex-"));
  cpSync(join(ROOT, "library/sets", SET), join(R, "library/sets", SET), { recursive: true });
  writeFileSync(join(R, "library/sets.lock.json"), `${JSON.stringify(lockLibrary(join(R, "library/sets")), null, 1)}\n`);
  for (const d of ["tools/release", "tools/run"]) cpSync(join(ROOT, d), join(R, d), { recursive: true });
  for (const d of ["packages", "node_modules"]) symlinkSync(join(ROOT, d), join(R, d));
  writeFileSync(join(R, "tools/release/registry.json"), `${JSON.stringify({ yanked: {}, community: {} }, null, 1)}\n`);
  writeFileSync(join(R, "library/index.json"), indexText(buildIndex(directory(join(R, "library/sets")), sha256, { yanked: {}, community: {} })));
  mkdirSync(join(R, "docs"));
});
afterAll(() => rmSync(R, { recursive: true, force: true }));

describe("a review in the repository's checkout", () => {
  it("regenerates the registry index after writing a clip's approval, so index --check passes and the set has a new version", async () => {
    const r = await review({ do: "approve", on: ref("Walk_Loop"), note: "clean" });
    expect([r.status, r.verdict]).toEqual(["ok", expect.stringMatching(/^review approve: 1 decision, 1 applied/)]);
    const check = index("--check");
    expect([check.status, check.stdout]).toEqual([0, expect.stringMatching(/1 core sets, 0 community packs, serial 2: byte for byte/)]);
    const versions = (JSON.parse(file("library/index.json")) as RegistryIndex).core[SET]!.versions;
    expect(versions.map((v) => [v.v, v.review.approved])).toEqual([[1, 0], [2, 1]]);
  });
  it("writes nothing when the index refuses the change, and says why", async () => {
    writeFileSync(join(R, "tools/release/registry.json"), `${JSON.stringify({ yanked: { NOPE: "no such set" }, community: {} }, null, 1)}\n`);
    const before = written(), r = await review({ do: "approve", on: ref("Chest_Open"), note: "clean" });
    expect([r.status, r.lines[0]]).toEqual(["findings", expect.stringMatching(/^refused: approve .*not written: the registry index refused the change, so nothing is written \(npm run index: index: tools\/release\/registry.json yanks NOPE, which the index doesn't hold\)/)]);
    expect(written()).toEqual(before);
  });
});
