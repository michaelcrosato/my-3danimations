// The migrated library (WP-1.5), checked offline from the committed files: every clip validates with zero errors and
// exactly its baselined warnings, is in canonical form, and (for the sets tier 2 covers) decodes like its source within
// 0.001 mm; every set manifest validates, its content id matches its files, and its catalog has one valid row a clip.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { format, parseClip, serialize, validate, validation, type Rest } from "@m3a/core";

const { pose } = format, { validateCatalogRow } = validation;
import { Ajv2020 } from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { loadTier2 } from "../../../spec/conformance/runner/vectors.ts";
import { CMU_NOTICE } from "../sets.ts";

const baselineSchema = new Ajv2020({ strict: false }).compile(JSON.parse(readFileSync(join(import.meta.dirname, "../../../spec/schemas/baseline.schema.json"), "utf8")) as object);
/** The source record fields spec/MOTION.md §9.1 names. */
const SOURCE_FIELDS = ["label", "origin", "license", "terms", "url", "credit", "audit", "file", "rig", "rest"];

const LIB = join(import.meta.dirname, "../../../library/sets");
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const sets = readdirSync(LIB).sort();
/** The tier-2 vector file that holds each migrated set's source clips. */
const TIER2: Record<string, string> = { QUATERNIUS_3D2DGE: "QUATERNIUS", MESH2MOTION: "MESH2MOTION", CMU_CURATED: "CMU" };

describe("the migrated library", () => {
  it("holds the five seed sets with the clip counts PLAN.md WP-1.5 names", () => {
    const count = (s: string) => readdirSync(join(LIB, s)).filter((f) => !f.startsWith("_") && f.endsWith(".json")).length;
    expect(Object.fromEntries(sets.map((s) => [s, count(s)]))).toEqual({ CMU_CURATED: 60, MESH2MOTION: 177, QUATERNIUS_3D2DGE: 88, QUATERNIUS_SHARDFALL: 102, STYLE100: 98 });
  });
  for (const set of sets) {
    describe(set, () => {
      const dir = join(LIB, set);
      const files = readdirSync(dir).filter((f) => !f.startsWith("_") && f.endsWith(".json")).sort();
      const manifest = JSON.parse(readFileSync(join(dir, "_set.json"), "utf8"));
      const baseline = JSON.parse(readFileSync(join(dir, "_baseline.json"), "utf8")).clips as Record<string, { code: string; at: string; reason: string }[]>;
      it("validates its manifest and baseline, with only specified fields, and its content id matches its clip files", () => {
        const lint = validate(manifest, { kind: "set", mode: "lint" });
        expect([...lint.errors, ...lint.warnings]).toEqual([]);
        for (const src of Object.values(manifest.sources) as Record<string, unknown>[]) expect(Object.keys(src).filter((k) => !SOURCE_FIELDS.includes(k))).toEqual([]);
        expect(baselineSchema(JSON.parse(readFileSync(join(dir, "_baseline.json"), "utf8"))), JSON.stringify(baselineSchema.errors)).toBe(true);
        const id = sha(files.map((f) => `${f}\n${sha(readFileSync(join(dir, f), "utf8"))}\n`).join(""));
        expect(manifest.content.sha256).toBe(id);
        expect(manifest.tier).toBe({ CMU_CURATED: "cmu", STYLE100: "cc-by" }[set as "CMU_CURATED" | "STYLE100"] ?? "cc0");
      });
      it("has every clip valid, canonical, and warned only as baselined (each with a reason)", () => {
        for (const f of files) {
          const text = readFileSync(join(dir, f), "utf8");
          const clip = parseClip(text);
          expect(serialize(clip), f).toBe(text);
          const r = validate(clip, { mode: "read" });
          expect(r.errors, f).toEqual([]);
          expect(validate(clip, { mode: "lint" }).warnings.filter((w) => w.code === "M2-W001"), `${f}: every field is specified`).toEqual([]);
          const got = r.warnings.map((w) => `${w.code} ${w.key !== undefined ? `key ${w.key} (t ${w.t}) ` : ""}${w.field ?? ""}${w.index !== undefined ? `[${w.index}]` : ""}`);
          const want = (baseline[f.replace(/\.json$/, "")] ?? []).map((b) => `${b.code} ${b.at}`);
          expect(got, f).toEqual(want);
          for (const b of baseline[f.replace(/\.json$/, "")] ?? []) {
            expect(b.reason.length, f).toBeGreaterThan(20);
            // a reason's claim about the limb holds at the key it is written for
            const m = /^key (\d+) .*?(arm|leg)([LR])\[4\]$/.exec(b.at);
            const bend = m ? (clip.keys[Number(m[1]) - 1]![`${m[2]}${m[3]}` as "armL"] as number[])[3]! : undefined;
            if (b.code === "M2-W002") expect(bend, `${f} ${b.at}`).toBeGreaterThan(135);
            if (b.code === "M2-W005" && m) expect(bend, `${f} ${b.at}`).toBeLessThanOrEqual(25);
          }
          expect(clip.id).toBe(`${set}/${f.replace(/\.json$/, "")}`);
          expect(manifest.sources[clip.restSrc], f).toBeDefined();
        }
      });
      it("lists every clip once in its catalog", () => {
        const rows = readFileSync(join(dir, "catalog.tsv"), "utf8").trimEnd().split("\n");
        expect(rows.map((r) => r.split("\t")[0]).sort()).toEqual(files.map((f) => `${set}/${f.replace(/\.json$/, "")}`).sort());
        for (const r of rows) expect(validateCatalogRow(r).errors, r).toEqual([]);
      });
      if (TIER2[set]) {
        it("decodes like its source within 0.001 mm at every key and in-between", () => {
          const v = loadTier2(TIER2[set]!);
          const ids = Object.keys(manifest.sources);
          const base = manifest.sources[ids[0]!].rest;
          const out = new Float32Array(108);
          let checked = 0;
          for (const f of files) {
            const clip = parseClip(readFileSync(join(dir, f), "utf8"));
            const vc = v.clips[clip.name]!;
            const R = { ...base, spineW: manifest.sources[clip.restSrc].rest.spineW, neckW: manifest.sources[clip.restSrc].rest.neckW } as Rest;
            for (const s of [...vc.keys, ...vc.between]) {
              pose(R, clip, s.t, out);
              for (let i = 0; i < 108; i++) if (!(Math.abs(out[i]! * 1000 - s.at[i]!) <= 1)) throw new Error(`${clip.id} t ${s.t} [${i}]: ${out[i]} vs ${s.at[i]! / 1000}`);
              checked++;
            }
          }
          expect(checked).toBeGreaterThan(files.length);
        });
      }
    });
  }
  it("carries CMU's notice word for word, and credits for the attribution tiers", () => {
    const research = readFileSync(join(import.meta.dirname, "../../../research_notes/AI native game animation landscape/data_licensing_registries.md"), "utf8");
    expect(research).toContain(`The full notice as reproduced by 4TU: "${CMU_NOTICE}"`);
    const cmu = JSON.parse(readFileSync(join(LIB, "CMU_CURATED/_set.json"), "utf8"));
    for (const s of Object.values(cmu.sources) as { terms: string; license: string }[]) {
      expect(s.terms).toBe(CMU_NOTICE);
      expect(s.license).toBe("LicenseRef-CMU-Mocap");
    }
    const style = parseClip(readFileSync(join(LIB, "STYLE100", readdirSync(join(LIB, "STYLE100")).find((f) => !f.startsWith("_") && f.endsWith(".json"))!), "utf8"));
    expect(style.provenance).toMatchObject({ license: "CC-BY-4.0", credit: expect.stringMatching(/100STYLE/) });
  });
});
