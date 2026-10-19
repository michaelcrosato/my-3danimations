// A deliberately broken implementation, for the kit's own test (WP-10.2): the TypeScript reference's sidecar with one
// defect, named by its argument. `round` rounds fit's mean error to float32 (one number rounded differently); `swap`
// swaps the two wrists in every decoded pose (two points swapped). The kit must fail it and name the vector.
import { format } from "@m3a/core";
import { serve } from "../kit/wire.ts";
import { handle } from "./ts.ts";

const defect = process.argv[2];
if (defect !== "round" && defect !== "swap") throw new Error(`broken.ts takes its defect, round or swap, not ${defect}`);
const L = format.IDX.wristL! * 3, R = format.IDX.wristR! * 3;

void serve((req) => {
  const r = handle(req);
  if (defect === "round" && req.op === "fit") return { ...(r as object), mean: Math.fround((r as { mean: number }).mean) };
  if (defect === "swap" && req.op === "decode") for (const p of r as Float32Array[]) for (let i = 0; i < 3; i++) [p[L + i], p[R + i]] = [p[R + i]!, p[L + i]!];
  return r;
});
