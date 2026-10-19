// Where a source's clip goes (PLAN.md WP-9.2, §5.9, O5): never into a distributable set. `deliver` runs the gate
// every source's output passes (sourceGate: the checks the intake checker runs that need no store: the schema and
// lint, the source's record and the generator's model in the provenance, the sensors' verdict), then reads the
// license allowlist (`allowlisted`: CC0, or a library clip's tier kept by what derives from it, D10, and only from a
// source whose terms are on it and served the clip under the terms it states, D119): an allowlisted clip goes to
// the intake queue through `Submit` (`intakeSubmit`, the store's own submit, the door `library submit` sends through
// after its local gates), given the intake's provenance as `library submit` gives it (who or what made it, the
// prompt's hash, a generator's training-data manifest and the local report: the checker bounces a clip without them,
// and runs every gate on what arrives, D112); any other is written only under library/local/, as a local set (tier
// local: never committed, never shipped), through a LocalLane that refuses any other path.
import { parseClip, serialize, validate, validation, VERSION, type Clip, type Rest } from "@m3a/core";
import { setFiles, tierOf } from "@m3a/library";
import { checks, metrics } from "@m3a/sensors";
import type { IntakeStore } from "../intake/index.ts";
import type { IntakeProvenance } from "../tools/library-submit.ts";
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
 *  lock that keeps other writers out while a set is rewritten, if the host has one. On Node, @m3a/tools/node's
 *  `localLane` keeps them on disk under library/local/ (packages/tools/src/node/local-lane.ts); a test's are in memory. */
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

const HEX64 = /^[0-9a-f]{64}$/;
const recordOf = (c: Clip): SourceRecord | undefined => (c.provenance as Clip["provenance"] & { source?: SourceRecord }).source;
const isTerms = (t: unknown): t is { license: string; version: string } => !!t && typeof t === "object" && typeof (t as { license?: unknown }).license === "string" && typeof (t as { version?: unknown }).version === "string";
const isRecord = (r: SourceRecord | undefined): r is SourceRecord => isTerms(r) && typeof r.name === "string" && (r.stated === undefined || isTerms(r.stated)) && Number.isInteger(r.seed) && HEX64.test(String(r.prompt));

/**
 * Whether a clip may enter the intake queue (§5.9, O5), and why: its source's terms on ALLOWED_TERMS, both those it
 * served the clip under (`provenance.source.license`) and those the source states (`provenance.source.stated`, recorded
 * when they differ), the two the same (a clip enters only under the terms its source states: a vendor's reply never
 * decides alone, D119), and each part of its license claim (`provenance.license`, parts joined by " AND ") CC0-1.0, or
 * a CC BY or CMU tier (the license check's tierOf) only when its terms are "inherit". The intake's checker reads the
 * same fields with this, so a generator's clip sent to `library submit` directly is bounced whatever it claims.
 */
export function allowlisted(clip: Clip): { ok: boolean; why: string } {
  const r = recordOf(clip), claim = clip.provenance.license;
  if (!isRecord(r)) return { ok: false, why: "it has no source record (provenance.source): run it through sources.sourceClip" };
  const terms = [r, ...(r.stated ? [r.stated] : [])], both = r.stated ? ` (it states ${r.stated.license} (${r.stated.version}) and served this clip under ${r.license} (${r.version}): both must be on it)` : "";
  const off = terms.find((t) => !ALLOWED_TERMS.includes(t.license));
  if (off) return { ok: false, why: `the ${r.name} source's terms, ${off.license} (${off.version}), aren't on the allowlist (CC0-1.0, or a library clip's tier kept by what derives from it)${both}: its clips stay in ${LOCAL} (O5)` };
  if (r.stated && (r.stated.license !== r.license || r.stated.version !== r.version)) return { ok: false, why: `the ${r.name} source states ${r.stated.license} (${r.stated.version}) and served ${r.license} (${r.version}): a clip enters only under the terms its source states` };
  const inherit = r.license === "inherit", bad = claim.split(" AND ").map((p) => p.trim()).filter((p) => tierOf(p) === "local" || (p !== "CC0-1.0" && !inherit));
  if (bad.length) return { ok: false, why: `its license claim ${claim} isn't on the allowlist: CC0-1.0, or a CC BY or CMU tier only as inherited from library clips (§5.9)` };
  return { ok: true, why: `${claim}, from the ${r.name} source (${r.license}, ${r.version}${r.stated ? ", as it states" : ""})` };
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

/** How `deliver` sends a source's clip: the intake queue's door and the local lane, the gate (sourceGate by default)
 *  and a local set's legend lines; and what the contributor says of a clip sent to the intake queue, as `library submit`
 *  says it: `by`, who or what made it (a person, or the agent and the human behind it: the intake requires it), and a
 *  generator's training-data manifest (its https URL and SHA-256: required of a generated clip). */
export interface DeliverOptions {
  submit: Submit;
  local: LocalLane;
  gate?: Gate;
  legend?: readonly string[];
  by?: string;
  manifest?: { url: string; sha256: string };
}

/** What stops an allowlisted clip from going to the intake queue as sent: the disclosure it needs and lacks (the
 *  checker's provenance gate bounces a clip without it). */
function undisclosed(clip: Clip, o: DeliverOptions): string[] {
  const out: string[] = [], m = o.manifest;
  if (typeof o.by !== "string" || !o.by.trim()) out.push("the intake queue takes a clip with who or what made it: deliver it with by (a person, or the agent and the human behind it), as library submit's --by gives it");
  if (m !== undefined && !(typeof m.url === "string" && /^https:\/\/\S+$/.test(m.url) && HEX64.test(String(m.sha256)))) out.push("manifest is the training-data manifest's https URL and its SHA-256: { url, sha256 }");
  else if (clip.provenance.method === "generated" && m === undefined) out.push("a generator's clip needs its training-data manifest: deliver it with manifest { url, sha256 }, as library submit's --manifest gives it");
  return out;
}

/** The clip as it is sent to the intake queue: given the intake's provenance as `library submit` gives it (who or what
 *  made it, the hash of the intent the source was given as the prompt's, a manifest when given, and the local report:
 *  the sensors' verdict and findings), any intake record it came with replaced. */
function forIntake(s: Sourced, o: DeliverOptions): Clip {
  const r = metrics(s.clip, s.rest), record = recordOf(s.clip)!;
  const intake: IntakeProvenance = { by: o.by!, prompt: record.prompt, ...(o.manifest ? { manifest: { url: o.manifest.url, sha256: o.manifest.sha256 } } : {}), report: { sensors: r.verdict, findings: r.findings.length, qaVersion: checks.QA_VERSION } };
  return { ...s.clip, provenance: { ...s.clip.provenance, intake } as Clip["provenance"] };
}

/** Where a clip went: the intake queue (the submission), library/local/ (the set and the paths written, and why), or
 *  nowhere (the gate's reasons, or the disclosure the intake queue needs). */
export type Delivered = { to: "intake"; id: string; state: string } | { to: "local"; set: string; paths: string[]; why: string } | { to: "refused"; reasons: string[] };

/** A source's clip written into its local set, LOCAL_<SOURCE> under library/local/ (the set's other clips kept, this
 *  one's id moved into it), every path through localPath; the manifest last. */
function toLocal(s: Sourced, lane: LocalLane, legend: readonly string[]): { set: string; paths: string[] } {
  const r = recordOf(s.clip)!, set = `LOCAL_${r.name.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`, dir = `${LOCAL}${set}`, slug = s.clip.id.slice(s.clip.id.indexOf("/") + 1);
  const clip: Clip = { ...s.clip, id: `${set}/${slug}` }, old = lane.read(`${dir}/_set.json`), was = old ? (JSON.parse(old) as { sources?: Record<string, unknown> }) : {};
  const kept = lane.list(dir).filter((f) => f.endsWith(".json") && f !== "_set.json" && f !== `${slug}.json`).sort().map((f) => parseClip(lane.read(`${dir}/${f}`)!));
  const license = r.license === "inherit" ? clip.provenance.license : r.license, stated = r.stated ? `; it states ${r.stated.license} (${r.stated.version})` : "";
  const manifest = {
    set, title: `${r.name}'s clips (local: never committed, never shipped)`, format: "2.0", tier: "local",
    content: { edition: r.name, importer: `m3a sources ${VERSION}` },
    sources: { ...was.sources, [clip.restSrc]: { label: r.name, origin: `the ${r.name} motion source, under ${license} (${r.version})${stated}`, license, url: "", rest: s.rest } },
    legend: { version: "2.0", text: [...legend] },
  };
  const files = setFiles(manifest, [...kept, clip]), names = [...files.keys()].sort((a, b) => Number(a === "_set.json") - Number(b === "_set.json") || (a < b ? -1 : 1));
  const paths = names.map((f) => localPath(`${dir}/${f}`));
  names.forEach((f, i) => lane.write(paths[i]!, files.get(f)!));
  return { set, paths };
}

/**
 * Sends a source's clip where it may go: refused (nothing written) when the gate fails it; to the intake queue when
 * it is allowlisted, with the intake's provenance (refused, nothing sent, when `by` or a generator's manifest is
 * missing); else into its local set under library/local/. No path leads into library/sets/.
 */
export async function deliver(s: Sourced, o: DeliverOptions): Promise<Delivered> {
  const reasons = (o.gate ?? sourceGate)(s);
  if (reasons.length) return { to: "refused", reasons };
  const a = allowlisted(s.clip);
  if (a.ok) {
    const lacks = undisclosed(s.clip, o);
    if (lacks.length) return { to: "refused", reasons: lacks };
    return { to: "intake", ...(await o.submit({ kind: "clip", text: serialize(forIntake(s, o)) })) };
  }
  const release = await o.local.lock?.();
  try {
    return { to: "local", ...toLocal(s, o.local, o.legend ?? []), why: a.why };
  } finally {
    release?.();
  }
}
