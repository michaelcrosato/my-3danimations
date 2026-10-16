// Exchange (PLAN.md WP-7.2b): import and export on every surface (import listed to MCP as no read-only tool), then their
// failing inputs (a catalog off its shape too); an imported set that the library opens as a local set (openLibrary on
// imports/), which license.check fails for a shipped game and passes for one that stays on the machine (D10), its rest
// take held a frame, imported again in place under a credited license (the host's library opened again; every clip file
// it doesn't write removed, so the set verifies), a broken imported set left out with a warning, breaking no other, and
// one named as a library set left out, import refusing the name; and a clip exported as VRMA (read back byte for byte),
// .glb (onto Rigify's turned and scaled armature too; off, findings, under an uneven scale) and BVH, each read back
// through io within 1 mm, the VRMA then imported again, and the BVH jittered, from an absolute path, past the fit
// limits.
import { cpSync, mkdirSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { openLibrary } from "@m3a/library/node";
import { describe, expect, it } from "vitest";
import { mcpTool } from "../src/mcp.ts";
import { nodeHost } from "../src/node.ts";
import { Registry, type Host, type Reply } from "../src/registry/index.ts";
import { exportClip, importMotion } from "../src/tools/exchange.ts";
import { EXCHANGE, SHIP } from "../src/tools/index.ts";
import { exampleCwd, runExamples } from "./helpers/surfaces.ts";

const RIG = "spec/vectors/tier1b/rig.gltf", RIGIFY = "spec/vectors/tier1b/rigify.gltf", WALK = "QUATERNIUS_3D2DGE/Walk_Loop", OUT = "check-output/export/QUATERNIUS_3D2DGE_Walk_Loop";
const refused = (r: Reply) => [r.status, r.error?.code, r.error?.message];
type Data = Record<string, unknown> & { clips: { id: string; dur: number; keys: number; fit: number[] }[] };

/** Runs `body` with calls into one fresh working directory (seeded), its host too, deleted after. */
async function inCwd(body: (call: (tool: string, args: object) => Promise<Reply>, cwd: string, host: Host) => Promise<void>): Promise<void> {
  const { cwd, rm } = exampleCwd(), reg = new Registry([...EXCHANGE, ...SHIP]), host = nodeHost(cwd);
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

  it("import refuses a file that is no motion file, no license or none SPDX, a path out, a bad, kept or taken set name, a catalog off its shape, and a truncated BVH", () =>
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
      expect(refused(await call("import", { path: "cut.bvh", license: "CC0-1.0" }))).toEqual(["error", "E_FORMAT", expect.stringMatching(/^cut\.bvh: /)]);
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
      expect((await call("license.check", { set: "RIG" })).data).toMatchObject({ ok: false, findings: [{ where: "RIG", message: expect.stringMatching(/^a local set and this game opts into cc0/) }, { where: "RIG", message: expect.stringMatching(/^local content never ships \(D10\)/) }] });
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
      expect(again.lines[0]).toBe("note: CC-BY-SA-4.0's text isn't in library/LICENSES/: license.check fails the set");
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
      openLibrary({ dir: join(cwd, "imports"), tiers: ["local"] }).verify();
      // a broken imported set is left out, warned on every call, and breaks no other: a manifest that isn't JSON, one that
      // says it ships (tier cc0), a set reached through a link out of the working directory, and one named as a library
      // set (the library's wins), which import refuses to write
      cpSync(join(cwd, "imports/RIG"), join(cwd, `imports/${WALK.split("/")[0]}`), { recursive: true });
      expect(refused(await call("import", { path: RIG, license: "CC0-1.0", set: "QUATERNIUS_3D2DGE" }))).toEqual(["usage", "E_ARGS", "set QUATERNIUS_3D2DGE is the library's: name the new set another way"]);
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
      expect(vrma[3]).toMatchObject({ file: `${OUT}.vrma`, license: { spdx: "CC0-1.0", tier: "cc0", credit: null } });
      // Rigify's .gltf (its soles' end bones have no node), the tiny rig (no file: its own document), BVH on rig.gltf
      for (const [args, ext] of [[{ format: "glb", character: RIGIFY }, "glb"], [{ format: "glb", character: "tiny" }, "glb"], [{ format: "bvh" }, "bvh"]] as const) {
        const [status, check, gap, data] = await out(args);
        expect([status, data.file, check]).toEqual(["ok", `${OUT}.${ext}`, expect.stringMatching(/^read back, its joints within 0\.0\d\d mm$/)]);
        expect(gap).toBeLessThan(1);
      }
      // a node above the bones scaled unevenly shears them as they turn, which no glTF animation follows: findings
      const skew = JSON.parse(readFileSync(join(cwd, RIG), "utf8")) as { nodes: { scale?: number[] }[] };
      skew.nodes[0]!.scale = [1, 1.2, 1];
      writeFileSync(join(cwd, "skew rig.gltf"), JSON.stringify(skew));
      const [status, check, gap, , next] = await out({ format: "glb", character: "skew rig.gltf" });
      expect([status, check, gap! > 1, next]).toEqual(["findings", expect.stringMatching(/^read back, its joints within \d+\.\d+ mm$/), true, `it reads back off: a node above its bones may scale unevenly, which no glTF animation follows (else report it: a bug); \`export ${WALK} --character 'skew rig.gltf' --format bvh\` writes one that reads back`]);
      // what export wrote reads as motion again: the VRMA by its humanoid, the BVH (below) by Unreal's names
      const vr = await call("import", { path: `${OUT}.vrma`, set: "VBACK", license: "CC0-1.0" });
      expect([vr.status, (vr.data as Data).rig, (vr.data as Data).clips.map((c) => c.id)]).toEqual(["ok", "gltf:vrm", ["VBACK/QUATERNIUS_3D2DGE_Walk_Loop"]]);
      // the BVH jittered (turns by up to 75°, places by up to 7.5 cm), from an absolute path, its catalog from one:
      // past the fit limits, so findings; the manifest names the file by its own name alone, the hint neither path
      let seed = 7;
      const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648 - 0.5, [head, motion] = readFileSync(join(cwd, `${OUT}.bvh`), "utf8").split("MOTION\n");
      const jitter = motion!.split("\n").map((l, i) => (i < 2 || !l.trim() ? l : l.split(" ").map((x, k) => (Number(x) + (k < 3 ? 15 : 150) * rnd()).toFixed(4)).join(" ")));
      writeFileSync(join(cwd, "jitter.bvh"), `${head}MOTION\n${jitter.join("\n")}`);
      writeFileSync(join(cwd, "none.json"), "{}");
      const jit = await call("import", { path: join(cwd, "jitter.bvh"), set: "JIT", license: "CC0-1.0", catalog: join(cwd, "none.json") }), m = JSON.parse(readFileSync(join(cwd, "imports/JIT/_set.json"), "utf8")) as { title: string; credit: string; sources: { JIT: { file: string; origin: string } } };
      expect([jit.status, (jit.data as Data).rig, jit.verdict, jit.lines.at(-1), jit.next]).toEqual(["findings", "bvh:unreal", expect.stringMatching(/^import <the file>: 1 clip into imports\/JIT\/ .*; 1 past the fit limits$/), expect.stringMatching(/^JIT\/jitter .* \(past 40\/300 mm\)$/), 'cut a take with the catalog\'s "$pick", or leave a clip out with "$skip" and its reason, then `import <the file> --set JIT --license CC0-1.0 --catalog <the catalog\'s file>`']);
      expect([m.title, m.credit, m.sources.JIT.file, m.sources.JIT.origin]).toEqual(["jitter.bvh, imported", "jitter.bvh, CC0-1.0", "jitter.bvh", "jitter.bvh, imported by m3a import"]);
    }));

  it("export refuses a clip that isn't there, a format it doesn't write, and a character with no humanoid", () =>
    inCwd(async (call, cwd) => {
      writeFileSync(join(cwd, "chain.gltf"), JSON.stringify({ asset: { version: "2.0" }, nodes: [0, 1, 2].map((i) => ({ name: `b${i}`, ...(i < 2 ? { children: [i + 1] } : {}) })) }));
      expect(refused(await call("export", { clip: "QUATERNIUS_3D2DGE/Walk_Lop", character: RIG }))).toEqual(["usage", "E_NO_CLIP", expect.stringMatching(/did you mean "QUATERNIUS_3D2DGE\/Walk_Loop"\?$/)]);
      expect(refused(await call("export", { clip: WALK, character: RIG, format: "fbx" }))).toEqual(["usage", "E_ARGS", expect.stringMatching(/^format is "fbx", not one of vrma, glb, bvh/)]);
      expect(refused(await call("export", { clip: WALK, character: "chain.gltf" }))).toEqual(["error", "E_RIG", expect.stringMatching(/^chain\.gltf: no humanoid bone recognized/)]);
      expect(refused(await call("export", { clip: WALK, character: "spec/vectors/tier1b/rig-catalog.json" }))).toEqual(["usage", "E_ARGS", expect.stringMatching(/is not a character/)]);
    }));
});
