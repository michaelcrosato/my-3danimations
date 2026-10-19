// The TypeScript reference's sidecar (spec/conformance/PROTOCOL.md): @m3a/core and @m3a/io answering every op of the
// protocol, one JSON line in and one out. `npm run conformance -- --impl ts` certifies it; a host in another language
// runs it (`node spec/conformance/adapters/ts.ts`) to ask the reference the same questions about its own inputs.
import { bind, format, forward, skeleton, solve, solver, VERSION, type Bound, type Rest, type SkeletonIn } from "@m3a/core";
import { parseGlb, readCmu, readGltf, type Capture, type CmuPick } from "@m3a/io";
import { line, PROTOCOL, serve, type Request } from "../kit/wire.ts";

/** A capture as the protocol carries it: frames as rows of 108 numbers, the root's travel as an array. */
interface WireCapture {
  name: string;
  n: number;
  dur: number;
  loop: boolean;
  fps: number;
  take?: string;
  move: number[] | null;
  data: number[][];
}

type Lensed = format.Lensed;
const inCapture = (c: WireCapture): Capture => ({ ...c, data: Float32Array.from(c.data.flat()), move: c.move ? Float32Array.from(c.move) : null });
const outCapture = (c: Capture): WireCapture => ({
  name: c.name, n: c.n, dur: c.dur, loop: c.loop, fps: c.fps, ...(c.take !== undefined ? { take: c.take } : {}),
  move: c.move ? Array.from(c.move) : null,
  data: Array.from({ length: c.n }, (_, i) => Array.from(c.data.subarray(i * 108, i * 108 + 108))),
});
const each = <A, B>(o: Record<string, A>, f: (a: A) => B): Record<string, B> => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, f(v)]));

const bound = new Map<string, Bound>();
/** A skeleton bound once per shape: the kit retargets every clip onto the same seven bodies. */
function bindOnce(s: SkeletonIn): Bound {
  const key = line(s);
  let b = bound.get(key);
  if (!b) bound.set(key, (b = bind(s)));
  return b;
}

/** Each op: the request's fields in, the result out (spec/conformance/protocol.schema.json, `$defs.results`). */
const OPS: Record<string, (f: Record<string, unknown>) => unknown> = {
  hello: () => ({ implementation: "@m3a/core", version: VERSION, protocol: PROTOCOL, ops: Object.keys(OPS), formats: [1, 2] }),
  reduce: (f) => format.reduce(inCapture(f.capture as WireCapture), f.tol as number),
  fit: (f) => {
    const r = format.fit(f.rest as Rest, inCapture(f.capture as WireCapture), f.tol as number, (f.extra ?? {}) as format.Extra);
    return { max: r.max, mean: r.mean, clip: r.clip };
  },
  text: (f) => (f.format === 2 ? format.keyLens(f.clip as Lensed) : format.text1(f.clip as Lensed)),
  parse: (f) => ({ keys: f.format === 2 ? (JSON.parse(f.text as string) as Lensed).keys : format.parse1(f.text as string).keys }),
  mirror: (f) => format.mirror(f.clip as Lensed),
  decode: (f) => (f.times as number[]).map((t) => format.pose(f.rest as Rest, f.clip as never, t)),
  readGltf: (f) => {
    const lib = readGltf(parseGlb(new Uint8Array(Buffer.from(f.glb as string, "base64"))), { fps: f.fps as number });
    return { rig: lib.rig, warnings: lib.warnings, body: lib.body, clips: each(lib.clips, outCapture) };
  },
  readCmu: (f) => {
    const amc = f.amc as Record<string, string>;
    const lib = readCmu(f.asf as string, (take) => amc[take] ?? "", f.picks as CmuPick[], f.fps as number);
    return { clips: each(lib.clips, outCapture), log: lib.log };
  },
  measure: (f) => skeleton.measure(each(f.clips as Record<string, WireCapture>, inCapture), f.restClip as string),
  retarget: (f) => {
    const b = bindOnce(f.skeleton as SkeletonIn), heads = new Map(b.order.map((o) => [o.name, o.head]));
    const joints = (at: (name: string) => readonly number[]) => each(b.bones, (name) => solver.toFormat(b, at(name)));
    const poses = (f.times as number[]).map((t) => {
      const fk = forward(b, solve(format.keyAt(f.clip as never, t), b, { source: f.source as Rest }));
      return joints((name) => fk[name]!);
    });
    return { bones: b.bones, rest: joints((name) => heads.get(name)!), poses };
  },
};

/** The reference's answer to one request: its op's result, or an error naming the op it doesn't know. */
export function handle(req: Request): unknown {
  const op = OPS[req.op];
  if (!op) throw new Error(`unknown op "${req.op}"; this implementation answers ${Object.keys(OPS).join(", ")}`);
  return op(req);
}

if (import.meta.main) void serve(handle);
