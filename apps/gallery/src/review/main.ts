// The review queue's page (PLAN.md WP-8.2b, WP-F.11): it opens a queue (m3a.review-queue/1) at load: the batch its
// link names (?queue=NAME), else a queue bundled at build time (the check-output/review/queue.json `m3a review export`
// wrote, when a local build is asked to: M3A_REVIEW_QUEUE), else the newest batch the build carries (the committed
// batches of library clips alone: each gate's newest holding no submission, G8's, on the preview site and in a local
// build alike unless M3A_REVIEW_BATCHES names others; batches.ts); the file picker opens any other. It says which is
// open, and links the other batches. Opening one decides nothing. The guide at the top (index.html, WP-F.12) says what
// a review is for, open on a first visit, its open or closed kept in this browser's storage. Each card says what its
// clip should show (shows.ts: its words and numbers, as an agent reads them; a sampled clip's from the library, a
// submission's from its own clip, a recipe compiled, its facts measured here when it carries none), then
// plays its clip in place (play.ts: one stage for the page, one card at a time) and links it in the gallery. The page
// keeps the owner's decisions (and this browser's storage, by the queue's refs, so a reload keeps them), and exports
// the review (m3a.review/1) for `m3a review ingest <file>`: through the share sheet on a phone (navigator.share with a
// file), as a download on a desk. It puts `window.__m3a` (the page's handle: state, open, batch, decide, clear, play,
// stop, playing, frame, review, commands, export, described, drawn, actions) and `window.__M3A_TOOLS__` (every m3a
// tool, on the gallery's host) on it.
import { measureFacts, VERSION } from "@m3a/core";
import { installConsole, type intake } from "@m3a/tools";
import { GalleryRegistry, galleryHost } from "../host.ts";
import { loadSets } from "../library.ts";
import { h } from "../panels.ts";
import { REVIEW_ACTIONS } from "./actions.ts";
import { byNewest, newest, pick, type Batch } from "./batches.ts";
import { CardPlayer, clipOf } from "./play.ts";
import { Decisions, readQueue, sectionOf, type Saved, type Section } from "./queue.ts";
import { shows, type Shows } from "./shows.ts";
import { drawPictures, render, showShows, sync } from "./view.ts";

const BUNDLED = __REVIEW_QUEUE__, BATCHES: readonly Batch[] = __REVIEW_BATCHES__;
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const reg = new GalleryRegistry(galleryHost()), tools = installConsole(reg, reg.host), stamp = `m3a ${VERSION} · ${__COMMIT__}`;
const renderer = new URLSearchParams(location.search).get("renderer") === "webgl2" ? "webgl2" : null, player = new CardPlayer(reg, renderer === "webgl2");
const selected = new Set<string>();
let dec: Decisions | null = null, source = "", batch: Batch | null = null, problem = "", error: string | null = null, reading: Promise<number> = Promise.resolve(0), drawing: Promise<number> = Promise.resolve(0), opened = 0, said = "";
/** Where this browser keeps whether the guide is open or closed. */
const GUIDE = "m3a.review.guide";

/** Today on this device, YYYY-MM-DD: the date the review is made on. */
const today = () => {
  const d = new Date(), p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
/** This browser's storage, or nothing (a private window, blocked site data). */
const storage = {
  get: (key: string): Saved => {
    try {
      return JSON.parse(localStorage.getItem(key) ?? "{}") as Saved;
    } catch {
      return {};
    }
  },
  put: (key: string, saved: Saved) => {
    try {
      localStorage.setItem(key, JSON.stringify(saved));
    } catch {
      // kept on the page alone
    }
  },
};

/** Where the open queue came from, as the header says it: a batch by name and file (the newest or not), or a file. */
function from(): string {
  if (!batch) return source;
  const latest = newest(BATCHES) === batch;
  return `batch ${batch.name} (${batch.path}, ${latest ? `the newest of ${BATCHES.length} this page carries` : "not the newest"})`;
}

/** The header lines, the batch links, the summary and the cards brought in step with the decisions and the player. */
function refresh(): void {
  const q = dec?.queue, made = dec?.list().length ?? 0;
  $("source").textContent = error ?? (q ? `${from()}: the ${q.store} store's queue of ${q.date}, ${q.submissions.length} submissions and ${q.clips.length} sampled clips` : "no queue yet: open the file m3a review export wrote");
  $("source").className = error ? "note fail" : "note";
  $("problem").textContent = problem;
  $("batches").querySelectorAll("[data-queue]").forEach((a) => a.setAttribute("aria-current", String(a.getAttribute("data-queue") === batch?.name)));
  $("summary").textContent = dec ? `${made} of ${dec.rows.size} decided` : "";
  $<HTMLButtonElement>("export").disabled = !made;
  if (dec) {
    sync($("queue"), dec, selected, player.playing);
    storage.put(dec.key(), dec.saved());
  }
}

/** Says on each card what its clip should show (shows.ts), while `current()` holds: a sampled clip's words and facts
 *  from the library (its sets loaded at once), a submission's from its own clip (a recipe compiled, as its sheet and
 *  its Play compile it), its facts measured here (core's measureFacts, as the facts tool measures) when it carries
 *  none. Resolves with how many cards say it; one that can't be read says why. Reading decides nothing. */
async function describe(d: Decisions, current: () => boolean): Promise<number> {
  // the sampled clips' sets at once (one failing: each card's own read says why)
  await loadSets([...d.rows.values()].filter((r) => sectionOf(r) === "clip").map((r) => r.id.split("/")[0]!)).catch(() => undefined);
  let n = 0;
  for (const r of d.rows.values()) {
    if (!current()) break;
    let said: Shows | Error;
    try {
      const { clip, rest } = await clipOf(r, reg);
      said = shows(clip, sectionOf(r) === "clip" || clip.facts?.by ? clip.facts : (measureFacts(clip, rest) as unknown as Record<string, unknown>));
    } catch (err) {
      said = err instanceof Error ? err : new Error(String(err));
    }
    if (!current()) break;
    showShows($("queue"), r.id, said);
    n++;
  }
  return n;
}

/** Opens a queue (its JSON text or object) from `where` (a file's name, "bundled at build time" ...), or batch `b`; a
 *  bad one is named, the page keeps what it had. */
function open(data: unknown, where: string, b: Batch | null = null): ReturnType<typeof state> {
  try {
    const d = new Decisions(readQueue(data));
    d.restore(storage.get(d.key()));
    player.stop();
    [dec, source, batch, error, said] = [d, where, b, null, ""];
    selected.clear();
    $("out").replaceChildren();
    render($("queue"), d, renderer);
    const mine = ++opened, current = () => mine === opened;
    // what each card should show first (its clip read: quick), then the pictures (the sheets: a while)
    reading = describe(d, current);
    drawing = reading.catch(() => 0).then(() => drawPictures($("queue"), d, reg, current));
  } catch (err) {
    error = (err as Error).message;
  }
  refresh();
  return state();
}

/** Opens batch `name` (one this page carries), the link naming it (`?queue=NAME`, the renderer kept), so a reload or a
 *  link shared opens the same. */
function openBatch(name: string): ReturnType<typeof state> {
  const b = BATCHES.find((x) => x.name === name);
  if (!b) throw new Error(`no batch ${JSON.stringify(name)} on this page: it carries ${BATCHES.map((x) => x.name).join(", ") || "none"}`);
  problem = "";
  const q = new URLSearchParams(location.search);
  q.set("queue", b.name);
  history.replaceState(null, "", `?${q.toString()}`);
  return open(b.text, `batch ${b.name}`, b);
}

/** Plays row `id`'s clip in its card (stopping the one playing): resolves with the page's state once it plays. */
async function play(id: string): Promise<ReturnType<typeof state>> {
  const r = dec?.rows.get(id), slot = $("queue").querySelector<HTMLElement>(`[data-stage="${CSS.escape(id)}"]`);
  if (!r || !slot) throw new Error(`no row ${JSON.stringify(id)} on the page${dec ? `: its rows are ${[...dec.rows.keys()].join(", ")}` : ": open a queue first"}`);
  await player.play(r, slot);
  return state();
}

/** Decides rows `ids` (one id or a batch) `as` (null clears), with `note` when given. */
function decide(ids: string | readonly string[], as: intake.DecisionAs | null, note?: string): ReturnType<typeof state> {
  if (!dec) throw new Error("no queue is open: open one first");
  dec.set(typeof ids === "string" ? [ids] : ids, as, note);
  refresh();
  return state();
}

/** Exports the review: shared through the share sheet on a touch screen that can share a file, else (or with `how`
 *  "download") downloaded. The file's name and text, and how it went, are shown with the same decisions as commands. */
async function exportReview(how?: "share" | "download"): Promise<{ how: string; name: string; text: string }> {
  if (!dec) throw new Error("no queue is open: open one first");
  const review = dec.review(today()), text = `${JSON.stringify(review, null, 1)}\n`, name = `review-${review.date}.json`;
  const file = new File([text], name, { type: "application/json" }), phone = matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
  let done = "downloaded", why = "";
  if ((how ?? (phone ? "share" : "download")) === "share" && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      done = "shared";
    } catch (err) {
      if ((err as Error).name === "AbortError") done = "not shared (cancelled)";
      else why = ` (the share sheet failed: ${(err as Error).message})`;
    }
  }
  if (done === "downloaded") {
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(file), download: name });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
  }
  said = `${name} ${done}${why}: ${review.decisions.length} decisions; apply it with m3a review ingest ${name}`;
  const box = (title: string, t: string) => h("details", {}, h("summary", {}, title), h("pre", {}, t));
  $("out").replaceChildren(h("p", { class: "verdict" }, said), box("the same as m3a review commands", dec.commands(name).join("\n")), box(name, text));
  return { how: done, name, text };
}

/** The page as plain JSON (what `__m3a.state()` returns). */
function state() {
  const rows = (sec: Section) => [...(dec?.rows.values() ?? [])].filter((r) => sectionOf(r) === sec).map((r) => ({ id: r.id, ref: r.ref, ...dec!.get(r.id) }));
  return {
    source, batch: batch?.name ?? null, batches: BATCHES.map((b) => b.name), problem, error, store: dec?.queue.store ?? null, date: dec?.queue.date ?? null,
    submissions: rows("submission"), clips: rows("clip"), selected: [...selected], decided: dec?.list().length ?? 0, pictures: document.querySelectorAll("#queue canvas.picture").length,
    playing: player.playing, player: player.state(), playError: player.error, said,
  };
}

// a tap: Play or Stop on a row; a verdict (again: cleared), a row's checkbox, a section's "all", a batch's verdict
$("queue").addEventListener("click", (e) => {
  const playing = (e.target as HTMLElement).closest<HTMLElement>("[data-play]");
  if (playing && dec) {
    const id = playing.getAttribute("data-play")!;
    if (player.playing === id) player.stop();
    else void play(id);
    return;
  }
  const el = (e.target as HTMLElement).closest<HTMLElement>("[data-as],[data-select],[data-all],[data-batch]");
  if (!el || !dec) return;
  const a = (k: string) => el.getAttribute(k)!, ids = (sec: string) => [...dec!.rows.values()].filter((r) => sectionOf(r) === sec).map((r) => r.id);
  if (el.hasAttribute("data-as")) {
    const id = a("data-for"), as = a("data-as") as intake.DecisionAs;
    decide(id, dec.get(id).as === as ? null : as);
    return;
  }
  const pick = (id: string) => ((el as HTMLInputElement).checked ? selected.add(id) : selected.delete(id));
  if (el.hasAttribute("data-select")) pick(a("data-select"));
  else if (el.hasAttribute("data-all")) ids(a("data-all")).forEach(pick);
  else {
    const sec = a("data-section"), mine = ids(sec).filter((id) => selected.has(id)), note = $("queue").querySelector<HTMLInputElement>(`[data-batch-note="${sec}"]`)!;
    if (!mine.length) return;
    decide(mine, a("data-batch") as intake.DecisionAs, note.value.trim() || undefined);
    for (const id of mine) selected.delete(id);
    note.value = "";
  }
  refresh();
});
$("queue").addEventListener("input", (e) => {
  const id = (e.target as HTMLElement).getAttribute("data-note");
  if (id && dec) {
    dec.note(id, (e.target as HTMLTextAreaElement).value);
    refresh();
  }
});
$<HTMLInputElement>("file").addEventListener("change", async (e) => {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (!f) return;
  // a file isn't a batch: the link names none (the renderer kept)
  const q = new URLSearchParams(location.search);
  q.delete("queue");
  history.replaceState(null, "", q.size ? `?${q.toString()}` : location.pathname);
  problem = "";
  open(await f.text(), f.name);
});
$("batches").addEventListener("click", (e) => {
  const a = (e.target as HTMLElement).closest("[data-queue]");
  if (!a) return;
  e.preventDefault();
  openBatch(a.getAttribute("data-queue")!);
});
player.onChange = refresh;
$("export").addEventListener("click", () => void exportReview().catch((err: Error) => ($("out").textContent = `not exported: ${err.message}`)));

$("stamp").textContent = stamp;
// the guide: open on a first visit; closed or opened again, kept so in this browser (none kept in a private window)
const guide = $<HTMLDetailsElement>("guide");
try {
  if (localStorage.getItem(GUIDE) === "closed") guide.open = false;
} catch {
  // no storage: open, as on a first visit
}
guide.addEventListener("toggle", () => {
  try {
    localStorage.setItem(GUIDE, guide.open ? "open" : "closed");
  } catch {
    // kept on the page alone
  }
});
// the batches this page carries, each a link; at load the one the link names, else a queue bundled, else the newest
if (BATCHES.length) {
  const link = (b: Batch) => {
    const q = new URLSearchParams(location.search);
    q.set("queue", b.name);
    return h("a", { href: `?${q.toString()}`, "data-queue": b.name }, `${b.name} (${b.date}, ${b.clips} clips)`);
  };
  $("batches").replaceChildren("Batches here, newest first: ", ...byNewest(BATCHES).flatMap((b, i) => (i ? [" · ", link(b)] : [link(b)])));
}
const asked = pick(BATCHES, location.search), named = new URLSearchParams(location.search).has("queue");
problem = asked.problem ?? "";
if (asked.batch && (named || !BUNDLED)) open(asked.batch.text, `batch ${asked.batch.name}`, asked.batch);
else if (BUNDLED) open(BUNDLED, "bundled at build time");
else refresh();
(window as unknown as { __m3a: unknown }).__m3a = {
  ready: true, page: "review", version: VERSION, stamp, state, open, decide, batch: openBatch, play,
  stop: () => {
    player.stop();
    return state();
  },
  playing: () => player.state(),
  frame: () => player.frame(),
  clear: (ids: string | readonly string[]) => decide(ids, null, ""),
  review: () => dec?.review(today()) ?? null,
  commands: () => dec?.commands(`review-${today()}.json`) ?? [],
  export: exportReview,
  described: () => reading,
  drawn: () => drawing,
  actions: () => REVIEW_ACTIONS.map((a) => ({ ...a })),
  tools,
};
