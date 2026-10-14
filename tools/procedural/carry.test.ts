// library/moves.json against its sources in T1 (WP-6.2, D71): every number the frozen moves give (my-3d2dge's E.MOVES,
// committed in spec/vectors/frozen/moves.json) is the file's, so a hand edit to a guard, a hit share or a reach shows
// without the pinned sources; with shardfall's moves.toml pinned in .cache/src (npm run pins -- fetch), the whole file
// is what the carry tool writes, its about lines and shardfall's seven moves too.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ROOT } from "../run/cli.ts";
import { carry, FROZEN, TOML } from "./carry.ts";

const file = readFileSync(join(ROOT, "library/moves.json"), "utf8"), moves = (JSON.parse(file) as { moves: Record<string, unknown>[] }).moves;

describe("library/moves.json", () => {
  it("holds the numbers my-3d2dge's frozen moves give, in its units", () => {
    const derived = carry(readFileSync(FROZEN, "utf8"), null).moves;
    expect(derived).toHaveLength(24);
    for (const d of derived) {
      // the about line and the alternate are shardfall's
      const { about: _a, alt: _b, ...want } = moves.find((m) => m.name === d.name)!;
      expect([d.name, d]).toEqual([d.name, want]);
    }
  });
  it.skipIf(!existsSync(TOML))("is what the carry tool writes from both sources, about lines and all", () => {
    expect(carry(readFileSync(FROZEN, "utf8"), readFileSync(TOML, "utf8")).text === file).toBe(true);
  });
});
