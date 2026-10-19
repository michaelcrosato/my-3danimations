// The registry index (PLAN.md WP-9.4): library/index.json, the library's sets as static JSON in two tiers, as package
// registries keep them. The curated core is this repository's library/sets: each set's versions, each with its content
// id (spec/MOTION.md §9.2), a digest of all its files, its tier and licenses, its size and its QA and review counts;
// the latest version's record is what its files give, field by field, or the index isn't rebuilt. Community packs are
// federated entries: a set in a namespace verified to its owner, its files kept elsewhere and held to a content id and
// a digest of all its files. A pack is admitted only when the fetched files give that id, name one license of their own
// (the license it claims), hold no words aimed at a model or an agent (the intake's text gate, on its clips and its
// catalog), and the namespace's proof, fetched from where only its owner can write, vouches for it; the registry keeps
// that proof's text and SHA-256, and every rebuild vouches with it again, offline. A pack never enters
// the core, which grows only by adoption (WP-9.1). Versions are immutable and sets are yanked, never deleted. Built
// from the library, the previous index and the registry's hand-kept inputs (tools/release/registry.json), with no
// network and no clock: the same inputs give the same bytes.
import type { Clip } from "../../packages/core/src/index.ts";
import { contentId, tierOf, type LibrarySource } from "../../packages/library/src/index.ts";
import { proseProblems, textProblems } from "../../packages/tools/src/tools/library-submit.ts";

/** SHA-256 of a text's UTF-8 bytes, in hex. */
export type Sha = (text: string) => string;
/** A set's files by name, as text. */
export type Files = Record<string, string>;
/** One version of a core set, immutable once indexed (only `yanked` may change): `content` is its clip files' content
 *  id (spec/MOTION.md §9.2, as its `_set.json` and the lock say), `digest` the same over all its files. */
export interface SetVersion { v: number; content: string; digest: string; title: string; tier: string; licenses: string[]; clips: number; bytes: number; qa: Record<string, number>; review: Record<string, number>; yanked?: string }
/** One version of a community pack in the index: its content id (its clip files, spec/MOTION.md §9.2) and digest (all
 *  its files), where its files are, its SPDX license (its files' own) and the tier that fits it, and `proofSha256`, the
 *  SHA-256 of the namespace's proof that admitted it. */
export interface PackVersion { v: number; content: string; digest: string; url: string; license: string; tier: string; proofSha256: string; yanked?: string }
/** A community pack in the index: a set in a namespace verified to its owner (`proof`: where its owner vouches for
 *  it). */
export interface CommunityPack { namespace: string; set: string; proof?: string; versions: PackVersion[] }
/** A pack version as the registry keeps it: the index's record and `proofText`, the proof as fetched when it was
 *  admitted, which every rebuild checks again offline (it must give `proofSha256` and vouch for the content id). */
export interface AdmittedVersion extends PackVersion { proofText: string }
/** A community pack as the registry keeps it: each version with the proof that admitted it. */
export interface AdmittedPack { namespace: string; set: string; versions: AdmittedVersion[] }
/** The index (library/index.json): its format, a serial that grows with every change, the core and the community. */
export interface RegistryIndex { about: string; format: "1"; serial: number; core: Record<string, { yanked?: string; versions: SetVersion[] }>; community: Record<string, CommunityPack> }
/** The registry's hand-kept inputs: yanks of core sets (`SET` or `SET@v`: the reason) and the admitted packs. */
export interface Registry { about?: string; yanked: Record<string, string>; community: Record<string, AdmittedPack> }
/** A namespace's proof as fetched: where from, and its bytes as text. */
export interface Proof { url: string; text: string }
/** A pack offered for admission: its namespace, set, the license it claims (its files must name it, and no other),
 *  where its files are and their content id. */
export type Candidate = Pick<PackVersion, "content" | "url" | "license"> & { namespace: string; set: string };

const ABOUT = "The registry index (PLAN.md WP-9.4), written by npm run index from library/sets, the previous index and tools/release/registry.json; npm run index -- --check regenerates it byte for byte. core: each set's versions (content: its clip files' content id, spec/MOTION.md §9.2; digest: the same over all its files), immutable, yanked never deleted. community: packs federated from namespaces verified to their owners, never uploads into the core. npm run index -- verify <SET> <dir> checks a set's files against it.";
const isClip = (f: string) => f.endsWith(".json") && !f.startsWith("_");
/** A catalog row's columns, by name (spec/MOTION.md §9.3). */
const COLUMNS = ["id", "dur", "loop", "speed", "tags", "desc", "src"];
const short = (h: string) => `${h.slice(0, 12)}…`;
const ordered = <T>(o: Record<string, T>) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1)));
const canon = (x: unknown) => JSON.stringify(x, (_k, v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? ordered(v as Record<string, unknown>) : v));
const json = (text: string): unknown => { try { return JSON.parse(text); } catch { return undefined; } };
const HEX = /^[0-9a-f]{64}$/, hex = (x: unknown) => typeof x === "string" && HEX.test(x);
/** The fields of `was` whose values aren't `now`'s (either's keys), by name. */
const differing = (was: object, now: object) => [...new Set([...Object.keys(was), ...Object.keys(now)])].filter((k) => canon((was as Record<string, unknown>)[k]) !== canon((now as Record<string, unknown>)[k])).sort();

/** The index's text: one-space JSON and a newline, as the lock is written. */
export const indexText = (index: RegistryIndex): string => `${JSON.stringify(index, null, 1)}\n`;

/** A set's content id (its clip files) and digest (all its files), from its files. */
export function ids(files: Files, sha: Sha): { content: string; digest: string } {
  const hashes = Object.fromEntries(Object.entries(files).map(([f, t]) => [f, sha(t)]));
  return { content: contentId(Object.fromEntries(Object.entries(hashes).filter(([f]) => isClip(f))), sha), digest: contentId(hashes, sha) };
}

/** A core set's version record from its files; throws when its manifest's content id isn't its clips'. */
export function describeSet(name: string, files: Files, sha: Sha): Omit<SetVersion, "v"> {
  const { content, digest } = ids(files, sha), m = JSON.parse(files["_set.json"] ?? "{}") as { title?: string; tier?: string; content?: { sha256?: string }; sources?: Record<string, { license: string }> };
  if (m.content?.sha256 !== content) throw new Error(`index: ${name}'s clip files give content id ${short(content)}, its _set.json says ${String(m.content?.sha256)}: write the set through @m3a/library's writer`);
  const qa: Record<string, number> = {}, review: Record<string, number> = { approved: 0, flagged: 0, unreviewed: 0 }, clips = Object.keys(files).filter(isClip);
  for (const c of clips.map((f) => JSON.parse(files[f]!) as { quality?: { qa?: string }; review?: { state?: string } })) {
    qa[c.quality?.qa ?? "unchecked"] = (qa[c.quality?.qa ?? "unchecked"] ?? 0) + 1;
    review[c.review?.state ?? "unreviewed"] = (review[c.review?.state ?? "unreviewed"] ?? 0) + 1;
  }
  const bytes = Object.values(files).reduce((a, t) => a + new TextEncoder().encode(t).length, 0);
  return { content, digest, title: m.title ?? name, tier: m.tier ?? "local", licenses: [...new Set(Object.values(m.sources ?? {}).map((s) => s.license))].sort(), clips: clips.length, bytes, qa: ordered(qa), review };
}

/** Where a namespace's owner vouches for its packs, a place only that owner can write: a domain's
 *  `/.well-known/m3a-packs.json`, or for `github.com/<owner>` that owner's `.github` repository; null for a name that
 *  isn't a namespace. */
export function proofUrl(namespace: string): string | null {
  const gh = /^github\.com\/([A-Za-z0-9][A-Za-z0-9-]{0,38})$/.exec(namespace);
  if (gh) return `https://raw.githubusercontent.com/${gh[1]}/.github/HEAD/m3a-packs.json`;
  return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(namespace) ? `https://${namespace}/.well-known/m3a-packs.json` : null;
}

/** Why a namespace's proof doesn't vouch for a pack at a content id (empty when it does): it must come from the
 *  namespace's proof URL, name the namespace, and list the content id under the set in `packs`. */
export function vouch(namespace: string, set: string, content: string, proof: Proof | undefined): string[] {
  const where = proofUrl(namespace), doc = proof && (json(proof.text) as { namespace?: unknown; packs?: Record<string, unknown> } | undefined), listed = doc?.packs?.[set];
  if (!where) return [`${namespace} isn't a namespace: name a domain (packs.example.org) or github.com/<owner>`];
  if (!proof) return [`${namespace} is unverified: fetch its proof from ${where} and pass it (--proof <file>)`];
  if (proof.url !== where) return [`${namespace} is unverified: its proof came from ${proof.url}, and only ${where} is its owner's to write`];
  if (doc?.namespace !== namespace) return [`${namespace} is unverified: the proof at ${where} ${doc ? `names ${JSON.stringify(doc.namespace)}` : "isn't JSON"}`];
  return Array.isArray(listed) && listed.includes(content) ? [] : [`${namespace} is unverified for ${set} at ${short(content)}: its owner must list that content id under packs.${set} at ${where}`];
}

/** What is wrong with the shape of a community pack as the registry holds it (empty when nothing is). */
function packShape(key: string, p: AdmittedPack): string[] {
  const out = proofUrl(p.namespace) ? [] : [`${key}: ${p.namespace} isn't a namespace`];
  if (key !== `${p.namespace}/${p.set}` || !/^[A-Z][A-Z0-9_]*$/.test(p.set)) out.push(`${key}: a pack is keyed namespace/SET, its set upper case`);
  p.versions.forEach((v, i) => {
    if (v.v !== i + 1 || !hex(v.content) || !hex(v.digest) || !/^https:\/\//.test(String(v.url)) || v.tier !== tierOf(String(v.license)) || v.tier === "local") out.push(`${key} v${v.v}: versions count from 1, each a content id and a digest, an https url and a redistributable license with its tier`);
  });
  return out;
}

/** Every recorded proof of a pack that doesn't hold, checked offline (empty when each does): each version must carry
 *  the proof that admitted it, whose text gives its SHA-256 and vouches, as fetched from the namespace's proof URL, for
 *  that version's content id. */
function proofProblems(key: string, p: AdmittedPack, sha: Sha): string[] {
  const where = proofUrl(p.namespace);
  return where === null ? [] : p.versions.flatMap((v) => {
    if (typeof v.proofText !== "string" || !hex(v.proofSha256)) return [`${key} v${v.v} has no recorded proof: a pack is admitted with its namespace's proof (npm run index -- admit <pack.json> <dir> --proof <file>), never written into tools/release/registry.json by hand`];
    if (sha(v.proofText) !== v.proofSha256) return [`${key} v${v.v}: its recorded proof gives SHA-256 ${short(sha(v.proofText))}, the registry says ${short(v.proofSha256)}`];
    return vouch(p.namespace, p.set, v.content, { url: where, text: v.proofText }).map((w) => `${key} v${v.v}'s recorded proof: ${w}`);
  });
}

/** The licenses a pack's files name, sorted (its _set.json's sources' and each clip's `provenance.license`), and
 *  where one is missing. */
function licensesIn(files: Files): { licenses: string[]; problems: string[] } {
  const found = new Set<string>(), m = json(files["_set.json"] ?? "") as { sources?: unknown } | undefined;
  const sources = m?.sources && typeof m.sources === "object" ? Object.values(m.sources as Record<string, { license?: unknown } | null>) : [];
  const problems = sources.length ? [] : ["its _set.json names no source, whose license is the pack's"];
  for (const src of sources) if (typeof src?.license === "string") found.add(src.license); else problems.push("a source in its _set.json names no license");
  const bare = Object.keys(files).filter(isClip).sort().filter((f) => {
    const l = (json(files[f]!) as { provenance?: { license?: unknown } } | undefined)?.provenance?.license;
    if (typeof l === "string") found.add(l);
    return typeof l !== "string";
  });
  if (bare.length) problems.push(`${bare.length} clip(s) name no provenance.license (${bare.slice(0, 3).join(", ")}${bare.length > 3 ? ", ..." : ""})`);
  return { licenses: [...found].sort(), problems };
}

/** What in a pack's text reads as aimed at a model or an agent, or hides what it says, as the intake's text gate reads
 *  a submission (packages/tools/src/tools/library-submit.ts): every clip file's fields, and every column of every
 *  catalog.tsv row (models read catalog lines), each named by its file and field, or row and column, never quoted. */
function textIn(files: Files): string[] {
  const out: string[] = [];
  for (const f of Object.keys(files).filter(isClip).sort()) {
    const clip = json(files[f]!);
    if (clip && typeof clip === "object") out.push(...textProblems(clip as Clip).map((p) => `${f}: ${p}`));
  }
  (files["catalog.tsv"] ?? "").split("\n").forEach((row, i) => {
    const at = row.split("\t").flatMap((s, c) => proseProblems(COLUMNS[c] ?? `column ${c + 1}`, s));
    out.push(...at.map((p) => `catalog.tsv row ${i + 1}: ${p}`));
  });
  return out;
}

/** Every way `next` rewrites `previous`'s history: a set or pack gone (they are yanked, never deleted), a version gone
 *  or changed (versions are immutable; only a yank may change), or a serial that doesn't follow: it grows when the
 *  index changes (by one a regeneration, so by one or more since `previous`, as version numbers may skip) and stays
 *  when nothing else does, so a serial edited by hand fails against a trusted `previous` (main's, `--since`). */
export function history(previous: RegistryIndex | undefined, next: RegistryIndex): string[] {
  const out: string[] = [], bare = ({ yanked: _y, ...v }: { v: number; yanked?: string }) => canon(v);
  if (previous) {
    const same = indexText({ ...previous, serial: 0 }) === indexText({ ...next, serial: 0 });
    if (same ? next.serial !== previous.serial : !(next.serial > previous.serial)) out.push(`the index's serial is ${next.serial}, the previous index's ${previous.serial}, and ${same ? `nothing else changed: it stays ${previous.serial}` : `the index changed: it grows past ${previous.serial}`} (npm run index sets it; restore library/index.json as it wrote it)`);
  }
  for (const tier of ["core", "community"] as const) {
    for (const [name, was] of Object.entries(previous?.[tier] ?? {})) {
      const now: { v: number }[] | undefined = next[tier][name]?.versions;
      if (!now) out.push(`${name} is gone from the index's ${tier}: a set is yanked, never deleted; restore it and yank it in tools/release/registry.json`);
      for (const v of now ? was.versions : []) {
        const w = now!.find((x) => x.v === v.v);
        if (!w || bare(w) !== bare(v)) out.push(`${name} v${v.v} ${w ? "changed" : "is gone"}: versions are immutable; a change is a new version`);
      }
    }
  }
  return out;
}

/** The index from the library's sets, the registry's yanks and packs, and the previous index (whose versions stand: a
 *  set whose files changed gets a new version, and the latest version of one whose files didn't must be what they give,
 *  field by field). Throws on a set whose manifest isn't its files, a latest version whose record isn't, a malformed
 *  pack or yank, a pack version whose recorded proof doesn't vouch for it, or a rewritten history. */
export function buildIndex(src: LibrarySource, sha: Sha, registry: Registry, previous?: RegistryIndex): RegistryIndex {
  const core: RegistryIndex["core"] = {}, community: RegistryIndex["community"] = {}, y = registry.yanked, bad: string[] = [];
  for (const name of src.sets().sort()) {
    const files = Object.fromEntries(src.files(name).sort().map((f) => [f, src.read(name, f)])), now = describeSet(name, files, sha);
    const was = previous?.core[name]?.versions ?? [], last = was.at(-1), same = last?.digest === now.digest;
    if (same) {
      const { v, yanked: _y, ...recorded } = last!, off = differing(recorded, now);
      if (off.length) bad.push(`${name} v${v}'s record isn't what its files give (${off.join(", ")}): restore library/index.json as npm run index wrote it (git checkout -- library/index.json); a version is its files, and immutable`);
    }
    const versions = (same ? was : [...was, { v: was.length + 1, ...now }]).map(({ yanked: _y, ...v }) => (y[`${name}@${v.v}`] ? { ...v, yanked: y[`${name}@${v.v}`]! } : v));
    core[name] = y[name] ? { yanked: y[name], versions } : { versions };
  }
  const held = (k: string) => core[k] !== undefined || Object.entries(core).some(([s, e]) => e.versions.some((v) => `${s}@${v.v}` === k));
  bad.push(...Object.keys(y).filter((k) => !held(k)).map((k) => `tools/release/registry.json yanks ${k}, which the index doesn't hold`));
  for (const [key, p] of Object.entries(ordered(registry.community))) {
    bad.push(...packShape(key, p), ...proofProblems(key, p, sha));
    community[key] = { namespace: p.namespace, set: p.set, proof: proofUrl(p.namespace) ?? "", versions: p.versions.map((v) => ({ v: v.v, content: v.content, digest: v.digest, url: v.url, license: v.license, tier: v.tier, proofSha256: v.proofSha256, ...(v.yanked ? { yanked: v.yanked } : {}) })) };
  }
  const next: RegistryIndex = { about: ABOUT, format: "1", serial: previous?.serial ?? 1, core, community };
  if (previous && indexText(next) !== indexText(previous)) next.serial = previous.serial + 1;
  bad.push(...history(previous, next));
  if (bad.length) throw new Error(`index: ${bad.join("; ")}`);
  return next;
}

/**
 * Every way a set's files differ from what the index says of one of its versions (the latest unless `v` names one),
 * as sentences; empty when they are that version. A set's files must give its content id and digest, and a core set's
 * the rest of its record too (its licenses, tier, counts: what a consumer reads); a community pack's namespace's proof
 * (the bytes fetched, and where from) must vouch for it.
 */
export function verifySet(index: RegistryIndex, name: string, files: Files, sha: Sha, opts: { v?: number; proof?: Proof } = {}): string[] {
  const pack = index.community[name], versions: (SetVersion | PackVersion)[] = index.core[name]?.versions ?? pack?.versions ?? [];
  const at = opts.v === undefined ? versions.at(-1) : versions.find((x) => x.v === opts.v), got = ids(files, sha), out: string[] = [];
  if (!versions.length) return [`the index holds no ${name}: name a core set (${Object.keys(index.core).join(", ")}) or a community pack (namespace/SET)`];
  if (!at) return [`${name} has no v${opts.v} (versions: ${versions.map((x) => x.v).join(", ")}): name a version it holds (--v ${versions.at(-1)!.v})`];
  if (got.content !== at.content) out.push(`${name} v${at.v}: its clip files give content id ${short(got.content)}, the index says ${short(at.content)}: a clip file differs (sets.lock.json names each clip's SHA-256)`);
  if (got.digest !== at.digest) out.push(`${name} v${at.v}: its files give digest ${short(got.digest)}, the index says ${short(at.digest)}: a file differs, is missing or is extra`);
  if (pack) return [...out, ...vouch(pack.namespace, pack.set, at.content, opts.proof)];
  if (out.length) return out;
  const { v, yanked: _y, ...recorded } = at as SetVersion;
  let off: string[];
  try {
    off = differing(recorded, describeSet(name, files, sha));
  } catch (err) {
    return [`${name} v${v}: ${(err as Error).message}`];
  }
  return off.length ? [`${name} v${v}: the index's record isn't what its files give (${off.join(", ")}): this index was edited; take library/index.json from the release or the repository again`] : [];
}

/** The registry with a candidate pack admitted as its next version, its digest and the proof that vouched for it
 *  recorded; throws, naming each reason, when its files don't give its content id, don't name its license alone or
 *  hold words aimed at a model or an agent (`textIn`), its namespace's proof doesn't vouch for it, or it is malformed
 *  or indexed already. */
export function admit(registry: Registry, c: Candidate, files: Files, proof: Proof | undefined, sha: Sha): Registry {
  const key = `${c.namespace}/${c.set}`, was = registry.community[key]?.versions ?? [], got = ids(files, sha), named = licensesIn(files);
  const version: AdmittedVersion = { v: was.length + 1, content: c.content, digest: got.digest, url: c.url, license: c.license, tier: tierOf(c.license), proofSha256: sha(proof?.text ?? ""), proofText: proof?.text ?? "" };
  const pack: AdmittedPack = { namespace: c.namespace, set: c.set, versions: [...was, version] };
  const why = [...(got.content === c.content ? [] : [`its files give content id ${short(got.content)}, not ${short(c.content)}`]), ...named.problems];
  if (named.licenses.length !== 1 || named.licenses[0] !== c.license) why.push(`its files name ${named.licenses.join(", ") || "no license"}, and it claims ${c.license}: a pack's license is its files' own, one for the whole pack (its _set.json's sources and every clip's provenance.license)`);
  why.push(...textIn(files), ...vouch(c.namespace, c.set, c.content, proof), ...packShape(key, pack));
  if (was.some((v) => v.content === c.content)) why.push(`${key} holds that content id already`);
  if (why.length) throw new Error(`index: ${key} refused: ${why.join("; ")}`);
  return { ...registry, community: ordered({ ...registry.community, [key]: pack }) };
}
