// Guardado en la nube cuando el juego corre publicado en claude.ai (capabilities `db` + `user`).
// La partida queda privada por persona en data/users/<id>/ y se puede retomar desde cualquier
// dispositivo. Fuera de claude.ai, todo esto devuelve null/false y el juego usa el guardado local.
import type { GameState } from './types';
import { validar } from './save';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Conn = { db: any; uid: string };
let connP: Promise<Conn | null> | null = null;

function claudeUse(): ((name: string) => Promise<any>) | null {
  const w = window as any;
  return typeof w.claude?.use === 'function' ? (n: string) => w.claude.use(n) : null;
}

export const enClaude = () => claudeUse() !== null;

function conectar(): Promise<Conn | null> {
  if (connP) return connP;
  const use = claudeUse();
  if (!use) return (connP = Promise.resolve(null));
  connP = (async () => {
    try {
      const [db, user] = await Promise.all([use('db'), use('user')]);
      if (!db || !user) return null;
      const uid = await user.id();
      return uid ? { db, uid } : null;
    } catch {
      return null;
    }
  })();
  return connP;
}

/** Recorta historia vieja para que la partida entre cómoda en la nube. */
function compactar(s: GameState): GameState {
  const desde = s.date.slice(0, 4) + '-' + String(Math.max(1, Number(s.date.slice(5, 7)) - 4)).padStart(2, '0');
  return {
    ...s,
    fx: [],
    ledger: s.ledger.slice(-700),
    inbox: s.inbox.slice(0, 60),
    invoices: s.invoices.filter((i) => !i.cobradaEl || i.emitida >= desde).slice(-500),
    tasks: s.tasks.filter((t) => t.estado === 'pendiente' || (t.presentadaEl ?? '') >= desde),
  };
}

export interface CloudMeta {
  partes: number;
  estudio: string;
  fecha: string;
  guardadoEl: number;
}

let enCurso = false;
let pendiente: GameState | null = null;

/** Guarda (una escritura a la vez; si hay una en curso, deja la última pendiente). */
export async function cloudGuardar(s: GameState): Promise<boolean> {
  if (enCurso) {
    pendiente = s;
    return true;
  }
  const c = await conectar();
  if (!c) return false;
  enCurso = true;
  try {
    const json = JSON.stringify(compactar(s));
    const TAM = 180_000;
    const partes = Math.max(1, Math.ceil(json.length / TAM));
    for (let i = 0; i < partes; i++) await c.db.doc(`data/users/${c.uid}/save_p${i}`).set({ v: json.slice(i * TAM, (i + 1) * TAM) });
    const meta: CloudMeta = { partes, estudio: s.estudio.nombre, fecha: s.date, guardadoEl: Date.now() };
    await c.db.doc(`data/users/${c.uid}/save_meta`).set(meta as unknown as Record<string, unknown>);
    return true;
  } catch {
    return false;
  } finally {
    enCurso = false;
    if (pendiente) {
      const p = pendiente;
      pendiente = null;
      void cloudGuardar(p);
    }
  }
}

export async function cloudMeta(): Promise<CloudMeta | null> {
  const c = await conectar();
  if (!c) return null;
  try {
    const snap = await c.db.doc(`data/users/${c.uid}/save_meta`).get();
    return snap.exists ? (snap.data() as CloudMeta) : null;
  } catch {
    return null;
  }
}

export async function cloudCargar(): Promise<GameState | null> {
  const c = await conectar();
  const meta = await cloudMeta();
  if (!c || !meta) return null;
  try {
    let json = '';
    for (let i = 0; i < meta.partes; i++) {
      const snap = await c.db.doc(`data/users/${c.uid}/save_p${i}`).get();
      if (!snap.exists) return null;
      json += String(snap.data()?.v ?? '');
    }
    return validar(JSON.parse(json));
  } catch {
    return null;
  }
}

export async function cloudBorrar(): Promise<void> {
  const c = await conectar();
  if (!c) return;
  try {
    await c.db.doc(`data/users/${c.uid}/save_meta`).delete();
  } catch {
    /* nada */
  }
}

/** Ofrece un archivo para descargar con la capability `downloads` (dentro de claude.ai). */
export async function claudeDescargar(filename: string, data: string): Promise<'ok' | 'no' | 'sin_soporte'> {
  const use = claudeUse();
  if (!use) return 'sin_soporte';
  try {
    const d = await use('downloads');
    if (!d) return 'sin_soporte';
    await d.save({ filename, data });
    return 'ok';
  } catch {
    return 'no';
  }
}
