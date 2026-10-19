// Exchange (PLAN.md WP-7.2b, D93): `import` fits a motion file's animations (.gltf, .glb, .bvh, .vrma) into a set under
// imports/<SET>/, a clip each with its fit (core's fit, as the library's re-import encodes it), its clips, catalog and
// manifest written as the library writes its own (@m3a/library's set writer), so the library opens it as a local set:
// seen by a game that opts in to local, never shipped (D10); `list` names what the file holds and writes nothing, and
// says when import refuses a glTF whose bones' names no bone map knows, or that lacks a joint the map its names follow
// needs (naming it, as io does). What one import fits is bounded before it fits: a take past MAX_TAKE is skipped, and
// takes past MAX_FIT in all, or past MAX_IMPORT_CLIPS, are refused. --license is an SPDX id, or a composed clip's ids
// joined with " AND " (D10). The license and credit a glTF-family file carries (each animation's extras, the asset's
// copyright) are used: a --license whose ids aren't the file's is refused, its fix the flag that takes them (ids
// compared as sets, case aside), and so is a known license id in another case; a note names each id whose text the
// library doesn't keep (license.check checks a composed license part by part). It writes and removes what the user
// keeps, so MCP lists it as no read-only tool; it removes only a clip an import wrote, naming it (and saying so in its
// verdict), and refuses a set whose directory holds any other .json. The manifest names the file by its own name (never
// a path); replies name it as clips.ts does. `export` plays a clip on a character (bound through core) and writes it as
// .vrma, .glb (the character's own document with the animation added) or .bvh under check-output/export/, named by the
// clip and the character, read back through io: the VRMA byte for byte, the others joint for joint (within 1 mm, else
// findings, as is a file that couldn't be read back); with the clip's license and the credit it owes (any license but
// CC0's owes one), which a .bvh can't carry.
import { format, playable, validate, validation, VERSION, type Clip } from "@m3a/core";
import { addAnimation, bvhGap, decodeVrma, describeGltf, encodeVrma, glbGap, gltfAnimOf, importSet, IoError, parseBvh, parseGlb, parseGltf, picksOf, posedOf, readBvh, readGltf, readGltfPosed, readVrma, rigBvh, skeletonDoc, skeletonOfGltf, writeBvh, writeVrma, type Catalog, type GltfDoc, type LibraryIn } from "@m3a/io";
import { setFiles, tierOf, withFacts } from "@m3a/library";
import { defineTool, ToolError, type LibraryAccess, type ToolContext } from "../registry/registry.ts";
import { quote } from "../registry/schema.ts";
import { bodyOf, CHARACTER, characterName, MAPPING, type MappingPatch } from "./body.ts";
import { boundHolds } from "./judge.ts";
import { given, loadClip, naming, parts, prose } from "./clips.ts";
import { ARROW, arg, call, capped, CLIP, count, cut, fileOrJson, imageName, mm, more, output, round, sec } from "./common.ts";

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
/** Whether `license` is one SPDX id, or a composed clip's: ids joined with " AND " (D10, as recipe.compile and edit
 *  write it, and m3a's exports carry it), each part an id (no other spacing). */
const isLicense = (license: string): boolean => license.split(" AND ").every((p) => SPDX.test(p));
/** The license ids the library knows: those D10's tier rule recognizes (tierOf: CC0-1.0, CC-BY-x.y,
 *  LicenseRef-CMU-Mocap) and those library/LICENSES/ keeps the text of (CC0-1.0, CC-BY-4.0, LicenseRef-CMU-Mocap). */
const KNOWN = ["CC0-1.0", "CC-BY-4.0", "LicenseRef-CMU-Mocap"];
/** The known license id `id` names in another case ("cc0-1.0": CC0-1.0), or undefined. */
const knownAs = (id: string): string | undefined => (/^cc-by-\d\.\d$/i.test(id) ? `CC-BY-${id.slice(6)}` : KNOWN.find((k) => k.toLowerCase() === id.toLowerCase()));
/** A license with each id as the library spells it (knownAs; any other as given), its parts joined as D10 joins them. */
const spelt = (license: string): string => parts(license).map((p) => knownAs(p) ?? p).join(" AND ");
/** A license's ids as a set (spelt, sorted, each once), so two that name the same ids compare equal: "CMU AND CC-BY"
 *  is "CC-BY AND CMU", and case alone never tells two apart. */
const idsOf = (license: string): string => [...new Set(parts(spelt(license)))].sort().join(" AND ");
/**
 * The longest take (s) one import fits; a longer one is skipped, to be cut with the catalog's "$pick". Core's fit is
 * about quadratic in a take's length: measured here, 30, 60 and 120 s takes took 2.3, 6.5 and 21 s (re-measured: 120 s,
 * 20.5 s, start-up included); 600 s took more than 300 s (and failed M2-E010 only after its fit).
 */
const MAX_TAKE = 120;
/** The most take time (s) one import fits in all: two takes at MAX_TAKE, about 42 s of fitting here. */
const MAX_FIT = 240;
/** The most takes one import fits: above the library's largest set (STYLE100_SIDE, 194 clips). */
const MAX_IMPORT_CLIPS = 500;
/** The bone maps import reads a file's names by (io's BVH reader's), as its refusal names them (and io's E_RIG). */
const MAPS = "MotionBuilder's and Mixamo's Hips, Spine, LeftUpLeg ..., Unreal's, Rigify's, 100STYLE's, Bandai Namco's, VRM's humanoid bones";
/** Each of io's bone maps by its id (io's E_RIG names it so), as a refusal names its bones' names. */
const MAP_NAMES: Record<string, string> = { motionbuilder: "MotionBuilder's (Mixamo's)", unreal: "Unreal's", rigify: "Rigify's", "100style": "100STYLE's", "bandai-namco": "Bandai Namco's", vrm: "VRM's" };
/** What io's E_RIG says of a file whose bones' names one bone map follows but that lacks joints the map needs (its
 *  message's words: "the <map> map needs joints the file lacks: <joints>"): the map's id and the joints, comma-separated;
 *  null for any other E_RIG (no map's names match). */
function lacking(err: ToolError): { map: string; joints: string } | null {
  const m = /\bthe ([\w-]+) map needs joints the file lacks: (.+)$/.exec(err.message);
  return m ? { map: m[1]!, joints: m[2]! } : null;
}

/** A path as a hint names it (clips.ts's naming): as given, quoted where a shell would split it, or `<whose file>` for
 *  an absolute path or one with a control character; prose (a refusal, a verdict, data) writes it without the brackets
 *  (`said`: "the motion file"). import's own path is "the motion"'s. */
const named = (path: string, whose: string): string => naming({ id: path, where: "file", path, name: null }, whose).as;
/** A path as prose names it: named's words without the brackets (clips.ts prose). */
const said = (path: string, whose: string): string => prose(named(path, whose));
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
 *  none when there is no such directory (a file in its place too, as the host's tryRead: its write then refuses it,
 *  naming the path as given); one leading out of the working directory refused (the host's E_PATH). */
function held(lib: LibraryAccess, set: string): string[] {
  try {
    return lib.source.files(set);
  } catch (err) {
    if (["ENOENT", "ENOTDIR"].includes((err as { code?: unknown } | null)?.code as string)) return [];
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

/** A file's own name (no directory; a control character as "_"), as the set's manifest records it (and a BVH take is
 *  named): never a path. A reader's refusal names the file as prose does (`said`), so two files of one name in two
 *  directories read apart. */
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

/** A glTF-family file read into its document (a .gltf as text, the rest as bytes), io's refusals naming it `label`. */
async function docAt(ctx: ToolContext, path: string, label: string): Promise<{ doc: GltfDoc; raw: string | Uint8Array }> {
  const raw = /\.gltf$/i.test(path) ? await ctx.read(path) : await ctx.bytes(path);
  return { doc: io(() => (typeof raw === "string" ? parseGltf(raw, label) : parseGlb(raw, label))), raw };
}

/** What a reader gave, as the library importSet fits (named `id`), and the reader's notes. */
type Read = { rig: string; clips: LibraryIn["clips"]; body?: LibraryIn["body"]; log?: string[]; warnings?: string[] };

/** A motion file read: its rig (null when no bone map knows it by name alone), its animations' names, the library
 *  importSet fits, with the reader's notes (the catalog's picks when it has them, else every animation whole), its glTF
 *  document (null for a .bvh), and whether its glTF is read by its bone names on io's bone maps (`posed`: no rig the
 *  exact reader knows), where a file whose names no map knows is refused (E_RIG). */
async function motionOf(ctx: ToolContext, path: string, kind: string, cat: Catalog | null): Promise<{ rig: string | null; names: string[]; doc: GltfDoc | null; posed: boolean; read(id: string): { lib: LibraryIn; log: string[] } }> {
  // the file as the manifest records it (and a BVH take is named), and as io's refusals name it
  const picks = cat?.$pick ? io(() => picksOf(cat)) : undefined, file = fileName(path), label = said(path, "the motion");
  // the rest of a reader that cuts takes as captures is its "_rest"; the exact glTF reader finds the file's rest clip
  const as = (read: () => Read, rest: string | undefined, rig?: string) => (id: string) => {
    const r = io(read);
    return { lib: { id, file, rig: rig ?? r.rig, clips: r.clips, body: r.body ?? null, ...(rest ? { rest } : {}) }, log: r.log ?? r.warnings ?? [] };
  };
  if (kind === "bvh") {
    const text = await ctx.read(path), take = file.replace(/\.bvh$/i, ""), rig = io(() => rigBvh(parseBvh(text, label), { file: label })).map;
    return { rig: `bvh:${rig}`, names: picks?.map((p) => p.name) ?? [take], doc: null, posed: false, read: as(() => readBvh(() => text, picks ?? [take]), "_rest") };
  }
  const { doc, raw } = await docAt(ctx, path, label), d = io(() => describeGltf(doc));
  if (kind === "vrma") return { rig: "gltf:vrm", names: d.clips, doc, posed: false, read: as(() => readVrma(raw as Uint8Array, { file: label, ...(picks ? { picks } : {}) }), "_rest") };
  // a rig the exact reader knows (Rigify's, Unreal's) is read as the library's re-import reads it, unless picks cut it
  if (d.rig && !picks) return { rig: `gltf:${d.rig}`, names: d.clips, doc, posed: false, read: as(() => readGltf(doc), undefined, `gltf:${d.rig}`) };
  return { rig: d.rig && `gltf:${d.rig}`, names: d.clips, doc, posed: !d.rig, read: as(() => readGltfPosed(doc, picks ? { picks } : {}), "_rest") };
}

/** The bone map a glTF's first animation is placed on by its names (io's BVH reader's, as readGltfPosed places it); when
 *  none takes them (io's E_RIG, by its code), the map its names follow and the joints it lacks (`lacking`), or null when
 *  no map's names match; undefined when the animation can't be read to tell (list then says no more than before; import
 *  refuses it with io's reason). */
function posedRig(doc: GltfDoc, label: string): string | { map: string; joints: string } | null | undefined {
  try {
    return io(() => rigBvh(posedOf(doc, 0, 30), { units: 1, file: label })).map;
  } catch (err) {
    if (!(err instanceof ToolError)) throw err;
    return err.code === "E_RIG" ? lacking(err) : undefined;
  }
}

/** What a glTF-family file says of its animations' terms: the licenses in the extras of those an import takes (its
 *  picks' takes, else every animation; those $skip leaves out not), and the credit to default to: an animation's
 *  extras.credit, else the asset's copyright (a .vrma's is its clip's; a .gltf's or .glb's may be a character's, so it
 *  comes last). Animation i is named as io's readers name it, `names[i]` (describeGltf's: two sharing a name are X and
 *  X_2), `animation<i>` when that gives none. */
function termsOf(doc: GltfDoc, names: readonly string[], cat: Catalog | null): { licenses: string[]; credit: string | undefined } {
  const takes = cat?.$pick ? new Set(Object.values(cat.$pick).map((p) => p[0])) : null, text = (v: unknown) => (typeof v === "string" && v.trim() ? v : undefined);
  const anims = (doc.json.animations ?? []).map((an, i) => ({ name: names[i] || `animation${i}`, extras: (an as { extras?: { license?: unknown; credit?: unknown } }).extras }))
    .filter((an) => (takes ? takes.has(an.name) : !cat?.$skip?.[an.name]));
  const licenses = [...new Set(anims.flatMap((an) => (text(an.extras?.license) ? [an.extras!.license as string] : [])))];
  const copyright = text((doc.json.asset as { copyright?: unknown } | undefined)?.copyright);
  return { licenses, credit: anims.map((an) => text(an.extras?.credit)).find((c) => c !== undefined) ?? copyright };
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
    // the file as a hint names it (`file`: <the motion file> for an absolute path) and as prose does (`it`)
    const kind = /\.(\w+)$/.exec(a.path)?.[1]!.toLowerCase() ?? "", file = named(a.path, "the motion"), it = prose(file), dir = `imports/${a.set}`;
    if (!KINDS.includes(kind)) throw new ToolError("E_ARGS", `${it} is no motion file: give a .gltf, .glb, .bvh or .vrma${kind === "fbx" ? " (convert FBX to .glb first)" : ""}`, true);
    if (!/^[A-Z][A-Z0-9_]*$/.test(a.set) || a.set === "WORKSHOP") throw new ToolError("E_ARGS", `set is the new set's name, A-Z, 0-9 and _ (as IMPORT), not ${quote(a.set)}`, true);
    if (!a.list && a.license === undefined) throw new ToolError("E_ARGS", "license is the file's SPDX id (CC0-1.0, CC-BY-4.0, ...), which each clip carries; list needs none", true);
    if (a.license !== undefined && !isLicense(a.license)) throw new ToolError("E_ARGS", `license ${quote(a.license)} is no SPDX id: CC0-1.0, CC-BY-4.0, ..., or LicenseRef-<name> for other terms; a composed clip's joins its ids with " AND "`, true);
    // a known id in another case: the library's tiers read an id exactly, so it would fall to local
    const known = a.license === undefined ? undefined : spelt(a.license);
    if (known !== undefined && known !== a.license) throw new ToolError("E_ARGS", `license ${quote(a.license)} is ${known} in another case, and the library reads an id exactly: did you mean \`--license ${arg(known)}\`?`, true);
    const lib = ctx.library();
    // an imported set (tier local, the manifest the library reads the one under imports/) is imported again in place; a
    // library set's name is the library's, even where imports/ holds a set so named, its manifest copied too (the
    // library's wins: it would go unseen)
    const theirs = lib.source.sets().includes(a.set) && (lib.library.about(a.set).tier !== "local" || lib.source.read(a.set, "_set.json") !== (await ctx.tryRead(`${dir}/_set.json`)));
    if (theirs) throw new ToolError("E_ARGS", `set ${a.set} is the library's: name the new set another way`, true);
    const got = a.catalog === undefined ? null : await fileOrJson(ctx, a.catalog, "the catalog");
    const cat = got && catalogOf(got.data, got.path === null), m = await motionOf(ctx, a.path, kind, cat), at = [file], glTF = kind === "gltf" || kind === "glb";
    // a glTF import can't read by its bones' names (no bone map knows them, or it lacks a joint the map they follow
    // needs): retarget.inspect binds it by its shape, export plays clips on it
    const byShape = `${call("retarget.inspect", [file])} binds it by its shape, if it is a character; ${call("export", ["QUATERNIUS_3D2DGE/Walk_Loop"], { character: given(file, a.path) })} plays a library clip on it`;
    if (a.list) {
      // a glTF no table names is placed on io's bone maps by its names, as import would read it, or refused: its names
      // following none, or one whose joints it lacks (data's rig null: import reads it as no rig)
      const from = a.from ?? 0, shown = capped(m.names.slice(from), 50), placed = m.posed && m.names.length ? posedRig(m.doc!, it) : undefined, refused = placed === null || typeof placed === "object";
      const rig = m.rig ?? (typeof placed === "string" ? `gltf:${placed}` : null);
      const rigLine = placed === null ? "rig: none import knows by its bone names; import refuses it" : typeof placed === "object" ? `rig gltf:${placed.map} lacks ${placed.joints}; import refuses it` : `rig ${rig ?? "unknown by name (import may refuse it)"}`;
      return {
        verdict: `import ${it}: ${count(m.names.length, "animation")}, ${rigLine}; nothing written`,
        data: { file: it, kind, rig, set: null, license: null, clips: shown.rows.map((name) => ({ name })), ...(shown.more ? { more: shown.more } : {}), skipped: [], notes: [], mean_fit: null, worst: null },
        lines: [...shown.rows, ...more(shown.more, "animation", `${call("import", at, { list: true, from: from + 50 })} lists them`)],
        next: refused ? byShape
          : m.names.length ? `${call("import", at, { set: a.set === "IMPORT" ? undefined : a.set, license: "<license>" })} fits them into ${dir}/`
          : `it holds no animation to import${glTF ? `; ${call("export", ["QUATERNIUS_3D2DGE/Walk_Loop"], { character: given(file, a.path) })} plays a library clip on it, if it is a character` : ""}`,
      };
    }
    // the license the file carries (each animation's extras, as m3a's VRMA and .glb exports write it) holds over the
    // call's: the ids each names compared as sets (idsOf), so a composed clip's and one in another case are the file's;
    // the fix passes the file's ids as the library spells them, quoted as a shell takes them (arg). One that names no
    // SPDX id can't be compared: a note says the clips carry the call's
    const license = a.license!, terms = m.doc ? termsOf(m.doc, m.names, cat) : { licenses: [], credit: undefined }, ids = terms.licenses.filter((l) => isLicense(spelt(l)));
    const stated = [...new Map(ids.map((l) => [idsOf(l), l])).values()], unread = terms.licenses.filter((l) => !ids.includes(l));
    if (stated.some((l) => idsOf(l) !== idsOf(license))) {
      const says = stated.join(" and "), fix = stated.length === 1 ? `pass \`--license ${arg(spelt(stated[0]!))}\`` : 'import the animations of each license apart, "$skip" leaving out the others';
      throw new ToolError("E_ARGS", `the file says its animations are ${says} (each animation's extras.license); --license ${license} contradicts it: ${fix}`, true);
    }
    // the catalog's first source names the library (its record kept); else the set does. A glTF read by its bones' names
    // that no bone map knows, or that lacks a joint the map its names follow needs (io's reason kept: the joints to
    // name), is refused by io's code, with the calls that take it by its shape
    const src = Object.keys(cat?.$sources ?? {})[0] ?? a.set;
    let read: ReturnType<typeof m.read>;
    try {
      read = m.read(src);
    } catch (err) {
      if (!(m.posed && err instanceof ToolError && err.code === "E_RIG")) throw err;
      const lacks = lacking(err), them = lacks?.joints.includes(",") ? ["bones", "them those names"] : ["bone", "it that name"];
      throw new ToolError("E_RIG", lacks
        ? `${it}: its bones follow ${MAP_NAMES[lacks.map] ?? `the ${lacks.map} map's`} names but lack ${lacks.joints}, which import needs: give the file's ${them[0]} for ${them[1]} (import reads a file by its bone names only)`
        : `${it}: its bones' names match none import knows (${MAPS}); import reads a file by its bone names only`, false, { next: byShape });
    }
    // what one import fits, bounded before it fits (the fit is about quadratic in a take's length): a take past MAX_TAKE
    // skipped, the takes left past MAX_FIT in all or MAX_IMPORT_CLIPS in number refused; a reader's rest ("_") and the
    // clips "$skip" leaves out aside
    const { lib: whole, log } = read, takes = Object.entries(whole.clips).filter(([n]) => !n.startsWith("_") && !cat?.$skip?.[n]);
    const long = new Map(takes.filter(([, c]) => c.dur > MAX_TAKE)), fits = takes.filter(([n]) => !long.has(n)), total = fits.reduce((t, [, c]) => t + c.dur, 0), inParts = "$skip some, or import them in parts into other sets";
    const longRows = [...long].map(([name, c]) => ({ name, why: `${round(c.dur, 1)} s long, past the ${MAX_TAKE} s one import fits; cut it with the catalog's "$pick" [take, from s, to s]` }));
    if (fits.length > MAX_IMPORT_CLIPS) throw new ToolError("E_ARGS", `${fits.length} takes to fit, past the ${MAX_IMPORT_CLIPS} one import fits; ${inParts}`, true);
    if (total > MAX_FIT) throw new ToolError("E_ARGS", `the takes to fit last ${Math.ceil(total * 10) / 10} s in all, past the ${MAX_FIT} s one import fits; ${inParts}`, true);
    // no clip comes out (each skipped, at most 20 named, the rest counted)
    const none = (rows: { name: string; why: string }[]) => {
      const cuts = capped(rows, 20);
      return new ToolError("E_NO_CLIP", `no clip came out of ${it}${rows.length ? `: ${cuts.rows.map((r) => `${r.name}: ${r.why}`).join("; ")}${cuts.more ? `; and ${cuts.more} more skipped` : ""}` : ""}`);
    };
    if (!fits.length && long.size) throw none([...longRows, ...Object.keys(whole.clips).filter((n) => cat?.$skip?.[n]).map((name) => ({ name, why: cut(cat!.$skip![name]!) }))]);
    const input = { ...whole, clips: Object.fromEntries(Object.entries(whole.clips).filter(([n]) => !long.has(n))) };
    const out = io(() => importSet([input], cat ?? {}, { name: a.set, credit: "", encode: ENCODE })), about = out.set.sources[src]!, base = input.file;
    const str = (k: string) => (typeof about[k] === "string" && (about[k] as string).trim() ? (about[k] as string) : undefined), label = str("label") ?? base, owed = owes(license);
    // the catalog's credit, else the file's own (its animation's, else its asset's copyright), else the label and license
    const credit = str("credit") ?? terms.credit ?? `${label}, ${license}`, made: Clip[] = [], names = Object.keys(out.set.clips), slugs = format.slugs(names);
    const skipped = [...longRows, ...out.report.skipped.map((s) => ({ name: s.name, why: cut(s.why) }))];
    let bad = false;
    names.forEach((name, i) => {
      const c1 = out.set.clips[name]!, clip = withFacts(format.fromFormat1(c1 as unknown as format.Clip1, { set: a.set, slug: slugs[i]!, name, fps: out.set.fps, restSrc: src, license, ...(owed ? { credit } : {}), fit: out.set.fit[name]!, producer: PRODUCER, qaVersion: "none" }), about.rest);
      const r = validate(clip, { mode: "read" });
      if (r.ok) return void made.push(clip);
      bad = true;
      skipped.push({ name, why: cut(validation.formatIssue(r.errors[0]!).replace(/\s*\n\s*/g, "; ")) });
    });
    const cutSkips = capped(skipped, 20);
    if (!made.length) throw none(skipped);
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
        if (!byImport(await ctx.tryRead(`${dir}/${f}`))) throw new ToolError("E_EXISTS", `${said(`${dir}/${f}`, "the")} is no clip m3a import wrote: move it out of ${dir}/, where the library reads each .json as one of the set's clips; nothing was changed`);
        gone.push(f);
      }
      for (const f of gone) ctx.remove(`${dir}/${f}`);
      for (const [f, t] of [...files].sort(([x], [y]) => Number(x === "_set.json") - Number(y === "_set.json"))) ctx.write(`${dir}/${f}`, t);
    } finally {
      release();
    }
    const rows = made.map((c) => ({ id: c.id, dur: c.dur, loop: c.loop, keys: c.keys.length, fit: c.quality.fit, over: c.quality.fit[0]! > LIMITS.mean || c.quality.fit[1]! > LIMITS.worst }));
    const worst = rows.reduce((w, r) => (r.fit[1]! > w.fit[1]! ? r : w)), mean = round(rows.reduce((s, r) => s + r.fit[0]!, 0) / rows.length, 1), over = rows.filter((r) => r.over).length;
    // the reader's and the fit's notes first, with the license ids whose text the library doesn't keep (license.check
    // needs each, a composed license's part by part)
    const unkept = parts(license).filter((id) => lib.licenseText(id) === null), free = unread.map((l) => `the file's extras.license ${quote(l)} is no SPDX id: its clips carry ${license}`);
    const why = unkept.map((id) => `${id}'s text isn't in library/LICENSES/: license.check fails the set`);
    const noted = capped([...why, ...free, ...out.report.warnings, ...log].map((w) => cut(w)), 5);
    const shown = capped(rows, 50), findings = bad || over > 0 || long.size > 0;
    return {
      verdict: `import ${it}: ${count(made.length, "clip")} into ${dir}/ (${input.rig}, tier local), fit ${mean} mm mean, worst ${mm(worst.fit[1]!)} (${worst.id})${skipped.length ? `; ${skipped.length} skipped` : ""}${over ? `; ${over} past the fit limits` : ""}${gone.length ? `; replaced ${count(gone.length, "clip file")} an earlier import wrote` : ""}`,
      data: { file: it, kind, rig: input.rig, set: a.set, dir: `${dir}/`, license, tier: "local", clips: shown.rows, ...(shown.more ? { more: shown.more } : {}), skipped: cutSkips.rows, notes: noted.rows, mean_fit: mean, worst: { id: worst.id, mm: worst.fit[1] }, ...(gone.length ? { removed: gone.length } : {}) },
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

/** `export`: a clip played on a character, written as .vrma, .glb or .bvh under check-output/export/ and read back,
 *  named `<clip id>-on-<character>` (the clip's id as sheet names its image; the character "tiny" or its file's own name
 *  without its extension), so one clip exported onto two characters makes two files. */
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
    boundHolds(clip, title); // no foot held past MAX_HOLD, nor feet's holds reread past MAX_REREAD, before it plays
    let bytes: Uint8Array, back: { mm: number | null; check: string };
    if (a.format === "vrma") {
      const v = io(() => writeVrma(clip, b, { fps })), again = io(() => encodeVrma(decodeVrma(v)));
      [bytes, back] = [v, { mm: null, check: again.length === v.length && again.every((x, i) => x === v[i]) ? "reads back byte for byte" : "reads back changed" }];
    } else if (a.format === "glb") {
      // the character's own document, each bone's node by its name (skeletonOfGltf's, as body.ts bound it)
      const { doc, nodes } = a.character === "tiny" ? skeletonDoc(b) : await (async () => {
        const { doc } = await docAt(ctx, a.character, prose(who)), g = io(() => skeletonOfGltf(doc));
        return { doc, nodes: Object.fromEntries(g.skeleton.bones.map((x, k) => [x.name, g.nodes[k]!])) };
      })();
      const glb = io(() => addAnimation(doc, gltfAnimOf(clip, b, doc, nodes, { fps })));
      [bytes, back] = [glb, readBack(() => glbGap(glb, clip, b, nodes, { fps }))];
    } else {
      const text = io(() => writeBvh(clip, b, { fps }));
      [bytes, back] = [new TextEncoder().encode(text), readBack(() => bvhGap(text, clip, b, { fps }))];
    }
    // named by the clip and the character (its file's own name: no directory, so never an absolute path)
    const on = a.character === "tiny" ? "tiny" : a.character.replace(/^[\s\S]*[\\/]/, "").replace(/\.[^.]*$/, "");
    const file = ctx.write(`check-output/export/${imageName(`${ref.id}-on-${on}`).replace(/[^\w.-]/g, "_")}.${a.format}`, bytes);
    // the license it carries, and the credit owed where it plays: its set's line for a library clip, else its own
    const p = ref.clip.provenance, tier = ref.tier ?? tierOf(p.license), owed = owes(p.license);
    const credit = owed ? (ref.where === "library" ? ctx.library().library.about(ref.set).credit : p.credit)?.trim() || null : null;
    const off = back.check === "reads back changed" || (back.mm ?? 0) > 1, unchecked = a.format !== "vrma" && back.mm === null, issues = capped(report.issues, 3);
    return {
      verdict: `export ${title} on ${prose(who)} ${ARROW} ${file}: ${round(bytes.length / 1000, 1)} kB, ${frames} frames at ${fps} fps; ${back.check}; ${p.license}${credit ? ", credit owed" : ""}`,
      data: { clip: ref.id, character: prose(who), file, format: a.format, bytes: bytes.length, frames, fps, dur: clip.dur, loop: clip.loop, bones: { joints: b.order.length, humanoid: Object.keys(b.bones).length }, check: back.check, roundtrip_mm: back.mm, license: { spdx: p.license, tier, credit } },
      lines: [
        `license: ${p.license} (${tier}); ${credit ? `credit owed: ${credit}` : owed ? "credit owed, none given" : "no credit owed"}`,
        ...(tier === "cmu" ? ["CMU's terms: no reselling the data, even converted (D10)"] : []),
        ...(a.format === "bvh" ? ["the .bvh carries no license or credit: keep this reply's license line with it"] : []),
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
