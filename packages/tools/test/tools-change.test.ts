// The Change tools (PLAN.md WP-7.2a's Done-when): fix and edit on every surface; their wrong calls refused naming the
// fix; a stale if_revision refused with the file unchanged; undo and redo restoring the exact bytes through one history
// for both tools; a file edited outside m3a resetting it; and a retried edit applied once, across two m3a processes
// (the durable store), within one MCP server, and after a crash between the write and the record (the history's last).
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { mcpServer } from "../src/mcp.ts";
import { nodeHost } from "../src/node.ts";
import { memoryStore, Registry, ToolError, type Reply, type RequestStore } from "../src/registry/index.ts";
import { CHANGE } from "../src/tools/index.ts";
import { revisionOf } from "../src/tools/workshop.ts";
import { exampleCwd, runExamples } from "./helpers/surfaces.ts";

const BIN = join(import.meta.dirname, "../src/node.ts"), CLIP = "workshop/Punch_Left.json";
const PUNCH = { clip: "MESH2MOTION/Punch_Cross", save_as: "WORKSHOP/Punch_Left", ops: [{ op: "retime", speed: 1.3 }, { op: "mirror" }] };

/** A fresh working directory with the Change tools: their call, a file's text (null when absent), a clip's history. */
function workshop(store: RequestStore = memoryStore()) {
  const { cwd, rm } = exampleCwd(false), host = nodeHost(cwd), reg = new Registry(CHANGE, store);
  const file = (p: string) => (existsSync(join(cwd, p)) ? readFileSync(join(cwd, p), "utf8") : null);
  return { cwd, rm, host, file, call: (tool: string, args: object) => reg.call(tool, args, { host }), history: (name = "Punch_Left") => JSON.parse(file(`.m3a/history/${name}.json`)!) as { undo: unknown[]; redo: unknown[] } };
}
/** A reply's status, error code and message. */
const refused = (r: Reply) => [r.status, r.error?.code, r.error?.message];

describe("fix and edit on every surface", () => runExamples(CHANGE));

describe("the Change tools", () => {
  it("refuse wrong calls, naming the fix", async () => {
    const w = workshop();
    try {
      expect(refused(await w.call("fix", { clip: "QUATERNIUS_3D2DGE/Walk_Loop", ops: ["jiter"] }))).toEqual(["usage", "E_ARGS", expect.stringMatching(/ops\[0\] is "jiter", not one of .*; did you mean "jitter"\?/)]);
      expect(refused(await w.call("fix", { clip: "QUATERNIUS_3D2DGE/Walk_Loop", save_as: "MESH2MOTION/X" }))).toEqual(["usage", "E_ARGS", expect.stringMatching(/^save_as is "MESH2MOTION\/X": give save_as "WORKSHOP\/<Name>"/)]);
      expect(refused(await w.call("edit", { clip: '{"format":"2.0"}', ops: [{ op: "mirror" }] }))).toEqual(["usage", "E_ARGS", expect.stringMatching(/^the clip names no workshop copy: give save_as/)]);
      const ops = async (...list: object[]) => (await w.call("edit", { ...PUNCH, ops: list })).error?.message;
      expect(await ops({ op: "retme", speed: 1.3 })).toBe('ops[0].op: no operation "retme"; did you mean "retime"?');
      expect(await ops({ op: "retime", sped: 1.3 })).toMatch(/; ops\[0\]\.sped: retime has no field "sped"; did you mean "speed"\?$/);
      expect(await ops({ op: "mirror" }, { op: "slice", from: 0.1 })).toBe("ops[1]: slice comes first");
      expect(await ops({ op: "meta", nam: "x" })).toBe('ops[0]: meta has no field "nam"; did you mean "name"?');
      expect(await ops({ op: "mirror", in: "s1" })).toBe("ops[0]: leave out in and as: each step reads the one before");
      expect(await ops()).toMatch(/^ops takes 1 to 16 recipe steps, not 0/);
      expect(refused(await w.call("edit", { clip: "WORKSHOP/Punch_Left", action: "undo" }))).toEqual(["error", "E_HISTORY", "nothing to undo for WORKSHOP/Punch_Left"]);
      expect(refused(await w.call("edit", { clip: "WORKSHOP/Punch_Left", action: "undo", ops: [] }))).toEqual(["usage", "E_ARGS", "undo takes no ops: it restores the clip as it was"]);
      expect(w.file(CLIP)).toBeNull();
      const saved = await w.call("fix", { clip: "QUATERNIUS_3D2DGE/Walk_Loop" }), text = w.file("workshop/Walk_Loop.json");
      expect([saved.status, saved.data]).toEqual(["ok", expect.objectContaining({ saved: "WORKSHOP/Walk_Loop", after: { verdict: "pass", findings: 0 }, undo: 1 })]);
      expect(refused(await w.call("fix", { clip: "QUATERNIUS_3D2DGE/Walk_Loop" }))).toEqual(["error", "E_EXISTS", expect.stringMatching(/^WORKSHOP\/Walk_Loop exists at revision [0-9a-f]{12}; change it in place/)]);
      expect(w.file("workshop/Walk_Loop.json")).toBe(text);
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
      expect([next.status, next.data]).toEqual(["ok", expect.objectContaining({ undo: 2, recipe: expect.objectContaining({ steps: [...steps, { op: "mirror", in: "s3" }] }) })]);
      expect((await w.call("edit", { clip: "WORKSHOP/Punch_Left", action: "undo" })).data).toMatchObject({ recipe: { steps } }); // the chain as it was
      const other = await w.call("edit", { clip: "QUATERNIUS_3D2DGE/Walk_Loop", save_as: "WORKSHOP/Punch_Left", ops: [{ op: "mirror" }], if_revision: first.revision });
      expect([other.data, (await w.call("edit", { clip: "WORKSHOP/Punch_Left", action: "undo" })).data]).toMatchObject([{ from: "QUATERNIUS_3D2DGE/Walk_Loop", undo: 2 }, { from: "MESH2MOTION/Punch_Cross", recipe: { steps } }]);
    } finally {
      w.rm();
    }
  });

  it("write nothing when the target moves while the edit runs, and put the history back when the clip can't be written", async () => {
    const w = workshop(), base = nodeHost(w.cwd);
    let reads = 0;
    const host = {
      ...base,
      tryRead: (p: string) => {
        if (p === CLIP && ++reads === 2) base.write!(CLIP, "{}\n"); // another writer, between the read and the write
        return base.tryRead!(p);
      },
    };
    try {
      const r = await new Registry(CHANGE).call("edit", PUNCH, { host });
      expect([...refused(r), w.file(CLIP), w.file(".m3a/history/Punch_Left.json")]).toEqual(["error", "E_CONFLICT", `WORKSHOP/Punch_Left moved to revision ${revisionOf("{}\n")} during the edit; nothing was changed`, "{}\n", null]);
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
    } finally {
      w.rm();
    }
  });

  it("start a new history when the file was edited outside m3a", async () => {
    const w = workshop();
    try {
      const first = await w.call("edit", PUNCH), hand = `${JSON.stringify({ ...JSON.parse(w.file(CLIP)!), desc: "by hand" })}\n`;
      writeFileSync(join(w.cwd, CLIP), hand);
      expect(refused(await w.call("edit", { clip: "WORKSHOP/Punch_Left", action: "undo" }))).toEqual(["error", "E_HISTORY", `WORKSHOP/Punch_Left changed outside m3a (revision ${revisionOf(hand)}, history at ${first.revision}); the next edit starts its history again`]);
      const next = await w.call("edit", { clip: "WORKSHOP/Punch_Left", ops: [{ op: "mirror" }] });
      expect(next.data).toMatchObject({ history_reset: true, undo: 1, redo: 0, recipe: null, before: { dur: 0.962 } });
      expect((await w.call("edit", { clip: "WORKSHOP/Punch_Left", action: "undo" })).revision).toBe(revisionOf(hand));
      expect(w.file(CLIP)).toBe(hand);
    } finally {
      w.rm();
    }
  });
});

describe("a retried edit applies once", () => {
  it("across two m3a processes, through the durable store", () => {
    const { cwd, rm } = exampleCwd(false), run = (speed: number) => spawnSync(process.execPath, [BIN, "edit", "MESH2MOTION/Punch_Cross", "--save-as", "WORKSHOP/Punch_Left", "--ops", `[{"op":"retime","speed":${speed}},{"op":"mirror"}]`, "--request-id", "b6-1", "--json"], { cwd, encoding: "utf8" });
    const read = (p: string) => readFileSync(join(cwd, p), "utf8");
    try {
      const first = run(1.3), report = read("check-output/edit/report.json"), again = run(1.3);
      expect([first.status, again.status, again.stdout, read("check-output/edit/report.json")]).toEqual([0, 0, first.stdout, report]);
      expect([JSON.parse(report).revision, (JSON.parse(read(".m3a/history/Punch_Left.json")) as { undo: unknown[] }).undo.length]).toEqual([revisionOf(read(CLIP)), 1]);
      const other = run(1.4);
      expect([other.status, other.stdout, JSON.parse(report).revision]).toEqual([2, expect.stringContaining("was first used with other arguments (they differ in ops)"), revisionOf(read(CLIP))]);
    } finally {
      rm();
    }
  });

  it("within one MCP server", async () => {
    const w = workshop(), server = mcpServer(new Registry(CHANGE), { host: w.host });
    const meta = { "io.modelcontextprotocol/protocolVersion": "2026-07-28", "io.modelcontextprotocol/clientCapabilities": {} };
    const call = async () => ((await server.handle({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "edit", arguments: { ...PUNCH, request_id: "m-1" }, _meta: meta } })) as { result: Record<string, unknown> }).result.structuredContent as Reply;
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
    try {
      const first = await w.call("edit", args), text = w.file(CLIP);
      expect([first.status, first.lines[0]]).toEqual(["ok", expect.stringMatching(/^warning: request_id "c-1" was not kept \(.*\); a retry would apply it again$/)]);
      const again = await new Registry(CHANGE).call("edit", args, { host: w.host }); // a fresh process: an empty store
      expect([again, w.file(CLIP), w.history().undo.length]).toEqual([{ ...first, lines: first.lines.slice(1) }, text, 1]);
      const other = await new Registry(CHANGE).call("edit", { ...args, ops: [{ op: "mirror" }] }, { host: w.host });
      expect([other.error?.code, w.file(CLIP)]).toEqual(["E_CONFLICT", text]); // not the same request: its if_revision holds
    } finally {
      w.rm();
    }
  });
});
