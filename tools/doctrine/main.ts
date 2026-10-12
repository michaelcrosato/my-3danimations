// `npm run doctrine`: the doctrine's static checks (DOCTRINE.md, "Checks"): binaries, token budgets, import
// boundaries, banned APIs, pins and checksums, the decisions log, the local lane, the frozen spec. Verdict first; exit 1
// on findings.
import { finish, fmtMs, parseArgs, ROOT, usage, type Report, type Step } from "../run/cli.ts";
import { checkBanned, checkPin, PIN } from "./banned.ts";
import { checkBinaries } from "./binaries.ts";
import { API_MAX, checkBoundaries } from "./boundaries.ts";
import { checkBudgets } from "./budgets.ts";
import { makeCtx, type Finding } from "./context.ts";
import { checkDecisions } from "./decisions.ts";
import { checkLocal } from "./local.ts";
import { checkPins } from "./pins.ts";
import { checkFrozen } from "./frozen.ts";

/** Run every check over `root`; each step carries its findings as detail lines. */
export function runChecks(root: string = ROOT): Step[] {
  const ctx = makeCtx(root);
  const steps: Step[] = [];
  const step = (name: string, fn: () => { findings: Finding[]; lines?: string[] }) => {
    const t0 = performance.now();
    const { findings, lines = [] } = fn();
    steps.push({ name, ok: findings.length === 0, ms: performance.now() - t0, summary: findings.length ? `${findings.length} finding(s)` : lines.join("; ") || "ok", detail: findings.map((f) => f.message) });
  };
  step("binaries", () => ({ findings: checkBinaries(ctx), lines: [`${ctx.files.length} files, none binary`] }));
  step("budgets", () => checkBudgets(ctx));
  step("boundaries", () => {
    const r = checkBoundaries(ctx);
    const api = `core's public API ${r.api.core ?? 0} of ${API_MAX.core} exports, each documented`;
    return { findings: r.findings, lines: [`imports hold; ${api}${r.reachPasts.length ? `; labs reach past the API ${r.reachPasts.length}x: ${r.reachPasts.slice(0, 3).join(", ")}` : ""}`] };
  });
  step("banned", () => ({ findings: [...checkBanned(ctx), ...checkPin(ctx)], lines: [`no banned API used; ${Object.entries(PIN).map(([n, v]) => `${n} ${v}`).join(", ")} pinned`] }));
  step("pins", () => checkPins(ctx));
  step("decisions", () => checkDecisions(ctx));
  step("local", () => ({ findings: checkLocal(ctx), lines: ["library/local/ holds only its README"] }));
  step("frozen", () => checkFrozen(ctx));
  return steps;
}

if (import.meta.main) {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2), []);
  } catch (err) {
    usage("doctrine", err, []);
  }
  const t0 = performance.now();
  const steps = runChecks();
  const ms = performance.now() - t0;
  const ok = steps.every((s) => s.ok);
  const n = steps.reduce((a, s) => a + (s.detail?.length ?? 0), 0);
  const report: Report = {
    tool: "doctrine",
    ok,
    verdict: `doctrine: ${ok ? "PASS" : `FAIL, ${n} finding(s)`} in ${fmtMs(ms)} (${steps.length} checks)`,
    steps,
    warnings: [],
    ms,
    next: ok ? "npm test" : "fix each finding as its message says, then rerun npm run doctrine",
  };
  finish(report, parsed);
}
