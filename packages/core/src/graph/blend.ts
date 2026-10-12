// Blend space weights (PLAN.md WP-6.4, D73): one parameter, linear between the two points either side (held at the
// ends); two, by gradient bands (Johansen's freeform Cartesian blending, as Unity's 2D freeform), each point's weight how
// far the input is from passing any other point, normalized. Plain arithmetic, so every engine gives the same bits.

/** Each point's weight at `x` on one parameter: points in rising order; past an end, that end alone. */
export function weights1D(at: readonly number[], x: number): number[] {
  const n = at.length, w = new Array<number>(n).fill(0);
  if (n === 1 || x <= at[0]!) return (w[0] = 1), w;
  if (x >= at[n - 1]!) return (w[n - 1] = 1), w;
  let i = 0;
  while (i < n - 2 && x > at[i + 1]!) i++;
  const u = (x - at[i]!) / (at[i + 1]! - at[i]!);
  w[i] = 1 - u;
  w[i + 1] = u;
  return w;
}

/** Each point's weight at `p` on two parameters, by gradient bands; at a point, that point alone. */
export function weights2D(at: readonly (readonly [number, number])[], p: readonly [number, number]): number[] {
  const n = at.length, w = new Array<number>(n).fill(0);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    let wi = 1;
    const [xi, yi] = at[i]!, dx = p[0] - xi, dy = p[1] - yi;
    for (let j = 0; j < n && wi > 0; j++) {
      if (j === i) continue;
      const ex = at[j]![0] - xi, ey = at[j]![1] - yi, l2 = ex * ex + ey * ey;
      if (l2 > 0) wi = Math.min(wi, 1 - (dx * ex + dy * ey) / l2);
    }
    w[i] = Math.max(0, wi);
    sum += w[i]!;
  }
  if (sum > 0) return w.map((x) => x / sum);
  // not reachable for distinct points (the nearest one always keeps some weight); kept total all the same
  const d2 = (i: number) => (at[i]![0] - p[0]) * (at[i]![0] - p[0]) + (at[i]![1] - p[1]) * (at[i]![1] - p[1]);
  let best = 0;
  for (let i = 1; i < n; i++) if (d2(i) < d2(best)) best = i;
  w[best] = 1;
  return w;
}
