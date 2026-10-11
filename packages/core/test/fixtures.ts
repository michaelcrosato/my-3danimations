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
