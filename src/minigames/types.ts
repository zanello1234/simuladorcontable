// Contrato de los minijuegos ("modo simulador": el jugador hace la tarea de verdad).
import type { Client, MinigameId, Task } from '../engine/types';

export interface MinigameProps {
  task: Task;
  client: Client;
  /** seed determinístico para generar el caso (mismo task → mismo caso) */
  seed: number;
  /** índice de inflación acumulado del juego (1 = enero inicial). Escalar montos con esto. */
  indice: number;
  onComplete: (r: MinigameResult) => void;
  onCancel: () => void;
}

export interface MinigameResult {
  /** 0..1 — 1 = perfecto. Define si la tarea queda con errores latentes. */
  score: number;
  /** una línea de resumen, p.ej. "Saldo técnico correcto. 1 comprobante mal clasificado." */
  resumen: string;
  /** feedback educativo: qué se hizo mal y por qué (normativa) */
  errores: string[];
}

export interface MinigameMeta {
  id: MinigameId;
  titulo: string;
  descripcion: string;
  /** horas de juego que consume al titular */
  horas: number;
  icon: string;
}
