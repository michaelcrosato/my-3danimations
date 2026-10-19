// Exchange (PLAN.md WP-7.2b): import and export on every surface (import listed to MCP as no read-only tool), then
// their failing inputs (a catalog off its shape or no JSON, every take skipped, a game.json that isn't JSON: each
// refusal one line); an imported set that the library opens as a local set (openLibrary on imports/), which
// license.check fails for a shipped game and passes for one that stays on the machine (D10), its rest take held a frame,
// imported again in place under a credited license (the host's library opened again, at most MAX_OPEN kept, the least
// lately used dropped; every clip file an import wrote that it doesn't write removed and named, so the set verifies, a
// first import's cut short too; any other .json there refusing it, nothing changed; a file where its directory goes
// refused by the host's write, named as given), a broken imported set left out
// with a warning, breaking no other, and one named as a library set left out, import refusing the name (its manifest
// the library's own too); and a clip exported as VRMA (read back byte for byte), .glb (onto Rigify's turned and scaled
// armature too; off, findings, under an uneven scale) and BVH, each read back through io within 1 mm, the VRMA then
// imported again, and the BVH jittered, from an absolute path, past the fit limits, its hint naming the catalog as given
// (a name the shell would split too), as export's names a clip file, and an absolute character path by its placeholder.
// What one import fits, bounded before it fits (a 130 s take skipped, 501 picks and 300 s of picks refused); io's
// refusals naming the file by its path; a glTF whose bones' names no map knows said by list and refused by import
// (E_RIG), each with the calls that take it by its shape, and one whose names follow a map but lack its joints said and
// refused naming them (io's reason); the license and credit a VRMA m3a wrote carries (a
// contradicting --license refused, a known id in another case too, its credit kept), a composed clip's too (its ids
// joined with " AND ": refused under one of them, its fix quoted, running as written; its ids compared as sets, case
// aside; a free-text license noted, not compared; no note on it, license.check passing it part by part, and one
// part's missing text named by import and license.check alike); export's file named by the clip and the character, a .bvh's
// license line; a second import into a set saying it replaced the first's clips.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { openLibrary } from "@m3a/library/node";
import { describe, expect, it } from "vitest";
import { mcpTool } from "../src/mcp.ts";
import { libraryAccess, MAX_OPEN, openCount } from "../src/node/library.ts";
import { nodeHost } from "../src/node.ts";
import { Registry, type Host, type Reply } from "../src/registry/index.ts";
import { exportClip, importMotion } from "../src/tools/exchange.ts";
import { COMPOSE, EXCHANGE, SHIP } from "../src/tools/index.ts";
import { exampleCwd, hintedCalls, runExamples } from "./helpers/surfaces.ts";

const RIG = "spec/vectors/tier1b/rig.gltf", RIGIFY = "spec/vectors/tier1b/rigify.gltf", WALK = "QUATERNIUS_3D2DGE/Walk_Loop", OUT = "check-output/export/QUATERNIUS_3D2DGE_Walk_Loop";
const refused = (r: Reply) => [r.status, r.error?.code, r.error?.message];
type Data = Record<string, unknown> & { clips: { id: string; dur: number; keys: number; fit: number[] }[] };

/** Tier 1b's rig as text with Wave_Loop's last key at `t` s (its first sampler's time accessor: the last value and max). */
function longWave(text: string, t: number): string {
  type Doc = { animations: { name: string; samplers: { input: number }[] }[]; accessors: { bufferView: number; byteOffset?: number; count: number; max?: number[] }[]; bufferViews: { byteOffset?: number }[]; buffers: { uri: string }[] };
  const j = JSON.parse(text) as Doc, buf = Buffer.from(j.buffers[0]!.uri.split(",")[1]!, "base64"), an = j.animations.find((x) => x.name === "Wave_Loop")!;
  const acc = j.accessors[an.samplers[0]!.input]!, at = (j.bufferViews[acc.bufferView]!.byteOffset ?? 0) + (acc.byteOffset ?? 0) + 4 * (acc.count - 1);
  buf.writeFloatLE(t, at);
  acc.max = [t];
  j.buffers[0]!.uri = `data:application/octet-stream;base64,${buf.toString("base64")}`;
  return JSON.stringify(j);
}
/** A .glb's (or .vrma's) JSON chunk. */
const glbJson = (b: Buffer) => JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString("utf8")) as { asset: { copyright?: string } };
/** A .glb (or .vrma) with each animation's extras.license set to `license`: its JSON chunk written again, padded with
 *  spaces to 4 bytes, the header's lengths with it. */
function licensed(b: Buffer, license: string): Buffer {
  const j = glbJson(b) as unknown as { animations: { extras: { license?: string } }[] }, rest = b.subarray(20 + b.readUInt32LE(12)), head = Buffer.alloc(20);
  for (const an of j.animations) an.extras.license = license;
  const text = Buffer.from(JSON.stringify(j)), json = Buffer.concat([text, Buffer.alloc((4 - (text.length % 4)) % 4, 0x20)]);
  [[0x46546c67, 0], [2, 4], [20 + json.length + rest.length, 8], [json.length, 12], [0x4e4f534a, 16]].forEach(([v, at]) => head.writeUInt32LE(v!, at));
  return Buffer.concat([head, json, rest]);
}

/** Runs `body` with calls into one fresh working directory (seeded), its host too, deleted after. */
async function inCwd(body: (call: (tool: string, args: object) => Promise<Reply>, cwd: string, host: Host) => Promise<void>): Promise<void> {
  const { cwd, rm } = exampleCwd(), reg = new Registry([...EXCHANGE, ...SHIP, ...COMPOSE]), host = nodeHost(cwd);
  try {
    await body((tool, args) => reg.call(tool, args, { host }), cwd, host);
  } finally {
    rm();
  }
}

describe("exchange", () => {
  runExamples(EXCHANGE);

  it("lists import to MCP as no read-only tool (it writes and removes what imports/ holds), export as one", () => {
    expect([mcpTool(importMotion).annotations, mcpTool(exportClip).annotations]).toEqual([{ readOnlyHint: false, destructiveHint: true, openWorldHint: false }, { readOnlyHint: true, openWorldHint: false }]);
  });

  it("import refuses a file that is no motion file, no license or none SPDX, a path out, a bad, kept or taken set name, a catalog off its shape or no JSON, a truncated BVH, and a file it skips every take of", () =>
    inCwd(async (call, cwd) => {
      writeFileSync(join(cwd, "cut.bvh"), "HIERARCHY\nROOT root\n{\n  OFFSET 0 0 0\n  CHANNELS 6 Xposition Yposition Zposition Zrotation Xrotation Yrotation\n  JOINT pelvis\n  {\n    OFFSET 0 95");
      writeFileSync(join(cwd, "tags.json"), JSON.stringify({ Wave_Loop: [3, "waves"] }));
      const bad = (set: string) => ["usage", "E_ARGS", `set is the new set's name, A-Z, 0-9 and _ (as IMPORT), not "${set}"`];
      expect(refused(await call("import", { path: "spec/vectors/tier1b/rig-catalog.json", license: "CC0-1.0" }))).toEqual(["usage", "E_ARGS", "spec/vectors/tier1b/rig-catalog.json is no motion file: give a .gltf, .glb, .bvh or .vrma"]);
      expect(refused(await call("import", { path: RIG }))).toEqual(["usage", "E_ARGS", expect.stringMatching(/^license is the file's SPDX id/)]);
      expect(refused(await call("import", { path: RIG, license: "CC0 1.0" }))).toEqual(["usage", "E_ARGS", expect.stringMatching(/^license "CC0 1.0" is no SPDX id/)]);
      expect(refused(await call("import", { path: "../outside.bvh", license: "CC0-1.0" }))).toEqual(["usage", "E_PATH", expect.stringMatching(/outside the working directory/)]);
      expect([refused(await call("import", { path: RIG, license: "CC0-1.0", set: "bad name" })), refused(await call("import", { path: RIG, license: "CC0-1.0", set: "WORKSHOP" }))]).toEqual([bad("bad name"), bad("WORKSHOP")]);
      expect(refused(await call("import", { path: RIG, license: "CC0-1.0", set: "QUATERNIUS_3D2DGE" }))).toEqual(["usage", "E_ARGS", "set QUATERNIUS_3D2DGE is the library's: name the new set another way"]);
      // a catalog off its shape names the entry: usage given inline, an error in a file
      expect(refused(await call("import", { path: RIG, license: "CC0-1.0", catalog: '{"$pick": {"Wave": {"from": "Wave_Loop"}}}' }))).toEqual(["usage", "E_ARGS", 'catalog: "$pick" "Wave" is [take, from s, to s, shortest cycle s], not {"from":"Wave_Loop"}']);
      expect(refused(await call("import", { path: RIG, license: "CC0-1.0", catalog: "tags.json" }))).toEqual(["error", "E_ARGS", 'catalog: "Wave_Loop" is ["tags", "what it does"], not [3,"waves"]']);
      // a catalog that is no JSON named as clips.ts's prose names a file: "the catalog's file" for an absolute path, else
      // as given; the parser's message (V8's quotes the file's first line, its line break too) on one line
      for (const [catalog, named] of [[join(cwd, "cut.bvh"), /^the catalog's file is not JSON: [^/\p{Cc}]*$/u], ["cut.bvh", /^the catalog cut\.bvh is not JSON: Unexpected token 'H', "HIERARCHY "\.\.\. is not valid JSON$/u]] as const) expect(refused(await call("import", { path: RIG, license: "CC0-1.0", catalog }))).toEqual(["error", "E_JSON", expect.stringMatching(named)]);
      expect(refused(await call("import", { path: "cut.bvh", license: "CC0-1.0" }))).toEqual(["error", "E_FORMAT", expect.stringMatching(/^cut\.bvh: /)]);
      // every take skipped: E_NO_CLIP names 20 with their reasons and counts the rest, as a reply caps its skipped rows
      const takes = JSON.parse(readFileSync(join(cwd, RIG), "utf8")) as { animations: { name: string }[] }, names = Array.from({ length: 22 }, (_, i) => `Take${i}`);
      takes.animations = names.map((name, i) => ({ ...takes.animations[i % 3]!, name }));
      writeFileSync(join(cwd, "takes.gltf"), JSON.stringify(takes));
      const skip = JSON.stringify({ $skip: Object.fromEntries(names.map((n) => [n, "not now"])) });
      expect(refused(await call("import", { path: "takes.gltf", license: "CC0-1.0", catalog: skip }))).toEqual(["error", "E_NO_CLIP", `no clip came out of takes.gltf: ${names.slice(0, 20).map((n) => `${n}: not now`).join("; ")}; and 2 more skipped`]);
      writeFileSync(join(cwd, "game.json"), "x\ny");
      expect(refused(await call("import", { path: RIG, license: "CC0-1.0" }))).toEqual(["usage", "E_GAME", `game.json is not JSON (Unexpected token 'x', "x y" is not valid JSON); fix it, or remove it for the CC0 default`]);
    }));

  it("imports a set the library opens as local, which license.check fails for a shipped game (D10); lists; imports in place; leaves a broken set out", () =>
    inCwd(async (call, cwd, host) => {
      writeFileSync(join(cwd, "my chain.gltf"), JSON.stringify({ asset: { version: "2.0" }, nodes: [0, 1, 2].map((i) => ({ name: `b${i}`, ...(i < 2 ? { children: [i + 1] } : {}) })) }));
      const list = await call("import", { path: RIG, list: true }), none = await call("import", { path: "my chain.gltf", list: true });
      expect([list.verdict, list.data, list.next]).toEqual([`import ${RIG}: 3 animations, rig gltf:unreal; nothing written`, expect.objectContaining({ clips: [{ name: "A_TPose" }, { name: "Wave_Loop" }, { name: "Step_RM" }], set: null }), `\`import ${RIG} --license <license>\` fits them into imports/IMPORT/`]);
      expect([(await call("import", { path: RIG, list: true, from: 1 })).data]).toEqual([expect.objectContaining({ clips: [{ name: "Wave_Loop" }, { name: "Step_RM" }] })]);
      expect([none.verdict, none.next]).toEqual(["import 'my chain.gltf': 0 animations, rig unknown by name (import may refuse it); nothing written", "it holds no animation to import; `export QUATERNIUS_3D2DGE/Walk_Loop --character 'my chain.gltf'` plays a library clip on it, if it is a character"]);
      const r = await call("import", { path: RIG, set: "RIG", license: "CC0-1.0", catalog: "spec/vectors/tier1b/rig-catalog.json" }), d = r.data as Data;
      expect([r.status, r.verdict]).toEqual(["ok", "import spec/vectors/tier1b/rig.gltf: 3 clips into imports/RIG/ (gltf:unreal, tier local), fit 0.7 mm mean, worst 38 mm (RIG/Wave_Loop)"]);
      // the rest take (one frame) held a frame (I4): a clip, not M2-E014's dur 0
      expect(d.clips.map((c) => [c.id, c.dur, c.keys, c.fit])).toEqual([["RIG/A_TPose", 0.033, 1, [0, 2]], ["RIG/Wave_Loop", 1, 11, [2, 38]], ["RIG/Step_RM", 1, 2, [0, 2]]]);
      const lib = openLibrary({ dir: join(cwd, "imports"), tiers: ["local"] }), wave = lib.clip("RIG/Wave_Loop");
      lib.verify();
      expect([lib.sets().map((s) => [s.set, s.tier, s.clips]), wave.clip.provenance.license, wave.clip.provenance.credit, wave.clip.tags, lib.about("RIG").sources.RIG!.terms]).toEqual([[["RIG", "local", 3]], "CC0-1.0", undefined, ["gesture"], "CC0 1.0"]);
      expect(r.next).toBe('`license.check --set RIG` fails it for a shipped game (D10: local); to use it here, set "tiers" to include "local" and "ships": false in game.json, then `metrics RIG/Wave_Loop`');
      // license.check sees it through the host: a shipped game fails it, one on this machine alone (ships: false) takes it
      expect((await call("license.check", { set: "RIG" })).data).toMatchObject({ ok: false, findings: [{ where: "RIG", message: expect.stringMatching(/^a local set and this game opts into cc0/) }, { where: "RIG", message: 'local content never ships (D10): drop it, or set "ships": false in game.json for a game that stays on this machine' }] });
      expect((await call("license.check", { clips: ["RIG/Wave_Loop"], tiers: ["cc0", "local"] })).status).toBe("findings");
      expect((await call("license.check", { clips: ["RIG/Wave_Loop"], tiers: ["cc0", "local"], ships: false })).status).toBe("ok");
      // imported again in place, under a license that owes a credit, which every clip then carries: a clip it no longer
      // makes goes, the set still opens, and the host's library is opened again (its manifest changed)
      const source = () => host.library!(["local"]).library.about("RIG").sources.RIG!, credit = "Rig by Someone, CC BY-SA 4.0";
      expect(source().license).toBe("CC0-1.0");
      const cat = JSON.parse(readFileSync(join(cwd, "spec/vectors/tier1b/rig-catalog.json"), "utf8")) as { $sources: { RIG: object } };
      writeFileSync(join(cwd, "cat.json"), JSON.stringify({ ...cat, $sources: { RIG: { ...cat.$sources.RIG, credit } }, $skip: { Step_RM: "a slide, not a step" } }));
      const again = await call("import", { path: RIG, set: "RIG", license: "CC-BY-SA-4.0", catalog: "cat.json" });
      expect([again.status, (again.data as Data).skipped, (again.data as { notes: string[] }).notes[0], readdirSync(join(cwd, "imports/RIG")).sort()]).toEqual(["ok", [{ name: "Step_RM", why: "a slide, not a step" }], "CC-BY-SA-4.0's text isn't in library/LICENSES/: license.check fails the set", ["A_TPose.json", "Wave_Loop.json", "_set.json", "catalog.tsv"]]);
      const removed = (r: Reply) => [r.lines.filter((l) => l.startsWith("removed ")), (r.data as { removed?: number }).removed];
      expect([again.lines[0], ...removed(again)]).toEqual(["note: CC-BY-SA-4.0's text isn't in library/LICENSES/: license.check fails the set", ["removed 1 clip file this import doesn't make: Step_RM.json"], 1]);
      const now = openLibrary({ dir: join(cwd, "imports"), tiers: ["local"] });
      expect([now.catalog().map((c) => c.id), now.clip("RIG/Wave_Loop").clip.provenance.credit, source().license, source().credit]).toEqual([["RIG/A_TPose", "RIG/Wave_Loop"], credit, "CC-BY-SA-4.0", credit]);
      expect((await call("license.check", { clips: ["RIG/Step_RM"], tiers: ["local"], ships: false })).data).toMatchObject({ findings: [{ message: expect.stringMatching(/^no clip "RIG\/Step_RM"/) }] });
      // every clip file an import doesn't write goes, so the set verifies: one its catalog doesn't list (an import cut
      // short), and in a set copied under another name, those its catalog lists under the old set's name
      cpSync(join(cwd, "imports/RIG"), join(cwd, "imports/MINE"), { recursive: true });
      cpSync(join(cwd, "imports/RIG/Wave_Loop.json"), join(cwd, "imports/RIG/Extra.json"));
      writeFileSync(join(cwd, "cat2.json"), JSON.stringify({ ...cat, $skip: { Step_RM: "a slide", Wave_Loop: "not now" } }));
      for (const [set, catalog, kept] of [["RIG", "cat.json", ["A_TPose.json", "Wave_Loop.json"]], ["MINE", "cat2.json", ["A_TPose.json"]]] as const) {
        expect((await call("import", { path: RIG, set, license: "CC0-1.0", catalog })).status).toBe("ok");
        expect(readdirSync(join(cwd, "imports", set)).sort()).toEqual([...kept, "_set.json", "catalog.tsv"]);
      }
      // a .json there that no import wrote (a catalog kept in the set's directory) is never removed: the import is
      // refused, nothing changed, in a set imported before and in a first import (no _set.json yet); a clip an import
      // wrote that a first import cut short left there goes, named
      mkdirSync(join(cwd, "imports/CUT"));
      cpSync(join(cwd, "imports/RIG/Wave_Loop.json"), join(cwd, "imports/CUT/Orphan.json"));
      for (const set of ["MINE", "CUT"]) {
        cpSync(join(cwd, "spec/vectors/tier1b/rig-catalog.json"), join(cwd, `imports/${set}/catalog.json`));
        const was = readdirSync(join(cwd, "imports", set)).sort();
        expect(refused(await call("import", { path: RIG, set, license: "CC0-1.0", catalog: `imports/${set}/catalog.json` }))).toEqual(["error", "E_EXISTS", `imports/${set}/catalog.json is no clip m3a import wrote: move it out of imports/${set}/, where the library reads each .json as one of the set's clips; nothing was changed`]);
        expect(readdirSync(join(cwd, "imports", set)).sort()).toEqual(was);
        rmSync(join(cwd, `imports/${set}/catalog.json`));
      }
      const cut = await call("import", { path: RIG, set: "CUT", license: "CC0-1.0", catalog: "cat.json" });
      expect([cut.status, ...removed(cut), readdirSync(join(cwd, "imports/CUT")).sort()]).toEqual(["ok", ["removed 1 clip file this import doesn't make: Orphan.json"], 1, ["A_TPose.json", "Wave_Loop.json", "_set.json", "catalog.tsv"]]);
      openLibrary({ dir: join(cwd, "imports"), tiers: ["local"] }).verify();
      // a file where the set's directory goes: the host's write refuses it, naming the path as given, never the cwd
      writeFileSync(join(cwd, "imports/FILE"), "");
      const squat = await call("import", { path: RIG, set: "FILE", license: "CC0-1.0" });
      expect([...refused(squat), JSON.stringify(squat).includes(cwd)]).toEqual(["error", "E_WRITE", "can't write imports/FILE/A_TPose.json (EEXIST)", false]);
      // each working directory with imported sets opens its own library; the host keeps at most MAX_OPEN of them, the
      // least lately used dropped: this one's, used between the others, is never opened again, and one dropped is (a
      // long-lived MCP server isn't grown by each directory it serves)
      const dirs = Array.from({ length: MAX_OPEN + 2 }, (_, i) => join(cwd, `w${i}`)), own = () => libraryAccess(cwd, ["local"]).library.catalog(), was = (own(), openCount().opens);
      for (const d of [...dirs, dirs[0]!]) {
        cpSync(join(cwd, "imports/RIG"), join(d, "imports/RIG"), { recursive: true });
        expect(libraryAccess(d, ["local"]).library.catalog().map((c) => c.id)).toEqual(["RIG/A_TPose", "RIG/Wave_Loop"]);
        own();
      }
      expect(openCount()).toEqual({ open: MAX_OPEN, opens: was + dirs.length + 1 });
      // a broken imported set is left out, warned on every call, and breaks no other: a manifest that isn't JSON, one that
      // says it ships (tier cc0), a set reached through a link out of the working directory, and one named as a library
      // set (the library's wins), which import refuses to write, its manifest copied from the library's too
      cpSync(join(cwd, "imports/RIG"), join(cwd, `imports/${WALK.split("/")[0]}`), { recursive: true });
      const taken = ["usage", "E_ARGS", "set QUATERNIUS_3D2DGE is the library's: name the new set another way"];
      expect(refused(await call("import", { path: RIG, license: "CC0-1.0", set: "QUATERNIUS_3D2DGE" }))).toEqual(taken);
      writeFileSync(join(cwd, "imports/QUATERNIUS_3D2DGE/_set.json"), host.library!(["cc0"]).source.read("QUATERNIUS_3D2DGE", "_set.json"));
      expect(refused(await call("import", { path: RIG, license: "CC0-1.0", set: "QUATERNIUS_3D2DGE" }))).toEqual(taken);
      mkdirSync(join(cwd, "imports/BAD"));
      writeFileSync(join(cwd, "imports/BAD/_set.json"), "{bad");
      cpSync(join(cwd, "imports/RIG"), join(cwd, "imports/SHIPS"), { recursive: true });
      writeFileSync(join(cwd, "imports/SHIPS/_set.json"), readFileSync(join(cwd, "imports/SHIPS/_set.json"), "utf8").replace('"set": "RIG"', '"set": "SHIPS"').replace('"tier": "local"', '"tier": "cc0"'));
      const { cwd: out, rm } = exampleCwd(false);
      try {
        cpSync(join(cwd, "imports/RIG"), join(out, "OUT"), { recursive: true });
        symlinkSync(join(out, "OUT"), join(cwd, "imports/OUT"));
        const ok = await call("license.check", { clips: [WALK] }), left = (set: string, why: string) => `warning: imports/${set}/ is left out: ${why}; import it again, or remove it`;
        expect([ok.status, ok.lines.filter((l) => l.startsWith("warning:"))]).toEqual(["ok", [
          left("BAD", "its _set.json isn't JSON"), left("OUT", "it leads out of the working directory"), "warning: imports/QUATERNIUS_3D2DGE/ is left out: the library has a set QUATERNIUS_3D2DGE; import it again under another name, or remove it", left("SHIPS", "its _set.json isn't an imported set's manifest"),
        ]]);
        expect(refused(await call("license.check", { set: "OUT" }))).toEqual(["usage", "E_ARGS", expect.stringMatching(/^no set "OUT"/)]);
      } finally {
        rm();
      }
    }));

  it("exports VRMA byte for byte, .glb and BVH within 1 mm (Rigify's turned, scaled armature and the tiny rig too), and imports them again", () =>
    inCwd(async (call, cwd) => {
      const out = async (args: object) => {
        const r = await call("export", { clip: WALK, character: RIG, ...args });
        return [r.status, (r.data as { check: string }).check, (r.data as { roundtrip_mm: number | null }).roundtrip_mm, r.data as { file: string; license: object }, r.next] as const;
      };
      const vrma = await out({});
      expect(vrma.slice(0, 3)).toEqual(["ok", "reads back byte for byte", null]);
      expect(vrma[3]).toMatchObject({ file: `${OUT}-on-rig.vrma`, license: { spdx: "CC0-1.0", tier: "cc0", credit: null } });
      // a clip file whose name the shell would split: license.check's clips take it as given
      cpSync(join(cwd, "library/sets/QUATERNIUS_3D2DGE/A_TPose.json"), join(cwd, "my pose.json"));
      const pose = await call("export", { clip: "my pose.json", character: RIG });
      expect([pose.status, hintedCalls(pose.next).map((h) => h.args)]).toEqual(["ok", [{ clips: ["my pose.json"] }]]);
      // Rigify's .gltf (its soles' end bones have no node), the tiny rig (no file: its own document), BVH on rig.gltf
      for (const [args, ext] of [[{ format: "glb", character: RIGIFY }, "on-rigify.glb"], [{ format: "glb", character: "tiny" }, "on-tiny.glb"], [{ format: "bvh" }, "on-rig.bvh"]] as const) {
        const [status, check, gap, data] = await out(args);
        expect([status, data.file, check]).toEqual(["ok", `${OUT}-${ext}`, expect.stringMatching(/^read back, its joints within 0\.0\d\d mm$/)]);
        expect(gap).toBeLessThan(1);
      }
      // a node above the bones scaled unevenly shears them as they turn, which no glTF animation follows: findings
      const skew = JSON.parse(readFileSync(join(cwd, RIG), "utf8")) as { nodes: { scale?: number[] }[] };
      skew.nodes[0]!.scale = [1, 1.2, 1];
      writeFileSync(join(cwd, "skew rig.gltf"), JSON.stringify(skew));
      const [status, check, gap, , next] = await out({ format: "glb", character: "skew rig.gltf" });
      expect([status, check, gap! > 1, next]).toEqual(["findings", expect.stringMatching(/^read back, its joints within \d+\.\d+ mm$/), true, `it reads back off: a node above its bones may scale unevenly, which no glTF animation follows (else report it: a bug); \`export ${WALK} --character 'skew rig.gltf' --format bvh\` writes one that reads back`]);
      // by an absolute path: the verdict and the hint name it by its placeholder, the working directory nowhere
      const abs = await call("export", { clip: WALK, character: join(cwd, "skew rig.gltf"), format: "glb" });
      expect([abs.status, abs.next.match(/`[^`]+`/g), JSON.stringify(abs).includes(cwd)]).toEqual(["findings", [`\`export ${WALK} --character <the character's file> --format bvh\``], false]);
      // a VRM humanoid giving only the hips: each required bone found by name is a character issue, cut at 3 with a more
      // line whose retarget.inspect call carries the mapping the export was given
      const vrm = JSON.parse(readFileSync(join(cwd, RIG), "utf8")) as { nodes: { name: string }[]; extensions?: object };
      vrm.extensions = { VRMC_vrm: { humanoid: { humanBones: { hips: { node: vrm.nodes.findIndex((n) => n.name === "pelvis") } } } } };
      writeFileSync(join(cwd, "vrm.gltf"), JSON.stringify(vrm));
      const many = await call("export", { clip: WALK, character: "vrm.gltf", mapping: { bones: { hips: "pelvis" } } });
      expect(many.lines.find((l) => l.startsWith("more:"))).toBe(`more: 12 character issues (\`retarget.inspect vrm.gltf --mapping '{"bones":{"hips":"pelvis"}}'\` lists them)`);
      // what export wrote reads as motion again: the VRMA by its humanoid, the BVH (below) by Unreal's names
      const vr = await call("import", { path: `${OUT}-on-rig.vrma`, set: "VBACK", license: "CC0-1.0" });
      expect([vr.status, (vr.data as Data).rig, (vr.data as Data).clips.map((c) => c.id)]).toEqual(["ok", "gltf:vrm", ["VBACK/QUATERNIUS_3D2DGE_Walk_Loop"]]);
      // the BVH jittered (turns by up to 75°, places by up to 7.5 cm), from an absolute path, its catalog from one:
      // past the fit limits, so findings; the manifest names the file by its own name alone, the hint neither path
      let seed = 7;
      const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648 - 0.5, [head, motion] = readFileSync(join(cwd, `${OUT}-on-rig.bvh`), "utf8").split("MOTION\n");
      const jitter = motion!.split("\n").map((l, i) => (i < 2 || !l.trim() ? l : l.split(" ").map((x, k) => (Number(x) + (k < 3 ? 15 : 150) * rnd()).toFixed(4)).join(" ")));
      writeFileSync(join(cwd, "jitter.bvh"), `${head}MOTION\n${jitter.join("\n")}`);
      for (const f of ["none.json", "my cat.json"]) writeFileSync(join(cwd, f), "{}");
      const jit = await call("import", { path: join(cwd, "jitter.bvh"), set: "JIT", license: "CC0-1.0", catalog: join(cwd, "none.json") }), m = JSON.parse(readFileSync(join(cwd, "imports/JIT/_set.json"), "utf8")) as { title: string; credit: string; sources: { JIT: { file: string; origin: string } } };
      expect([jit.status, (jit.data as Data).rig, jit.verdict, jit.lines.at(-1), jit.next]).toEqual(["findings", "bvh:unreal", expect.stringMatching(/^import the motion file: 1 clip into imports\/JIT\/ .*; 1 past the fit limits$/), expect.stringMatching(/^JIT\/jitter .* \(past 40\/300 mm\)$/), 'cut a take with the catalog\'s "$pick", or leave a clip out with "$skip" and its reason, then `import <the motion file> --set JIT --license CC0-1.0 --catalog <the catalog\'s file>`']);
      expect([m.title, m.credit, m.sources.JIT.file, m.sources.JIT.origin]).toEqual(["jitter.bvh, imported", "jitter.bvh, CC0-1.0", "jitter.bvh", "jitter.bvh, imported by m3a import"]);
      // the hint's catalog with none given, one given inline, and one by a relative path (one the shell would split)
      for (const [catalog, as] of [[undefined, "<catalog>"], ["{}", "<the catalog's JSON>"], ["none.json", "none.json"], ["my cat.json", "'my cat.json'"]]) {
        const r = await call("import", { path: "jitter.bvh", set: "JIT", license: "CC0-1.0", ...(catalog === undefined ? {} : { catalog }) });
        expect([r.status, r.next.split("then ")[1]]).toEqual(["findings", `\`import jitter.bvh --set JIT --license CC0-1.0 --catalog ${as}\``]);
      }
    }));

  it("export refuses a clip that isn't there or is no JSON (on one line), a format it doesn't write, and a character with no humanoid", () =>
    inCwd(async (call, cwd) => {
      writeFileSync(join(cwd, "chain.gltf"), JSON.stringify({ asset: { version: "2.0" }, nodes: [0, 1, 2].map((i) => ({ name: `b${i}`, ...(i < 2 ? { children: [i + 1] } : {}) })) }));
      expect(refused(await call("export", { clip: "QUATERNIUS_3D2DGE/Walk_Lop", character: RIG }))).toEqual(["usage", "E_NO_CLIP", expect.stringMatching(/did you mean "QUATERNIUS_3D2DGE\/Walk_Loop"\?$/)]);
      writeFileSync(join(cwd, "cut.json"), "HIERARCHY\nROOT root");
      expect(refused(await call("export", { clip: "cut.json", character: RIG }))).toEqual(["error", "E_CLIP", expect.stringMatching(/is not JSON: Unexpected token 'H', "HIERARCHY ROOT root" is not valid JSON$/)]);
      expect(refused(await call("export", { clip: WALK, character: RIG, format: "fbx" }))).toEqual(["usage", "E_ARGS", expect.stringMatching(/^format is "fbx", not one of vrma, glb, bvh/)]);
      expect(refused(await call("export", { clip: WALK, character: "chain.gltf" }))).toEqual(["error", "E_RIG", expect.stringMatching(/^chain\.gltf: no humanoid bone recognized/)]);
      expect(refused(await call("export", { clip: WALK, character: "spec/vectors/tier1b/rig-catalog.json" }))).toEqual(["usage", "E_ARGS", expect.stringMatching(/is not a character/)]);
    }));

  it("bounds what one import fits before fitting; names io's refusals by the path; says and refuses a glTF whose bones' names no map knows", () =>
    inCwd(async (call, cwd) => {
      // a take past 120 s skipped (findings: the reply says how to cut it), the others imported
      writeFileSync(join(cwd, "long wave.gltf"), longWave(readFileSync(join(cwd, RIG), "utf8"), 130));
      const long = await call("import", { path: "long wave.gltf", set: "LONG", license: "CC0-1.0" }), d = long.data as Data & { skipped: object[] };
      expect([long.status, d.clips.map((c) => c.id), d.skipped]).toEqual(["findings", ["LONG/A_TPose", "LONG/Step_RM"], [{ name: "Wave_Loop", why: `130 s long, past the 120 s one import fits; cut it with the catalog's "$pick" [take, from s, to s]` }]]);
      expect([long.verdict, long.next.split(",")[0]]).toEqual([expect.stringMatching(/; 1 skipped$/), 'cut a take with the catalog\'s "$pick"']);
      // 501 picks of a frame each refused for their count, three of 100 s for their total, before any fit
      const picks = (n: number, len: number) => JSON.stringify({ $pick: Object.fromEntries(Array.from({ length: n }, (_, i) => [`P${i}`, ["Wave_Loop", (i % 10) * 0.1, (i % 10) * 0.1 + len]])) });
      expect(refused(await call("import", { path: "long wave.gltf", set: "LONG", license: "CC0-1.0", catalog: picks(501, 1 / 30) }))).toEqual(["usage", "E_ARGS", "501 takes to fit, past the 500 one import fits; $skip some, or import them in parts into other sets"]);
      expect(refused(await call("import", { path: "long wave.gltf", set: "LONG", license: "CC0-1.0", catalog: picks(3, 100) }))).toEqual(["usage", "E_ARGS", expect.stringMatching(/^the takes to fit last 300(\.\d)? s in all, past the 240 s one import fits; \$skip some, or import them in parts into other sets$/)]);
      // io's refusals name the file by its path as given: two files of one name in two directories read apart
      mkdirSync(join(cwd, "motions"));
      writeFileSync(join(cwd, "motions/bad.glb"), "this is no binary glTF, only text");
      expect(refused(await call("import", { path: "motions/bad.glb", list: true }))).toEqual(["error", "E_FORMAT", expect.stringMatching(/^motions\/bad\.glb: not a binary glTF/)]);
      // a glTF whose bones' names no bone map knows (tier 1b's rig, every name reversed): list says import refuses it,
      // and import does (E_RIG, by io's code), each offering the calls that take it by its shape
      const rev = JSON.parse(readFileSync(join(cwd, RIG), "utf8")) as { nodes: { name: string }[]; animations: unknown[] };
      for (const n of rev.nodes) n.name = `b_${[...n.name].reverse().join("")}`;
      writeFileSync(join(cwd, "odd rig.gltf"), JSON.stringify(rev));
      const shape = "`retarget.inspect 'odd rig.gltf'` binds it by its shape, if it is a character; `export QUATERNIUS_3D2DGE/Walk_Loop --character 'odd rig.gltf'` plays a library clip on it";
      const [listed, odd] = [await call("import", { path: "odd rig.gltf", list: true }), await call("import", { path: "odd rig.gltf", license: "CC0-1.0" })];
      expect([listed.status, listed.verdict, listed.data, listed.next]).toEqual(["ok", "import 'odd rig.gltf': 3 animations, rig: none import knows by its bone names; import refuses it; nothing written", expect.objectContaining({ rig: null }), shape]);
      expect([...refused(odd), odd.next]).toEqual(["error", "E_RIG", "'odd rig.gltf': its bones' names match none import knows (MotionBuilder's and Mixamo's Hips, Spine, LeftUpLeg ..., Unreal's, Rigify's, 100STYLE's, Bandai Namco's, VRM's humanoid bones); import reads a file by its bone names only", shape]);
      expect([...hintedCalls(listed.next), ...hintedCalls(odd.next)].filter((h) => h.problem)).toEqual([]);
      // its first animation unreadable (CUBICSPLINE in-betweens): list can't tell, and says no more than that
      const spline = JSON.parse(JSON.stringify(rev)) as { animations: { samplers: { interpolation?: string }[] }[] };
      spline.animations[0]!.samplers[0]!.interpolation = "CUBICSPLINE";
      writeFileSync(join(cwd, "spline.gltf"), JSON.stringify(spline));
      expect((await call("import", { path: "spline.gltf", list: true })).verdict).toBe("import spline.gltf: 3 animations, rig unknown by name (import may refuse it); nothing written");
      // one whose names a bone map knows though no table does (MotionBuilder's): list places it as import would read it
      const mb: Record<string, string> = { pelvis: "Hips", spine_01: "Spine", spine_02: "Spine1", spine_03: "Spine2", neck_01: "Neck", head_leaf: "HeadTop_End" };
      for (const [s, S] of [["l", "Left"], ["r", "Right"]]) {
        Object.assign(mb, Object.fromEntries(Object.entries({ clavicle: "Shoulder", upperarm: "Arm", lowerarm: "ForeArm", hand: "Hand", index_01: "HandIndex1", middle_01: "HandMiddle1", middle_02: "HandMiddle2", pinky_01: "HandPinky1", thigh: "UpLeg", calf: "Leg", foot: "Foot", ball: "ToeBase", ball_leaf: "Toe_End" }).map(([u, m]) => [`${u}_${s}`, `${S}${m}`])));
      }
      const placed = JSON.parse(readFileSync(join(cwd, RIG), "utf8")) as { nodes: { name: string }[] };
      for (const n of placed.nodes) n.name = mb[n.name] ?? n.name;
      writeFileSync(join(cwd, "placed.gltf"), JSON.stringify(placed));
      const known = await call("import", { path: "placed.gltf", list: true });
      expect([known.verdict, known.next]).toEqual(["import placed.gltf: 3 animations, rig gltf:motionbuilder; nothing written", "`import placed.gltf --license <license>` fits them into imports/IMPORT/"]);
      // its names following MotionBuilder's but lacking a joint that map needs (LeftToeBase renamed; then both toes):
      // list and import name the joints, as io does, each offering the calls that take it by its shape
      const toes = (...sides: string[]) => JSON.stringify({ ...placed, nodes: placed.nodes.map((n) => (sides.some((S) => n.name === `${S}ToeBase`) ? { ...n, name: n.name.replace("ToeBase", "Toe_Base") } : n)) });
      writeFileSync(join(cwd, "near.gltf"), toes("Left"));
      writeFileSync(join(cwd, "nearer.gltf"), toes("Left", "Right"));
      const near = (f: string) => `\`retarget.inspect ${f}\` binds it by its shape, if it is a character; \`export QUATERNIUS_3D2DGE/Walk_Loop --character ${f}\` plays a library clip on it`;
      const [nearList, nearOne, nearTwo] = [await call("import", { path: "near.gltf", list: true }), await call("import", { path: "near.gltf", license: "CC0-1.0" }), await call("import", { path: "nearer.gltf", license: "CC0-1.0" })];
      expect([nearList.status, nearList.verdict, nearList.data, nearList.next]).toEqual(["ok", "import near.gltf: 3 animations, rig gltf:motionbuilder lacks LeftToeBase; import refuses it; nothing written", expect.objectContaining({ rig: null }), near("near.gltf")]);
      expect([...refused(nearOne), nearOne.next]).toEqual(["error", "E_RIG", "near.gltf: its bones follow MotionBuilder's (Mixamo's) names but lack LeftToeBase, which import needs: give the file's bone for it that name (import reads a file by its bone names only)", near("near.gltf")]);
      expect(refused(nearTwo)).toEqual(["error", "E_RIG", "nearer.gltf: its bones follow MotionBuilder's (Mixamo's) names but lack LeftToeBase, RightToeBase, which import needs: give the file's bones for them those names (import reads a file by its bone names only)"]);
      expect(existsSync(join(cwd, "imports/IMPORT"))).toBe(false);
    }));

  it("reads the license and credit a VRMA m3a wrote carries; names export's file by the clip and the character, a .bvh's license line; says an import replaced another's clips", () =>
    inCwd(async (call, cwd) => {
      // a CC-BY clip exported as VRMA carries its license (each animation's extras) and its credit (the asset's copyright)
      writeFileSync(join(cwd, "game.json"), JSON.stringify({ tiers: ["cc0", "cc-by"] }));
      const vrma = ((await call("export", { clip: "STYLE100/Akimbo_Walk", character: RIG })).data as { file: string }).file, copyright = glbJson(readFileSync(join(cwd, vrma))).asset.copyright;
      expect([vrma, copyright]).toEqual(["check-output/export/STYLE100_Akimbo_Walk-on-rig.vrma", "100STYLE, Mason, Starke and Komura (CC BY 4.0)"]);
      // a --license that contradicts it refused, its fix a flag to set on the same call; a known id in another case too
      const args = { path: vrma, set: "AKIMBO", license: "CC0-1.0" }, wrong = await call("import", args), lower = await call("import", { ...args, license: "cc0-1.0" });
      expect(refused(wrong)).toEqual(["usage", "E_ARGS", "the file says its animations are CC-BY-4.0 (each animation's extras.license); --license CC0-1.0 contradicts it: pass `--license CC-BY-4.0`"]);
      expect(refused(lower)).toEqual(["usage", "E_ARGS", 'license "cc0-1.0" is CC0-1.0 in another case, and the library reads an id exactly: did you mean `--license CC0-1.0`?']);
      expect([wrong, lower].map((r) => hintedCalls(r.error!.message, { tool: "import", args }).map((h) => h.args?.license))).toEqual([["CC-BY-4.0"], ["CC0-1.0"]]);
      // under its own license, its credit is the file's, so the authors are kept
      const back = await call("import", { ...args, license: "CC-BY-4.0" }), m = JSON.parse(readFileSync(join(cwd, "imports/AKIMBO/_set.json"), "utf8")) as { credit: string; sources: { AKIMBO: { credit: string } } };
      expect([back.error, m.credit, m.sources.AKIMBO.credit]).toEqual([null, copyright, copyright]);
      // a composed clip's license (D10: its inputs' ids joined with " AND "), as m3a's export writes it: refused under one
      // of its ids, the fix a flag quoted for the shell, which runs as written and imports it, its ids and credit kept
      writeFileSync(join(cwd, "game.json"), JSON.stringify({ tiers: ["cc0", "cc-by", "cmu"] }));
      const mixed = (await call("recipe.compile", { recipe: JSON.stringify({ format: "2.0", id: "RECIPES/Mixed", steps: [{ op: "clip", id: "STYLE100/Akimbo_Walk", to: 0.6 }, { op: "clip", id: "CMU_CURATED/Answer_Phone", to: 0.6 }, { op: "sequence", items: ["s1", "s2"] }] }) })).data as { path: string; license: string; credit: string };
      const both = "CC-BY-4.0 AND LicenseRef-CMU-Mocap", composed = ((await call("export", { clip: mixed.path, character: RIG })).data as { file: string }).file;
      const mix = { path: composed, set: "MIXED", license: "CC-BY-4.0" }, one = await call("import", mix);
      expect([mixed.license, refused(one)]).toEqual([both, ["usage", "E_ARGS", `the file says its animations are ${both} (each animation's extras.license); --license CC-BY-4.0 contradicts it: pass \`--license '${both}'\``]]);
      const [fix] = hintedCalls(one.error!.message, { tool: "import", args: mix }), taken = await call(fix!.tool!, fix!.args!);
      // no note: each part's text is kept, and license.check reads the set's license part by part, so it passes
      const got = taken.data as { license: string; clips: { id: string }[]; notes: string[] };
      expect([fix!.args!.license, taken.error, got.license, got.notes, openLibrary({ dir: join(cwd, "imports"), tiers: ["local"] }).clip(got.clips[0]!.id).clip.provenance]).toEqual([both, null, both, [], expect.objectContaining({ license: both, credit: mixed.credit })]);
      expect((await call("license.check", { set: "MIXED", tiers: ["local"], ships: false })).data).toMatchObject({ ok: true, fails: 0 });
      // its ids compared as sets, case aside: the file's in another order and case taken as the call spells them (a fix
      // spelling them as the library does), and a composed --license in another case refused naming its spelling
      writeFileSync(join(cwd, "lower.vrma"), licensed(readFileSync(join(cwd, composed)), "licenseref-cmu-mocap AND cc-by-4.0"));
      const low = { path: "lower.vrma", set: "LOWER", license: both }, wrong2 = await call("import", { ...low, license: "CC0-1.0" }), cased = await call("import", { ...low, license: "cc-by-4.0 AND LicenseRef-CMU-Mocap" });
      expect([refused(wrong2)[2], refused(cased)[2], (await call("import", low)).error]).toEqual([
        "the file says its animations are licenseref-cmu-mocap AND cc-by-4.0 (each animation's extras.license); --license CC0-1.0 contradicts it: pass `--license 'LicenseRef-CMU-Mocap AND CC-BY-4.0'`",
        `license "cc-by-4.0 AND LicenseRef-CMU-Mocap" is ${both} in another case, and the library reads an id exactly: did you mean \`--license '${both}'\`?`, null]);
      expect([wrong2, cased].map((r) => hintedCalls(r.error!.message, { tool: "import", args: low }).map((h) => [h.args?.license, h.problem]))).toEqual([[["LicenseRef-CMU-Mocap AND CC-BY-4.0", undefined]], [[both, undefined]]]);
      // ids each SPDX's: a stray " AND " refused; a file's license that is no SPDX id can't contradict, and is noted
      expect(refused(await call("import", { ...low, license: `${both} AND ` }))).toEqual(["usage", "E_ARGS", `license "${both} AND " is no SPDX id: CC0-1.0, CC-BY-4.0, ..., or LicenseRef-<name> for other terms; a composed clip's joins its ids with " AND "`]);
      writeFileSync(join(cwd, "free.vrma"), licensed(readFileSync(join(cwd, composed)), "CC BY 4.0"));
      const free = await call("import", { path: "free.vrma", set: "FREE", license: "CC-BY-4.0" });
      expect([free.error, (free.data as { notes: string[] }).notes]).toEqual([null, ['the file\'s extras.license "CC BY 4.0" is no SPDX id: its clips carry CC-BY-4.0']]);
      // two animations sharing a name are io's X and X_2 (describeGltf, as its readers name them): the license of the one
      // "$skip" leaves out, by that name, isn't the file's
      const twice = JSON.parse(readFileSync(join(cwd, RIG), "utf8")) as { animations: { name: string; extras?: object }[] };
      twice.animations[1]!.extras = { license: "CC0-1.0" };
      Object.assign(twice.animations[2]!, { name: twice.animations[1]!.name, extras: { license: "CC-BY-4.0" } });
      writeFileSync(join(cwd, "twice.gltf"), JSON.stringify(twice));
      const one2 = await call("import", { path: "twice.gltf", set: "TWICE", license: "CC0-1.0", catalog: JSON.stringify({ $skip: { Wave_Loop_2: "the CC-BY take" } }) });
      expect([one2.error, (one2.data as { clips: { id: string }[] }).clips.map((c) => c.id)]).toEqual([null, ["TWICE/A_TPose", "TWICE/Wave_Loop"]]);
      // a composed license with a part whose text the library doesn't keep: that part named, by import and license.check
      writeFileSync(join(cwd, "mine.vrma"), licensed(readFileSync(join(cwd, composed)), "LicenseRef-Mine AND CC-BY-4.0"));
      const mine = await call("import", { path: "mine.vrma", set: "MINE", license: "CC-BY-4.0 AND LicenseRef-Mine" });
      expect([mine.error, (mine.data as { notes: string[] }).notes]).toEqual([null, ["LicenseRef-Mine's text isn't in library/LICENSES/: license.check fails the set"]]);
      expect((await call("license.check", { set: "MINE", tiers: ["local"], ships: false })).data).toMatchObject({ ok: false, fails: 1, findings: [{ where: '"MINE sources.MINE"', message: "LicenseRef-Mine's text isn't kept in library/LICENSES/LicenseRef-Mine.txt" }] });
      // one clip on two characters: two files; a .bvh says it carries no license or credit
      const [onRig, onTiny] = [await call("export", { clip: WALK, character: RIG, format: "bvh" }), await call("export", { clip: WALK, character: "tiny", format: "bvh" })];
      const files = [onRig, onTiny].map((r) => (r.data as { file: string }).file);
      expect([files, files.map((f) => existsSync(join(cwd, f))), onRig.lines[1]]).toEqual([[`${OUT}-on-rig.bvh`, `${OUT}-on-tiny.bvh`], [true, true], "the .bvh carries no license or credit: keep this reply's license line with it"]);
      // a second file imported into IMPORT replaces the first's clips: the verdict says so, as its line and data do
      const [first, second] = [await call("import", { path: files[0]!, license: "CC0-1.0" }), await call("import", { path: RIG, license: "CC0-1.0" })];
      expect([first.verdict.includes("replaced"), second.verdict, (second.data as { removed?: number }).removed]).toEqual([false, expect.stringMatching(/; replaced 1 clip file an earlier import wrote$/), 1]);
    }));
});
