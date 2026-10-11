// Tests for the validator (WP-1.2): every rule has a passing fixture (the base clip, set and row pass clean) and a
// failing one that raises exactly its code; every message is at most two lines and names where the problem is.
import { describe, expect, it } from "vitest";
import { formatIssue, RULES, validate, type Issue } from "../src/validate/index.ts";
import { baseClip, baseSet } from "./fixtures.ts";

type J = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const ROW = "TEST/Walk_Loop\t1.333\tloop\t\twalk\trelaxed walk, in place\tUAL1";

const codes = (issues: Issue[]) => [...new Set(issues.map((i) => i.code))].sort();
const mut = (f: (c: J) => void, base = baseClip()): J => (f(base), base);

/** One failing fixture per clip rule: the mutation and the code it must raise. */
const CLIP_FAILS: [string, () => unknown, string][] = [
  ["M2-E001", () => [1, 2], "a list is not a clip"],
  ["M2-E002", () => mut((c) => (c.format = "3.0")), "an unknown major"],
  ["M2-E003", () => mut((c) => delete c.keys[1].armL), "a key without armL"],
  ["M2-E004", () => mut((c) => (c.desc = 5)), "desc as a number"],
  ["M2-E005", () => mut((c) => (c.keys[0].body[1] = NaN)), "a NaN lean"],
  ["M2-E006", () => mut((c) => (c.keys[0].legL = [1, 2, 3])), "a leg with three numbers"],
  ["M2-E007", () => mut((c) => (c.keys[0].head[0] = 2.5)), "a fraction in a key"],
  ["M2-E008", () => mut((c) => (c.keys[2].t = 0.667)), "two keys at the same time"],
  ["M2-E009", () => mut((c) => (c.keys = [])), "no keys"],
  ["M2-E010", () => mut((c) => (c.dur = 700)), "over 600 s"],
  ["M2-E011", () => mut((c) => (c.keys[2].t = 1.4)), "a key 67 ms past dur"],
  ["M2-E012", () => mut((c) => (c.contacts.footR = [[1.2, 1.4], [0.6, 1.0]])), "contacts out of order"],
  ["M2-E013", () => mut((c) => c.events.reverse()), "events out of order"],
  ["M2-E014", () => mut((c) => (c.keys[1].armL[3] = 191)), "an elbow bent 191 degrees"],
  ["M2-E015", () => mut((c) => (c.requires = ["tangents"])), "requires a field this reader lacks"],
  ["M2-E016", () => mut((c) => (c.provenance.method = "dreamed")), "an unknown method"],
  ["M2-E017", () => mut((c) => (c.id = "test walk")), "a malformed id"],
  ["M2-E018", () => mut((c) => (c.provenance.license = "CC-BY-4.0")), "CC BY without a credit"],
  ["M2-E019", () => mut((c) => (c.keys[0].armR = [0, 0, 0, 10, 0])), "an arm pointing nowhere"],
  ["M2-E020", () => mut((c) => (c.keys[1].t = 0.6667)), "a time past the millisecond"],
  ["M2-W002", () => mut((c) => ((c.keys[1].armL = [10, 13, -96, 150, 170]), (c.keys[0].armL[3] = 150))), "the twist pop"],
  ["M2-W003", () => mut((c) => (c.keys[1].hips[2] = -40)), "hips under the floor"],
  ["M2-W004", () => mut((c) => (c.keys[1].legR = [50, 6, 87, 17, 5])), "a leg flipping round"],
  ["M2-W005", () => mut((c) => (c.keys[2].body[0] = 582)), "a spin past 540"],
  ["M2-W006", () => mut((c) => delete c.keys[1].footL), "footL in two keys of three"],
];

describe("validate: clips", () => {
  it("passes the base clip clean, in read and lint mode", () => {
    for (const mode of ["read", "lint"] as const) {
      const r = validate(baseClip(), { mode });
      expect(r.errors.map(formatIssue)).toEqual([]);
      expect(r.warnings.map(formatIssue)).toEqual([]);
      expect(r.ok).toBe(true);
    }
  });
  for (const [code, make, what] of CLIP_FAILS) {
    it(`${code}: ${what}`, () => {
      const r = validate(make(), { mode: "read" });
      expect(codes([...r.errors, ...r.warnings])).toEqual([code]);
      expect(r.ok).toBe(code.includes("-W"));
    });
  }
  it("M2-W001: lint flags an unknown field with the nearest name; read accepts it", () => {
    const c = mut((x) => ((x.tagz = ["walk"]), (x.keys[0].armLL = [1, 0, 0, 0, 0])));
    expect(validate(c, { mode: "read" }).warnings).toEqual([]);
    const w = validate(c, { mode: "lint" }).warnings;
    expect(codes(w)).toEqual(["M2-W001"]);
    expect(w.map((i) => i.fix)).toEqual(['did you mean "tags"?', 'did you mean "armL"?']);
  });
  it("names the clip, the key, the time and the field, in at most two lines", () => {
    const r = validate(CLIP_FAILS.find(([c]) => c === "M2-E014")![1]());
    expect(formatIssue(r.errors[0]!)).toBe("M2-E014 Walk_Loop key 2 (t 0.667) armL[3]: bend 191 is outside 0..180");
    for (const [, make] of CLIP_FAILS) {
      const r2 = validate(make(), { mode: "lint" });
      for (const i of [...r2.errors, ...r2.warnings]) expect(formatIssue(i).split("\n").length).toBeLessThanOrEqual(2);
    }
  });
  it("allows one key just past dur (the capture's last frame), and a loop's contact that wraps", () => {
    expect(validate(mut((c) => (c.keys[2].t = 1.343))).ok).toBe(true);
    expect(validate(mut((c) => (c.contacts.footL = [[0.2, 0.4], [1.2, 1.5]]))).ok).toBe(true);
    expect(validate(mut((c) => ((c.loop = false), (c.contacts.footL = [[0.2, 0.4], [1.2, 1.5]])))).ok).toBe(false);
  });
  it("accepts the new optional fields within range", () => {
    const c = mut((x) => x.keys.forEach((k: J) => Object.assign(k, { handL: [20, -5, 90], handR: [0, 0, 0], fingersL: [0, 50, 100, 100, 100], fingersR: [0, 0, 0, 0, 0], spine: [20, 40, 80], yaw: 45, root: [0, 0] })));
    expect(validate(c, { mode: "lint" })).toEqual({ ok: true, errors: [], warnings: [] });
  });
});

describe("validate: sets and catalog rows", () => {
  it("passes a valid set and row", () => {
    expect(validate(baseSet(), { kind: "set", mode: "lint" })).toEqual({ ok: true, errors: [], warnings: [] });
    expect(validate(ROW, { kind: "catalog-row" }).ok).toBe(true);
  });
  it("M2-E101 and M2-E102: a set missing its tier source rest, or with a bad tier", () => {
    expect(codes(validate(mut((s) => delete s.sources.UAL1.rest, baseSet()), { kind: "set" }).errors)).toEqual(["M2-E101"]);
    expect(codes(validate(mut((s) => (s.tier = "public"), baseSet()), { kind: "set" }).errors)).toEqual(["M2-E102"]);
  });
  it("M2-E110 and M2-E111: a short row, a row whose loop column is wrong", () => {
    expect(codes(validate("TEST/Walk_Loop\t1.333", { kind: "catalog-row" }).errors)).toEqual(["M2-E110"]);
    expect(codes(validate(ROW.replace("\tloop\t", "\tforever\t"), { kind: "catalog-row" }).errors)).toEqual(["M2-E111"]);
  });
  it("covers every rule with a failing fixture", () => {
    const covered = new Set([...CLIP_FAILS.map(([c]) => c), "M2-W001", "M2-E101", "M2-E102", "M2-E110", "M2-E111"]);
    expect(RULES.map((r) => r.code).filter((c) => !covered.has(c))).toEqual([]);
  });
});
