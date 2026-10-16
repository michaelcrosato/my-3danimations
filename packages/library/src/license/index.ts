// License compliance (PLAN.md WP-5.7): the library's sets, or what a game uses, checked against their terms. A set's
// sources each carry an SPDX id (or `LicenseRef-CMU-Mocap`) that fits its tier (D10), whose text is kept verbatim in
// `library/LICENSES/`, and a set that must be credited says how. A game manifest names its tiers (CC0 alone by default)
// and the clips it uses: each must come from a tier it opted into, `local` content never ships, and the credits it
// owes (CC BY, CMU) come out as a block it can show. Reads through the loader's source, so it runs anywhere.
import { TIERS, type LibrarySource, type Tier } from "../load/index.ts";

/** What a game uses: the tiers it opts into, the clips it plays (`SET/name`), and whether it ships. */
export interface GameManifest {
  game?: string;
  /** The tiers it opts into (CC0 alone by default, D10). */
  tiers?: Tier[];
  /** The clips it plays, by id; without them, every set of its tiers. */
  clips?: string[];
  /** Whether it ships (true by default): `local` content may be used on its own machine, never shipped. */
  ships?: boolean;
}
/** One problem: `fail` blocks, `warn` is an open question to answer. */
export interface LicenseFinding {
  level: "fail" | "warn";
  where: string;
  message: string;
}
/** A credit owed: a set, its license, its credit line, and how many of its clips are used. */
export interface Credit {
  set: string;
  title: string;
  tier: Tier;
  licenses: string[];
  credit: string;
  clips: number;
}
/** A check's outcome: its findings, the credits owed and the block a game shows. */
export interface LicenseReport {
  ok: boolean;
  findings: LicenseFinding[];
  credits: Credit[];
  block: string;
}

interface Source {
  license?: string;
  audit?: string;
}
interface SetManifest {
  set: string;
  title: string;
  tier: Tier;
  credit?: string;
  sources: Record<string, Source>;
}

/** An SPDX license id, or a `LicenseRef-` for terms SPDX doesn't list. */
const SPDX = /^(LicenseRef-[A-Za-z0-9.-]+|[A-Za-z0-9][A-Za-z0-9.+-]*)$/;
/** The licenses each tier may hold (D10): `local` holds whatever its source allows, since it never ships. */
const FITS: Readonly<Record<Tier, (id: string) => boolean>> = {
  cc0: (id) => id === "CC0-1.0",
  "cc-by": (id) => /^CC-BY-\d\.\d$/.test(id),
  cmu: (id) => id === "LicenseRef-CMU-Mocap",
  local: () => true,
};
/** The tiers whose clips must be credited where they are used. */
const CREDITED: readonly Tier[] = ["cc-by", "cmu"];

/** The tier a license fits by D10's rule, the one checkSets holds each set's sources to: CC0-1.0 cc0, CC-BY-x.y cc-by,
 *  LicenseRef-CMU-Mocap cmu, any other only local, which never ships. A composed clip's license joins its parts with
 *  " AND "; each part has its tier. */
export const tierOf = (license: string): Tier => (["cc0", "cc-by", "cmu"] as const).find((t) => FITS[t](license)) ?? "local";

/** Whether a tier's clips must be credited where they are used (cc-by and cmu, D10). */
export const credited = (tier: Tier): boolean => CREDITED.includes(tier);

const manifestOf = (src: LibrarySource, set: string) => JSON.parse(src.read(set, "_set.json")) as SetManifest;

/**
 * Checks sets (each one's sources against its tier, its license texts, its credit). `text(id)` gives a license's kept
 * text, or null when `library/LICENSES/<id>.txt` is missing.
 */
export function checkSets(src: LibrarySource, sets: readonly string[], text: (id: string) => string | null): LicenseReport {
  const findings: LicenseFinding[] = [], credits: Credit[] = [];
  for (const set of sets) {
    if (!src.sets().includes(set)) {
      findings.push({ level: "fail", where: set, message: `no set "${set}" in the library (sets: ${src.sets().join(", ")})` });
      continue;
    }
    const m = manifestOf(src, set), licenses = new Set<string>();
    if (!(TIERS as readonly string[]).includes(m.tier)) findings.push({ level: "fail", where: set, message: `tier "${m.tier}" isn't one of ${TIERS.join(", ")}` });
    for (const [id, s] of Object.entries(m.sources ?? {})) {
      const where = `${set} sources.${id}`;
      if (!s.license) {
        findings.push({ level: "fail", where, message: "no SPDX license id (license)" });
        continue;
      }
      if (!SPDX.test(s.license)) findings.push({ level: "fail", where, message: `"${s.license}" isn't an SPDX id (or a LicenseRef-)` });
      else if (FITS[m.tier] && !FITS[m.tier](s.license)) findings.push({ level: "fail", where, message: `${s.license} doesn't fit the ${m.tier} tier (D10): move the set, or the source` });
      if (text(s.license) === null) findings.push({ level: "fail", where, message: `${s.license}'s text isn't kept in library/LICENSES/${s.license}.txt` });
      if (s.audit) findings.push({ level: "warn", where, message: `an open license question: ${s.audit}` });
      licenses.add(s.license);
    }
    if (!Object.keys(m.sources ?? {}).length) findings.push({ level: "fail", where: set, message: "no sources, so no license" });
    if (CREDITED.includes(m.tier) && !m.credit?.trim()) findings.push({ level: "fail", where: set, message: `a ${m.tier} set must say how to credit it (credit)` });
    if (CREDITED.includes(m.tier)) credits.push({ set, title: m.title, tier: m.tier, licenses: [...licenses].sort(), credit: m.credit ?? "", clips: src.files(set).filter((f) => f.endsWith(".json") && !f.startsWith("_")).length });
  }
  return report(findings, credits);
}

/**
 * Checks what a game uses: each clip exists and comes from a tier the game opted into, nothing `local` ships, and the
 * sets its clips come from pass `checkSets`; credits only what it uses (every set of its tiers when it lists no clips).
 */
export function checkGame(src: LibrarySource, game: GameManifest, text: (id: string) => string | null): LicenseReport {
  const tiers = game.tiers ?? ["cc0"], ships = game.ships ?? true, findings: LicenseFinding[] = [], used = new Map<string, number>();
  for (const t of tiers) if (!(TIERS as readonly string[]).includes(t)) findings.push({ level: "fail", where: "tiers", message: `no tier "${t}"; the tiers are ${TIERS.join(", ")}` });
  if (game.clips) {
    for (const id of game.clips) {
      const [set, name] = id.split("/");
      if (!set || !name || !src.sets().includes(set) || !src.files(set).includes(`${name}.json`)) {
        findings.push({ level: "fail", where: id, message: `no clip "${id}" in the library` });
        continue;
      }
      const tier = manifestOf(src, set).tier;
      if (!tiers.includes(tier)) findings.push({ level: "fail", where: id, message: `${set} is a ${tier} set and this game opts into ${tiers.join(", ")}: opt in, or use a clip from those tiers` });
      used.set(set, (used.get(set) ?? 0) + 1);
    }
  } else for (const set of src.sets()) if (tiers.includes(manifestOf(src, set).tier)) used.set(set, src.files(set).filter((f) => f.endsWith(".json") && !f.startsWith("_")).length);
  for (const set of used.keys()) if (ships && manifestOf(src, set).tier === "local") findings.push({ level: "fail", where: set, message: "local content never ships (D10): drop it, or mark the manifest ships: false for a game that stays on this machine" });
  if (ships && tiers.includes("local")) findings.push({ level: "fail", where: "tiers", message: "a shipped game opts into local: local content never ships (D10)" });
  const sets = checkSets(src, [...used.keys()], text), credits = sets.credits.map((c) => ({ ...c, clips: used.get(c.set) ?? 0 }));
  return report([...findings, ...sets.findings], credits);
}

/** The credits block a game shows: each credited set, its license and its credit line; or that none is owed. */
export function creditsBlock(credits: readonly Credit[]): string {
  if (!credits.length) return "Motion: CC0 clips from the m3a library; no credit is owed.";
  return ["Motion credits:", ...credits.map((c) => `- ${c.title} (${c.licenses.join(", ")}): ${c.credit}`)].join("\n");
}

function report(findings: LicenseFinding[], credits: Credit[]): LicenseReport {
  return { ok: !findings.some((f) => f.level === "fail"), findings, credits, block: creditsBlock(credits) };
}
