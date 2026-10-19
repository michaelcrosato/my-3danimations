// The motion-source socket end to end (WP-9.2): the built-in sources (procedural, recipe, library) and a mock external
// generator behind the HTTP adapter run through core's one `sourceClip`, each the same clip for the same seed and each
// passing the same gate; the adapter off by default, sending Kimodo's constraint shape, recording the terms' version it
// was served; and where each clip goes: an allowlisted source's to the intake queue (the local IntakeStore) with the
// intake's provenance the intake's gates ask for, a source whose stated or served terms aren't allowlisted only into a
// local set under library/local/ (in memory, and on disk through the Node lane, no link leading out), never into a
// distributable set. The tools' socket types are core's, written once. No network: every transport is a mock.
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseClip, procedural as PR, recipe as R, serialize, type Clip, type Rest } from "@m3a/core";
import { Library, type LibrarySource, type Tier } from "@m3a/library";
import { directory, openLibrary } from "@m3a/library/node";
import { proceduralSource, recipeSource, sourceClip, type SourceRequest as CoreRequest } from "../../core/src/sources/index.ts";
import { localStore, memoryFiles } from "../src/intake/index.ts";
import { libraryAccess } from "../src/node/library.ts";
import { localLane } from "../src/node/local-lane.ts";
import { allowlisted, deliver, httpSource, intakeSubmit, librarySource, localPath, sourceGate, type HttpRequest, type LocalLane, type MotionSource, type SourceRequest, type SourceTerms, type Transport } from "../src/sources/index.ts";
import { clipGates, gateInput, SHIPPED, type IntakeProvenance } from "../src/tools/library-submit.ts";

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
/** What the contributor says of a clip it delivers to the intake queue, as library submit's --by and --manifest do. */
const BY = "a test of WP-9.2's deliver (michaelcrosato)", MANIFEST = { url: "https://generator.invalid/kimodo/training-data.json", sha256: "f".repeat(64) };

describe("one interface", () => {
  it("takes the socket's types from core's sources, written once: the tools hold no copy", () => {
    const dir = join(ROOT, "packages/tools/src/sources"), text = readdirSync(dir).map((f) => readFileSync(join(dir, f), "utf8")).join("\n");
    expect(text.match(/^\s*(export\s+)?(interface|type)\s+(SourceTerms|Constraint|SourceRequest|SourceOutput|MotionSource|SourceRecord|Sourced)\b(?!\s*=\s*sources\.)/gm)).toBeNull();
    expect(readFileSync(join(dir, "types.ts"), "utf8")).toContain('import type { sources } from "@m3a/core"');
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
  const access = libraryAccess(ROOT, SHIPPED, LIB, {});
  it("an allowlisted source's clip lands in the intake queue with the intake's provenance, which its gates take; nothing else written", async () => {
    const store = contributor(), mem = lane();
    for (const [source, intent] of [[proc, "a walk"], [book, "a proud walk"], [kimodo({ terms: { license: "CC0-1.0", version: "1" } }).source, "a bow"]] as const) {
      const s = await sourceClip(source, ask(intent, source.name === "kimodo" ? { constraints: KEYED } : {}));
      expect(allowlisted(s.clip).ok, intent).toBe(true);
      const d = await deliver(s, { submit: intakeSubmit(store), local: mem.lane, by: BY, ...(source.name === "kimodo" ? { manifest: MANIFEST } : {}) });
      expect(d).toMatchObject({ to: "intake", id: expect.stringMatching(/^s-[0-9a-f]{16}$/), state: "submitted" });
      const sent = parseClip((await store.get((d as { id: string }).id))!.text), intake = (sent.provenance as unknown as { intake: IntakeProvenance }).intake;
      expect(intake).toEqual({ by: BY, prompt: s.record.prompt, ...(source.name === "kimodo" ? { manifest: MANIFEST } : {}), report: { sensors: expect.stringMatching(/^(pass|warn)$/), findings: expect.any(Number), qaVersion: expect.stringMatching(/^m3a-sensors@/) } });
      expect(serialize({ ...sent, provenance: { ...sent.provenance, intake: undefined } as Clip["provenance"] })).toBe(serialize(s.clip));
      // every gate the intake runs with no rig or store passes it, the text gate reading provenance.source by kind (D113)
      const gates = clipGates(gateInput(sent, "clip", null, access));
      expect(gates.filter((g) => !g.ok).map((g) => `${g.gate}: ${g.why.join("; ")}`), intent).toEqual([]);
    }
    expect((await store.list()).length).toBe(3);
    expect(mem.files.size).toBe(0);
  });
  it("sends nothing the intake would bounce for its disclosure: no one named, a generator without its manifest", async () => {
    const store = contributor(), mem = lane(), walk = await sourceClip(proc, ask("a walk")), bow = await sourceClip(kimodo({ terms: { license: "CC0-1.0", version: "1" } }).source, ask("a bow", { constraints: KEYED }));
    const to = (s: typeof walk, more: { by?: string; manifest?: { url: string; sha256: string } }) => deliver(s, { submit: intakeSubmit(store), local: mem.lane, ...more });
    expect(await to(walk, {})).toEqual({ to: "refused", reasons: [expect.stringContaining("deliver it with by")] });
    expect(await to(walk, { by: " " })).toMatchObject({ to: "refused" });
    expect(await to(bow, { by: BY })).toEqual({ to: "refused", reasons: [expect.stringContaining("training-data manifest")] });
    expect(await to(bow, { by: BY, manifest: { url: "http://generator.invalid/m.json", sha256: MANIFEST.sha256 } })).toEqual({ to: "refused", reasons: [expect.stringContaining("https URL")] });
    expect([await store.list(), mem.files.size]).toEqual([[], 0]);
  });
  it("a remote generator's reply never decides its route alone: both the terms it states and those it served are read, and recorded", async () => {
    const store = contributor(), mem = lane(), CC0 = { license: "CC0-1.0", version: "1" };
    const swapped = await sourceClip(kimodo({ served: { license: "CC0-1.0", version: "x" } }).source, ask("a bow", { constraints: KEYED }));
    expect(swapped.record).toMatchObject({ license: "CC0-1.0", version: "x", stated: { license: NVIDIA.license, version: NVIDIA.version } });
    expect(allowlisted(swapped.clip)).toEqual({ ok: false, why: expect.stringContaining(`${NVIDIA.license} (${NVIDIA.version}), aren't on the allowlist`) });
    expect(allowlisted(swapped.clip).why).toContain("both must be on it");
    const served = await sourceClip(kimodo({ terms: CC0, served: { license: NVIDIA.license, version: NVIDIA.version } }).source, ask("a bow", { seed: 1, constraints: KEYED }));
    expect(allowlisted(served.clip).ok).toBe(false);
    for (const s of [swapped, served]) expect(await deliver(s, { submit: intakeSubmit(store), local: mem.lane, by: BY, manifest: MANIFEST })).toMatchObject({ to: "local", set: "LOCAL_KIMODO" });
    expect(await store.list()).toEqual([]);
    expect(JSON.parse(mem.files.get("library/local/LOCAL_KIMODO/_set.json")!).sources.M2M_QUATERNIUS.origin).toContain("; it states CC0-1.0 (1)");
    // a new version of allowlisted terms is still allowlisted, both versions recorded
    const bumped = await sourceClip(kimodo({ terms: CC0, served: { license: "CC0-1.0", version: "2" } }).source, ask("a bow", { seed: 2, constraints: KEYED }));
    expect([bumped.record.stated, allowlisted(bumped.clip).ok]).toEqual([CC0, true]);
    expect(await deliver(bumped, { submit: intakeSubmit(store), local: mem.lane, by: BY, manifest: MANIFEST })).toMatchObject({ to: "intake" });
  });
  it("a source that isn't allowlisted writes only its local set under library/local/, whatever its clip claims", async () => {
    const store = contributor(), mem = lane(), k = kimodo();
    const one = await sourceClip(k.source, ask("a bow", { constraints: KEYED })), two = await sourceClip(k.source, ask("a bow", { seed: 1, constraints: KEYED }));
    const claimsCc0 = { ...two, clip: { ...two.clip, provenance: { ...two.clip.provenance, license: "CC0-1.0" } } };
    expect(allowlisted(claimsCc0.clip)).toMatchObject({ ok: false, why: expect.stringContaining("aren't on the allowlist") });
    const [d1, d2] = await Promise.all([deliver(one, { submit: intakeSubmit(store), local: mem.lane, by: BY, manifest: MANIFEST }), deliver(claimsCc0, { submit: intakeSubmit(store), local: mem.lane, by: BY, manifest: MANIFEST })]);
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

describe("the Node local lane (@m3a/tools/node's localLane)", () => {
  /** A scratch working directory with a distributable set's file in it, and what its library/sets/ holds. */
  const scratch = () => {
    const d = mkdtempSync(join(tmpdir(), "m3a-local-lane-"));
    mkdirSync(join(d, "library/sets/MESH2MOTION"), { recursive: true });
    writeFileSync(join(d, "library/sets/MESH2MOTION/Walk.json"), "{}");
    return { d, sets: () => readdirSync(join(d, "library/sets/MESH2MOTION")).sort(), rm: () => rmSync(d, { recursive: true, force: true }) };
  };
  it("writes a source's clips that aren't allowlisted into their local set on disk, which the library opens at tier local", async () => {
    const w = scratch(), k = kimodo(), on = localLane(w.d), store = contributor();
    try {
      const [one, two] = [await sourceClip(k.source, ask("a bow", { constraints: KEYED })), await sourceClip(k.source, ask("a bow", { seed: 1, constraints: KEYED }))];
      const ds = await Promise.all([one, two].map((s) => deliver(s, { submit: intakeSubmit(store), local: on, by: BY, manifest: MANIFEST })));
      expect(ds).toMatchObject([{ to: "local", set: "LOCAL_KIMODO" }, { to: "local", set: "LOCAL_KIMODO" }]);
      expect(on.list("library/local/LOCAL_KIMODO")).toEqual(["Mock_0.json", "Mock_1.json", "_set.json", "catalog.tsv"]);
      expect([on.read("library/local/LOCAL_KIMODO/Nope.json"), on.list("library/local/LOCAL_NONE"), existsSync(join(w.d, "library/local/.lock"))]).toEqual([null, [], false]);
      const local = openLibrary({ dir: join(w.d, "library/local"), source: directory(join(w.d, "library/local")), packs: {}, tiers: ["local"], warn: () => {} });
      expect(local.sets()).toMatchObject([{ set: "LOCAL_KIMODO", tier: "local", clips: 2 }]);
      expect([w.sets(), await store.list()]).toEqual([["Walk.json"], []]);
    } finally {
      w.rm();
    }
  });
  it("refuses any other path, and a link anywhere on the way (library/local/, a set's directory, a file), writing nothing", async () => {
    const w = scratch(), on = localLane(w.d), clip = "{}\n";
    try {
      for (const p of ["library/sets/MESH2MOTION/Walk.json", "library/local/../sets/MESH2MOTION/Walk.json", "library/local/LOCAL_X/../../sets/MESH2MOTION/Walk.json"]) expect(() => on.write(p, clip), p).toThrow(expect.objectContaining({ code: "E_LOCAL" }));
      expect(() => on.list("library/sets/MESH2MOTION")).toThrow(expect.objectContaining({ code: "E_LOCAL" }));
      mkdirSync(join(w.d, "library/local"), { recursive: true });
      symlinkSync(join(w.d, "library/sets/MESH2MOTION"), join(w.d, "library/local/LOCAL_X"));
      symlinkSync(join(w.d, "library/sets/MESH2MOTION/Walk.json"), join(w.d, "library/local/LOCAL_Y.json"));
      for (const p of ["library/local/LOCAL_X/Walk.json", "library/local/LOCAL_X/New.json"]) {
        expect(() => on.write(p, clip), p).toThrow(/leads out of library\/local\/ through a link/);
        expect(() => on.read(p), p).toThrow(expect.objectContaining({ code: "E_LOCAL" }));
      }
      expect(() => on.list("library/local/LOCAL_X")).toThrow(expect.objectContaining({ code: "E_LOCAL" }));
      mkdirSync(join(w.d, "library/local/LOCAL_Z"));
      symlinkSync(join(w.d, "library/sets/MESH2MOTION/Walk.json"), join(w.d, "library/local/LOCAL_Z/Walk.json"));
      expect(() => on.write("library/local/LOCAL_Z/Walk.json", clip)).toThrow(expect.objectContaining({ code: "E_LOCAL" }));
      // library/local/ itself a link into the sets: every path, and the lock, refused
      rmSync(join(w.d, "library/local"), { recursive: true });
      symlinkSync(join(w.d, "library/sets"), join(w.d, "library/local"));
      expect(() => on.write("library/local/MESH2MOTION/Walk.json", clip)).toThrow(expect.objectContaining({ code: "E_LOCAL" }));
      await expect(on.lock!()).rejects.toMatchObject({ code: "E_LOCAL" });
      expect([w.sets(), readFileSync(join(w.d, "library/sets/MESH2MOTION/Walk.json"), "utf8")]).toEqual([["Walk.json"], "{}"]);
    } finally {
      w.rm();
    }
  });
});
