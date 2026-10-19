// The gallery's deep links (PLAN.md WP-8.1): everything on screen is a route, read from and written to the query
// string, so every set, clip, recipe, graph, character, view, moment, rate, panel and search opens by link. Pure: no
// DOM, so a test can read and write links anywhere.

/** The camera's views: the sensors' named views (raster.VIEWS), and orbit, which a finger or a mouse turns. */
export const VIEWS = ["three-quarter", "front", "side", "back", "top", "orbit"] as const;
/** A view's name. */
export type View = (typeof VIEWS)[number];
/** The panels under the stage. */
export const PANELS = ["browse", "clip", "metrics", "sheet", "recipes", "graphs"] as const;
/** A panel's name. */
export type Panel = (typeof PANELS)[number];
/** The slowest and fastest playback rates. */
export const RATES = [0.1, 2] as const;

/** Everything a link says: what plays (a clip, else a recipe compiled, else a graph's simulation), on which character,
 *  seen how, from when (null: playing from the start) and how fast, and which panel shows what. */
export interface Route {
  set: string | null;
  clip: string | null;
  recipe: string | null;
  graph: string | null;
  char: string;
  view: View;
  t: number | null;
  rate: number;
  panel: Panel;
  q: string | null;
  renderer: "webgl2" | null;
}

/** The character a link without one plays on. */
export const DEFAULT_CHAR = "gen-1";

/** The panel a route shows when its link names none: the one for what it opens. */
export const panelOf = (r: Pick<Route, "clip" | "recipe" | "graph">): Panel => (r.clip ? "clip" : r.recipe ? "recipes" : r.graph ? "graphs" : "browse");

/** A route from a query string, with each value it couldn't take named (the default stands in for it). */
export function parseRoute(search: string): { route: Route; problems: string[] } {
  const q = new URLSearchParams(search), problems: string[] = [], str = (k: string) => q.get(k)?.trim() || null;
  const one = <T extends string>(k: string, list: readonly T[], fallback: T): T => {
    const v = str(k);
    if (v === null) return fallback;
    if ((list as readonly string[]).includes(v)) return v as T;
    problems.push(`?${k}=${v} isn't one of ${list.join(", ")}`);
    return fallback;
  };
  const num = (k: string, lo: number, hi: number): number | null => {
    const v = str(k);
    if (v === null) return null;
    const n = Number(v);
    if (Number.isFinite(n) && n >= lo && n <= hi) return n;
    problems.push(`?${k}=${v} isn't a number from ${lo} to ${hi}`);
    return null;
  };
  const clip = str("clip"), recipe = str("recipe"), graph = str("graph");
  const route: Route = {
    set: str("set") ?? (clip?.includes("/") ? clip.split("/")[0]! : null),
    clip, recipe, graph,
    char: str("char") ?? DEFAULT_CHAR,
    view: one("view", VIEWS, "three-quarter"),
    t: num("t", 0, 3600),
    rate: num("rate", RATES[0], RATES[1]) ?? 1,
    panel: "browse",
    q: str("q"),
    renderer: str("renderer") === "webgl2" ? "webgl2" : null,
  };
  route.panel = one("panel", PANELS, panelOf(route));
  return { route, problems };
}

/** A route as a query string: only what differs from a bare link's defaults, in one order, so a link reads the same
 *  whoever writes it ("" for the bare link). */
export function formatRoute(r: Route): string {
  const q = new URLSearchParams(), put = (k: string, v: string | null, skip?: string) => v !== null && v !== skip && q.set(k, v);
  const derivedSet = r.clip?.includes("/") ? r.clip.split("/")[0]! : null;
  put("set", r.set, derivedSet ?? undefined);
  put("clip", r.clip);
  put("recipe", r.recipe);
  put("graph", r.graph);
  put("char", r.char, DEFAULT_CHAR);
  put("view", r.view, "three-quarter");
  // to the microsecond, as the gallery holds a moment, so the link reopens the pose shown
  put("t", r.t === null ? null : String(Math.round(r.t * 1e6) / 1e6));
  put("rate", String(r.rate), "1");
  put("panel", r.panel, panelOf(r));
  put("q", r.q);
  put("renderer", r.renderer);
  const s = q.toString();
  return s ? `?${s}` : "";
}
