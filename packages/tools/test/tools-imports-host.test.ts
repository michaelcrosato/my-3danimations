// The Node host's imported sets (PLAN.md WP-7.2b, D93, D96): the library's source lists and reads a set under imports/
// when it is asked, so a call that opened its library before imports/ was there still sees what an import wrote since,
// a set imports/ doesn't hold being none (ENOENT), and an imports/ that leads out of the working directory still
// refused by the host's confinement; and two first imports into one set, run together in one process, leave the set
// as the last one wrote it, which the library then verifies for a game that opts in to local.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { libraryAccess } from "../src/node/library.ts";
import { nodeHost } from "../src/node.ts";
import { Registry, type Reply } from "../src/registry/index.ts";
import { CHECK, EXCHANGE } from "../src/tools/index.ts";
import { exampleCwd } from "./helpers/cwd.ts";

const RIG = "spec/vectors/tier1b/rig.gltf", WALK = "QUATERNIUS_3D2DGE/Walk_Loop";
type Data = { file: string; clips: { id: string }[]; removed?: number };

describe("the host's imported sets", () => {
  it("lists and reads a set imports/ holds when asked, though imports/ wasn't there when the call opened its library", () => {
    const { cwd, rm } = exampleCwd(false);
    try {
      const access = libraryAccess(cwd);
      expect([access.source.sets().includes("CC"), access.warnings]).toEqual([false, []]);
      mkdirSync(join(cwd, "imports/CC"), { recursive: true });
      writeFileSync(join(cwd, "imports/CC/x.json"), "{}");
      expect([access.source.files("CC"), access.source.read("CC", "x.json")]).toEqual([["x.json"], "{}"]);
      // a set imports/ doesn't hold is none: ENOENT, which import reads as no files
      expect(() => access.source.files("DD")).toThrow(expect.objectContaining({ code: "ENOENT" }));
    } finally {
      rm();
    }
  });

  it("refuses a set read through an imports/ that leads out of the working directory", () => {
    const { cwd, rm } = exampleCwd(false), out = exampleCwd(false);
    try {
      mkdirSync(join(out.cwd, "CC"));
      writeFileSync(join(out.cwd, "CC/x.json"), "{}");
      symlinkSync(out.cwd, join(cwd, "imports"));
      const access = libraryAccess(cwd);
      expect(access.warnings.length).toBe(1);
      for (const f of [() => access.source.files("CC"), () => access.source.read("CC", "x.json")]) expect(f).toThrow(expect.objectContaining({ code: "E_PATH" }));
    } finally {
      rm();
      out.rm();
    }
  });

  it("leaves a set that two first imports run into together as the last one wrote it, which the library verifies", async () => {
    const { cwd, rm } = exampleCwd(), reg = new Registry([...EXCHANGE, ...CHECK]), host = nodeHost(cwd);
    const call = (tool: string, args: object): Promise<Reply> => reg.call(tool, args, { host });
    try {
      const walk = await call("export", { clip: WALK, character: RIG, format: "bvh" });
      expect(walk.status, walk.error?.message).not.toBe("error");
      // the file the reply names, whatever export calls it
      cpSync(join(cwd, (walk.data as { file: string }).file), join(cwd, "walk.bvh"));
      expect(existsSync(join(cwd, "imports"))).toBe(false);
      // both open their library before either writes: neither sees imports/ there
      const both = await Promise.all([RIG, "walk.bvh"].map((path) => call("import", { path, set: "CC", license: "CC0-1.0" })));
      expect(both.map((r) => r.error?.code ?? r.status)).toEqual([expect.stringMatching(/^(ok|findings)$/), expect.stringMatching(/^(ok|findings)$/)]);
      const manifest = JSON.parse(readFileSync(join(cwd, "imports/CC/_set.json"), "utf8")) as { sources: Record<string, { file: string }> };
      const [first, last] = (manifest.sources.CC!.file === "walk.bvh" ? [both[0]!, both[1]!] : [both[1]!, both[0]!]).map((r) => r.data as Data) as [Data, Data];
      const held = readdirSync(join(cwd, "imports/CC")).filter((f) => f.endsWith(".json") && !f.startsWith("_")).map((f) => `CC/${f.slice(0, -5)}`).sort();
      expect([held, last.removed]).toEqual([last.clips.map((c) => c.id).sort(), first.clips.length]);
      writeFileSync(join(cwd, "game.json"), JSON.stringify({ tiers: ["cc0", "local"] }));
      for (const { id } of last.clips) {
        const r = await call("metrics", { clip: id });
        expect([id, r.error?.code ?? r.status]).toEqual([id, expect.stringMatching(/^(ok|findings)$/)]);
      }
    } finally {
      rm();
    }
  });
});
