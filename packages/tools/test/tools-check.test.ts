// The check tools (PLAN.md WP-7.2a): each example the same on every surface; then each tool's failing input refused
// with its code and fix, and what the plan measured: the sheet's and film's sizes and token costs, the diff's regression
// gate both ways (and against a fixed copy given as JSON), lint's clean clip and its tag conflict.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { serialize, type Clip } from "@m3a/core";
import { fix } from "@m3a/sensors";
import { describe, expect, it } from "vitest";
import { nodeHost } from "../src/node.ts";
import { libraryAccess } from "../src/node/library.ts";
import { Registry, type Reply } from "../src/registry/index.ts";
import { CHECK } from "../src/tools/index.ts";
import { exampleCwd, ROOT, runExamples } from "./helpers/surfaces.ts";

const Q = "QUATERNIUS_3D2DGE/";
/** Calls a check tool on the Node host in a fresh working directory. */
async function call(tool: string, args: object): Promise<Reply<Record<string, unknown>>> {
  const { cwd, rm } = exampleCwd(false);
  try {
    return (await new Registry(CHECK).call(tool, args, { host: nodeHost(cwd) })) as Reply<Record<string, unknown>>;
  } finally {
    rm();
  }
}
/** A library clip's file as a Clip, to change and pass as JSON. */
const clipFile = (name: string) => JSON.parse(readFileSync(join(ROOT, "library/sets", `${Q}${name}.json`), "utf8")) as Clip;

describe("the check tools", () => {
  runExamples(CHECK);

  it("metrics: a clean clip passes; a misspelt clip names the closest, a limit of 0 its minimum", async () => {
    expect(await call("metrics", { clip: `${Q}Idle_Loop` })).toMatchObject({ status: "ok", verdict: `metrics ${Q}Idle_Loop: PASS, 2.500 s loop`, data: { total: 0, recorded: { qa: "pass", agrees: true } }, next: expect.stringMatching(/^the clip measures clean; sheet /) });
    expect((await call("metrics", { clip: `${Q}Walk_Lop` })).error).toEqual({ code: "E_NO_CLIP", message: `no clip "${Q}Walk_Lop"; did you mean "${Q}Walk_Loop"?` });
    const r = await call("metrics", { clip: `${Q}Walk_Loop`, limit: 1 });
    expect([r.status, (r.data!.findings as unknown[]).length, r.data!.more, r.lines.filter((l) => l.startsWith("more: 3"))]).toEqual(["findings", 1, 3, ["more: 3 (the first 1 shown)"]]);
    expect((await call("metrics", { clip: `${Q}Walk_Loop`, limit: 0 })).error).toEqual({ code: "E_ARGS", message: "limit is 0, below its minimum 1" });
  });

  it("sheet: 8 frames 1000x248 (~331 tokens), 16 frames 1000x404 (~539); an unknown view names the closest", async () => {
    const at = async (frames: number) => ((r) => [r.data!.width, r.data!.height, r.images[0]!.tokens, r.data!.flagged])(await call("sheet", { clip: `${Q}Walk_Loop`, frames }));
    expect(await at(8)).toEqual([1000, 248, 331, expect.arrayContaining([{ metric: "twistFlip", level: "fail", t0: 0.367, t1: 0.433 }])]);
    expect((await at(16)).slice(0, 3)).toEqual([1000, 404, 539]);
    expect((await call("sheet", { clip: `${Q}Walk_Loop`, view: "iso" })).error).toMatchObject({ code: "E_ARGS", message: expect.stringMatching(/^view is "iso", not one of front, side, back, top, three-quarter; did you mean/) });
  });

  it("film: the strike labelled in a strip at most 1,568 px wide; a moment past the end refused", async () => {
    const r = await call("film", { clip: `${Q}Punch_Jab` });
    expect([r.data!.strike, r.data!.width, r.data!.height, r.images[0]!.tokens, r.verdict]).toEqual([0.147, 1294, 200, 346, expect.stringContaining("strike at 0.147 s")]);
    expect((await call("film", { clip: `${Q}Walk_Loop`, frames: 16 })).data).toMatchObject({ strike: null, width: 1566, frames: 16 });
    expect(await call("film", { clip: `${Q}Punch_Jab`, around: 5 })).toMatchObject({ status: "usage", error: { code: "E_ARGS", message: "around is 5 s, past the clip's end (0.867 s)" } });
  });

  it("diff: findings when b is worse (verdict or findings), each way named; none against itself or a fixed copy", async () => {
    const back = await call("diff", { a: `${Q}Punch_Cross`, b: `${Q}Punch_Jab` });
    expect([back.status, back.data!.worse]).toEqual(["findings", expect.arrayContaining(["verdict warn → fail", "findings 1 → 3"])]);
    expect(back.next).toMatch(/^b is worse: keep a, or lint /);
    expect(await call("diff", { a: `${Q}Walk_Loop`, b: `${Q}Walk_Loop` })).toMatchObject({ status: "ok", verdict: expect.stringContaining(": no difference;"), data: { pose: { max: 0, over: [] }, pixels: { changed: 0, box: null }, worse: [] } });
    const walk = clipFile("Walk_Loop"), fixed = serialize(fix(walk, libraryAccess(ROOT, ["cc0"]).library.clip(walk.id).rest).clip);
    const better = await call("diff", { a: `${Q}Walk_Loop`, b: fixed });
    expect([better.status, (better.data!.metrics as { verdict: string[] }).verdict, (better.data!.pose as { max: number }).max > 0]).toEqual(["ok", ["fail", "pass"], true]);
    expect((await call("diff", { a: `${Q}Walk_Loop`, b: `${Q}Walk_Lop` })).error).toMatchObject({ code: "E_NO_CLIP", message: expect.stringContaining(`did you mean "${Q}Walk_Loop"`) });
  });

  it("lint: a clean clip has nothing to fix; a loop that doesn't close contradicts its tag; an invalid clip is refused", async () => {
    expect(await call("lint", { clip: `${Q}Idle_Loop` })).toMatchObject({ status: "ok", verdict: `lint ${Q}Idle_Loop: nothing to fix`, data: { repairs: [], tags: [], unanswered: [] } });
    const open = await call("lint", { clip: JSON.stringify({ ...clipFile("Death01"), loop: true, tags: ["loop"] }) });
    expect([open.status, (open.data!.tags as { tag: string }[]).map((t) => t.tag), open.lines.some((l) => l.startsWith("tag loop: its last pose is"))]).toEqual(["findings", ["loop"], true]);
    expect(await call("lint", { clip: '{"format":"2.0","id":"DEMO/Bad","dur":0}' })).toMatchObject({ status: "usage", error: { code: "E_CLIP", message: expect.stringMatching(/^the clip JSON is not a valid clip/) } });
  });
});
