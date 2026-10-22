// The review page's view (PLAN.md WP-8.2b), phone first: a section for the submissions awaiting review and one for the
// sampled library clips, each with its batch bar (select rows, one verdict and one note for all), and a card per row:
// its ref; a Play control (the page's player, play.ts, plays its clip looping in the card's slot) and a link opening
// its clip in the gallery in a new tab (a submission's: the clip it improves); its preview sheet (the sensors' software
// raster, drawn by the sheet tool on the page, at SHEET_VIEW, the view the player plays at); its numbers, the checker's
// report and, for a submission that improves a library clip, how far it parts from that clip (the queue's numbers and
// the diff tool's picture); the verdict buttons and a note (WP-F.11). Under its ref, above its Play and its verdicts,
// "What it should show" (WP-F.12, shows.ts): its description, whether it loops and how long it is, which way and how
// fast it travels, and its tags, as an agent reads them; the page fills it in (showShows) once the clip is read. Built
// with text nodes alone: a submission's text, report and notes are data, never markup. Every picture and caption is a
// registry tool's reply.
import type { Image } from "@m3a/sensors";
import type { intake, registry } from "@m3a/tools";
import type { GalleryRegistry } from "../host.ts";
import { h } from "../panels.ts";
import { clipLink, type Route, type View } from "../route.ts";
import { sectionOf, VERDICTS, type Decisions, type Row, type Section } from "./queue.ts";
import { NO_DESC, tagWords, type Shows } from "./shows.ts";

/** The view a card's preview sheet is drawn at and its clip plays at: the sheet tool's default, the gallery's too. */
export const SHEET_VIEW: View = "three-quarter";

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

/** A row's Play control and its link to the gallery: the clip's own (a sampled clip), the clip a submission improves,
 *  or none (a new submission: the gallery opens library clips alone), in a new tab, the review page's renderer kept. */
function playBar(r: Row, renderer: Route["renderer"]): HTMLElement {
  const target = "stale" in r ? r.id : r.improves, title = "stale" in r ? "Open in the gallery" : `Open ${r.improves ?? ""}, the clip it improves, in the gallery`;
  return h("div", { class: "play-bar" },
    h("button", { type: "button", class: "play", "data-play": r.id, "aria-pressed": "false", "aria-label": `play ${r.id}` }, "Play"),
    target ? h("a", { class: "gallery-link", "data-gallery": target, href: `../../${clipLink(target, renderer)}`, target: "_blank", rel: "noopener" }, `${title} ↗`) : h("span", { class: "note" }, "new: Play plays it here (the gallery opens library clips)"));
}

/** A row's card. */
function card(r: Row, renderer: Route["renderer"]): HTMLElement {
  const sec = sectionOf(r), what = "stale" in r
    ? `${r.tier} · ${r.stale ? `stale: its ${r.review?.state ?? ""} review was made on other motion` : "unreviewed"}`
    : `${r.kind} by ${r.contributor}, ${r.date}${r.improves ? `, improves ${r.improves}` : ""}`;
  const kids: (Node | string | null)[] = [
    h("label", { class: "pick" }, h("input", { type: "checkbox", "data-select": r.id, "aria-label": `select ${r.id}` }), h("b", { class: "ref" }, r.ref)),
    h("p", { class: "note" }, what),
    h("div", { class: "shows", "data-shows": r.id }, h("p", { class: "note" }, "What it should show: reading the clip…")),
    playBar(r, renderer),
    h("div", { class: "stage-slot", "data-stage": r.id }),
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

/** Says in row `id`'s card what its clip should show (`said`), or why it couldn't be read: the description (or that
 *  it has none), how it plays and for how long, its travel, its tags. */
export function showShows(root: HTMLElement, id: string, said: Shows | Error): void {
  const box = root.querySelector(`[data-shows="${CSS.escape(id)}"]`), title = h("b", {}, "What it should show: ");
  if (!box) return;
  if (said instanceof Error) {
    box.replaceChildren(h("p", { class: "note fail" }, title, `not read (${said.message})`));
    return;
  }
  box.replaceChildren(
    h("p", { class: "shows-what" }, title, said.desc === null ? h("span", { class: "fail", "data-no-desc": "" }, NO_DESC) : h("span", { "data-desc": "" }, said.desc)),
    h("ul", {}, h("li", { "data-plays": said.plays }, said.playing), h("li", { "data-travel": "" }, said.travel), h("li", { "data-tags": "" }, tagWords(said.tags))),
  );
}

/** A section: its title, its batch bar and its rows' cards. */
function section(sec: Section, rows: Row[], renderer: Route["renderer"]): HTMLElement {
  const bar = h("div", { class: "batch", "data-batch-bar": sec },
    h("label", { class: "pick" }, h("input", { type: "checkbox", "data-all": sec }), "all"),
    h("span", { "data-count": sec }, "0 selected"),
    h("input", { type: "text", "data-batch-note": sec, placeholder: "the batch's note", "aria-label": `note for the ${sec === "clip" ? "clips" : "submissions"} selected` }),
    h("div", { class: "verdicts" }, ...VERDICTS[sec].map((as) => h("button", { type: "button", "data-batch": as, "data-section": sec }, `${LABEL[as]} selected`))));
  const body = rows.length ? rows.map((r) => card(r, renderer)) : [h("p", { class: "note" }, sec === "clip" ? "no sampled clips: every clip's review holds" : "nothing awaits review")];
  return h("section", { class: "queue-section", "data-section": sec }, h("h2", {}, `${TITLE[sec]} (${rows.length})`), rows.length ? bar : null, ...body);
}

/** Draws the queue into `root`: the submissions' section, then the sampled clips'; the gallery links ask for
 *  `renderer` when the page was asked for it. */
export function render(root: HTMLElement, dec: Decisions, renderer: Route["renderer"] = null): void {
  root.replaceChildren(section("submission", dec.queue.submissions, renderer), section("clip", dec.queue.clips, renderer));
}

/** Brings the page in step with the decisions, the selection and the row playing: each card's verdict, checkbox, note
 *  and Play control, and the batch bars' counts. */
export function sync(root: HTMLElement, dec: Decisions, selected: ReadonlySet<string>, playing: string | null = null): void {
  root.querySelectorAll<HTMLElement>("article.card").forEach((el) => {
    const id = el.dataset.id!, d = dec.get(id), note = el.querySelector("textarea")!;
    el.dataset.decision = d.as ?? "";
    el.querySelectorAll("[data-as]").forEach((b) => b.setAttribute("aria-pressed", String(b.getAttribute("data-as") === d.as)));
    el.querySelector<HTMLInputElement>("[data-select]")!.checked = selected.has(id);
    if (document.activeElement !== note && note.value !== d.note) note.value = d.note;
    const play = el.querySelector<HTMLElement>("[data-play]")!;
    play.setAttribute("aria-pressed", String(playing === id));
    play.textContent = playing === id ? "Stop" : "Play";
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

/** A submission's clip as a file the tools read: its text put in the host's files (as a tool reads a file); a recipe
 *  compiled by recipe.compile first (its reply; the path is null when it didn't compile). The sheet and the player
 *  both take a submission's clip from here. */
export async function submissionClip(r: intake.QueueSubmission & { text: string }, reg: GalleryRegistry): Promise<{ path: string | null; compiled: registry.Reply | null }> {
  const file = `check-output/review/${r.id}.${r.kind}.json`;
  reg.host.files.set(file, r.text);
  if (r.kind !== "recipe") return { path: file, compiled: null };
  const compiled = await reg.call("recipe.compile", { recipe: file });
  return { path: (compiled.data as { path?: string } | null)?.path ?? null, compiled };
}

/** The tool calls that draw a row: a sampled clip's sheet; a submission's sheet (a recipe compiled first) and its diff
 *  against the clip it improves. Each sheet at SHEET_VIEW. */
async function draw(r: Row, reg: GalleryRegistry): Promise<HTMLElement[]> {
  const call = async (label: string, tool: string, args: Record<string, unknown>) => {
    const reply = await reg.call(tool, args);
    return { reply, el: picture(reply, reg.host.images.get(reply.images[0]?.name ?? ""), label) };
  };
  if ("stale" in r) return [(await call("preview sheet", "sheet", { clip: r.id, frames: 8, view: SHEET_VIEW })).el];
  if (!r.text) return [h("p", { class: "note" }, "the queue holds no text for it: m3a review export writes each submission's")];
  const { path, compiled } = await submissionClip({ ...r, text: r.text }, reg);
  if (!path) return [picture(compiled!, reg.host.images.get(compiled!.images[0]?.name ?? ""), "compiled")];
  const out = [(await call("preview sheet", "sheet", { clip: path, frames: 8, view: SHEET_VIEW })).el];
  if (r.improves && r.kind === "clip") out.push((await call(`against ${r.improves}`, "diff", { a: r.improves, b: path, frames: 6 })).el);
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
