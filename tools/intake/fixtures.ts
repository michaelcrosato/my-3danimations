// The intake's fixtures (PLAN.md WP-9.1a): each submission tools/intake/fixtures/submissions.json names, built
// deterministically from a procedural gait on a library rest (the clean one: a motion no library clip has) or from a
// library clip, with its edits (`set` a field by its path, `turn` a key field, `plant` one of tools/plant's defects),
// given the intake's provenance as `m3a library submit` gives it, and serialized as the submit sends it. Its
// expectation says which state the checker must leave it in and what a bounce must say.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { procedural, serialize, type Clip } from "@m3a/core";
import { contentHash, type Kind } from "../../packages/tools/src/intake/index.ts";
import type { LibraryAccess } from "../../packages/tools/src/registry/registry.ts";
import type { GateName } from "../../packages/tools/src/tools/library-submit.ts";
import { plant, type Defect } from "../plant/plant.ts";

/** The fixtures' file. */
export const FIXTURES = join(import.meta.dirname, "fixtures/submissions.json");

/** One fixture as the file gives it. */
interface Spec {
  name: string;
  from?: string;
  improves?: string;
  set?: Record<string, unknown>;
  turn?: Record<string, number>;
  plant?: Defect;
  expect: "awaiting review" | "bounced";
  gate?: GateName;
  reason?: string;
}

/** A fixture built: its name, what it is and its text as submitted, the clip it improves, and what the checker must
 *  do. */
export interface Fixture {
  name: string;
  kind: Kind;
  text: string;
  improves: string | null;
  expect: Spec["expect"];
  gate: GateName | null;
  reason: string | null;
}

/** `o` with the field at dotted `path` set to `v` (null removes it), copying each object on the way. */
function put(o: Record<string, unknown>, path: string, v: unknown): Record<string, unknown> {
  const [k, ...rest] = path.split(".") as [string, ...string[]], out = { ...o };
  if (rest.length) out[k] = put((o[k] as Record<string, unknown>) ?? {}, rest.join("."), v);
  else if (v === null) delete out[k];
  else out[k] = v;
  return out;
}

/** Every fixture (or the one named), built on the library `lib` (every shipped tier). */
export function fixtures(lib: LibraryAccess, only?: string): Fixture[] {
  const file = JSON.parse(readFileSync(FIXTURES, "utf8")) as { base: { gait: procedural.Gait; id: string; restSrc: string; by: string }; submissions: Spec[] };
  const b = file.base, rest = lib.library.about("QUATERNIUS_3D2DGE").sources[b.restSrc]!.rest;
  const gait = procedural.gaitClip(b.gait, rest, { restSrc: b.restSrc, id: b.id });
  const specs = file.submissions.filter((s) => only === undefined || only === "all" || s.name === only);
  if (!specs.length) throw new Error(`intake: no fixture "${only}"; the fixtures are ${file.submissions.map((s) => s.name).join(", ")}, or all`);
  return specs.map((s) => {
    let clip: Clip;
    if (s.from) {
      const got = lib.library.clip(s.from), [set, name] = got.clip.id.split("/") as [string, string];
      const improves = s.improves ? { improves: { id: got.clip.id, sha256: contentHash(lib.source.read(set, `${name}.json`)) } } : {};
      clip = { ...got.clip, provenance: { ...got.clip.provenance, orig: got.clip.id, method: "edited", ai: "humanEdits", producer: { tool: "m3a-intake-fixtures", version: "1" }, intake: { by: b.by, ...improves } } as Clip["provenance"] };
      delete clip.review;
    } else clip = { ...gait, provenance: { ...gait.provenance, intake: { by: b.by } } as Clip["provenance"] };
    for (const [field, deg] of Object.entries(s.turn ?? {})) clip = { ...clip, keys: clip.keys.map((k) => ({ ...k, [field]: (k as unknown as Record<string, number[]>)[field]!.map((v, i) => (i === 0 ? v + deg : v)) })) } as Clip;
    if (s.plant) clip = plant(s.plant, clip, rest).clip;
    for (const [path, v] of Object.entries(s.set ?? {})) clip = put(clip as unknown as Record<string, unknown>, path, v) as unknown as Clip;
    return { name: s.name, kind: "clip", text: serialize(clip), improves: s.improves ?? null, expect: s.expect, gate: s.gate ?? null, reason: s.reason ?? null };
  });
}
