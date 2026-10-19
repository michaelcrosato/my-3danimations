// The panels under the stage (PLAN.md WP-8.1): browse and search the sets (every tier, each set's and row's tier
// shown), a clip's timeline and what it is (describe, show), its metrics (the verdict, and each finding with its times,
// a tap away from its moment), its contact sheet (the sensors' software raster, drawn to a canvas), the example recipes
// (compiled and played) and graphs (their layers and states, each state's clips playable, and the scripted
// simulation's trace and filmstrip). Every number and picture here is a registry tool's reply.
import { graph as G } from "@m3a/core";
import type { Image } from "@m3a/sensors";
import type { registry } from "@m3a/tools";
import type { Gallery } from "./gallery.ts";
import { characterPath } from "./host.ts";
import { docs, libraryAt, scriptFor, SPEC } from "./library.ts";

/** An element with attributes (a `data-*` attribute names what a tap opens) and children. */
export function h(tag: string, attrs: Record<string, string> = {}, ...kids: (Node | string | null)[]): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  for (const k of kids) if (k !== null) el.append(k);
  return el;
}

/** A reply as the panel shows it: its verdict, its lines (those `keep` keeps: a list below may show the rest), and its
 *  next hint. */
function replyBox(r: registry.Reply, keep: (line: string) => boolean = () => true): HTMLElement {
  const lines = r.lines.filter(keep);
  return h("div", { class: `reply ${r.status}`, "data-tool": r.tool }, h("p", { class: "verdict" }, r.verdict), lines.length ? h("pre", {}, lines.join("\n")) : null, h("p", { class: "next" }, `next: ${r.next}`));
}

/** An image a tool drew, on a canvas. */
function canvasOf(img: Image | undefined, label: string): HTMLElement {
  if (!img) return h("p", { class: "note" }, `${label}: no image`);
  const c = h("canvas", { class: "picture", width: String(img.width), height: String(img.height), "aria-label": label }) as HTMLCanvasElement;
  c.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
  return c;
}

/** A list of buttons, each opening what its `data-*` attribute names. */
const list = (items: HTMLElement[]) => h("ul", { class: "list" }, ...items.map((b) => h("li", {}, b)));
const button = (attr: string, value: string, ...text: (Node | string)[]) => h("button", { type: "button", [attr]: value }, ...text);
const tier = (t: string) => h("span", { class: `tier tier-${t}` }, t);

let drawn = 0;
/** Draws the route's panel into #panel; the replies it shows become the controller's. A newer draw wins. */
export async function renderPanel(g: Gallery): Promise<void> {
  const mine = ++drawn, r = g.route, out: HTMLElement[] = [], replies: registry.Reply[] = [];
  const ask = async (tool: string, args: Record<string, unknown>, keep?: (line: string) => boolean) => {
    const reply = await g.call(tool, args);
    replies.push(reply);
    out.push(replyBox(reply, keep));
    return reply;
  };
  const clip = g.clipArg(), none = h("p", { class: "note" }, "a graph plays: its sensors and filmstrip are in the graphs panel");
  if (r.panel === "browse") {
    const lib = libraryAt(), form = h("form", { id: "search", role: "search" }, h("input", { name: "q", type: "search", placeholder: "a game moment: drinks a potion, loop, tag:attack", value: r.q ?? "" }), h("button", { type: "submit" }, "Search"));
    out.push(form);
    if (r.q) {
      const reply = await ask("search", { query: r.q, limit: 40 }, () => false), rows = ((reply.data as { rows?: { id: string; tier: string; dur: number; loop: boolean; desc: string }[] } | null)?.rows ?? []);
      out.push(list(rows.map((x) => button("data-clip", x.id, x.id, " ", tier(x.tier), ` ${x.dur.toFixed(2)} s ${x.loop ? "loop" : "once"}: ${x.desc}`))));
    }
    out.push(h("h3", {}, "Sets"), list(lib.sets().map((s) => button("data-set", s.set, s.set, " ", tier(s.tier), ` ${s.clips} clips: ${s.title}`))));
    if (r.set && lib.sets().some((s) => s.set === r.set)) {
      const about = lib.about(r.set);
      out.push(h("h3", {}, `${r.set} `, tier(about.tier)), h("p", { class: "note" }, about.credit));
      out.push(list(lib.catalog(r.set).map((x) => button("data-clip", x.id, x.id.split("/")[1]!, ` ${x.dur.toFixed(2)} s ${x.loop ? "loop" : "once"} [${x.tags.join(" ")}] ${x.desc}`))));
    }
  } else if (r.panel === "clip") {
    if (clip) {
      await ask("describe", { clip, detail: true });
      await ask("show", { clip });
    } else out.push(none);
  } else if (r.panel === "metrics") {
    if (clip) {
      const reply = await ask("metrics", { clip, limit: 50 }, (l) => !/^(FAIL|WARN) /.test(l)), found = (reply.data as { findings?: { metric: string; level: string; t0: number; t1: number; where: string | null; message: string }[] } | null)?.findings ?? [];
      out.push(h("h3", {}, "Findings (tap one to see its moment)"), list(found.map((f) => button("data-t", String(f.t0), h("b", { class: f.level }, f.level.toUpperCase()), ` ${f.t0.toFixed(3)}–${f.t1.toFixed(3)} s ${f.metric}${f.where ? ` ${f.where}` : ""}: ${f.message}`))));
    } else out.push(none);
  } else if (r.panel === "sheet") {
    if (clip) {
      const reply = await ask("sheet", { clip, frames: 8, view: r.view === "orbit" ? "three-quarter" : r.view });
      out.push(canvasOf(g.host.images.get(reply.images[0]?.name ?? ""), "contact sheet"));
    } else out.push(none);
  } else if (r.panel === "recipes") {
    if (r.recipe && SPEC[`spec/recipes/${r.recipe}.json`]) await ask("recipe.compile", { recipe: `spec/recipes/${r.recipe}.json` });
    out.push(h("h3", {}, "Example recipes (spec/recipes)"), list(docs("recipes").map((d) => button("data-recipe", d.name, d.name))));
  } else if (r.panel === "graphs") {
    const path = `spec/graphs/${r.graph}.json`;
    if (r.graph && SPEC[path]) {
      await ask("graph.validate", { graph: path });
      const graph = JSON.parse(SPEC[path]) as G.Graph;
      for (const L of G.layersOf(graph)) {
        out.push(h("h3", {}, `layer ${L.name}: starts at ${L.start}`), list(Object.entries(L.states).map(([name, s]) => h("span", { class: "state" }, h("b", {}, name), " ", ...G.clipsOf(s).map((id) => button("data-clip", id, id))))));
      }
      const script = scriptFor(path), sim = await ask("graph.sim", { graph: path, script: script.path ?? script.text, character: characterPath(r.char) });
      out.push(h("h3", {}, "Simulation (the stage plays it)"), canvasOf(g.host.images.get(sim.images[0]?.name ?? ""), "filmstrip"));
      const states = (sim.data as { states?: { t: number; layer: string; state: string }[] } | null)?.states ?? [];
      out.push(list(states.map((s) => button("data-t", String(s.t), `${s.t.toFixed(3)} s ${s.layer}: ${s.state}`))));
    }
    out.push(h("h3", {}, "Example graphs (spec/graphs)"), list(docs("graphs").map((d) => button("data-graph", d.name, d.name))));
  }
  if (mine !== drawn) return;
  g.replies = replies;
  document.getElementById("panel")!.replaceChildren(...out);
  document.querySelectorAll("#tabs button").forEach((tab) => tab.setAttribute("aria-current", String(tab.getAttribute("data-panel") === r.panel)));
}
