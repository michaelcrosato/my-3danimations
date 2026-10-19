// The gallery's page (PLAN.md WP-8.1): the stage, the transport (play and pause, a frame back and forward, the scrub,
// the rate from 0.1x to 2x), the character and view pickers, the panel tabs and the build stamp, wired to the controller
// (gallery.ts) with touch, mouse and keys. It puts `window.__m3a` (the controller's handle) and `window.__M3A_TOOLS__`
// (the registry's console handle, on the gallery's host) on the page; both are there, ready, once the link has opened.
import { VERSION } from "@m3a/core";
import { TEST_SEEDS } from "@m3a/three/test-characters";
import { installConsole } from "@m3a/tools";
import { RIGS } from "virtual:m3a-library";
import { Gallery } from "./gallery.ts";
import { GalleryRegistry, galleryHost } from "./host.ts";
import { h } from "./panels.ts";
import { PANELS, VIEWS, type Panel, type View } from "./route.ts";
import { Stage } from "./stage.ts";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const LABELS: Record<Panel, string> = { browse: "Browse", clip: "Clip", metrics: "Metrics", sheet: "Sheet", recipes: "Recipes", graphs: "Graphs" };

async function main(): Promise<void> {
  const stamp = `m3a ${VERSION} · ${__COMMIT__}`;
  $("stamp").textContent = stamp;
  const webgl2 = new URLSearchParams(location.search).get("renderer") === "webgl2";
  const stage = await Stage.create($("stage"), webgl2), reg = new GalleryRegistry(galleryHost()), g = new Gallery(stage, reg, location.search);
  const tools = installConsole(reg, reg.host);

  // the pickers and the tabs
  const chars = [...TEST_SEEDS.map((s) => `gen-${s}`), ...Object.keys(RIGS)], charSel = $<HTMLSelectElement>("char"), viewSel = $<HTMLSelectElement>("view");
  charSel.append(...chars.map((c) => h("option", { value: c }, c)));
  viewSel.append(...VIEWS.map((v) => h("option", { value: v }, v)));
  charSel.addEventListener("change", () => void g.open({ char: charSel.value }));
  viewSel.addEventListener("change", () => void g.open({ view: viewSel.value as View }));
  $("tabs").append(...PANELS.map((p) => h("button", { type: "button", "data-panel": p }, LABELS[p])));
  $("tabs").addEventListener("click", (e) => {
    const p = (e.target as HTMLElement).closest("[data-panel]")?.getAttribute("data-panel");
    if (p) void g.open({ panel: p as Panel });
  });

  // the panel: a tap on a row opens what it names, a time seeks there; the search form searches
  $("panel").addEventListener("click", (e) => {
    const el = (e.target as HTMLElement).closest("[data-clip],[data-set],[data-recipe],[data-graph],[data-t]");
    if (!el) return;
    const a = (k: string) => el.getAttribute(k);
    if (a("data-clip")) void g.open({ clip: a("data-clip") });
    else if (a("data-set")) void g.open({ set: a("data-set"), clip: null, recipe: null, graph: null });
    else if (a("data-recipe")) void g.open({ recipe: a("data-recipe"), clip: null, graph: null });
    else if (a("data-graph")) void g.open({ graph: a("data-graph"), clip: null, recipe: null });
    else g.seek(Number(a("data-t")));
  });
  $("panel").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = new FormData(e.target as HTMLFormElement).get("q")?.toString().trim();
    void g.open({ q: q || null, panel: "browse" });
  });

  // the transport
  const scrub = $<HTMLInputElement>("scrub"), rate = $<HTMLInputElement>("rate");
  $("b-play").addEventListener("click", () => g.pause(!g.paused));
  $("b-back").addEventListener("click", () => g.step(-1));
  $("b-fwd").addEventListener("click", () => g.step(1));
  scrub.addEventListener("input", () => g.seek(Number(scrub.value)));
  rate.addEventListener("input", () => {
    g.route.rate = Number(rate.value);
    g.pause(g.paused);
  });
  addEventListener("keydown", (e) => {
    if ((e.target as HTMLElement).closest("input,select,textarea")) return;
    if (e.code === "Space") g.pause(!g.paused);
    else if (e.code === "ArrowLeft" || e.code === "ArrowRight") g.step(e.code === "ArrowLeft" ? -1 : 1);
    else return;
    e.preventDefault();
  });

  // the controls redrawn after each change; the HUD and the scrub every frame
  g.onChange = () => {
    const r = g.route, p = g.player;
    [charSel.value, viewSel.value, rate.value] = [r.char, r.view, String(r.rate)];
    $("rate-out").textContent = `${r.rate.toFixed(2)}x`;
    $("b-play").textContent = g.paused ? "Play" : "Pause";
    scrub.max = String(p?.dur ?? 1);
    scrub.step = String(p?.frame ?? 0.01);
    $("notice").textContent = [g.error, ...g.problems].filter(Boolean).join("; ");
    document.querySelectorAll("#panel [data-clip]").forEach((b) => b.setAttribute("aria-current", String(b.getAttribute("data-clip") === (r.clip ?? p?.id))));
  };
  const hud = () => {
    const p = g.player;
    $("title").textContent = p ? p.label() : g.error ? "error" : "loading";
    $("time").textContent = p ? `${p.time.toFixed(3)} / ${p.dur.toFixed(3)} s` : "";
    if (p && document.activeElement !== scrub) scrub.value = String(p.time);
  };
  let last = performance.now();
  const frame = (now: number) => {
    g.tick(Math.min(0.25, (now - last) / 1000));
    last = now;
    hud();
    stage.render();
    requestAnimationFrame(frame);
  };

  await g.open(location.search);
  (window as unknown as { __m3a: unknown }).__m3a = { ...g.handle(tools), version: VERSION, stamp };
  requestAnimationFrame(frame);
}

main().catch((err: Error) => {
  $("title").textContent = `error: ${err.message}`;
  (window as unknown as { __m3a: unknown }).__m3a = { ready: false, error: err.message };
  throw err;
});
