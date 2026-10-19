// Shared test fixtures for the core: a valid format-2 clip and a valid set manifest, to mutate per test.

/** A loosely typed JSON object, for fixtures that tests break on purpose. */
export type J = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** A valid format-2 clip: three keys of a walk, with contacts, events, facts and a review. */
export function baseClip(): J {
  const key = (t: number, swing: number): J => ({
    t,
    hips: [-5, 2, 95],
    body: [-2, 0, -2],
    chest: [-4, 15, -1],
    head: [3, 0, 4],
    shL: [-5, 0],
    shR: [0, 0],
    armL: [26 - swing, 13, -96, 52, 7],
    armR: [73 + swing, 14, -67, 62, -8],
    legL: [32, 4, -95, 14, -6],
    legR: [-50, -6, -87, 17, 5],
    footL: [-26, -2, 0],
    footR: [36, -8, 36],
  });
  return {
    format: "2.0",
    id: "TEST/Walk_Loop",
    name: "Walk_Loop",
    legend: "2.0",
    dur: 1.333,
    loop: true,
    fps: 30,
    tags: ["walk"],
    desc: "relaxed walk, in place",
    skeleton: "humanoid",
    restSrc: "UAL1",
    contacts: { by: "detected", footL: [[0, 0.4]], footR: [[0.6, 1.0], [1.2, 1.4]] },
    events: [{ t: 0.1, name: "step", side: "L" }, { t: 0.7, name: "step", side: "R" }],
    facts: { by: "m3a-facts@0.2.0", speed: 0 },
    provenance: { src: "UAL1", method: "captured", producer: { tool: "m3a-migrate", version: "0.2.0" }, license: "CC0-1.0", ai: "digitalCapture" },
    quality: { fit: [14, 38], qa: "pass", qaVersion: "0.2.0" },
    review: { state: "approved", by: "owner", date: "2026-10-11", motion: "a".repeat(64) },
    keys: [key(0, 0), key(0.667, 10), key(1.333, 0)],
  };
}

/** A valid set manifest. */
export function baseSet(): J {
  return {
    set: "TEST",
    title: "Test",
    format: "2.0",
    legend: { version: "2.0", text: ["..."] },
    tier: "cc0",
    content: { edition: "fixture", importer: "test", sha256: "b".repeat(64) },
    sources: { UAL1: { label: "UAL1", origin: "a test", license: "CC0-1.0", url: "https://example.com", rest: { H0: 916.7 } } },
    credit: "Test",
    producer: { tool: "test", version: "0.2.0" },
  };
}

const H = (c: string) => c.repeat(64);
/** Provenance's two records in full (spec/MOTION.md §7.4): the intake's (a contributed clip adopted from the queue)
 *  and the motion source's (served under other terms than it states). */
export function records(): { intake: J; source: J } {
  return {
    intake: { by: "a test agent and its human", prompt: H("a"), manifest: { url: "https://example.org/manifest.json", sha256: H("b") }, improves: { id: "TEST/Walk", sha256: H("c") }, submission: `s-0123456789abcdef@${H("d")}`, report: { sensors: "pass", findings: 0, qaVersion: "m3a-sensors@1" } },
    source: { name: "kimodo", license: "CC0-1.0", version: "2026-10-01", stated: { license: "CC0-1.0", version: "2026-01-01" }, seed: 7, prompt: H("e") },
  };
}

/** The base clip carrying both records, with `f` over them. */
export function withRecords(f: (r: { intake: J; source: J }) => void = () => {}): J {
  const c = baseClip(), r = records();
  f(r);
  c.provenance = { ...c.provenance, ...r };
  return c;
}

/** Records of an unknown shape, each with the code the validator raises and the field it names. */
export const BAD_RECORDS: [string, string, (r: { intake: J; source: J }) => void][] = [
  ["M2-E004", "provenance.intake", (r) => (r.intake = "garbage" as unknown as J)],
  ["M2-E004", "provenance.intake.by", (r) => (r.intake.by = 5)],
  ["M2-E017", "provenance.intake.prompt", (r) => (r.intake.prompt = "abc")],
  ["M2-E004", "provenance.intake.manifest", (r) => (r.intake.manifest = `https://example.org/m#sha256=${H("b")}`)],
  ["M2-E017", "provenance.intake.manifest.url", (r) => (r.intake.manifest.url = "http://example.org/manifest.json")],
  ["M2-E003", "provenance.intake.improves.sha256", (r) => delete r.intake.improves.sha256],
  ["M2-E017", "provenance.intake.improves.id", (r) => (r.intake.improves.id = "a walk")],
  ["M2-E017", "provenance.intake.submission", (r) => (r.intake.submission = "s-1")],
  ["M2-E014", "provenance.intake.report.findings", (r) => (r.intake.report.findings = -1)],
  ["M2-E004", "provenance.source", (r) => (r.source = "kimodo" as unknown as J)],
  ["M2-E003", "provenance.source.license", (r) => delete r.source.license],
  ["M2-E017", "provenance.source.name", (r) => (r.source.name = "../../sets/MESH2MOTION")],
  ["M2-E004", "provenance.source.seed", (r) => (r.source.seed = "not a number")],
  ["M2-E014", "provenance.source.seed", (r) => (r.source.seed = 2 ** 32)],
  ["M2-E004", "provenance.source.prompt", (r) => (r.source.prompt = 7)],
  ["M2-E003", "provenance.source.stated.version", (r) => delete r.source.stated.version],
];
