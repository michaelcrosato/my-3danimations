// Where a source's clip goes (PLAN.md WP-9.2, §5.9, O5): never into a distributable set. `deliver` runs the gate
// every source's output passes (sourceGate: the checks the intake checker runs that need no store: the schema and
// lint, the source's record and the generator's model in the provenance, the sensors' verdict), then reads the
// license allowlist (`allowlisted`: CC0, or a library clip's tier kept by what derives from it, D10, and only from a
// source whose terms are on it): an allowlisted clip goes to the intake queue through `Submit` (`intakeSubmit`, the
// store's own submit, the door `library submit` sends through after its local gates; the checker runs every gate on
// what arrives, and `deliver` runs the source's gate first: D112), any other is written only under library/local/, as
// a local set (tier local: never committed, never shipped), through a LocalLane that refuses any other path.
import { parseClip, serialize, validate, validation, VERSION, type Clip, type Rest } from "@m3a/core";
import { setFiles, tierOf } from "@m3a/library";
import { metrics } from "@m3a/sensors";
import type { IntakeStore } from "../intake/index.ts";
import { fail, type SourceRecord, type Sourced } from "./types.ts";

/** How a clip enters the intake queue: its text in, the submission's id and state out. */
export type Submit = (input: { kind: "clip"; text: string }) => Promise<{ id: string; state: string }>;
/** The intake queue's door for a source's clips: the store's own submit (WP-8.2a's IntakeStore, as its contributor),
 *  as `library submit`'s is; the checker gates what arrives (D112). */
export const intakeSubmit = (store: IntakeStore): Submit => async (input) => {
  const s = await store.submit(input);
  return { id: s.id, state: s.state };
};

/** Files under the checkout, by path from its root ("library/local/SET/Clip.json"): read, written, listed, and a
 *  lock that keeps other writers out while a set is rewritten, if the host has one. The Node host's are on disk; a
 *  test's in memory. */
export interface LocalLane {
  read(path: string): string | null;
  write(path: string, text: string): void;
  list(dir: string): string[];
  lock?(): Promise<() => void>;
}
/** The only directory a source's clips are written to outside the intake queue (O5, D10's local lane). */
export const LOCAL = "library/local/";
/** The source terms on the allowlist: CC0, and "inherit" (a clip keeping its library inputs' tier, D10). */
export const ALLOWED_TERMS: readonly string[] = ["CC0-1.0", "inherit"];

/** A path a source's clip may be written to: under library/local/, one set's own file, no way out. E_LOCAL otherwise. */
export function localPath(path: string): string {
  if (!path.startsWith(LOCAL) || !/^library\/local\/[A-Z][A-Z0-9_]*\/[A-Za-z0-9_-]+\.(json|tsv)$/.test(path)) throw fail("E_LOCAL", `a source writes only a set's files under ${LOCAL}, not ${JSON.stringify(path)}: the library's sets grow by adoption from the intake queue (§5.9)`);
  return path;
}

const recordOf = (c: Clip): SourceRecord | undefined => (c.provenance as Clip["provenance"] & { source?: SourceRecord }).source;
const isRecord = (r: SourceRecord | undefined): r is SourceRecord => !!r && typeof r === "object" && typeof r.name === "string" && typeof r.license === "string" && typeof r.version === "string" && Number.isInteger(r.seed) && /^[0-9a-f]{64}$/.test(String(r.prompt));

/**
 * Whether a clip may enter the intake queue (§5.9, O5), and why: its source's terms (`provenance.source.license`) on
 * ALLOWED_TERMS, and each part of its license claim (`provenance.license`, parts joined by " AND ") CC0-1.0, or a CC BY
 * or CMU tier (the license check's tierOf) only when the terms are "inherit". WP-9.1a's checker reads the same two
 * fields with this, so a generator's clip sent to `library submit` directly is bounced whatever it claims.
 */
export function allowlisted(clip: Clip): { ok: boolean; why: string } {
  const r = recordOf(clip), claim = clip.provenance.license;
  if (!isRecord(r)) return { ok: false, why: "it has no source record (provenance.source): run it through sources.sourceClip" };
  if (!ALLOWED_TERMS.includes(r.license)) return { ok: false, why: `the ${r.name} source's terms, ${r.license} (${r.version}), aren't on the allowlist (CC0-1.0, or a library clip's tier kept by what derives from it): its clips stay in ${LOCAL} (O5)` };
  const bad = claim.split(" AND ").map((p) => p.trim()).filter((p) => tierOf(p) === "local" || (p !== "CC0-1.0" && r.license !== "inherit"));
  if (bad.length) return { ok: false, why: `its license claim ${claim} isn't on the allowlist: CC0-1.0, or a CC BY or CMU tier only as inherited from library clips (§5.9)` };
  return { ok: true, why: `${claim}, from the ${r.name} source (${r.license}, ${r.version})` };
}

/** A gate: the reasons a clip on its rest fails, none when it passes. */
export type Gate = (s: { clip: Clip; rest: Rest }) => string[];

/** The gate every source's clip passes before it goes anywhere: the checks of the intake checker that need no store
 *  (the schema and lint's errors, the source's record, a generated clip's model, the sensors' fail verdict). WP-9.1a's
 *  checker can be given as the gate instead. */
export const sourceGate: Gate = ({ clip, rest }) => {
  const v = validate(clip, { mode: "lint" }), out = v.errors.map(validation.formatIssue);
  if (!isRecord(recordOf(clip))) out.push("provenance.source is missing: a source's clip goes through sources.sourceClip, which records the source, its terms' license and version, the seed and the prompt's hash");
  if (clip.provenance?.method === "generated" && !clip.provenance.producer?.model) out.push("a generated clip names its model and version (provenance.producer.model)");
  if (!v.errors.length) {
    const r = metrics(clip, rest), f = r.findings.find((x) => x.level === "fail");
    if (r.verdict === "fail") out.push(`the sensors fail it${f ? `: ${f.metric} at ${f.t0.toFixed(2)} s, ${f.message}` : ""}`);
  }
  return out;
};

/** Where a clip went: the intake queue (the submission), library/local/ (the set and the paths written, and why), or
 *  nowhere (the gate's reasons). */
export type Delivered = { to: "intake"; id: string; state: string } | { to: "local"; set: string; paths: string[]; why: string } | { to: "refused"; reasons: string[] };

/** A source's clip written into its local set, LOCAL_<SOURCE> under library/local/ (the set's other clips kept, this
 *  one's id moved into it), every path through localPath; the manifest last. */
function toLocal(s: Sourced, lane: LocalLane, legend: readonly string[]): { set: string; paths: string[] } {
  const r = recordOf(s.clip)!, set = `LOCAL_${r.name.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`, dir = `${LOCAL}${set}`, slug = s.clip.id.slice(s.clip.id.indexOf("/") + 1);
  const clip: Clip = { ...s.clip, id: `${set}/${slug}` }, old = lane.read(`${dir}/_set.json`), was = old ? (JSON.parse(old) as { sources?: Record<string, unknown> }) : {};
  const kept = lane.list(dir).filter((f) => f.endsWith(".json") && f !== "_set.json" && f !== `${slug}.json`).sort().map((f) => parseClip(lane.read(`${dir}/${f}`)!));
  const license = r.license === "inherit" ? clip.provenance.license : r.license;
  const manifest = {
    set, title: `${r.name}'s clips (local: never committed, never shipped)`, format: "2.0", tier: "local",
    content: { edition: r.name, importer: `m3a sources ${VERSION}` },
    sources: { ...was.sources, [clip.restSrc]: { label: r.name, origin: `the ${r.name} motion source, under ${license} (${r.version})`, license, url: "", rest: s.rest } },
    legend: { version: "2.0", text: [...legend] },
  };
  const files = setFiles(manifest, [...kept, clip]), names = [...files.keys()].sort((a, b) => Number(a === "_set.json") - Number(b === "_set.json") || (a < b ? -1 : 1));
  const paths = names.map((f) => localPath(`${dir}/${f}`));
  names.forEach((f, i) => lane.write(paths[i]!, files.get(f)!));
  return { set, paths };
}

/**
 * Sends a source's clip where it may go: refused (nothing written) when the gate fails it; to the intake queue when
 * it is allowlisted; else into its local set under library/local/. No path leads into library/sets/.
 */
export async function deliver(s: Sourced, o: { submit: Submit; local: LocalLane; gate?: Gate; legend?: readonly string[] }): Promise<Delivered> {
  const reasons = (o.gate ?? sourceGate)(s);
  if (reasons.length) return { to: "refused", reasons };
  const a = allowlisted(s.clip);
  if (a.ok) return { to: "intake", ...(await o.submit({ kind: "clip", text: serialize(s.clip) })) };
  const release = await o.local.lock?.();
  try {
    return { to: "local", ...toLocal(s, o.local, o.legend ?? []), why: a.why };
  } finally {
    release?.();
  }
}
