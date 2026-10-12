// The CMU Graphics Lab Motion Capture Database on demand (PLAN.md WP-5.6; carried from my-3d2dge tools/cmu.mjs, whose
// ledger shardfall keeps as anim/cmu/takes.tsv). About 2,500 captured takes by 100+ people, each subject a skeleton
// (NN.asf), each take a motion (NN_MM.amc) at 120 frames a second (a few at 60); its terms are CMU's notice
// (library/LICENSES/LicenseRef-CMU-Mocap.txt). Fetched into .cache/cmu, never committed: the site's index of takes, its
// archive (allasfamc.zip) and the takes the archive lacks (subject 144, added later), each checked against
// tools/corpora/cmu.lock.json. The survey converts every take with @m3a/io as an import would and measures it into the
// ledger, tools/corpora/cmu-takes.tsv: one line a take, its category, length, fit, the stretch where it moves, and
// which clips of CMU_CURATED use it, or a note. The import writes every take as a set a subject into .cache/corpora/cmu.
import { format, skeleton } from "@m3a/core";
import { IoError, readCmu, type Capture, type Pick } from "@m3a/io";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../run/cli.ts";
import { download, fileSha256 } from "./fetch.ts";
import { zipEntries, zipFile, zipRead } from "./zip.ts";

/** The site, named in each imported set's source (it serves plain http: its https certificate doesn't verify). */
export const SITE = "http://mocap.cs.cmu.edu";
/** Where takes go (git-ignored). */
export const CMU_CACHE = join(ROOT, ".cache/cmu");
/** The ledger (committed text) and the pinned checksums. */
export const LEDGER = join(ROOT, "tools/corpora/cmu-takes.tsv");
export const LOCK = join(ROOT, "tools/corpora/cmu.lock.json");
/** The library's CMU set, whose clips' takes fill the ledger's `used`. */
export const CURATED = join(ROOT, "library/sets/CMU_CURATED");

/** One take as the site lists it. */
export interface IndexRow {
  id: string;
  subject: number;
  /** The subject's line ("climb, swing, hang on playground equipment"). */
  about: string;
  desc: string;
  fps: number;
}
/** The checksums a fetch is held to. */
export interface CmuLock {
  about?: string;
  /** Where a take the archive lacks is fetched from: <site>/subjects/<subject>/<file>. */
  site: string;
  archive: { url: string; bytes: number; sha256: string };
  /** The index as written (index.tsv), from the site's list. */
  index: { url: string; takes: number; sha256: string };
  /** Each file the archive lacks, fetched alone: its name and SHA-256. */
  extra: Record<string, string>;
}
/** A ledger row: every column as its text. */
export type Row = Record<string, string>;

const sha256 = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
const byId = (a: string, b: string) => a.localeCompare(b, "en", { numeric: true });

/** The takes the site's full motion list describes, each under its subject's line (the page read as Latin-1). */
export function parseIndex(html: string): IndexRow[] {
  const rows: IndexRow[] = [], clean = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
  let about = "";
  for (const tr of html.split(/<TR/i)) {
    const subj = /Subject #(\d+)\s*\(([^)]*)\)/i.exec(tr);
    if (subj) {
      about = clean(subj[2]!);
      continue;
    }
    const amc = /\/subjects\/(\d+)\/(\d+_\d+)\.amc/i.exec(tr);
    if (!amc) continue;
    // the frame rate is the last number in the row (the trial's number comes first)
    const cells = [...tr.matchAll(/<TD[^>]*>(.*?)<\/TD>/gis)].map((m) => clean(m[1]!)), fps = cells.filter((c) => /^\d+$/.test(c)).pop();
    rows.push({ id: amc[2]!, subject: +amc[1]!, about, desc: cells[2] || "", fps: +(fps || "120") });
  }
  return rows;
}
/** The index as text (index.tsv), and back. */
export function indexText(rows: readonly IndexRow[]): string {
  return `id\tsubject\tabout\tdesc\tfps\n${rows.map((r) => [r.id, r.subject, r.about, r.desc, r.fps].join("\t")).join("\n")}\n`;
}
export function readIndex(text: string): IndexRow[] {
  return text.trim().split("\n").slice(1).map((l) => {
    const [id, subject, about, desc, fps] = l.split("\t");
    return { id: id!, subject: +subject!, about: about!, desc: desc!, fps: +fps! };
  });
}

/** The pinned checksums. */
export function readLock(file = LOCK): CmuLock {
  return JSON.parse(readFileSync(file, "utf8")) as CmuLock;
}

/** What a fetch did and what it refused. */
export interface Fetched {
  takes: number;
  unpacked: number;
  fetched: string[];
  problems: string[];
}
/**
 * Every take into `dir`: the index (from the site's list), the archive (downloaded, held to its size and SHA-256,
 * unpacked flat, each entry held to its CRC-32), then each take the index lists that the archive lacks, with its
 * subject's skeleton, held to its pinned SHA-256. What is already there is kept, so it resumes; the archive is deleted
 * once unpacked unless `keepZip`. A file that doesn't match is not kept, and is a problem.
 */
export function fetchCmu(dir: string, lock: CmuLock, { keepZip = false, log = (_: string) => {} } = {}): Fetched {
  mkdirSync(dir, { recursive: true });
  const problems: string[] = [], fetched: string[] = [], indexFile = join(dir, "index.tsv");
  if (!existsSync(indexFile)) {
    log(`indexing ${lock.index.url}`);
    const html = join(dir, "search.html.part");
    download(lock.index.url, html);
    const text = indexText(parseIndex(readFileSync(html).toString("latin1")));
    rmSync(html);
    if (sha256(text) !== lock.index.sha256) return { takes: 0, unpacked: 0, fetched, problems: [`the site's index (${readIndex(text).length} takes) isn't the one pinned: SHA-256 ${sha256(text)}, the lock says ${lock.index.sha256}`] };
    writeFileSync(indexFile, text);
  } else if (sha256(readFileSync(indexFile)) !== lock.index.sha256) problems.push(`${indexFile} isn't the index pinned: delete it to fetch it again`);
  const index = readIndex(readFileSync(indexFile, "utf8")), marker = join(dir, "unpacked.json");
  let unpacked = 0;
  const unpackedFrom = existsSync(marker) ? (JSON.parse(readFileSync(marker, "utf8")) as { sha256: string }).sha256 : null;
  if (unpackedFrom !== lock.archive.sha256) {
    const zip = join(dir, "allasfamc.zip");
    if (!existsSync(zip)) {
      log(`downloading ${lock.archive.url} (${(lock.archive.bytes / 1e9).toFixed(2)} GB)`);
      download(lock.archive.url, `${zip}.part`);
      renameSync(`${zip}.part`, zip);
    }
    const bytes = statSync(zip).size, sum = fileSha256(zip);
    if (bytes !== lock.archive.bytes || sum !== lock.archive.sha256) {
      rmSync(zip);
      return { takes: 0, unpacked: 0, fetched, problems: [...problems, `${lock.archive.url}: ${bytes} bytes, SHA-256 ${sum}; the lock says ${lock.archive.bytes} bytes, ${lock.archive.sha256}. Not kept`] };
    }
    const z = zipFile(zip);
    try {
      for (const e of zipEntries(z.read, z.size)) {
        const base = e.name.split("/").pop()!;
        if (!/^\d+(_\d+)?\.(asf|amc)$/.test(base) || existsSync(join(dir, base))) continue;
        writeFileSync(join(dir, base), zipRead(z.read, e));
        unpacked++;
      }
    } finally {
      z.close();
    }
    writeFileSync(marker, `${JSON.stringify({ archive: lock.archive.url, sha256: lock.archive.sha256 })}\n`);
    if (!keepZip) rmSync(zip);
  }
  const have = new Set(readdirSync(dir));
  for (const t of index.filter((t) => !have.has(`${t.id}.amc`))) {
    const s = t.id.split("_")[0]!;
    for (const [name, url] of [[`${s}.asf`, `${lock.site}/subjects/${s}/${s}.asf`], [`${t.id}.amc`, `${lock.site}/subjects/${s}/${t.id}.amc`]] as const) {
      if (have.has(name)) continue;
      download(url, join(dir, `${name}.part`));
      const got = sha256(readFileSync(join(dir, `${name}.part`)));
      if (got !== lock.extra[name]) {
        rmSync(join(dir, `${name}.part`));
        problems.push(`${url}: SHA-256 ${got}; ${lock.extra[name] ? `the lock says ${lock.extra[name]}` : "the lock doesn't pin it"}. Not kept`);
        continue;
      }
      renameSync(join(dir, `${name}.part`), join(dir, name));
      have.add(name);
      fetched.push(name);
    }
  }
  return { takes: readdirSync(dir).filter((f) => f.endsWith(".amc")).length, unpacked, fetched, problems };
}

// ---- the ledger: every take, what it is, how it converts, and what was done with it ----
/** Categories, first match wins (the words of the take's description, then its subject's): what a game would use it for. */
const CATEGORIES: readonly [string, RegExp][] = [
  ["calibration", /motorcycle|range of motion|t-pose|tpose|calibration|lost marker/],
  ["acrobatics", /cartwheel|flip|handspring|somersault|breakdanc|acrobat|gymnast|handstand|tumbl|backbend|\broll/],
  ["combat", /punch|kick|box(ing|er)|fight|martial|karate|sword|stab|\bjab|uppercut|strike|slash|attack|block|dodge|duck\b|ducking|wrestl|swat/],
  ["reaction", /\bfall|stumbl|\btrip|injur|wound|limp|hurt|\bdie\b|dead|collaps|faint|get(ting)? up|stand up from|getup/],
  ["climb", /climb|ladder|ledge|\bscal|hang|monkey ?bar|swing on|swings? /],
  ["jump", /jump|\bhop|leap|hopscotch|vault/],
  ["sit and lie", /\bsit|stool|chair|\blie\b|laying|lying|sleep|kneel|crouch|squat|bench/],
  ["dance", /danc|salsa|charleston|ballet|arabesque|waltz|tango|michael jackson|pirouette|twist\b|moonwalk|lambada/],
  ["sports", /basketball|soccer|football|golf|tennis|baseball|swim|skate|bowl|volleyball|frisbee|throw|catch|dribbl|shoot|\bball|sport|bicycle|row(ing)?\b/],
  ["animal and character", /chicken|monkey|\bdog|\bcat\b|bear|elephant|animal|\bduck|frog|snake|horse|bird|dinosaur|robot|zombie|mickey|mime|pantomime|penguin|crab|kangaroo|gorilla|ape\b|t-rex|teapot|alien|monster|old man|drunk|baby|tiger|panther|lion|ghost|dragon|devil|genie|superhero/],
  ["gesture and talk", /wave|waving|clap|point|cheer|salute|\bbow\b|bowing|shrug|signal|\btalk|laugh|\bcry|yawn|nod|beckon|story|rhyme|express|emotion|greet|shak(e|ing) hands|hand ?shake|celebrat|conversation|argue|gestur|happy|\bsad\b|upset|scared|angry|freez|shiver|teach|curtsey|high five|peek/],
  ["everyday", /pick|carry|lift|push|pull|open|close|reach|wash|sweep|drink|\beat|mug|coffee|window|\bbox|suitcase|\bplace|put|grab|wipe|mop|construction|hammer|saw|shovel|drag|\bload|stack|lean|bend|cook|clean|phone|read|writ|door|table|step ?stool|stepstool|bucket|broom|fish|sew|plant|rak(e|ing)|paint|pay|buy|vacuum|typ(e|ing)|laptop|palm pilot|movie|shav|slic|chop|dig|dough|batter|mix|search|pok(e|ing)|violin|piano|drum|guitar|sipping|martini|smok|setting|dial/],
  ["exercise", /stretch|exercise|jacks|squats|yoga|tai ?chi|push ?up|sit ?up|lunge|range of motion|warm|balanc|toe touch/],
  ["locomotion", /walk|\brun|jog|sprint|march|sneak|stride|\bstep|turn|veer|sidestep|stairs|navigate|backward|strafe|skip|stroll|shuffle|creep|crawl|wander|pace|obstacle|avoid|start|stop|\b(90|180|360)\b/],
  ["idle", /idle|standing|wait|stand\b|shift/],
];
/** A take's category: its description's words first, then its subject's ("calibration": set-up poses, not motion). */
export function categoryOf(t: { desc?: string; about?: string }): string {
  const a = (t.desc || "").toLowerCase(), b = (t.about || "").toLowerCase();
  if (!a) return "undescribed";
  for (const s of [a, b]) for (const [c, re] of CATEGORIES) if (re.test(s)) return c;
  return "other";
}

/** The ledger's columns, in order. */
export const COLS = ["id", "subject", "fps", "sec", "category", "active", "fit", "travel", "hips", "flags", "used", "note", "desc", "about"] as const;
/** The ledger's comment block: what each column means. */
export const LEDGER_HEAD = `# Every take of the CMU motion capture database (mocap.cs.cmu.edu; its terms are in
# library/LICENSES/LicenseRef-CMU-Mocap.txt), one a line. Written by npm run corpora -- cmu --survey, which converts
# each take into the readable format and measures it; edit only "note". sec: length in seconds. category: what a game
# would use it for (from the words of its description). active: the seconds where it moves (still stretches at either
# end left out). fit: the readable format's average and worst body-point error against the capture (mm). travel: metres
# the hips cover. hips: lowest and highest hip height, in percent of standing (under 60: crouching or lying; over 115:
# in the air or up on something). flags: inverted (upside down at some point), floats (feet off the floor most of the
# time: stairs, a ladder, a bench), loose (fit over 30 mm), short (under a second), fps? (not on the site's list: 120
# assumed), error. used: the clips of library/sets/CMU_CURATED cut from it. note: yours, kept when the survey runs
# again: "pick" (next to import), "skip: why".`;

/** The ledger's rows by id, from its text ({} for none). */
export function readLedger(text: string | null): Record<string, Row> {
  if (!text) return {};
  const [head, ...lines] = text.split("\n").filter((l) => l && !l.startsWith("#")), cols = head!.split("\t"), out: Record<string, Row> = {};
  for (const l of lines) {
    const v = l.split("\t"), r: Row = {};
    cols.forEach((c, i) => (r[c] = v[i] ?? ""));
    out[r.id!] = r;
  }
  return out;
}
/** The ledger as text: its head, its columns, a row a take by subject then take. */
export function ledgerText(rows: Record<string, Row>): string {
  const list = Object.values(rows).sort((a, b) => Number(a.subject) - Number(b.subject) || byId(a.id!, b.id!));
  return `${LEDGER_HEAD}\n${COLS.join("\t")}\n${list.map((r) => COLS.map((c) => (r[c] ?? "").replace(/[\t\n]/g, " ")).join("\t")).join("\n")}\n`;
}
/** Which clips of the CMU set each take feeds, by name: { "13_17": ["Boxing_Guard_Loop", "Boxing_Jab"] }. */
export function usedBy(dir = CURATED): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".json") && !f.startsWith("_")).sort()) {
    const c = JSON.parse(readFileSync(join(dir, f), "utf8")) as { name: string; provenance?: { take?: string } };
    const take = c.provenance?.take?.split(" ")[0];
    if (take) (out[take] ??= []).push(c.name);
  }
  return out;
}

/** A set of a subject's takes, as an import writes it (format 1: what @m3a/io's importSet writes). */
export interface SubjectSet {
  set: string;
  title: string;
  format: 1;
  credit: string;
  fps: number;
  sources: Record<string, Record<string, unknown>>;
  body: null;
  fit: Record<string, [number, number]>;
  clips: Record<string, { clip: string; src: string; take: string; dur: number; loop: false; tags: string[]; desc?: string; keys: unknown[] }>;
}
/** The survey's options: which subjects (all), the ledger's fit limit (30 mm), the old ledger, the curated takes. */
export interface SurveyOptions {
  subjects?: readonly number[] | null;
  tol?: number;
  old?: Record<string, Row>;
  used?: Record<string, string[]>;
  /** Write each subject's takes as a set fitted within `tol` mm instead of measuring fits for the ledger. */
  lib?: { tol: number; set(s: SubjectSet): void } | null;
  log?: (line: string) => void;
}
const CREDIT = "CMU Graphics Lab Motion Capture Database (mocap.cs.cmu.edu). The database was created with funding from NSF EIA-0196217.";
const TERMS = "This data is free for use in research projects. You may include this data in commercially-sold products, but you may not resell this data directly, even in converted form. If you publish results obtained using this data, we would appreciate it if you would send the citation to your published paper to jkh+mocap@cs.cmu.edu, and also would add this text to your acknowledgments section: The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217.";

/**
 * Converts every take in `dir`, a subject at a time, the way the importer would (whole takes, 30 frames a second),
 * and measures each: its fit (in pieces of at most 10 s: fitting costs the square of a clip's length), where it
 * moves, how far it travels, how high and low the hips go, whether it turns upside down, whether the feet keep to the
 * floor. Returns the ledger's rows (the old ledger's notes kept, and its rows for subjects not surveyed); with `lib`,
 * each subject's takes as a set instead, a take of more than 20 s in numbered 10 s parts.
 */
export function survey(dir: string, index: readonly IndexRow[], opts: SurveyOptions = {}): { rows: Record<string, Row>; done: number; secs: number } {
  const tol = opts.tol ?? 30, old = opts.old ?? {}, used = opts.used ?? {}, lib = opts.lib ?? null, ledger = !lib, log = opts.log ?? (() => {});
  const known = new Map(index.map((t) => [t.id, t])), rows: Record<string, Row> = { ...old }, subjFps: Record<number, Set<number>> = {}, about: Record<number, string> = {};
  for (const t of index) {
    (subjFps[t.subject] ??= new Set()).add(t.fps);
    about[t.subject] = t.about;
  }
  const bySubject: Record<number, string[]> = {};
  for (const f of readdirSync(dir).filter((f) => /^\d+_\d+\.amc$/.test(f))) (bySubject[+f.split("_")[0]!] ??= []).push(f.slice(0, -4));
  for (const t of index) if (!bySubject[t.subject]?.includes(t.id) && !rows[t.id]) rows[t.id] = { id: t.id, subject: String(t.subject), fps: String(t.fps), desc: t.desc, about: t.about, flags: "not downloaded" };
  const P = format.POINTS, ix = (n: string) => P.indexOf(n), PEL = ix("pelvis"), TOP = ix("headTop"), FEET = ["toeL", "toeR", "ballL", "ballR", "ankleL", "ankleR"].map(ix), Fn = P.length * 3;
  let done = 0, secs = 0;
  for (const s of Object.keys(bySubject).map(Number).sort((a, b) => a - b)) {
    if (opts.subjects && !opts.subjects.includes(s)) continue;
    const ids = bySubject[s]!.sort(byId), ss = String(s).padStart(2, "0"), asf = readFileSync(join(dir, `${ss}.asf`), "utf8"), amc = (t: string) => readFileSync(join(dir, `${t}.amc`), "utf8");
    const fpsOf = (id: string) => known.get(id)?.fps || (subjFps[s]?.size === 1 ? [...subjFps[s]!][0]! : 120);
    const picks: Pick[] = ids.map((id) => ({ name: id, take: id, fps: fpsOf(id) })), failed: Record<string, string> = {};
    let clips: Record<string, Capture>;
    try {
      clips = readCmu(asf, amc, picks, 30).clips;
    } catch {
      // one bad take: the subject's takes read one at a time to find it
      clips = {};
      for (const pk of picks) {
        try {
          Object.assign(clips, readCmu(asf, amc, [pk], 30).clips);
        } catch (err) {
          failed[pk.take] = err instanceof IoError || err instanceof Error ? err.message : String(err);
        }
      }
    }
    const R = clips._rest, rest = R ? skeleton.measure(clips, "_rest") : null, floor = R ? Math.min(...FEET.slice(0, 4).map((i) => R.data[i * 3 + 2]!)) : 0, standing = rest ? rest.H0 : 1;
    const set: SubjectSet | null = lib ? { set: `CMU_${ss}`, title: `CMU subject ${s}`, format: 1, credit: CREDIT, fps: 30, sources: {}, body: null, fit: {}, clips: {} } : null;
    if (set && rest) set.sources[`CMU_${ss}`] = { file: `${ss}.asf`, rig: "cmu", label: `CMU motion capture, subject ${s}${about[s] ? ` (${about[s]})` : ""}`, origin: CREDIT, license: "LicenseRef-CMU-Mocap", terms: TERMS, url: `${SITE}/search.php?subjectnumber=${s}`, rest };
    for (const id of ids) {
      const t = known.get(id) ?? { id, subject: s, about: about[s] || "", desc: "", fps: fpsOf(id) };
      const r: Row = { id, subject: String(s), fps: String(t.fps), desc: t.desc, about: t.about || about[s] || "", note: old[id]?.note || "" }, flags: string[] = [];
      if (!known.has(id)) flags.push("fps?");
      const cap = clips[id];
      if (!cap || !rest) {
        r.flags = [`error: ${failed[id] || "not read"}`, ...flags].join(" ");
        rows[id] = r;
        continue;
      }
      const n = cap.n, d = cap.data;
      r.sec = cap.dur.toFixed(1);
      r.category = categoryOf(r);
      // where it moves: each frame's change (every point, plus the root's travel); the still ends are trimmed
      const e = new Float32Array(n);
      for (let f = 1; f < n; f++) {
        let a = 0;
        for (let k = 0; k < Fn; k++) {
          const v = d[f * Fn + k]! - d[(f - 1) * Fn + k]!;
          a += v * v;
        }
        if (cap.move) a += P.length * ((cap.move[f * 2]! - cap.move[f * 2 - 2]!) ** 2 + (cap.move[f * 2 + 1]! - cap.move[f * 2 - 1]!) ** 2);
        e[f] = Math.sqrt(a / P.length);
      }
      const sorted = Array.from(e).sort((a, b) => a - b), cut = Math.max(2, sorted[Math.floor(n * 0.9)]! * 0.2);
      let a0 = 1, a1 = n - 1;
      while (a0 < n - 1 && e[a0]! < cut) a0++;
      while (a1 > a0 && e[a1]! < cut) a1--;
      r.active = `${Math.max(0, (a0 - 6) / 30).toFixed(1)}-${Math.min(cap.dur, (a1 + 6) / 30).toFixed(1)}`;
      let travel = 0;
      if (cap.move) for (let f = 1; f < n; f++) travel += Math.hypot(cap.move[f * 2]! - cap.move[f * 2 - 2]!, cap.move[f * 2 + 1]! - cap.move[f * 2 - 1]!);
      r.travel = (travel / 1000).toFixed(1);
      let lo = Infinity, hi = -Infinity, inverted = 0, off = 0;
      for (let f = 0; f < n; f++) {
        const hz = d[f * Fn + PEL * 3 + 2]!;
        lo = Math.min(lo, hz);
        hi = Math.max(hi, hz);
        if (d[f * Fn + TOP * 3 + 2]! < hz - 50) inverted++;
        if (Math.min(...FEET.map((i) => d[f * Fn + i * 3 + 2]!)) > floor + 150) off++;
      }
      r.hips = `${Math.round((lo / standing) * 100)}-${Math.round((hi / standing) * 100)}`;
      if (inverted > 2) flags.push("inverted");
      if (off > n * 0.6) flags.push("floats");
      if (cap.dur < 1) flags.push("short");
      // fitted in pieces of at most 10 s (a long take is a series of moments anyway): the ledger's fit is over all of
      // them; the imported library keeps a long take as its numbered parts, fitted looser (for browsing: a clip picked
      // for a set is cut again at the set's tolerance)
      const W = n > 600 ? 300 : n - 1;
      let sum = 0, worst = 0, part = 0;
      for (let a = 0; a < n - 1 || a === 0; a += W) {
        const b = Math.min(n - 1, a + W), piece: format.Capture = { name: id, n: b - a + 1, dur: (b - a) / 30, loop: false, fps: 30, data: d.subarray(a * Fn, (b + 1) * Fn), move: cap.move ? cap.move.subarray(a * 2, (b + 1) * 2) : null };
        if (ledger) {
          const fitted = format.fit(rest, piece, tol, {});
          sum += fitted.mean * piece.n;
          worst = Math.max(worst, fitted.max);
        }
        if (set && lib) {
          const { clip, max, mean } = format.fit(rest, piece, lib.tol, {}), name = W < n - 1 ? `${id}_part${++part}` : id;
          set.clips[name] = { clip: name, src: set.set, take: `${id} ${(a / 30).toFixed(2)}-${(b / 30).toFixed(2)}`, dur: clip.dur, loop: false, tags: [r.category], ...(t.desc ? { desc: t.desc } : {}), keys: clip.keys };
          set.fit[name] = [Math.round(mean), Math.round(max)];
        }
        if (b >= n - 1) break;
      }
      const mean = sum / n;
      r.fit = ledger ? `${Math.round(mean)}/${Math.round(worst)}` : old[id]?.fit || "";
      if (ledger && mean > 30) flags.push("loose");
      r.flags = flags.join(" ");
      rows[id] = r;
      done++;
      secs += cap.dur;
    }
    if (set) lib!.set(set);
    log(`subject ${s}: ${ids.length} takes (${done} so far, ${(secs / 3600).toFixed(1)} h of motion)`);
  }
  // these follow the words and the set, so every row is brought up to date
  for (const r of Object.values(rows)) {
    if (r.sec !== undefined && r.sec !== "") r.category = categoryOf(r);
    r.used = (used[r.id!] ?? []).join(" ");
  }
  return { rows, done, secs };
}

/** Takes whose description (and subject's line) has every word. */
export function findTakes(index: readonly IndexRow[], words: readonly string[]): IndexRow[] {
  const q = words.map((w) => w.toLowerCase());
  return index.filter((t) => q.every((w) => `${t.desc} ${t.about}`.toLowerCase().includes(w)));
}
/** Ledger rows matching every word (a category, or a word of the row) and a status (none, used, pick, skip). */
export function queryLedger(rows: Record<string, Row>, words: readonly string[], status?: string): Row[] {
  const q = words.map((w) => w.toLowerCase());
  return Object.values(rows)
    .filter((r) => q.every((w) => r.category === w || `${r.id} ${r.desc} ${r.about} ${r.flags} ${r.note} ${r.used}`.toLowerCase().includes(w)))
    .filter((r) => !status || (status === "none" ? !r.used && !r.note : status === "used" ? !!r.used : (r.note ?? "").startsWith(status)));
}
