// Utilidades de color e interpolación para la escena.

export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (x: number) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Mezcla dos colores hex. t=0 → a, t=1 → b */
export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

/** Oscurece (amt<0) o aclara (amt>0) un color. amt en -1..1 */
export function shade(hex: string, amt: number): string {
  return amt >= 0 ? mix(hex, '#ffffff', amt) : mix(hex, '#000000', -amt);
}

const SKY: [number, string, string][] = [
  [8, '#9bd2f2', '#e3f5fc'],
  [11, '#5fb3ec', '#c6e9fb'],
  [14, '#58abe4', '#d8eef6'],
  [16, '#7fb0d6', '#f5dca8'],
  [17, '#e09a62', '#f8d18e'],
  [18, '#a5577f', '#f09868'],
  [19, '#3a3e77', '#97597c'],
  [20, '#161b40', '#34386b'],
  [24, '#0e1230', '#1d2150'],
];

/** Colores de cielo (arriba, horizonte) según la hora del día (admite fracción). */
export function skyColors(hour: number): { top: string; bottom: string; night: boolean; dusk: boolean } {
  const h = Math.max(SKY[0][0], Math.min(SKY[SKY.length - 1][0], hour));
  let i = 0;
  while (i < SKY.length - 2 && SKY[i + 1][0] <= h) i++;
  const [h0, t0, b0] = SKY[i];
  const [h1, t1, b1] = SKY[i + 1];
  const t = h1 === h0 ? 0 : (h - h0) / (h1 - h0);
  return { top: mix(t0, t1, t), bottom: mix(b0, b1, t), night: hour >= 19, dusk: hour >= 17.5 };
}

/** id seguro para usar en url(#...) */
export const safeId = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, '');

/** pseudo-aleatorio estable a partir de un string (para variaciones visuales) */
export function hashNum(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

/** ¿Llueve hoy? Determinístico por fecha (≈10% de los días). */
export function isRainy(date: string): boolean {
  return hashNum(`lluvia:${date}`) < 0.1;
}
