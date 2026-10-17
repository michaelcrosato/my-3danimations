// The manual runs (PLAN.md WP-7.3, DOCTRINE.md "the manual's examples run and fit its budget"): every fenced block of
// packages/tools/MANUAL.md is run or checked, and a block that must not run says so in its info string (`norun`),
// counted here and kept to NORUN. Its json blocks parse; one named as a file (```json knight.json) is written into a
// scratch working directory, and each is checked as what it is: a recipe, graph, action or simulation script against
// its schema in spec/schemas/ and core's (or sim's) own check, game.json through the tools' reader (its tiers),
// .mcp.json as serving `m3a mcp`; the import catalog is checked by the import its sh block runs. Its ts blocks run, in
// order, as one Node program in that directory (their imports merged at the top, each block in a scope of its own but
// the complete example's, whose names the later blocks use: `library`, `clips`, `bound`, `player`, ...), the example's
// outcome checked (one hit, its damage, the states it went through, the distance walked). Its sh blocks' lines are m3a
// calls, run in that directory through the m3a command in process, each to exit 0. The directory holds what the manual
// says a game has: character.glb (a generated test character), mocap.gltf (tier 1b's rig and its three animations).
// And the manual's tool list is the registry's (tools/manual/toollist.ts), its clip ids are the library's and the tools
// it names are tools (its token budget is `npm run doctrine`'s).
import { spawn } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import { afterAll, describe, expect, it } from "vitest";
import { actions, graph, recipe } from "@m3a/core";
import { openLibrary } from "@m3a/library/node";
import { character, variant } from "@m3a/three/test-characters";
import { withToolList } from "../../../tools/manual/toollist.ts";
import { runCli } from "../src/cli.ts";
import { nodeHost } from "../src/node.ts";
import { gameTiers } from "../src/node/library.ts";
import { fileStore } from "../src/node/store.ts";
import { Registry } from "../src/registry/registry.ts";
import { validateScript } from "../src/sim/script.ts";
import { TOOLS } from "../src/tools/index.ts";
import { ROOT, words } from "./helpers/surfaces.ts";

const TEXT = readFileSync(join(ROOT, "packages/tools/MANUAL.md"), "utf8");
/** Blocks marked `norun`: none today; one more needs a reason here. */
const NORUN = 0;
/** The section whose ts blocks run at the top level, their names visible to every later block. */
const EXAMPLE = /^## A complete example/;

/** A fenced block: its language, the rest of its info string (a file name, `norun`), its code, line and section. */
interface Block {
  lang: string;
  info: string[];
  code: string;
  line: number;
  section: string;
}

/** The manual's fenced blocks, in order. */
function blocksOf(md: string): Block[] {
  const out: Block[] = [], lines = md.split("\n");
  let section = "", open: Block | null = null;
  lines.forEach((l, i) => {
    if (open) {
      if (!l.startsWith("```")) open.code += `${l}\n`;
      else {
        out.push(open);
        open = null;
      }
    } else if (l.startsWith("## ")) section = l;
    else if (l.startsWith("```")) {
      const [lang = "", ...info] = l.slice(3).trim().split(/\s+/);
      open = { lang, info, code: "", line: i + 1, section };
    }
  });
  if (open) throw new Error(`MANUAL.md:${(open as Block).line}: a block left open`);
  return out;
}

const BLOCKS = blocksOf(TEXT), RUN = BLOCKS.filter((b) => !b.info.includes("norun"));
const where = (b: Block) => `MANUAL.md:${b.line} (${b.lang} ${b.info.join(" ")})`;
const file = (b: Block) => b.info.find((x) => x !== "norun");

/** The scratch working directory: the named json blocks, a character, a motion file, and the repository's packages. */
const CWD = mkdtempSync(join(tmpdir(), "m3a-manual-"));
afterAll(() => rmSync(CWD, { recursive: true, force: true }));
symlinkSync(join(ROOT, "node_modules"), join(CWD, "node_modules"), "dir");
writeFileSync(join(CWD, "character.glb"), character(variant(1)).glb);
cpSync(join(ROOT, "spec/vectors/tier1b/rig.gltf"), join(CWD, "mocap.gltf"));
for (const b of RUN) if (b.lang === "json" && file(b)) writeFileSync(join(CWD, file(b)!), b.code);

/** A shell line without its comment (a `#` after a space, outside quotes). */
function uncommented(line: string): string {
  let q: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (q) q = ch === q ? null : q;
    else if (ch === "'" || ch === '"') q = ch;
    else if (ch === "#" && (i === 0 || /\s/.test(line[i - 1]!))) return line.slice(0, i).trimEnd();
  }
  return line.trimEnd();
}

/** The ts blocks as one program: imports merged at the top (single-line named imports only), the example's blocks at
 *  the top level and every other block in a scope of its own, and after the example a line printing its outcome. */
function program(blocks: readonly Block[]): string {
  const imports = new Map<string, Set<string>>(), body: string[] = [];
  let example = false;
  for (const b of blocks) {
    const code = b.code.replace(/^import \{([^}]*)\} from "([^"]+)";\n/gm, (_, names: string, from: string) => {
      const set = imports.get(from) ?? new Set<string>();
      for (const n of names.split(",").map((s) => s.trim()).filter(Boolean)) set.add(n);
      imports.set(from, set);
      return "";
    });
    expect(code, `${where(b)}: an import the test can't merge (one line, named imports)`).not.toMatch(/^\s*import\b/m);
    if (example && !EXAMPLE.test(b.section)) {
      body.push(`console.log("M3A-EXAMPLE " + JSON.stringify({ damage, hits: run.trace.hits.length, states: run.trace.states.map((s) => s.layer + ":" + s.state), walked: bound.root.position.length() }));`);
      example = false;
    }
    if (EXAMPLE.test(b.section)) example = true;
    body.push(`// ${where(b)}`, EXAMPLE.test(b.section) ? code : `{\n${code}}`);
  }
  return [...[...imports].map(([from, names]) => `import { ${[...names].join(", ")} } from "${from}";`), ...body].join("\n");
}

/** Runs a Node program in the scratch directory; resolves to its exit code and output. */
function node(path: string): Promise<{ code: number | null; out: string }> {
  return new Promise((ok) => {
    const p = spawn(process.execPath, ["--no-warnings", path], { cwd: CWD });
    let out = "";
    p.stdout.on("data", (d: Buffer) => (out += d));
    p.stderr.on("data", (d: Buffer) => (out += d));
    p.on("close", (code) => ok({ code, out }));
  });
}

describe("packages/tools/MANUAL.md", () => {
  it("lists the registry's tools as tools/manual/main.ts writes them", () => {
    expect(withToolList(TEXT, TOOLS), "the tool list differs from the registry: node tools/manual/main.ts rewrites it").toBe(TEXT);
    for (const t of TOOLS) expect(TEXT, t.name).toContain(`\`m3a ${t.name}`);
  });

  it("runs or checks every block; a block that can't run is marked, and counted", () => {
    expect(BLOCKS.length - RUN.length, "norun blocks").toBe(NORUN);
    for (const b of BLOCKS) expect(["ts", "json", "sh"], where(b)).toContain(b.lang);
    expect(RUN.filter((b) => b.lang === "ts").length).toBeGreaterThanOrEqual(6);
  });

  it("names only clips the library has and tools the registry has", () => {
    const lib = openLibrary({ tiers: ["cc0", "cc-by", "cmu"] }), sets = new Set(lib.sets().map((s) => s.set)), ids = new Set(lib.catalog().map((r) => r.id));
    const named = [...TEXT.matchAll(/\b([A-Z][A-Z0-9_]+)\/([A-Za-z0-9_]+)\b/g)].filter((m) => sets.has(m[1]!)).map((m) => m[0]);
    expect(named.length).toBeGreaterThanOrEqual(8);
    expect(named.filter((id) => !ids.has(id))).toEqual([]);
    const tools = new Set([...TOOLS.map((t) => t.name), "help", "mcp"]);
    // each call in backticks (`m3a show ...`); the sh lines run below
    const calls = [...TEXT.matchAll(/`(?:npx )?m3a ([a-z][a-z.-]*[a-z])/g)].map((m) => m[1]!);
    expect(calls.length).toBeGreaterThanOrEqual(30);
    expect(calls.filter((n) => !tools.has(n))).toEqual([]);
  });

  it("parses every json block and checks each as what it is", () => {
    const ajv = new Ajv2020({ strict: false, allErrors: true }), schema = (n: string) => JSON.parse(readFileSync(join(ROOT, `spec/schemas/${n}.schema.json`), "utf8")) as { $id: string };
    const r = schema("recipe");
    ajv.addSchema(r); // an action's schema refers to the recipe's
    const checks = { recipe: ajv.getSchema(r.$id)!, graph: ajv.compile(schema("graph")), action: ajv.compile(schema("action")), sim: ajv.compile(schema("sim")) };
    const kinds: string[] = [];
    for (const b of RUN.filter((x) => x.lang === "json")) {
      const name = file(b), data = JSON.parse(b.code) as Record<string, unknown>;
      const kind = name === "game.json" ? "game" : name === ".mcp.json" ? "mcp" : Object.keys(data).some((k) => k.startsWith("$")) ? "catalog" : "beats" in data ? "action" : "states" in data ? "graph" : "input" in data ? "sim" : "steps" in data ? "recipe" : "unknown";
      kinds.push(kind);
      if (kind === "recipe" || kind === "graph" || kind === "action" || kind === "sim") expect(checks[kind](data) || checks[kind].errors, where(b)).toBe(true);
      if (kind === "recipe") expect(recipe.validateRecipe(data as never), where(b)).toEqual([]);
      if (kind === "action") expect(actions.validateAction(data as never), where(b)).toEqual([]);
      if (kind === "graph") expect(graph.validateGraph(data as never), where(b)).toEqual([]);
      if (kind === "game") expect(gameTiers(CWD)).toEqual((data as { tiers: string[] }).tiers);
      if (kind === "mcp") expect((data as { mcpServers: { m3a: { args: string[] } } }).mcpServers.m3a.args.slice(-2)).toEqual(["m3a", "mcp"]);
      // a catalog is checked by the import that reads it (an sh block), so it must be named there
      if (kind === "catalog") expect(TEXT, where(b)).toContain(`--catalog ${name}`);
    }
    expect(kinds, "a json block the test can't check").not.toContain("unknown");
    // each script names the graph it was written for, which a json block holds
    for (const b of RUN.filter((x) => x.lang === "json" && "input" in JSON.parse(x.code))) {
      const script = JSON.parse(b.code) as { graph: string }, g = RUN.map((x) => (x.lang === "json" ? (JSON.parse(x.code) as { id?: string }) : {})).find((x) => x.id === script.graph);
      expect(g, where(b)).toBeDefined();
      expect(validateScript(script as never, g as never), where(b)).toEqual([]);
    }
  });

  it("runs the ts blocks as one program and the sh blocks' m3a calls, each exiting 0", async () => {
    const ts = RUN.filter((b) => b.lang === "ts");
    writeFileSync(join(CWD, "manual.ts"), program(ts));
    const ran = node(join(CWD, "manual.ts"));
    // meanwhile, the m3a calls in order, as the m3a command makes them (its retries kept in .m3a/requests/)
    const registry = new Registry(TOOLS, fileStore(CWD)), host = nodeHost(CWD), calls: string[] = [];
    for (const b of RUN.filter((x) => x.lang === "sh")) {
      for (const line of b.code.split("\n").map(uncommented).filter(Boolean)) {
        const argv = words(line);
        if (argv[0] === "npx") argv.shift();
        expect(argv[0], `MANUAL.md:${b.line}: ${line}`).toBe("m3a");
        let out = "";
        const code = await runCli(registry, argv.slice(1), { print: (t) => (out += t), write: (p, t) => void host.write!(p, t), host });
        expect(code, `MANUAL.md:${b.line}: ${line}\n${out}`).toBe(0);
        calls.push(argv[1]!);
      }
    }
    expect(calls.length).toBeGreaterThanOrEqual(8);
    const { code, out } = await ran;
    expect(code, out).toBe(0);
    const ex = JSON.parse(/^M3A-EXAMPLE (.*)$/m.exec(out)?.[1] ?? "null") as { damage: number; hits: number; states: string[]; walked: number } | null;
    expect(ex, out).not.toBeNull();
    // the knight's one slash dealt its damage once, the simulation saw its one hit window, it flinched and walked
    expect([ex!.damage, ex!.hits]).toEqual([25, 1]);
    expect(ex!.states).toEqual(["base:move", "react:none", "base:slash", "react:flinch", "react:none", "base:move"]);
    expect(ex!.walked).toBeGreaterThan(0.5);
  }, 60_000);
});
