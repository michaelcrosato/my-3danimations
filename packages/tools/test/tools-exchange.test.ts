// Exchange (PLAN.md WP-7.2b): import and export on every surface, then their failing inputs; an imported set that the
// library opens as a local set (openLibrary on imports/), which license.check fails for a shipped game and passes for one
// that stays on the machine (D10), its rest take held a frame, imported again in place; and a clip exported as VRMA
// (read back byte for byte), .glb (onto Rigify's turned and scaled armature too) and BVH, each read back through io
// within 1 mm, the BVH and VRMA then imported again.
import { cpSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { openLibrary } from "@m3a/library/node";
import { describe, expect, it } from "vitest";
import { nodeHost } from "../src/node.ts";
import { Registry, type Reply } from "../src/registry/index.ts";
import { EXCHANGE, SHIP } from "../src/tools/index.ts";
import { exampleCwd, runExamples } from "./helpers/surfaces.ts";

const RIG = "spec/vectors/tier1b/rig.gltf", RIGIFY = "spec/vectors/tier1b/rigify.gltf", WALK = "QUATERNIUS_3D2DGE/Walk_Loop";
const refused = (r: Reply) => [r.status, r.error?.code, r.error?.message];
type Data = Record<string, unknown> & { clips: { id: string; dur: number; keys: number; fit: number[] }[] };

/** Runs `body` with calls into one fresh working directory (seeded), deleted after. */
async function inCwd(body: (call: (tool: string, args: object) => Promise<Reply>, cwd: string) => Promise<void>): Promise<void> {
  const { cwd, rm } = exampleCwd(), reg = new Registry([...EXCHANGE, ...SHIP]), host = nodeHost(cwd);
  try {
    await body((tool, args) => reg.call(tool, args, { host }), cwd);
  } finally {
    rm();
  }
}

describe("exchange", () => {
  runExamples(EXCHANGE);

  it("import refuses a file that is no motion file, no license or none SPDX, a path out, a bad or taken set name, and a truncated BVH", () =>
    inCwd(async (call, cwd) => {
      const bvh = (await call("export", { clip: WALK, character: RIG, format: "bvh" })).data as { file: string };
      writeFileSync(join(cwd, "cut.bvh"), readFileSync(join(cwd, bvh.file), "utf8").slice(0, 3000));
      expect(refused(await call("import", { path: "spec/vectors/tier1b/rig-catalog.json", license: "CC0-1.0" }))).toEqual(["usage", "E_ARGS", '"spec/vectors/tier1b/rig-catalog.json" is no motion file: give a .gltf, .glb, .bvh or .vrma']);
      expect(refused(await call("import", { path: RIG }))).toEqual(["usage", "E_ARGS", expect.stringMatching(/^license is the file's SPDX id/)]);
      expect(refused(await call("import", { path: RIG, license: "CC0 1.0" }))).toEqual(["usage", "E_ARGS", expect.stringMatching(/^license "CC0 1.0" is no SPDX id/)]);
      expect(refused(await call("import", { path: "../outside.bvh", license: "CC0-1.0" }))).toEqual(["usage", "E_PATH", expect.stringMatching(/outside the working directory/)]);
      expect(refused(await call("import", { path: RIG, license: "CC0-1.0", set: "bad name" }))).toEqual(["usage", "E_ARGS", 'set is the new set\'s name, A-Z, 0-9 and _ (as IMPORT), not "bad name"']);
      expect(refused(await call("import", { path: RIG, license: "CC0-1.0", set: "QUATERNIUS_3D2DGE" }))).toEqual(["usage", "E_ARGS", "set QUATERNIUS_3D2DGE is the library's: name the new set another way"]);
      expect(refused(await call("import", { path: "cut.bvh", license: "CC0-1.0" }))).toEqual(["error", "E_FORMAT", expect.stringMatching(/^cut\.bvh: /)]);
    }));

  it("imports a set the library opens as local, which license.check fails for a shipped game (D10); lists; imports in place", () =>
    inCwd(async (call, cwd) => {
      const list = await call("import", { path: RIG, list: true });
      expect([list.verdict, list.data, list.next]).toEqual([`import ${RIG}: 3 animations, rig gltf:unreal; nothing written`, expect.objectContaining({ clips: [{ name: "A_TPose" }, { name: "Wave_Loop" }, { name: "Step_RM" }], set: null }), `\`import ${RIG} --license <license>\` fits them into imports/IMPORT/`]);
      const r = await call("import", { path: RIG, set: "RIG", license: "CC0-1.0", catalog: "spec/vectors/tier1b/rig-catalog.json" }), d = r.data as Data;
      expect([r.status, r.verdict]).toEqual(["ok", "import spec/vectors/tier1b/rig.gltf: 3 clips into imports/RIG/ (gltf:unreal, tier local), fit 0.7 mm mean, worst 38 mm (RIG/Wave_Loop)"]);
      // the rest take (one frame) held a frame (I4): a clip, not M2-E014's dur 0
      expect(d.clips.map((c) => [c.id, c.dur, c.keys, c.fit])).toEqual([["RIG/A_TPose", 0.033, 1, [0, 2]], ["RIG/Wave_Loop", 1, 11, [2, 38]], ["RIG/Step_RM", 1, 2, [0, 2]]]);
      const lib = openLibrary({ dir: join(cwd, "imports"), tiers: ["local"] }), wave = lib.clip("RIG/Wave_Loop");
      lib.verify();
      expect([lib.sets().map((s) => [s.set, s.tier, s.clips]), wave.clip.provenance.license, wave.clip.tags, lib.about("RIG").sources.RIG!.terms]).toEqual([[["RIG", "local", 3]], "CC0-1.0", ["gesture"], "CC0 1.0"]);
      expect(r.next).toBe('`license.check --set RIG` fails it for a shipped game (D10: local); to use it here, set "tiers" to include "local" and "ships": false in game.json, then `metrics RIG/Wave_Loop`');
      // license.check sees it through the host: a shipped game fails it, one on this machine alone (ships: false) takes it
      expect((await call("license.check", { set: "RIG" })).data).toMatchObject({ ok: false, findings: [{ where: "RIG", message: expect.stringMatching(/^a local set and this game opts into cc0/) }, { where: "RIG", message: expect.stringMatching(/^local content never ships \(D10\)/) }] });
      expect((await call("license.check", { clips: ["RIG/Wave_Loop"], tiers: ["cc0", "local"] })).status).toBe("findings");
      expect((await call("license.check", { clips: ["RIG/Wave_Loop"], tiers: ["cc0", "local"], ships: false })).status).toBe("ok");
      // imported again in place: a clip it no longer makes goes, and the set still opens
      writeFileSync(join(cwd, "cat.json"), JSON.stringify({ ...JSON.parse(readFileSync(join(cwd, "spec/vectors/tier1b/rig-catalog.json"), "utf8")), $skip: { Step_RM: "a slide, not a step" } }));
      const again = await call("import", { path: RIG, set: "RIG", license: "CC0-1.0", catalog: "cat.json" });
      expect([again.status, (again.data as Data).skipped, readdirSync(join(cwd, "imports/RIG")).sort()]).toEqual(["ok", [{ name: "Step_RM", why: "a slide, not a step" }], ["A_TPose.json", "Wave_Loop.json", "_set.json", "catalog.tsv"]]);
      expect(openLibrary({ dir: join(cwd, "imports"), tiers: ["local"] }).catalog().map((c) => c.id)).toEqual(["RIG/A_TPose", "RIG/Wave_Loop"]);
      expect((await call("license.check", { clips: ["RIG/Step_RM"], tiers: ["local"], ships: false })).data).toMatchObject({ findings: [{ message: expect.stringMatching(/^no clip "RIG\/Step_RM"/) }] });
      // an imported set reached through a link out of the working directory is not read
      const { cwd: out, rm } = exampleCwd(false);
      cpSync(join(cwd, "imports/RIG"), join(out, "OUT"), { recursive: true });
      symlinkSync(join(out, "OUT"), join(cwd, "imports/OUT"));
      expect(refused(await call("license.check", { set: "OUT" }))).toEqual(["usage", "E_ARGS", expect.stringMatching(/^no set "OUT"/)]);
      rm();
    }));

  it("exports VRMA byte for byte, .glb and BVH within 1 mm (Rigify's turned, scaled armature and the tiny rig too), and imports them again", () =>
    inCwd(async (call) => {
      const out = async (args: object) => {
        const r = await call("export", { clip: WALK, character: RIG, ...args });
        return [r.status, (r.data as { check: string }).check, (r.data as { roundtrip_mm: number | null }).roundtrip_mm, r.data as { file: string; license: object }] as const;
      };
      const vrma = await out({});
      expect(vrma.slice(0, 3)).toEqual(["ok", "reads back byte for byte", null]);
      expect(vrma[3]).toMatchObject({ file: "check-output/export/Walk_Loop.vrma", license: { spdx: "CC0-1.0", tier: "cc0", credit: null } });
      // Rigify's .gltf (its soles' end bones have no node), the tiny rig (no file: its own document), BVH on rig.gltf
      for (const [args, file] of [[{ format: "glb", character: RIGIFY }, "Walk_Loop.glb"], [{ format: "glb", character: "tiny" }, "Walk_Loop.glb"], [{ format: "bvh" }, "Walk_Loop.bvh"]] as const) {
        const [status, check, gap, data] = await out(args);
        expect([status, data.file, check]).toEqual(["ok", `check-output/export/${file}`, expect.stringMatching(/^read back, its joints within 0\.0\d\d mm$/)]);
        expect(gap).toBeLessThan(1);
      }
      // what export wrote reads as motion again: the BVH by Unreal's names, the VRMA by its humanoid
      const bvh = await call("import", { path: "check-output/export/Walk_Loop.bvh", set: "BACK", license: "CC0-1.0" }), vr = await call("import", { path: "check-output/export/Walk_Loop.vrma", set: "VBACK", license: "CC0-1.0" });
      expect([bvh.status, (bvh.data as Data).rig, (bvh.data as Data).clips.map((c) => c.id), vr.status, (vr.data as Data).rig]).toEqual(["ok", "bvh:unreal", ["BACK/Walk_Loop"], "ok", "gltf:vrm"]);
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
