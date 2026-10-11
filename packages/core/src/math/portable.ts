// Portable math (DOCTRINE.md principle 5; PLAN.md §5.5, "Exact mode"): the transcendental functions built from
// `+ - * /` and `sqrt` only, which every JavaScript engine computes exactly, so a hashed path gives the same bits in V8
// (Node, Chromium) and JavaScriptCore (Safari, Bun). The algorithms are fdlibm 5.3's, the ones V8's own are taken from:
// `sin`, `cos`, `tan`, `atan`, `atan2`, `asin`, `acos`, `exp`, `log`, `log10` and `cbrt` are fdlibm's, `log2` FreeBSD's
// (as V8's), and `hypot` is V8's own (scaled by the largest argument, Kahan-summed). Each gives native V8's bits; the
// test (packages/core/test/math.test.ts) proves it on 200,000 inputs each, special values and the whole double range.
// The one exception is `pow`: V8 takes it from the platform's C library (glibc's, correctly rounded nearly always), so
// native `pow` differs between platforms; this one is fdlibm's, within one unit in the last place of glibc's.
// Ported from my-3d2dge's PORTABLE_MATH (engine/my-3d2dge.js:4677-4905, its docs/DECISIONS.md D15), which carried
// sin, cos, atan, atan2, exp and log; tan, asin, acos, log2, log10, pow, cbrt, hypot and the large-angle reduction are
// new here, from fdlibm, FreeBSD and V8.

/** The functions a hashed path calls: `Math`'s transcendental ones (and `sqrt`, exact everywhere). */
export interface MathLike {
  sin(x: number): number;
  cos(x: number): number;
  tan(x: number): number;
  atan(x: number): number;
  atan2(y: number, x: number): number;
  asin(x: number): number;
  acos(x: number): number;
  exp(x: number): number;
  log(x: number): number;
  log2(x: number): number;
  log10(x: number): number;
  pow(x: number, y: number): number;
  hypot(...values: number[]): number;
  cbrt(x: number): number;
  sqrt(x: number): number;
}

const sqrt = Math.sqrt;
const F = new Float64Array(1);
const U = new Uint32Array(F.buffer);
/** Which 32-bit word of a float64 holds the sign and exponent: 1 on little-endian hosts. */
const H = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1 ? 1 : 0;
const L = 1 - H;
const hi = (x: number): number => {
  F[0] = x;
  return U[H]! | 0;
};
const lo = (x: number): number => {
  F[0] = x;
  return U[L]!;
};
const make = (h: number, l: number): number => {
  U[H] = h >>> 0;
  U[L] = l >>> 0;
  return F[0]!;
};
const withHi = (x: number, h: number): number => {
  F[0] = x;
  U[H] = h >>> 0;
  return F[0]!;
};
/** x with its low word cleared: the leading 21 bits of the significand. */
const clearLo = (x: number): number => {
  F[0] = x;
  U[L] = 0;
  return F[0]!;
};

// sin, cos and tan: reduce to [-π/4, π/4] (Cody-Waite in up to three steps, Payne–Hanek past 2^19·π/2), then the kernels.
const S1 = -1.66666666666666324348e-1, S2 = 8.33333333332248946124e-3, S3 = -1.98412698298579493134e-4, S4 = 2.75573137070700676789e-6, S5 = -2.50507602534068634195e-8, S6 = 1.58969099521155010221e-10;
const C1 = 4.16666666666666019037e-2, C2 = -1.38888888888741095749e-3, C3 = 2.48015872894767294178e-5, C4 = -2.75573143513906633035e-7, C5 = 2.0875723212981748279e-9, C6 = -1.13596475577881948265e-11;
function kSin(x: number, y: number, iy: number): number {
  if ((hi(x) & 0x7fffffff) < 0x3e400000 && (x | 0) === 0) return x;
  const z = x * x, v = z * x, r = S2 + z * (S3 + z * (S4 + z * (S5 + z * S6)));
  return iy === 0 ? x + v * (S1 + z * r) : x - ((z * (0.5 * y - v * r) - y) - v * S1);
}
function kCos(x: number, y: number): number {
  const ix = hi(x) & 0x7fffffff;
  if (ix < 0x3e400000 && (x | 0) === 0) return 1;
  const z = x * x, r = z * (C1 + z * (C2 + z * (C3 + z * (C4 + z * (C5 + z * C6)))));
  if (ix < 0x3fd33333) return 1 - (0.5 * z - (z * r - x * y));
  const qx = ix > 0x3fe90000 ? 0.28125 : make(ix - 0x00200000, 0), hz = 0.5 * z - qx, a = 1 - qx;
  return a - (hz - (z * r - x * y));
}
const T = [3.33333333333334091986e-1, 1.33333333333201242699e-1, 5.39682539762260521377e-2, 2.18694882948595424599e-2, 8.86323982359930005737e-3, 3.59207910759131235356e-3, 1.45620945432529025516e-3,
  5.88041240820264096874e-4, 2.46463134818469906812e-4, 7.817944429395570923e-5, 7.14072491382608190305e-5, -1.85586374855275456654e-5, 2.59073051863633712884e-5];
const PIO4 = 7.85398163397448278999e-1, PIO4LO = 3.06161699786838301793e-17;
/** tan on [-π/4, π/4] (iy 1), or −1/tan (iy −1); fdlibm's k_tan.c with its fix for −1/tan near 0. */
function kTan(x0: number, y0: number, iy: number): number {
  let x = x0, y = y0, z, r, v, w, s;
  const hx = hi(x), ix = hx & 0x7fffffff;
  if (ix < 0x3e300000 && (x | 0) === 0) {
    if (((ix | lo(x)) | (iy + 1)) === 0) return 1 / Math.abs(x);
    if (iy === 1) return x;
    w = x + y;
    z = clearLo(w);
    v = y - (z - x);
    const a = -1 / w, t = clearLo(a);
    s = 1 + t * z;
    return t + a * (s + t * v);
  }
  if (ix >= 0x3fe59428) {
    if (hx < 0) {
      x = -x;
      y = -y;
    }
    z = PIO4 - x;
    w = PIO4LO - y;
    x = z + w;
    y = 0;
  }
  z = x * x;
  w = z * z;
  r = T[1]! + w * (T[3]! + w * (T[5]! + w * (T[7]! + w * (T[9]! + w * T[11]!))));
  v = z * (T[2]! + w * (T[4]! + w * (T[6]! + w * (T[8]! + w * (T[10]! + w * T[12]!)))));
  s = z * x;
  r = y + z * (s * (r + v) + y);
  r += T[0]! * s;
  w = x + r;
  if (ix >= 0x3fe59428) {
    v = iy;
    return (1 - ((hx >> 30) & 2)) * (v - 2 * (x - ((w * w) / (w + v) - r)));
  }
  if (iy === 1) return w;
  z = clearLo(w);
  v = r - (z - x);
  const a = -1 / w, t = clearLo(a);
  s = 1 + t * z;
  return t + a * (s + t * v);
}
const INVPIO2 = 6.36619772367581382433e-1, PIO2_1 = 1.57079632673412561417, PIO2_1T = 6.07710050650619224932e-11, PIO2_2 = 6.0771005063039659766e-11,
  PIO2_2T = 2.02226624879595063154e-21, PIO2_3 = 2.0222662487111664558e-21, PIO2_3T = 8.47842766036889956997e-32;
const NPIO2 = [0x3ff921fb, 0x400921fb, 0x4012d97c, 0x401921fb, 0x401f6a7a, 0x4022d97c, 0x4025fdbb, 0x402921fb, 0x402c463a, 0x402f6a7a, 0x4031475c, 0x4032d97c, 0x40346b9c, 0x4035fdbb, 0x40378fdb, 0x403921fb,
  0x403ab41b, 0x403c463a, 0x403dd85a, 0x403f6a7a, 0x40407e4c, 0x4041475c, 0x4042106c, 0x4042d97c, 0x4043a28c, 0x40446b9c, 0x404534ac, 0x4045fdbb, 0x4046c6cb, 0x40478fdb, 0x404858eb, 0x404921fb];
/** The reduced angle, x = n·π/2 + Y[0] + Y[1], from remPio2. */
const Y = [0, 0];
/** 2/π to 1,584 bits, in hex (checked against a big-integer π in the test). */
export const TWO_OVER_PI_HEX =
  "A2F9836E4E441529FC2757D1F534DDC0DB6295993C439041FE5163ABDEBBC561B7246E3A424DD2E006492EEA09D1921CFE1DEB1CB129A73EE88235F52EBB4484E99C7026B45F7E413991D639835339F49C845F8BBDF9283B1FF897FFDE05980FEF2F118B5A0A6D1F6D367ECF27CB09B74F463F669E5FEA2D7527BAC7EBE5F17B3D0739F78A5292EA6BFB5FB11F8D5D0856033046FC7B6BABF0CFBC209AF4361DA9E391615EE61B086599855F14A068408DFFD8804D73273106061556CA73A8C960E27BC08C6B";
const IPIO2 = Array.from({ length: 66 }, (_, i) => parseInt(TWO_OVER_PI_HEX.slice(i * 6, i * 6 + 6), 16));
/** π/2 in 24-bit pieces. */
const PIO2 = [1.570796251296997, 7.549789415861596e-8, 5.390302529957765e-15, 3.282003415807913e-22, 1.270655753080676e-29, 1.2293330898111133e-36, 2.7337005381646456e-44, 2.1674168387780482e-51];
const TWO24 = 16777216, TWON24 = 5.960464477539063e-8;
/** z·2^n, exactly (n within the normal range). */
const pow2 = (n: number): number => make((n + 1023) << 20, 0);
/**
 * fdlibm's k_rem_pio2.c (Payne–Hanek) at prec 2, as V8's: x (three 24-bit chunks of |angle|·2^−e0) times 2/π to as
 * many bits as the angle needs; writes the reduced angle into Y and returns n mod 8.
 */
function kernelRemPio2(x: number[], e0: number, nx: number): number {
  const jk = 4, jp = 4, jx = nx - 1, iq: number[] = [], f: number[] = [], q: number[] = [], fq: number[] = [];
  const jv = Math.max(0, Math.trunc((e0 - 3) / 24));
  let q0 = e0 - 24 * (jv + 1), jz = jk, z, fw, n, ih, i, j, k;
  for (i = 0, j = jv - jx; i <= jx + jk; i++, j++) f[i] = j < 0 ? 0 : IPIO2[j]!;
  for (i = 0; i <= jk; i++) {
    for (j = 0, fw = 0; j <= jx; j++) fw += x[j]! * f[jx + i - j]!;
    q[i] = fw;
  }
  for (;;) {
    // distill q[] into iq[] reversingly
    for (i = 0, j = jz, z = q[jz]!; j > 0; i++, j--) {
      fw = Math.trunc(TWON24 * z);
      iq[i] = Math.trunc(z - TWO24 * fw);
      z = q[j - 1]! + fw;
    }
    z *= pow2(q0);
    z -= 8 * Math.floor(z * 0.125);
    n = Math.trunc(z);
    z -= n;
    ih = 0;
    if (q0 > 0) {
      i = iq[jz - 1]! >> (24 - q0);
      n += i;
      iq[jz - 1]! -= i << (24 - q0);
      ih = iq[jz - 1]! >> (23 - q0);
    } else if (q0 === 0) ih = iq[jz - 1]! >> 23;
    else if (z >= 0.5) ih = 2;
    if (ih > 0) {
      // q > 0.5: take 1 − q
      n += 1;
      let carry = 0;
      for (i = 0; i < jz; i++) {
        j = iq[i]!;
        if (carry === 0) {
          if (j !== 0) {
            carry = 1;
            iq[i] = 0x1000000 - j;
          }
        } else iq[i] = 0xffffff - j;
      }
      if (q0 === 1) iq[jz - 1]! &= 0x7fffff;
      else if (q0 === 2) iq[jz - 1]! &= 0x3fffff;
      if (ih === 2) {
        z = 1 - z;
        if (carry !== 0) z -= pow2(q0);
      }
    }
    if (z !== 0) break;
    for (j = 0, i = jz - 1; i >= jk; i--) j |= iq[i]!;
    if (j !== 0) break;
    // every bit so far cancelled: take more of 2/π and distill again
    for (k = 1; iq[jk - k] === 0; k++);
    for (i = jz + 1; i <= jz + k; i++) {
      f[jx + i] = IPIO2[jv + i]!;
      for (j = 0, fw = 0; j <= jx; j++) fw += x[j]! * f[jx + i - j]!;
      q[i] = fw;
    }
    jz += k;
  }
  if (z === 0) {
    jz -= 1;
    q0 -= 24;
    while (iq[jz] === 0) {
      jz--;
      q0 -= 24;
    }
  } else {
    z *= pow2(-q0);
    if (z >= TWO24) {
      fw = Math.trunc(TWON24 * z);
      iq[jz] = Math.trunc(z - TWO24 * fw);
      jz += 1;
      q0 += 24;
      iq[jz] = fw;
    } else iq[jz] = Math.trunc(z);
  }
  fw = pow2(q0);
  for (i = jz; i >= 0; i--) {
    q[i] = fw * iq[i]!;
    fw *= TWON24;
  }
  for (i = jz; i >= 0; i--) {
    for (fw = 0, k = 0; k <= jp && k <= jz - i; k++) fw += PIO2[k]! * q[i + k]!;
    fq[jz - i] = fw;
  }
  for (fw = 0, i = jz; i >= 0; i--) fw += fq[i]!;
  Y[0] = ih === 0 ? fw : -fw;
  for (fw = fq[0]! - fw, i = 1; i <= jz; i++) fw += fq[i]!;
  Y[1] = ih === 0 ? fw : -fw;
  return n & 7;
}
/** Reduces x by π/2 into Y and returns n (fdlibm's e_rem_pio2.c, as V8's). */
function remPio2(x: number): number {
  const hx = hi(x), ix = hx & 0x7fffffff;
  if (ix <= 0x3fe921fb) {
    Y[0] = x;
    Y[1] = 0;
    return 0;
  }
  if (ix > 0x413921fb) {
    // |x| > 2^19·π/2: split |x| into three 24-bit chunks scaled by 2^−e0 and reduce by 2/π to as many bits as it takes
    const e0 = (ix >> 20) - 1046;
    let z = make(ix - (e0 << 20), lo(x));
    const tx = [0, 0, 0];
    for (let i = 0; i < 2; i++) {
      tx[i] = Math.trunc(z);
      z = (z - tx[i]!) * TWO24;
    }
    tx[2] = z;
    let nx = 3;
    while (tx[nx - 1] === 0) nx--;
    const n = kernelRemPio2(tx, e0, nx);
    if (hx < 0) {
      Y[0] = -Y[0]!;
      Y[1] = -Y[1]!;
      return -n;
    }
    return n;
  }
  if (ix < 0x4002d97c) {
    // |x| < 3π/4: n is ±1
    if (hx > 0) {
      let z = x - PIO2_1;
      if (ix !== 0x3ff921fb) {
        Y[0] = z - PIO2_1T;
        Y[1] = z - Y[0] - PIO2_1T;
      } else {
        z -= PIO2_2;
        Y[0] = z - PIO2_2T;
        Y[1] = z - Y[0] - PIO2_2T;
      }
      return 1;
    }
    let z = x + PIO2_1;
    if (ix !== 0x3ff921fb) {
      Y[0] = z + PIO2_1T;
      Y[1] = z - Y[0] + PIO2_1T;
    } else {
      z += PIO2_2;
      Y[0] = z + PIO2_2T;
      Y[1] = z - Y[0] + PIO2_2T;
    }
    return -1;
  }
  const t0 = hx < 0 ? -x : x, n = (t0 * INVPIO2 + 0.5) | 0;
  let r = t0 - n * PIO2_1, w = n * PIO2_1T;
  if (n < 32 && ix !== NPIO2[n - 1]) Y[0] = r - w;
  else {
    const j = ix >> 20;
    Y[0] = r - w;
    let i = j - ((hi(Y[0]) >> 20) & 0x7ff);
    if (i > 16) {
      let t = r;
      w = n * PIO2_2;
      r = t - w;
      w = n * PIO2_2T - (t - r - w);
      Y[0] = r - w;
      i = j - ((hi(Y[0]) >> 20) & 0x7ff);
      if (i > 49) {
        t = r;
        w = n * PIO2_3;
        r = t - w;
        w = n * PIO2_3T - (t - r - w);
        Y[0] = r - w;
      }
    }
  }
  Y[1] = r - Y[0]! - w;
  if (hx < 0) {
    Y[0] = -Y[0]!;
    Y[1] = -Y[1]!;
    return -n;
  }
  return n;
}
function sin(x: number): number {
  const ix = hi(x) & 0x7fffffff;
  if (ix <= 0x3fe921fb) return kSin(x, 0, 0);
  if (ix >= 0x7ff00000) return x - x;
  const n = remPio2(x) & 3, y0 = Y[0]!, y1 = Y[1]!;
  return n === 0 ? kSin(y0, y1, 1) : n === 1 ? kCos(y0, y1) : n === 2 ? -kSin(y0, y1, 1) : -kCos(y0, y1);
}
function cos(x: number): number {
  const ix = hi(x) & 0x7fffffff;
  if (ix <= 0x3fe921fb) return kCos(x, 0);
  if (ix >= 0x7ff00000) return x - x;
  const n = remPio2(x) & 3, y0 = Y[0]!, y1 = Y[1]!;
  return n === 0 ? kCos(y0, y1) : n === 1 ? -kSin(y0, y1, 1) : n === 2 ? -kCos(y0, y1) : kSin(y0, y1, 1);
}
function tan(x: number): number {
  const ix = hi(x) & 0x7fffffff;
  if (ix <= 0x3fe921fb) return kTan(x, 0, 1);
  if (ix >= 0x7ff00000) return x - x;
  const n = remPio2(x);
  return kTan(Y[0]!, Y[1]!, 1 - ((n & 1) << 1));
}

// atan, atan2, asin and acos
const ATANHI = [4.63647609000806093515e-1, 7.85398163397448278999e-1, 9.82793723247329054082e-1, 1.5707963267948966];
const ATANLO = [2.26987774529616870924e-17, 3.06161699786838301793e-17, 1.39033110312309984516e-17, 6.12323399573676603587e-17];
const AT = [3.33333333333329318027e-1, -1.99999999998764832476e-1, 1.42857142725034663711e-1, -1.1111110405462355788e-1, 9.09088713343650656196e-2, -7.69187620504482999495e-2,
  6.66107313738753120669e-2, -5.83357013379057348645e-2, 4.97687799461593236017e-2, -3.6531572744216915527e-2, 1.62858201153657823623e-2];
function atan(x0: number): number {
  let x = x0, id;
  const hx = hi(x), ix = hx & 0x7fffffff;
  if (ix >= 0x44100000) {
    if (x !== x) return x + x;
    return hx > 0 ? ATANHI[3]! + ATANLO[3]! : -ATANHI[3]! - ATANLO[3]!;
  }
  if (ix < 0x3fdc0000) {
    if (ix < 0x3e200000) return x;
    id = -1;
  } else {
    x = Math.abs(x);
    if (ix < 0x3ff30000) {
      if (ix < 0x3fe60000) {
        id = 0;
        x = (2 * x - 1) / (2 + x);
      } else {
        id = 1;
        x = (x - 1) / (x + 1);
      }
    } else if (ix < 0x40038000) {
      id = 2;
      x = (x - 1.5) / (1 + 1.5 * x);
    } else {
      id = 3;
      x = -1 / x;
    }
  }
  const z = x * x, w = z * z;
  const s1 = z * (AT[0]! + w * (AT[2]! + w * (AT[4]! + w * (AT[6]! + w * (AT[8]! + w * AT[10]!)))));
  const s2 = w * (AT[1]! + w * (AT[3]! + w * (AT[5]! + w * (AT[7]! + w * AT[9]!))));
  if (id < 0) return x - x * (s1 + s2);
  const r = ATANHI[id]! - (x * (s1 + s2) - ATANLO[id]! - x);
  return hx < 0 ? -r : r;
}
const PI = 3.141592653589793, PI_LO = 1.2246467991473532e-16, PI_2 = 1.5707963267948966, PI_4 = 0.7853981633974483;
const negative = (v: number): boolean => v < 0 || (v === 0 && 1 / v < 0);
function atan2(y: number, x: number): number {
  if (x !== x || y !== y) return x + y;
  if (x === 1) return atan(y);
  let m = (negative(y) ? 1 : 0) | (negative(x) ? 2 : 0);
  if (y === 0) return m === 0 || m === 1 ? y : m === 2 ? PI : -PI;
  if (x === 0) return negative(y) ? -PI_2 : PI_2;
  if (x === Infinity || x === -Infinity) {
    if (y === Infinity || y === -Infinity) return m === 0 ? PI_4 : m === 1 ? -PI_4 : m === 2 ? 3 * PI_4 : -3 * PI_4;
    return m === 0 ? 0 : m === 1 ? -0 : m === 2 ? PI : -PI;
  }
  if (y === Infinity || y === -Infinity) return negative(y) ? -PI_2 : PI_2;
  const k = ((hi(y) & 0x7fffffff) - (hi(x) & 0x7fffffff)) >> 20;
  let z;
  if (k > 60) {
    // |y/x| > 2^60: ±π/2 whatever x's sign (FreeBSD's e_atan2.c, as V8's; fdlibm 5.3 went on to π − π/2)
    z = PI_2 + 0.5 * PI_LO;
    m &= 1;
  } else z = x < 0 && k < -60 ? 0 : atan(Math.abs(y / x));
  return m === 0 ? z : m === 1 ? -z : m === 2 ? PI - (z - PI_LO) : z - PI_LO - PI;
}
const PIO2_HI = 1.5707963267948966, PIO2_LO = 6.12323399573676603587e-17, PIO4_HI = 7.85398163397448278999e-1;
const PS0 = 1.66666666666666657415e-1, PS1 = -3.25565818622400915405e-1, PS2 = 2.01212532134862925881e-1, PS3 = -4.00555345006794114027e-2, PS4 = 7.91534994289814532176e-4, PS5 = 3.4793310759602116757e-5;
const QS1 = -2.40339491173441421878, QS2 = 2.02094576023350569471, QS3 = -6.8828397160545329303e-1, QS4 = 7.70381505559019352791e-2;
/** fdlibm's rational approximation of (asin(√t)/√t − 1)/t, as p/q. */
const pOf = (t: number): number => t * (PS0 + t * (PS1 + t * (PS2 + t * (PS3 + t * (PS4 + t * PS5)))));
const qOf = (t: number): number => 1 + t * (QS1 + t * (QS2 + t * (QS3 + t * QS4)));
function asin(x: number): number {
  const hx = hi(x), ix = hx & 0x7fffffff;
  if (ix >= 0x3ff00000) {
    if (((ix - 0x3ff00000) | lo(x)) === 0) return x * PIO2_HI + x * PIO2_LO;
    return (x - x) / (x - x);
  }
  if (ix < 0x3fe00000) {
    if (ix < 0x3e400000) return x;
    const t = x * x;
    return x + x * (pOf(t) / qOf(t));
  }
  const w = 1 - Math.abs(x), t = w * 0.5, p = pOf(t), q = qOf(t), s = sqrt(t);
  let r;
  if (ix >= 0x3fef3333) r = PIO2_HI - (2 * (s + s * (p / q)) - PIO2_LO);
  else {
    const f = clearLo(s), c = (t - f * f) / (s + f);
    r = PIO4_HI - (2 * s * (p / q) - (PIO2_LO - 2 * c) - (PIO4_HI - 2 * f));
  }
  return hx > 0 ? r : -r;
}
function acos(x: number): number {
  const hx = hi(x), ix = hx & 0x7fffffff;
  if (ix >= 0x3ff00000) {
    if (((ix - 0x3ff00000) | lo(x)) === 0) return hx > 0 ? 0 : PI + 2 * PIO2_LO;
    return (x - x) / (x - x);
  }
  if (ix < 0x3fe00000) {
    if (ix <= 0x3c600000) return PIO2_HI + PIO2_LO;
    const z = x * x;
    return PIO2_HI - (x - (PIO2_LO - x * (pOf(z) / qOf(z))));
  }
  if (hx < 0) {
    const z = (1 + x) * 0.5, s = sqrt(z);
    return PI - 2 * (s + ((pOf(z) / qOf(z)) * s - PIO2_LO));
  }
  const z = (1 - x) * 0.5, s = sqrt(z), df = clearLo(s), c = (z - df * df) / (s + df);
  return 2 * (df + ((pOf(z) / qOf(z)) * s + c));
}

// exp and the logs
const LN2HI = [6.9314718036912381649e-1, -6.9314718036912381649e-1], LN2LO = [1.90821492927058770002e-10, -1.90821492927058770002e-10], INVLN2 = 1.442695040888963387;
const P1 = 1.66666666666666019037e-1, P2 = -2.77777777770155933842e-3, P3 = 6.61375632143793436117e-5, P4 = -1.6533902205465251539e-6, P5 = 4.13813679705723846039e-8, TWOM1000 = 9.3326361850321887899e-302;
function exp(x0: number): number {
  let x = x0, k = 0, hiP = 0, loP = 0;
  const h = hi(x), xsb = (h >>> 31) & 1, hx = h & 0x7fffffff;
  if (hx >= 0x40862e42) {
    if (hx >= 0x7ff00000) return x !== x ? x + x : xsb === 0 ? x : 0;
    if (x > 7.09782712893383973096e2) return Infinity;
    if (x < -7.4513321910194110842e2) return 0;
  }
  if (hx > 0x3fd62e42) {
    if (hx < 0x3ff0a2b2) {
      if (x === 1) return 2.718281828459045; // V8 special-cases e: the reduction below gets its last bit wrong
      hiP = x - LN2HI[xsb]!;
      loP = LN2LO[xsb]!;
      k = 1 - xsb - xsb;
    } else {
      k = (INVLN2 * x + (xsb ? -0.5 : 0.5)) | 0;
      hiP = x - k * LN2HI[0]!;
      loP = k * LN2LO[0]!;
    }
    x = hiP - loP;
  } else if (hx < 0x3e300000) return 1 + x;
  const t = x * x, c = x - t * (P1 + t * (P2 + t * (P3 + t * (P4 + t * P5))));
  if (k === 0) return 1 - ((x * c) / (c - 2) - x);
  const y = 1 - (loP - (x * c) / (2 - c) - hiP);
  return k >= -1021 ? withHi(y, hi(y) + (k << 20)) : withHi(y, hi(y) + ((k + 1000) << 20)) * TWOM1000;
}
const LN2_HI = 6.9314718036912381649e-1, LN2_LO = 1.90821492927058770002e-10, TWO54 = 1.8014398509481984e16;
const LG1 = 6.66666666666673513e-1, LG2 = 3.999999999940941908e-1, LG3 = 2.857142874366239149e-1, LG4 = 2.222219843214978396e-1, LG5 = 1.818357216161805012e-1, LG6 = 1.531383769920937332e-1, LG7 = 1.479819860511658591e-1;
function log(x0: number): number {
  let x = x0, hx = hi(x), k = 0;
  const lx = lo(x);
  if (hx < 0x00100000) {
    if (((hx & 0x7fffffff) | lx) === 0) return -Infinity;
    if (hx < 0) return NaN;
    k -= 54;
    x *= TWO54;
    hx = hi(x);
  }
  if (hx >= 0x7ff00000) return x + x;
  k += (hx >> 20) - 1023;
  hx &= 0x000fffff;
  const i0 = (hx + 0x95f64) & 0x100000;
  x = withHi(x, hx | (i0 ^ 0x3ff00000));
  k += i0 >> 20;
  const f = x - 1;
  if ((0x000fffff & (2 + hx)) < 3) {
    if (f === 0) return k === 0 ? 0 : k * LN2_HI + k * LN2_LO;
    const R = f * f * (0.5 - 0.3333333333333333 * f);
    return k === 0 ? f - R : k * LN2_HI - (R - k * LN2_LO - f);
  }
  const s = f / (2 + f), dk = k, z = s * s, w = z * z;
  let i = hx - 0x6147a;
  const j = 0x6b851 - hx;
  const t1 = w * (LG2 + w * (LG4 + w * LG6)), t2 = z * (LG1 + w * (LG3 + w * (LG5 + w * LG7))), R = t2 + t1;
  i |= j;
  if (i > 0) {
    const hfsq = 0.5 * f * f;
    return k === 0 ? f - (hfsq - s * (hfsq + R)) : dk * LN2_HI - (hfsq - (s * (hfsq + R) + dk * LN2_LO) - f);
  }
  return k === 0 ? f - s * (f - R) : dk * LN2_HI - (s * (f - R) - dk * LN2_LO - f);
}
const IVLN10 = 4.34294481903251816668e-1, LOG10_2HI = 3.01029995663611771306e-1, LOG10_2LO = 3.69423907715893078616e-13;
/** fdlibm's e_log10.c: n·log10(2) in two parts plus log(m)/ln 10, so exact powers of 10 come out exact. */
function log10(x0: number): number {
  let x = x0, hx = hi(x), k = 0;
  const lx = lo(x);
  if (hx < 0x00100000) {
    if (((hx & 0x7fffffff) | lx) === 0) return -Infinity;
    if (hx < 0) return NaN;
    k -= 54;
    x *= TWO54;
    hx = hi(x);
  }
  if (hx >= 0x7ff00000) return x + x;
  if (hx === 0x3ff00000 && lo(x) === 0) return 0;
  k += (hx >> 20) - 1023;
  const i = (k >>> 31) & 1;
  hx = (hx & 0x000fffff) | ((0x3ff - i) << 20);
  const y = k + i;
  x = withHi(x, hx);
  const z = y * LOG10_2LO + IVLN10 * log(x);
  return z + y * LOG10_2HI;
}
const IVLN2HI = 1.44269504072144627571, IVLN2LO = 1.67517131648865118353e-10;
/** FreeBSD's e_log2.c, as V8's: exact on powers of 2. */
function log2(x0: number): number {
  let x = x0, hx = hi(x), k = 0;
  const lx = lo(x);
  if (hx < 0x00100000) {
    if (((hx & 0x7fffffff) | lx) === 0) return -Infinity;
    if (hx < 0) return NaN;
    k -= 54;
    x *= TWO54;
    hx = hi(x);
  }
  if (hx >= 0x7ff00000) return x + x;
  if (hx === 0x3ff00000 && lx === 0) return 0;
  k += (hx >> 20) - 1023;
  hx &= 0x000fffff;
  const i = (hx + 0x95f64) & 0x100000;
  x = withHi(x, hx | (i ^ 0x3ff00000));
  k += i >> 20;
  const y = k, f = x - 1, hfsq = 0.5 * f * f;
  const s = f / (2 + f), z = s * s, w = z * z;
  const r = s * (hfsq + (z * (LG1 + w * (LG3 + w * (LG5 + w * LG7))) + w * (LG2 + w * (LG4 + w * LG6))));
  const h = clearLo(f - hfsq), l = f - h - hfsq + r;
  let valHi = h * IVLN2HI, valLo = (l + h) * IVLN2LO + l * IVLN2HI;
  const sum = y + valHi;
  valLo += y - sum + valHi;
  valHi = sum;
  return valLo + valHi;
}

// pow, hypot and cbrt
const BP = [1, 1.5], DP_H = [0, 5.84962487220764160156e-1], DP_L = [0, 1.35003920212974897128e-8];
const L1 = 5.99999999999994648725e-1, L2 = 4.28571428578550184252e-1, L3 = 3.33333329818377432918e-1, L4 = 2.72728123808534006489e-1, L5 = 2.30660745775561754067e-1, L6 = 2.06975017800338417784e-1;
const LN2 = 0.6931471805599453, LN2_H = 6.93147182464599609375e-1, LN2_L = -1.90465429995776804525e-9, OVT = 8.008566259537294e-17;
const CP = 9.61796693925975554329e-1, CP_H = 9.61796700954437255859e-1, CP_L = -7.02846165095275826516e-9;
const IVLN2 = 1.442695040888963387, IVLN2_H = 1.44269502162933349609, IVLN2_L = 1.92596299112661746887e-8;
const HUGE = 1e300, TINY = 1e-300, TWO53 = 9007199254740992;
/** z·2^n with one rounding, for a result that may be subnormal (fdlibm's scalbn on that path). */
const scalbn = (z: number, n: number): number => (n >= -1022 ? z * make((n + 1023) << 20, 0) : z * make((n + 54 + 1023) << 20, 0) * 5.551115123125783e-17);
/** fdlibm's e_pow.c: log2(x) to extra precision, times y split in two, then 2^z, as V8's Math.pow. */
function pow(x: number, y: number): number {
  const hx = hi(x), lx = lo(x), hy = hi(y), ly = lo(y);
  let ix = hx & 0x7fffffff;
  const iy = hy & 0x7fffffff;
  if ((iy | ly) === 0) return 1;
  if (ix > 0x7ff00000 || (ix === 0x7ff00000 && lx !== 0) || iy > 0x7ff00000 || (iy === 0x7ff00000 && ly !== 0)) return x + y;
  // whether y is an integer when x < 0: 0 not, 1 odd, 2 even
  let yisint = 0, j, k;
  if (hx < 0) {
    if (iy >= 0x43400000) yisint = 2;
    else if (iy >= 0x3ff00000) {
      k = (iy >> 20) - 0x3ff;
      if (k > 20) {
        j = ly >>> (52 - k);
        if ((j << (52 - k)) >>> 0 === ly) yisint = 2 - (j & 1);
      } else if (ly === 0) {
        j = iy >> (20 - k);
        if (j << (20 - k) === iy) yisint = 2 - (j & 1);
      }
    }
  }
  if (ly === 0) {
    if (iy === 0x7ff00000) {
      // ECMAScript (unlike C) makes (±1)^±Infinity NaN, as fdlibm 5.3 does
      if (((ix - 0x3ff00000) | lx) === 0) return y - y;
      if (ix >= 0x3ff00000) return hy >= 0 ? y : 0;
      return hy < 0 ? -y : 0;
    }
    if (iy === 0x3ff00000) return hy < 0 ? 1 / x : x;
    if (hy === 0x40000000) return x * x;
    if (hy === 0x3fe00000 && hx >= 0) return sqrt(x);
  }
  let ax = Math.abs(x);
  if (lx === 0 && (ix === 0x7ff00000 || ix === 0 || ix === 0x3ff00000)) {
    let z = ax;
    if (hy < 0) z = 1 / z;
    if (hx < 0) {
      if (((ix - 0x3ff00000) | yisint) === 0) z = (z - z) / (z - z);
      else if (yisint === 1) z = -z;
    }
    return z;
  }
  let n = (hx >> 31) + 1;
  if ((n | yisint) === 0) return (x - x) / (x - x);
  const s = (n | (yisint - 1)) === 0 ? -1 : 1;
  let t1, t2;
  if (iy > 0x41e00000) {
    // |y| > 2^31
    if (iy > 0x43f00000) {
      if (ix <= 0x3fefffff) return hy < 0 ? HUGE * HUGE : TINY * TINY;
      if (ix >= 0x3ff00000) return hy > 0 ? HUGE * HUGE : TINY * TINY;
    }
    if (ix < 0x3fefffff) return hy < 0 ? s * HUGE * HUGE : s * TINY * TINY;
    if (ix > 0x3ff00000) return hy > 0 ? s * HUGE * HUGE : s * TINY * TINY;
    const t = ax - 1, w = t * t * (0.5 - t * (0.3333333333333333 - t * 0.25)), u = IVLN2_H * t, v = t * IVLN2_L - w * IVLN2;
    t1 = clearLo(u + v);
    t2 = v - (t1 - u);
  } else {
    n = 0;
    if (ix < 0x00100000) {
      ax *= TWO53;
      n -= 53;
      ix = hi(ax);
    }
    n += (ix >> 20) - 0x3ff;
    j = ix & 0x000fffff;
    ix = j | 0x3ff00000;
    if (j <= 0x3988e) k = 0;
    else if (j < 0xbb67a) k = 1;
    else {
      k = 0;
      n += 1;
      ix -= 0x00100000;
    }
    ax = withHi(ax, ix);
    // ss = s_h + s_l = (x − 1)/(x + 1) or (x − 1.5)/(x + 1.5)
    const bp = BP[k]!;
    let u = ax - bp, v = 1 / (ax + bp);
    const ss = u * v, sH = clearLo(ss);
    let tH = make(((ix >> 1) | 0x20000000) + 0x00080000 + (k << 18), 0);
    let tL = ax - (tH - bp);
    const sL = v * (u - sH * tH - sH * tL);
    let s2 = ss * ss, r = s2 * s2 * (L1 + s2 * (L2 + s2 * (L3 + s2 * (L4 + s2 * (L5 + s2 * L6)))));
    r += sL * (sH + ss);
    s2 = sH * sH;
    tH = clearLo(3 + s2 + r);
    tL = r - (tH - 3 - s2);
    u = sH * tH;
    v = sL * tH + tL * ss;
    const pH = clearLo(u + v), pL = v - (pH - u);
    const zH = CP_H * pH, zL = CP_L * pH + pL * CP + DP_L[k]!;
    const t = n;
    t1 = clearLo(zH + zL + DP_H[k]! + t);
    t2 = zL - (t1 - t - DP_H[k]! - zH);
  }
  // (y1 + y2)·(t1 + t2)
  const y1 = clearLo(y);
  const pL = (y - y1) * t1 + y * t2;
  let pH = y1 * t1;
  let z = pL + pH;
  j = hi(z);
  let i = lo(z) | 0;
  if (j >= 0x40900000) {
    if (((j - 0x40900000) | i) !== 0) return s * HUGE * HUGE;
    if (pL + OVT > z - pH) return s * HUGE * HUGE;
  } else if ((j & 0x7fffffff) >= 0x4090cc00) {
    if (((j - 0xc090cc00) | i) !== 0) return s * TINY * TINY;
    if (pL <= z - pH) return s * TINY * TINY;
  }
  // 2^(pH + pL)
  i = j & 0x7fffffff;
  k = (i >> 20) - 0x3ff;
  n = 0;
  if (i > 0x3fe00000) {
    n = j + (0x00100000 >> (k + 1));
    k = ((n & 0x7fffffff) >> 20) - 0x3ff;
    const t = make(n & ~(0x000fffff >> k), 0);
    n = ((n & 0x000fffff) | 0x00100000) >> (20 - k);
    if (j < 0) n = -n;
    pH -= t;
  }
  const t = clearLo(pL + pH), u = t * LN2_H, v = (pL - (t - pH)) * LN2 + t * LN2_L;
  z = u + v;
  const w = v - (z - u), tt = z * z, q = z - tt * (P1 + tt * (P2 + tt * (P3 + tt * (P4 + tt * P5))));
  const r = (z * q) / (q - 2) - (w + z * w);
  z = 1 - (r - z);
  j = hi(z) + (n << 20);
  z = j >> 20 <= 0 ? scalbn(z, n) : withHi(z, j);
  return s * z;
}
/** V8's Math.hypot: each value divided by the largest, the squares Kahan-summed, the root scaled back. */
function hypot(...values: number[]): number {
  let max = 0, nan = false;
  for (let i = 0; i < values.length; i++) {
    const v = +values[i]!;
    if (v !== v) nan = true;
    else if (Math.abs(v) > max) max = Math.abs(v);
  }
  if (max === Infinity) return Infinity;
  if (nan) return NaN;
  if (max === 0) return 0;
  let sum = 0, compensation = 0;
  for (let i = 0; i < values.length; i++) {
    const m = Math.abs(+values[i]!) / max, summand = m * m - compensation, preliminary = sum + summand;
    compensation = preliminary - sum - summand;
    sum = preliminary;
  }
  return sqrt(sum) * max;
}
const B1 = 715094163, B2 = 696219795;
const CP0 = 1.87595182427177009643, CP1 = -1.88497979543377169875, CP2 = 1.62142972010535446614, CP3 = -7.58397934778766047437e-1, CP4 = 1.45996192886612446982e-1;
/** FreeBSD's s_cbrt.c, as V8's: a 5-bit estimate, a polynomial to 23 bits, rounded, then one Newton step. */
function cbrt(x: number): number {
  let hx = hi(x);
  const low = lo(x), sign = hx & 0x80000000;
  hx = (hx ^ sign) >>> 0;
  if (hx >= 0x7ff00000) return x + x;
  let t;
  if (hx < 0x00100000) {
    if ((hx | low) === 0) return x;
    t = make(0x43500000, 0) * x;
    t = make((sign | (((hi(t) & 0x7fffffff) / 3) | 0) + B2) >>> 0, 0);
  } else t = make((sign | (((hx / 3) | 0) + B1)) >>> 0, 0);
  let r = t * t * (t / x);
  t = t * (CP0 + r * (CP1 + r * CP2) + r * r * r * (CP3 + r * CP4));
  // round t away from zero to 23 bits: add 2^31 to the 64-bit pattern and keep its top 34 bits
  const tl = lo(t) + 0x80000000, th = hi(t) + (tl >= 4294967296 ? 1 : 0);
  t = make(th, (tl >>> 0) & 0xc0000000);
  const s = t * t;
  r = x / s;
  const w = t + t;
  r = (r - t) / (w + r);
  return t + t * r;
}

/** The portable functions: the same bits in every JavaScript engine. */
export const PORTABLE: MathLike = Object.freeze({ sin, cos, tan, atan, atan2, asin, acos, exp, log, log2, log10, pow, hypot, cbrt, sqrt });

/** The host's own `Math`: fastest, but its last bit may differ between engines. Never in a hashed path. */
export const NATIVE: MathLike = Object.freeze({
  sin: Math.sin, cos: Math.cos, tan: Math.tan, atan: Math.atan, atan2: Math.atan2, asin: Math.asin, acos: Math.acos, exp: Math.exp,
  log: Math.log, log2: Math.log2, log10: Math.log10, pow: Math.pow, hypot: Math.hypot, cbrt: Math.cbrt, sqrt,
});

/** The math for a mode: portable in exact mode (every hashed path), native otherwise (presentation only). */
export const mathFor = (exact: boolean): MathLike => (exact ? PORTABLE : NATIVE);
