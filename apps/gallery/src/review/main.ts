// The review queue's page (PLAN.md WP-8.2b): it opens a queue (m3a.review-queue/1) bundled at build time (the
// check-output/review/queue.json `m3a review export` last wrote, when there is one) or a file given (the picker), keeps
// the owner's decisions on the page (and in this browser's storage, by the queue's refs, so a reload keeps them), and
// exports the review (m3a.review/1) for `m3a review ingest <file>`: through the share sheet on a phone (navigator.share
// with a file), as a download on a desk. It puts `window.__m3a` (the page's handle: state, open, decide, clear,
// review, commands, export, drawn, actions) and `window.__M3A_TOOLS__` (every m3a tool, on the gallery's host) on it.
import { VERSION } from "@m3a/core";
import { installConsole, type intake } from "@m3a/tools";
import { GalleryRegistry, galleryHost } from "../host.ts";
import { h } from "../panels.ts";
import { REVIEW_ACTIONS } from "./actions.ts";
import { Decisions, readQueue, sectionOf, type Saved, type Section } from "./queue.ts";
import { drawPictures, render, sync } from "./view.ts";

const BUNDLED = Object.values(import.meta.glob<string>("../../../../check-output/review/queue.json", { query: "?raw", import: "default", eager: true }))[0];
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const reg = new GalleryRegistry(galleryHost()), tools = installConsole(reg, reg.host), stamp = `m3a ${VERSION} · ${__COMMIT__}`;
const selected = new Set<string>();
let dec: Decisions | null = null, source = "", error: string | null = null, drawing: Promise<number> = Promise.resolve(0), opened = 0, said = "";

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

/** The header line, the summary and the cards brought in step with the decisions. */
function refresh(): void {
  const q = dec?.queue, made = dec?.list().length ?? 0;
  $("source").textContent = error ?? (q ? `${source}: the ${q.store} store's queue of ${q.date}, ${q.submissions.length} submissions and ${q.clips.length} sampled clips` : "no queue yet: open the file m3a review export wrote");
  $("source").className = error ? "note fail" : "note";
  $("summary").textContent = dec ? `${made} of ${dec.rows.size} decided` : "";
  $<HTMLButtonElement>("export").disabled = !made;
  if (dec) {
    sync($("queue"), dec, selected);
    storage.put(dec.key(), dec.saved());
  }
}

/** Opens a queue (its JSON text or object) from `from` (a file's name, "bundled" ...); a bad one is named, the page
 *  keeps what it had. */
function open(data: unknown, from: string): ReturnType<typeof state> {
  try {
    const d = new Decisions(readQueue(data));
    d.restore(storage.get(d.key()));
    [dec, source, error, said] = [d, from, null, ""];
    selected.clear();
    $("out").replaceChildren();
    render($("queue"), d);
    const mine = ++opened;
    drawing = drawPictures($("queue"), d, reg, () => mine === opened);
  } catch (err) {
    error = (err as Error).message;
  }
  refresh();
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
  return { source, error, store: dec?.queue.store ?? null, date: dec?.queue.date ?? null, submissions: rows("submission"), clips: rows("clip"), selected: [...selected], decided: dec?.list().length ?? 0, pictures: document.querySelectorAll("#queue canvas").length, said };
}

// a tap: a verdict (again: cleared), a row's checkbox, a section's "all", a batch's verdict
$("queue").addEventListener("click", (e) => {
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
  if (f) open(await f.text(), f.name);
});
$("export").addEventListener("click", () => void exportReview().catch((err: Error) => ($("out").textContent = `not exported: ${err.message}`)));

$("stamp").textContent = stamp;
if (BUNDLED) open(BUNDLED, "bundled at build time");
else refresh();
(window as unknown as { __m3a: unknown }).__m3a = {
  ready: true, page: "review", version: VERSION, stamp, state, open, decide,
  clear: (ids: string | readonly string[]) => decide(ids, null, ""),
  review: () => dec?.review(today()) ?? null,
  commands: () => dec?.commands(`review-${today()}.json`) ?? [],
  export: exportReview,
  drawn: () => drawing,
  actions: () => REVIEW_ACTIONS.map((a) => ({ ...a })),
  tools,
};
