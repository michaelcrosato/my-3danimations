// The conformance kit's own tests (WP-10.2): the wire keeps every double and -0, and a sidecar that writes a line that
// isn't a response or stops answering fails the run within its deadline, naming the case; the TypeScript sidecar passes
// a sample of every tier through the real transport, in the shapes protocol.schema.json gives, and refuses an unknown
// op by name; a tier whose ops an implementation doesn't answer is not claimed; and a deliberately broken
// implementation (adapters/broken.ts: a number rounded differently, two points swapped, NaN or a string where the
// reference is zero, legs lengthened behind an empty `bones`, the soles sunk, its requests echoed, a bare hello) fails
// with the vector, the case, the field and both values named. The full certification is `npm run conformance -- --impl ts`.
import { Ajv2020 } from "ajv/dist/2020.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { breakAnswer, type Defect } from "../adapters/broken.ts";
import { handle } from "../adapters/ts.ts";
import { loadTier1a, sha256, tier2Sets, VECTORS } from "../runner/vectors.ts";
import { certify, type Ask, type TierOutcome } from "./kit.ts";
import { line, PROTOCOL, Sidecar } from "./wire.ts";

const ROOT = join(import.meta.dirname, "../../..");
const sidecar = (file: string, ...args: string[]) => new Sidecar(process.execPath, [join(import.meta.dirname, "../adapters", file), ...args], ROOT);
/** The reference in this process with `defects`, its answers the very JSON a sidecar would write, and no process. */
const inProcess =
  (...defects: Defect[]): Ask =>
  async (op, fields) => {
    const req = { id: 1, op, ...fields };
    return JSON.parse(line(breakAnswer(defects, req, handle(req))));
  };
/** A tier's first failure, in its first vector file that has one. */
const first = (t: TierOutcome | undefined) => t?.vectors.find((v) => v.first)?.first;
const schema = JSON.parse(readFileSync(join(import.meta.dirname, "../protocol.schema.json"), "utf8")) as { $id: string };
const ajv = new Ajv2020({ allErrors: true, allowUnionTypes: true });
ajv.addSchema(schema);
const valid = (ref: string, data: unknown) => {
  const v = ajv.getSchema(`${schema.$id}#/$defs/${ref}`)!;
  return v(JSON.parse(line(data))) ? [] : v.errors!.map((e) => `${ref}${e.instancePath} ${e.message}`);
};

describe("the wire", () => {
  it("writes one line per message, -0 and every double kept, typed arrays as arrays, non-finite as null", () => {
    const text = line({ a: -0, b: new Float32Array([1.5, -0]), c: NaN, d: 0.1 + 0.2, s: "-0" });
    expect(text).toBe('{"a":-0,"b":[1.5,-0],"c":null,"d":0.30000000000000004,"s":"-0"}');
    expect(Object.is((JSON.parse(text) as { a: number }).a, -0)).toBe(true);
  });
  it("writes every string as it is, whatever it holds: no string reads back as -0", () => {
    // the string the wire once wrote for -0 before swapping it for the number, then any string a clip or a text holds
    const strings = { desc: "~m3a-negative-zero~", quoted: '"~m3a-negative-zero~"', minus: "-0", text: 'line\n"-0"\t\\' };
    const back = JSON.parse(line({ ...strings, keys: [strings.desc, -0] })) as typeof strings & { keys: unknown[] };
    expect(back).toEqual({ ...strings, keys: [strings.desc, -0] });
    expect(Object.is(back.keys[1], -0)).toBe(true);
  });
  it("breaks off a sidecar that writes a line that isn't a response object, failing the case asked and every one after", async () => {
    const side = sidecar("broken.ts", "null"), [tier] = (await certify((op, f) => side.ask(op, f), ["1a"], 1)).tiers;
    side.close();
    expect(first(tier)).toMatchObject({ vector: "tier1a/rig.json", case: "A_TPose reduce", field: "(answer)", ours: "the sidecar broke off: it wrote a line that isn't a response object: null" });
    expect([tier!.failed, tier!.cases]).toEqual([6, 6]);
  }, 30_000);
  it("ends a sidecar that stops answering at the deadline, naming the op it waited on", async () => {
    const side = new Sidecar(process.execPath, [join(import.meta.dirname, "../adapters/broken.ts"), "hang"], ROOT, { timeoutS: 0.5 });
    // hello's deadline includes the start, so on a loaded machine it may be hello that runs out
    const why = await certify((op, f) => side.ask(op, f), ["1a"], 1).then(
      (r) => String(first(r.tiers[0])?.ours),
      (e: Error) => e.message,
    );
    side.close();
    expect(why).toMatch(/^the sidecar broke off: no answer to (hello|reduce) within 0\.5 s \(flush each answer, or raise --timeout\)/);
  }, 30_000);
});

describe("the TypeScript sidecar", () => {
  it("passes a sample of every tier through the transport, asking and answering in the protocol's shapes", async () => {
    const side = sidecar("ts.ts"), seen = new Map<string, string[]>();
    const ask: Ask = async (op, fields) => {
      const result = await side.ask(op, fields);
      if (!seen.has(op)) seen.set(op, [...valid("request", { id: 1, op, ...fields }), ...valid(`results/${op}`, result)]);
      return result;
    };
    const r = await certify(ask, undefined, 1);
    await expect(side.ask("nope")).rejects.toThrow(/unknown op "nope"; this implementation answers hello, reduce/);
    side.close();
    expect(r.kit).toEqual({ protocol: PROTOCOL, manifestSha256: sha256(readFileSync(join(VECTORS, "manifest.json"))) });
    expect(r.impl).toMatchObject({ implementation: "@m3a/core", protocol: PROTOCOL });
    expect(r.tiers.map((t) => [t.tier, t.ok, t.failed])).toEqual([["1a", true, 0], ["1b", true, 0], ["2", true, 0], ["3", true, 0]]);
    expect(r.tiers.map((t) => t.cases)).toEqual([6, 6, tier2Sets().length * 4, 7 * tier2Sets().length]);
    expect([...seen.keys()].sort()).toEqual(["decode", "fit", "hello", "measure", "mirror", "parse", "readCmu", "readGltf", "reduce", "retarget", "text"]);
    expect([...seen.values()].flat()).toEqual([]);
    expect(valid("results/decode", [[0, 1, 2]])).toEqual(["results/decode/0 must NOT have fewer than 108 items"]);
  }, 30_000);
  it("leaves unclaimed a tier whose ops it doesn't answer, and format 2's vector when it reads format 1 alone", async () => {
    // a format-1 codec with no solver, the reference in-process behind the wire's JSON
    const ask: Ask = async (op, fields) => {
      const result = JSON.parse(line(handle({ id: 1, op, ...fields }))) as { ops?: string[] };
      return op === "hello" ? { ...result, ops: result.ops!.filter((o) => o !== "retarget"), formats: [1] } : result;
    };
    const [two, three] = (await certify(ask, ["2", "3"], 1)).tiers;
    expect(two).toMatchObject({ tier: "2", claimed: true, ok: true, cases: 12, skipped: ["tier2/FORMAT2.json (format 2)"] });
    expect(two!.vectors.map((v) => v.vector)).not.toContain("tier2/FORMAT2.json");
    expect(three).toMatchObject({ tier: "3", claimed: false, ok: false, cases: 0, missing: ["retarget"] });
  });
});

describe("a deliberately broken implementation", () => {
  it("one sidecar, two defects: fit's mean rounded to float32 fails tier 1a, swapped wrists tier 2's decode, each naming its vector, case, field and values", async () => {
    const side = sidecar("broken.ts", "round,swap"), [one, two] = (await certify((op, f) => side.ask(op, f), ["1a", "2"], 1)).tiers;
    side.close();
    const want = loadTier1a("rig").clips.A_TPose!.fit!.mean;
    expect(one!.ok).toBe(false);
    expect(one!.vectors.map((v) => [v.vector, v.failed, v.cases])).toEqual([["tier1a/rig.json", 1, 3], ["tier1a/cmu-09_02.json", 1, 3]]);
    expect(one!.vectors[0]!.first).toEqual({ vector: "tier1a/rig.json", case: "A_TPose fit", field: "fit.mean", ours: Math.fround(want), want });
    expect(two!.vectors.map((v) => [v.vector, v.failed, v.cases])).toEqual(tier2Sets().map((s) => [`tier2/${s}.json`, 1, 4]));
    for (const v of two!.vectors) {
      expect(v.first!.case).toMatch(/ decode$/);
      expect(v.first!.field).toMatch(/^decode t [\d.]+: wristL\[[012]\] \(mm\)$/);
      expect(Math.abs((v.first!.ours as number) - (v.first!.want as number))).toBeGreaterThan(0.001);
    }
  }, 30_000);
  it("NaN where the reference is zero, null on the wire, fails decode and retarget at the field, not only where a tolerance catches it", async () => {
    const [two, three] = (await certify(inProcess("nan"), ["2", "3"], 1)).tiers;
    expect(first(two)).toMatchObject({ vector: "tier2/CMU.json", case: expect.stringMatching(/ decode$/), field: expect.stringMatching(/^decode\[\d+\]\[\d+\]$/), ours: "null" });
    expect(first(three)).toMatchObject({ field: expect.stringMatching(/^retarget\.(rest|poses)\b/), ours: "null", want: expect.stringMatching(/must be number \(protocol\.schema\.json \$defs\/results\/retarget\)$/) });
    expect([two!.ok, three!.ok, three!.failed]).toEqual([false, false, three!.cases]);
  });
  it("a number written as a string fails decode in every set, the string shown as the wire wrote it", async () => {
    const [two] = (await certify(inProcess("strings"), ["2"], 1)).tiers;
    expect(two!.vectors.map((v) => [v.failed, v.first?.field])).toEqual(tier2Sets().map(() => [1, "decode[0][0]"]));
    expect(two!.vectors[0]!.first!.ours).toMatch(/^"-?[\d.]+"$/);
  });
  it("legs lengthened behind an empty `bones` fail every retarget case, naming the humanoid bones left unmapped", async () => {
    const [three] = (await certify(inProcess("longlegs"), ["3"], 1)).tiers;
    expect([three!.failed, three!.cases]).toEqual([7 * tier2Sets().length, 7 * tier2Sets().length]);
    expect(first(three)).toMatchObject({ field: "retarget.bones: humanoid bones not mapped to a bone of the skeleton", want: "none" });
    expect(first(three)!.ours).toHaveLength(22);
  });
  it("soles sunk 10 mm, every length and direction kept, fail tier 3 on the floor", async () => {
    const [three] = (await certify(inProcess("sink"), ["3"], 1)).tiers;
    expect(three!.ok).toBe(false);
    expect(first(three)!.field).toMatch(/^t [\d.]+: (left|right)(Toes up \(mm; the ball below the floor\)|Foot up \(mm; the ankle below its standing height\))$/);
  });
  it("answers of the wrong shape (its requests echoed) fail every tier at its first case, naming the schema's rule", async () => {
    const r = await certify(inProcess("echo"), undefined, 1);
    for (const t of r.tiers) expect([t.tier, t.ok, first(t)!.want]).toEqual([t.tier, false, expect.stringMatching(/^a value that must .* \(protocol\.schema\.json \$defs\/results\/\w+\)$/)]);
    expect(first(r.tiers[0])).toMatchObject({ vector: "tier1a/rig.json", case: "A_TPose reduce", field: "reduce" });
  });
  it("a hello without its implementation and version is refused before any tier runs", async () => {
    await expect(certify(inProcess("bare"), ["1a"], 1)).rejects.toThrow(/^its hello answered \{"protocol":"m3a-conformance\/1","ops":\[.*\]\}: hello: want a value that must have required property 'implementation'/);
  });
});
