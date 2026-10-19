// The HTTP adapter template for external generators (PLAN.md WP-9.2, D.9): a remote model behind the socket, off by
// default (O5: no external generative service until the owner approves its cost, keys and output terms), its transport
// always injected (the host's fetch, or a test's mock: nothing here opens a connection). The request goes out in the
// shape of NVIDIA Kimodo's constraint-based generation (a prompt, a length, a seed, the body, and constraints at
// frames: full-body key poses and 2D root waypoints), or the vendor's own through `toBody`; the reply's clip comes back
// labelled generated, its producer naming the model, its license the terms it was served under, whose version the
// socket records per clip (vendors change terms: NVIDIA "may update" its model license "at any time").
import { format, VERSION, type Clip } from "@m3a/core";
import { fail, type MotionSource, type SourceOutput, type SourceRequest, type SourceTerms } from "./types.ts";

/** One HTTP request, as a transport sends it. */
export interface HttpRequest {
  url: string;
  method: "POST";
  headers: Record<string, string>;
  body: string;
}
/** A transport's answer: the status and the body's text. */
export interface HttpReply {
  status: number;
  body: string;
}
/** How a request reaches the generator: injected by the host (a wrapper over fetch), a mock in tests. */
export type Transport = (req: HttpRequest) => Promise<HttpReply>;

/** An external generator's adapter: its name (a word), endpoint, model, the terms its output comes under, whether it
 *  is on (never by default), its transport and headers (a key the host reads from its environment: never committed),
 *  the rate constraints' frames count at, and the vendor's own request and reply shapes when they aren't Kimodo's. */
export interface HttpSourceOptions {
  name: string;
  url: string;
  model: { name: string; version: string };
  terms: SourceTerms;
  enabled?: boolean;
  transport?: Transport;
  headers?: Record<string, string>;
  fps?: number;
  toBody?: (req: SourceRequest, fps: number) => unknown;
  fromBody?: (body: unknown, req: SourceRequest) => { clip: unknown; terms?: SourceTerms };
}

/** The request body in the shape of Kimodo's constraint-based generation: each constraint at its time and frame, a key
 *  pose as `fullbody` (the format's key fields), a root waypoint as `root2d` (forward and right, % of the hip height). */
export function kimodoBody(req: SourceRequest, fps: number): unknown {
  const frame = (t: number) => Math.round(t * fps);
  return {
    prompt: req.intent,
    duration: req.duration,
    seed: req.seed,
    fps,
    skeleton: req.skeleton,
    constraints: (req.constraints ?? []).map((c) => (c.kind === "pose" ? { type: "fullbody", t: c.t, frame: frame(c.t), pose: c.pose } : { type: "root2d", t: c.t, frame: frame(c.t), xy: [c.forward, c.right], ...(c.yaw === undefined ? {} : { heading: c.yaw }) })),
  };
}

/** The reply as the template reads it by default: `{ clip, terms? }`, the clip a format-2 clip (a vendor's own joint
 *  data is converted by its `fromBody`, through @m3a/io's importers). */
const replyOf = (body: unknown): { clip: unknown; terms?: SourceTerms } => {
  const b = body as { clip?: unknown; terms?: SourceTerms } | null;
  if (!b || typeof b !== "object" || !b.clip || typeof b.clip !== "object") throw fail("E_REPLY", "the reply has no clip: the template reads { clip, terms? } (give the adapter a fromBody for the vendor's own shape)");
  return { clip: b.clip, ...(b.terms ? { terms: b.terms } : {}) };
};

/**
 * An external generator as a motion source. Off unless `enabled` is true and a transport is given (E_DISABLED says
 * so); a transport that throws or a status other than 200 is E_TRANSPORT, a reply that isn't JSON or has no clip
 * E_REPLY. The clip is put on the request's body (its restSrc and rest) and labelled: method generated, the producer
 * this adapter and the model, the license the terms it was served under (the reply's, or the adapter's).
 */
export function httpSource(o: HttpSourceOptions): MotionSource {
  if (!/^[a-z][a-z0-9-]*$/.test(o.name)) throw fail("E_REQUEST", `an HTTP source's name is a lower-case word (letters, digits, -), not ${JSON.stringify(o.name)}`);
  const fps = o.fps ?? 30, src = o.name.toUpperCase().replace(/-/g, "_");
  return {
    name: o.name,
    terms: o.terms,
    async generate(req: SourceRequest): Promise<SourceOutput> {
      if (o.enabled !== true || !o.transport) throw fail("E_DISABLED", `${o.name} is an external generator, off by default (O5: the owner approves a source's cost, keys and output terms first); turn it on with enabled: true and a transport`);
      let reply: HttpReply;
      try {
        reply = await o.transport({ url: o.url, method: "POST", headers: { "content-type": "application/json", ...o.headers }, body: JSON.stringify((o.toBody ?? kimodoBody)(req, fps)) });
      } catch (err) {
        throw fail("E_TRANSPORT", `${o.url} wasn't reached (${err instanceof Error ? err.message : String(err)}); check the transport and the endpoint`);
      }
      if (reply.status !== 200) throw fail("E_TRANSPORT", `${o.url} answered ${reply.status}: ${reply.body.slice(0, 200)}`);
      let body: unknown;
      try {
        body = JSON.parse(reply.body);
      } catch {
        throw fail("E_REPLY", `${o.url}'s reply isn't JSON: ${reply.body.slice(0, 80)}`);
      }
      const got = (o.fromBody ?? replyOf)(body, req), served = got.terms ?? o.terms, made = got.clip as Clip;
      const clip: Clip = {
        ...made,
        restSrc: req.skeleton.restSrc,
        provenance: { src, method: "generated", producer: { tool: "m3a-http", version: VERSION, model: `${o.model.name} ${o.model.version}` }, license: served.license, ai: format.IPTC.generated },
      };
      return { clip, rest: req.skeleton.rest, ...(got.terms ? { terms: got.terms } : {}) };
    },
  };
}
