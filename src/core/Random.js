/**
 * Seeded, injectable random-number generator (sfc32, seeded via splitmix32).
 *
 * - Deterministic: the same seed always produces the same sequence.
 * - `int()` uses rejection sampling, so every integer in the range has exactly
 *   equal probability (no modulo bias).
 * - `fork(label)` derives an independent stream. Each entity gets its own
 *   stream so that one entity's consumption never changes another's rolls.
 */

export function hashSeed(input) {
  const str = String(input);
  let h = 2166136261 >>> 0; // FNV-1a
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export class Random {
  constructor(seed = Date.now()) {
    this.seed = seed;
    this.seedValue = typeof seed === 'number' && Number.isInteger(seed) ? seed >>> 0 : hashSeed(seed);
    let s = this.seedValue;
    const splitmix = () => {
      s = (s + 0x9e3779b9) | 0;
      let z = s;
      z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
      z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
      return (z ^ (z >>> 16)) >>> 0;
    };
    this.a = splitmix();
    this.b = splitmix();
    this.c = splitmix();
    this.d = splitmix();
    for (let i = 0; i < 15; i++) this.nextUint32();
    this.draws = 0;
  }

  nextUint32() {
    let { a, b, c, d } = this;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
    this.draws++;
    return t >>> 0;
  }

  /** Uniform float in [0, 1). */
  next() {
    return this.nextUint32() / 4294967296;
  }

  /** Uniform integer in [min, max] (inclusive), exactly unbiased. */
  int(min, max) {
    if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
      throw new RangeError(`Random.int: invalid range [${min}, ${max}]`);
    }
    const span = max - min + 1;
    if (span === 1) return min;
    const limit = Math.floor(4294967296 / span) * span;
    let u;
    do {
      u = this.nextUint32();
    } while (u >= limit);
    return min + (u % span);
  }

  range(min, max) {
    return min + this.next() * (max - min);
  }

  chance(probability) {
    if (probability <= 0) return false;
    if (probability >= 1) return true;
    return this.next() < probability;
  }

  pick(items) {
    if (!items.length) return undefined;
    return items[this.int(0, items.length - 1)];
  }

  /** Weighted choice. Returns the index, or -1 if all weights are zero. */
  weightedIndex(weights) {
    let total = 0;
    for (const w of weights) total += w > 0 ? w : 0;
    if (total <= 0) return -1;
    let r = this.next() * total;
    for (let i = 0; i < weights.length; i++) {
      const w = weights[i] > 0 ? weights[i] : 0;
      if (r < w) return i;
      r -= w;
    }
    for (let i = weights.length - 1; i >= 0; i--) if (weights[i] > 0) return i;
    return -1;
  }

  fork(label) {
    return new Random(hashSeed(`${this.seedValue}:${label}`));
  }

  getState() {
    return { a: this.a, b: this.b, c: this.c, d: this.d, draws: this.draws };
  }

  setState(state) {
    this.a = state.a;
    this.b = state.b;
    this.c = state.c;
    this.d = state.d;
    this.draws = state.draws ?? 0;
  }
}
