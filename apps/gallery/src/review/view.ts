// The review page's view (PLAN.md WP-8.2b), phone first: a section for the submissions awaiting review and one for the
// sampled library clips, each with its batch bar (select rows, one verdict and one note for all), and a card per row:
// its ref, its preview sheet (the sensors' software raster, drawn by the sheet tool on the page), its numbers, the
// checker's report and, for a submission that improves a library clip, how far it parts from that clip (the queue's
// numbers and the diff tool's picture); the verdict buttons and a note. Built with text nodes alone: a submission's
// text, report and notes are data, never markup. Every picture and caption is a registry tool's reply.
import type { Image } from "@m3a/sensors";
import type { intake, registry } from "@m3a/tools";
import type { GalleryRegistry } from "../host.ts";
import { h } from "../panels.ts";
import { sectionOf, VERDICTS, type Decisions, type Row, type Section } from "./queue.ts";

const LABEL: Record<intake.DecisionAs, string> = { adopt: "Adopt", archive: "Archive", reject: "Reject", approve: "Approve", flag: "Flag" };
const TITLE: Record<Section, string> = { submission: "Submissions awaiting review", clip: "Sampled library clips" };
const s = (n: number, what: string) => `${n} ${what}${n === 1 ? "" : "s"}`;

/** A row's numbers as one line: the sensors' verdict, findings, length, keys and fit. */
function numbers(n: intake.QueueNumbers | null): HTMLElement {
  if (!n) return h("p", { class: "nums" }, "unmeasured (a recipe, or a clip that doesn't validate): the check report says why");
  return h("p", { class: "nums" }, h("b", { class: n.verdict }, n.verdict.toUpperCase()), ` · ${s(n.findings, "finding")} (${n.fail} fail) · ${n.dur} s · ${s(n.keys, "key")}${n.fit ? ` · fit ${n.fit.join(" / ")} mm` : ""}`);
}

const details = (summary: string, text: string) => h("details", {}, h("summary", {}, summary), h("pre", {}, text));

/** How a submission parts from the clip it improves, in the queue's numbers. */
function diffLine(d: intake.QueueDiff): HTMLElement {
  const said = d.max ? `poses differ up to ${d.max} mm (${d.point ?? "a point"} at ${d.at} s), ${d.mean} mm on average` : "the same poses";
  return h("p", { class: "diff" }, `improves ${d.against}: ${said}; ${d.verdict[0].toUpperCase()} → ${d.verdict[1].toUpperCase()}`);
}

/** A row's card. */
function card(r: Row): HTMLElement {
  const sec = sectionOf(r), what = "stale" in r
    ? `${r.tier} · ${r.stale ? `stale: its ${r.review?.state ?? ""} review was made on other motion` : "unreviewed"}`
    : `${r.kind} by ${r.contributor}, ${r.date}${r.improves ? `, improves ${r.improves}` : ""}`;
  const kids: (Node | string | null)[] = [
    h("label", { class: "pick" }, h("input", { type: "checkbox", "data-select": r.id, "aria-label": `select ${r.id}` }), h("b", { class: "ref" }, r.ref)),
    h("p", { class: "note" }, what),
    h("div", { class: "pics", "data-pics": r.id }, h("p", { class: "note" }, "drawing the preview sheet…")),
    numbers(r.numbers),
    r.numbers ? details("metrics (each one's worst)", Object.entries(r.numbers.metrics).map(([k, v]) => `${k}: ${v}`).join("\n")) : null,
  ];
  if ("stale" in r) {
    if (r.review) kids.push(h("p", { class: "note" }, `its review: ${r.review.state} by ${r.review.by} on ${r.review.date}${r.review.note ? `: ${r.review.note}` : ""}`));
  } else {
    if (r.diff) kids.push(diffLine(r.diff));
    kids.push(details("check report", r.report === null || r.report === undefined ? "none" : JSON.stringify(r.report, null, 1)));
  }
  kids.push(
    h("div", { class: "verdicts", role: "group", "aria-label": "verdict" }, ...VERDICTS[sec].map((as) => h("button", { type: "button", "data-as": as, "data-for": r.id, "aria-pressed": "false", class: `v-${as}` }, LABEL[as]))),
    h("textarea", { "data-note": r.id, rows: "2", placeholder: "a note (optional; \"theme: …\" files it under a theme, \"threshold: …\" or \"task: …\" proposes one)", "aria-label": `note on ${r.id}` }),
  );
  return h("article", { class: "card", "data-id": r.id, "data-section": sec }, ...kids);
}

/** A section: its title, its batch bar and its rows' cards. */
function section(sec: Section, rows: Row[]): HTMLElement {
  const bar = h("div", { class: "batch", "data-batch-bar": sec },
    h("label", { class: "pick" }, h("input", { type: "checkbox", "data-all": sec }), "all"),
    h("span", { "data-count": sec }, "0 selected"),
    h("input", { type: "text", "data-batch-note": sec, placeholder: "the batch's note", "aria-label": `note for the ${sec === "clip" ? "clips" : "submissions"} selected` }),
    h("div", { class: "verdicts" }, ...VERDICTS[sec].map((as) => h("button", { type: "button", "data-batch": as, "data-section": sec }, `${LABEL[as]} selected`))));
  const body = rows.length ? rows.map(card) : [h("p", { class: "note" }, sec === "clip" ? "no sampled clips: every clip's review holds" : "nothing awaits review")];
  return h("section", { class: "queue-section", "data-section": sec }, h("h2", {}, `${TITLE[sec]} (${rows.length})`), rows.length ? bar : null, ...body);
}

/** Draws the queue into `root`: the submissions' section, then the sampled clips'. */
export function render(root: HTMLElement, dec: Decisions): void {
  root.replaceChildren(section("submission", dec.queue.submissions), section("clip", dec.queue.clips));
}

/** Brings the page in step with the decisions and the selection: each card's verdict, checkbox and note, and the
 *  batch bars' counts. */
export function sync(root: HTMLElement, dec: Decisions, selected: ReadonlySet<string>): void {
  root.querySelectorAll<HTMLElement>("article.card").forEach((el) => {
    const id = el.dataset.id!, d = dec.get(id), note = el.querySelector("textarea")!;
    el.dataset.decision = d.as ?? "";
    el.querySelectorAll("[data-as]").forEach((b) => b.setAttribute("aria-pressed", String(b.getAttribute("data-as") === d.as)));
    el.querySelector<HTMLInputElement>("[data-select]")!.checked = selected.has(id);
    if (document.activeElement !== note && note.value !== d.note) note.value = d.note;
  });
  for (const sec of ["submission", "clip"] as const) {
    const ids = [...dec.rows.values()].filter((r) => sectionOf(r) === sec).map((r) => r.id), n = ids.filter((id) => selected.has(id)).length;
    const count = root.querySelector(`[data-count="${sec}"]`), all = root.querySelector<HTMLInputElement>(`[data-all="${sec}"]`);
    if (count) count.textContent = `${n} selected`;
    if (all) all.checked = n > 0 && n === ids.length;
  }
}

/** A tool's picture on a canvas, captioned with its reply's verdict (the tool's own words). */
function picture(reply: registry.Reply, img: Image | undefined, label: string): HTMLElement {
  const fig = h("figure", { "data-tool": reply.tool });
  if (img) {
    const c = h("canvas", { class: "picture", width: String(img.width), height: String(img.height), "aria-label": label }) as HTMLCanvasElement;
    c.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
    fig.append(c);
  }
  fig.append(h("figcaption", { class: reply.status }, `${label}: ${reply.verdict}`));
  return fig;
}

/** The tool calls that draw a row: a sampled clip's sheet; a submission's sheet (a recipe compiled first) and its diff
 *  against the clip it improves. Its text goes to the host's files, as a tool reads a file. */
async function draw(r: Row, reg: GalleryRegistry): Promise<HTMLElement[]> {
  const call = async (label: string, tool: string, args: Record<string, unknown>) => {
    const reply = await reg.call(tool, args);
    return { reply, el: picture(reply, reg.host.images.get(reply.images[0]?.name ?? ""), label) };
  };
  if ("stale" in r) return [(await call("preview sheet", "sheet", { clip: r.id, frames: 8 })).el];
  if (!r.text) return [h("p", { class: "note" }, "the queue holds no text for it: m3a review export writes each submission's")];
  let clip = `check-output/review/${r.id}.${r.kind}.json`;
  reg.host.files.set(clip, r.text);
  const out: HTMLElement[] = [];
  if (r.kind === "recipe") {
    const made = await call("compiled", "recipe.compile", { recipe: clip }), path = (made.reply.data as { path?: string } | null)?.path;
    if (!path) return [made.el];
    clip = path;
  }
  out.push((await call("preview sheet", "sheet", { clip, frames: 8 })).el);
  if (r.improves && r.kind === "clip") out.push((await call(`against ${r.improves}`, "diff", { a: r.improves, b: clip, frames: 6 })).el);
  return out;
}

/** Draws each row's pictures, one row at a time, while `current()` holds (a queue opened since stops it); resolves
 *  with how many rows were drawn. */
export async function drawPictures(root: HTMLElement, dec: Decisions, reg: GalleryRegistry, current: () => boolean): Promise<number> {
  let n = 0;
  for (const r of dec.rows.values()) {
    if (!current()) break;
    let kids: HTMLElement[];
    try {
      kids = await draw(r, reg);
    } catch (err) {
      kids = [h("p", { class: "note fail" }, `not drawn: ${(err as Error).message}`)];
    }
    if (!current()) break;
    root.querySelector(`[data-pics="${CSS.escape(r.id)}"]`)?.replaceChildren(...kids);
    n++;
  }
  return n;
}
