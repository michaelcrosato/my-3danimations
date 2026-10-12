// The large corpora (WP-5.6): a zip read entry by entry and refused when it lies; the site's index parsed; a fetch that
// keeps only what its lock pins and resumes; the ledger written and read back byte for byte, its `used` column the
// CMU set's takes; a take surveyed as the ledger measured it; and 100STYLE: its lists read, its picks found in the
// frames it marks as the style, an archive held to its lock, and a catalog imported from it as a set.
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { crc32, deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { ROOT } from "../run/cli.ts";
import { categoryOf, fetchCmu, findTakes, LEDGER, LEDGER_HEAD, ledgerText, parseIndex, queryLedger, readIndex, readLedger, survey, usedBy, indexText, type CmuLock } from "./cmu.ts";
import { zipEntries, ZipError, zipRead } from "./zip.ts";
import { Archive, csvLine, fetch100style, import100, picks100, readStyles, style100Find, takePath } from "./style100.ts";
import { tinyBvh } from "../../packages/io/test/fixtures.ts";

const sha256 = (b: Uint8Array | string) => createHash("sha256").update(b).digest("hex");
const tmp = () => mkdtempSync(join(tmpdir(), "m3a-corpora-"));

/** A zip of the files given, the first stored and the rest deflated (as the CMU archive's are). */
function makeZip(files: Record<string, string>): Buffer {
  const locals: Buffer[] = [], dir: Buffer[] = [];
  let at = 0;
  Object.entries(files).forEach(([name, text], i) => {
    const raw = Buffer.from(text), method = i === 0 ? 0 : 8, data = method ? deflateRawSync(raw) : raw, nm = Buffer.from(name, "latin1");
    const lh = Buffer.alloc(30), ch = Buffer.alloc(46);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(method, 8);
    lh.writeUInt32LE(crc32(raw), 14);
    lh.writeUInt32LE(data.length, 18);
    lh.writeUInt32LE(raw.length, 22);
    lh.writeUInt16LE(nm.length, 26);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(method, 10);
    ch.writeUInt32LE(crc32(raw), 16);
    ch.writeUInt32LE(data.length, 20);
    ch.writeUInt32LE(raw.length, 24);
    ch.writeUInt16LE(nm.length, 28);
    ch.writeUInt32LE(at, 42);
    locals.push(lh, nm, data);
    dir.push(ch, nm);
    at += 30 + nm.length + data.length;
  });
  const d = Buffer.concat(dir), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(dir.length / 2, 8);
  end.writeUInt16LE(dir.length / 2, 10);
  end.writeUInt32LE(d.length, 12);
  end.writeUInt32LE(at, 16);
  return Buffer.concat([...locals, d, end]);
}
const reader = (b: Buffer) => (pos: number, n: number) => b.subarray(pos, pos + n);

describe("a zip read entry by entry", () => {
  it("reads stored and deflated entries, and refuses one whose CRC-32 or size lies", () => {
    const z = makeZip({ "all/subjects/01/01.asf": "skeleton", "all/subjects/01/01_01.amc": "1\nroot 0 0 0\n".repeat(50) });
    const es = zipEntries(reader(z), z.length);
    expect(es.map((e) => [e.name, e.method])).toEqual([["all/subjects/01/01.asf", 0], ["all/subjects/01/01_01.amc", 8]]);
    expect(zipRead(reader(z), es[1]!).toString()).toBe("1\nroot 0 0 0\n".repeat(50));
    expect(() => zipRead(reader(z), { ...es[0]!, crc: es[0]!.crc ^ 1 })).toThrow(/CRC-32/);
    expect(() => zipRead(reader(z), { ...es[1]!, method: 12 })).toThrow(/compression method 12/);
    expect(() => zipEntries(reader(Buffer.from("not a zip")), 9)).toThrow(ZipError);
  });
});

describe("the site's index", () => {
  const html = `<TR><TD>Subject #9 (run)</TD></TR><TR><TD><a href="/subjects/09/09_01.amc">1</a></TD><TD>x</TD><TD>run &amp; stop</TD><TD>120</TD></TR>
    <TR><TD>Subject #60 (salsa)</TD></TR><TR><TD><a href="/subjects/60/60_01.amc">1</a></TD><TD>x</TD><TD>salsa&nbsp;dance</TD><TD>60</TD></TR>`;
  it("lists each take under its subject's line, its rate the row's last number, and round-trips as text", () => {
    const rows = parseIndex(html);
    expect(rows).toEqual([{ id: "09_01", subject: 9, about: "run", desc: "run & stop", fps: 120 }, { id: "60_01", subject: 60, about: "salsa", desc: "salsa dance", fps: 60 }]);
    expect(readIndex(indexText(rows))).toEqual(rows);
    expect(findTakes(rows, ["SALSA"]).map((t) => t.id)).toEqual(["60_01"]);
  });
  it("puts a take in the first category its words match, its subject's line next", () => {
    expect(categoryOf({ desc: "playground - forward jumps, turn around", about: "climb" })).toBe("jump");
    expect(categoryOf({ desc: "01", about: "walking" })).toBe("locomotion");
    expect(categoryOf({ desc: "", about: "walking" })).toBe("undescribed");
    expect(categoryOf({ desc: "zzz", about: "qqq" })).toBe("other");
  });
});

describe("a fetch held to its lock", () => {
  it("keeps what the lock pins, refuses what it doesn't, and resumes without fetching again", () => {
    const site = tmp(), dir = join(tmp(), "cmu"), asf = "the skeleton", amc = "the take";
    const zip = makeZip({ "all_asfamc/subjects/09/09.asf": asf, "all_asfamc/subjects/09/09_01.amc": amc, "all_asfamc/README": "x" });
    const html = `<TR><TD>Subject #9 (run)</TD></TR><TR><TD>/subjects/09/09_01.amc</TD><TD>a</TD><TD>run</TD><TD>120</TD></TR>
      <TR><TD>Subject #144 (punching female)</TD></TR><TR><TD>/subjects/144/144_01.amc</TD><TD>a</TD><TD>punch</TD><TD>120</TD></TR>
      <TR><TD>/subjects/144/144_02.amc</TD><TD>a</TD><TD>kick</TD><TD>120</TD></TR>`;
    writeFileSync(join(site, "all.zip"), zip);
    writeFileSync(join(site, "search.html"), html);
    mkdirSync(join(site, "subjects/144"), { recursive: true });
    for (const f of ["144.asf", "144_01.amc", "144_02.amc"]) writeFileSync(join(site, "subjects/144", f), `${f} text`);
    const url = (f: string) => pathToFileURL(join(site, f)).href;
    const lock: CmuLock = { site: pathToFileURL(site).href, archive: { url: url("all.zip"), bytes: zip.length, sha256: sha256(zip) }, index: { url: url("search.html"), takes: 3, sha256: sha256(indexText(parseIndex(html))) }, extra: { "144.asf": sha256("144.asf text"), "144_01.amc": sha256("144_01.amc text") } };
    const got = fetchCmu(dir, lock);
    expect(got.problems).toEqual([expect.stringMatching(/144_02\.amc: SHA-256 [0-9a-f]{64}; the lock doesn't pin it\. Not kept/)]);
    expect([got.takes, got.unpacked, got.fetched]).toEqual([2, 2, ["144.asf", "144_01.amc"]]);
    expect(readFileSync(join(dir, "09_01.amc"), "utf8")).toBe(amc);
    expect([existsSync(join(dir, "allasfamc.zip")), existsSync(join(dir, "144_02.amc")), existsSync(join(dir, "README"))]).toEqual([false, false, false]);
    // pinned, it is fetched alone; the archive isn't read again
    const again = fetchCmu(dir, { ...lock, archive: { ...lock.archive, url: url("gone.zip") }, extra: { ...lock.extra, "144_02.amc": sha256("144_02.amc text") } });
    expect([again.problems, again.unpacked, again.fetched, again.takes]).toEqual([[], 0, ["144_02.amc"], 3]);
    // an archive that isn't the one pinned is refused and not kept
    const bad = fetchCmu(join(tmp(), "cmu"), { ...lock, archive: { ...lock.archive, sha256: "0".repeat(64) } });
    expect(bad.problems).toEqual([expect.stringMatching(/all\.zip: \d+ bytes, SHA-256 [0-9a-f]{64}; the lock says .*Not kept/)]);
  });
});

describe("the ledger", () => {
  const text = readFileSync(LEDGER, "utf8"), rows = readLedger(text);
  it("is the survey's text: read and written again byte for byte, under the survey's head, a row a take", () => {
    expect(ledgerText(rows)).toBe(text);
    expect(text.startsWith(`${LEDGER_HEAD}\n`)).toBe(true);
    expect(Object.keys(rows)).toHaveLength(2548);
    expect(queryLedger(rows, ["combat"], "used").length).toBeGreaterThan(5);
  });
  it("names the clips of the CMU set each take feeds, as the set says", () => {
    const used = usedBy();
    for (const r of Object.values(rows)) expect(r.used, r.id).toBe((used[r.id!] ?? []).join(" "));
    expect(Object.keys(used)).toHaveLength(148);
  });
  it("surveys a take as the ledger measured it: its length, category, active stretch, travel and flags", () => {
    const dir = tmp(), v = join(ROOT, "spec/vectors/tier1b/cmu");
    cpSync(join(v, "09.asf"), join(dir, "09.asf"));
    cpSync(join(v, "09_02.amc"), join(dir, "09_02.amc"));
    const index = [{ id: "09_02", subject: 9, about: "run", desc: "run", fps: 120 }, { id: "09_03", subject: 9, about: "run", desc: "run", fps: 120 }];
    const r = survey(dir, index, { used: { "09_02": ["Run_Quick"] }, old: { "09_02": { id: "09_02", note: "pick: a test" } } });
    const row = r.rows["09_02"]!, want = rows["09_02"]!;
    expect([row.sec, row.category, row.active, row.travel, row.flags, row.used, row.note]).toEqual([want.sec, want.category, want.active, want.travel, "", "Run_Quick", "pick: a test"]);
    expect(row.fit).toMatch(/^\d+\/\d+$/);
    expect(r.rows["09_03"]!.flags).toBe("not downloaded");
  });
});

describe("100STYLE", () => {
  const list = 'Style Name,Description,Stochastic,Symmetric,Notes\nNeutral,"Walk normally, ""neutral""",No,Yes,\nZombie,Arms out,Yes,Yes,shuffles\n';
  const cuts = "STYLE_NAME,SW_START,SW_STOP,ID_START,ID_STOP\nNeutral,120,840,30,\nZombie,10,20,0,600\n";
  it("reads its lists: each style's instruction, and the frames each take performs its style between", () => {
    expect(csvLine(' a, "b, ""c""" ,d')).toEqual(["a", 'b, "c"', "d"]);
    const st = readStyles(list, cuts);
    expect(st.about).toEqual([{ style: "Neutral", desc: 'Walk normally, "neutral"', stochastic: false, notes: "" }, { style: "Zombie", desc: "Arms out", stochastic: true, notes: "shuffles" }]);
    expect([...st.cuts]).toEqual([["Neutral_SW", [120, 840]], ["Zombie_SW", [10, 20]], ["Zombie_ID", [0, 600]]]);
    expect([style100Find("Zombie_ID", true), style100Find("Zombie_BR", true), style100Find("Zombie_TR2", true), style100Find("Zombie_FW", true), style100Find("Zombie_FW", false)]).toEqual(["still", "back", undefined, "straight", undefined]);
    expect(takePath("ArmsAboveHead_FR")).toBe("100STYLE/ArmsAboveHead/ArmsAboveHead_FR.bvh");
  });
  it("plays a pick with no stretch inside the frames the style takes, an idle's cycle 2.5 s at least", () => {
    const cat = { $pick: { L: ["Neutral_SW", null, null, 0.8, "left"], I: ["Zombie_ID", null, null, null], W: ["Zombie_SW", 1, 2, null, "whole"] }, L: ["sidestep left loop", "x"], I: ["idle loop", "y"], W: ["loop", "z"] } as never;
    expect(picks100(cat, readStyles(list, cuts))).toEqual([
      { name: "L", take: "Neutral_SW", from: 2, to: 14, minCycle: 0.8, loop: true, find: "left" },
      { name: "I", take: "Zombie_ID", from: 0, to: 10, minCycle: 2.5, loop: true, find: "still" },
      { name: "W", take: "Zombie_SW", from: 1, to: 2, loop: true, find: "whole" },
    ]);
  });
  it("keeps the archive only as pinned, and imports a catalog from it as a set, a pick it can't cut left out", () => {
    // a sidestep take, 15 s at 30 fps: 3 s walking in, 4 s left, 4 s right, 4 s walking out
    const take = tinyBvh(450, 1 / 30, (f) => 45 + 45 * Math.sin((2 * Math.PI * f) / 30), (f, v) => {
      const t = f / 30;
      v[0] = t < 3 ? 0 : t < 7 ? 40 * (t - 3) : t < 11 ? 160 - 40 * (t - 7) : 0;
      v[2] = t < 3 ? 40 * t : t < 11 ? 120 : 120 + 40 * (t - 11);
    });
    const zip = makeZip({ "100STYLE/Dataset_List.csv": list, "100STYLE/Frame_Cuts.csv": "STYLE_NAME,SW_START,SW_STOP\nNeutral,0,450\n", "100STYLE/Neutral/Neutral_SW.bvh": take });
    const site = tmp(), dir = join(tmp(), "100style"), lock = { archive: { url: pathToFileURL(join(site, "100STYLE.zip")).href, bytes: zip.length, sha256: sha256(zip) } };
    writeFileSync(join(site, "100STYLE.zip"), zip);
    expect(fetch100style(dir, { archive: { ...lock.archive, sha256: "0".repeat(64) } }).problems).toEqual([expect.stringMatching(/the lock says .* Not kept/)]);
    const f = fetch100style(dir, lock);
    expect(f.problems).toEqual([]);
    const archive = new Archive(f.file);
    try {
      const styles = readStyles(archive.text("100STYLE/Dataset_List.csv")!, archive.text("100STYLE/Frame_Cuts.csv")!);
      const catalog = { $sources: { "100STYLE": { label: "100STYLE", license: "CC-BY-4.0" } }, $skip: { Spin_SideLeft: "turns round as it goes" }, $pick: { Neutral_SideLeft: ["Neutral_SW", null, null, 0.8, "left"], Neutral_SideBack: ["Neutral_SW", null, null, 0.8, "back"] }, Neutral_SideLeft: ["sidestep left loop", "Sidestepping left"], Neutral_SideBack: ["back loop", "Never there"] } as never;
      const r = import100("side", archive, styles, { catalog });
      expect([r.set.set, r.set.title, Object.keys(r.set.clips), r.set.clips.Neutral_SideLeft!.loop, r.report.warnings]).toEqual(["STYLE100_SIDE", "100STYLE sidesteps", ["Neutral_SideLeft"], true, []]);
      expect(r.report.skipped).toEqual([{ name: "Spin_SideLeft", why: "turns round as it goes" }]);
      expect(r.log.find((l) => l.startsWith("left out Neutral_SideBack"))).toMatch(/no straight stretch going back/);
      expect(() => import100("side", archive, styles, { catalog: { $pick: { X: ["Nope_SW", 0, 1] } } as never })).toThrow(/100STYLE has no take Nope_SW/);
    } finally {
      archive.close();
    }
  });
});
