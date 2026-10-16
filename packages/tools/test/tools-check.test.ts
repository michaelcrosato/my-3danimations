// The check tools (PLAN.md WP-7.2a): each example the same on every surface; then each tool's failing input refused
// with its code and fix, and what each tool is for, pinned on library clips: metrics' status, values, caps and recorded
// verdict (a fail, a warn and a warn no repair answers, a stale one), the sheet's flags, view, sizes and cap, the film's
// frames centred on the strike with the strike and events named, and its picture (poses and root, forward, sideways and
// turning) and travel, the diff's pose numbers, travel (each clip's own), picture, sizes, regression gate both ways and
// its order, lint's repairs, tag conflicts and unanswered metrics, apart and mixed; and every hint naming the clip as
// given, in backticks (an id, a path, single-quoted when it must be, <the clip's JSON> or <the clip's file> for an
// absolute path or one with a control character).
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { clip as clipNs, serialize, type Clip } from "@m3a/core";
import { fix, metrics, sheets } from "@m3a/sensors";
import { png } from "@m3a/sensors/node";
import { describe, expect, it } from "vitest";
import { nodeHost } from "../src/node.ts";
import { libraryAccess } from "../src/node/library.ts";
import { Registry, type Reply } from "../src/registry/index.ts";
import { strip } from "../src/sim/film.ts";
import { drawn } from "../src/tools/check.ts";
import { CHECK } from "../src/tools/index.ts";
import { exampleCwd, hintedCalls, ROOT, runExamples } from "./helpers/surfaces.ts";

const Q = "QUATERNIUS_3D2DGE/", TEAPOT = "STYLE100_SIDE/Teapot_SideLeft", SWORD = "QUATERNIUS_SHARDFALL/Sword_Heavy_Combo_RM", TURN = "MESH2MOTION/Sword_Regular_C_RM";
type Row = Record<string, unknown>;
/** Calls a check tool on the Node host in a fresh working directory holding `files` and game.json's `tiers` when given;
 *  its PNGs go to `pngs`. `args` may be made from the working directory's path. */
async function call(tool: string, args: object | ((cwd: string) => object), o: { tiers?: string[]; pngs?: Map<string, Uint8Array>; files?: Record<string, string> } = {}): Promise<Reply<Row>> {
  const { cwd, rm } = exampleCwd(false);
  try {
    for (const [f, text] of Object.entries({ ...o.files, ...(o.tiers ? { "game.json": JSON.stringify({ tiers: o.tiers }) } : {}) })) writeFileSync(join(cwd, f), text);
    return (await new Registry(CHECK).call(tool, typeof args === "function" ? args(cwd) : args, { host: nodeHost(cwd), pngs: o.pngs })) as Reply<Row>;
  } finally {
    rm();
  }
}
/** A library clip's file as a Clip, to change and pass as JSON. */
const clipFile = (name: string) => JSON.parse(readFileSync(join(ROOT, "library/sets", `${Q}${name}.json`), "utf8")) as Clip;
/** The one PNG a call wrote. */
const only = (pngs: Map<string, Uint8Array>) => Buffer.from([...pngs.values()][0]!);
/** A library clip and its rest. */
const loaded = (id: string) => libraryAccess(ROOT, ["cc0"]).library.clip(id);

describe("the check tools", () => {
  runExamples(CHECK);

  it("metrics: fail is findings, rows cut to 90 characters with units; warn is ok; a stale verdict; hints name the clip as given; a misspelt clip and a limit of 0 refused", async () => {
    expect(await call("metrics", { clip: `${Q}Idle_Loop` })).toMatchObject({ status: "ok", verdict: `metrics ${Q}Idle_Loop: PASS, 2.500 s loop`, data: { total: 0, recorded: { qa: "pass", agrees: true } }, next: expect.stringMatching(/^the clip measures clean; `sheet /) });
    const w = await call("metrics", { clip: `${Q}Walk_Loop` }), walk = w.data!.findings as { message: string; unit: string; t0: number }[];
    expect([walk.length, walk.every((f) => f.message.length <= 90), walk[0]!.message.endsWith("..."), walk[0]!.unit, walk[0]!.t0]).toEqual([4, true, true, "degrees between keys (or per 0.1 s)", 0.367]);
    expect(w.data!.values).toMatchObject({ twistFlip: 175, pop: 483.4, slide: 83.4 });
    expect(await call("metrics", { clip: TEAPOT }, { tiers: ["cc0", "cc-by"] })).toMatchObject({ status: "ok", lines: [expect.stringMatching(/^WARN intersection: handR in hips/), "recorded: baselined with m3a-sensors@1, as measured"], data: { findings: [{ t0: 0.23, t1: 0.394, value: 1.02, unit: "of the thinner part's width" }], recorded: { agrees: true } }, next: "no repair answers intersection: search for another clip, or edit its keys" });
    const file = clipFile("Walk_Loop"), stale = await call("metrics", { clip: JSON.stringify({ ...file, quality: { ...file.quality, qaVersion: "m3a-sensors@0" } }) });
    expect([stale.verdict, stale.data!.recorded, stale.lines.at(-1), stale.next]).toEqual([`metrics ${Q}Walk_Loop (the clip's JSON): FAIL (2 fail, 2 warn), 1.333 s loop`, { qa: "baselined", qaVersion: "m3a-sensors@0", current: false, agrees: false }, "recorded: baselined with m3a-sensors@0, not the current m3a-sensors@1", "`lint <the clip's JSON>` names the repairs; `sheet <the clip's JSON>` shows the findings in red"]);
    expect(await call("metrics", { clip: "walk.json" }, { files: { "walk.json": JSON.stringify(file) } })).toMatchObject({ verdict: expect.stringMatching(/^metrics walk.json: FAIL/), data: { clip: `${Q}Walk_Loop` }, next: "`lint walk.json` names the repairs; `sheet walk.json` shows the findings in red" });
    // a path with a space or a control character JSON-quoted; an absolute one, like JSON, never echoed
    const abs = await call("metrics", (cwd) => ({ clip: join(cwd, "walk.json") }), { files: { "walk.json": JSON.stringify(file) } });
    expect([abs.verdict, abs.next, JSON.stringify(abs).includes("walk.json")]).toEqual([`metrics ${Q}Walk_Loop (the clip's file): FAIL (2 fail, 2 warn), 1.333 s loop`, "`lint <the clip's file>` names the repairs; `sheet <the clip's file>` shows the findings in red", false]);
    const odd = await call("diff", { a: "my walk.json", b: "a\nb.json" }, { files: { "my walk.json": JSON.stringify(file), "a\nb.json": JSON.stringify(file) } });
    expect([odd.verdict, odd.next]).toEqual([`diff 'my walk.json' → ${Q}Walk_Loop (b's file): no difference; FAIL → FAIL (4 → 4 findings)`, "open the image: magenta marks what moved; `metrics <b's file>` gives b's findings"]); // a control character: not echoed
    const spaced = await call("metrics", { clip: "my walk.json" }, { files: { "my walk.json": JSON.stringify(file) } }); // its hints run as written
    expect(hintedCalls(spaced.next)).toEqual(["lint", "sheet"].map((tool) => ({ call: `${tool} 'my walk.json'`, tool, args: { clip: "my walk.json" } })));
    expect((await call("metrics", { clip: `${Q}Walk_Lop` })).error).toEqual({ code: "E_NO_CLIP", message: `no clip "${Q}Walk_Lop"; did you mean "${Q}Walk_Loop"?` });
    const r = await call("metrics", { clip: `${Q}Walk_Loop`, limit: 1 });
    expect([r.status, (r.data!.findings as unknown[]).length, r.data!.more, r.lines.filter((l) => l.startsWith("more: 3"))]).toEqual(["findings", 1, 3, [`more: 3 findings (\`metrics ${Q}Walk_Loop --limit 4\` lists them)`]]);
    expect((await call("metrics", { clip: `${Q}Walk_Loop`, limit: 0 })).error).toEqual({ code: "E_ARGS", message: "limit is 0, below its minimum 1" });
  });

  it("sheet: the findings flagged in the image, in the view asked; cells at most 125 px: 4 frames 500 px wide, 8 1000x248 (~331 tokens), 16 1000x404 (~539); an unknown view refused", async () => {
    const pngs = new Map<string, Uint8Array>(), at = async (frames: number, view = "three-quarter") => ((r) => ({ size: [r.data!.width, r.data!.height, r.images[0]!.tokens], flagged: r.data!.flagged, img: only(pngs) }))(await call("sheet", { clip: `${Q}Walk_Loop`, frames, view }, { pngs }));
    const { clip, rest } = loaded(`${Q}Walk_Loop`), flags = metrics(clip, rest).findings.map((f) => ({ t0: f.t0, t1: f.t1, label: f.metric }));
    const want = (view: "side" | "three-quarter", fl = flags) => Buffer.from(png(sheets.sheet(clip, rest, { frames: 8, width: 1000, view, flags: fl }).image));
    const eight = await at(8);
    expect([eight.size, eight.flagged, eight.img.equals(want("three-quarter")), eight.img.equals(want("three-quarter", []))]).toEqual([[1000, 248, 331], expect.arrayContaining([{ metric: "twistFlip", level: "fail", t0: 0.367, t1: 0.433 }]), true, false]);
    expect((await at(8, "side")).img.equals(want("side"))).toBe(true);
    expect([(await at(16)).size, (await at(4)).size[0]]).toEqual([[1000, 404, 539], 500]);
    expect((await call("sheet", { clip: `${Q}Walk_Loop`, view: "iso" })).error).toMatchObject({ code: "E_ARGS", message: expect.stringMatching(/^view is "iso", not one of front, side, back, top, three-quarter; did you mean/) });
  });

  it("film: frames ±0.2 s around the strike, the strike and events named; around moves them; its picture the poses and root at those times; a moment past the end refused", async () => {
    const r = await call("film", { clip: JSON.stringify({ ...clipFile("Punch_Jab"), events: [{ t: 0.2, name: "hit" }] }) });
    expect(r.data).toMatchObject({ times: [0, 0.05, 0.099, 0.149, 0.198, 0.248, 0.297, 0.347], strike: 0.147, marks: [{ t: 0.147, name: "strike", frame: 3 }, { t: 0.2, name: "hit", frame: 4 }], width: 1294, height: 200, tokens: 346 });
    expect([r.verdict, r.lines[0]]).toEqual([expect.stringContaining("strike at 0.147 s"), "frames at 0.000, 0.050, 0.099, 0.149 (strike), 0.198 (hit), 0.248, 0.297, 0.347 s"]);
    // the same frames drawn: with the strike named, with an event too, and with neither (no attack tag, so no strike)
    const strips = async (change: object) => {
      const pngs = new Map<string, Uint8Array>();
      await call("film", { clip: JSON.stringify({ ...clipFile("Punch_Jab"), ...change }), around: 0.147 }, { pngs });
      return only(pngs);
    };
    const [named, evented, plain] = await Promise.all([strips({}), strips({ events: [{ t: 0.2, name: "hit" }] }), strips({ tags: [] })]);
    expect([named!.equals(evented!), named!.equals(plain!)]).toEqual([false, false]);
    const long = await call("film", { clip: JSON.stringify({ ...clipFile("Punch_Jab"), events: [{ t: 0.2, name: "x".repeat(200) }] }) });
    expect([(long.data!.marks as { name: string }[])[1]!.name.length, long.lines[0]!.includes("x".repeat(200))]).toEqual([90, true]);
    // each frame its pose and its root in mm at its time, labelled with the time: on a clip that travels and turns (61 →
    // 939 mm, -37° → -255° over these frames), and on one that moves sideways (550 → 1907 mm right)
    const filmed = async (id: string, around: number) => {
      const pngs = new Map<string, Uint8Array>(), r = await call("film", { clip: id, around }, { pngs }), { clip: c, rest: R } = loaded(id);
      const [t0, t1] = [around - 0.2, around + 0.2], ts = Array.from({ length: 8 }, (_, i) => t0 + ((t1 - t0) * i) / 7);
      const root = (t: number) => ((p) => ({ forward: (p.forward * R.H0) / 100, right: (p.right * R.H0) / 100, yaw: p.yaw }))(clipNs.rootAt(c, t));
      expect(only(pngs).equals(Buffer.from(png(strip(ts.map((t) => clipNs.sample(c, t, R)), ts.map(root), ts.map((t) => `${t.toFixed(2)} S`)))))).toBe(true);
      return r;
    };
    const [turn, dodge] = [await filmed(TURN, 0.3), await filmed("MESH2MOTION/Dodge_right_RM", 0.4)];
    expect([turn.data!.travel, turn.lines[1], turn.next]).toEqual([[1491, 0], "travels 1491 mm forward, 0 mm right over 1.667 s", `\`sheet ${TURN}\` shows the whole clip with its findings; \`metrics ${TURN}\` measures it`]);
    expect([dodge.data!.travel, dodge.lines[1]]).toEqual([[0, 1962], "travels 0 mm forward, 1962 mm right over 0.833 s"]);
    expect((await call("film", { clip: `${Q}Punch_Jab`, around: 0.5 })).data).toMatchObject({ times: [0.3, 0.357, 0.414, 0.471, 0.529, 0.586, 0.643, 0.7], marks: [] });
    expect((await call("film", { clip: `${Q}Punch_Jab`, frames: 1, around: 0.3 })).data).toMatchObject({ times: [0.3], marks: [] });
    expect(await call("film", { clip: `${Q}Walk_Loop`, frames: 16 })).toMatchObject({ data: { strike: null, width: 1566, frames: 16, times: expect.arrayContaining([0, 1.25]) }, next: `\`film ${Q}Walk_Loop --around <seconds>\` zooms on a moment; \`sheet ${Q}Walk_Loop\` shows contacts and findings` });
    // past the last frame (1.25 s, a step 0.083 s) an event is named within half a step, not beyond
    const late = await call("film", { clip: JSON.stringify({ ...clipFile("Walk_Loop"), events: [{ t: 1.28, name: "late" }, { t: 1.3, name: "past" }] }), frames: 16 });
    expect(late.data!.marks).toEqual([{ t: 1.28, name: "late", frame: 15 }]);
    expect(await call("film", { clip: `${Q}Punch_Jab`, around: 5 })).toMatchObject({ status: "usage", error: { code: "E_ARGS", message: "around is 5 s, past the clip's end (0.867 s)" } });
  });

  it("diff: where poses part, travel and the metrics that moved, in order; its picture b against a; findings when b is worse, each way named first", async () => {
    const pngs = new Map<string, Uint8Array>(), jab = await call("diff", { a: `${Q}Punch_Jab`, b: `${Q}Punch_Cross` }, { pngs }), [a, b] = [loaded(`${Q}Punch_Jab`), loaded(`${Q}Punch_Cross`)];
    expect(jab.data).toMatchObject({ pose: { max: 788, point: "indexR", at: 0.278, mean: 488, over: [[0.016, 0.867]] }, pixels: { changed: expect.any(Number), box: { w: expect.any(Number) } }, metrics: { changed: ["pop", "twistFlip", "slide", "skate", "penetration", "jitter", "jointLimit", "fit"].map((metric) => ({ metric })) } });
    expect([jab.status, jab.images[0]!.width, jab.images[0]!.height, jab.images[0]!.tokens, jab.lines[0], (jab.data!.pixels as { changed: number }).changed > 0]).toEqual(["ok", 750, 614, 614, expect.stringMatching(/^the image compares by phase .* so pixels.changed counts the floor too; the poses by time over the shorter 0.867 s$/), true]);
    expect(only(pngs).equals(Buffer.from(png(sheets.compareClips(a.clip, b.clip, a.rest, { frames: 6, width: 750 }).image)))).toBe(true);
    expect((await call("diff", { a: `${Q}Punch_Jab`, b: `${Q}Punch_Cross`, frames: 8 })).images[0]).toMatchObject({ width: 1000, height: 752, tokens: 1003 });
    const back = await call("diff", { a: `${Q}Punch_Cross`, b: `${Q}Punch_Jab` });
    expect([back.status, back.data!.worse, back.verdict, back.lines.slice(0, 3)]).toEqual(["findings", ["verdict warn → fail", "pop 1740 → 11956, past its fail level", "findings 1 → 3"], expect.stringMatching(/; b is worse$/), (back.data!.worse as string[]).map((w) => `worse: ${w}`)]);
    expect(back.next).toMatch(/^b is worse: keep a, or `lint /);
    const far = await call("diff", { a: `${Q}Walk_Loop`, b: SWORD });
    expect([far.lines[5], (far.data!.metrics as { changed: unknown[] }).changed.length, (far.data!.metrics as { more: number }).more, far.data!.travel, far.lines.at(-1)]).toEqual(["b drawn on a's rest (UAL1): a clip's keys are rest-relative", 8, 1, { a: [0, 0], b: [5326, 0] }, "travel 0 mm, 0 mm → 5326 mm, 0 mm (forward, right)"]);
    // each clip's travel on its own rest, as film gives it (b's would be 1558 mm on a's): a's sideways, b's forward
    const side = await call("diff", { a: "MESH2MOTION/Dodge_left_RM", b: TURN });
    expect([side.data!.travel, side.lines.at(-1)]).toEqual([{ a: [0, -1962], b: [1491, 0] }, "travel 0 mm, -1962 mm → 1491 mm, 0 mm (forward, right)"]);
    expect(await call("diff", { a: `${Q}Walk_Loop`, b: `${Q}Walk_Loop` })).toMatchObject({ status: "ok", lines: [], verdict: expect.stringContaining(": no difference;"), data: { pose: { max: 0, point: null, at: 0, mean: 0, over: [] }, pixels: { changed: 0, box: null }, worse: [] } });
    // a loop's last pose is its cycle's end, not its first: an open loop matches its one-shot
    const death = clipFile("Death01");
    expect((await call("diff", { a: JSON.stringify({ ...death, loop: true }), b: `${Q}Death01` })).verdict).toMatch(/^diff QUATERNIUS_3D2DGE\/Death01 \(a's JSON\) → QUATERNIUS_3D2DGE\/Death01: the same poses;/);
    // the head turned 10° on every other key: ten intervals over 5 mm, five shown
    const walk = clipFile("Walk_Loop"), nod = { ...walk, keys: walk.keys.map((k, i) => (i % 2 ? { ...k, head: [k.head![0]! + 10, k.head![1]!, k.head![2]!] } : k)) };
    expect(await call("diff", { a: `${Q}Walk_Loop`, b: JSON.stringify(nod) })).toMatchObject({ data: { pose: { over: { length: 5 }, more: 5 } }, lines: expect.arrayContaining(["more: 5 intervals"]) });
    const better = await call("diff", { a: `${Q}Walk_Loop`, b: serialize(fix(walk, loaded(walk.id).rest).clip) });
    expect([better.status, (better.data!.metrics as { verdict: string[] }).verdict, better.verdict, better.next]).toEqual(["ok", ["fail", "pass"], expect.stringMatching(/^diff QUATERNIUS_3D2DGE\/Walk_Loop → QUATERNIUS_3D2DGE\/Walk_Loop \(b's JSON\): poses differ up to 162 mm/), "open the image: magenta marks what moved; `metrics <b's JSON>` gives b's findings"]);
    expect((await call("diff", { a: `${Q}Walk_Loop`, b: `${Q}Walk_Lop` })).error).toMatchObject({ code: "E_NO_CLIP", message: expect.stringContaining(`did you mean "${Q}Walk_Loop"`) });
    // two long ids still name an image the file system takes
    const long = (n: string) => JSON.stringify({ ...walk, id: `MINE/${n.repeat(200)}` }), both = await call("diff", { a: long("A"), b: long("B") });
    expect([both.status, both.images[0]!.name]).toEqual(["ok", expect.stringMatching(/^MINE_A{75}-[0-9a-f]{12}$/)]);
  });

  it("lint: repairs with 3 reasons each, a tag conflict alone, an unanswered metric, refit; nothing to fix; an invalid clip refused", async () => {
    const walk = await call("lint", { clip: `${Q}Walk_Loop` }), repairs = walk.data!.repairs as { op: string; reasons: number; why: string[] }[];
    expect([walk.status, repairs.map((r) => [r.op, r.reasons, r.why.length]), repairs[0]!.why.every((w) => w.length <= 90), walk.lines.at(-1)]).toEqual(["findings", [["twistFlips", 4, 3]], true, "  more: 1 reason"]);
    expect(await call("lint", { clip: JSON.stringify({ ...clipFile("Idle_Loop"), tags: ["run"] }) })).toMatchObject({ status: "findings", verdict: `lint ${Q}Idle_Loop (the clip's JSON): tag run doesn't hold`, data: { repairs: [], tags: [{ tag: "run" }] }, next: "`edit <the clip's JSON> --save_as WORKSHOP/<Name> --ops '[{\"op\":\"meta\",\"tags\":[]}]'` drops run; or search for another clip" });
    expect(await call("lint", { clip: TEAPOT }, { tiers: ["cc0", "cc-by"] })).toMatchObject({ status: "ok", verdict: `lint ${TEAPOT}: no repair answers intersection`, data: { repairs: [], unanswered: ["intersection"] }, next: expect.stringMatching(/^no repair answers intersection: search/) });
    expect(await call("lint", { clip: `${Q}Idle_Loop` })).toMatchObject({ status: "ok", verdict: `lint ${Q}Idle_Loop: nothing to fix`, data: { repairs: [], tags: [], unanswered: [] } });
    expect(await call("lint", { clip: "MESH2MOTION/Angry" })).toMatchObject({ status: "findings", verdict: "lint MESH2MOTION/Angry: fix refit", data: { repairs: [{ op: "refit", reasons: 1 }] } });
    const open = await call("lint", { clip: JSON.stringify({ ...clipFile("Death01"), loop: true, tags: ["loop", "run"] }) }), tags = open.data!.tags as { tag: string; message: string }[];
    expect([open.status, tags.map((t) => [t.tag, t.message.length]), open.lines.filter((l) => l.startsWith("tag ")).map((l) => l.length), open.next]).toEqual(["findings", [["loop", 70], ["run", 90]], [80, 101], "`fix <the clip's JSON>` applies twistFlips, jitter, seam, keeping only steps that don't make it worse; diff it with the fixed copy"]);
    expect(await call("lint", { clip: '{"format":"2.0","id":"DEMO/Bad","dur":0}' })).toMatchObject({ status: "usage", error: { code: "E_CLIP", message: expect.stringMatching(/^the clip JSON is not a valid clip/) } });
  });

  it("a clip some of whose findings a repair answers: metrics sends it to lint, lint counts those, sheet flags 10 of 23", async () => {
    const RUSHED = "STYLE100/Rushed_Walk", o = { tiers: ["cc0", "cc-by"] }, [m, l, s] = [await call("metrics", { clip: RUSHED }, o), await call("lint", { clip: RUSHED }, o), await call("sheet", { clip: RUSHED }, o)];
    expect([m.next, l.verdict]).toEqual([`\`lint ${RUSHED}\` names the repairs; \`sheet ${RUSHED}\` shows the findings in red`, `lint ${RUSHED}: fix twistFlips, jitter, penetration, footLocks (17 findings); no repair answers intersection, fit, jointLimit`]);
    expect([(s.data!.flagged as unknown[]).length, s.data!.more, s.lines.length, s.lines.at(-1)]).toEqual([10, 13, 11, `more: 13 findings (\`metrics ${RUSHED} --limit 23\` lists them)`]);
  });

  it("a drawing with no body is E_BLANK, naming the times; other errors pass", () => {
    const blank = () => {
      throw new Error("sheet X: no body drawn in 1 of 8 frames (at 0.50 s)");
    };
    expect(() => drawn(blank)).toThrow(expect.objectContaining({ code: "E_BLANK", message: "no body drawn in 1 of 8 frames (at 0.50 s)", usage: false }));
    expect(() => drawn(() => JSON.parse("{"))).toThrow(SyntaxError);
  });
});
