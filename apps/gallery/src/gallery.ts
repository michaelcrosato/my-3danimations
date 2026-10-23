// The gallery's controller (PLAN.md WP-8.1): one route (route.ts) decides everything on screen, and `open` takes the
// page there: the character bound on the stage, what plays (a library clip; else an example recipe, compiled by the
// recipe.compile tool and played; else an example graph, stepped through its script; else the set's first clip), the
// moment and the rate, the view, and the panel, whose numbers and pictures come from the registry's tools. The newest
// open wins: one still loading when another starts leaves the stage to it. A moment held (a link's, a pause's, a
// step's) is held to the microsecond the link writes, so a link reopens the pose shown bit for bit. The console handle
// (`window.__m3a`) is a view over the same controller: state, open, play, pause, step, seek, hash, a frame read back, a
// graph run's states entered, the panel's tool replies whole, the actions list and the tools.
import { playable, type AnimClip, type graph as G } from "@m3a/core";
import type { registry, sim } from "@m3a/tools";
import { ACTIONS } from "./actions.ts";
import { characterPath, type GalleryHost, type GalleryRegistry } from "./host.ts";
import { clipFromText, docs, libraryAt, loadSets, scriptFor, setsIn, SPEC } from "./library.ts";
import { renderPanel } from "./panels.ts";
import { bonesHash, ClipPlayer, GraphPlayer, type Player } from "./player.ts";
import { formatRoute, parseRoute, RATES, type Route } from "./route.ts";
import type { Readback, RootPose, Stage } from "./stage.ts";

/** A time to the microsecond, as links write it; a root to 0.1 mm and degree. */
const micro = (t: number): number => Math.round(t * 1e6) / 1e6;
const tenth = (r: RootPose): RootPose => ({ forward: Math.round(r.forward * 10) / 10, right: Math.round(r.right * 10) / 10, yaw: Math.round(r.yaw * 10) / 10 });

/** The clip the stage plays when a link names nothing to play: the core list's first. */
export const DEFAULT_CLIP = "QUATERNIUS_3D2DGE/Idle_Loop";

/** What the page shows, as plain JSON (what `__m3a.state()` returns). */
export interface GalleryState {
  route: Route;
  link: string;
  problems: string[];
  error: string | null;
  /** What plays, its time now and where its root stands (mm to 0.1, degrees). */
  playing: { kind: "clip" | "graph"; id: string; dur: number; loop: boolean; frame: number; time: number; label: string; root: RootPose } | null;
  paused: boolean;
  character: { id: string; bones: number } | null;
  panel: { name: string; replies: { tool: string; status: string; verdict: string }[] };
  /** The stage's view and where its camera looks from (Stage.look). */
  camera: ReturnType<Stage["look"]>;
  backend: string;
}

/** The controller: the route, the stage, the player and the registry. */
export class Gallery {
  route: Route;
  problems: string[];
  error: string | null = null;
  player: Player | null = null;
  paused = false;
  /** The tool replies the panel shows now. */
  replies: registry.Reply[] = [];
  /** What the player plays, so `open` rebuilds it only when that changes. */
  #playing = "";
  /** The opens started so far, and the newest's promise, which an open it overtook resolves with. */
  #opened = 0;
  #latest: Promise<GalleryState> | null = null;
  /** A tool's reply per call, kept for the session (the tools are deterministic over the same inputs). */
  readonly #cache = new Map<string, Promise<registry.Reply>>();
  readonly #clips = new Map<string, AnimClip | undefined>();
  readonly stage: Stage;
  readonly reg: GalleryRegistry;
  readonly host: GalleryHost;
  /** Called after each open, to redraw the controls. */
  onChange: () => void = () => {};

  constructor(stage: Stage, reg: GalleryRegistry, search: string) {
    [this.stage, this.reg, this.host] = [stage, reg, reg.host];
    ({ route: this.route, problems: this.problems } = parseRoute(search));
  }

  /** A tool's reply, called once per arguments in a session; called again when an image it drew is no longer kept. */
  async call(tool: string, args: Record<string, unknown>): Promise<registry.Reply> {
    const key = `${tool} ${JSON.stringify(args)}`;
    let r = this.#cache.get(key);
    if (r && (await r).images.some((i) => !this.host.images.has(i.name))) r = undefined;
    if (!r) this.#cache.set(key, (r = this.reg.call(tool, args)));
    return r;
  }

  /** The clip the tools name for what plays: its library id, a compiled recipe's file, or null for a graph. */
  clipArg(): string | null {
    const p = this.player;
    if (!p || p.kind === "graph") return null;
    return this.route.clip ?? (this.route.recipe ? `check-output/recipe.compile/${this.route.recipe}.clip.json` : p.id);
  }

  /** Goes to a route: a link's query string (the whole route), or the fields to change (a new thing to play starts
   *  from its beginning unless `t` is given). Resolves when everything is shown; an error is shown, not thrown. An
   *  open made while an earlier one loads wins: the earlier resolves with its state. */
  open(to: string | Partial<Route>): Promise<GalleryState> {
    const mine = ++this.#opened;
    if (typeof to === "string") ({ route: this.route, problems: this.problems } = parseRoute(to));
    else {
      const fresh = ["clip", "recipe", "graph", "set"].some((k) => k in to && (to as Record<string, unknown>)[k] !== this.route[k as keyof Route]);
      this.route = { ...this.route, ...(fresh && !("t" in to) ? { t: null } : {}), ...to };
      if (to.clip?.includes("/") && !("set" in to)) this.route.set = to.clip.split("/")[0]!;
      this.problems = [];
    }
    this.route.rate = Math.min(RATES[1], Math.max(RATES[0], this.route.rate));
    this.error = null;
    return (this.#latest = this.#show(mine));
  }

  /** Open number `mine`'s loading and drawing; an open overtaken by a newer one stops at its next await. */
  async #show(mine: number): Promise<GalleryState> {
    const stale = () => mine !== this.#opened;
    try {
      if (!(await this.#load(stale)) || stale()) return this.#latest!;
      // the link says the moment shown: a time past the end is the end, a script's is its step's
      if (this.route.t !== null) this.#hold(this.route.t);
      this.paused = this.route.t !== null;
      this.show();
      // (an orbiting camera stays where the pointer left it)
      if (this.stage.view !== this.route.view) this.stage.setView(this.route.view);
      await renderPanel(this);
      if (stale()) return this.#latest!;
    } catch (err) {
      if (stale()) return this.#latest!;
      this.error = err instanceof Error ? err.message : String(err);
    }
    history.replaceState(null, "", formatRoute(this.route) || location.pathname);
    this.onChange();
    return this.state();
  }

  /** The character on the stage and the player for what the route plays, each built again only when it changed. False
   *  when a newer open overtook this one while it loaded (`stale`): it leaves the player to that one. */
  async #load(stale: () => boolean): Promise<boolean> {
    const r = this.route, had = this.stage.char, bound = await this.stage.setCharacter(r.char);
    if (!bound || stale()) return false;
    const what = r.clip ? `clip ${r.clip}` : r.recipe ? `recipe ${r.recipe}` : r.graph ? `graph ${r.graph}` : `clip ${this.#first()}`;
    if (what === this.#playing && had === r.char && this.player) return true;
    this.player = null;
    this.#playing = "";
    let player: Player;
    if (what.startsWith("clip ")) {
      const id = what.slice(5);
      await loadSets([id.split("/")[0]!]);
      if (stale()) return false;
      const { clip, rest } = libraryAt().clip(id);
      player = new ClipPlayer(bound, clip, rest);
    } else if (r.recipe) {
      const path = `spec/recipes/${r.recipe}.json`;
      if (!SPEC[path]) throw new Error(`no recipe "${r.recipe}": ${docs("recipes").map((d) => d.name).join(", ")}`);
      const reply = await this.call("recipe.compile", { recipe: path }), file = (reply.data as { path?: string } | null)?.path;
      if (stale()) return false;
      if (!file) throw new Error(reply.verdict);
      const { clip, rest } = clipFromText(this.host.files.get(file)!);
      player = new ClipPlayer(bound, clip, rest);
    } else {
      const path = `spec/graphs/${r.graph}.json`;
      if (!SPEC[path]) throw new Error(`no graph "${r.graph}": ${docs("graphs").map((d) => d.name).join(", ")}`);
      const graph = JSON.parse(SPEC[path]) as G.Graph, script = JSON.parse(scriptFor(path).text) as sim.SimScript;
      await loadSets(setsIn(graph));
      if (stale()) return false;
      player = new GraphPlayer(bound, graph, script, (id) => this.#clip(id));
    }
    [this.player, this.#playing] = [player, what];
    return true;
  }

  /** Holds the player at time t as a link writes it: to the microsecond (past the end, the end; a script's, its step's),
   *  so the pose shown is the one the link reopens, bit for bit; the route says that moment. */
  #hold(t: number): void {
    const p = this.player!;
    p.seek(t);
    p.seek(micro(p.time));
    this.route.t = micro(p.time);
  }

  /** The set's first clip, when only a set is named; the default clip otherwise. */
  #first(): string {
    const set = this.route.set;
    return (set && libraryAt().catalog(set)[0]?.id) || DEFAULT_CLIP;
  }

  /** A library clip ready to play (a graph's states'), once per id. */
  #clip(id: string): AnimClip | undefined {
    if (!this.#clips.has(id)) {
      try {
        const { clip, rest } = libraryAt().clip(id);
        this.#clips.set(id, playable(clip, rest));
      } catch {
        this.#clips.set(id, undefined);
      }
    }
    return this.#clips.get(id);
  }

  /** Poses the character at the player's time and places it. */
  show(): void {
    if (!this.player) return;
    this.player.apply();
    this.stage.place(this.player.root(), this.player.turn());
  }

  /** Plays on by `dt` wall seconds at the route's rate (the frame loop's step), unless paused. */
  tick(dt: number): void {
    if (!this.player || this.paused) return;
    this.player.advance(dt * this.route.rate);
    this.show();
  }

  /** Pauses (`on`) or plays; a pause holds the moment (to the microsecond) and writes it into the link. */
  pause(on = true): void {
    this.paused = on;
    this.route.t = null;
    if (on && this.player) {
      this.#hold(this.player.time);
      this.show();
    }
    history.replaceState(null, "", formatRoute(this.route) || location.pathname);
    this.onChange();
  }

  /** Moves n frames (back when negative) from the nearest whole frame, paused there. */
  step(n = 1): GalleryState {
    this.player?.nudge(n);
    this.pause(true);
    return this.state();
  }

  /** Goes to time t (seconds), paused there. */
  seek(t: number): GalleryState {
    this.player?.seek(t);
    this.pause(true);
    return this.state();
  }

  /** The proof hash of the bones as posed now (null with nothing on the stage). */
  hash(): string | null {
    return this.stage.bound ? bonesHash(this.stage.bound) : null;
  }

  /** The state as plain JSON. */
  state(): GalleryState {
    const p = this.player, b = this.stage.bound;
    return {
      route: { ...this.route },
      link: formatRoute(this.route),
      problems: [...this.problems],
      error: this.error,
      playing: p && { kind: p.kind, id: p.id, dur: p.dur, loop: p.loop, frame: p.frame, time: micro(p.time), label: p.label(), root: tenth(p.root()) },
      paused: this.paused,
      character: b && { id: this.stage.char!, bones: b.bones.length },
      panel: { name: this.route.panel, replies: this.replies.map((r) => ({ tool: r.tool, status: r.status, verdict: r.verdict })) },
      camera: this.stage.look(),
      backend: this.stage.backend,
    };
  }

  /** The console handle: a view over the controller and the registry. */
  handle(tools: unknown): Record<string, unknown> {
    return {
      ready: true,
      state: () => this.state(),
      open: (to: string | Partial<Route>) => this.open(to),
      play: () => this.pause(false),
      pause: () => this.pause(true),
      step: (n?: number) => this.step(n),
      seek: (t: number) => this.seek(t),
      hash: () => this.hash(),
      frame: (w?: number, h?: number): Promise<Readback> => this.stage.readback(w, h),
      entered: () => (this.player instanceof GraphPlayer ? this.player.entered.map((e) => ({ ...e })) : null),
      replies: () => this.replies.map((r) => JSON.parse(JSON.stringify(r)) as registry.Reply),
      actions: () => ACTIONS.map((a) => ({ ...a })),
      characterPath,
      tools,
    };
  }
}
