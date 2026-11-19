// Formatos es-AR

const fmtARS = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const fmtARS2 = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtNum = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
const fmtNum2 = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** $ 1.234.567 */
export const money = (n: number) => fmtARS.format(Math.round(n));
/** $ 1.234.567,89 */
export const money2 = (n: number) => fmtARS2.format(n);
/** 1.234.567 */
export const num = (n: number) => fmtNum.format(n);
/** 1.234,56 */
export const num2 = (n: number) => fmtNum2.format(n);
/** $ 1,2 M / $ 850 k (compacto para HUD) */
export function moneyShort(n: number): string {
  const a = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (a >= 1e9) return `${sign}$ ${(a / 1e9).toLocaleString('es-AR', { maximumFractionDigits: 2 })} MM`;
  if (a >= 1e6) return `${sign}$ ${(a / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 1 })} M`;
  if (a >= 1e3) return `${sign}$ ${(a / 1e3).toLocaleString('es-AR', { maximumFractionDigits: 0 })} k`;
  return `${sign}$ ${Math.round(a)}`;
}
export const pct = (x: number, d = 0) => `${(x * 100).toLocaleString('es-AR', { maximumFractionDigits: d })}%`;

/** Redondea a centavos */
export const r2 = (n: number) => Math.round(n * 100) / 100;

/** Parsea un número escrito en formato argentino ("1.234,56" o "1234.56" o "1234,56"). NaN si no es válido. */
export function parseNumAR(s: string): number {
  const t = s.replace(/\s|\$/g, '');
  if (!t) return NaN;
  let norm: string;
  if (t.includes(',')) norm = t.replace(/\./g, '').replace(',', '.');
  else if ((t.match(/\./g) || []).length > 1) norm = t.replace(/\./g, '');
  else norm = t;
  const n = Number(norm);
  return Number.isFinite(n) ? n : NaN;
}
