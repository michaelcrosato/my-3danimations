// `node tools/doctrine/freeze.ts <decision>`: records the SHA-256 of the frozen spec files in spec/frozen.json (gate G1
// froze spec 2.0-rc). Run it only in the commit that changes a frozen file, naming the logged decision that allows it.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../run/cli.ts";

/** The files the freeze covers: the motion and skeleton specs, the legend, the schemas. */
export function frozenFiles(root: string = ROOT): string[] {
  return ["spec/MOTION.md", "spec/SKELETON.md", "spec/LEGEND.md", ...readdirSync(join(root, "spec/schemas")).filter((f) => f.endsWith(".json")).sort().map((f) => `spec/schemas/${f}`)];
}

if (import.meta.main) {
  const decision = process.argv[2];
  if (!decision || !/^D\d+$/.test(decision)) {
    process.stdout.write("freeze: usage error: name the decision that allows the change, e.g. node tools/doctrine/freeze.ts D31\nnext: log the decision in docs/DECISIONS.md first\n");
    process.exit(2);
  }
  const files = Object.fromEntries(frozenFiles().map((f) => [f, createHash("sha256").update(readFileSync(join(ROOT, f))).digest("hex")]));
  const out = { about: "Spec 2.0-rc, frozen at gate G1. A frozen file changes only with a logged decision and a rerun of node tools/doctrine/freeze.ts <decision> in the same commit; npm run doctrine checks it.", version: "2.0-rc", decision, files };
  writeFileSync(join(ROOT, "spec/frozen.json"), JSON.stringify(out, null, 2) + "\n");
  process.stdout.write(`freeze: ${Object.keys(files).length} files recorded under ${decision}\nnext: commit spec/frozen.json with the change\n`);
}
