// What `npm run sim` reads (WP-6.5, D75): a graph or a script by path or by id (spec/graphs, spec/sims), the clips a
// graph names (the library's, and the example recipes compiled from it), each made playable on its own rest, and the
// body to play them on: the tiny conformance rig, a generated test character (gen-<seed>), or a cached real rig.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { bind, parseClip, playable, recipe as R, type AnimClip, type Bound, type Clip, type Rest } from "@m3a/core";
import { rigSkeleton } from "../../spec/conformance/runner/skeleton.ts";
import { ROOT } from "../run/cli.ts";

const LIB = join(ROOT, "library/sets");

/** A JSON file by path, or by id (`GRAPHS/Name` from spec/graphs, `SIMS/Name` from spec/sims). */
export function readSpec<T>(pathOrId: string, kind: "graphs" | "sims"): T {
  const file = /^[A-Z0-9_]+\/[A-Za-z0-9_]+$/.test(pathOrId) && !existsSync(pathOrId) ? join(ROOT, "spec", kind, `${pathOrId.split("/")[1]!}.json`) : pathOrId;
  if (!existsSync(file)) throw new Error(`no ${kind === "graphs" ? "graph" : "script"} at ${pathOrId}: give a path, or an id from spec/${kind}`);
  return JSON.parse(readFileSync(file, "utf8")) as T;
}

/** A library clip and its rest, by id, or undefined. */
function libraryClip(id: string): { clip: Clip; rest: Rest; contentId: string } | undefined {
  const [set, slug] = id.split("/") as [string, string], file = join(LIB, set ?? "", `${slug ?? ""}.json`);
  if (!set || !slug || !existsSync(file)) return undefined;
  const clip = parseClip(readFileSync(file, "utf8")), manifest = JSON.parse(readFileSync(join(LIB, set, "_set.json"), "utf8")) as { sources: Record<string, { rest: Rest }> };
  return { clip, rest: manifest.sources[clip.restSrc]!.rest, contentId: "" };
}

/** The clips by id: the library's, and spec/recipes' compiled (`RECIPES/Name`), each playable on its own rest. */
export function clipSource(): (id: string) => AnimClip | undefined {
  const cache = new Map<string, AnimClip | undefined>();
  const resolve: R.Resolver = Object.assign((id: string) => libraryClip(id), { ids: () => [] });
  return (id) => {
    if (!cache.has(id)) {
      let got: { clip: Clip; rest: Rest } | undefined = libraryClip(id);
      const recipe = join(ROOT, "spec/recipes", `${id.split("/")[1] ?? ""}.json`);
      if (!got && id.startsWith("RECIPES/") && existsSync(recipe)) got = R.compile(JSON.parse(readFileSync(recipe, "utf8")) as R.Recipe, resolve);
      cache.set(id, got ? playable(got.clip, got.rest) : undefined);
    }
    return cache.get(id);
  };
}

/** The body to play on: "tiny" (the conformance rig), "gen-<seed>" or a cached real rig's id (npm run fixtures). */
export async function bodyOf(rig: string): Promise<Bound> {
  if (rig === "tiny") return bind(rigSkeleton());
  const { rigOf } = await import("../sweep/sweep.ts");
  return (await rigOf(rig)).core;
}
