// Skeletons for tier 3 (spec/conformance/tiers.md): the tiny rig at the proportions tier3/bodies.json records, as the
// bones a solver binds (name, parent, rest head in metres, y up), built from the same generator as tier 1b's glTF.
import type { SkeletonIn } from "@m3a/core";
import { rigGltf, type Proportions } from "../../../tools/vectors/rig.ts";

/** The rig's bones at proportions `p`: each node's head, its translations summed down from the root. */
export function rigSkeleton(p: Proportions = {}): SkeletonIn {
  const nodes = (rigGltf(p).json as { nodes: { name: string; translation: number[]; children?: number[] }[] }).nodes;
  const parent = new Map<number, number>();
  nodes.forEach((n, i) => (n.children ?? []).forEach((c) => parent.set(c, i)));
  const head = (i: number): [number, number, number] => {
    const t = nodes[i]!.translation;
    const p = parent.get(i);
    if (p === undefined) return [t[0]!, t[1]!, t[2]!];
    const h = head(p);
    return [h[0] + t[0]!, h[1] + t[1]!, h[2] + t[2]!];
  };
  return { bones: nodes.map((n, i) => ({ name: n.name, parent: parent.has(i) ? nodes[parent.get(i)!]!.name : null, head: head(i) })), up: [0, 1, 0] };
}
