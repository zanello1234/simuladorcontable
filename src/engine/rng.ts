// RNG determinístico (mulberry32). El estado vive en GameState.rngState para que las partidas
// guardadas se reproduzcan igual.

export interface Rng {
  /** 0 <= x < 1 */
  next(): number;
  /** entero en [min, max] inclusive */
  int(min: number, max: number): number;
  /** float en [min, max) */
  range(min: number, max: number): number;
  chance(p: number): boolean;
  pick<T>(arr: readonly T[]): T;
  /** elección ponderada */
  weighted<T>(items: readonly { item: T; w: number }[]): T;
  shuffle<T>(arr: T[]): T[];
  /** estado interno actual (para persistir) */
  state(): number;
}

export function makeRng(seed: number): Rng {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng: Rng = {
    next,
    int: (min, max) => Math.floor(next() * (max - min + 1)) + min,
    range: (min, max) => next() * (max - min) + min,
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    weighted: (items) => {
      const total = items.reduce((a, b) => a + Math.max(0, b.w), 0);
      let r = next() * total;
      for (const it of items) {
        r -= Math.max(0, it.w);
        if (r <= 0) return it.item;
      }
      return items[items.length - 1].item;
    },
    shuffle: (arr) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
    state: () => s,
  };
  return rng;
}

/** Hash simple de string a seed (para minijuegos: seed = hash(task.id)). */
export function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
