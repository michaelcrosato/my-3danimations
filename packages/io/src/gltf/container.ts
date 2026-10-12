// glTF 2.0 containers (PLAN.md WP-5.2): a binary .glb (a 12-byte header, a JSON chunk, an optional BIN chunk) or a
// .gltf JSON whose buffer is embedded as a base64 data: URI, read into the same pair: the document and its buffer.
// Every length is checked against the bytes before it is used; an external buffer URI is refused (a reader never
// fetches); chunks of other types are skipped, as the spec says. The JSON's parts the readers use are checked for the
// shapes glTF gives them before anything reads them, so a field of the wrong type is named rather than tripped over.
// `packGlb` writes the binary form back: JSON padded with spaces, the buffer with zeros, to 4 bytes.
import { Bytes, IoError, LIMITS } from "../bytes.ts";

/** The parts of a glTF document the readers use (the rest is kept as read). */
export interface GltfJson {
  asset?: { version?: string };
  nodes?: GltfNode[];
  animations?: { name?: string; channels: { sampler: number; target: { node?: number; path: string } }[]; samplers: { input: number; output: number; interpolation?: string }[] }[];
  accessors?: { bufferView?: number; byteOffset?: number; componentType: number; count: number; type: string; normalized?: boolean }[];
  bufferViews?: { buffer: number; byteOffset?: number; byteLength: number; byteStride?: number }[];
  buffers?: { byteLength: number; uri?: string }[];
  skins?: { joints: number[]; inverseBindMatrices?: number }[];
  meshes?: { primitives: { attributes: Record<string, number>; material?: number }[] }[];
  materials?: { name?: string }[];
  extensionsUsed?: string[];
  extensionsRequired?: string[];
  extensions?: Record<string, unknown>;
  [k: string]: unknown;
}
/** One node: its name, children, local transform, and the mesh and skin it carries. */
export interface GltfNode {
  name?: string;
  children?: number[];
  translation?: number[];
  rotation?: number[];
  scale?: number[];
  matrix?: number[];
  mesh?: number;
  skin?: number;
  extras?: unknown;
}
/** A document and its one buffer (null when it has none). */
export interface GltfDoc {
  json: GltfJson;
  bin: Bytes | null;
}

const MAGIC = 0x46546c67, JSON_CHUNK = 0x4e4f534a, BIN_CHUNK = 0x004e4942;

/** A binary glTF (.glb). */
export function parseGlb(input: Uint8Array, file?: string): GltfDoc {
  const b = new Bytes(input, file);
  if (b.length < 20) throw new IoError("E_FORMAT", "not a binary glTF: shorter than its 12-byte header and a chunk header", { offset: 0, file });
  if (b.u32(0) !== MAGIC) throw new IoError("E_FORMAT", "not a binary glTF (.glb): its first 4 bytes aren't 'glTF'", { offset: 0, file });
  if (b.u32(4) !== 2) throw new IoError("E_FORMAT", `glTF version ${b.u32(4)}; only version 2 is read`, { offset: 4, file });
  const total = b.u32(8);
  if (total > b.length) throw new IoError("E_BOUNDS", `its header says ${total} bytes; the file has ${b.length}`, { offset: 8, file });
  const jsonLen = b.u32(12);
  if (b.u32(16) !== JSON_CHUNK) throw new IoError("E_FORMAT", "its first chunk isn't JSON", { offset: 16, file });
  const json = parseJson(b.text(20, jsonLen, "the JSON chunk"), file, 20);
  let bin: Bytes | null = null;
  // the chunks after the JSON: the first BIN is the buffer; other types are skipped
  for (let at = 20 + jsonLen; at + 8 <= total; ) {
    const len = b.u32(at), type = b.u32(at + 4);
    b.check(at + 8, len, "a chunk");
    if (type === BIN_CHUNK && !bin) bin = b.sub(at + 8, len, "the BIN chunk");
    at += 8 + len + ((4 - (len % 4)) % 4);
  }
  return { json, bin };
}

/** A .gltf document whose buffer, if any, is embedded as a base64 data: URI. */
export function parseGltf(text: string, file?: string): GltfDoc {
  const json = parseJson(text, file);
  const buffers = json.buffers ?? [];
  if (buffers.length > 1) throw new IoError("E_FORMAT", `${buffers.length} buffers; one is read`, { file });
  if (!buffers.length) return { json, bin: null };
  const uri = buffers[0]!.uri;
  if (uri === undefined) throw new IoError("E_MISSING", "its buffer has no uri (a .glb's BIN chunk holds it)", { file });
  if (!/^data:/i.test(uri)) throw new IoError("E_MISSING", "its buffer is outside the file (an external uri): a reader never fetches; embed it, or pack a .glb", { file });
  const m = /^data:[\w/.+-]*;base64,([A-Za-z0-9+/]*={0,2})$/.exec(uri);
  if (!m) throw new IoError("E_FORMAT", "its embedded buffer isn't base64 (a data: uri with ;base64, and base64 digits)", { file });
  if (m[1]!.length > (LIMITS.file * 4) / 3) throw new IoError("E_LIMIT", "its embedded buffer is over the file limit", { file });
  let raw: string;
  try {
    raw = atob(m[1]!);
  } catch {
    throw new IoError("E_FORMAT", "its embedded buffer isn't valid base64", { file });
  }
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  if (bytes.length < buffers[0]!.byteLength) throw new IoError("E_BOUNDS", `its buffer holds ${bytes.length} bytes; byteLength says ${buffers[0]!.byteLength}`, { file });
  return { json, bin: new Bytes(bytes, file) };
}

/** A .gltf document packed as a .glb: its buffer's data: URI decoded into the BIN chunk, the uri dropped. */
export function gltfToGlb(text: string, file?: string): Uint8Array {
  const { json, bin } = parseGltf(text, file);
  const buffers = (json.buffers ?? []).map(({ uri: _uri, ...rest }) => rest);
  return packGlb({ ...json, ...(json.buffers ? { buffers } : {}) }, bin ? bin.raw() : new Uint8Array(0));
}

/** A document and its buffer as a .glb: JSON padded with spaces to 4 bytes, the buffer with zeros. */
export function packGlb(json: unknown, bin: Uint8Array): Uint8Array {
  let js = new TextEncoder().encode(JSON.stringify(json));
  if (js.length % 4) {
    const padded = new Uint8Array(js.length + 4 - (js.length % 4)).fill(0x20);
    padded.set(js);
    js = padded;
  }
  const pad = bin.length % 4 ? 4 - (bin.length % 4) : 0, withBin = bin.length > 0, total = 12 + 8 + js.length + (withBin ? 8 + bin.length + pad : 0);
  const out = new Uint8Array(total), dv = new DataView(out.buffer);
  dv.setUint32(0, MAGIC, true);
  dv.setUint32(4, 2, true);
  dv.setUint32(8, total, true);
  dv.setUint32(12, js.length, true);
  dv.setUint32(16, JSON_CHUNK, true);
  out.set(js, 20);
  if (withBin) {
    dv.setUint32(20 + js.length, bin.length + pad, true);
    dv.setUint32(24 + js.length, BIN_CHUNK, true);
    out.set(bin, 28 + js.length);
  }
  return out;
}

function parseJson(text: string, file?: string, offset?: number): GltfJson {
  if (text.length > LIMITS.text) throw new IoError("E_LIMIT", `JSON of ${text.length} characters, over the limit`, { file, ...(offset !== undefined ? { offset } : {}) });
  let j: unknown;
  try {
    j = JSON.parse(text);
  } catch (err) {
    throw new IoError("E_FORMAT", `its JSON doesn't parse: ${(err as Error).message}`, { file, ...(offset !== undefined ? { offset } : {}) });
  }
  if (!j || typeof j !== "object" || Array.isArray(j)) throw new IoError("E_FORMAT", "its JSON isn't an object", { file });
  checkShape(j as Record<string, unknown>, file);
  return j as GltfJson;
}

/** Fails unless the document needs no extension to read its buffers (a compressed mesh or animation isn't read). */
export function plainOnly(json: GltfJson, file?: string): void {
  const need = json.extensionsRequired ?? [];
  if (need.length) throw new IoError("E_FORMAT", `it requires ${need.join(", ")}, which isn't read: decompress it first (gltf-transform), or export it without compression`, { file });
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const isIndex = (v: unknown) => Number.isInteger(v) && (v as number) >= 0;
const isStr = (v: unknown) => typeof v === "string";
const nums = (n: number) => (v: unknown) => Array.isArray(v) && v.length === n && v.every((x) => typeof x === "number" && Number.isFinite(x));
const indices = (v: unknown) => Array.isArray(v) && v.every(isIndex);
const strings = (v: unknown) => Array.isArray(v) && v.every(isStr);

/** Fails unless every part of the document the readers use has the shape glTF gives it, naming the first that doesn't. */
function checkShape(j: Obj, file?: string): void {
  const bad = (path: string, what: string) => new IoError("E_FORMAT", `${path} isn't ${what}`, { file });
  const objs = (v: unknown, path: string): Obj[] => {
    if (v === undefined) return [];
    if (!Array.isArray(v)) throw bad(path, "a list");
    return v.map((o, i) => {
      if (!isObj(o)) throw bad(`${path}[${i}]`, "an object");
      return o;
    });
  };
  const need = (o: Obj, k: string, path: string, test: (v: unknown) => boolean, what: string) => {
    if (!test(o[k])) throw bad(`${path}.${k}`, what);
  };
  const may = (o: Obj, k: string, path: string, test: (v: unknown) => boolean, what: string) => {
    if (o[k] !== undefined) need(o, k, path, test, what);
  };
  may(j, "asset", "", isObj, "an object");
  may(j, "extensions", "", isObj, "an object");
  may(j, "extensionsUsed", "", strings, "a list of names");
  may(j, "extensionsRequired", "", strings, "a list of names");
  objs(j.nodes, "nodes").forEach((n, i) => {
    const p = `nodes[${i}]`;
    may(n, "name", p, isStr, "a string");
    may(n, "children", p, indices, "a list of node indices");
    may(n, "translation", p, nums(3), "3 numbers");
    may(n, "rotation", p, nums(4), "4 numbers");
    may(n, "scale", p, nums(3), "3 numbers");
    may(n, "matrix", p, nums(16), "16 numbers");
    may(n, "mesh", p, isIndex, "an index");
    may(n, "skin", p, isIndex, "an index");
  });
  objs(j.animations, "animations").forEach((a, i) => {
    const p = `animations[${i}]`;
    may(a, "name", p, isStr, "a string");
    need(a, "channels", p, Array.isArray, "a list");
    need(a, "samplers", p, Array.isArray, "a list");
    objs(a.channels, `${p}.channels`).forEach((c, k) => {
      const q = `${p}.channels[${k}]`;
      need(c, "sampler", q, isIndex, "an index");
      need(c, "target", q, isObj, "an object");
      may(c.target as Obj, "node", `${q}.target`, isIndex, "a node index");
      need(c.target as Obj, "path", `${q}.target`, isStr, "a string");
    });
    objs(a.samplers, `${p}.samplers`).forEach((s, k) => {
      const q = `${p}.samplers[${k}]`;
      need(s, "input", q, isIndex, "an accessor index");
      need(s, "output", q, isIndex, "an accessor index");
      may(s, "interpolation", q, isStr, "a string");
    });
  });
  objs(j.accessors, "accessors").forEach((a, i) => {
    const p = `accessors[${i}]`;
    may(a, "bufferView", p, isIndex, "an index");
    may(a, "byteOffset", p, isIndex, "a byte offset");
    need(a, "componentType", p, Number.isInteger, "a component type");
    need(a, "count", p, isIndex, "a count");
    need(a, "type", p, isStr, "a type");
    may(a, "normalized", p, (v) => typeof v === "boolean", "true or false");
  });
  objs(j.bufferViews, "bufferViews").forEach((b, i) => {
    const p = `bufferViews[${i}]`;
    need(b, "buffer", p, isIndex, "an index");
    may(b, "byteOffset", p, isIndex, "a byte offset");
    need(b, "byteLength", p, isIndex, "a byte length");
    may(b, "byteStride", p, isIndex, "a byte stride");
  });
  objs(j.buffers, "buffers").forEach((b, i) => {
    need(b, "byteLength", `buffers[${i}]`, isIndex, "a byte length");
    may(b, "uri", `buffers[${i}]`, isStr, "a string");
  });
  objs(j.skins, "skins").forEach((s, i) => {
    need(s, "joints", `skins[${i}]`, indices, "a list of node indices");
    may(s, "inverseBindMatrices", `skins[${i}]`, isIndex, "an accessor index");
  });
  objs(j.meshes, "meshes").forEach((m, i) => {
    need(m, "primitives", `meshes[${i}]`, Array.isArray, "a list");
    objs(m.primitives, `meshes[${i}].primitives`).forEach((pr, k) => {
      const q = `meshes[${i}].primitives[${k}]`;
      need(pr, "attributes", q, (v) => isObj(v) && Object.values(v).every(isIndex), "an object of accessor indices");
      may(pr, "material", q, isIndex, "an index");
    });
  });
  objs(j.materials, "materials").forEach((m, i) => may(m, "name", `materials[${i}]`, isStr, "a string"));
}
