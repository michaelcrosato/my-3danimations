// The lineage graph (PLAN.md WP-9.3): every clip and what it was made from, read from its provenance (spec/MOTION.md
// §7.4): `orig`, the clip it copies, edits or was composed from first, and a composed clip's recipe inputs, each with
// the content id it was made from (spec/RECIPE.md §3); a recipe or action not yet compiled adds the clips its steps
// read. Resolving a clip walks down to its sources: the clips made from no other (captured, keyed, procedural,
// generated) and core's procedural parts (`PROCEDURAL/<Name>`). On the way it names what is missing, a loop, an input
// whose content changed since (stale), and an input deprecated (its id resolves through the lock's aliases to its
// successor, as the library's loader does: ids are never reused, so a deprecated clip stays resolvable, marked).
import type { actions, Clip, recipe } from "@m3a/core";
import type { Library } from "../load/index.ts";

/** What a node is made from: a clip id, whether it is the node's `orig` or one of its inputs, and the content id the
 *  node was made from (a composed clip's recipe records it). */
export interface LineageEdge {
  id: string;
  kind: "orig" | "input";
  content: string | null;
}
/** A clip in the graph, or a recipe not yet compiled: its method (`recipe` for an uncompiled one), its source, its own
 *  content id (its file's SHA-256), and what it is made from. */
export interface LineageNode {
  id: string;
  method: string;
  src: string | null;
  content: string | null;
  from: LineageEdge[];
}
/** Something a resolution met: an id the graph doesn't know (`missing`), a loop (`cycle`), an input whose content id
 *  isn't the one it was made from (`stale`), or one deprecated in favour of another (`deprecated`). `via` names the
 *  clip whose edge met it. */
export interface LineageProblem {
  code: "missing" | "cycle" | "stale" | "deprecated";
  id: string;
  via: string;
  message: string;
}
/** A clip's lineage resolved: whether every path reaches a source (nothing missing, no loop), the sources, every clip
 *  on the way, and what it met. */
export interface Resolution {
  id: string;
  ok: boolean;
  sources: string[];
  through: string[];
  problems: LineageProblem[];
}

/** The ids of core's procedural parts: sources made by code, on whichever body asks (spec/ACTION.md §1). */
export const PROCEDURAL = /^PROCEDURAL\/[A-Za-z0-9_]+$/;
const byId = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** The graph of every clip and what it was made from. */
export class Lineage {
  #nodes = new Map<string, LineageNode>();
  #content = new Map<string, string[]>();
  #aliases: Readonly<Record<string, string>>;

  /** An empty graph; `aliases` maps a deprecated id to its successor (the lock's `aliases`). */
  constructor(opts: { aliases?: Readonly<Record<string, string>> } = {}) {
    this.#aliases = opts.aliases ?? {};
  }

  /** The graph of every clip a library shows (`tiers` it opted into), each with its file's content id when the library
   *  verifies (openLibrary gives it Node's SHA-256), and the lock's aliases. */
  static ofLibrary(library: Library, aliases: Readonly<Record<string, string>> = {}): Lineage {
    const g = new Lineage({ aliases }), resolve = library.resolver();
    for (const row of library.catalog()) {
      const r = resolve(row.id)!;
      g.addClip(r.clip, r.contentId || null);
    }
    return g;
  }

  /** How many nodes the graph holds. */
  get size(): number {
    return this.#nodes.size;
  }
  /** A node by id, as added (no alias followed). */
  node(id: string): LineageNode | undefined {
    return this.#nodes.get(id);
  }
  /** Every node's id, sorted. */
  ids(): string[] {
    return [...this.#nodes.keys()].sort(byId);
  }
  /** The ids whose clip has this content id: a submission's file the same as one in the graph is a copy of it. */
  byContent(content: string): string[] {
    return [...(this.#content.get(content) ?? [])];
  }

  /** Adds a clip, with its content id when known: its edges are its `orig` and its recipe's inputs. */
  addClip(clip: Pick<Clip, "id" | "provenance">, content: string | null = null): LineageNode {
    const p = clip.provenance as Clip["provenance"] & { recipe?: { inputs?: Record<string, string> } }, from: LineageEdge[] = [];
    const inputs = p.recipe?.inputs ?? {};
    if (p.orig) from.push({ id: p.orig, kind: "orig", content: inputs[p.orig] ?? null });
    for (const id of Object.keys(inputs).sort(byId)) if (id !== p.orig) from.push({ id, kind: "input", content: inputs[id]! });
    return this.#add({ id: clip.id, method: p.method, src: p.src, content, from });
  }

  /** Adds a recipe, an action or a paired action not yet compiled: its edges are the clips its steps read (a paired
   *  action's every role's). Its compiled clip, once made, is added in its place with addClip. */
  addRecipe(r: recipe.Recipe | actions.PairedAction): LineageNode {
    const steps = "roles" in r ? Object.values(r.roles).flatMap((x) => x.steps) : r.steps;
    const ids = [...new Set(steps.filter((s) => s.op === "clip" && typeof s.id === "string").map((s) => s.id as string))].sort(byId);
    return this.#add({ id: r.id, method: "recipe", src: null, content: null, from: ids.map((id) => ({ id, kind: "input", content: null })) });
  }

  #add(node: LineageNode): LineageNode {
    if (this.#nodes.has(node.id)) throw new Error(`lineage: ${node.id} is in the graph already; an id names one clip, and is never reused`);
    this.#nodes.set(node.id, node);
    if (node.content) this.#content.set(node.content, [...(this.#content.get(node.content) ?? []), node.id]);
    return node;
  }

  /** The node an id stands for: its own when the graph holds it, else its successor's through the aliases (a
   *  deprecated clip whose file is gone); null when neither leads to a node. */
  #follow(id: string): string | null {
    const walked: string[] = [];
    let at = id;
    while (!this.#nodes.has(at)) {
      const to = this.#aliases[at];
      if (!to || walked.includes(at)) return null;
      walked.push(at);
      at = to;
    }
    return at;
  }

  /** A clip's lineage resolved down to its sources: the clips made from no other and the procedural parts. */
  resolve(id: string): Resolution {
    const sources = new Set<string>(), through = new Set<string>(), problems: LineageProblem[] = [], done = new Set<string>(), path: string[] = [];
    const note = (code: LineageProblem["code"], at: string, via: string, message: string) => {
      if (!problems.some((p) => p.code === code && p.id === at && p.via === via)) problems.push({ code, id: at, via, message });
    };
    const walk = (at: string) => {
      if (path.includes(at)) return note("cycle", at, path.at(-1)!, `${at} is made from itself: ${[...path.slice(path.indexOf(at)), at].join(" ← ")}`);
      if (done.has(at)) return;
      const node = this.#nodes.get(at)!;
      through.add(at);
      if (!node.from.length) sources.add(at);
      path.push(at);
      for (const e of node.from) {
        if (PROCEDURAL.test(e.id) && !this.#nodes.has(e.id)) {
          sources.add(e.id);
          continue;
        }
        const to = this.#follow(e.id);
        if (!to) {
          note("missing", e.id, at, `${at} is made from ${e.id}, which the graph doesn't hold${this.#aliases[e.id] ? ` (deprecated for ${this.#aliases[e.id]}, which it doesn't hold either)` : ""}: add its set, or its clip`);
          continue;
        }
        // deprecated: its own clip kept (deprecation never deletes) and walked, or, its clip gone, its successor's
        const successor = this.#aliases[e.id], kept = to === e.id;
        if (successor) note("deprecated", e.id, at, `${at} is made from ${e.id}, deprecated for ${successor}${kept ? "" : `; its clip is gone, so ${to}'s lineage stands in`}`);
        const target = this.#nodes.get(to)!;
        if (kept && e.content && target.content && e.content !== target.content) note("stale", e.id, at, `${at} was made from ${e.id} at content ${e.content.slice(0, 12)}…, and it is ${target.content.slice(0, 12)}… now: make ${at} again from it, or keep it as made`);
        walk(to);
      }
      path.pop();
      done.add(at);
    };
    const start = this.#follow(id);
    if (!start) return { id, ok: false, sources: [], through: [], problems: [{ code: "missing", id, via: id, message: `the graph holds no ${id}` }] };
    if (this.#aliases[id]) note("deprecated", id, id, `${id} is deprecated for ${this.#aliases[id]}${start === id ? "" : `; its clip is gone, so ${start}'s lineage stands in`}`);
    walk(start);
    const ok = !problems.some((p) => p.code === "missing" || p.code === "cycle");
    return { id, ok, sources: [...sources].sort(byId), through: [...through].sort(byId), problems };
  }

  /** Every node made from `id`, directly or through others, sorted: what a change to it, or its deprecation,
   *  reaches. */
  derived(id: string): string[] {
    const users = new Map<string, string[]>();
    for (const n of this.#nodes.values()) for (const e of n.from) users.set(e.id, [...(users.get(e.id) ?? []), n.id]);
    const out = new Set<string>(), todo = [id];
    while (todo.length) for (const u of users.get(todo.pop()!) ?? []) if (!out.has(u)) todo.push((out.add(u), u));
    out.delete(id);
    return [...out].sort(byId);
  }
}
