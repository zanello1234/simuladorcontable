// Helpers compartidos del motor (mutan el estado: se usan dentro de immer `produce`).
import { NIVELES, OFICINAS } from './config';
import type { Rng } from './rng';
import type { Client, FxEvent, FxKind, GameState, LedgerCategoria, Message, Task, Worker } from './types';

export function nid(s: GameState, prefix: string): string {
  s.idSeq += 1;
  return `${prefix}${s.idSeq}`;
}

export function fx(s: GameState, kind: FxKind, extra: Partial<Omit<FxEvent, 'id' | 'tick' | 'kind'>> = {}): void {
  s.fxSeq += 1;
  s.fx.push({ id: s.fxSeq, tick: s.tick, kind, ...extra });
  if (s.fx.length > 40) s.fx.splice(0, s.fx.length - 40);
}

export function msg(s: GameState, m: Omit<Message, 'id' | 'date' | 'hour' | 'leido'> & { leido?: boolean }): Message {
  const full: Message = { id: nid(s, 'm'), date: s.date, hour: Math.min(s.hour, 18), leido: false, ...m };
  s.inbox.unshift(full);
  if (s.inbox.length > 160) s.inbox.length = 160;
  return full;
}

export function mov(s: GameState, monto: number, categoria: LedgerCategoria, concepto: string): void {
  const m = Math.round(monto);
  if (m === 0) return;
  s.estudio.caja += m;
  s.ledger.push({ id: nid(s, 'l'), date: s.date, concepto, monto: m, categoria });
  if (s.ledger.length > 2500) s.ledger.splice(0, s.ledger.length - 2500);
  if (s.estudio.caja > s.stats.mejorCaja) s.stats.mejorCaja = s.estudio.caja;
}

export const cliente = (s: GameState, id?: string): Client | undefined => (id ? s.clients.find((c) => c.id === id) : undefined);
export const worker = (s: GameState, id?: string): Worker | undefined => (id ? s.workers.find((w) => w.id === id) : undefined);
export const tarea = (s: GameState, id?: string): Task | undefined => (id ? s.tasks.find((t) => t.id === id) : undefined);
export const player = (s: GameState): Worker => s.workers.find((w) => w.id === 'player')!;

export function quitarDeColas(s: GameState, taskId: string): void {
  for (const w of s.workers) {
    const i = w.queue.indexOf(taskId);
    if (i >= 0) w.queue.splice(i, 1);
  }
}

/** Precio indexado por inflación, redondeado a $1.000 */
export const precio = (s: GameState, base: number) => Math.round((base * s.inflacion.indice) / 1000) * 1000;

export const clientesActivos = (s: GameState) => s.clients.filter((c) => c.activo && !c.propio);
export const estudioPropio = (s: GameState) => s.clients.find((c) => c.propio);
export const escritorios = (s: GameState) => OFICINAS[s.estudio.oficina].escritorios;

export function nivelCalculado(s: GameState): number {
  const n = clientesActivos(s).length;
  let nivel = 1;
  for (const l of NIVELES) if (n >= l.clientes && s.estudio.reputacion >= l.reputacion) nivel = l.nivel;
  return nivel;
}

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function ajustarSatisfaccion(c: Client, delta: number): void {
  c.satisfaccion = clamp(Math.round((c.satisfaccion + delta) * 10) / 10, 0, 100);
}
export function ajustarReputacion(s: GameState, delta: number): void {
  s.estudio.reputacion = clamp(Math.round((s.estudio.reputacion + delta) * 10) / 10, 0, 100);
}

/** Usar el RNG persistido en el estado */
export function withRng<T>(s: GameState, makeRng: (seed: number) => Rng, fn: (rng: Rng) => T): T {
  const rng = makeRng(s.rngState);
  const out = fn(rng);
  s.rngState = rng.state();
  return out;
}
