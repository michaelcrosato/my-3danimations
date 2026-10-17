// The skill, llms.txt and .mcp.json (PLAN.md WP-7.3). Each SKILL.md (the shipped one, skills/m3a/, and this
// repository's own, .claude/skills/m3a/) in agentskills.io's format (agentskills.io/specification, read 2026-10-17):
// YAML frontmatter with a name of lowercase letters, digits and single hyphens that matches its directory, a description
// of 1 to 1,024 characters and a compatibility of at most 500, no other fields than the spec's; each within 600 cl100k
// tokens. Every `m3a <tool>` either names is a registry tool (packages/tools/src/tools/index.ts) called with arguments
// it takes, or the CLI's own `help` and `mcp`; every MCP name is a registry tool's; every path, package and clip id it
// names exists (the shipped skill's in an installed package, from its package's source; `<X>` in a path matches any
// name). llms.txt in llmstxt.org's format (an H1, a blockquote, then H2 sections of links), every link there, every
// catalog linked; and .mcp.json's command serving the registry's tools over MCP.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { describe, expect, it } from "vitest";
import { parseCall, runCli } from "../../packages/tools/src/cli.ts";
import { mcpName } from "../../packages/tools/src/mcp.ts";
import { TOOLS, tools } from "../../packages/tools/src/tools/index.ts";
import { tokens } from "../doctrine/budgets.ts";

const ROOT = join(import.meta.dirname, "../..");
/** The two skills: the one an installed package ships, and this repository's own. */
const SKILLS = ["skills/m3a/SKILL.md", ".claude/skills/m3a/SKILL.md"];
/** The fields agentskills.io's frontmatter allows. */
const FIELDS = ["name", "description", "license", "compatibility", "metadata", "allowed-tools"];
/** The `m3a` commands that aren't registry tools: the CLI's index and the MCP server (packages/tools/src/node.ts). */
const BUILTINS = ["help", "mcp"];
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

/**
 * A SKILL.md's frontmatter, in the subset of YAML these files use: one `key: value` line a field, each value plain or
 * double-quoted (read as JSON reads it, whose escapes YAML's double quotes share); a nested map, a block scalar or a
 * plain value YAML would read some other way throws.
 */
function frontmatter(text: string): { meta: Record<string, string>; body: string } {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!m) throw new Error("no frontmatter: a SKILL.md opens with a --- line, its fields, and another --- line");
  const meta: Record<string, string> = {};
  for (const line of m[1]!.split("\n")) {
    const [, key, value] = /^([a-z][a-z-]*): (.+)$/.exec(line) ?? [];
    if (!key || !value) throw new Error(`not a "key: value" line: ${line}`);
    if (Object.hasOwn(meta, key)) throw new Error(`${key} given twice`);
    if (value.startsWith('"')) meta[key] = JSON.parse(value) as string;
    else if (/^[^-?:,[\]{}#&*!|>'"%@`\s]/.test(value) && !/: | #|:$/.test(value)) meta[key] = value;
    else throw new Error(`a plain value YAML would read otherwise (quote it): ${line}`);
  }
  return { meta, body: text.slice(m[0].length) };
}

/** A command's words as a shell splits them, quotes taken off; a `<placeholder>` stays one word, brackets kept. */
function words(line: string): string[] {
  return [...line.matchAll(/'([^']*)'|"([^"]*)"|(<[^>]*>)|(\S+)/g)].map((m) => m[1] ?? m[2] ?? m[3] ?? m[4]!);
}

/** Whether a path exists, `<X>` in it matching any name (`library/sets/<SET>/catalog.tsv`). */
function exists(path: string): boolean {
  const parts = path.replace(/\/$/, "").split("/");
  const walk = (dir: string, i: number): boolean => {
    if (i === parts.length) return true;
    const p = parts[i]!;
    if (!/^<[^>]+>$/.test(p)) return existsSync(join(dir, p)) && walk(join(dir, p), i + 1);
    return existsSync(dir) && readdirSync(dir).some((n) => walk(join(dir, n), i + 1));
  };
  return walk(ROOT, 0);
}

/**
 * What a text names, from its backtick spans: `m3a` commands (the tool and its arguments), MCP names, and paths,
 * packages and clip ids (a span or a command's word with a slash, or ending in a file's extension; a whole
 * `<placeholder>` is none of them).
 */
function named(text: string): { commands: { tool: string; args: string[] }[]; mcp: string[]; paths: string[] } {
  const out = { commands: [] as { tool: string; args: string[] }[], mcp: [] as string[], paths: [] as string[] };
  const pathlike = (w: string) => !/^<.*>$/.test(w) && !w.startsWith("-") && /^[\w.@<>/-]+$/.test(w) && (w.includes("/") || /\.(md|txt|tsv|json|ts|js|glb|gltf)$/.test(w));
  for (const [, span] of text.matchAll(/`([^`\n]+)`/g)) {
    const cmd = /^(?:npx )?m3a (\S+)(.*)$/.exec(span!);
    if (cmd) {
      const args = words(cmd[2]!);
      out.commands.push({ tool: cmd[1]!, args });
      out.paths.push(...args.filter(pathlike));
    } else if (/^(mcp__m3a__)?[a-z]+(_[a-z]+)+$/.test(span!)) out.mcp.push(span!.replace(/^mcp__m3a__/, ""));
    else if (pathlike(span!)) out.paths.push(span!);
  }
  return out;
}

/** Checks what a text names: its commands run as written (help's own arguments a tool or a placeholder), its MCP names
 *  are tools', and each path, package or clip id exists, read by `where` (a path in the repository, or null when the
 *  text may not name it). */
function checkNamed(text: string, where: (path: string) => string | null): void {
  const n = named(text), names = TOOLS.map((t) => t.name);
  for (const c of n.commands) {
    if (BUILTINS.includes(c.tool)) {
      for (const a of c.args.filter((w) => !/^<.*>$/.test(w) && !w.startsWith("-"))) expect(names, `m3a help ${a}`).toContain(a);
      continue;
    }
    const tool = TOOLS.find((t) => t.name === c.tool);
    expect(tool, `m3a ${c.tool}: no such tool`).toBeDefined();
    const args = parseCall(tool!, c.args);
    expect(typeof args === "string" ? args : "", `m3a ${c.tool} ${c.args.join(" ")}`).toBe("");
  }
  for (const m of n.mcp) expect(TOOLS.map((t) => mcpName(t.name)), `MCP tool ${m}`).toContain(m);
  for (const p of n.paths) {
    const pkg = /^@m3a\/([\w-]+)$/.exec(p);
    if (pkg) {
      expect(JSON.parse(read(`packages/${pkg[1]}/package.json`)).name, p).toBe(p);
      continue;
    }
    const clip = /^([A-Z0-9_]+)\/([\w-]+)$/.exec(p);
    if (clip && existsSync(join(ROOT, "library/sets", clip[1]!))) {
      expect(existsSync(join(ROOT, "library/sets", clip[1]!, `${clip[2]}.json`)), `clip ${p}`).toBe(true);
      continue;
    }
    const at = where(p);
    expect(at, `${p}: a path this text may not name`).not.toBeNull();
    expect(exists(at!), `${p} (${at})`).toBe(true);
  }
}

describe("the skills", () => {
  for (const file of SKILLS) {
    it(`${file} is an agentskills.io skill: its frontmatter, name, description and size`, () => {
      const text = read(file), { meta, body } = frontmatter(text);
      expect(Object.keys(meta).filter((k) => !FIELDS.includes(k))).toEqual([]);
      expect(meta.name).toBe(basename(dirname(file)));
      expect(meta.name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(meta.name!.length).toBeLessThanOrEqual(64);
      expect(meta.description?.length ?? 0).toBeGreaterThan(0);
      expect(meta.description!.length).toBeLessThanOrEqual(1024);
      expect(meta.compatibility?.length ?? 0).toBeLessThanOrEqual(500);
      expect(body.trim()).not.toBe("");
      expect(tokens(text)).toBeLessThanOrEqual(600);
    });
  }
  it("the shipped skill names its five commands, every tool and the manual where an installed package has it", () => {
    const text = read("skills/m3a/SKILL.md"), n = named(text);
    expect(n.commands.filter((c) => !BUILTINS.includes(c.tool))).toHaveLength(5);
    expect(n.paths).toContain("node_modules/@m3a/tools/MANUAL.md");
    // an installed package's file is its package's source's (bench/runner's trials check the installed one); a path in
    // the user's project can't be checked, so the shipped skill names none
    checkNamed(text, (p) => {
      const m = /^node_modules\/@m3a\/([\w-]+)\/(.+)$/.exec(p);
      return m ? `packages/${m[1]}/${m[2]}` : null;
    });
  });
  it("this repository's skill names its five commands, each a registry example, and the manual", () => {
    const text = read(".claude/skills/m3a/SKILL.md"), five = named(text).commands.filter((c) => !BUILTINS.includes(c.tool));
    expect(five).toHaveLength(5);
    expect(named(text).paths).toContain("packages/tools/MANUAL.md");
    // each as `m3a help <tool>` shows its first example, so the registry's tests run what it names
    for (const c of five) {
      const tool = TOOLS.find((t) => t.name === c.tool)!, args = parseCall(tool, c.args);
      expect(tool.examples.some((e) => isDeepStrictEqual(e.args, args)), `m3a ${c.tool} ${c.args.join(" ")}`).toBe(true);
    }
    checkNamed(text, (p) => p);
  });
  it("the CLI's own commands it names run", async () => {
    let out = "";
    expect(await runCli(tools, ["help"], { print: (t) => void (out += t), write: () => {} })).toBe(0);
    expect(out).toContain("m3a mcp serves them over MCP");
  });
});

describe("llms.txt", () => {
  const text = read("llms.txt"), lines = text.split("\n");
  it("is in llmstxt.org's format: an H1, a blockquote, notes without headings, then H2 sections of links", () => {
    expect(lines[0]).toMatch(/^# \S/);
    const first = lines.findIndex((l) => l.startsWith("## "));
    const head = lines.slice(1, first).filter((l) => l.trim());
    expect(head[0]).toMatch(/^> \S/);
    expect(head.filter((l) => l.startsWith("#"))).toEqual([]);
    const sections = lines.slice(first).filter((l) => l.trim());
    for (const l of sections) expect(l, l).toMatch(/^## \S|^- \[[^\]]+\]\([^)\s]+\)(: \S.*)?$/);
    expect(sections.filter((l) => l.startsWith("## ")).map((l) => l.slice(3))).toContain("Optional");
  });
  it("links the manual, the skill, the tool list, the spec and every catalog, each there", () => {
    const links = [...text.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1]!);
    for (const l of links) expect(existsSync(join(ROOT, l)), l).toBe(true);
    const catalogs = readdirSync(join(ROOT, "library/sets")).filter((s) => existsSync(join(ROOT, "library/sets", s, "catalog.tsv"))).map((s) => `library/sets/${s}/catalog.tsv`);
    expect(catalogs.length).toBeGreaterThan(0);
    expect(links).toEqual(expect.arrayContaining(["packages/tools/MANUAL.md", "skills/m3a/SKILL.md", "packages/tools/src/tools/index.ts", "spec/MOTION.md", "spec/LEGEND.md", ...catalogs]));
    checkNamed(text, (p) => p);
  });
});

describe(".mcp.json", () => {
  it("runs the m3a MCP server from source, which lists every registry tool", () => {
    const config = JSON.parse(read(".mcp.json")) as { mcpServers: Record<string, { command: string; args: string[] }> };
    expect(Object.keys(config.mcpServers)).toEqual(["m3a"]);
    const { command, args } = config.mcpServers.m3a!;
    expect([command, args]).toEqual(["node", ["packages/tools/src/node.ts", "mcp"]]);
    const messages = [
      { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "skill.test", version: "0" } } },
      { jsonrpc: "2.0", method: "notifications/initialized" },
      { jsonrpc: "2.0", id: 2, method: "tools/list" },
    ];
    // the server ends when its input does
    const r = spawnSync(command === "node" ? process.execPath : command, args, { cwd: ROOT, input: messages.map((m) => JSON.stringify(m)).join("\n") + "\n", encoding: "utf8", timeout: 60_000 });
    expect([r.status, r.stderr]).toEqual([0, ""]);
    const [init, list] = r.stdout.trim().split("\n").map((l) => JSON.parse(l) as { id: number; result: { serverInfo?: { name: string }; tools?: { name: string }[] } });
    expect([init!.id, init!.result.serverInfo?.name]).toEqual([1, "m3a"]);
    expect(list!.result.tools!.map((t) => t.name)).toEqual(TOOLS.map((t) => mcpName(t.name)));
  });
});
