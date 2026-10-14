// Search (WP-5.5): for 40 game moments put in words, a fitting clip is in the top 5 for at least 32, and for 10 held-out
// queries (a verifier subagent's, written without the synonym table or the 40) for at least 8, every tier opted in; the
// CC0-only scores are reported. A game that hasn't opted in sees only CC0 rows and is told of a closer match elsewhere;
// no match is zero rows and the nearest tags; filters, the limit, the core list and the ledger's takes.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CORE, parseQuery, search, TIERS, type Library } from "../../src/index.ts";
import { openLibrary } from "../../src/node.ts";

const DIR = join(import.meta.dirname, "../../../../library/sets"), all = openLibrary({ dir: DIR, tiers: TIERS }), cc0 = openLibrary({ dir: DIR });
const queries = (file: string) => (JSON.parse(readFileSync(join(import.meta.dirname, "../search", file), "utf8")) as { queries: [string, string][] }).queries;
/** How many queries have a fitting clip in their top 5, and the ones that don't. */
const score = (lib: Library, qs: [string, string][]) => {
  const missed = qs.filter(([q, re]) => !lib.search(q, { limit: 5 }).rows.some((r) => new RegExp(re).test(r.id))).map(([q]) => q);
  return { hits: qs.length - missed.length, missed };
};

describe("search", () => {
  it("finds a fitting clip in the top 5 for at least 32 of the 40 game moments, every tier opted in; CC0's score reported", () => {
    const qs = queries("queries.json"), every = score(all, qs), free = score(cc0, qs);
    expect(qs).toHaveLength(40);
    expect(every.hits, every.missed.join("; ")).toBeGreaterThanOrEqual(32);
    console.info(`search: ${every.hits}/40 every tier opted in, ${free.hits}/40 CC0 alone (missed: ${free.missed.join("; ")})`);
  });
  it("finds one for at least 8 of the 10 held-out queries", () => {
    const qs = queries("heldout.json"), every = score(all, qs), free = score(cc0, qs);
    expect(qs).toHaveLength(10);
    expect(every.hits, every.missed.join("; ")).toBeGreaterThanOrEqual(8);
    console.info(`search, held out: ${every.hits}/10 every tier opted in, ${free.hits}/10 CC0 alone`);
  });
  it("returns only the tiers a game opted into, and names a closer match in one it hasn't", () => {
    const r = cc0.search("walks proudly");
    expect(r.rows.every((x) => x.tier === "cc0")).toBe(true);
    expect(r.next).toMatch(/closer match is in tier cc-by: STYLE100\/Proud_Walk.*opt in with tiers: \["cc0", "cc-by"\]/);
    expect(all.search("walks proudly").rows[0]!.id).toBe("STYLE100/Proud_Walk");
  });
  it("answers a query nothing matches with zero rows and the nearest tags, not an error", () => {
    const r = all.search("wlak");
    expect([r.rows, r.total]).toEqual([[], 0]);
    expect(r.next).toMatch(/no clip matches "wlak"; the nearest tags: .*walk/);
  });
  it("filters by speed (m/s on 0.95 m hips), duration, loop or once, set, tier and tag", () => {
    const fast = all.search("run loop speed>3", { limit: 40 });
    expect(fast.rows.length).toBeGreaterThan(0);
    expect(fast.rows.every((x) => x.loop && x.speed! > 3)).toBe(true);
    expect(all.search("attack dur<1", { limit: 40 }).rows.every((x) => x.dur < 1)).toBe(true);
    expect(all.search("jump once", { limit: 40 }).rows.every((x) => !x.loop)).toBe(true);
    expect(all.search("walk set:CMU_CURATED", { limit: 40 }).rows.every((x) => x.id.startsWith("CMU_CURATED/"))).toBe(true);
    expect(all.search("walk tier:cc-by", { limit: 40 }).rows.every((x) => x.tier === "cc-by")).toBe(true);
    expect(all.search("attack tag:sword", { limit: 40 }).rows.every((x) => x.tags.includes("sword"))).toBe(true);
    // filters alone list what passes them, the core list first
    expect(cc0.search("loop tag:walk").rows[0]!.core).toBe(true);
  });
  it("returns at most 40 short rows, the core list's clips first among equals, and says how many more there are", () => {
    const r = all.search("walk", { limit: 100 });
    expect(r.rows).toHaveLength(40);
    expect(r.total).toBeGreaterThan(40);
    expect(r.next).toMatch(/more: raise limit/);
    expect(r.rows.every((x) => x.desc.length <= 90)).toBe(true);
    expect(cc0.search("walk").rows[0]!.core).toBe(true);
    expect(CORE.length).toBeGreaterThanOrEqual(38);
    for (const id of CORE) expect(() => cc0.clip(id), id).not.toThrow();
  });
  it("points at the CMU ledger's takes when the library has nothing close", () => {
    const items = all.catalog().map((r) => ({ ...r, tier: "cmu" as const }));
    const r = search(items, "plays the violin", { tiers: ["cmu"], ledger: [{ id: "79_17", desc: "playing violin" }, { id: "02_01", desc: "walk" }] });
    expect(r.next).toMatch(/the CMU ledger has takes to import: 79_17 \("playing violin"\)/);
  });
  it("reads a game moment's words: stems, stop words, light verbs, phrases and filters", () => {
    expect(parseQuery("gets hit in the head")).toEqual({ words: ["hit", "head"], filters: [] });
    expect(parseQuery("throws a punch").words).toEqual(["punch"]);
    expect(parseQuery("gets up off the floor").words).toEqual(["getup", "floor"]);
    expect(parseQuery("slips past the guards unseen").words).toEqual(["sneak", "guard", "unseen"]);
    expect(parseQuery("running walks stopped cries proudly").words).toEqual(["run", "walk", "stop", "cry", "proud"]);
    expect(parseQuery("idle loop dur<2 tag:sword").filters).toEqual([{ kind: "loop", loop: true }, { kind: "num", key: "dur", op: "<", value: 2 }, { kind: "field", key: "tag", value: "sword" }]);
  });
});
