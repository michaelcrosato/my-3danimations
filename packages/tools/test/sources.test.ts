// The motion-source socket end to end (WP-9.2): the built-in sources (procedural, recipe, library) and a mock external
// generator behind the HTTP adapter run through core's one `sourceClip`, each the same clip for the same seed and each
// passing the same gate; the adapter off by default, sending Kimodo's constraint shape, recording the terms' version it
// was served; and where each clip goes: an allowlisted source's to the intake queue (the local IntakeStore), any other
// only into a local set under library/local/, never into a distributable set. No network: every transport is a mock.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { procedural as PR, recipe as R, serialize, type Clip, type Rest } from "@m3a/core";
import { Library, type LibrarySource, type Tier } from "@m3a/library";
import { openLibrary } from "@m3a/library/node";
import { proceduralSource, recipeSource, sourceClip, type MotionSource as CoreSource, type SourceRequest as CoreRequest, type Sourced as CoreSourced } from "../../core/src/sources/index.ts";
import { localStore, memoryFiles } from "../src/intake/index.ts";
import { allowlisted, deliver, httpSource, intakeSubmit, librarySource, localPath, sourceGate, type HttpRequest, type LocalLane, type MotionSource, type SourceRequest, type Sourced, type SourceTerms, type Transport } from "../src/sources/index.ts";

const ROOT = join(import.meta.dirname, "../../.."), LIB = join(ROOT, "library/sets");
const REST = (JSON.parse(readFileSync(join(LIB, "MESH2MOTION/_set.json"), "utf8")) as { sources: Record<string, { rest: Rest }> }).sources.M2M_QUATERNIUS!.rest;
const lib = openLibrary({ tiers: ["cc0", "cc-by"] });
const proc = proceduralSource(), book = recipeSource({ recipes: ["Jab_Left", "Proud_Walk_Lean"].map((n) => JSON.parse(readFileSync(join(ROOT, "spec/recipes", `${n}.json`), "utf8")) as R.Recipe), resolve: lib.resolver() });
/** Two key poses of the procedural idle on REST, as constraints take them (no t, root or yaw). */
const idle = PR.idleClip(PR.IDLES[0]!, REST, { restSrc: "M2M_QUATERNIUS" }), poseOf = (i: number) => (({ t: _t, root: _r, yaw: _y, ...p }) => p)(idle.keys[i]!);
const KEYED: CoreRequest["constraints"] = [{ kind: "pose", t: 0, pose: poseOf(0) }, { kind: "pose", t: 1, pose: poseOf(10) }, { kind: "pose", t: 2, pose: poseOf(0) }, { kind: "root", t: 2, forward: 0, right: 0 }];
const ask = (intent: string, more: Partial<SourceRequest> = {}): SourceRequest => ({ intent, skeleton: { rest: REST, restSrc: "M2M_QUATERNIUS" }, duration: 2, seed: 0, ...more });
const NVIDIA: SourceTerms = { license: "LicenseRef-NVIDIA-Open-Model-License", version: "2025-06-01", url: "https://www.nvidia.com/en-us/agreements/enterprise-software/nvidia-open-model-license/" };

/** A mock external generator: a clip through every full-body key pose it is sent, held from 0 to the end, labelled
 *  wrongly (the adapter labels it), with the terms it states, if any; and what it was sent. */
function mock(terms?: SourceTerms): { transport: Transport; sent: HttpRequest[] } {
  const sent: HttpRequest[] = [];
  const transport: Transport = async (req) => {
    sent.push(req);
    const b = JSON.parse(req.body) as { prompt: string; duration: number; seed: number; fps: number; constraints: { type: string; t: number; pose?: object }[] };
    const keys = b.constraints.filter((c) => c.type === "fullbody").map((c) => ({ ...c.pose, t: c.t }));
    const clip = { format: "2.0", id: `KIMODO/Mock_${b.seed}`, name: `Mock ${b.seed}`, legend: "2.0", dur: b.duration, loop: false, fps: b.fps, tags: ["gesture"], desc: b.prompt, skeleton: "humanoid", restSrc: "X", provenance: { src: "X", method: "keyed", producer: { tool: "mock", version: "0" }, license: "CC0-1.0", ai: "digitalCreation" }, quality: { fit: [0, 0], qa: "unchecked", qaVersion: "none" }, keys };
    return { status: 200, body: JSON.stringify({ clip, ...(terms ? { terms } : {}) }) };
  };
  return { transport, sent };
}
const kimodo = (o: { terms?: SourceTerms; served?: SourceTerms; enabled?: boolean } = {}) => {
  const m = mock(o.served);
  return { ...m, source: httpSource({ name: "kimodo", url: "https://generator.invalid/v1/generate", model: { name: "kimodo-mock", version: "1.0" }, terms: o.terms ?? NVIDIA, enabled: o.enabled ?? true, transport: m.transport }) };
};
/** A LocalLane in memory, and the library its local sets make. */
function lane() {
  const files = new Map<string, string>();
  const l: LocalLane = { read: (p) => files.get(p) ?? null, write: (p, t) => void files.set(p, t), list: (d) => [...files.keys()].filter((k) => k.startsWith(`${d}/`) && !k.slice(d.length + 1).includes("/")).map((k) => k.slice(d.length + 1)), lock: memoryFiles().lock };
  const src: LibrarySource = { sets: () => [...new Set([...files.keys()].filter((k) => k.endsWith("/_set.json")).map((k) => k.split("/")[2]!))], files: (s) => l.list(`library/local/${s}`), read: (s, f) => files.get(`library/local/${s}/${f}`)! };
  return { files, lane: l, library: (tiers: Tier[] = ["local"]) => new Library(src, { tiers }) };
}
const contributor = () => localStore({ files: memoryFiles(), role: "contributor", id: "alice", today: () => "2026-10-19" });
const recordOf = (c: Clip) => (c.provenance as Clip["provenance"] & { source?: Record<string, unknown> }).source;

describe("one interface", () => {
  it("holds tools' shapes to core's, both ways", () => {
    const a: CoreSource = librarySource(lib), b: MotionSource = proc, c: CoreSourced = {} as Sourced, d: Sourced = {} as CoreSourced, e: SourceRequest = {} as CoreRequest, f: CoreRequest = {} as SourceRequest;
    expect([a.name, b.name, c, d, e, f].length).toBe(6);
  });
  it("runs the built-in sources and a mock external one the same way: a recorded clip, the same for the same seed, through the same gate", async () => {
    const cases: [MotionSource, string, string, string][] = [[proc, "a walk", "PROCEDURAL/Walk", "CC0-1.0"], [book, "a left jab", "RECIPES/Jab_Left", "CC0-1.0"], [librarySource(lib), "wave hello", "MESH2MOTION/Greeting", "CC0-1.0"], [kimodo().source, "a slow bow", "KIMODO/Mock_0", NVIDIA.license]];
    for (const [source, intent, id, license] of cases) {
      const req = ask(intent, source.name === "kimodo" ? { constraints: KEYED } : {}), a = await sourceClip(source, req), b = await sourceClip(source, req);
      expect(a.clip.id).toBe(id);
      expect(a.license).toBe(license);
      expect(recordOf(a.clip)).toEqual(a.record);
      expect(a.record).toMatchObject({ name: source.name, seed: 0, prompt: R.sha256(intent) });
      expect(serialize(a.clip)).toBe(serialize(b.clip));
      expect(sourceGate(a), id).toEqual([]);
    }
  });
  it("lets the library's seed pick among equal best rows", async () => {
    const lib5 = librarySource(lib), ids = new Set<string>();
    for (const seed of [0, 1, 2]) ids.add((await sourceClip(lib5, ask("an idle", { seed }))).clip.id);
    expect(ids.size).toBeGreaterThan(1);
    await expect(sourceClip(lib5, ask("qqqzzz"))).rejects.toMatchObject({ code: "E_NO_MATCH" });
  });
});

describe("the HTTP adapter", () => {
  it("is off by default and calls nothing (E_DISABLED)", async () => {
    const m = mock(), off = httpSource({ name: "kimodo", url: "https://generator.invalid", model: { name: "m", version: "1" }, terms: NVIDIA, transport: m.transport });
    await expect(sourceClip(off, ask("a bow"))).rejects.toMatchObject({ code: "E_DISABLED", message: expect.stringContaining("O5") });
    await expect(sourceClip(httpSource({ name: "kimodo", url: "u", model: { name: "m", version: "1" }, terms: NVIDIA, enabled: true }), ask("a bow"))).rejects.toMatchObject({ code: "E_DISABLED" });
    expect(m.sent).toEqual([]);
  });
  it("sends the key poses and root waypoints as Kimodo's constraints, and labels the clip generated under its terms", async () => {
    const k = kimodo(), s = await sourceClip(k.source, ask("a slow bow", { seed: 7, constraints: KEYED }));
    expect(JSON.parse(k.sent[0]!.body)).toMatchObject({ prompt: "a slow bow", duration: 2, seed: 7, fps: 30, skeleton: { restSrc: "M2M_QUATERNIUS" }, constraints: [{ type: "fullbody", t: 0, frame: 0 }, { type: "fullbody", t: 1, frame: 30 }, { type: "fullbody", t: 2, frame: 60 }, { type: "root2d", t: 2, frame: 60, xy: [0, 0] }] });
    expect(s.clip.provenance).toMatchObject({ src: "KIMODO", method: "generated", ai: "trainedAlgorithmicMedia", license: NVIDIA.license, producer: { tool: "m3a-http", model: "kimodo-mock 1.0" } });
    expect(s.clip.restSrc).toBe("M2M_QUATERNIUS");
    expect(s.warnings.filter((w) => w.includes("missed"))).toEqual([]);
  });
  it("records the version of the terms each clip was served under, warning when the vendor changed them", async () => {
    const s = await sourceClip(kimodo({ served: { ...NVIDIA, version: "2026-10-01" } }).source, ask("a bow", { constraints: KEYED }));
    expect(s.record).toMatchObject({ license: NVIDIA.license, version: "2026-10-01" });
    expect(s.warnings.some((w) => w.startsWith("kimodo's terms changed"))).toBe(true);
  });
  it("names a transport's failure and a reply it can't read (E_TRANSPORT, E_REPLY)", async () => {
    const via = (transport: Transport) => httpSource({ name: "kimodo", url: "https://generator.invalid", model: { name: "m", version: "1" }, terms: NVIDIA, enabled: true, transport });
    await expect(sourceClip(via(async () => ({ status: 503, body: "busy" })), ask("a bow"))).rejects.toMatchObject({ code: "E_TRANSPORT", message: expect.stringContaining("503: busy") });
    await expect(sourceClip(via(async () => Promise.reject(new Error("refused"))), ask("a bow"))).rejects.toMatchObject({ code: "E_TRANSPORT" });
    await expect(sourceClip(via(async () => ({ status: 200, body: "<html>" })), ask("a bow"))).rejects.toMatchObject({ code: "E_REPLY" });
    await expect(sourceClip(via(async () => ({ status: 200, body: "{}" })), ask("a bow"))).rejects.toMatchObject({ code: "E_REPLY" });
  });
});

describe("where a source's clip goes", () => {
  it("an allowlisted source's clip lands in the intake queue, nothing else written", async () => {
    const store = contributor(), mem = lane();
    for (const [source, intent] of [[proc, "a walk"], [book, "a proud walk"], [kimodo({ terms: { license: "CC0-1.0", version: "1" } }).source, "a bow"]] as const) {
      const s = await sourceClip(source, ask(intent, source.name === "kimodo" ? { constraints: KEYED } : {}));
      expect(allowlisted(s.clip).ok, intent).toBe(true);
      const d = await deliver(s, { submit: intakeSubmit(store), local: mem.lane });
      expect(d).toMatchObject({ to: "intake", id: expect.stringMatching(/^s-[0-9a-f]{16}$/), state: "submitted" });
      expect((await store.get((d as { id: string }).id))!.text).toBe(serialize(s.clip));
    }
    expect((await store.list()).length).toBe(3);
    expect(mem.files.size).toBe(0);
  });
  it("a source that isn't allowlisted writes only its local set under library/local/, whatever its clip claims", async () => {
    const store = contributor(), mem = lane(), k = kimodo();
    const one = await sourceClip(k.source, ask("a bow", { constraints: KEYED })), two = await sourceClip(k.source, ask("a bow", { seed: 1, constraints: KEYED }));
    const claimsCc0 = { ...two, clip: { ...two.clip, provenance: { ...two.clip.provenance, license: "CC0-1.0" } } };
    expect(allowlisted(claimsCc0.clip)).toMatchObject({ ok: false, why: expect.stringContaining("aren't on the allowlist") });
    const [d1, d2] = await Promise.all([deliver(one, { submit: intakeSubmit(store), local: mem.lane }), deliver(claimsCc0, { submit: intakeSubmit(store), local: mem.lane })]);
    expect(d1).toMatchObject({ to: "local", set: "LOCAL_KIMODO" });
    expect(d2).toMatchObject({ to: "local", set: "LOCAL_KIMODO" });
    expect(await store.list()).toEqual([]);
    expect([...mem.files.keys()].sort()).toEqual(["library/local/LOCAL_KIMODO/Mock_0.json", "library/local/LOCAL_KIMODO/Mock_1.json", "library/local/LOCAL_KIMODO/_set.json", "library/local/LOCAL_KIMODO/catalog.tsv"]);
    const local = mem.library();
    expect(local.sets()).toMatchObject([{ set: "LOCAL_KIMODO", tier: "local", clips: 2 }]);
    expect(recordOf(local.clip("LOCAL_KIMODO/Mock_0").clip)).toMatchObject({ name: "kimodo", license: NVIDIA.license, version: NVIDIA.version });
    expect(mem.library(["cc0", "cc-by", "cmu"]).sets()).toEqual([]);
  });
  it("keeps a derived tier only where it is inherited, and refuses what the gate fails, writing nothing", async () => {
    const walk = await sourceClip(proc, ask("a walk")), store = contributor(), mem = lane();
    expect(allowlisted({ ...walk.clip, provenance: { ...walk.clip.provenance, license: "CC-BY-4.0" } }).ok).toBe(false);
    expect(allowlisted(PR.idleClip(PR.IDLES[0]!, REST, { restSrc: "M2M_QUATERNIUS" })).ok).toBe(false);
    const raw = { ...walk, clip: PR.gaitClip(PR.GAITS[0]!, REST, { restSrc: "M2M_QUATERNIUS" }) };
    const d = await deliver(raw, { submit: intakeSubmit(store), local: mem.lane });
    expect(d).toMatchObject({ to: "refused", reasons: [expect.stringContaining("provenance.source is missing")] });
    expect(await store.list()).toEqual([]);
    expect(mem.files.size).toBe(0);
  });
  it("can't name a path into a distributable set", () => {
    for (const p of ["library/sets/MESH2MOTION/Walk.json", "library/local/../sets/MESH2MOTION/Walk.json", "library/local/Walk.json", "library/local/LOCAL_X/sub/Walk.json", "/library/local/LOCAL_X/Walk.json"]) expect(() => localPath(p), p).toThrow(/writes only a set's files under library\/local\//);
    expect(localPath("library/local/LOCAL_X/Walk.json")).toBe("library/local/LOCAL_X/Walk.json");
  });
});
