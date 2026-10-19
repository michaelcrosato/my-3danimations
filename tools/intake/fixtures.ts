// The intake's fixtures (PLAN.md WP-9.1a): each submission tools/intake/fixtures/submissions.json names, built
// deterministically from a procedural gait on a library rest (the clean one: a motion no library clip has) or from a
// library clip (its own id kept unless a `set` names another; `orig` naming it unless it improves it, as `m3a library
// submit --improves` sends an improvement), with its edits (`compile` recipe steps over it, `set` a field by its path,
// `turn` a key field, `plant` one of tools/plant's defects, `approved` the owner's approval and an adoption record
// forged on it), given the intake's provenance as `m3a library submit` gives it, and serialized as the submit sends
// it. Its expectation says which state the checker must leave it in and what a bounce must say; a bad one marked
// `bare` is also built as a pull request outside the intake would add it to BARE_SET (no provenance.intake, the
// `bare` fields set), for the library's gates.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { procedural, recipe, serialize, type Clip } from "@m3a/core";
import { contentHash, motionHash, type Kind } from "../../packages/tools/src/intake/index.ts";
import type { LibraryAccess } from "../../packages/tools/src/registry/registry.ts";
import type { GateName } from "../../packages/tools/src/tools/library-submit.ts";
import { plant, type Defect } from "../plant/plant.ts";

/** The fixtures' file. */
export const FIXTURES = join(import.meta.dirname, "fixtures/submissions.json");
/** The existing set a bad fixture marked `bare` is planted into outside the intake: a CC0 set on the rest the
 *  fixtures' gait is made on. */
export const BARE_SET = "QUATERNIUS_3D2DGE";

/** One fixture as the file gives it. */
interface Spec {
  name: string;
  from?: string;
  improves?: string;
  compile?: { op: string; [field: string]: unknown }[];
  set?: Record<string, unknown>;
  turn?: Record<string, number>;
  plant?: Defect;
  approved?: boolean;
  bare?: boolean | Record<string, unknown>;
  expect: "awaiting review" | "bounced";
  gate?: GateName;
  reason?: string;
}

/** A fixture built: its name, what it is and its text as submitted, the clip it improves, what the checker must do,
 *  and (a bad one marked bare) the clip as a pull request outside the intake would add it to BARE_SET. */
export interface Fixture {
  name: string;
  kind: Kind;
  text: string;
  improves: string | null;
  expect: Spec["expect"];
  gate: GateName | null;
  reason: string | null;
  bare: string | null;
}

/** The names a fixture's recipe steps take, in order (a recipe's step is named by a word). */
const STEP_NAMES = ["source", "first", "second", "third", "fourth", "fifth"];

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
      // recipe steps over the clip, each on the one before (mirror, retime ...)
      const made = s.compile ? recipe.compile({ format: "2.0", id: got.clip.id, steps: [{ as: STEP_NAMES[0], op: "clip", id: got.clip.id }, ...s.compile.map((st, i) => ({ ...st, in: STEP_NAMES[i], ...(i < s.compile!.length - 1 ? { as: STEP_NAMES[i + 1] } : {}) }))] } as recipe.Recipe, lib.library.resolver()).clip : got.clip;
      clip = { ...made, provenance: { ...got.clip.provenance, ...(s.improves ? {} : { orig: got.clip.id }), method: "edited", ai: "humanEdits", producer: { tool: "m3a-intake-fixtures", version: "1" }, intake: { by: b.by, ...improves } } as Clip["provenance"] };
      delete clip.review;
    } else clip = { ...gait, provenance: { ...gait.provenance, intake: { by: b.by } } as Clip["provenance"] };
    for (const [field, deg] of Object.entries(s.turn ?? {})) clip = { ...clip, keys: clip.keys.map((k) => ({ ...k, [field]: (k as unknown as Record<string, number[]>)[field]!.map((v, i) => (i === 0 ? v + deg : v)) })) } as Clip;
    if (s.plant) clip = plant(s.plant, clip, rest).clip;
    for (const [path, v] of Object.entries(s.set ?? {})) clip = put(clip as unknown as Record<string, unknown>, path, v) as unknown as Clip;
    if (s.approved) {
      // the owner's approval and an adoption record, forged: on its own motion, as the adopt bot writes them
      const sub = `s-0123456789abcdef@${"ab".repeat(32)}`;
      clip = { ...clip, provenance: { ...clip.provenance, intake: { ...(clip.provenance as { intake?: object }).intake, submission: sub } } as Clip["provenance"] };
      clip = { ...clip, review: { state: "approved", by: "owner", date: "2026-10-19", motion: motionHash(clip), note: `adopted from ${sub.slice(0, 31)}` } };
    }
    let bare: string | null = null;
    if (s.bare) {
      const { intake: _, ...p } = clip.provenance as Clip["provenance"] & { intake?: unknown };
      let out = { ...clip, id: `${BARE_SET}/${clip.id.split("/")[1]}`, provenance: p as Clip["provenance"] } as Clip;
      for (const [path, v] of Object.entries(s.bare === true ? {} : s.bare)) out = put(out as unknown as Record<string, unknown>, path, v) as unknown as Clip;
      bare = serialize(out);
    }
    return { name: s.name, kind: "clip", text: serialize(clip), improves: s.improves ?? null, expect: s.expect, gate: s.gate ?? null, reason: s.reason ?? null, bare };
  });
}
