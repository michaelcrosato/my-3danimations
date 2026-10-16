// The tools' foundation (PLAN.md WP-7.2a): the base tools and an edit-shaped demo on every surface; the Node host writing
// only under its write roots, atomically and through no link out; the durable store, across two m3a processes too; the
// library at game.json's tiers, each call with its own warnings; and the clip loader's forms and refusals.
import { spawnSync } from "node:child_process";
import { existsSync, linkSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { hostname, tmpdir } from "node:os";
import { join } from "node:path";
import type { LibraryError } from "@m3a/library";
import { describe, expect, it } from "vitest";
import { runCli } from "../src/cli.ts";
import { nodeHost } from "../src/node.ts";
import { lockFile } from "../src/node/files.ts";
import { libraryAccess } from "../src/node/library.ts";
import { fileStore } from "../src/node/store.ts";
import { defineTool, Registry, reply } from "../src/registry/index.ts";
import { clipResolver, loadClip, refusal } from "../src/tools/clips.ts";
import { CLIP } from "../src/tools/common.ts";
import { BASE } from "../src/tools/index.ts";
import { exampleCwd, ROOT, runExamples } from "./helpers/surfaces.ts";
import { tally } from "./helpers/tally.ts";
import { workshopClip } from "./helpers/workshop.ts";

/** demo.put: writes `text` to `path` (or removes it without), then reads it back. */
const put = defineTool({
  name: "demo.put",
  description: "Write or remove a file.",
  params: { type: "object", properties: { path: { type: "string" }, text: { type: "string" } }, required: ["path"] },
  examples: [{ args: { path: "workshop/a.txt", text: "a" } }],
  async run(a: { path: string; text?: string }, ctx) {
    if (a.text === undefined) ctx.remove(a.path);
    return { verdict: "done", data: { wrote: a.text === undefined ? null : ctx.write(a.path, a.text), now: await ctx.tryRead(a.path) }, next: "again" };
  },
});
/** demo.clip: a clip through the loader, and the resolver's answer for it. */
const peek = defineTool({
  name: "demo.clip",
  description: "Load a clip.",
  params: { type: "object", properties: { clip: CLIP }, required: ["clip"] },
  examples: [{ args: { clip: "QUATERNIUS_3D2DGE/Walk_Loop" } }],
  async run(a: { clip: string }, ctx) {
    const r = await loadClip(ctx, a.clip), resolved = (await clipResolver(ctx, [a.clip]))(a.clip)?.clip.id ?? null;
    return { verdict: r.id, data: { id: r.id, set: r.set, tier: r.tier, where: r.where, H0: r.rest.H0, source: r.source?.label ?? null, tiers: ctx.library().tiers, resolved }, lines: ["loaded"], next: "use it" };
  },
});

describe("the base tools, and an edit, on every surface", () => {
  runExamples([...BASE, tally]);
  it("validate fails a clip given as text, and names the argument it doesn't know", async () => {
    const reg = new Registry(BASE);
    expect(await reg.call("validate", { text: '{"format":"2.0","id":"DEMO/Bad","dur":0}' })).toMatchObject({ status: "findings", data: { ok: false } });
    expect((await reg.call("validate", { pth: "x" })).error).toMatchObject({ code: "E_ARGS", message: expect.stringMatching(/did you mean "path"/) });
    const { cwd, rm } = exampleCwd(); // an absolute path is named "the file": no reply echoes one
    try {
      const abs = await reg.call("validate", { path: join(cwd, "library/sets/QUATERNIUS_3D2DGE/A_TPose.json") }, { host: nodeHost(cwd) });
      expect([abs.verdict, JSON.stringify(abs).includes(cwd)]).toEqual(["validate the file: PASS, 0 errors, 0 warnings", false]);
      const refused = [[join(cwd, "nothere.json"), "can't read the file (ENOENT); paths are relative to the working directory"], [join(tmpdir(), "x.json"), "the file is outside the working directory; give a file under the working directory, or pass its text"]];
      for (const [path, message] of refused) {
        const r = await reg.call("validate", { path }, { host: nodeHost(cwd) });
        expect([r.error?.message, JSON.stringify(r).includes(tmpdir())], path).toEqual([message, false]);
      }
    } finally {
      rm();
    }
  });
});

describe("the Node host", () => {
  it("writes atomically under workshop/, .m3a/, imports/ and check-output/ only, never through a link out", async () => {
    const { cwd, rm } = exampleCwd(false), reg = new Registry([put, ...BASE]), host = nodeHost(cwd), call = (args: object) => reg.call("demo.put", args, { host });
    try {
      expect((await call({ path: "workshop/a.txt", text: "a" })).data).toEqual({ wrote: "workshop/a.txt", now: "a" });
      expect(readdirSync(join(cwd, "workshop"))).toEqual(["a.txt"]); // the temporary file renamed over it
      linkSync(join(cwd, "workshop/a.txt"), join(cwd, "workshop/a.lnk")); // a rename replaces the name; an in-place write would change both
      expect([host.write!("workshop/a.txt", "b"), ...["a.txt", "a.lnk"].map((f) => readFileSync(join(cwd, "workshop", f), "utf8"))]).toEqual(["workshop/a.txt", "b", "a"]);
      // a write killed before its rename leaves <file>.<pid>.tmp: the file's next write sweeps it once its process is gone
      const gone = spawnSync(process.execPath, ["-e", ""]).pid!, live = process.ppid, left = [`a.txt.${live}.tmp`, `b.txt.${gone}.tmp`];
      for (const n of [`a.txt.${gone}.tmp`, ...left]) writeFileSync(join(cwd, "workshop", n), "x");
      host.write!("workshop/a.txt", "b");
      expect(readdirSync(join(cwd, "workshop")).sort()).toEqual(["a.lnk", "a.txt", ...left].sort());
      for (const path of ["library/sets/x.json", "../x", join(tmpdir(), "x.json"), "workshop", "game.json", "check-output/../x"]) expect((await call({ path, text: "x" })).error?.code, path).toBe("E_PATH");
      mkdirSync(join(cwd, "elsewhere"));
      symlinkSync(join(cwd, "elsewhere/via-tmp.txt"), join(cwd, `workshop/t.txt.${process.pid}.tmp`)); // a link planted at the temporary name
      expect([host.write!("workshop/t.txt", "t"), readFileSync(join(cwd, "workshop/t.txt"), "utf8"), existsSync(join(cwd, "elsewhere/via-tmp.txt"))]).toEqual(["workshop/t.txt", "t", false]);
      symlinkSync(join(cwd, "elsewhere"), join(cwd, "imports"));
      symlinkSync(ROOT, join(cwd, "repo"));
      expect((await call({ path: "imports/A/x.json", text: "x" })).error?.message).toMatch(/^"imports\/A\/x.json" leads out of imports\/ through a link/);
      expect((await reg.call("validate", { path: "repo/library/sets/QUATERNIUS_3D2DGE/A_TPose.json" }, { host })).error?.message).toMatch(/^"repo\/library\/sets\/QUATERNIUS_3D2DGE\/A_TPose.json" leads out of the working directory through a link/);
      symlinkSync(".", join(cwd, ".m3a")); // a root linked to the working directory itself: nothing new lands beside game.json
      for (const path of [".m3a/evil.json", ".m3a/new/evil.json"]) expect((await call({ path, text: "x" })).error?.message, path).toMatch(/leads out of .m3a\/ through a link/);
      expect(() => fileStore(cwd).set("k", { args: "{}", reply: reply("demo", "ok", { verdict: "v", next: "n" }) })).toThrow(/leads out of .m3a\//);
      symlinkSync(join(cwd, "elsewhere"), join(cwd, "check-output")); // the host's own files too
      expect(() => host.image!("demo", "x", { width: 1, height: 1, data: new Uint8ClampedArray(4) })).toThrow(/leads out of check-output\//);
      expect(["evil.json", "new", "requests", "elsewhere/demo"].filter((f) => existsSync(join(cwd, f)))).toEqual([]);
      expect((await call({ path: "workshop/a.txt" })).data).toEqual({ wrote: null, now: null });
      expect((await call({ path: "workshop/a.txt" })).status).toBe("ok"); // removing what isn't there is no error
      expect((await reg.call("demo.put", { path: "workshop/a.txt", text: "a" })).error).toMatchObject({ code: "E_HOST", message: expect.stringMatching(/^this surface writes no files/) });
    } finally {
      rm();
    }
  });

  it("takes a lock file for one caller at a time, waits while it is held, and breaks a stale one, one breaker at a time", async () => {
    const { cwd, rm } = exampleCwd(false), L = ".m3a/locks/X.lock", file = join(cwd, L), order: string[] = [];
    try {
      const first = await lockFile(cwd, L), second = lockFile(cwd, L).then((release) => (order.push("second"), release));
      order.push("first");
      first();
      (await second)();
      expect([order, existsSync(file)]).toEqual([["first", "second"], false]);
      const held = await lockFile(cwd, L); // held by a live process (this one), and not let go in time
      await expect(lockFile(cwd, L, 0)).rejects.toMatchObject({ code: "E_LOCKED", message: '".m3a/locks/X.lock" is held by another m3a process; nothing was changed', next: "call again when that edit is done" });
      held();
      // stale: its process gone, or older than the limit; another machine's process can't be asked, so only its age counts
      const gone = spawnSync(process.execPath, ["-e", ""]).pid;
      for (const [text, old] of [[`${hostname()} ${gone} 1`, false], [`${hostname()} ${process.pid} 1`, true], [`elsewhere ${gone} 1`, true]] as const) {
        writeFileSync(file, text);
        if (old) utimesSync(file, 1, 1);
        (await lockFile(cwd, L, 0))();
      }
      writeFileSync(file, `elsewhere ${gone} 1`);
      await expect(lockFile(cwd, L, 0)).rejects.toMatchObject({ code: "E_LOCKED" });
      // one caller breaks a stale lock at a time: while another's break lock is held the stale lock stays, so no breaker
      // removes the lock another took in its place; a break lock whose process is gone is broken too
      const breaking = `${file}.break`, dead = `${hostname()} ${gone} 1`;
      writeFileSync(file, dead);
      writeFileSync(breaking, `${hostname()} ${process.pid} 0`);
      await expect(lockFile(cwd, L, 0)).rejects.toMatchObject({ code: "E_LOCKED" });
      expect(readFileSync(file, "utf8")).toBe(dead);
      writeFileSync(breaking, `${hostname()} ${gone} 2`);
      (await lockFile(cwd, L, 0))();
      expect([existsSync(file), existsSync(breaking)]).toEqual([false, false]);
      const mine = await lockFile(cwd, L); // released only while it is still this caller's
      writeFileSync(file, "another");
      mine();
      expect(readFileSync(file, "utf8")).toBe("another");
      await expect(lockFile(cwd, "locks/X.lock")).rejects.toMatchObject({ code: "E_PATH" }); // under the write roots only
    } finally {
      rm();
    }
  });

  it("keeps an edit's request_id across two m3a processes: the retry replies the first result, applied once", () => {
    const { cwd, rm } = exampleCwd(false), run = (...a: string[]) => spawnSync(process.execPath, [join(import.meta.dirname, "helpers/tally.ts"), "demo.tally", ...a, "--json"], { cwd, encoding: "utf8" });
    try {
      const [first, again] = [run("--request-id", "r-1"), run("--request-id", "r-1")];
      expect([first.status, again.status, again.stdout, readFileSync(join(cwd, "workshop/tally.txt"), "utf8")]).toEqual([0, 0, first.stdout, "1"]);
      expect(JSON.parse(readFileSync(join(cwd, "check-output/demo.tally/report.json"), "utf8"))).toMatchObject({ status: "ok", data: { n: 1 }, revision: "1" });
      const other = run("--by", "2", "--request-id", "r-1");
      expect([other.status, other.stdout, readFileSync(join(cwd, "workshop/tally.txt"), "utf8")]).toEqual([2, expect.stringContaining("was first used with other arguments (they differ in by)"), "1"]);
    } finally {
      rm();
    }
  });

  it("replies an applied edit whose record can't be kept, and a CLI reply whose report can't be written, each warned", async () => {
    const { cwd, rm } = exampleCwd(false), host = nodeHost(cwd);
    try {
      for (const f of [".m3a", "check-output"]) writeFileSync(join(cwd, f), "a file, not a directory");
      const r = await new Registry([tally], fileStore(cwd)).call("demo.tally", { request_id: "q" }, { host });
      expect([r.status, r.lines, readFileSync(join(cwd, "workshop/tally.txt"), "utf8")]).toEqual(["ok", [expect.stringMatching(/^warning: request_id "q" was not kept \(can't write ".m3a\/requests\/[0-9a-f]{32}.json" \(ENOTDIR\)\); a retry would apply it again$/)], "1"]);
      let text = "";
      const code = await runCli(new Registry([tally]), ["demo.tally", "--json"], { print: (x) => void (text += x), write: (p, t) => void host.write!(p, t), host });
      expect([code, text]).toEqual([0, expect.stringMatching(/^tally 2\nwarning: check-output\/demo.tally\/report.json was not written \(can't write /)]);
      expect(text).not.toMatch(/report:/);
    } finally {
      rm();
    }
  });

  it("keeps request records durable: atomic, one a key, a corrupt or colliding one missing, the oldest pruned past max", () => {
    const { cwd, rm } = exampleCwd(false), other = exampleCwd(false), store = fileStore(cwd, 3), dir = join(cwd, ".m3a/requests");
    const rec = (n: number) => ({ args: `{"n":${n}}`, reply: reply("demo", "ok", { verdict: `v${n}`, next: "again" }) });
    try {
      expect([store.durable, store.get("a")]).toEqual([true, undefined]);
      store.set("a", rec(1));
      const [file] = readdirSync(dir);
      expect([store.get("a"), file]).toEqual([rec(1), expect.stringMatching(/^[0-9a-f]{32}\.json$/)]);
      for (const text of ["{oops", JSON.stringify({ key: "b", ...rec(1) })]) {
        writeFileSync(join(dir, file!), text);
        expect(store.get("a")).toBeUndefined();
      }
      linkSync(join(dir, file!), join(cwd, "a.lnk")); // replaced by a rename, so the old record stays under its other name
      store.set("a", rec(2));
      expect([store.get("a"), JSON.parse(readFileSync(join(cwd, "a.lnk"), "utf8"))]).toEqual([rec(2), { key: "b", ...rec(1) }]);
      for (const k of ["b", "c"]) store.set(k, rec(3));
      utimesSync(join(dir, file!), 1, 1); // "a" the oldest
      store.set("d", rec(4));
      expect([store.get("a"), store.get("d"), readdirSync(dir).length]).toEqual([undefined, rec(4), 3]);
      const gone = spawnSync(process.execPath, ["-e", ""]).pid; // a killed write's temporary file is swept once its process is gone
      for (const pid of [gone, process.pid]) writeFileSync(join(dir, `x.json.${pid}.tmp`), "{");
      store.set("e", rec(5));
      expect(readdirSync(dir).filter((f) => f.endsWith(".tmp"))).toEqual([`x.json.${process.pid}.tmp`]);
      symlinkSync(join(cwd, ".m3a"), join(other.cwd, ".m3a")); // records reached through a link out read as missing
      expect(fileStore(other.cwd).get("d")).toBeUndefined();
    } finally {
      [rm, other.rm].forEach((f) => f());
    }
  });
});

describe("the library and the clip loader", () => {
  it("opens the library at game.json's tiers, CC0 without it, and refuses a game.json it can't read", async () => {
    const { cwd, rm } = exampleCwd(false), other = exampleCwd(false), reg = new Registry([peek]), host = nodeHost(cwd), call = (clip: string) => reg.call("demo.clip", { clip }, { host });
    try {
      expect((await call("QUATERNIUS_3D2DGE/Walk_Loop")).data).toEqual({ id: "QUATERNIUS_3D2DGE/Walk_Loop", set: "QUATERNIUS_3D2DGE", tier: "cc0", where: "library", H0: 916.7, source: "Quaternius Universal Animation Library 1", tiers: ["cc0"], resolved: "QUATERNIUS_3D2DGE/Walk_Loop" });
      expect((await call("CMU_CURATED/Drink_Soda")).error).toMatchObject({ code: "E_TIER", message: expect.stringMatching(/a cmu set, and this game sees only cc0: add "cmu" to "tiers" in game.json/) });
      const lib = libraryAccess(cwd); // a set's refusal too
      let set: unknown;
      try {
        lib.library.catalog("CMU_CURATED");
      } catch (err) {
        set = err;
      }
      expect(refusal(set as LibraryError, "CMU_CURATED", lib).message).toMatch(/^CMU_CURATED is a cmu set, and this game sees only cc0: add "cmu" to "tiers" in game.json/);
      writeFileSync(join(cwd, "game.json"), '{ "game": "Demo", "tiers": ["cmu", "cc0"] }');
      expect((await call("CMU_CURATED/Drink_Soda")).data).toMatchObject({ tier: "cmu", tiers: ["cc0", "cmu"] });
      for (const [text, why] of [['{"tiers": ["cc0", "cmuu"]}', /tier "cmuu", which there is not; did you mean "cmu"\?/], ["{oops", /^game.json is not JSON/], ['{"tiers": "cc0"}', /lists tiers/], ["[]", /is a JSON object/]] as const) {
        writeFileSync(join(cwd, "game.json"), text);
        expect((await call("QUATERNIUS_3D2DGE/Walk_Loop")).error).toMatchObject({ code: "E_GAME", message: expect.stringMatching(why) });
      }
      writeFileSync(join(other.cwd, "game.json"), '{"tiers": ["cmu"]}');
      rmSync(join(cwd, "game.json"));
      symlinkSync(join(other.cwd, "game.json"), join(cwd, "game.json"));
      expect((await call("QUATERNIUS_3D2DGE/Walk_Loop")).error).toMatchObject({ code: "E_GAME", message: expect.stringMatching(/^"game.json" leads out of the working directory through a link/) });
    } finally {
      [rm, other.rm].forEach((f) => f());
    }
  });

  it("gives each call its own warnings from the library the calls share, and the registry lists them", async () => {
    const { cwd, rm } = exampleCwd(false), dir = join(cwd, "sets"), lock = JSON.parse(readFileSync(join(ROOT, "library/sets.lock.json"), "utf8")) as { sets: Record<string, unknown> };
    try {
      mkdirSync(dir);
      symlinkSync(join(ROOT, "library/sets/QUATERNIUS_3D2DGE"), join(dir, "QUATERNIUS_3D2DGE"));
      writeFileSync(join(cwd, "sets.lock.json"), JSON.stringify({ sets: { QUATERNIUS_3D2DGE: lock.sets.QUATERNIUS_3D2DGE }, aliases: { "OLD/Walk": "QUATERNIUS_3D2DGE/Walk_Loop" } }));
      const [a, b] = [libraryAccess(cwd, undefined, dir), libraryAccess(cwd, undefined, dir)], said = 'library: "OLD/Walk" is deprecated; use "QUATERNIUS_3D2DGE/Walk_Loop"';
      expect(b.library.clip("OLD/Walk").clip.id).toBe("QUATERNIUS_3D2DGE/Walk_Loop");
      expect([a.warnings, b.warnings]).toEqual([[], [said]]);
      expect(a.library.resolver()("OLD/Walk")?.clip.id).toBe("QUATERNIUS_3D2DGE/Walk_Loop");
      expect([a.warnings, b.warnings]).toEqual([[said], [said]]);
      const r = await new Registry([peek]).call("demo.clip", { clip: "OLD/Walk" }, { host: { ...nodeHost(cwd), library: (t) => libraryAccess(cwd, t, dir) } });
      expect([r.data, r.lines]).toEqual([expect.objectContaining({ id: "QUATERNIUS_3D2DGE/Walk_Loop" }), [`warning: ${said}`, "loaded"]]); // first, so no cut hides it
    } finally {
      rm();
    }
  });

  it("loads a clip by library id, workshop id, path or JSON, and refuses naming the closest id", async () => {
    const { cwd, rm } = exampleCwd(), reg = new Registry([peek]), host = nodeHost(cwd), call = (clip: string) => reg.call("demo.clip", { clip }, { host });
    const pose = JSON.parse(readFileSync(join(cwd, "library/sets/QUATERNIUS_3D2DGE/A_TPose.json"), "utf8")) as { id: string; restSrc: string };
    try {
      expect((await call("library/sets/QUATERNIUS_3D2DGE/A_TPose.json")).data).toMatchObject({ where: "file", tier: "cc0", source: "Quaternius Universal Animation Library 1", resolved: null });
      const refused = async (clip: string) => ((r) => [r.status, r.error?.code, r.error?.message])(await call(clip));
      expect(await refused("QUATERNIUS_3D2DGE/Walk_Lop")).toEqual(["usage", "E_NO_CLIP", 'no clip "QUATERNIUS_3D2DGE/Walk_Lop"; did you mean "QUATERNIUS_3D2DGE/Walk_Loop"?']);
      expect(await refused("QUATERNIUS_3D2DGE/Walk")).toEqual(["usage", "E_NO_CLIP", 'no clip "QUATERNIUS_3D2DGE/Walk"; did you mean "QUATERNIUS_3D2DGE/Walk_Loop"?']);
      expect(await refused("QUATERNIUS_3D2D/Walk_Loop")).toEqual(["usage", "E_NO_SET", 'no set "QUATERNIUS_3D2D"; did you mean "QUATERNIUS_3D2DGE/Walk_Loop"?']);
      expect(await refused('{"format":"2.0","id":"DEMO/Bad","dur":0}')).toEqual(["usage", "E_CLIP", expect.stringMatching(/^the clip JSON is not a valid clip \(\d+ errors?\): /)]);
      writeFileSync(join(cwd, "bad.json"), "{");
      expect(await refused("bad.json")).toEqual(["error", "E_CLIP", expect.stringMatching(/^"bad.json" is not JSON/)]);
      expect(await refused("WORKSHOP/Pose")).toEqual(["usage", "E_NO_CLIP", expect.stringMatching(/^no workshop clip "WORKSHOP\/Pose" \(workshop\/Pose.json\)/)]);
      host.write!("workshop/Pose.json", JSON.stringify({ ...pose, id: "WORKSHOP/Pose" }));
      expect((await call("WORKSHOP/Pose")).data).toMatchObject({ id: "WORKSHOP/Pose", set: "WORKSHOP", tier: null, where: "workshop", H0: 916.7, resolved: "WORKSHOP/Pose" });
      // its rest and tier from its history while the history is the file's; a history set aside counts for nothing
      const rest = libraryAccess(cwd).library.about("QUATERNIUS_3D2DGE").sources[pose.restSrc]!.rest, text = JSON.stringify({ ...pose, id: "WORKSHOP/Pose" });
      workshopClip(cwd, "Pose", text, "QUATERNIUS_3D2DGE/A_TPose", { ...rest, H0: 900 });
      expect((await call("WORKSHOP/Pose")).data).toMatchObject({ tier: "cc0", H0: 900 });
      host.write!("workshop/Pose.json", `${text}\n`); // changed outside m3a
      expect((await call("WORKSHOP/Pose")).data).toMatchObject({ tier: null, H0: 916.7 });
      workshopClip(cwd, "Pose", text, "QUATERNIUS_3D2DGE/A_TPose", { ...rest, H0: 900, spine: [] as unknown as typeof rest.spine }); // a rest broken by hand
      expect((await call("WORKSHOP/Pose")).data).toMatchObject({ tier: null, H0: 916.7 });
    } finally {
      rm();
    }
  });
});
