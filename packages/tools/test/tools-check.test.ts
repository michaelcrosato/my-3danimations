// The check tools (PLAN.md WP-7.2a): each example the same on every surface; then each tool's failing input refused
// with its code and fix, and what each tool is for, pinned on library clips: metrics' status, caps and recorded verdict
// (a fail, a warn and a warn no repair answers), the sheet's flags and sizes, the film's frames centred on the strike
// with the strike and events named, the diff's pose numbers, image size, regression gate both ways and its order, and
// lint's repairs, tag conflicts and unanswered metrics.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { serialize, type Clip } from "@m3a/core";
import { fix, metrics, sheets } from "@m3a/sensors";
import { png } from "@m3a/sensors/node";
import { describe, expect, it } from "vitest";
import { nodeHost } from "../src/node.ts";
import { libraryAccess } from "../src/node/library.ts";
import { Registry, type Reply } from "../src/registry/index.ts";
import { CHECK } from "../src/tools/index.ts";
import { exampleCwd, ROOT, runExamples } from "./helpers/surfaces.ts";

const Q = "QUATERNIUS_3D2DGE/", TEAPOT = "STYLE100_SIDE/Teapot_SideLeft";
type Row = Record<string, unknown>;
/** Calls a check tool on the Node host in a fresh working directory, with game.json's tiers when given; its PNGs go to `pngs`. */
async function call(tool: string, args: object, tiers?: string[], pngs?: Map<string, Uint8Array>): Promise<Reply<Row>> {
  const { cwd, rm } = exampleCwd(false);
  try {
    if (tiers) writeFileSync(join(cwd, "game.json"), JSON.stringify({ tiers }));
    return (await new Registry(CHECK).call(tool, args, { host: nodeHost(cwd), pngs })) as Reply<Row>;
  } finally {
    rm();
  }
}
/** A library clip's file as a Clip, to change and pass as JSON. */
const clipFile = (name: string) => JSON.parse(readFileSync(join(ROOT, "library/sets", `${Q}${name}.json`), "utf8")) as Clip;
/** A library clip and its rest. */
const loaded = (id: string) => libraryAccess(ROOT, ["cc0"]).library.clip(id);

describe("the check tools", () => {
  runExamples(CHECK);

  it("metrics: fail is findings, rows cut to 90 characters with units; warn is ok; a misspelt clip and a limit of 0 refused", async () => {
    expect(await call("metrics", { clip: `${Q}Idle_Loop` })).toMatchObject({ status: "ok", verdict: `metrics ${Q}Idle_Loop: PASS, 2.500 s loop`, data: { total: 0, recorded: { qa: "pass", agrees: true } }, next: expect.stringMatching(/^the clip measures clean; sheet /) });
    const walk = (await call("metrics", { clip: `${Q}Walk_Loop` })).data!.findings as { message: string; unit: string; t0: number }[];
    expect([walk.length, walk.every((f) => f.message.length <= 90), walk[0]!.message.endsWith("..."), walk[0]!.unit, walk[0]!.t0]).toEqual([4, true, true, "degrees between keys (or per 0.1 s)", 0.367]);
    expect(await call("metrics", { clip: TEAPOT }, ["cc0", "cc-by"])).toMatchObject({ status: "ok", lines: [expect.stringMatching(/^WARN intersection: handR in hips/), "recorded: baselined with m3a-sensors@1, as measured"], data: { findings: [{ t0: 0.23, t1: 0.394, value: 1.02, unit: "of the thinner part's width" }], recorded: { agrees: true } }, next: "no repair answers intersection: search for another clip, or edit its keys" });
    expect((await call("metrics", { clip: `${Q}Walk_Lop` })).error).toEqual({ code: "E_NO_CLIP", message: `no clip "${Q}Walk_Lop"; did you mean "${Q}Walk_Loop"?` });
    const r = await call("metrics", { clip: `${Q}Walk_Loop`, limit: 1 });
    expect([r.status, (r.data!.findings as unknown[]).length, r.data!.more, r.lines.filter((l) => l.startsWith("more: 3"))]).toEqual(["findings", 1, 3, ["more: 3 (the first 1 shown)"]]);
    expect((await call("metrics", { clip: `${Q}Walk_Loop`, limit: 0 })).error).toEqual({ code: "E_ARGS", message: "limit is 0, below its minimum 1" });
  });

  it("sheet: the findings flagged in the image; 8 frames 1000x248 (~331 tokens), 16 frames 1000x404 (~539); an unknown view refused", async () => {
    const pngs = new Map<string, Uint8Array>(), at = async (frames: number) => ((r) => [r.data!.width, r.data!.height, r.images[0]!.tokens, r.data!.flagged])(await call("sheet", { clip: `${Q}Walk_Loop`, frames }, undefined, pngs));
    expect(await at(8)).toEqual([1000, 248, 331, expect.arrayContaining([{ metric: "twistFlip", level: "fail", t0: 0.367, t1: 0.433 }])]);
    const { clip, rest } = loaded(`${Q}Walk_Loop`), drawn = (flags: boolean) => Buffer.from(png(sheets.sheet(clip, rest, { frames: 8, width: 1000, flags: flags ? metrics(clip, rest).findings.map((f) => ({ t0: f.t0, t1: f.t1, label: f.metric })) : [] }).image));
    expect([true, false].map((f) => drawn(f).equals(Buffer.from(pngs.get(`${Q}Walk_Loop`.replace("/", "_"))!)))).toEqual([true, false]);
    expect((await at(16)).slice(0, 3)).toEqual([1000, 404, 539]);
    expect((await call("sheet", { clip: `${Q}Walk_Loop`, view: "iso" })).error).toMatchObject({ code: "E_ARGS", message: expect.stringMatching(/^view is "iso", not one of front, side, back, top, three-quarter; did you mean/) });
  });

  it("film: frames ±0.2 s around the strike, the strike and events named; around moves them; a moment past the end refused", async () => {
    const r = await call("film", { clip: JSON.stringify({ ...clipFile("Punch_Jab"), events: [{ t: 0.2, name: "hit" }] }) });
    expect(r.data).toMatchObject({ times: [0, 0.05, 0.099, 0.149, 0.198, 0.248, 0.297, 0.347], strike: 0.147, marks: [{ t: 0.147, name: "strike", frame: 3 }, { t: 0.2, name: "hit", frame: 4 }], width: 1294, height: 200, tokens: 346 });
    expect([r.verdict, r.lines[0]]).toEqual([expect.stringContaining("strike at 0.147 s"), "frames at 0.000, 0.050, 0.099, 0.149 (strike), 0.198 (hit), 0.248, 0.297, 0.347 s"]);
    // the same frames drawn: with the strike named, with an event too, and with neither (no attack tag, so no strike)
    const strip = async (change: object) => {
      const pngs = new Map<string, Uint8Array>();
      await call("film", { clip: JSON.stringify({ ...clipFile("Punch_Jab"), ...change }), around: 0.147 }, undefined, pngs);
      return Buffer.from([...pngs.values()][0]!);
    };
    const [named, evented, plain] = await Promise.all([strip({}), strip({ events: [{ t: 0.2, name: "hit" }] }), strip({ tags: [] })]);
    expect([named!.equals(evented!), named!.equals(plain!)]).toEqual([false, false]);
    expect((await call("film", { clip: `${Q}Punch_Jab`, around: 0.5 })).data).toMatchObject({ times: [0.3, 0.357, 0.414, 0.471, 0.529, 0.586, 0.643, 0.7], marks: [] });
    expect((await call("film", { clip: `${Q}Walk_Loop`, frames: 16 })).data).toMatchObject({ strike: null, width: 1566, frames: 16, times: expect.arrayContaining([0, 1.25]) });
    expect(await call("film", { clip: `${Q}Punch_Jab`, around: 5 })).toMatchObject({ status: "usage", error: { code: "E_ARGS", message: "around is 5 s, past the clip's end (0.867 s)" } });
  });

  it("diff: where poses part and the metrics that moved, in order; findings when b is worse, each way named first", async () => {
    const jab = await call("diff", { a: `${Q}Punch_Jab`, b: `${Q}Punch_Cross` });
    expect(jab.data).toMatchObject({ pose: { max: 788, point: "indexR", at: 0.278, mean: 488, over: [[0.016, 0.867]] }, metrics: { changed: ["pop", "twistFlip", "slide", "skate", "penetration", "jitter", "jointLimit", "fit"].map((metric) => ({ metric })) } });
    expect([jab.status, jab.images[0]!.width, jab.images[0]!.height, jab.images[0]!.tokens, jab.lines[0]]).toEqual(["ok", 750, 614, 614, expect.stringMatching(/^the image compares by phase .* so pixels.changed counts the floor too; the poses by time over the shorter 0.867 s$/)]);
    const back = await call("diff", { a: `${Q}Punch_Cross`, b: `${Q}Punch_Jab` });
    expect([back.status, back.data!.worse, back.verdict, back.lines.slice(0, 3)]).toEqual(["findings", ["verdict warn → fail", "pop 1740 → 11956, past its fail level", "findings 1 → 3"], expect.stringMatching(/; b is worse$/), (back.data!.worse as string[]).map((w) => `worse: ${w}`)]);
    expect(back.next).toMatch(/^b is worse: keep a, or lint /);
    const far = await call("diff", { a: `${Q}Walk_Loop`, b: "QUATERNIUS_SHARDFALL/Sword_Heavy_Combo_RM" });
    expect([far.lines[5], (far.data!.metrics as { changed: unknown[] }).changed.length, (far.data!.metrics as { more: number }).more]).toEqual(["b drawn on a's rest (UAL1): a clip's keys are rest-relative", 8, 1]);
    expect(await call("diff", { a: `${Q}Walk_Loop`, b: `${Q}Walk_Loop` })).toMatchObject({ status: "ok", lines: [], verdict: expect.stringContaining(": no difference;"), data: { pose: { max: 0, point: null, at: 0, mean: 0, over: [] }, pixels: { changed: 0, box: null }, worse: [] } });
    const walk = clipFile("Walk_Loop"), fixed = serialize(fix(walk, loaded(walk.id).rest).clip);
    const better = await call("diff", { a: `${Q}Walk_Loop`, b: fixed });
    expect([better.status, (better.data!.metrics as { verdict: string[] }).verdict, (better.data!.pose as { max: number }).max > 0]).toEqual(["ok", ["fail", "pass"], true]);
    expect((await call("diff", { a: `${Q}Walk_Loop`, b: `${Q}Walk_Lop` })).error).toMatchObject({ code: "E_NO_CLIP", message: expect.stringContaining(`did you mean "${Q}Walk_Loop"`) });
  });

  it("lint: repairs with 3 reasons each, a tag conflict alone, an unanswered metric; nothing to fix; an invalid clip refused", async () => {
    const walk = await call("lint", { clip: `${Q}Walk_Loop` }), repairs = walk.data!.repairs as { op: string; answers: number; why: string[] }[];
    expect([walk.status, repairs.map((r) => [r.op, r.answers, r.why.length]), repairs[0]!.why.every((w) => w.length <= 90), walk.lines.at(-1)]).toEqual(["findings", [["twistFlips", 4, 3]], true, "  more: 1"]);
    expect(await call("lint", { clip: JSON.stringify({ ...clipFile("Idle_Loop"), tags: ["run"] }) })).toMatchObject({ status: "findings", verdict: `lint ${Q}Idle_Loop: tag run doesn't hold`, data: { repairs: [], tags: [{ tag: "run" }] } });
    expect(await call("lint", { clip: TEAPOT }, ["cc0", "cc-by"])).toMatchObject({ status: "ok", verdict: `lint ${TEAPOT}: no repair answers intersection`, data: { repairs: [], unanswered: ["intersection"] }, next: expect.stringMatching(/^no repair answers intersection: search/) });
    expect(await call("lint", { clip: `${Q}Idle_Loop` })).toMatchObject({ status: "ok", verdict: `lint ${Q}Idle_Loop: nothing to fix`, data: { repairs: [], tags: [], unanswered: [] } });
    const open = await call("lint", { clip: JSON.stringify({ ...clipFile("Death01"), loop: true, tags: ["loop"] }) });
    expect([open.status, (open.data!.tags as { tag: string }[]).map((t) => t.tag), open.lines.some((l) => l.startsWith("tag loop: its last pose is"))]).toEqual(["findings", ["loop"], true]);
    expect(await call("lint", { clip: '{"format":"2.0","id":"DEMO/Bad","dur":0}' })).toMatchObject({ status: "usage", error: { code: "E_CLIP", message: expect.stringMatching(/^the clip JSON is not a valid clip/) } });
  });
});
