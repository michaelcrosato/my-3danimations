// The sets WP-5.3 re-imports from their original sources (PLAN.md WP-5.3), each with format 2's new degrees of freedom
// (hands and fingers, spine curl, root yaw): which catalog drives it (library/catalogs/), where its sources come from
// and how they are read, its tier, its edition, and how each source's license and making read (tools/migrate/sets.ts's
// rules, shared), and the loops whose contacts a named reading of core's writes (D129). The sources are fetched into
// .cache/, each held to a lock (tools/import/sources.json and the corpora's locks), never committed. Quaternius' two
// libraries wait for their current editions (PLAN.md WP-5.3: the owner's call on the download,
// michaelcrosato/my-3danimations#10); until they come, their sets stay as migrated.
import type { clip as coreClip } from "@m3a/core";
import type { Catalog, LibraryIn } from "@m3a/io";
import { parseGlb, picksOf, readBvh, readCmu, readGltf } from "@m3a/io";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import { CMU_CACHE, fetchCmu, LEDGER, readLedger, readLock } from "../corpora/cmu.ts";
import { download, fileSha256 } from "../corpora/fetch.ts";
import { Archive, fetch100style, picks100, readStyles, STYLE100_CACHE, STYLE100_LOCK, takePath, type Style100Lock } from "../corpora/style100.ts";
import { CMU_NOTICE, type SourceRule } from "../migrate/sets.ts";
import { ROOT } from "../run/cli.ts";

/** The catalogs, one a set. */
export const CATALOGS = join(ROOT, "library/catalogs");
/** The sources the corpora don't fetch, by name: each file's URL and SHA-256. */
export const SOURCES = join(ROOT, "tools/import/sources.json");
const CACHE = join(ROOT, ".cache/sources");

/** A set to re-import. */
export interface ImportSpec {
  set: string;
  title: string;
  tier: "cc0" | "cc-by" | "cmu" | "local";
  /** What the sources are, edition and all: it goes in the set's manifest. */
  edition: string;
  credit: string;
  sources: (id: string) => SourceRule;
  /** Its catalog's file under library/catalogs/. */
  catalog: string;
  /** The libraries its catalog's clips come from, read from the fetched sources. */
  read(cat: Catalog): LibraryIn[];
  /** Per clip by slug, the reading of core's (`clip.CONTACT_READINGS`) its contacts are written by, labelled
   *  (@m3a/library's `withReading`, D129): each an in-place loop's, chosen by D108's bar and its captured speed
   *  (tools/facts/readings.ts) and adopted where the rate sweep, the judge and QA find it no worse. Every other clip's
   *  contacts are detected. */
  contacts?: Readonly<Record<string, coreClip.ContactReading>>;
}

/** The pinned sources (tools/import/sources.json): per source, its files' URLs and SHA-256s. */
export interface SourcesLock {
  about?: string;
  sources: Record<string, { edition: string; files: Record<string, { url: string; sha256: string }> }>;
}

/** A pinned source's files in .cache/sources/<name>/, fetched when missing and each held to its SHA-256. */
export function fetchSource(name: string, lock: SourcesLock = JSON.parse(readFileSync(SOURCES, "utf8")) as SourcesLock): string {
  const src = lock.sources[name];
  if (!src) throw new Error(`no source "${name}" in tools/import/sources.json`);
  const dir = join(CACHE, name);
  mkdirSync(dir, { recursive: true });
  for (const [file, { url, sha256 }] of Object.entries(src.files)) {
    const at = join(dir, file);
    if (!existsSync(at)) {
      download(url, `${at}.part`);
      renameSync(`${at}.part`, at);
    }
    const got = fileSha256(at);
    if (got !== sha256) {
      rmSync(at);
      throw new Error(`${url}: SHA-256 ${got}; tools/import/sources.json says ${sha256}. Not kept`);
    }
  }
  return dir;
}

const cmuRule = (): SourceRule => ({ method: "captured", license: "LicenseRef-CMU-Mocap", credit: "CMU Graphics Lab Motion Capture Database (mocap.cs.cmu.edu)", terms: CMU_NOTICE });
const m2mRule = (id: string): SourceRule => ({
  method: id === "M2M_MOCOPI" ? "captured" : "keyed",
  license: "CC0-1.0",
  terms: "CC0 1.0: mesh2motion-app's README (\"The art assets (3d models, rigs, animations) are all licensed under CC0\") and mesh2motion-assets' LICENSE (CC0 1.0 Universal), at the pinned commits; audited in WP-5.3 (D63)",
});
const style100Rule = (): SourceRule => ({ method: "captured", license: "CC-BY-4.0", credit: "100STYLE, Mason, Starke and Komura (CC BY 4.0)", terms: "CC BY 4.0" });

/** CMU's picks as one library a subject (its record from the catalog's `CMU`), each pick played over the stretch the
 *  ledger says it moves when it names only its take, every take stood on the ground (`floorEach`: a subject's takes
 *  can stand 12 cm apart). */
function readCmuSubjects(cat: Catalog): LibraryIn[] {
  const f = fetchCmu(CMU_CACHE, readLock());
  if (f.problems.length) throw new Error(`the CMU corpus: ${f.problems.join("; ")}`);
  const ledger = readLedger(readFileSync(LEDGER, "utf8")), picks = picksOf(cat, 120, ledger), bySubject = new Map<string, typeof picks>();
  for (const p of picks) bySubject.set(p.take.split("_")[0]!, [...(bySubject.get(p.take.split("_")[0]!) ?? []), p]);
  return [...bySubject].map(([s, ps]) => {
    const lib = readCmu(readFileSync(join(CMU_CACHE, `${s}.asf`), "utf8"), (t) => readFileSync(join(CMU_CACHE, `${t}.amc`), "utf8"), ps, 30, `${s}.asf`, { floorEach: true });
    return { id: `CMU_${s.padStart(2, "0")}`, file: `${s}.asf`, ...(ledger[ps[0]!.take]?.about ? { about: ledger[ps[0]!.take]!.about! } : {}), ...lib };
  });
}

/** 100STYLE's picks as one library, cut from the archive inside the frames the dataset marks as each style. */
function read100(cat: Catalog): LibraryIn[] {
  const lock = JSON.parse(readFileSync(STYLE100_LOCK, "utf8")) as Style100Lock, f = fetch100style(STYLE100_CACHE, lock);
  if (f.problems.length) throw new Error(`100STYLE: ${f.problems.join("; ")}`);
  const a = new Archive(f.file);
  try {
    const styles = readStyles(a.text("100STYLE/Dataset_List.csv")!, a.text("100STYLE/Frame_Cuts.csv")!);
    const lib = readBvh((t) => a.text(takePath(t)) ?? "", picks100(cat, styles), 30, { lenient: true });
    return [{ id: "100STYLE", file: "100STYLE.bvh", rig: lib.rig, clips: lib.clips, rest: "_rest" }];
  } finally {
    a.close();
  }
}

/** Mesh2Motion's three GLBs, each a library: base (Quaternius' clips, re-exported), add-on (hand-animated), mocap. */
function readM2m(): LibraryIn[] {
  const dir = fetchSource("mesh2motion");
  return [["M2M_QUATERNIUS", "human-base-animations.glb"], ["M2M_ANIMATED", "human-addon-animations.glb"], ["M2M_MOCOPI", "human-mocap-animations.glb"]].map(([id, file]) => ({ id: id!, file: file!, ...readGltf(parseGlb(readFileSync(join(dir, file!)), file)) }));
}

const style100Extra = (kind: string, title: string, what: string, contacts?: ImportSpec["contacts"]): ImportSpec => ({
  set: `STYLE100_${kind}`,
  title,
  tier: "cc-by",
  edition: `100STYLE (zenodo.org/records/8127870, the archive tools/corpora/100style.lock.json pins): ${what}, each cut at its best cycle inside the frames the dataset marks as the style, as shardfall's catalog picks them`,
  credit: "100STYLE by Ian Mason, Sebastian Starke and Taku Komura, CC BY 4.0.",
  sources: style100Rule,
  catalog: `STYLE100_${kind}.json`,
  read: read100,
  ...(contacts ? { contacts } : {}),
});

/** The sets re-imported, in the order they are written. */
export const IMPORTS: readonly ImportSpec[] = [
  {
    set: "MESH2MOTION",
    title: "Mesh2Motion",
    tier: "cc0",
    edition: "mesh2motion-app@653a969's human animations (base, add-on and mocap GLBs; tools/import/sources.json pins each), the same clips my-3d2dge@14a561c imported",
    credit: "Mesh2Motion's human animations (mesh2motion.org), CC0 1.0; some are Quaternius' Universal Animation Library clips as Mesh2Motion re-exported them.",
    sources: m2mRule,
    catalog: "MESH2MOTION.json",
    read: readM2m,
  },
  {
    set: "CMU_CURATED",
    title: "CMU motion capture, curated",
    tier: "cmu",
    edition: "144 picks from 43 subjects of the CMU Graphics Lab Motion Capture Database (library/catalogs/CMU_CURATED.json), the takes as tools/corpora/cmu.lock.json pins them",
    credit: "CMU Graphics Lab Motion Capture Database (mocap.cs.cmu.edu); created with funding from NSF EIA-0196217.",
    sources: cmuRule,
    catalog: "CMU_CURATED.json",
    read: readCmuSubjects,
    contacts: { Frankenstein_Walk_Loop: "sole-planted-quarter" },
  },
  {
    set: "STYLE100",
    title: "100STYLE walks",
    tier: "cc-by",
    edition: "100STYLE (zenodo.org/records/8127870, the archive tools/corpora/100style.lock.json pins): 95 forward walks, each cut at its best cycle inside the frames the dataset marks as the style",
    credit: "100STYLE by Ian Mason, Sebastian Starke and Taku Komura, CC BY 4.0.",
    sources: style100Rule,
    catalog: "STYLE100.json",
    read: read100,
    contacts: { Balance_Walk: "planted-quarter", Sweep_Walk: "planted-quarter", TwoFootJump_Walk: "lower-quarter" },
  },
  style100Extra("RUN", "100STYLE runs", "98 forward runs", { HandsInPockets_Run: "planted-half", Lunge_Run: "planted-quarter", Rocket_Run: "sole-planted-half", WildLegs_Run: "planted-quarter" }),
  style100Extra("BACK", "100STYLE backward walks", "98 backward walks", {
    DragRightLeg_WalkBack: "planted-quarter", LeanRight_WalkBack: "planted-quarter", Old_WalkBack: "planted-quarter", Robot_WalkBack: "planted-quarter",
    Rushed_WalkBack: "planted-half", StartStop_WalkBack: "planted-quarter",
  }),
  style100Extra("BACKRUN", "100STYLE backward runs", "98 backward runs", { DragLeftLeg_RunBack: "lower", Elated_RunBack: "lower-half", PendulumHands_RunBack: "lower", Rushed_RunBack: "planted-half", StartStop_RunBack: "planted-quarter" }),
  style100Extra("SIDE", "100STYLE sidesteps", "194 sidesteps, each way", {
    Balance_SideRight: "sole-planted-quarter", CrowdAvoidance_SideLeft: "planted-quarter", Flapping_SideRight: "planted-quarter", LeanBack_SideRight: "planted-quarter",
    LimpLeft_SideRight: "planted-quarter", LimpRight_SideLeft: "planted-quarter", Old_SideRight: "sole-planted-quarter", Quail_SideLeft: "sole-planted-quarter",
    Robot_SideLeft: "lower-quarter", Skip_SideRight: "planted-quarter", Strutting_SideLeft: "planted-quarter", TogetherStep_SideLeft: "planted-quarter",
    WalkingStickLeft_SideLeft: "sole-planted-quarter", WiggleHips_SideLeft: "lower-quarter", Zombie_SideLeft: "sole-planted-quarter",
  }),
  style100Extra("SIDERUN", "100STYLE sideways runs", "193 sideways runs, each way (one left out, its reason in `_import.json`)", {
    Akimbo_SideRunLeft: "planted-half", LawnMower_SideRunLeft: "planted-half", LimpRight_SideRunLeft: "sole-planted-half", Penguin_SideRunRight: "sole-planted",
    Proud_SideRunRight: "planted-half", RaisedLeftArm_SideRunLeft: "sole-planted-quarter", RaisedLeftArm_SideRunRight: "planted-half",
    Robot_SideRunRight: "planted-quarter", Rushed_SideRunLeft: "planted-half", Teapot_SideRunLeft: "planted-half", TwoFootJump_SideRunLeft: "planted-half",
  }),
  style100Extra("IDLE", "100STYLE idles", "98 idles, each the longest still stretch"),
];
