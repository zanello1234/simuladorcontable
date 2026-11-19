// Tipos del sistema de conversaciones con clientes.
import type { Client, GameState } from '../engine/types';
import type { Rng } from '../engine/rng';
import type { Mood } from '../scene/Avatar';

export type Quien = 'cliente' | 'titular' | 'narrador';
export type Tono = 'firme' | 'empatico' | 'comercial' | 'etico' | 'cedes';

export interface DialogCtx {
  s: GameState;
  c: Client;
  p: Record<string, number | string>;
  rng: Rng;
}

export interface DialogOption {
  id: string;
  texto: (ctx: DialogCtx) => string;
  hint?: string;
  /** si devuelve false la opción se muestra deshabilitada */
  requiere?: (ctx: DialogCtx) => boolean;
  efecto?: (ctx: DialogCtx) => void;
  /** id del nodo destino, o función que lo decide (ramas condicionales / azar) */
  siguiente: string | ((ctx: DialogCtx) => string);
  tono?: Tono;
}

export interface DialogNode {
  quien: Quien;
  texto: (ctx: DialogCtx) => string;
  mood?: Mood;
  opciones?: DialogOption[];
  /** nodo que sigue automáticamente (sin opciones) */
  siguiente?: string | ((ctx: DialogCtx) => string);
  efecto?: (ctx: DialogCtx) => void;
  /** nodo final */
  fin?: boolean;
  resumen?: (ctx: DialogCtx) => string;
}

export interface DialogDef {
  id: string;
  titulo: string;
  icon: string;
  aplica: (s: GameState, c: Client) => boolean;
  peso: (s: GameState, c: Client) => number;
  /** parámetros generados al iniciar (montos, nombres, etc.) */
  params?: (s: GameState, c: Client, rng: Rng) => Record<string, number | string>;
  inicio: string;
  nodos: Record<string, DialogNode>;
}

export interface DialogLine {
  quien: Quien;
  texto: string;
  mood?: Mood;
}

export interface DialogState {
  defId: string;
  clientId: string;
  nodoId: string;
  params: Record<string, number | string>;
  historial: DialogLine[];
  /** texto de cierre cuando se llegó a un nodo final */
  resumen?: string;
}
