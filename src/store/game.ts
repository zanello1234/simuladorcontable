// Store global (zustand). El estado del juego es inmutable: cada acción pasa por immer.
import { produce } from 'immer';
import { create } from 'zustand';
import type { Resultado } from '../engine/actions';
import { newGame } from '../engine/newGame';
import * as cloud from '../engine/cloud';
import * as save from '../engine/save';
import { tick as tickEngine } from '../engine/simulation';
import type { GameState, NewGameConfig } from '../engine/types';

export type Tab = 'escritorio' | 'tareas' | 'clientes' | 'equipo' | 'herramientas' | 'finanzas' | 'bandeja';
export type Tone = 'ok' | 'warn' | 'bad' | 'info';

export interface Toast {
  id: number;
  texto: string;
  tone: Tone;
}

interface Store {
  game: GameState | null;
  tab: Tab;
  toasts: Toast[];
  minigameTaskId?: string;
  relampago: boolean;
  workerModalId?: string;
  clientModalId?: string;
  showIntro: boolean;
  lastSpeed: 1 | 2 | 3;
  // ciclo de vida
  start: (cfg: NewGameConfig) => void;
  continuar: () => boolean;
  continuarNube: () => Promise<boolean>;
  guardar: (opts?: { nube?: boolean }) => void;
  load: (g: GameState) => void;
  salir: () => void;
  // juego
  tick: () => void;
  setSpeed: (n: 0 | 1 | 2 | 3) => void;
  togglePause: () => void;
  act: (fn: (d: GameState) => Resultado | void, opts?: { silent?: boolean }) => Resultado | void;
  // ui
  setTab: (t: Tab) => void;
  toast: (texto: string, tone?: Tone) => void;
  dismissToast: (id: number) => void;
  openMinigame: (taskId?: string) => void;
  openRelampago: (v: boolean) => void;
  openWorker: (id?: string) => void;
  openClient: (id?: string) => void;
  setIntro: (v: boolean) => void;
}

let toastSeq = 0;

export const useGame = create<Store>((set, get) => ({
  game: null,
  tab: 'escritorio',
  toasts: [],
  showIntro: false,
  lastSpeed: 1,
  relampago: false,

  start: (cfg) => {
    const g = newGame(cfg);
    save.guardar(g);
    void cloud.cloudGuardar(g);
    set({ game: g, tab: 'escritorio', showIntro: true, toasts: [] });
  },
  continuarNube: async () => {
    const g = await cloud.cloudCargar();
    if (!g) return false;
    set({ game: g, tab: 'escritorio', showIntro: false });
    return true;
  },
  guardar: (opts) => {
    const g = get().game;
    if (!g) return;
    save.guardar(g);
    if (opts?.nube !== false) void cloud.cloudGuardar(g);
  },
  continuar: () => {
    const g = save.cargar();
    if (!g) return false;
    set({ game: g, tab: 'escritorio', showIntro: false });
    return true;
  },
  load: (g) => {
    save.guardar(g);
    void cloud.cloudGuardar(g);
    set({ game: g, tab: 'escritorio', showIntro: false });
  },
  salir: () => {
    const g = get().game;
    if (g && !g.gameOver) {
      save.guardar({ ...g, speed: 0 });
      void cloud.cloudGuardar({ ...g, speed: 0 });
    }
    set({ game: null, minigameTaskId: undefined, workerModalId: undefined, clientModalId: undefined });
  },

  tick: () => {
    const g = get().game;
    if (!g || g.gameOver) return;
    set({ game: produce(g, (d) => void tickEngine(d)) });
  },
  setSpeed: (n) => {
    const g = get().game;
    if (!g) return;
    set({ game: produce(g, (d) => void (d.speed = n)), ...(n > 0 ? { lastSpeed: n as 1 | 2 | 3 } : {}) });
  },
  togglePause: () => {
    const g = get().game;
    if (!g) return;
    get().setSpeed(g.speed === 0 ? get().lastSpeed : 0);
  },
  act: (fn, opts) => {
    const g = get().game;
    if (!g) return;
    let res: Resultado | void = undefined;
    const next = produce(g, (d) => {
      res = fn(d);
    });
    set({ game: next });
    const r = res as Resultado | void;
    if (r && r.texto && !opts?.silent) get().toast(r.texto, r.ok ? 'ok' : 'warn');
    return r;
  },

  setTab: (t) => set({ tab: t }),
  toast: (texto, tone = 'info') => {
    const id = ++toastSeq;
    set({ toasts: [...get().toasts.slice(-3), { id, texto, tone }] });
    setTimeout(() => get().dismissToast(id), 4200);
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  openMinigame: (taskId) => set({ minigameTaskId: taskId }),
  openRelampago: (v) => set({ relampago: v }),
  openWorker: (id) => set({ workerModalId: id }),
  openClient: (id) => set({ clientModalId: id }),
  setIntro: (v) => set({ showIntro: v }),
}));
