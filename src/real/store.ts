// Store de datos reales: guarda cada fila como documento en la base del artefacto
// (data/team/<entidad>/<id>, config en data/team/config/general). Fuera de claude.ai usa localStorage.
import { create } from 'zustand';
import { useGame } from '../store/game';
import { toGameState } from './adapter';
import { CONFIG_DEFAULT, DATA_VACIA, ENTIDADES, hoyISO, type Entidad, type RConfig, type RealData } from './model';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Fila = Record<string, unknown> & { id: string };

const LS_KEY = 'tablero-be-onlyone:data';
const PATH = (ent: Entidad) => `data/team/${ent}`;

function claudeUse(): ((n: string) => Promise<any>) | null {
  const w = window as any;
  return typeof w.claude?.use === 'function' ? (n: string) => w.claude.use(n) : null;
}
function storage(): Storage | null {
  if (import.meta.env.MODE === 'real-single') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

interface Store {
  data: RealData;
  cargando: boolean;
  modo: 'nube' | 'local' | 'ninguno';
  canEdit: boolean;
  error?: string;
  init: () => Promise<void>;
  guardarFila: (ent: Entidad, fila: Fila) => Promise<boolean>;
  guardarFilas: (ent: Entidad, filas: Fila[]) => Promise<number>;
  borrarFila: (ent: Entidad, id: string) => Promise<boolean>;
  guardarConfig: (c: Partial<RConfig>) => Promise<boolean>;
  reemplazarObjetivos: (objetivos: RealData['objetivos']) => Promise<void>;
}

let dbRef: any = null;

function sincronizarJuego(data: RealData) {
  const g = toGameState(data, hoyISO());
  const prev = useGame.getState().game;
  useGame.setState({ game: prev ? { ...g, speed: 0 } : g });
}

export const useReal = create<Store>((set, get) => ({
  data: structuredClone(DATA_VACIA),
  cargando: true,
  modo: 'ninguno',
  canEdit: true,

  init: async () => {
    const use = claudeUse();
    if (use) {
      try {
        const [db, user] = await Promise.all([use('db'), use('user')]);
        if (db) {
          dbRef = db;
          let canEdit = true;
          try {
            canEdit = user ? (await user.canEdit()) !== false : true;
          } catch {
            canEdit = true;
          }
          const data: RealData = structuredClone(DATA_VACIA);
          for (const ent of ENTIDADES) {
            try {
              const snap = await db.collection(PATH(ent)).get();
              (data as any)[ent] = snap.docs.map((d: any) => ({ ...(d.data() as Record<string, unknown>), id: d.id }));
            } catch {
              /* colección vacía */
            }
          }
          try {
            const cfg = await db.doc('data/team/config/general').get();
            if (cfg.exists) data.config = { ...CONFIG_DEFAULT, ...(cfg.data() as RConfig) };
          } catch {
            /* sin config */
          }
          set({ data, cargando: false, modo: 'nube', canEdit });
          sincronizarJuego(data);
          // escuchar cambios de otros dispositivos / editores
          for (const ent of ENTIDADES) {
            try {
              db.collection(PATH(ent)).onSnapshot((snap: any) => {
                const filas = snap.docs.map((d: any) => ({ ...(d.data() as Record<string, unknown>), id: d.id }));
                const next = { ...get().data, [ent]: filas } as RealData;
                set({ data: next });
                sincronizarJuego(next);
              });
            } catch {
              /* sin suscripción */
            }
          }
          return;
        }
      } catch {
        /* cae al local */
      }
    }
    const st = storage();
    if (st) {
      try {
        const raw = st.getItem(LS_KEY);
        const data = raw ? ({ ...structuredClone(DATA_VACIA), ...JSON.parse(raw) } as RealData) : structuredClone(DATA_VACIA);
        data.config = { ...CONFIG_DEFAULT, ...data.config };
        set({ data, cargando: false, modo: 'local', canEdit: true });
        sincronizarJuego(data);
        return;
      } catch {
        /* nada */
      }
    }
    set({ cargando: false, modo: 'ninguno', canEdit: true });
    sincronizarJuego(get().data);
  },

  guardarFila: async (ent, fila) => {
    const data = get().data;
    const lista = (data[ent] as unknown as Fila[]).filter((f) => f.id !== fila.id);
    const next = { ...data, [ent]: [...lista, fila] } as RealData;
    if (!(await persistir(ent, fila, 'set'))) return false;
    set({ data: next });
    guardarLocal(next);
    sincronizarJuego(next);
    return true;
  },
  guardarFilas: async (ent, filas) => {
    let ok = 0;
    const data = get().data;
    const ids = new Set(filas.map((f) => f.id));
    const lista = (data[ent] as unknown as Fila[]).filter((f) => !ids.has(f.id));
    for (const f of filas) if (await persistir(ent, f, 'set')) ok++;
    const next = { ...data, [ent]: [...lista, ...filas] } as RealData;
    set({ data: next });
    guardarLocal(next);
    sincronizarJuego(next);
    return ok;
  },
  borrarFila: async (ent, id) => {
    if (!(await persistir(ent, { id }, 'delete'))) return false;
    const data = get().data;
    const next = { ...data, [ent]: (data[ent] as unknown as Fila[]).filter((f) => f.id !== id) } as RealData;
    set({ data: next });
    guardarLocal(next);
    sincronizarJuego(next);
    return true;
  },
  guardarConfig: async (c) => {
    const config = { ...get().data.config, ...c };
    if (dbRef) {
      try {
        await dbRef.doc('data/team/config/general').set(config);
      } catch {
        set({ error: 'No se guardó: necesitás ser editor del tablero.' });
        return false;
      }
    }
    const next = { ...get().data, config };
    set({ data: next, error: undefined });
    guardarLocal(next);
    sincronizarJuego(next);
    return true;
  },
  reemplazarObjetivos: async (objetivos) => {
    const prev = get().data.objetivos;
    const prevIds = new Set(prev.map((o) => o.id));
    const nextIds = new Set(objetivos.map((o) => o.id));
    for (const o of objetivos) if (!prevIds.has(o.id) || JSON.stringify(prev.find((p) => p.id === o.id)) !== JSON.stringify(o)) await persistir('objetivos', o as unknown as Fila, 'set');
    for (const o of prev) if (!nextIds.has(o.id)) await persistir('objetivos', { id: o.id }, 'delete');
    const next = { ...get().data, objetivos };
    set({ data: next });
    guardarLocal(next);
  },
}));

async function persistir(ent: Entidad, fila: Fila, op: 'set' | 'delete'): Promise<boolean> {
  if (!dbRef) return true;
  try {
    const ref = dbRef.doc(`${PATH(ent)}/${fila.id}`);
    if (op === 'delete') await ref.delete();
    else {
      const { id, ...rest } = fila;
      void id;
      await ref.set(rest);
    }
    useReal.setState({ error: undefined });
    return true;
  } catch {
    useReal.setState({ error: 'No se guardó: necesitás ser editor del tablero.' });
    return false;
  }
}

function guardarLocal(data: RealData) {
  if (dbRef) return;
  try {
    storage()?.setItem(LS_KEY, JSON.stringify(data));
  } catch {
    /* nada */
  }
}

/** El Tablero del juego edita objetivos sobre el GameState: los traemos de vuelta al modelo real. */
export function instalarSincroniaObjetivos(): () => void {
  return useGame.subscribe((s, prev) => {
    const g = s.game;
    if (!g || g === prev.game) return;
    const reales = useReal.getState().data.objetivos;
    if (JSON.stringify(g.objetivos) !== JSON.stringify(reales)) void useReal.getState().reemplazarObjetivos(g.objetivos);
  });
}
