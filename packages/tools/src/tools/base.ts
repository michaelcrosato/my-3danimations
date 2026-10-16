// The tools WP-7.1 registered to prove the four surfaces, moved here by WP-7.2: `version`, and `validate`, a clip
// through @m3a/core's validator (an absolute path named "the file", as no reply echoes one).
import { VERSION, format, validate as validateData, validation, type Issue } from "@m3a/core";
import { defineTool, ToolError } from "../registry/registry.ts";
import { absolute, output } from "./common.ts";

/** `m3a version`: the package version and the clip format it reads and writes. */
export const version = defineTool({
  name: "version",
  description: "The m3a version and the clip format it reads and writes.",
  params: { type: "object", properties: {} },
  output: { type: "object", properties: { version: { type: "string" }, format: { type: "string" } }, required: ["version", "format"] },
  examples: [{ args: {} }],
  run: () => ({ verdict: `m3a ${VERSION}, clip format ${format.FORMAT}`, data: { version: VERSION, format: format.FORMAT }, next: "m3a help lists the tools" }),
});

/** `m3a validate`: a clip, by path or as text, through the validator; errors fail it, warnings are listed. */
export const validate = defineTool<{ path?: string; text?: string; mode: "read" | "lint" }, { ok: boolean; errors: Issue[]; warnings: Issue[] }>({
  name: "validate",
  description: "Validate a clip (format 2) by path or as text: coded errors and warnings, each with its fix.",
  params: {
    type: "object",
    properties: {
      path: { type: "string", description: "the clip file, relative to the working directory" },
      text: { type: "string", description: "the clip's JSON text, instead of a path" },
      mode: { type: "string", enum: ["read", "lint"], default: "lint", description: "lint flags unknown fields; read accepts them" },
    },
  },
  output: output({ ok: "boolean", errors: "array", warnings: "array" }),
  positionals: ["path"],
  examples: [{ args: { path: "library/sets/QUATERNIUS_3D2DGE/A_TPose.json" } }],
  async run(a, ctx) {
    if ((a.path === undefined) === (a.text === undefined)) throw new ToolError("E_ARGS", "give a path or a text, one of the two", true);
    // an absolute path is named "the file": no reply echoes one
    const text = a.text ?? (await ctx.read(a.path!)), what = a.path === undefined ? "the text" : absolute(a.path) ? "the file" : a.path;
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch (err) {
      const message = `not JSON: ${(err as Error).message}`;
      return { verdict: `validate ${what}: FAIL, ${message}`, data: { ok: false, errors: [{ code: "E_JSON", severity: "error", message }], warnings: [] }, findings: true, next: "write the clip as JSON (spec/MOTION.md), then validate again" };
    }
    const r = validateData(data, { mode: a.mode }), count = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
    return {
      verdict: `validate ${what}: ${r.ok ? "PASS" : "FAIL"}, ${count(r.errors.length, "error")}, ${count(r.warnings.length, "warning")}`,
      data: { ok: r.ok, errors: r.errors, warnings: r.warnings },
      lines: [...r.errors, ...r.warnings].flatMap((i) => validation.formatIssue(i).split("\n")),
      findings: !r.ok,
      next: r.ok ? (r.warnings.length ? "a warning is baselined per clip with its reason, or fixed as its fix line says" : "the clip is valid; play it (MANUAL.md, Wire)") : "fix each error as its fix line says, then validate again",
    };
  },
});
