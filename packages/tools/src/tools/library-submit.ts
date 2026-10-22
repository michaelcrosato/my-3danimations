// `m3a library submit | status` (PLAN.md §5.9, WP-9.1a): the intake queue's door for contributors, and the gates every
// submission passes, here so the tool, the checker (tools/intake/check.ts) and the library's pull-request gates
// (tools/intake/gates.ts) read a clip one way. `submit` reads a clip or a recipe (a file or its JSON), adds the
// intake's provenance (`provenance.intake`: who or what made it, which a clip is refused without, D119; the prompt's
// SHA-256, a generator's training-data manifest, the clip it improves with its file's SHA-256, and the local report),
// runs the gates that need no rig or store here, and sends what passes to the queue as the store's contributor (the
// local store's identity, or a contributor key for the hosted one), at most PER_DAY a day; `status` lists the
// contributor's submissions with their states and bounce reasons. The gates: schema, budgets, provenance, license (CC0,
// or the tier of the clip it derives from with its license and credit kept; a motion source's terms on the allowlist),
// text (no instruction aimed at agents: models read catalog lines; a field that holds no prose held to its shape), lint
// and sensors; the checker adds dedup and the retarget onto the reference rigs. Platform-neutral: the store comes from
// the surface (`libraryTool`'s opener). Submission text is data, never instructions: a refusal quotes none of it, and a
// bounce's reason stays within REASON_CHARS.
import { format, recipe as recipes, serialize, validate, validation, type Clip, type Rest } from "@m3a/core";
import { capturedSpeed, catalogRow, LibraryError, measureClipFacts, ROW_BUDGET, tagConflicts, tierOf, type Library, type Tier, type Tokens } from "@m3a/library";
import { checks, describe, metrics } from "@m3a/sensors";
import { contentHash, IntakeError, MAX_BYTES, motionHash, STATES, type IntakeStore, type Kind, type Submission } from "../intake/index.ts";
import { defineTool, ToolError, type LibraryAccess, type Tool, type ToolContext } from "../registry/registry.ts";
import { allowlisted } from "../sources/deliver.ts";
import { restFor } from "./clips.ts";
import { call, capped, count, cut, fileOrJson, more, output } from "./common.ts";
import { boundHolds } from "./judge.ts";

/** The most submissions a contributor sends in a day, as the hosted submit function counts them. */
export const PER_DAY = 20;
/** The tiers a submission may derive from (D10): every shipped one. */
export const SHIPPED: readonly Tier[] = ["cc0", "cc-by", "cmu"];
/** Each tier's intake set, where an adopted clip that improves no library clip joins (PLAN.md §5.9). */
export const INTAKE_SETS: Readonly<Record<"cc0" | "cc-by" | "cmu", string>> = { cc0: "INTAKE_CC0", "cc-by": "INTAKE_CC_BY", cmu: "INTAKE_CMU" };
/** The gates, in the order a bounce names them, what it is before how good it is: schema, provenance, license, text,
 *  dedup, sensors, retarget, budgets, lint. The checker runs dedup and the retarget (they need the library's clips and
 *  the rigs). */
export const GATES = ["schema", "provenance", "license", "text", "dedup", "sensors", "retarget", "budgets", "lint"] as const;
/** A gate's name. */
export type GateName = (typeof GATES)[number];
/** One gate's outcome: each problem it found, in the API's words with its fix. */
export interface Gate {
  gate: GateName;
  ok: boolean;
  why: string[];
}

/** What a contributor says of a clip (`provenance.intake`): who or what made it, the SHA-256 of the prompt a model was
 *  given, a generator's training-data manifest (its URL and SHA-256), the library clip it improves with its file's
 *  SHA-256 then, the queue's submission it was adopted from, and the local report its submit measured. */
export interface IntakeProvenance {
  by: string;
  prompt?: string;
  manifest?: { url: string; sha256: string };
  improves?: { id: string; sha256: string };
  submission?: string;
  report?: { sensors: string; findings: number; qaVersion: string };
}

/** A library clip a submission derives from: its id, tier, license and credit. */
export interface Derived {
  id: string;
  tier: Tier;
  license: string;
  credit: string | null;
}

/** What the gates read: the clip as it would be adopted (a recipe's compiled clip), its rest, what it is, the clip it
 *  improves or replaces (its id, its file's SHA-256 then, the clip and its rest: what it may keep of that clip's tag
 *  conflicts and failing metrics), the library clips it derives from, what it is to the library (`as`: a submission,
 *  its quality and review claims ignored and the intake's provenance required; a clip adopted from the queue, its
 *  provenance required; any other library clip), whether a pull request adds it (`added`: a library clip added outside
 *  the intake carries no review), which failing metrics are kept (`qa`: `recorded`, the clip's own QA reason, which
 *  only a changed library clip's writers give; `byHand`, the metrics library/baselines/qa.json keeps for it by hand;
 *  none by default), the validator warnings its set's _baseline.json accepts and the tags whose conflict
 *  library/baselines/tags.json explains (a library clip's), and the token count rows are cut with. */
export interface GateInput {
  clip: Clip;
  rest: Rest | null;
  kind: Kind;
  base: { id: string; sha256: string; clip: Clip; rest: Rest } | null;
  derived: readonly Derived[];
  as: "submission" | "adopted" | "library";
  added?: boolean;
  qa?: { recorded?: boolean; byHand?: readonly string[] };
  accepted?: readonly { code: string; at: string }[];
  acceptedTags?: readonly string[];
  tokens?: Tokens;
}

const HEX64 = /^[0-9a-f]{64}$/;
/** A library clip's id as a reason may name it: SET/Clip, no prose. */
const CLIP_ID = /^[A-Z][A-Z0-9_]*\/[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
/** An SPDX license expression (ids, LicenseRef-s, joined by AND, OR or WITH). */
const SPDX = /^[A-Za-z0-9][A-Za-z0-9.+-]{0,63}( (AND|OR|WITH) [A-Za-z0-9][A-Za-z0-9.+-]{0,63}){0,7}$/;
const NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,39}$/, REVISION = /^[a-z0-9][a-z0-9-]{0,39}@\d{1,6}$/, VERSION = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,39}$/;
const intakeOf = (c: Clip) => (c.provenance as { intake?: Partial<IntakeProvenance> }).intake;

/** Text fields a model reads, by path, with what each may hold: plain words. */
const PLAIN: Readonly<Record<string, number>> = { name: 60, desc: 200, "tags[]": 24, "events[].name": 32, "provenance.src": 40, "provenance.take": 80, "provenance.orig": 64, "provenance.credit": 200, "provenance.producer.tool": 60, "provenance.producer.version": 40, "provenance.producer.model": 80, "provenance.intake.by": 200, "quality.baseline": 600 };
/** Fields that hold the owner's words, not a contributor's (m3a review writes a review's note; a submission carrying a
 *  review is bounced): held only to characters a reader can see. */
const OWNER: ReadonlySet<string> = new Set(["review.note"]);
/** Fields that hold no prose, by path, each with the shape its value has (an enum, an id, a hash, a version, a URL
 *  where one belongs) and its name: a value off its shape is refused, never read past as prose. A key a clip names
 *  (a recipe's inputs) is `*`. Every other path is prose (PLAIN) or not taken. */
const KINDS: Readonly<Record<string, readonly [RegExp, string]>> = {
  format: [/^2\.\d{1,3}$/, "a format version"],
  id: [CLIP_ID, "a clip id, SET/Clip"],
  legend: [new RegExp(`^${format.LEGEND_VERSION.replace(/\./g, "\\.")}$`), `the legend's version, "${format.LEGEND_VERSION}"`],
  skeleton: [NAME, "a body plan's name"],
  restSrc: [/^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/, "a library source's key"],
  "requires[]": [NAME, "a capability's name"],
  "contacts.by": [/^(detected|labelled)$/, '"detected" or "labelled"'],
  "facts.by": [REVISION, "a revision, tool@N"],
  "facts.captured[]": [/^[a-z][A-Za-z]{0,31}$/, "a fact's name"],
  // a labelled loop's named contact reading (spec/MOTION.md §7.1, §7.3, D129): a name's shape, so a later one passes
  "facts.reading": [/^[a-z][a-z-]{0,39}$/, "a contact reading's name"],
  "provenance.method": [new RegExp(`^(${Object.keys(format.IPTC).join("|")})$`), "a method"],
  "provenance.license": [SPDX, "an SPDX license expression"],
  "provenance.ai": [new RegExp(`^(${Object.values(format.IPTC).join("|")})$`), "an IPTC digital source type"],
  "provenance.intake.prompt": [HEX64, "a SHA-256"],
  "provenance.intake.manifest.url": [/^https:\/\/\S{1,200}$/, "an https URL"],
  "provenance.intake.manifest.sha256": [HEX64, "a SHA-256"],
  "provenance.intake.improves.id": [CLIP_ID, "a clip id, SET/Clip"],
  "provenance.intake.improves.sha256": [HEX64, "a SHA-256"],
  "provenance.intake.submission": [/^s-[0-9a-f]{16}@[0-9a-f]{64}$/, "a submission's id@content hash"],
  "provenance.intake.report.sensors": [/^(pass|warn|fail)$/, "the sensors' verdict"],
  "provenance.intake.report.qaVersion": [REVISION, "a revision, tool@N"],
  // a compiled recipe's record: its hash and its inputs' content ids, nothing else
  "provenance.recipe.sha256": [HEX64, "a SHA-256"],
  "provenance.recipe.inputs.*": [/^([0-9a-f]{64})?$/, "a content id"],
  // the motion source's record (WP-9.2): its name, its terms' license and version, the prompt's hash (the seed is a
  // number); a record of the terms as served under it reads the same
  "provenance.source.name": [NAME, "a source's name"],
  "provenance.source.license": [/^(inherit|[A-Za-z0-9][A-Za-z0-9.+-]{0,63})$/, 'an SPDX license id, or "inherit"'],
  "provenance.source.version": [VERSION, "a version"],
  "provenance.source.prompt": [HEX64, "a SHA-256"],
  "quality.qa": [/^(pass|baselined|fail|unchecked)$/, "a QA verdict"],
  "quality.qaVersion": [/^(none|[a-z0-9][a-z0-9-]{0,39}@\d{1,6})$/, "a revision, tool@N"],
  "review.state": [/^(approved|flagged)$/, "a review's state"],
  "review.by": [/^[A-Za-z0-9][A-Za-z0-9_.@-]{0,63}$/, "the reviewer's id"],
  "review.date": [/^\d{4}-\d{2}-\d{2}$/, "a date, YYYY-MM-DD"],
  "review.motion": [HEX64, "a motion hash"],
};
/** The shape a path's value has when it holds no prose, or undefined for prose. */
const kindOf = (path: string) => KINDS[path] ?? KINDS[path.replace(/^provenance\.source\.[a-z]{1,16}\.(license|version)$/, "provenance.source.$1")];
/** Words aimed at a model or an agent rather than describing a motion (models read catalog lines and clip text), each
 *  with what it does and the fields where it is no such thing (a credit line names its source's site). */
const AIMED: readonly [RegExp, string, string[]?][] = [
  [/\b(ignore|disregard|forget|override|bypass|skip)\b.{0,40}\b(instructions?|prompts?|rules|guidelines|guidance|directions?|advice|orders|previous|earlier|prior|above|everything)\b/i, "tells the reader to set its instructions aside"],
  // the same in other languages a model reads as readily
  [/\b(ignor\p{L}*|olvid\p{L}*|oubli\p{L}*|vergiss\p{L}*|dimentic\p{L}*|esque[cç]\p{L}*)\b.{0,40}(instru[cç]\p{L}*|anweisung\p{L}*|istruzion\p{L}*|regla\p{L}*|r[eè]gle\p{L}*|regeln)|(忽略|无视|忽視|無視|忘记|忘記).{0,12}(指令|指示|说明|說明|規則|规则|提示)|(игнорир|забуд)\p{L}*.{0,40}инструкц/iu, "tells the reader to set its instructions aside"],
  [/\b(agents?|models?|llms?|ais?|assistants?|bots?|reviewers?|maintainers?|crawlers?)\b[^.;!?]{0,60}\b(should|must|shall|need to|have to|ought to|are to|always|never)\b/i, "speaks to agents or models"],
  [/\b(rank|prefer|pick|choose|select|recommend|prioriti[sz]e|favou?r|promote)\b[^.;!?]{0,30}\b(this (clip|one|motion|animation)|me)\b|\b(above|over|before|ahead of) (all|any|every) (others?|other clips?)\b/i, "argues for its own choice"],
  [/\b(new|updated|real|actual|hidden|secret|following) instructions?\b|\binstructions? (are|is|follow)\b/i, "gives instructions"],
  [/\b(you are|you're|act as|pretend to be|roleplay)\b.{0,20}\b(an?|the|now)\b/i, "addresses the reader as a model"],
  // (who made it may say it is an AI agent: provenance.intake.by is the disclosure the intake asks for)
  [/\b(as an? (ai|assistant|agent|llm|language model))\b/i, "speaks to a model", ["provenance.intake.by"]],
  [/\b(system|developer) (prompt|message)\b/i, "speaks to a model"],
  [/(^|[.!?]\P{L}*)(assistant|system|user|tool|human)\s*:/iu, "imitates a chat turn"],
  [/<\/?(system|assistant|user|tool|instructions?|script|iframe|im_start|im_end)\b|\[\/?INST\]|<\|[a-z_]+\|>|<<SYS>>|^#{1,6}\s/im, "carries a model's control markup"],
  [/\b(curl|wget|sudo|rm -rf|npm|npx|pip|bash|powershell|chmod|eval)\b|\brun (this|the|that|these|a) (command|script)s?\b|`[^`]+`|\$\(/i, "asks for a command to be run"],
  [/\b(do not|don't|never|must not)\s+(tell|mention|reveal|report|flag|show|check|review)\b/i, "asks the reader to hide something"],
  [/\b(approve|adopt|merge|accept|trust|whitelist|allowlist)\s+(this|it|me|the clip)\b/i, "argues for its own adoption"],
  [/(^|[.!?]\s+)(important|attention|warning|note to (the )?(ai|agent|model|reviewer|assistant))\s*[:!]/i, "shouts at the reader"],
  [/\b(api[_ -]?key|access token|password|secret key|credentials?)\b/i, "asks about credentials"],
  [/https?:\/\/|\bwww\.|\b[a-z0-9-]+\.(com|net|org|io|ai|dev|xyz|ru|cn)\b/i, "links elsewhere", ["provenance.credit"]],
];
/** Characters a reader can't see: zero-width and bidirectional controls, Unicode tags (ASCII smuggling), other
 *  controls. */
const HIDDEN = /[\u{ad}\u{61c}\u{180e}\u{200b}-\u{200f}\u{202a}-\u{202e}\u{2060}-\u{2064}\u{2066}-\u{206f}\u{feff}\u{e0000}-\u{e007f}]|\p{Cc}/u;

/** A key a path names as it is: a field's name. Any other key (a clip's id, or text) is `*`, so a path quotes none. */
const KEY = /^[A-Za-z_][A-Za-z0-9_]{0,31}$/;

/** Every string in a clip but its keys, with its path (array indexes as [], a key that isn't a field's name as *). */
function strings(v: unknown, path: string, out: [string, string][] = []): [string, string][] {
  if (typeof v === "string") out.push([path, v]);
  else if (Array.isArray(v)) for (const x of v) strings(x, `${path}[]`, out);
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) if (!(path === "" && k === "keys")) strings(x, `${path ? `${path}.` : ""}${KEY.test(k) ? k : "*"}`, out);
  return out;
}

/** A field holding characters a reader can't see, named by its path. */
const hidden = (path: string) => `${path} holds characters a reader can't see (zero-width, bidirectional or control characters): write it in plain text`;
/** What in one field's words is aimed at a model or an agent, named by its path. */
const aimed = (path: string, s: string) => AIMED.filter(([re, , not]) => !not?.includes(path) && re.test(s)).map(([, what]) => `${path} ${what}, which models read in catalog lines: describe only the motion`);

/** What in a clip's text reads as aimed at a model or an agent, or hides what it says: each field's problem, named by
 *  its path and never quoted (submission text is data). A field that holds no prose (KINDS) is held to its shape;
 *  every other is prose, taken only where PLAIN says, and read for words aimed at a reader. Empty for a clip whose
 *  text only describes a motion. */
export function textProblems(clip: Clip): string[] {
  const out: string[] = [];
  for (const [path, s] of strings(clip, "")) {
    if (HIDDEN.test(s)) out.push(hidden(path));
    if (OWNER.has(path)) continue;
    const kind = kindOf(path);
    if (kind) {
      if (!kind[0].test(s)) out.push(`${path} isn't ${kind[1]}: the field holds no prose, so write only the value it takes`);
      continue;
    }
    const max = PLAIN[path];
    if (max === undefined) out.push(`${path} is text the intake doesn't take: describe the motion in desc, and leave other fields out`);
    else if (s.length > max) out.push(`${path} is ${s.length} characters, past the ${max} it may take: say what the body does in a few plain words`);
    out.push(...aimed(path, s));
  }
  return [...new Set(out)];
}

/** The same reading of one string outside a clip (a catalog row's column, say): what in it reads as aimed at a model
 *  or an agent, or hides what it says, named by `path` and never quoted. Empty for words that only describe a
 *  motion. */
export function proseProblems(path: string, s: string): string[] {
  return [...new Set([...(HIDDEN.test(s) ? [hidden(path)] : []), ...aimed(path, s)])];
}

/** The library clips a clip derives from (the clip it improves, its orig, a recipe's inputs), each with its tier and
 *  license; problems for a library id that isn't there. Ids of sets the library hasn't are the contributor's own. */
export function lineage(clip: Clip, lib: Library, improves: string | null): { derived: Derived[]; problems: string[] } {
  const inputs = Object.keys((clip.provenance as { recipe?: { inputs?: object } }).recipe?.inputs ?? {}), sets = new Set(lib.sets().map((s) => s.set));
  const derived: Derived[] = [], problems: string[] = [];
  for (const [field, id] of [["--improves", improves], ["provenance.orig", clip.provenance.orig], ...inputs.map((i) => ["provenance.recipe.inputs", i])] as [string, unknown][]) {
    if (typeof id !== "string" || !sets.has(id.split("/")[0]!) || derived.some((d) => d.id === id)) continue;
    try {
      const got = lib.clip(id);
      derived.push({ id: got.clip.id, tier: got.tier, license: got.clip.provenance.license, credit: got.clip.provenance.credit ?? null });
    } catch (err) {
      problems.push(`${field} names ${CLIP_ID.test(id) ? id : "a clip"}, which the library hasn't (${err instanceof LibraryError ? err.code : "unreadable"}): name a library clip as SET/Clip`);
    }
  }
  return { derived, problems };
}

/** A license claim as a reason may quote it: an SPDX expression, else what it isn't (submission text is data). */
const claimed = (claim: string) => (SPDX.test(claim) ? JSON.stringify(claim) : "(no SPDX license expression)");

/** The license rule (D10, §5.9): CC0 (a dedication), unless the clip derives from CC BY or CMU clips and keeps their
 *  license and their credit (each one's provenance.credit within its own); anything else is bounced. Gives the tier the
 *  clip joins, or the problem. */
export function licenseRule(clip: Clip, derived: readonly Derived[]): { tier: "cc0" | "cc-by" | "cmu" | null; problem: string | null } {
  const claim = clip.provenance.license, kept = [...new Set(derived.filter((d) => d.tier !== "cc0").map((d) => d.tier))];
  if (kept.length > 1) return { tier: null, problem: `it derives from clips of the ${kept.join(" and ")} tiers, which no intake set holds together: make it from one tier's clips` };
  if (!kept.length) return claim === "CC0-1.0" ? { tier: "cc0", problem: null } : { tier: null, problem: `provenance.license ${claimed(claim)} isn't on the intake's allowlist: dedicate it to the public domain ("CC0-1.0"), or derive it from a CC BY or CMU library clip (provenance.orig or --improves) and keep that clip's license` };
  const tier = kept[0] as "cc-by" | "cmu", from = derived.filter((d) => d.tier === tier), owed = [...new Set(from.map((d) => d.license))];
  if (claim === "CC0-1.0" || !owed.every((l) => claim.split(" AND ").includes(l))) return { tier: null, problem: `it derives from ${from.map((d) => d.id).join(", ")} (${tier}), so it keeps ${owed.join(" AND ")}: set provenance.license to it, with the clip's credit` };
  if (tierOf(claim.split(" AND ").find((l) => l !== "CC0-1.0") ?? claim) !== tier) return { tier: null, problem: `provenance.license ${claimed(claim)} doesn't fit the ${tier} tier it derives from: use ${owed.join(" AND ")}` };
  const credit = clip.provenance.credit ?? "", unsaid = from.filter((d) => d.credit && !credit.includes(d.credit));
  if (unsaid.length) return { tier: null, problem: `it derives from ${unsaid.map((d) => d.id).join(", ")} (${tier}), whose license asks for its credit: keep each one's provenance.credit, word for word, in this clip's (add your own after it)` };
  return { tier, problem: null };
}

/** The source-terms rule (§5.9, O5, WP-9.2): a clip that records the motion source that made it (provenance.source)
 *  enters the queue only when `allowlisted` (packages/tools/src/sources/deliver.ts) admits it: the source's terms on
 *  the allowlist, the terms it served the clip under the ones it states (D119), and the claim one they allow. Null for
 *  a clip with no source record, or one it admits. */
export function sourceProblem(clip: Clip): string | null {
  if ((clip.provenance as { source?: unknown }).source === undefined || allowlisted(clip).ok) return null;
  return "provenance.source records a motion source whose terms aren't on the allowlist (CC0-1.0, or a library clip's tier kept by what derives from it), terms it served that differ from those it states, a license claim its terms don't allow, or no whole record: such a source's clips stay in library/local/ (O5), and sources.allowlisted says why";
}

/** The provenance a submission must give (§5.9, DOCTRINE principle 10): a method whose IPTC type it names; the tool and
 *  version that wrote it; the model and the prompt's SHA-256 when a model was used; a training-data manifest for a
 *  generator (a learned motion model; procedural code isn't one), whatever the clip is to the library; who or what
 *  made it; the clip it improves as it is now; and no review, which only the owner gives: a library clip's review holds
 *  for the motion it was made on, and a clip added outside the intake carries none. */
export function provenanceProblems(i: GateInput): string[] {
  const p = i.clip.provenance, out: string[] = [], intake = intakeOf(i.clip), model = p.producer?.model, r = i.clip.review;
  if (p.method && p.ai && format.IPTC[p.method] !== p.ai) out.push(`provenance.ai is ${p.ai}, but a ${p.method} clip is ${format.IPTC[p.method]} (IPTC's digital source type for its method)`);
  if (!p.producer?.tool?.trim() || !p.producer?.version?.trim()) out.push("provenance.producer names the tool that wrote it and its version: { tool, version }");
  if (i.as === "submission" && r) out.push("it carries a review: only the owner reviews a clip, at adoption; leave review out");
  else if (r && i.as === "library" && i.added) out.push("a clip added outside the intake carries a review: the owner reviews a library clip once it is in (m3a review); leave review out");
  else if (r && r.motion !== motionHash(i.clip)) out.push("its review was made on another motion than its own (review.motion isn't its motion hash): a review holds only for the motion it was made on, so leave it out and the owner reviews it again");
  if (i.kind === "recipe") return out; // the compiler wrote its provenance: its steps and inputs say how it was made
  if (i.as !== "library" && (!intake || typeof intake.by !== "string" || !intake.by.trim())) out.push("provenance.intake.by is missing: say who or what made it (a person, or the agent and the human behind it), with --by");
  if (p.method === "generated" && (typeof model !== "string" || !model.trim())) out.push("a generated clip names its model and version in provenance.producer.model");
  if (i.as !== "library" && typeof model === "string" && model.trim() && !(typeof intake?.prompt === "string" && HEX64.test(intake.prompt))) out.push("a model made it, so provenance.intake.prompt is the SHA-256 of its prompt: give the prompt with --prompt (only its hash is sent)");
  if (p.method === "generated") {
    const m = intake?.manifest;
    if (!m || typeof m.url !== "string" || !/^https:\/\/\S+$/.test(m.url) || !(typeof m.sha256 === "string" && HEX64.test(m.sha256))) out.push("a generator (a learned motion model) needs its training-data manifest: --manifest <https URL>#sha256=<its SHA-256> (procedural code is no generator: its method is procedural)");
  }
  if (i.base && i.as === "submission") {
    const was = intake?.improves;
    if (!was || was.id !== i.base.id || !(typeof was.sha256 === "string" && HEX64.test(was.sha256))) out.push(`it improves ${i.base.id}: provenance.intake.improves records that clip's id and its file's SHA-256 (submit with --improves)`);
    else if (was.sha256 !== i.base.sha256) out.push(`${i.base.id} changed since this improvement was made (made on ${was.sha256.slice(0, 12)}, it is ${i.base.sha256.slice(0, 12)} now): make it again from the current clip`);
  }
  return out;
}

/** The gates that need no rig and no store (schema, budgets, provenance, license, text, lint, sensors), each run (the
 *  later ones only on a clip that validates); dedup and the retarget are the checker's. */
export function clipGates(i: GateInput): Gate[] {
  const c = i.clip, gate = (g: GateName, why: string[]): Gate => ({ gate: g, ok: why.length === 0, why: why.map(unquoted) });
  const v = validate(c, { mode: "lint" }), schema = v.errors.map((e) => validation.formatIssue(e).replace(/\s*\n\s*/g, "; "));
  if (!i.rest && v.ok) schema.push(`restSrc ${KINDS.restSrc![0].test(String(c.restSrc)) ? JSON.stringify(c.restSrc) : "(no source key)"} is no library source's rest: make it on a library rest (each set's _set.json lists its sources)`);
  const out = [gate("schema", schema)];
  if (schema.length) return out;
  const R = i.rest!, budgets: string[] = [], bytes = new TextEncoder().encode(serialize(c)).length, row = catalogRow(c, i.tokens), n = (i.tokens ?? ((t: string) => Math.ceil(t.length / 2)))(row);
  if (bytes > MAX_BYTES) budgets.push(`the clip is ${bytes} bytes, over the ${MAX_BYTES} a submission takes: split it (spec/MOTION.md §8)`);
  if (n > ROW_BUDGET) budgets.push(`its catalog row is ${n} tokens, past ${ROW_BUDGET} even with its description cut: shorten its tags or name`);
  try {
    boundHolds({ ...c, contacts: c.contacts ?? measureClipFacts(c, R).contacts }, "it");
  } catch (err) {
    budgets.push((err as Error).message);
  }
  out.push(gate("budgets", budgets), gate("provenance", provenanceProblems(i)), gate("license", [licenseRule(c, i.derived).problem, sourceProblem(c)].filter((x): x is string => x !== null)), gate("text", textProblems(c)));
  // an improvement is held to the clip it improves: no tag conflict or failing metric that clip hasn't (it may keep
  // what it doesn't fix)
  // (a speed its source gave is a library clip's own fact; a submission's claim to one is measured instead)
  const had = i.base ? tagConflicts(i.base.clip, measureClipFacts(i.base.clip, i.base.rest, capturedSpeed(i.base.clip)).facts, i.base.rest).map((t) => t.tag) : [];
  const tags = tagConflicts(c, measureClipFacts(c, R, i.as === "submission" ? undefined : capturedSpeed(c)).facts, R).filter((t) => !had.includes(t.tag) && !i.acceptedTags?.includes(t.tag)).map((t) => `tag ${t.tag}: ${t.message}`);
  const warned = v.warnings.filter((w) => !i.accepted?.some((a) => a.code === w.code && a.at === `${w.key !== undefined ? `key ${w.key} (t ${w.t}) ` : ""}${w.field ?? ""}${w.index !== undefined ? `[${w.index}]` : ""}`));
  out.push(gate("lint", [...warned.map((w) => validation.formatIssue(w).replace(/\s*\n\s*/g, "; ")), ...tags, ...(i.as === "submission" ? moves(c, R) : [])]));
  // the failing metrics kept: the clip it improves or replaces had them, library/baselines/qa.json keeps them by hand,
  // or (a changed library clip's) its writers' recorded reason does; a submission's or an added clip's own claim, never
  const was = new Set<string>([...(i.base ? metrics(i.base.clip, i.base.rest).findings.filter((f) => f.level === "fail").map((f) => f.metric) : []), ...(i.qa?.byHand ?? [])]);
  const baselined = i.qa?.recorded === true && c.quality?.qa === "baselined" && Boolean(c.quality.baseline), fails = metrics(c, R).findings.filter((f) => f.level === "fail" && !was.has(f.metric));
  out.push(gate("sensors", fails.length && !baselined ? [`the sensors fail it${i.base ? ` where ${i.base.id} passes` : ""}: ${fails.slice(0, 3).map((f) => `${f.metric}: ${f.message}`).join("; ")} (m3a lint names the repairs, m3a fix applies them)`] : []));
  return out;
}

/** The most characters a bounce's reason takes (the hosted table holds 2,000): it says what is wrong and how to fix it,
 *  never what the submission says. */
export const REASON_CHARS = 500;

/** The tags whose clip stays where it stands, and how far it may go: a contribution tagged so that `describe` reads a
 *  walk or a run in, or that travels a quarter of its hip height or more (a loop's cycle), is mis-tagged (D114; B8's
 *  grader holds an emote to the same, the library's emotes travel 0.02 at most). */
export const STAYS: readonly string[] = ["emote", "idle"];
const STAYS_WITHIN = 0.25;
/** What the lint gate says of a submission tagged one of STAYS that doesn't stay: one line, or none. */
function moves(c: Clip, R: Rest): string[] {
  const tag = STAYS.find((t) => c.tags.includes(t));
  if (!tag) return [];
  const d = describe(c, R), gait = d.phases.find((p) => p.name === "walk" || p.name === "run"), far = Math.hypot(d.travel[0], d.travel[1]);
  if (!gait && far < STAYS_WITHIN) return [];
  const how = gait ? `it ${gait.name}s from ${gait.t0.toFixed(2)} s as describe reads it` : `it travels ${far.toFixed(2)} of its hip height${c.loop ? " a cycle" : ""}`;
  return [`tag ${tag}: ${how}: an ${tag} stays where it stands; keep it in place, or tag it as the motion it is`];
}

/** A problem as a reason may say it: each quoted string that could be prose (a space in it, or past 64 characters)
 *  elided, as a validator's message may quote a field's value (submission text is data). */
export const unquoted = (s: string): string => s.replace(/"(?:[^"\\\n]|\\.)*"/g, (q) => (q.length > 66 || /\s/.test(q) ? '"…"' : q));

/** A bounce's reason from the gates: the first failed gate's first problem, and how many more there are, within
 *  REASON_CHARS. */
export function bounceReason(gates: readonly Gate[]): string | null {
  const bad = gates.filter((g) => !g.ok).sort((a, b) => GATES.indexOf(a.gate) - GATES.indexOf(b.gate));
  if (!bad.length) return null;
  const all = bad.reduce((a, g) => a + g.why.length, 0), more = all > 1 ? ` (and ${count(all - 1, "more problem")}: ${bad.map((g) => g.gate).join(", ")})` : "";
  return `${bad[0]!.gate}: ${cut(unquoted(bad[0]!.why[0] ?? "it failed"), REASON_CHARS - bad[0]!.gate.length - 2 - more.length)}${more}`;
}

/** A submission's clip: a clip's text parsed, or a recipe compiled on `lib` (every shipped tier); refused (E_INPUT)
 *  with what is wrong when it is neither. */
export function clipOf(kind: Kind, text: string, lib: Library): Clip {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new IntakeError("E_INPUT", "its text is no JSON: a clip's or a recipe's JSON");
  }
  if (kind === "clip") return data as Clip;
  try {
    return recipes.compile(data as recipes.Recipe, lib.resolver()).clip;
  } catch (err) {
    const first = err instanceof recipes.RecipeError ? recipes.formatRecipeIssue(err.issues[0]!) : (err as Error).message;
    throw new IntakeError("E_INPUT", `the recipe doesn't compile: ${cut(first.replace(/\s*\n\s*/g, "; "), 200)}`);
  }
}

/** The gates' input for a submission's clip on `lib`: its rest, the clip it improves now, and its lineage. */
export function gateInput(clip: Clip, kind: Kind, improves: string | null, lib: LibraryAccess, tokens?: Tokens): GateInput & { lineage: string[] } {
  const rest = validate(clip, { mode: "read" }).ok ? (restFor(lib, clip)?.rest ?? null) : null;
  let base: GateInput["base"] = null;
  if (improves) {
    const got = lib.library.clip(improves), [set, name] = got.clip.id.split("/") as [string, string];
    base = { id: got.clip.id, sha256: contentHash(lib.source.read(set, `${name}.json`)), clip: got.clip, rest: got.rest };
  }
  const l = validate(clip, { mode: "read" }).ok ? lineage(clip, lib.library, improves) : { derived: [], problems: [] };
  return { clip, rest, kind, base, derived: l.derived, as: "submission", ...(tokens ? { tokens } : {}), lineage: l.problems };
}

/** What `library` runs on: the intake store as this surface's contributor, and the clock its days are counted by. */
export interface Contributor {
  store: IntakeStore;
  today(): string;
}

/** `library`'s arguments. */
type Args = { do?: "submit" | "status"; on?: string; improves?: string; by?: string; prompt?: string; manifest?: string };

const row = (s: Submission) => ({ id: s.id, ref: `${s.id}@${s.content.slice(0, 12)}`, kind: s.kind, state: s.state, reason: s.reason, improves: s.improves, date: s.date });
const line = (s: Submission) => `${s.id}@${s.content.slice(0, 12)} ${s.kind}${s.improves ? ` improving ${s.improves}` : ""}, ${s.date}: ${s.state}${s.reason ? `: ${s.reason}` : ""}`;

/**
 * `library`, the intake's door (do submit | status), on the contributor `open` gives for a call (the surface's: the
 * Node entry's local store or contributor key). One tool, as review is, so `m3a library submit <clip>` and
 * `m3a library status [<id>]` read as the plan writes them.
 */
export function libraryTool(open: (ctx: ToolContext) => Contributor): Tool {
  return defineTool<Args, unknown>({
    name: "library",
    description: "Send a clip or recipe to the intake queue, or list yours.",
    params: {
      type: "object",
      properties: {
        do: { type: "string", enum: ["status", "submit"] },
        on: { type: "string", description: "clip, recipe or submission id" },
        improves: { type: "string", description: "SET/Clip" },
        by: { type: "string", description: "who or what made it" },
        prompt: { type: "string", description: "model's prompt, hashed" },
        manifest: { type: "string", description: "url#sha256=…" },
      },
    },
    output: output({ do: "string", store: "string", contributor: "string?", submissions: "array", gates: "array", sent: "boolean" }),
    positionals: ["do", "on"],
    writes: true,
    examples: [{ args: {} }],
    async run(a, ctx) {
      try {
        return await (a.do === "submit" ? submit(a, ctx, open(ctx)) : status(a, open(ctx)));
      } catch (err) {
        // the store's and the library's refusals in their own words (E_RATE, E_KEY, E_NO_CLIP ...), not as a bug
        if (err instanceof IntakeError) throw new ToolError(err.code, err.message, err.code === "E_INPUT" || err.code === "E_SIZE");
        if (err instanceof LibraryError) throw new ToolError(err.code, err.message.replace(/^library: /, ""), err.code !== "E_TAMPERED");
        throw err;
      }
    },
  });
}

/** `library status [<id>]`: the contributor's submissions, newest state and reason each; one with its gates. */
async function status(a: Args, c: Contributor) {
  for (const k of ["improves", "by", "prompt", "manifest"] as const) if (a[k] !== undefined) throw new ToolError("E_ARGS", `status takes no ${k}`, true);
  const mine = a.on ? [await c.store.get(a.on)].filter((s): s is Submission => s !== null) : await c.store.list();
  if (a.on && !mine.length) throw new ToolError("E_NO_SUBMISSION", `no submission ${JSON.stringify(cut(a.on, 40))} of yours in the ${c.store.backend} store`, true, { next: `${call("library", ["status"])} lists yours` });
  const who = mine[0]?.contributor ?? null, shown = capped(mine, 12), gates = a.on ? ((mine[0]!.report as { gates?: Gate[] } | null)?.gates ?? []) : [];
  // each state counted in the lifecycle's order (STATES), not as the ids happen to sort
  const states = STATES.filter((st) => mine.some((s) => s.state === st)).map((st) => `${mine.filter((s) => s.state === st).length} ${st}`).join(", ");
  return {
    verdict: `library status: ${a.on ? line(mine[0]!) : `${count(mine.length, "submission")}${states ? ` (${states})` : ""}`} (${c.store.backend} store)`,
    data: { do: "status", store: c.store.backend, contributor: who, submissions: shown.rows.map(row), gates, sent: false },
    lines: a.on ? gates.filter((g) => !g.ok).flatMap((g) => g.why.map((w) => `${g.gate}: ${w}`)) : [...shown.rows.map(line), ...more(shown.more, "submission")],
    findings: mine.some((s) => s.state === "bounced"),
    next: mine.some((s) => s.state === "bounced") ? `fix what a bounce's reason names, then ${call("library", ["submit", "<the fixed clip>"])} again` : mine.length ? "the checker moves each submission on; the owner decides what waits for review" : `${call("library", ["submit", "<a clip or recipe>"])} sends one`,
  };
}

/** A clip as submit reads it before it gives the clip the intake's provenance: an intake record it carries (an object)
 *  set aside, since submit fills that record in (who or what made it from --by when the record lacks it) and the
 *  schema gate reads it whole after; anything else as it is. */
function intakeAside(c: Clip): Clip {
  const p = (c as { provenance?: unknown } | null)?.provenance as (Clip["provenance"] & { intake?: unknown }) | undefined;
  if (!p || typeof p !== "object" || !p.intake || typeof p.intake !== "object" || Array.isArray(p.intake)) return c;
  const { intake: _, ...rest } = p;
  return { ...c, provenance: rest as Clip["provenance"] };
}

/** `library submit <clip | recipe>`: the clip read (its intake record set aside) and given the intake's provenance, who
 *  or what made it from --by or the record (refused with neither: the format requires it), the local gates run, and
 *  what passes sent. */
async function submit(a: Args, ctx: ToolContext, c: Contributor) {
  if (a.on === undefined) throw new ToolError("E_ARGS", "submit names the clip or recipe (on): a .json path or its JSON", true);
  const got = await fileOrJson(ctx, a.on, "the clip"), data = got.data as { steps?: unknown } | null, kind: Kind = data && typeof data === "object" && Array.isArray(data.steps) ? "recipe" : "clip";
  if (kind === "recipe") for (const k of ["improves", "by", "prompt", "manifest"] as const) if (a[k] !== undefined) throw new ToolError("E_ARGS", `a recipe's provenance is its steps, so it takes no ${k}: compile it (recipe.compile) and submit the clip`, true);
  const lib = ctx.library(SHIPPED), clip0 = clipOf(kind, got.text, lib.library), read = kind === "clip" ? intakeAside(clip0) : clip0, v = validate(read, { mode: "read" });
  if (!v.ok) throw new ToolError("E_CLIP", `the clip is not valid (${count(v.errors.length, "error")}): ${validation.formatIssue(v.errors[0]!).replace(/\s*\n\s*/g, "; ")}`, got.path === null);
  let clip = clip0, text = got.text;
  if (kind === "clip") {
    const pre = gateInput(read, kind, a.improves ?? null, lib), was = intakeOf(clip0) ?? {}, r = pre.rest ? metrics(read, pre.rest) : null;
    const m = a.manifest === undefined ? undefined : /^(https:\/\/\S+)#sha256=([0-9a-f]{64})$/.exec(a.manifest);
    if (a.manifest !== undefined && !m) throw new ToolError("E_ARGS", "manifest is the training-data manifest's https URL and its SHA-256: https://…#sha256=<64 hex digits>", true);
    const by = a.by ?? was.by;
    if (typeof by !== "string" || !by.trim()) throw new ToolError("E_ARGS", "say who or what made it with --by (a person, or the agent and the human behind it): the format requires provenance.intake.by", true);
    const intake: IntakeProvenance = {
      ...was, by,
      ...(a.prompt !== undefined ? { prompt: recipes.sha256(a.prompt) } : {}),
      ...(m ? { manifest: { url: m[1]!, sha256: m[2]! } } : {}),
      ...(pre.base ? { improves: { id: pre.base.id, sha256: pre.base.sha256 } } : {}),
      ...(r ? { report: { sensors: r.verdict, findings: r.findings.length, qaVersion: checks.QA_VERSION } } : {}),
    };
    clip = { ...clip0, provenance: { ...clip0.provenance, intake } as Clip["provenance"] };
    text = serialize(clip);
  }
  const input = gateInput(clip, kind, a.improves ?? null, lib), gates = clipGates(input);
  if (input.lineage.length) gates.find((g) => g.gate === "provenance")!.why.unshift(...input.lineage);
  for (const g of gates) g.ok = g.why.length === 0;
  const failed = bounceReason(gates), shown = { do: "submit", store: c.store.backend, gates };
  if (failed) {
    return { verdict: `library submit: not sent: ${failed}`, data: { ...shown, contributor: null, submissions: [], sent: false }, lines: gates.filter((g) => !g.ok).flatMap((g) => g.why.map((w) => `${g.gate}: ${w}`)), findings: true, next: "fix what each line names, then submit again: the checker runs these gates and more, and bounces what fails" };
  }
  // the local store counts a contributor's day here, as the hosted submit function does there; the same text again is
  // the same submission, not another (a store that lists no rows to this caller just sends it)
  const mine = await c.store.list().catch(() => [] as Submission[]), was = mine.find((s) => s.content === contentHash(text)), today = c.today();
  if (c.store.backend === "local" && !was && mine.filter((s) => s.date === today).length >= PER_DAY) throw new IntakeError("E_RATE", `${PER_DAY} submissions today, the most a contributor sends in a day; send again tomorrow`);
  const id = await c.store.submit({ kind, text, improves: a.improves ?? null });
  return {
    verdict: `library submit: ${id.id}@${id.content.slice(0, 12)} ${was ? `already sent (${id.state})` : "sent"} as ${cut(id.contributor, 40)}, ${kind}${id.improves ? ` improving ${id.improves}` : ""}${id.state === "submitted" ? "; the checker takes it next" : ""}`,
    data: { ...shown, contributor: id.contributor, submissions: [row(id)], sent: true },
    lines: [`${kind === "clip" ? `motion ${motionHash(clip).slice(0, 12)}` : "its motion as compiled"}, content ${id.content.slice(0, 12)}; ${gates.filter((g) => g.ok).length} local gates green (dedup and the retarget onto the reference rigs are the checker's)`],
    next: `${call("library", ["status", id.id])} shows its state and any bounce reason`,
  };
}
