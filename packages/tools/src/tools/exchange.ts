// Exchange (PLAN.md WP-7.2b, D93): `import` fits a motion file's animations (.gltf, .glb, .bvh, .vrma) into a set under
// imports/<SET>/, a clip each with its fit (core's fit, as the library's re-import encodes it), its clips, catalog and
// manifest written as the library writes its own (@m3a/library's set writer), so the library opens it as a local set:
// seen by a game that opts in to local, never shipped (D10); `list` names what the file holds and writes nothing. It
// writes and removes what the user keeps, so MCP lists it as no read-only tool; it removes only a clip an import wrote,
// naming it, and refuses a set whose directory holds any other .json. The manifest names the file by its own name
// (never a path); replies name it as clips.ts does. `export` plays a clip on a character (bound through core) and
// writes it as .vrma, .glb (the character's own document with the animation added) or .bvh under check-output/export/,
// read back through io: the VRMA byte for byte, the others joint for joint (within 1 mm, else findings, as is a file
// that couldn't be read back); with the clip's license and the credit it owes (any license but CC0's owes one).
import { format, playable, validate, validation, VERSION, type Clip } from "@m3a/core";
import { addAnimation, bvhGap, decodeVrma, describeGltf, encodeVrma, glbGap, gltfAnimOf, importSet, IoError, parseBvh, parseGlb, parseGltf, picksOf, readBvh, readGltf, readGltfPosed, readVrma, rigBvh, skeletonDoc, skeletonOfGltf, writeBvh, writeVrma, type Catalog, type GltfDoc, type LibraryIn } from "@m3a/io";
import { setFiles, tierOf, withFacts } from "@m3a/library";
import { defineTool, ToolError, type LibraryAccess, type ToolContext } from "../registry/registry.ts";
import { quote } from "../registry/schema.ts";
import { bodyOf, CHARACTER, characterName, MAPPING, type MappingPatch } from "./body.ts";
import { given, loadClip, naming, parts } from "./clips.ts";
import { ARROW, call, capped, CLIP, count, cut, fileOrJson, imageName, mm, more, output, round, sec } from "./common.ts";

/** The motion files import reads, by extension. */
const KINDS = ["gltf", "glb", "bvh", "vrma"];
/** Format 2's degrees of freedom an imported clip is fitted with, as the library's re-import fits them (tools/import). */
const ENCODE = { hands: true, spine: true, yaw: true, steadyTwist: true, closeLoop: true } as const;
/** The re-import's fit limits (mm): a clip's mean and worst; a clip past them is flagged. */
const LIMITS = { mean: 40, worst: 300 } as const;
/** What writes an imported set and its clips. */
const PRODUCER = { tool: "m3a import", version: VERSION };
/** An SPDX license id, or a LicenseRef- for terms SPDX doesn't list (the library's rule). */
const SPDX = /^(LicenseRef-[A-Za-z0-9.-]+|[A-Za-z0-9][A-Za-z0-9.+-]*)$/;

/** A path as a reply names it (clips.ts's naming): as given, quoted where a shell would split it, or `<whose file>` for
 *  an absolute path or one with a control character. */
const named = (path: string, whose = "the"): string => naming({ id: path, where: "file", path, name: null }, whose).as;
/** Whether a license owes a credit where its clips are used: any but CC0's (CC BY's, CMU's, a share-alike's or a
 *  non-commercial one's, MIT's notice), each part of a composed clip's. */
const owes = (license: string): boolean => parts(license).some((x) => x !== "CC0-1.0");
/** `f`'s io refusal as a tool's: an error, since the file is wrong, not the call. */
function io<T>(f: () => T): T {
  try {
    return f();
  } catch (err) {
    throw err instanceof IoError ? new ToolError(err.code, err.message) : err;
  }
}

/** The files imports/<SET>/ holds as the host lists them (a set the library leaves out too: a first import cut short),
 *  none when there is no such directory; one leading out of the working directory refused (the host's E_PATH). */
function held(lib: LibraryAccess, set: string): string[] {
  try {
    return lib.source.files(set);
  } catch (err) {
    if ((err as { code?: unknown } | null)?.code === "ENOENT") return [];
    throw err;
  }
}

/** Whether `text` is a clip `m3a import` wrote (its producer's), which a later import of its set may remove. */
function byImport(text: string | null): boolean {
  try {
    return (JSON.parse(text ?? "") as { provenance?: { producer?: { tool?: unknown } } } | null)?.provenance?.producer?.tool === PRODUCER.tool;
  } catch {
    return false;
  }
}

/** A file's own name (no directory; a control character as "_"), as a reader names it in a refusal and the set's
 *  manifest records it: never a path. */
const fileName = (path: string): string => path.replace(/^.*[\\/]/, "").replace(/\p{Cc}/gu, "_");

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
/** The catalog as importSet reads it, or E_ARGS naming the first entry off its shape (usage when it was given inline,
 *  an error when it is a file). */
function catalogOf(data: unknown, inline: boolean): Catalog {
  const bad = (what: string, v?: unknown) => new ToolError("E_ARGS", `catalog: ${what}${v === undefined ? "" : `, not ${cut(JSON.stringify(v), 40)}`}`, inline);
  if (!isObj(data)) throw bad('a JSON object: "$sources", "$pick", "$skip", and a clip\'s ["tags", "what it does"]');
  for (const [k, v] of Object.entries(data)) {
    if (k === "$sources" && !(isObj(v) && Object.values(v).every(isObj))) throw bad('"$sources" gives each source its {"label", "license", "credit", ...}', v);
    if (k === "$skip" && !(isObj(v) && Object.values(v).every((x) => typeof x === "string"))) throw bad('"$skip" gives each clip left out its reason', v);
    if (k === "$pick") {
      if (!isObj(v)) throw bad('"$pick" gives each clip its [take, from s, to s, shortest cycle s]', v);
      for (const [n, p] of Object.entries(v)) if (!(Array.isArray(p) && p.length <= 4 && typeof p[0] === "string" && p.slice(1).every((x) => typeof x === "number" && Number.isFinite(x)))) throw bad(`"$pick" ${quote(n)} is [take, from s, to s, shortest cycle s]`, p);
    }
    if (!k.startsWith("$") && !(Array.isArray(v) && v.length >= 1 && v.length <= 3 && v.every((x) => typeof x === "string"))) throw bad(`${quote(k)} is ["tags", "what it does"]`, v);
  }
  return data as Catalog;
}

/** A glTF-family file read into its document (a .gltf as text, the rest as bytes). */
async function docAt(ctx: ToolContext, path: string): Promise<{ doc: GltfDoc; raw: string | Uint8Array }> {
  const raw = /\.gltf$/i.test(path) ? await ctx.read(path) : await ctx.bytes(path);
  return { doc: io(() => (typeof raw === "string" ? parseGltf(raw, fileName(path)) : parseGlb(raw, fileName(path)))), raw };
}

/** What a reader gave, as the library importSet fits (named `id`), and the reader's notes. */
type Read = { rig: string; clips: LibraryIn["clips"]; body?: LibraryIn["body"]; log?: string[]; warnings?: string[] };

/** A motion file read: its rig (null when no bone map knows it by name alone), its animations' names, and the library
 *  importSet fits, with the reader's notes (the catalog's picks when it has them, else every animation whole). */
async function motionOf(ctx: ToolContext, path: string, kind: string, cat: Catalog | null): Promise<{ rig: string | null; names: string[]; read(id: string): { lib: LibraryIn; log: string[] } }> {
  const picks = cat?.$pick ? io(() => picksOf(cat)) : undefined, file = fileName(path);
  // the rest of a reader that cuts takes as captures is its "_rest"; the exact glTF reader finds the file's rest clip
  const as = (read: () => Read, rest: string | undefined, rig?: string) => (id: string) => {
    const r = io(read);
    return { lib: { id, file, rig: rig ?? r.rig, clips: r.clips, body: r.body ?? null, ...(rest ? { rest } : {}) }, log: r.log ?? r.warnings ?? [] };
  };
  if (kind === "bvh") {
    const text = await ctx.read(path), take = file.replace(/\.bvh$/i, ""), rig = io(() => rigBvh(parseBvh(text, file), { file })).map;
    return { rig: `bvh:${rig}`, names: picks?.map((p) => p.name) ?? [take], read: as(() => readBvh(() => text, picks ?? [take]), "_rest") };
  }
  const { doc, raw } = await docAt(ctx, path), d = io(() => describeGltf(doc));
  if (kind === "vrma") return { rig: "gltf:vrm", names: d.clips, read: as(() => readVrma(raw as Uint8Array, { file, ...(picks ? { picks } : {}) }), "_rest") };
  // a rig the exact reader knows (Rigify's, Unreal's) is read as the library's re-import reads it, unless picks cut it
  if (d.rig && !picks) return { rig: `gltf:${d.rig}`, names: d.clips, read: as(() => readGltf(doc), undefined, `gltf:${d.rig}`) };
  return { rig: d.rig && `gltf:${d.rig}`, names: d.clips, read: as(() => readGltfPosed(doc, picks ? { picks } : {}), "_rest") };
}

/** The format legend's lines a set's manifest carries: the first set's, by name, that has them. */
function legendOf(lib: LibraryAccess): string[] {
  for (const set of lib.source.sets().sort()) {
    const legend = lib.library.about(set).legend;
    if (legend.length) return legend;
  }
  return [];
}

/** `import`: a motion file's animations fitted into clips of a local set under imports/<SET>/, or, with list, named. */
export const importMotion = defineTool<{ path: string; set: string; license?: string; catalog?: string; list: boolean; from?: number }, unknown>({
  name: "import",
  description: "Fit a motion file's animations (.gltf .glb .bvh .vrma) into imports/<SET>/, a local set, each with its fit; list names them.",
  params: {
    type: "object",
    properties: { path: { type: "string" }, set: { type: "string", default: "IMPORT" }, license: { type: "string", description: "SPDX id" }, catalog: { type: "string", description: "$pick, $skip, tags (.json)" }, list: { type: "boolean", default: false }, from: { type: "integer", minimum: 0, description: "list's first" } },
    required: ["path"],
  },
  output: output({ file: "string", kind: "string", rig: "string?", set: "string?", license: "string?", clips: "array", skipped: "array", notes: "array", mean_fit: "number?", worst: "object?" }),
  positionals: ["path"],
  examples: [{ args: { path: "spec/vectors/tier1b/rig.gltf", license: "CC0-1.0" } }],
  writes: true,
  async run(a, ctx) {
    const kind = /\.(\w+)$/.exec(a.path)?.[1]!.toLowerCase() ?? "", file = named(a.path), dir = `imports/${a.set}`;
    if (!KINDS.includes(kind)) throw new ToolError("E_ARGS", `${file} is no motion file: give a .gltf, .glb, .bvh or .vrma${kind === "fbx" ? " (convert FBX to .glb first)" : ""}`, true);
    if (!/^[A-Z][A-Z0-9_]*$/.test(a.set) || a.set === "WORKSHOP") throw new ToolError("E_ARGS", `set is the new set's name, A-Z, 0-9 and _ (as IMPORT), not ${quote(a.set)}`, true);
    if (!a.list && a.license === undefined) throw new ToolError("E_ARGS", "license is the file's SPDX id (CC0-1.0, CC-BY-4.0, ...), which each clip carries; list needs none", true);
    if (a.license !== undefined && !SPDX.test(a.license)) throw new ToolError("E_ARGS", `license ${quote(a.license)} is no SPDX id: CC0-1.0, CC-BY-4.0, ..., or LicenseRef-<name> for other terms`, true);
    const lib = ctx.library();
    // an imported set (tier local, the manifest the library reads the one under imports/) is imported again in place; a
    // library set's name is the library's, even where imports/ holds a set so named, its manifest copied too (the
    // library's wins: it would go unseen)
    const theirs = lib.source.sets().includes(a.set) && (lib.library.about(a.set).tier !== "local" || lib.source.read(a.set, "_set.json") !== (await ctx.tryRead(`${dir}/_set.json`)));
    if (theirs) throw new ToolError("E_ARGS", `set ${a.set} is the library's: name the new set another way`, true);
    const got = a.catalog === undefined ? null : await fileOrJson(ctx, a.catalog, "the catalog");
    const cat = got && catalogOf(got.data, got.path === null), m = await motionOf(ctx, a.path, kind, cat), at = [file];
    if (a.list) {
      const from = a.from ?? 0, shown = capped(m.names.slice(from), 50), glTF = kind === "gltf" || kind === "glb";
      return {
        verdict: `import ${file}: ${count(m.names.length, "animation")}, rig ${m.rig ?? "unknown by name (import may refuse it)"}; nothing written`,
        data: { file, kind, rig: m.rig, set: null, license: null, clips: shown.rows.map((name) => ({ name })), ...(shown.more ? { more: shown.more } : {}), skipped: [], notes: [], mean_fit: null, worst: null },
        lines: [...shown.rows, ...more(shown.more, "animation", `${call("import", at, { list: true, from: from + 50 })} lists them`)],
        next: m.names.length
          ? `${call("import", at, { set: a.set === "IMPORT" ? undefined : a.set, license: "<license>" })} fits them into ${dir}/`
          : `it holds no animation to import${glTF ? `; ${call("export", ["QUATERNIUS_3D2DGE/Walk_Loop"], { character: given(file, a.path) })} plays a library clip on it, if it is a character` : ""}`,
      };
    }
    // the catalog's first source names the library (its record kept); else the set does
    const src = Object.keys(cat?.$sources ?? {})[0] ?? a.set, { lib: input, log } = m.read(src), license = a.license!;
    const out = io(() => importSet([input], cat ?? {}, { name: a.set, credit: "", encode: ENCODE })), about = out.set.sources[src]!, base = input.file;
    const str = (k: string) => (typeof about[k] === "string" && (about[k] as string).trim() ? (about[k] as string) : undefined), label = str("label") ?? base, owed = owes(license);
    const credit = str("credit") ?? `${label}, ${license}`, made: Clip[] = [], skipped = out.report.skipped.map((s) => ({ name: s.name, why: cut(s.why) })), names = Object.keys(out.set.clips), slugs = format.slugs(names);
    let bad = false;
    names.forEach((name, i) => {
      const c1 = out.set.clips[name]!, clip = withFacts(format.fromFormat1(c1 as unknown as format.Clip1, { set: a.set, slug: slugs[i]!, name, fps: out.set.fps, restSrc: src, license, ...(owed ? { credit } : {}), fit: out.set.fit[name]!, producer: PRODUCER, qaVersion: "none" }), about.rest);
      const r = validate(clip, { mode: "read" });
      if (r.ok) return void made.push(clip);
      bad = true;
      skipped.push({ name, why: cut(validation.formatIssue(r.errors[0]!).replace(/\s*\n\s*/g, "; ")) });
    });
    const cutSkips = capped(skipped, 20), also = cutSkips.more ? `; and ${cutSkips.more} more skipped` : "";
    if (!made.length) throw new ToolError("E_NO_CLIP", `no clip came out of ${file}${skipped.length ? `: ${cutSkips.rows.map((s) => `${s.name}: ${s.why}`).join("; ")}${also}` : ""}`);
    const manifest = {
      set: a.set,
      title: `${base}, imported`,
      format: "2.0",
      tier: "local",
      content: { edition: base, importer: `${PRODUCER.tool} ${PRODUCER.version}, from ${kind} (${input.rig})` },
      credit,
      producer: PRODUCER,
      sources: { [src]: { label, origin: str("origin") ?? `${base}, imported by m3a import`, license, ...(str("license") && str("license") !== license ? { terms: str("license") } : {}), url: str("url") ?? "", ...(owed ? { credit } : {}), file: base, rig: input.rig, rest: about.rest } },
      ...(out.set.body ? { body: out.set.body } : {}),
      legend: { version: "2.0", text: legendOf(lib) },
    };
    // one import of a set at a time. The set's content id covers each .json its directory holds, so each this import
    // doesn't write goes: a clip an import wrote (whatever set it names: one copied under another name); any other (a
    // catalog kept there) refuses the import before anything changes. The manifest last, once its clips are there
    const files = setFiles(manifest, made), release = await ctx.lock(`.m3a/locks/import-${a.set}.lock`), gone: string[] = [];
    try {
      for (const f of held(lib, a.set).filter((f) => f.endsWith(".json") && !f.startsWith("_") && !files.has(f)).sort()) {
        if (!byImport(await ctx.tryRead(`${dir}/${f}`))) throw new ToolError("E_EXISTS", `${named(`${dir}/${f}`)} is no clip m3a import wrote: move it out of ${dir}/, where the library reads each .json as one of the set's clips; nothing was changed`);
        gone.push(f);
      }
      for (const f of gone) ctx.remove(`${dir}/${f}`);
      for (const [f, t] of [...files].sort(([x], [y]) => Number(x === "_set.json") - Number(y === "_set.json"))) ctx.write(`${dir}/${f}`, t);
    } finally {
      release();
    }
    const rows = made.map((c) => ({ id: c.id, dur: c.dur, loop: c.loop, keys: c.keys.length, fit: c.quality.fit, over: c.quality.fit[0]! > LIMITS.mean || c.quality.fit[1]! > LIMITS.worst }));
    const worst = rows.reduce((w, r) => (r.fit[1]! > w.fit[1]! ? r : w)), mean = round(rows.reduce((s, r) => s + r.fit[0]!, 0) / rows.length, 1), over = rows.filter((r) => r.over).length;
    // the reader's and the fit's notes first, with the license's text the library doesn't keep (license.check needs it)
    const kept = lib.licenseText(license) !== null, noted = capped([...(kept ? [] : [`${license}'s text isn't in library/LICENSES/: license.check fails the set`]), ...out.report.warnings, ...log].map((w) => cut(w)), 5);
    const shown = capped(rows, 50), findings = bad || over > 0;
    return {
      verdict: `import ${file}: ${count(made.length, "clip")} into ${dir}/ (${input.rig}, tier local), fit ${mean} mm mean, worst ${mm(worst.fit[1]!)} (${worst.id})${skipped.length ? `; ${skipped.length} skipped` : ""}${over ? `; ${over} past the fit limits` : ""}`,
      data: { file, kind, rig: input.rig, set: a.set, dir: `${dir}/`, license, tier: "local", clips: shown.rows, ...(shown.more ? { more: shown.more } : {}), skipped: cutSkips.rows, notes: noted.rows, mean_fit: mean, worst: { id: worst.id, mm: worst.fit[1] }, ...(gone.length ? { removed: gone.length } : {}) },
      lines: [
        ...noted.rows.map((w) => `note: ${w}`),
        ...more(noted.more, "note"),
        ...(gone.length ? [`removed ${count(gone.length, "clip file")} this import doesn't make: ${cut(gone.map(fileName).join(", "), 50)}`] : []),
        ...shown.rows.map((r) => `${r.id} ${sec(r.dur)} ${r.loop ? "loop" : "once"}, ${count(r.keys, "key")}, fit ${r.fit[0]}/${r.fit[1]} mm${r.over ? ` (past ${LIMITS.mean}/${LIMITS.worst} mm)` : ""}`),
        ...more(shown.more, "clip"),
        ...cutSkips.rows.map((s) => `skipped ${s.name}: ${s.why}`),
        ...more(cutSkips.more, "skipped clip"),
      ],
      findings,
      next: findings
        ? `cut a take with the catalog's "$pick", or leave a clip out with "$skip" and its reason, then ${call("import", at, { set: a.set, license, catalog: got === null ? "<catalog>" : got.path === null ? "<the catalog's JSON>" : given(named(got.path, "the catalog's"), got.path) })}`
        : `${call("license.check", [], { set: a.set })} fails it for a shipped game (D10: local); to use it here, set "tiers" to include "local" and "ships": false in game.json, then ${call("metrics", [worst.id])}`,
    };
  },
});

/** A written file read back through io: how far its joints land from the Animator's (mm, 4 decimals), and the check's
 *  words (a bound in thousandths of a mm); null with why when io can't read it back (one past io's limits). */
function readBack(gap: () => number): { mm: number | null; check: string } {
  try {
    const g = gap();
    return { mm: round(g, 4), check: `read back, its joints within ${Math.max(1, Math.ceil(g * 1000)) / 1000} mm` };
  } catch (err) {
    if (err instanceof IoError) return { mm: null, check: `not read back: ${err.message}` };
    throw err;
  }
}

/** `export`: a clip played on a character, written as .vrma, .glb or .bvh under check-output/export/ (named by the
 *  clip's id, as sheet names its image) and read back. */
export const exportClip = defineTool<{ clip: string; character: string; format: "vrma" | "glb" | "bvh"; mapping?: MappingPatch }, unknown>({
  name: "export",
  description: "Play a clip on a character and write it as .vrma, .glb or .bvh in check-output/export/, read back to check it.",
  params: { type: "object", properties: { clip: CLIP, character: CHARACTER, format: { type: "string", enum: ["vrma", "glb", "bvh"], default: "vrma" }, mapping: MAPPING }, required: ["clip", "character"] },
  output: output({ clip: "string", character: "string", file: "string", format: "string", bytes: "integer", frames: "integer", fps: "integer", dur: "number", loop: "boolean", bones: "object", check: "string", roundtrip_mm: "number?", license: "object" }),
  positionals: ["clip"],
  examples: [{ args: { clip: "QUATERNIUS_3D2DGE/Walk_Loop", character: "spec/vectors/tier1b/rig.gltf" } }],
  async run(a, ctx) {
    const ref = await loadClip(ctx, a.clip), { as, title } = naming(ref), who = characterName(a.character), { bound: b, report } = await bodyOf(ctx, a.character, a.mapping);
    const clip = playable(ref.clip, ref.rest), fps = 30, frames = Math.max(1, Math.ceil(clip.dur * fps)) + 1;
    let bytes: Uint8Array, back: { mm: number | null; check: string };
    if (a.format === "vrma") {
      const v = io(() => writeVrma(clip, b, { fps })), again = io(() => encodeVrma(decodeVrma(v)));
      [bytes, back] = [v, { mm: null, check: again.length === v.length && again.every((x, i) => x === v[i]) ? "reads back byte for byte" : "reads back changed" }];
    } else if (a.format === "glb") {
      // the character's own document, each bone's node by its name (skeletonOfGltf's, as body.ts bound it)
      const { doc, nodes } = a.character === "tiny" ? skeletonDoc(b) : await (async () => {
        const { doc } = await docAt(ctx, a.character), g = io(() => skeletonOfGltf(doc));
        return { doc, nodes: Object.fromEntries(g.skeleton.bones.map((x, k) => [x.name, g.nodes[k]!])) };
      })();
      const glb = io(() => addAnimation(doc, gltfAnimOf(clip, b, doc, nodes, { fps })));
      [bytes, back] = [glb, readBack(() => glbGap(glb, clip, b, nodes, { fps }))];
    } else {
      const text = io(() => writeBvh(clip, b, { fps }));
      [bytes, back] = [new TextEncoder().encode(text), readBack(() => bvhGap(text, clip, b, { fps }))];
    }
    const file = ctx.write(`check-output/export/${imageName(ref.id).replace(/[^\w.-]/g, "_")}.${a.format}`, bytes);
    // the license it carries, and the credit owed where it plays: its set's line for a library clip, else its own
    const p = ref.clip.provenance, tier = ref.tier ?? tierOf(p.license), owed = owes(p.license);
    const credit = owed ? (ref.where === "library" ? ctx.library().library.about(ref.set).credit : p.credit)?.trim() || null : null;
    const off = back.check === "reads back changed" || (back.mm ?? 0) > 1, unchecked = a.format !== "vrma" && back.mm === null, issues = capped(report.issues, 3);
    return {
      verdict: `export ${title} on ${who} ${ARROW} ${file}: ${round(bytes.length / 1000, 1)} kB, ${frames} frames at ${fps} fps; ${back.check}; ${p.license}${credit ? ", credit owed" : ""}`,
      data: { clip: ref.id, character: who, file, format: a.format, bytes: bytes.length, frames, fps, dur: clip.dur, loop: clip.loop, bones: { joints: b.order.length, humanoid: Object.keys(b.bones).length }, check: back.check, roundtrip_mm: back.mm, license: { spdx: p.license, tier, credit } },
      lines: [
        `license: ${p.license} (${tier}); ${credit ? `credit owed: ${credit}` : owed ? "credit owed, none given" : "no credit owed"}`,
        ...(tier === "cmu" ? ["CMU's terms: no reselling the data, even converted (D10)"] : []),
        ...issues.rows.map((i) => `character: ${i}`),
        ...more(issues.more, "character issue", `${call("retarget.inspect", [who], { mapping: a.mapping })} lists them`),
        `${sec(clip.dur)} ${clip.loop ? "loop" : "once"}, ${count(b.order.length, "joint")} (${Object.keys(b.bones).length} humanoid)`,
      ],
      findings: off || unchecked,
      next: off
        ? a.format === "glb"
          ? `it reads back off: a node above its bones may scale unevenly, which no glTF animation follows (else report it: a bug); ${call("export", [as], { character: given(who, a.character), format: "bvh", mapping: a.mapping })} writes one that reads back`
          : `it reads back off: a bug in the ${a.format} writer; report the clip, the character and this reply`
        : unchecked
          ? `check it in a glTF viewer by eye; ${call("export", [as], { character: given(who, a.character), format: "bvh", mapping: a.mapping })} writes one io reads back`
          : `open it in a ${a.format === "vrma" ? "VRM" : a.format === "glb" ? "glTF" : "BVH"} viewer; ${call("license.check", [], { clips: [ref.where === "file" ? given(as, ref.path!) : as] })} before shipping it`,
    };
  },
});
