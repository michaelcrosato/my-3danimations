// The manual's tool list (PLAN.md §6 "Docs drift", WP-7.3): one line per m3a tool, written from the registry
// (packages/tools/src/tools/index.ts) between two marker comments in packages/tools/MANUAL.md, so the list can't drift
// from the tools. Each line gives the tool's `m3a` call (positionals as `<name>`, required flags with a value, optional
// ones in brackets; the registry's verbose, if_revision and request_id left to the manual's prose), its MCP name, and
// what it is for: its description up to the first ":" or ";", parentheses dropped. `node tools/manual/main.ts`
// rewrites the list; `--check` fails when it differs, and packages/tools/test/manual.test.ts checks it in T1.
import type { Tool } from "../../packages/tools/src/registry/registry.ts";
import { mcpName } from "../../packages/tools/src/mcp.ts";

/** The line that opens the generated list. */
export const BEGIN = "<!-- tools: written by node tools/manual/main.ts -->";
/** The line that closes it. */
export const END = "<!-- /tools -->";
/** Parameters every tool or every edit takes, which the manual's prose covers instead of each line. */
const COMMON = new Set(["verbose", "if_revision", "request_id"]);

/** A flag as the CLI spells it in `m3a help` (`save_as` is `--save-as`; the CLI takes either). */
const flag = (param: string): string => `--${param.replace(/_/g, "-")}`;

/** What a tool is for, in a few words: its description up to the first ":" or ";", without parentheses or full stop,
 *  a path or placeholder outside backticks put in them (`imports/<SET>/`: markdown would drop `<SET>` as a tag). */
export function purpose(description: string): string {
  const text = description.replace(/\s*\([^)]*\)/g, "").split(/[:;]\s/)[0]!.trim().replace(/\.$/, "");
  return text.split("`").map((part, i) => (i % 2 ? part : part.replace(/[\w.<>/-]*[/<][\w.<>/-]*/g, (p) => `\`${p}\``))).join("`");
}

/** A tool's line: `m3a <name> <positionals> --required <x> [--optional]`, its MCP name, its purpose, and whether it
 *  is an edit (if_revision, request_id, undoable) or writes files the user keeps. */
export function toolLine(t: Tool): string {
  const props = Object.keys(t.schema.properties ?? {}).filter((k) => !COMMON.has(k)), pos = t.positionals ?? [], req = new Set(t.schema.required ?? []);
  const words = [`m3a ${t.name}`, ...pos.map((p) => `<${p}>`), ...props.filter((p) => !pos.includes(p) && req.has(p)).map((p) => `${flag(p)} <${p}>`), ...props.filter((p) => !pos.includes(p) && !req.has(p)).map((p) => `[${flag(p)}]`)];
  const kind = t.edit ? " (an edit)" : t.writes ? " (writes files)" : "";
  return `- \`${words.join(" ")}\` · \`${mcpName(t.name)}\`${kind}: ${purpose(t.description)}`;
}

/** The generated section: the markers around one line per tool, in the registry's order. */
export function toolList(tools: readonly Tool[]): string {
  return [BEGIN, ...tools.map(toolLine), END].join("\n");
}

/** The manual with its list rewritten from `tools`; throws when the markers are missing, doubled or out of order. */
export function withToolList(manual: string, tools: readonly Tool[]): string {
  const a = manual.indexOf(BEGIN), b = manual.indexOf(END);
  if (a < 0 || b < a || manual.indexOf(BEGIN, a + 1) >= 0 || manual.indexOf(END, b + 1) >= 0) throw new Error(`the manual needs one line "${BEGIN}" and, after it, one "${END}", where the tool list goes`);
  return manual.slice(0, a) + toolList(tools) + manual.slice(b + END.length);
}
