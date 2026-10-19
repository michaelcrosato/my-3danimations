// The registry index (PLAN.md WP-9.4): library/index.json, the library's sets as static JSON in two tiers, as package
// registries keep them. The curated core is this repository's library/sets: each set's versions, each with its content
// id (spec/MOTION.md §9.2), a digest of all its files, its tier and licenses, its size and its QA and review counts.
// Community packs are federated entries: a set in a namespace verified to its owner, its files kept elsewhere and held
// to a content id. A pack is admitted only when the fetched files give that id and the namespace's proof, fetched from
// where only its owner can write, vouches for it; it never enters the core, which grows only by adoption (WP-9.1).
// Versions are immutable and sets are yanked, never deleted. Built from the library, the previous index and the
// registry's hand-kept inputs (tools/release/registry.json), with no network and no clock: the same inputs give the
// same bytes.
import { contentId, tierOf, type LibrarySource } from "../../packages/library/src/index.ts";

/** SHA-256 of a text's UTF-8 bytes, in hex. */
export type Sha = (text: string) => string;
/** A set's files by name, as text. */
export type Files = Record<string, string>;
/** One version of a core set, immutable once indexed (only `yanked` may change): `content` is its clip files' content
 *  id (spec/MOTION.md §9.2, as its `_set.json` and the lock say), `digest` the same over all its files. */
export interface SetVersion { v: number; content: string; digest: string; title: string; tier: string; licenses: string[]; clips: number; bytes: number; qa: Record<string, number>; review: Record<string, number>; yanked?: string }
/** One version of a community pack: its content id, where its files are, its SPDX license and the tier that fits it. */
export interface PackVersion { v: number; content: string; url: string; license: string; tier: string; yanked?: string }
/** A community pack: a set in a namespace verified to its owner (`proof`: where its owner vouches for it). */
export interface CommunityPack { namespace: string; set: string; proof?: string; versions: PackVersion[] }
/** The index (library/index.json): its format, a serial that grows with every change, the core and the community. */
export interface RegistryIndex { about: string; format: "1"; serial: number; core: Record<string, { yanked?: string; versions: SetVersion[] }>; community: Record<string, CommunityPack> }
/** The registry's hand-kept inputs: yanks of core sets (`SET` or `SET@v`: the reason) and the admitted packs. */
export interface Registry { about?: string; yanked: Record<string, string>; community: Record<string, CommunityPack> }
/** A namespace's proof as fetched: where from, and its bytes as text. */
export interface Proof { url: string; text: string }
/** A pack offered for admission: its namespace, set, license, where its files are and their content id. */
export type Candidate = Omit<PackVersion, "v" | "tier" | "yanked"> & { namespace: string; set: string };

const ABOUT = "The registry index (PLAN.md WP-9.4), written by npm run index from library/sets, the previous index and tools/release/registry.json; npm run index -- --check regenerates it byte for byte. core: each set's versions (content: its clip files' content id, spec/MOTION.md §9.2; digest: the same over all its files), immutable, yanked never deleted. community: packs federated from namespaces verified to their owners, never uploads into the core. npm run index -- verify <SET> <dir> checks a set's files against it.";
const isClip = (f: string) => f.endsWith(".json") && !f.startsWith("_");
const short = (h: string) => `${h.slice(0, 12)}…`;
const ordered = <T>(o: Record<string, T>) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1)));
const canon = (x: unknown) => JSON.stringify(x, (_k, v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? ordered(v as Record<string, unknown>) : v));
const json = (text: string): unknown => { try { return JSON.parse(text); } catch { return undefined; } };

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

/** What is wrong with a community pack as the registry holds it (empty when nothing is). */
function packProblems(key: string, p: CommunityPack): string[] {
  const out = proofUrl(p.namespace) ? [] : [`${key}: ${p.namespace} isn't a namespace`];
  if (key !== `${p.namespace}/${p.set}` || !/^[A-Z][A-Z0-9_]*$/.test(p.set)) out.push(`${key}: a pack is keyed namespace/SET, its set upper case`);
  p.versions.forEach((v, i) => {
    if (v.v !== i + 1 || !/^[0-9a-f]{64}$/.test(v.content) || !v.url.startsWith("https://") || v.tier !== tierOf(v.license) || v.tier === "local") out.push(`${key} v${v.v}: versions count from 1, each a content id, an https url and a redistributable license with its tier`);
  });
  return out;
}

/** Every way `next` rewrites `previous`'s history: a set or pack gone (they are yanked, never deleted), or a version
 *  gone or changed (versions are immutable; only a yank may change). */
export function history(previous: RegistryIndex | undefined, next: RegistryIndex): string[] {
  const out: string[] = [], bare = ({ yanked: _y, ...v }: { v: number; yanked?: string }) => canon(v);
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
 *  set whose files changed gets a new version). Throws on a set whose manifest isn't its files, a malformed pack or
 *  yank, or a rewritten history. */
export function buildIndex(src: LibrarySource, sha: Sha, registry: Registry, previous?: RegistryIndex): RegistryIndex {
  const core: RegistryIndex["core"] = {}, community: RegistryIndex["community"] = {}, y = registry.yanked;
  for (const name of src.sets().sort()) {
    const files = Object.fromEntries(src.files(name).sort().map((f) => [f, src.read(name, f)])), now = describeSet(name, files, sha);
    const was = previous?.core[name]?.versions ?? [], kept = was.at(-1)?.digest === now.digest ? was : [...was, { v: was.length + 1, ...now }];
    const versions = kept.map(({ yanked: _y, ...v }) => (y[`${name}@${v.v}`] ? { ...v, yanked: y[`${name}@${v.v}`]! } : v));
    core[name] = y[name] ? { yanked: y[name], versions } : { versions };
  }
  const held = (k: string) => core[k] !== undefined || Object.entries(core).some(([s, e]) => e.versions.some((v) => `${s}@${v.v}` === k));
  const bad = Object.keys(y).filter((k) => !held(k)).map((k) => `tools/release/registry.json yanks ${k}, which the index doesn't hold`);
  for (const [key, p] of Object.entries(ordered(registry.community))) {
    bad.push(...packProblems(key, p));
    community[key] = { namespace: p.namespace, set: p.set, proof: proofUrl(p.namespace) ?? "", versions: p.versions.map((v) => ({ v: v.v, content: v.content, url: v.url, license: v.license, tier: v.tier, ...(v.yanked ? { yanked: v.yanked } : {}) })) };
  }
  const next: RegistryIndex = { about: ABOUT, format: "1", serial: previous?.serial ?? 1, core, community };
  bad.push(...history(previous, next));
  if (bad.length) throw new Error(`index: ${bad.join("; ")}`);
  if (previous && indexText(next) !== indexText(previous)) next.serial = previous.serial + 1;
  return next;
}

/**
 * Every way a set's files differ from what the index says of one of its versions (the latest unless `v` names one),
 * as sentences; empty when they are that version. A core set's files must give its content id and digest; a community
 * pack's its content id, and its namespace's proof (the bytes fetched, and where from) must vouch for it.
 */
export function verifySet(index: RegistryIndex, name: string, files: Files, sha: Sha, opts: { v?: number; proof?: Proof } = {}): string[] {
  const pack = index.community[name], versions: { v: number; content: string; digest?: string }[] = index.core[name]?.versions ?? pack?.versions ?? [];
  const at = opts.v === undefined ? versions.at(-1) : versions.find((x) => x.v === opts.v), got = ids(files, sha), out: string[] = [];
  if (!at) return [`the index holds no ${name}${opts.v === undefined ? "" : ` v${opts.v}`}: name a core set (${Object.keys(index.core).join(", ")}) or a community pack (namespace/SET)`];
  if (got.content !== at.content) out.push(`${name} v${at.v}: its clip files give content id ${short(got.content)}, the index says ${short(at.content)}: a clip file differs (sets.lock.json names each clip's SHA-256)`);
  if (at.digest !== undefined && got.digest !== at.digest) out.push(`${name} v${at.v}: its files give digest ${short(got.digest)}, the index says ${short(at.digest)}: a file differs, is missing or is extra`);
  return pack ? [...out, ...vouch(pack.namespace, pack.set, at.content, opts.proof)] : out;
}

/** The registry with a candidate pack admitted as its next version; throws, naming each reason, when its files don't
 *  give its content id, its namespace's proof doesn't vouch for it, or it is malformed or indexed already. */
export function admit(registry: Registry, c: Candidate, files: Files, proof: Proof | undefined, sha: Sha): Registry {
  const key = `${c.namespace}/${c.set}`, was = registry.community[key]?.versions ?? [], got = ids(files, sha).content;
  const pack: CommunityPack = { namespace: c.namespace, set: c.set, versions: [...was, { v: was.length + 1, content: c.content, url: c.url, license: c.license, tier: tierOf(c.license) }] };
  const why = [...(got === c.content ? [] : [`its files give content id ${short(got)}, not ${short(c.content)}`]), ...vouch(c.namespace, c.set, c.content, proof), ...packProblems(key, pack)];
  if (was.some((v) => v.content === c.content)) why.push(`${key} holds that content id already`);
  if (why.length) throw new Error(`index: ${key} refused: ${why.join("; ")}`);
  return { ...registry, community: ordered({ ...registry.community, [key]: pack }) };
}
