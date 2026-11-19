// Calendario argentino: días hábiles, feriados nacionales, corrimiento de vencimientos.
import type { ISODate } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

export function toISO(d: Date): ISODate {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
export function fromISO(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
export function ymd(y: number, m: number, d: number): ISODate {
  return toISO(new Date(Date.UTC(y, m - 1, d)));
}
export function addDays(s: ISODate, n: number): ISODate {
  const d = fromISO(s);
  d.setUTCDate(d.getUTCDate() + n);
  return toISO(d);
}
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((fromISO(a).getTime() - fromISO(b).getTime()) / 86400000);
}
export const year = (s: ISODate) => Number(s.slice(0, 4));
export const month = (s: ISODate) => Number(s.slice(5, 7));
export const day = (s: ISODate) => Number(s.slice(8, 10));
/** 'YYYY-MM' */
export const monthKey = (s: ISODate) => s.slice(0, 7);
export const weekday = (s: ISODate) => fromISO(s).getUTCDay(); // 0 = domingo

export function lastDayOfMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
/** mes siguiente a 'YYYY-MM' */
export function nextMonthKey(key: string, n = 1): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

// ---------------------------------------------------------------------------- Feriados

/** Domingo de Pascua (algoritmo de Meeus/Jones/Butcher) */
export function easter(y: number): ISODate {
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const dayN = ((h + l - 7 * m + 114) % 31) + 1;
  return ymd(y, month, dayN);
}

const cacheFeriados = new Map<number, Map<ISODate, string>>();

/**
 * Feriados nacionales (simplificado: los trasladables se toman en su fecha fija;
 * no se incluyen días no laborables con fines turísticos).
 */
export function feriados(y: number): Map<ISODate, string> {
  const hit = cacheFeriados.get(y);
  if (hit) return hit;
  const p = easter(y);
  const f = new Map<ISODate, string>([
    [ymd(y, 1, 1), 'Año Nuevo'],
    [addDays(p, -48), 'Carnaval'],
    [addDays(p, -47), 'Carnaval'],
    [ymd(y, 3, 24), 'Día Nacional de la Memoria por la Verdad y la Justicia'],
    [ymd(y, 4, 2), 'Día del Veterano y de los Caídos en Malvinas'],
    [addDays(p, -2), 'Viernes Santo'],
    [ymd(y, 5, 1), 'Día del Trabajador'],
    [ymd(y, 5, 25), 'Revolución de Mayo'],
    [ymd(y, 6, 17), 'Paso a la Inmortalidad de Güemes'],
    [ymd(y, 6, 20), 'Paso a la Inmortalidad de Belgrano'],
    [ymd(y, 7, 9), 'Día de la Independencia'],
    [ymd(y, 8, 17), 'Paso a la Inmortalidad de San Martín'],
    [ymd(y, 10, 12), 'Día del Respeto a la Diversidad Cultural'],
    [ymd(y, 11, 20), 'Día de la Soberanía Nacional'],
    [ymd(y, 12, 8), 'Inmaculada Concepción de María'],
    [ymd(y, 12, 25), 'Navidad'],
  ]);
  cacheFeriados.set(y, f);
  return f;
}

export function feriadoNombre(s: ISODate): string | undefined {
  return feriados(year(s)).get(s);
}

export function isBusinessDay(s: ISODate): boolean {
  const wd = weekday(s);
  if (wd === 0 || wd === 6) return false;
  return !feriados(year(s)).has(s);
}

/** Si la fecha no es hábil, la corre al próximo día hábil (regla de vencimientos). */
export function adjustToBusinessDay(s: ISODate): ISODate {
  let d = s;
  while (!isBusinessDay(d)) d = addDays(d, 1);
  return d;
}

export function nextBusinessDay(s: ISODate): ISODate {
  return adjustToBusinessDay(addDays(s, 1));
}

/** Suma n días hábiles (n >= 0). */
export function addBusinessDays(s: ISODate, n: number): ISODate {
  let d = s;
  let k = n;
  while (k > 0) {
    d = addDays(d, 1);
    if (isBusinessDay(d)) k--;
  }
  return d;
}

/** Días hábiles entre a (excl.) y b (incl.). Negativo si b < a. */
export function businessDaysBetween(a: ISODate, b: ISODate): number {
  if (a === b) return 0;
  const sign = b > a ? 1 : -1;
  let d = a;
  let n = 0;
  while (d !== b) {
    d = addDays(d, sign);
    if (isBusinessDay(d)) n += sign;
  }
  return n;
}

/** n-ésimo día hábil del mes (1 = primero). */
export function nthBusinessDay(y: number, m: number, n: number): ISODate {
  let d = adjustToBusinessDay(ymd(y, m, 1));
  for (let i = 1; i < n; i++) d = nextBusinessDay(d);
  return d;
}

export function firstBusinessDayOfMonth(key: string): ISODate {
  const [y, m] = key.split('-').map(Number);
  return nthBusinessDay(y, m, 1);
}

// ---------------------------------------------------------------------------- Textos

export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Lunes 4 de enero de 2027" */
export function fechaLarga(s: ISODate): string {
  return `${cap(DIAS[weekday(s)])} ${day(s)} de ${MESES[month(s) - 1]} de ${year(s)}`;
}
/** "lun 04/01" */
export function fechaCorta(s: ISODate): string {
  return `${DIAS[weekday(s)].slice(0, 3)} ${pad(day(s))}/${pad(month(s))}`;
}
/** "04/01/2027" */
export function fechaAR(s: ISODate): string {
  return `${pad(day(s))}/${pad(month(s))}/${year(s)}`;
}
/** '2027-01' → 'enero 2027' ; '2027-S1' → '1er semestre 2027' ; '2026' → 'año 2026' */
export function periodoLabel(p: string): string {
  if (/^\d{4}-\d{2}$/.test(p)) {
    const [y, m] = p.split('-').map(Number);
    return `${MESES[m - 1]} ${y}`;
  }
  if (/^\d{4}-S[12]$/.test(p)) return `${p.endsWith('1') ? '1er' : '2do'} semestre ${p.slice(0, 4)}`;
  if (/^\d{4}$/.test(p)) return `año ${p}`;
  return p;
}
/** '2027-01' → '01/2027' */
export function periodoCorto(p: string): string {
  if (/^\d{4}-\d{2}$/.test(p)) return `${p.slice(5, 7)}/${p.slice(0, 4)}`;
  return p;
}
