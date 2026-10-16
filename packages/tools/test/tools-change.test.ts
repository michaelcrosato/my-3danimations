// The Change tools (PLAN.md WP-7.2a's Done-when): fix and edit on every surface; their wrong calls refused naming the
// fix; a stale if_revision refused with the file unchanged; undo and redo restoring the exact bytes through one history
// for both tools; a file edited outside m3a resetting it; an in-place slice and chain; and a retried edit applied once,
// across two m3a processes (the durable store), within one MCP server, after a crash between the write and the record
// (the history's last), and after a crash at the history's write (nothing written) or the clip's (the history stepping
// back).
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { mcpServer } from "../src/mcp.ts";
import { nodeHost } from "../src/node.ts";
import { memoryStore, Registry, ToolError, type Reply, type RequestStore } from "../src/registry/index.ts";
import type { Tier } from "@m3a/library";
import { CHANGE } from "../src/tools/index.ts";
import { revisionOf, type History } from "../src/tools/workshop.ts";
import { exampleCwd, ROOT, runExamples } from "./helpers/surfaces.ts";

const BIN = join(import.meta.dirname, "../src/node.ts"), CLIP = "workshop/Punch_Left.json";
const PUNCH = { clip: "MESH2MOTION/Punch_Cross", save_as: "WORKSHOP/Punch_Left", ops: [{ op: "retime", speed: 1.3 }, { op: "mirror" }] };

/** A fresh working directory with the Change tools: their call, a file's text (null when absent), a clip's history. */
function workshop(store: RequestStore = memoryStore()) {
  const { cwd, rm } = exampleCwd(false), host = nodeHost(cwd), reg = new Registry(CHANGE, store);
  const file = (p: string) => (existsSync(join(cwd, p)) ? readFileSync(join(cwd, p), "utf8") : null);
  return { cwd, rm, host, file, call: (tool: string, args: object) => reg.call(tool, args, { host }), history: (name = "Punch_Left") => JSON.parse(file(`.m3a/history/${name}.json`)!) as History };
}
/** A reply's status, error code and message. */
const refused = (r: Reply) => [r.status, r.error?.code, r.error?.message];

describe("fix and edit on every surface", () => runExamples(CHANGE));

describe("the Change tools", () => {
  it("refuse wrong calls, naming the fix", async () => {
    const w = workshop();
    try {
      expect(refused(await w.call("fix", { clip: "QUATERNIUS_3D2DGE/Walk_Loop", ops: ["jiter"] }))).toEqual(["usage", "E_ARGS", expect.stringMatching(/ops\[0\] is "jiter", not one of .*; did you mean "jitter"\?/)]);
      for (const dry_run of [false, true]) expect(refused(await w.call("fix", { clip: "QUATERNIUS_3D2DGE/Walk_Loop", save_as: "MESH2MOTION/X", dry_run }))).toEqual(["usage", "E_ARGS", expect.stringMatching(/^save_as is "MESH2MOTION\/X": give save_as "WORKSHOP\/<Name>"/)]);
      expect(refused(await w.call("edit", { clip: '{"format":"2.0"}', ops: [{ op: "mirror" }] }))).toEqual(["usage", "E_ARGS", expect.stringMatching(/^the clip names no workshop copy: give save_as/)]);
      const ops = async (...list: object[]) => (await w.call("edit", { ...PUNCH, ops: list })).error?.message;
      expect(await ops({ op: "retme", speed: 1.3 })).toBe('ops[0].op: no operation "retme"; did you mean "retime"?');
      expect(await ops({ op: "retime", sped: 1.3 })).toMatch(/; ops\[0\]\.sped: retime has no field "sped"; did you mean "speed"\?$/);
      expect(await ops({ op: "mirror" }, { op: "slice", from: 0.1 })).toBe("ops[1]: slice comes first");
      expect(await ops({ op: "meta", nam: "x" })).toBe('ops[0]: meta has no field "nam"; did you mean "name"?');
      for (const o of [{ op: "mirror", in: "s1" }, { op: "mirror", as: "s9" }]) expect(await ops(o)).toBe("ops[0]: leave out in and as: each step reads the one before");
      expect(await ops({ op: "blend", a: "s1" })).toMatch(/^ops\[0\]\.op: blend names or composes clips \(a recipe's job\); edit changes one; one of slice, meta, mirror, retime,/);
      expect(await ops({ op: "mirror" }, { op: "meta", name: 7 })).toBe('ops[1].name: name is text; "name": "…"');
      expect(await ops()).toMatch(/^ops takes 1 to 16 recipe steps, not 0/);
      expect(refused(await w.call("edit", { clip: "WORKSHOP/Punch_Left", action: "undo" }))).toEqual(["error", "E_HISTORY", "nothing to undo for WORKSHOP/Punch_Left"]);
      expect(refused(await w.call("edit", { clip: "WORKSHOP/Punch_Left", action: "undo", ops: [] }))).toEqual(["usage", "E_ARGS", "undo takes no ops: it restores the clip as it was"]);
      expect(w.file(CLIP)).toBeNull();
      const saved = await w.call("fix", { clip: "QUATERNIUS_3D2DGE/Walk_Loop" }), text = w.file("workshop/Walk_Loop.json");
      expect([saved.status, saved.data, saved.lines.filter((l) => l.length > 90 || l.includes("→"))]).toEqual(["ok", expect.objectContaining({ saved: "WORKSHOP/Walk_Loop", after: { verdict: "pass", findings: 0 }, undo: 1 }), []]);
      for (const dry_run of [false, true]) expect(refused(await w.call("fix", { clip: "QUATERNIUS_3D2DGE/Walk_Loop", dry_run }))).toEqual(["error", "E_EXISTS", expect.stringMatching(/^WORKSHOP\/Walk_Loop exists at revision [0-9a-f]{12}; change it in place/)]);
      expect(w.file("workshop/Walk_Loop.json")).toBe(text);
      for (const dry_run of [true, false]) {
        const idle = await w.call("fix", { clip: "QUATERNIUS_3D2DGE/Idle_Loop", dry_run }); // a fix that changes nothing saves nothing
        expect([idle.verdict, idle.data, idle.revision, idle.next]).toEqual([expect.stringMatching(/; nothing changed, nothing saved$/), expect.objectContaining({ saved: null }), null, "nothing to fix: sheet QUATERNIUS_3D2DGE/Idle_Loop shows it"]);
      }
      expect(w.file("workshop/Idle_Loop.json")).toBeNull();
      const stamped = { provenance: { orig: "QUATERNIUS_3D2DGE/Walk_Loop", method: "edited", producer: { tool: "m3a-tools" }, ai: "humanEdits" }, quality: { qa: "unchecked", qaVersion: "none" } };
      expect(JSON.parse(text!)).toMatchObject(stamped);
      const reviewed = { ...JSON.parse(readFileSync(join(ROOT, "library/sets/QUATERNIUS_3D2DGE/Walk_Loop.json"), "utf8")), review: { state: "approved", by: "me", date: "2026-10-16", motion: "0".repeat(64) } };
      const dry = async (a: object) => (await w.call("fix", { clip: JSON.stringify(reviewed), dry_run: true, ...a })).next; // clip JSON names no copy
      expect([await dry({}), await dry({ save_as: "WORKSHOP/J" })]).toEqual(['fix with save_as "WORKSHOP/<Name>", without dry_run, saves it', "fix without dry_run saves it as WORKSHOP/J"]);
      writeFileSync(join(w.cwd, "rev.json"), JSON.stringify(reviewed)); // a review of the motion before the fix is dropped
      expect([(await w.call("fix", { clip: "rev.json" })).data, "review" in JSON.parse(w.file("workshop/rev.json")!)]).toMatchObject([{ saved: "WORKSHOP/rev" }, false]);
      // a workshop file is edited in place by its path, whatever id it holds; a file copy of it keeps its library origin
      for (const p of ["workshop/Odd.json", "mine.json"]) writeFileSync(join(w.cwd, p), text!);
      const odd = await w.call("edit", { clip: "WORKSHOP/Odd", ops: [{ op: "mirror" }] }), mine = await w.call("edit", { clip: "mine.json", ops: [{ op: "mirror" }] });
      expect([odd.status, odd.data, mine.data]).toMatchObject(["ok", { from: "QUATERNIUS_3D2DGE/Walk_Loop" }, { clip: "WORKSHOP/mine", from: "QUATERNIUS_3D2DGE/Walk_Loop" }]);
      expect((await w.call("edit", { clip: "./workshop/Odd.json", ops: [{ op: "mirror" }] })).data).toMatchObject({ clip: "WORKSHOP/Odd", undo: 2 });
      const sprint = await w.call("edit", { clip: "QUATERNIUS_3D2DGE/Sprint_Loop", ops: [{ op: "mirror" }] }); // 8 findings, 3 shown
      expect([sprint.status, sprint.lines.slice(3)]).toEqual(["findings", ["more: 5 findings (metrics WORKSHOP/Sprint_Loop lists them)", 'ops[0] {"op":"mirror"}']]);
      // a fixed clip is no longer its recipe's output: the recipe's hash goes, the origin stays
      await w.call("edit", { clip: "QUATERNIUS_3D2DGE/Walk_Loop", save_as: "WORKSHOP/Slow", ops: [{ op: "retime", speed: 1.2 }] });
      expect([(await w.call("fix", { clip: "WORKSHOP/Slow" })).status, JSON.parse(w.file("workshop/Slow.json")!).provenance]).toEqual(["ok", expect.not.objectContaining({ recipe: expect.anything() })]);
      expect(JSON.parse(w.file("workshop/Slow.json")!).provenance).toMatchObject({ orig: "QUATERNIUS_3D2DGE/Walk_Loop", method: "edited" });
    } finally {
      w.rm();
    }
  });

  it("refuse a stale if_revision with the file unchanged, and apply at the current one", async () => {
    const w = workshop();
    try {
      const first = await w.call("edit", { ...PUNCH, if_revision: "absent" }), text = w.file(CLIP)!;
      expect([first.status, first.revision]).toEqual(["ok", revisionOf(text)]);
      for (const stale of ["000000000000", "absent"]) {
        const r = await w.call("edit", { clip: "WORKSHOP/Punch_Left", ops: [{ op: "mirror" }], if_revision: stale });
        expect([...refused(r), r.revision]).toEqual(["error", "E_CONFLICT", `the target is at revision ${first.revision}, not "${stale}"; nothing was changed`, first.revision]);
      }
      expect(refused(await w.call("edit", PUNCH))).toEqual(["error", "E_EXISTS", expect.stringMatching(/^WORKSHOP\/Punch_Left exists at revision [0-9a-f]{12}; change it in place/)]);
      expect([w.file(CLIP), w.history().undo.length]).toEqual([text, 1]);
      const next = await w.call("edit", { clip: "WORKSHOP/Punch_Left", ops: [{ op: "mirror" }], if_revision: first.revision });
      const steps = [{ op: "clip", id: "MESH2MOTION/Punch_Cross" }, { op: "retime", speed: 1.3, in: "s1" }, { op: "mirror", in: "s2" }];
      const chained = { changed: true, license: { spdx: "CC0-1.0", credit: null }, undo: 2, recipe: expect.objectContaining({ steps: [...steps, { op: "mirror", in: "s3" }] }) };
      expect([next.status, next.data]).toEqual(["ok", expect.objectContaining(chained)]);
      expect((await w.call("edit", { clip: "WORKSHOP/Punch_Left", action: "undo" })).data).toMatchObject({ recipe: { steps } }); // the chain as it was
      const other = await w.call("edit", { clip: "QUATERNIUS_3D2DGE/Walk_Loop", save_as: "WORKSHOP/Punch_Left", ops: [{ op: "mirror" }], if_revision: first.revision });
      const undone = (await w.call("edit", { clip: "WORKSHOP/Punch_Left", action: "undo" })).data as Record<string, unknown>;
      // a replace compiles from the clip it names, not the target's chain; its undo restores the target's own rest
      expect([other.data, undone]).toMatchObject([{ from: "QUATERNIUS_3D2DGE/Walk_Loop", undo: 2, after: { dur: 1.333 } }, { from: "MESH2MOTION/Punch_Cross", recipe: { steps } }]);
      expect([undone.before, w.history().rest.H0]).toEqual([(other.data as Record<string, unknown>).after, 877.17]); // each side on its own rest
      // a clip put there by hand (no history) keeps its own origin and rest for the undo, replaced by edit or by fix
      const lib = (id: string) => readFileSync(join(ROOT, `library/sets/${id}.json`), "utf8");
      for (const [tool, mine, by, H0] of [["edit", "QUATERNIUS_3D2DGE/Walk_Loop", "MESH2MOTION/Punch_Cross", 916.7], ["fix", "MESH2MOTION/Punch_Cross", "QUATERNIUS_3D2DGE/Walk_Loop", 877.17]] as const) {
        rmSync(join(w.cwd, ".m3a/history/X.json"), { force: true });
        writeFileSync(join(w.cwd, "workshop/X.json"), lib(mine));
        await w.call(tool, { clip: by, save_as: "WORKSHOP/X", ...(tool === "edit" && { ops: [{ op: "mirror" }] }), if_revision: revisionOf(lib(mine)) });
        expect((await w.call("edit", { clip: "WORKSHOP/X", action: "undo" })).data).toMatchObject({ from: mine });
        expect([w.file("workshop/X.json"), w.history("X").rest.H0]).toEqual([lib(mine), H0]);
      }
    } finally {
      w.rm();
    }
  });

  it("write nothing when the target moves while the edit runs, and put the history back when the clip can't be written", async () => {
    const w = workshop(), base = nodeHost(w.cwd), HISTORY = ".m3a/history/Punch_Left.json";
    // the reply's status, code, message, revision and next when the target moved to `to` (or only its history did)
    const moved = (to: string, how = ` moved to revision ${revisionOf(to)} during the edit`) => ["error", "E_CONFLICT", `WORKSHOP/Punch_Left${how}; nothing was changed`, revisionOf(to), `read it again, then retry with --if_revision ${revisionOf(to)}`];
    // another writer puts `to` in `file` just before the `at`th read of the clip's file in a call (at 0: just before
    // the call takes the clip's lock to write)
    const race = async (at: number, to: string, args: object, file = CLIP) => {
      let reads = 0;
      const tryRead = (p: string) => (p === CLIP && ++reads === at && base.write!(file, to), base.tryRead!(p));
      const lock = (p: string) => (at === 0 && base.write!(file, to), base.lock!(p));
      const r = await new Registry(CHANGE).call("edit", args, { host: { ...base, tryRead, lock } });
      return [...refused(r), r.revision, r.next];
    };
    try {
      expect([await race(2, "{}\n", PUNCH), w.file(CLIP), w.file(HISTORY)]).toEqual([moved("{}\n"), "{}\n", null]);
      // after the registry's if_revision check: the run reads the other writer's file, the call's if_revision is stale
      const replace = { clip: "QUATERNIUS_3D2DGE/Walk_Loop", save_as: "WORKSHOP/Punch_Left", ops: [{ op: "mirror" }], if_revision: revisionOf("{}\n") };
      expect([await race(2, "[]\n", replace), w.file(CLIP), w.file(HISTORY)]).toEqual([moved("[]\n"), "[]\n", null]);
      // another edit that leaves the same bytes moves only the history: refused too, so its undo entry isn't lost
      expect([await race(0, "{}\n", { ...replace, if_revision: revisionOf("[]\n") }, HISTORY), w.file(CLIP), w.file(HISTORY)]).toEqual([moved("[]\n", `'s history moved during the edit (another edit, at revision ${revisionOf("[]\n")})`), "[]\n", "{}\n"]);
      rmSync(join(w.cwd, HISTORY));
      await w.call("edit", { ...PUNCH, save_as: "WORKSHOP/Punch_Right" });
      const [text, history] = ["workshop/Punch_Right.json", ".m3a/history/Punch_Right.json"].map(w.file);
      const full = {
        ...base,
        write: (p: string, d: string | Uint8Array) => {
          if (p.startsWith("workshop/")) throw new ToolError("E_WRITE", "can't write (ENOSPC)"); // a full disk, after the history
          return base.write!(p, d);
        },
      };
      const failed = await new Registry(CHANGE).call("edit", { clip: "WORKSHOP/Punch_Right", ops: [{ op: "mirror" }] }, { host: full });
      expect([failed.error?.code, ...["workshop/Punch_Right.json", ".m3a/history/Punch_Right.json"].map(w.file)]).toEqual(["E_WRITE", text, history]);
    } finally {
      w.rm();
    }
  });

  it("undo and redo restore the exact bytes, through one history for fix and edit", async () => {
    const w = workshop(), at = () => [w.file("workshop/Walk_Loop.json"), w.history("Walk_Loop").undo.length, w.history("Walk_Loop").redo.length];
    const go = async (args: object) => ((r) => [r.status, r.revision])(await w.call("edit", { clip: "WORKSHOP/Walk_Loop", ...args }));
    try {
      await w.call("fix", { clip: "QUATERNIUS_3D2DGE/Walk_Loop" });
      const fixed = w.file("workshop/Walk_Loop.json")!;
      expect(await go({ ops: [{ op: "mirror" }] })).toEqual(["ok", expect.any(String)]);
      const edited = w.file("workshop/Walk_Loop.json")!;
      expect(await go({ action: "undo" })).toEqual(["ok", revisionOf(fixed)]);
      expect(at()).toEqual([fixed, 1, 1]);
      expect(await go({ action: "undo" })).toEqual(["ok", "absent"]);
      expect(at()).toEqual([null, 0, 2]);
      expect(refused(await w.call("edit", { clip: "WORKSHOP/Walk_Loop", action: "undo" }))[1]).toBe("E_HISTORY");
      expect(await go({ action: "redo" })).toEqual(["ok", revisionOf(fixed)]);
      expect(await go({ action: "redo" })).toEqual(["ok", revisionOf(edited)]);
      expect(at()).toEqual([edited, 2, 0]);
      expect(refused(await w.call("edit", { clip: "WORKSHOP/Walk_Loop", action: "redo" }))).toEqual(["error", "E_HISTORY", "nothing to redo for WORKSHOP/Walk_Loop"]);
      await go({ action: "undo" });
      expect([await go({ ops: [{ op: "mirror" }] }), at().slice(1)]).toEqual([["ok", revisionOf(edited)], [2, 0]]); // an apply clears redo
      // a full undo stack drops its oldest entry
      const h = w.history("Walk_Loop"), head = h.head;
      writeFileSync(join(w.cwd, ".m3a/history/Walk_Loop.json"), JSON.stringify({ ...h, undo: Array.from({ length: 32 }, (_, i) => ({ ...h.undo[0], revision: `r${i}` })) }));
      await go({ ops: [{ op: "mirror" }] });
      const { undo } = w.history("Walk_Loop");
      expect([undo.length, undo[0]!.revision, undo[31]!.revision]).toEqual([32, "r1", head]);
    } finally {
      w.rm();
    }
  });

  it("start a new history when the file was edited outside m3a or the history is unreadable", async () => {
    const w = workshop();
    try {
      const first = await w.call("edit", PUNCH), hand = `${JSON.stringify({ ...JSON.parse(w.file(CLIP)!), desc: "by hand" })}\n`;
      writeFileSync(join(w.cwd, CLIP), hand);
      expect(refused(await w.call("edit", { clip: "WORKSHOP/Punch_Left", action: "undo" }))).toEqual(["error", "E_HISTORY", `WORKSHOP/Punch_Left changed outside m3a (revision ${revisionOf(hand)}, history at ${first.revision}); the next edit starts its history again`]);
      const next = await w.call("edit", { clip: "WORKSHOP/Punch_Left", ops: [{ op: "mirror" }] });
      expect(next.data).toMatchObject({ history_reset: true, undo: 1, redo: 0, recipe: null, before: { dur: 0.962 } });
      expect(JSON.parse(w.file(CLIP)!).provenance.orig).toBe("MESH2MOTION/Punch_Cross"); // compiled from the file, its origin kept
      expect((await w.call("edit", { clip: "WORKSHOP/Punch_Left", action: "undo" })).revision).toBe(revisionOf(hand));
      expect(w.file(CLIP)).toBe(hand);
      for (const bad of ["{", { undo: 7 }, { last: { tool: "edit" } }]) {
        writeFileSync(join(w.cwd, ".m3a/history/Punch_Left.json"), typeof bad === "string" ? bad : JSON.stringify({ ...w.history(), ...bad }));
        expect(refused(await w.call("edit", { clip: "WORKSHOP/Punch_Left", action: "redo" }))[2]).toBe("WORKSHOP/Punch_Left has an unreadable history (.m3a/history/Punch_Left.json); the next edit starts its history again");
        expect((await w.call("edit", { clip: "WORKSHOP/Punch_Left", ops: [{ op: "mirror" }] })).data).toMatchObject({ history_reset: true, undo: 1 });
      }
    } finally {
      w.rm();
    }
  });
});

describe("an edit in place", () => {
  it("cuts the clip as it is with a slice, and recompiles a chain of at most 32 steps", async () => {
    const w = workshop(), edit = async (args: object) => (await w.call("edit", { clip: "WORKSHOP/S", ...args })).data as { after: { dur: number }; recipe: { steps: unknown[] } | null };
    try {
      expect((await edit({ clip: "MESH2MOTION/Punch_Cross", save_as: "WORKSHOP/S", ops: [{ op: "slice", from: 0.5 }] })).after.dur).toBe(0.75);
      expect((await edit({ ops: [{ op: "meta", desc: "cut" }] })).recipe!.steps).toHaveLength(1);
      expect(await edit({ ops: [{ op: "meta", desc: "cut" }] })).toMatchObject({ changed: false, undo: 3 }); // the same bytes again
      expect(await edit({ action: "undo" })).toMatchObject({ changed: false, undo: 2, license: { spdx: "CC0-1.0" } });
      expect((await edit({ ops: [{ op: "slice", from: 0.2 }] })).after.dur).toBeCloseTo(0.55, 6);
      const mirrors = Array.from({ length: 16 }, () => ({ op: "mirror" }));
      expect((await edit({ clip: "MESH2MOTION/Punch_Cross", save_as: "WORKSHOP/M", ops: mirrors })).recipe!.steps).toHaveLength(17);
      expect((await edit({ clip: "WORKSHOP/M", ops: mirrors.slice(1) })).recipe!.steps).toHaveLength(32);
      expect((await edit({ clip: "WORKSHOP/M", ops: mirrors.slice(15) })).recipe).toBeNull();
      writeFileSync(join(w.cwd, "game.json"), '{"tiers": ["cc0", "cc-by"]}');
      expect((await edit({ clip: "STYLE100/Akimbo_Walk", save_as: "WORKSHOP/A", ops: [{ op: "mirror" }] })).recipe).not.toBeNull();
      writeFileSync(join(w.cwd, "game.json"), '{"tiers": ["cc0"]}'); // the library clip out of the game's tiers: compiled from the file
      expect(await edit({ clip: "WORKSHOP/A", ops: [{ op: "mirror" }] })).toMatchObject({ recipe: null, license: { spdx: "CC-BY-4.0" } });
      // a library clip changed since the copy (a later m3a): the chain goes, the edit compiles from the file as it is
      await edit({ clip: "MESH2MOTION/Punch_Cross", save_as: "WORKSHOP/L", ops: [{ op: "retime", speed: 1.3 }] });
      const host = nodeHost(w.cwd), later = (tiers?: readonly Tier[]) => {
        const l = host.library!(tiers), was = l.library.resolver(), swap = (id: string) => was(id === "MESH2MOTION/Punch_Cross" ? "MESH2MOTION/Punch_Jab" : id);
        return { ...l, library: new Proxy(l.library, { get: (o, k) => (k === "resolver" ? () => Object.assign(swap, { ids: was.ids }) : ((v: unknown) => (typeof v === "function" ? v.bind(o) : v))(Reflect.get(o, k))) }) };
      };
      const r = await new Registry(CHANGE).call("edit", { clip: "WORKSHOP/L", ops: [{ op: "meta", desc: "x" }] }, { host: { ...host, library: later } });
      expect(r.data).toMatchObject({ recipe: null, after: { dur: 0.962 } });
    } finally {
      w.rm();
    }
  });
});

/** Resolves when `p` has said `word` on stderr. */
const said = (p: ChildProcess, word: string) => new Promise<void>((ok) => p.stderr!.on("data", (d: Buffer) => d.toString().includes(word) && ok()));
/** Resolves to `p`'s exit code and stdout once it exits. */
function exited(p: ChildProcess): Promise<{ code: number | null; out: string }> {
  let out = "";
  p.stdout!.on("data", (d: Buffer) => void (out += d.toString()));
  return new Promise((ok) => p.on("close", (code) => ok({ code, out })));
}

describe("two m3a processes editing one clip", () => {
  it("never both apply: the second to write waits for the first's lock, then is refused (E_CONFLICT)", { timeout: 60_000 }, async () => {
    const { cwd, rm } = exampleCwd(false), race = pathToFileURL(join(import.meta.dirname, "helpers/race.ts")).href;
    const m3a = (speed: number, how: string) => spawn(process.execPath, ["--import", race, BIN, "edit", "WORKSHOP/C", "--ops", `[{"op":"retime","speed":${speed}}]`], { cwd, env: { ...process.env, M3A_RACE: how } });
    const read = (p: string) => readFileSync(join(cwd, p), "utf8");
    try {
      expect(spawnSync(process.execPath, [BIN, "edit", "QUATERNIUS_3D2DGE/Walk_Loop", "--save-as", "WORKSHOP/C", "--ops", '[{"op":"retime","speed":1.1}]'], { cwd }).status).toBe(0);
      const copy = revisionOf(read("workshop/C.json")), a = m3a(1.01, "pause"), aDone = exited(a);
      await said(a, "paused"); // a has written its history and holds back its clip's write
      const b = m3a(0.99, "wait"), bDone = exited(b);
      await Promise.race([said(b, "waiting"), bDone]); // b waits for a's lock (without one, it writes over a)
      writeFileSync(join(cwd, "m3a-race-go"), "");
      const [ra, rb] = await Promise.all([aDone, bDone]), text = read("workshop/C.json"), h = JSON.parse(read(".m3a/history/C.json")) as History;
      expect([ra.code, rb.code, rb.out]).toEqual([0, 1, expect.stringMatching(/^edit: error: WORKSHOP\/C moved to revision [0-9a-f]{12} during the edit; nothing was changed\n/)]);
      expect([ra.out, h.head, h.undo.map((e) => e.revision)]).toEqual([expect.stringContaining(`revision ${revisionOf(text)}`), revisionOf(text), ["absent", copy]]); // nothing lost
    } finally {
      rm();
    }
  });
});

describe("a retried edit applies once", () => {
  it("across two m3a processes, through the durable store", () => {
    const { cwd, rm } = exampleCwd(false), ops = (speed: number) => `[{"op":"retime","speed":${speed}},{"op":"mirror"}]`;
    const m3a = (...args: string[]) => spawnSync(process.execPath, [BIN, "edit", ...args, "--json"], { cwd, encoding: "utf8" });
    const run = (speed: number) => m3a(PUNCH.clip, "--save-as", PUNCH.save_as, "--ops", ops(speed), "--request-id", "b6-1");
    const read = (p: string) => readFileSync(join(cwd, p), "utf8");
    try {
      // another edit of the clip comes between the first call and its retry, so only the store knows the retry
      const first = run(1.3), report = read("check-output/edit/report.json"), between = m3a("WORKSHOP/Punch_Left", "--ops", '[{"op":"mirror"}]');
      const text = read(CLIP), again = run(1.3);
      expect([first.status, between.status, again.status, again.stdout, read("check-output/edit/report.json")]).toEqual([0, 0, 0, first.stdout, report]);
      expect([read(CLIP), (JSON.parse(read(".m3a/history/Punch_Left.json")) as { undo: unknown[] }).undo.length]).toEqual([text, 2]);
      const other = run(1.4);
      expect([other.status, other.stdout, read(CLIP)]).toEqual([2, expect.stringContaining("was first used with other arguments (they differ in ops)"), text]);
    } finally {
      rm();
    }
  });

  it("within one MCP server", async () => {
    const w = workshop(), server = mcpServer(new Registry(CHANGE), { host: w.host });
    const meta = { "io.modelcontextprotocol/protocolVersion": "2026-07-28", "io.modelcontextprotocol/clientCapabilities": {} };
    const params = { name: "edit", arguments: { ...PUNCH, request_id: "m-1" }, _meta: meta };
    const call = async () => ((await server.handle({ jsonrpc: "2.0", id: 1, method: "tools/call", params })) as { result: Record<string, unknown> }).result.structuredContent as Reply;
    try {
      const [first, again] = [await call(), await call()];
      expect([first.status, again, w.history().undo.length]).toEqual(["ok", first, 1]);
    } finally {
      w.rm();
    }
  });

  it("after a crash between the write and the record, through the history's last request", async () => {
    const lost: RequestStore = { get: () => undefined, set: () => void JSON.parse("{killed") };
    const w = workshop(lost), args = { ...PUNCH, request_id: "c-1", if_revision: "absent" };
    // the first reply warns that its record was lost; a fresh process (an empty store) replies it again, unwarned
    const twice = async (tool: string, a: object) => {
      const first = await w.call(tool, a), again = await new Registry(CHANGE).call(tool, a, { host: w.host });
      expect([first.lines[0], again]).toEqual([expect.stringMatching(/^warning: request_id "[a-z0-9-]+" was not kept \(.*\); a retry would apply it again$/), { ...first, lines: first.lines.slice(1) }]);
      return first;
    };
    try {
      expect((await twice("edit", args)).status).toBe("ok");
      const text = w.file(CLIP);
      expect(w.history().undo.length).toBe(1);
      for (const other of [{ ...args, ops: [{ op: "mirror" }] }, { ...PUNCH, request_id: "c-1" }]) {
        const r = await new Registry(CHANGE).call("edit", other, { host: w.host });
        expect([...refused(r).slice(0, 2), w.file(CLIP)]).toEqual(["usage", "E_REQUEST_ID", text]);
      }
      await twice("fix", { clip: "QUATERNIUS_3D2DGE/Walk_Loop", request_id: "f-1" });
      await twice("edit", { clip: "WORKSHOP/Walk_Loop", action: "undo", request_id: "f-1" }); // another tool's request_id
      expect([w.file("workshop/Walk_Loop.json"), w.history("Walk_Loop").redo.length]).toEqual([null, 1]);
    } finally {
      w.rm();
    }
  });

  it("after a crash between the history and the clip, the history stepping back to the file", async () => {
    const w = workshop(), base = nodeHost(w.cwd), retime = { ops: [{ op: "retime", speed: 2 }], request_id: "k-1" };
    let dead = false, at = ""; // killed at the first write under `at`, so nothing after it is written
    const write = (p: string, d: string | Uint8Array) => {
      if ((dead ||= p.startsWith(at))) throw new Error("killed");
      return base.write!(p, d);
    };
    const call = (args: object, host = base) => ((dead = false), new Registry(CHANGE).call("edit", { clip: "WORKSHOP/Punch_Left", ...args }, { host }));
    try {
      await w.call("edit", PUNCH);
      await w.call("edit", { clip: "WORKSHOP/Punch_Left", ops: [{ op: "mirror" }] });
      const text = w.file(CLIP);
      // killed at the history's write (the clip is written after it, so it is untouched), then at the clip's write
      for (at of [".m3a/history/", "workshop/"]) expect([(await call(retime, { ...base, write })).status, w.file(CLIP)]).toEqual(["error", text]);
      expect(refused(await call({ action: "redo" }))[1]).toBe("E_HISTORY"); // the cut-short apply is not offered to redo
      expect((await call(retime)).data).toMatchObject({ history_reset: false, undo: 3, redo: 0, after: { dur: 0.481 } }); // the retry applies once
      const retimed = w.file(CLIP);
      expect([(await call({ action: "undo" }, { ...base, write })).status, w.file(CLIP)]).toEqual(["error", retimed]);
      expect([(await call({ action: "undo" })).data, w.file(CLIP)]).toMatchObject([{ undo: 2, redo: 1 }, text]);
      expect([(await call({ action: "redo" }, { ...base, write })).status, w.file(CLIP)]).toEqual(["error", text]); // a redo cut short
      expect([(await call({ action: "redo" })).data, w.file(CLIP)]).toMatchObject([{ undo: 3, redo: 0 }, retimed]);
    } finally {
      w.rm();
    }
  });
});
