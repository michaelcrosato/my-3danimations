// The library's sets (WP-1.5, WP-5.3), checked offline from the committed files: every clip validates with zero errors
// and exactly its baselined warnings, is in canonical form, and (a clip still migrated, in the sets tier 2 covers)
// decodes like its source within 0.001 mm; a re-imported set records every clip's choice and keeps the fit limits;
// every set manifest validates, its content id matches its files, and its catalog has one valid row a clip.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { format, parseClip, serialize, validate, validation, type Rest } from "@m3a/core";

const { pose } = format, { validateCatalogRow } = validation;
import { Ajv2020 } from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { loadTier2 } from "../../../spec/conformance/runner/vectors.ts";
import { CMU_NOTICE } from "../sets.ts";

const baselineSchema = new Ajv2020({ strict: false }).compile(JSON.parse(readFileSync(join(import.meta.dirname, "../../../spec/schemas/baseline.schema.json"), "utf8")) as object);
const importSchema = new Ajv2020({ strict: false }).compile(JSON.parse(readFileSync(join(import.meta.dirname, "../../import/import.schema.json"), "utf8")) as object);
/** The source record fields spec/MOTION.md §9.1 names. */
const SOURCE_FIELDS = ["label", "origin", "license", "terms", "url", "credit", "audit", "file", "rig", "rest"];

const LIB = join(import.meta.dirname, "../../../library/sets");
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const sets = readdirSync(LIB).sort();
/** The tier-2 vector file that holds each migrated set's source clips. */
const TIER2: Record<string, string> = { QUATERNIUS_3D2DGE: "QUATERNIUS", MESH2MOTION: "MESH2MOTION", CMU_CURATED: "CMU" };

describe("the migrated library", () => {
  it("holds the five seed sets and 100STYLE's extras, with the clip counts WP-1.5, WP-5.3 and WP-5.8 leave them", () => {
    const count = (s: string) => readdirSync(join(LIB, s)).filter((f) => !f.startsWith("_") && f.endsWith(".json")).length;
    expect(Object.fromEntries(sets.map((s) => [s, count(s)]))).toEqual({ CMU_CURATED: 153, MESH2MOTION: 176, QUATERNIUS_3D2DGE: 88, QUATERNIUS_SHARDFALL: 102, STYLE100: 95, STYLE100_BACK: 98, STYLE100_BACKRUN: 98, STYLE100_IDLE: 98, STYLE100_RUN: 98, STYLE100_SIDE: 194, STYLE100_SIDERUN: 193 });
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
        expect(manifest.tier).toBe(set === "CMU_CURATED" ? "cmu" : set.startsWith("STYLE100") ? "cc-by" : "cc0");
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
            // a hand's roll winds on a nearly straight arm, or rolls round as the arm bends within the range its reason gives
            const h = /^key (\d+) .*?hand([LR])\[2\]$/.exec(b.at);
            const armBend = h ? (clip.keys[Number(h[1]) - 1]![`arm${h[2]}` as "armL"] as number[])[3]! : undefined;
            const range = /as the arm[LR] bends (\d+)–(\d+) degrees/.exec(b.reason);
            if (b.code === "M2-W005" && h) expect(range ? Number(range[2]) > 25 && armBend! >= Number(range[1]) && armBend! <= Number(range[2]) : armBend! <= 25, `${f} ${b.at}: ${b.reason}`).toBe(true);
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
          const base = manifest.sources[ids[0]!].rest, reimported = existsSync(join(dir, "_import.json"));
          const out = new Float32Array(108);
          let checked = 0;
          for (const f of files) {
            const clip = parseClip(readFileSync(join(dir, f), "utf8"));
            // a re-imported clip decodes like its new source (npm run import -- --check), not the old one
            if (clip.provenance.producer.tool !== "m3a-migrate") continue;
            const vc = v.clips[clip.name]!;
            // a set re-imported measures its rests anew, so a clip it kept as migrated is read on the vector's own body
            // (the origin's: its keys untouched); a set still migrated, on its manifest's rest, so that is checked too
            const R = (reimported ? v.bodies[vc.restSrc]! : { ...base, spineW: manifest.sources[clip.restSrc].rest.spineW, neckW: manifest.sources[clip.restSrc].rest.neckW }) as Rest;
            for (const s of [...vc.keys, ...vc.between]) {
              pose(R, clip, s.t, out);
              for (let i = 0; i < 108; i++) if (!(Math.abs(out[i]! * 1000 - s.at[i]!) <= 1)) throw new Error(`${clip.id} t ${s.t} [${i}]: ${out[i]} vs ${s.at[i]! / 1000}`);
              checked++;
            }
          }
          expect(checked).toBeGreaterThan(0);
        });
      }
    });
  }
  it("records every re-imported clip's choice as tools/import/import.schema.json says, and keeps the fit limits (WP-5.3)", () => {
    for (const set of sets.filter((s) => existsSync(join(LIB, s, "_import.json")))) {
      const imp = JSON.parse(readFileSync(join(LIB, set, "_import.json"), "utf8")) as { mean: number; clips: Record<string, { kept: string; why: string; fit: { import: number[] } }> };
      expect(importSchema(imp) ? [] : importSchema.errors, `${set}/_import.json`).toEqual([]);
      const files = readdirSync(join(LIB, set)).filter((f) => !f.startsWith("_") && f.endsWith(".json")).map((f) => f.replace(/\.json$/, "")).sort();
      expect(Object.keys(imp.clips).sort(), set).toEqual(files);
      expect(imp.mean, set).toBeLessThanOrEqual(20);
      for (const [slug, c] of Object.entries(imp.clips)) {
        expect(c.why.length, `${set}/${slug}`).toBeGreaterThan(10);
        const clip = parseClip(readFileSync(join(LIB, set, `${slug}.json`), "utf8"));
        expect(clip.provenance.producer.tool, `${set}/${slug}`).toBe(c.kept === "migrated" ? "m3a-migrate" : "m3a-import");
        const [mean, worst] = clip.quality.fit;
        expect([mean! <= 40, worst! <= 300], `${set}/${slug} fit ${mean}/${worst}`).toEqual([true, true]);
      }
    }
  });
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
