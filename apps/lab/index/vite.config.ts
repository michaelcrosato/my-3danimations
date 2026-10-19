// Vite config for the labs index (PLAN.md WP-8.3), which tools/run/site.ts builds into the preview site's /labs/. Its
// plugin writes the page at build time: every lab in apps/lab/ but this one, newest first, with its date and the
// question it answers as its README states them (`**Lab, YYYY-MM-DD**` and `**The question:** ...?`, AGENTS.md),
// linked to /labs/<name>/ when it has a page (an index.html), so a new lab appears without editing the index; a lab
// whose README lacks either fails the build. The build stamp's version is core's, its commit Vercel's or GitHub
// Actions', else git's, as on the gallery's and the labs' pages.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, type Plugin } from "vite";
import { buildCommit } from "../../../tools/run/stamp.ts";
import { VERSION } from "@m3a/core";

const ROOT = join(import.meta.dirname, "../../.."), LABS = join(ROOT, "apps/lab");


/** A lab as the index lists it, read from apps/lab/<name>/README.md. */
interface Lab {
  name: string;
  title: string;
  date: string;
  question: string;
  page: boolean;
}

/** Every lab but the index, newest first; throws naming the README that lacks its date or its question. */
function labs(): Lab[] {
  const dirs = readdirSync(LABS, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name !== "index");
  return dirs
    .map(({ name }) => {
      const readme = join(LABS, name, "README.md"), text = existsSync(readme) ? readFileSync(readme, "utf8") : "";
      const date = /\*\*Lab, (\d{4}-\d{2}-\d{2})\*\*/.exec(text)?.[1], question = /\*\*The question:\*\*\s*([^?]+\?)/.exec(text)?.[1];
      if (!date || !question) throw new Error(`labs index: apps/lab/${name}/README.md needs "**Lab, YYYY-MM-DD**" and "**The question:** ...?" (AGENTS.md: every lab has a date and the question it answers)`);
      return { name, title: /^# (.+)$/m.exec(text)?.[1] ?? name, date, question: question.replace(/\s+/g, " "), page: existsSync(join(LABS, name, "index.html")) };
    })
    .sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const code = (s: string) => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>");

/** The page's list and stamp, written into index.html's two markers. */
function index(): Plugin {
  return {
    name: "m3a-labs-index",
    transformIndexHtml(html) {
      const all = labs(), items = all.map((l) => {
        const name = l.page ? `<a href="./${esc(l.name)}/">${esc(l.name)}</a>` : `${esc(l.name)} <span class="date">(no page)</span>`;
        return `<li id="lab-${esc(l.name)}"><h2>${name} <span class="date">${l.date}</span></h2><p class="title">${code(l.title)}</p><p>${code(l.question)}</p></li>`;
      });
      const list = `<p class="lead">${all.length} lab${all.length === 1 ? "" : "s"}.</p><ul class="labs">${items.join("")}</ul>`;
      return html.replace("<!--m3a:labs-->", list).replace("<!--m3a:stamp-->", esc(`m3a ${VERSION} · ${buildCommit(ROOT)}`));
    },
  };
}

export default defineConfig({
  root: import.meta.dirname,
  base: "./",
  plugins: [index()],
  build: { outDir: "dist", emptyOutDir: true, target: "es2023", reportCompressedSize: false },
  logLevel: "warn",
});
