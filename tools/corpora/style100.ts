// 100STYLE on demand (PLAN.md WP-5.6; carried from shardfall crates/pav_tools/src/mocap/mod.rs and anim_tools.rs, and
// its catalogs anim/catalogs/100style_*.json): one performer walking, running, sidestepping and idling in 100 styles
// (Ian Mason, Sebastian Starke and Taku Komura, 2022; CC BY 4.0), BVH takes at 60 frames a second in one 1.5 GB archive
// on Zenodo. Fetched into .cache/100style once, held to tools/corpora/100style.lock.json, and read take by take from
// the archive, never unpacked. The dataset's own lists give each style's instruction (Dataset_List.csv) and the frames
// each take performs its style between (Frame_Cuts.csv: a performer walks in and out at an ordinary pace). The extras
// are the gaits beyond the forward walks the library's STYLE100 holds: runs, backward walks and runs, sidesteps and
// sideways runs each way, and idles: six catalogs (library/catalogs/STYLE100_*.json, which WP-5.3 imports into the
// library), imported here as sets into .cache/corpora/100style.
import { importSet, IoError, readBvh, type Catalog, type Find, type Imported, type Pick } from "@m3a/io";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../run/cli.ts";
import { download, fileSha256 } from "./fetch.ts";
import { zipEntries, zipFile, zipRead, type ZipEntry } from "./zip.ts";

/** Where the archive goes (git-ignored), the pinned checksums, the catalogs and the sets imported here. */
export const STYLE100_CACHE = join(ROOT, ".cache/100style");
export const STYLE100_LOCK = join(ROOT, "tools/corpora/100style.lock.json");
export const STYLE100_CATALOGS = join(ROOT, "library/catalogs");
export const STYLE100_OUT = join(ROOT, ".cache/corpora/100style");

/** The archive a fetch is held to. */
export interface Style100Lock {
  about?: string;
  archive: { url: string; bytes: number; sha256: string; md5?: string };
}
/** The dataset's notes on its styles, and the frames each take performs its style between. */
export interface Styles {
  /** Style, the instruction the performer was given, whether it is stochastic (no one cycle holds all of it), notes. */
  about: { style: string; desc: string; stochastic: boolean; notes: string }[];
  /** A take (`Zombie_FW`) to its first and last frame of the style. */
  cuts: Map<string, [number, number]>;
}

/**
 * The archive into `dir`, held to its size and SHA-256 (checked once; a marker remembers it). A file that doesn't
 * match is not kept, and is a problem.
 */
export function fetch100style(dir: string, lock: Style100Lock, log: (l: string) => void = () => {}): { file: string; problems: string[] } {
  mkdirSync(dir, { recursive: true });
  const file = join(dir, "100STYLE.zip"), marker = join(dir, "verified.json");
  if (!existsSync(file)) {
    log(`downloading ${lock.archive.url} (${(lock.archive.bytes / 1e9).toFixed(2)} GB)`);
    download(lock.archive.url, `${file}.part`);
    renameSync(`${file}.part`, file);
  }
  const verified = existsSync(marker) && (JSON.parse(readFileSync(marker, "utf8")) as { sha256?: string }).sha256 === lock.archive.sha256;
  if (!verified) {
    const bytes = statSync(file).size, sum = fileSha256(file);
    if (bytes !== lock.archive.bytes || sum !== lock.archive.sha256) {
      rmSync(file);
      return { file, problems: [`${lock.archive.url}: ${bytes} bytes, SHA-256 ${sum}; the lock says ${lock.archive.bytes} bytes, ${lock.archive.sha256}. Not kept`] };
    }
    writeFileSync(marker, `${JSON.stringify({ archive: lock.archive.url, sha256: sum })}\n`);
  }
  return { file, problems: [] };
}

/** An archive read entry by entry, by name. */
export class Archive {
  readonly entries: Map<string, ZipEntry>;
  readonly #z: ReturnType<typeof zipFile>;
  constructor(file: string) {
    this.#z = zipFile(file);
    this.entries = new Map(zipEntries(this.#z.read, this.#z.size).map((e) => [e.name, e]));
  }
  /** An entry's text (Latin-1, as the takes are ASCII), or null when the archive lacks it. */
  text(name: string): string | null {
    const e = this.entries.get(name);
    return e ? zipRead(this.#z.read, e).toString("latin1") : null;
  }
  close(): void {
    this.#z.close();
  }
}

/** One line of a CSV file (quoted fields allowed), each field trimmed. */
export function csvLine(l: string): string[] {
  const out: string[] = [];
  let cur = "", quoted = false;
  for (let i = 0; i < l.length; i++) {
    const c = l[i]!;
    if (c === '"' && quoted && l[i + 1] === '"') {
      cur += '"';
      i++;
    } else if (c === '"') quoted = !quoted;
    else if (c === "," && !quoted) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((f) => f.trim());
}

/** The dataset's lists: Dataset_List.csv (Style Name, Description, Stochastic, Symmetric, Notes) and Frame_Cuts.csv
 *  (a style a row; a GAIT_START and GAIT_STOP column a gait, in frames). */
export function readStyles(list: string, cuts: string): Styles {
  const rows = (t: string) => t.split(/\r?\n/).filter((l) => l.trim()).map(csvLine);
  const st: Styles = { about: [], cuts: new Map() };
  for (const r of rows(list).slice(1)) st.about.push({ style: r[0] ?? "", desc: r[1] ?? "", stochastic: (r[2] ?? "").toLowerCase() === "yes", notes: r[4] ?? "" });
  const [head = [], ...rest] = rows(cuts);
  for (const r of rest)
    head.forEach((col, i) => {
      if (!col.endsWith("_START")) return;
      const gait = col.slice(0, -"_START".length), stop = head.indexOf(`${gait}_STOP`), a = Number(r[i]), b = Number(r[stop]);
      if (r[i] !== "" && stop >= 0 && r[stop] !== "" && Number.isFinite(a) && Number.isFinite(b) && r[0]) st.cuts.set(`${r[0]}_${gait}`, [a, b]);
    });
  return st;
}

/** How a 100STYLE loop with no way given finds its stretch: an idle (`_ID`) its still stretch, a backward gait (`_BW`,
 *  `_BR`) its longest pass going back, a turn (`_TR…`) none, any other gait its longest straight run. */
export function style100Find(take: string, loop: boolean): Find | undefined {
  if (!loop) return undefined;
  const gait = take.slice(take.lastIndexOf("_") + 1);
  return gait === "ID" ? "still" : gait === "BW" || gait === "BR" ? "back" : gait.startsWith("TR") ? undefined : "straight";
}

/**
 * A catalog's picks (`[take, from, to, shortest cycle, way]`) as the cutter takes them: looping when tagged `loop`; with
 * no stretch given, the frames the dataset marks as the style (Frame_Cuts.csv, 60 frames a second); the way to find
 * (`whole`: the stretch is the loop), else as `style100Find` says; an idle's shortest cycle 2.5 s.
 */
export function picks100(cat: Catalog, styles: Styles): Pick[] {
  const pick = (cat.$pick ?? {}) as unknown as Record<string, [string, number | null, number | null, number | null, string?]>;
  return Object.entries(pick).map(([name, [take, from0, to0, minCycle, way]]) => {
    const tags = (Array.isArray(cat[name]) ? (cat[name] as [string, string])[0] : "").split(" "), loop = tags.includes("loop");
    const cut = from0 === null && to0 === null ? styles.cuts.get(take) : undefined;
    const [from, to] = cut ? [cut[0] / 60, cut[1] / 60] : [from0, to0];
    const find = way ? (way as Find) : style100Find(take, loop), min = minCycle ?? (loop && take.endsWith("_ID") ? 2.5 : null);
    return { name, take, ...(from !== null ? { from } : {}), ...(to !== null ? { to } : {}), ...(min !== null ? { minCycle: min } : {}), loop, ...(find ? { find } : {}) };
  });
}

/** The archive's path of a take (`Zombie_FW` is 100STYLE/Zombie/Zombie_FW.bvh). */
export const takePath = (take: string) => `100STYLE/${take.slice(0, take.lastIndexOf("_"))}/${take}.bvh`;

/** The extras' catalogs: their names (`run`, `side`, ...), the set each makes and its title. */
export const EXTRAS: Readonly<Record<string, string>> = { run: "100STYLE runs", siderun: "100STYLE sideways runs", idle: "100STYLE idles", backrun: "100STYLE backward runs", side: "100STYLE sidesteps", back: "100STYLE backward walks" };
const CREDIT = "100STYLE by Ian Mason, Sebastian Starke and Taku Komura, CC BY 4.0.";

/**
 * One catalog imported as a set (format 1): its picks cut from the archive's takes (a pick that can't be cut left out,
 * its reason in the log), fitted within `tol` mm, every clip on the rest of the takes' skeleton.
 */
export function import100(kind: string, archive: Archive, styles: Styles, opts: { tol?: number; catalog?: Catalog } = {}): Imported & { log: string[] } {
  const cat = opts.catalog ?? (JSON.parse(readFileSync(join(STYLE100_CATALOGS, `STYLE100_${kind.toUpperCase()}.json`), "utf8")) as Catalog), picks = picks100(cat, styles);
  const lib = readBvh(
    (take) => {
      const text = archive.text(takePath(take));
      if (text === null) throw new IoError("E_MISSING", `100STYLE has no take ${take} (a style's takes are BR BW FR FW ID SR SW TR1 TR2 TR3)`);
      return text;
    },
    picks,
    30,
    { lenient: true },
  );
  const out = importSet([{ id: "100STYLE", file: "100STYLE.bvh", rig: lib.rig, clips: lib.clips, rest: "_rest" }], cat, { name: `STYLE100_${kind.toUpperCase()}`, title: EXTRAS[kind] ?? kind, credit: CREDIT, tol: opts.tol ?? 30 });
  // the catalog's skips name styles it never picks: on record with their reasons, not missing clips
  const picked = new Set(picks.map((p) => p.name));
  out.report.warnings = out.report.warnings.filter((w) => !/^\$skip names (\S+), which no library has$/.test(w) || picked.has(/^\$skip names (\S+),/.exec(w)![1]!));
  for (const [name, why] of Object.entries(cat.$skip ?? {})) if (!picked.has(name) && !out.report.skipped.some((s) => s.name === name)) out.report.skipped.push({ name, why });
  return { ...out, log: lib.log };
}
