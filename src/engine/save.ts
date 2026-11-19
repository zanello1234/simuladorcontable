// Guardado: autosave local (si el navegador lo permite) + exportar/importar archivo .json.
import { claudeDescargar, enClaude } from './cloud';
import { SAVE_VERSION } from './config';
import { PROGRESO_INICIAL } from './progression';
import type { GameState } from './types';

const KEY = 'partida-doble:save';

/** Almacenamiento con fallback silencioso (modo privado, iframes, etc.). */
function storage(): Storage | null {
  // la versión publicada en claude.ai guarda en la nube (cloud.ts), no en el navegador
  if (import.meta.env.MODE === 'single') return null;
  try {
    const s = window.localStorage;
    const k = '__pd_test__';
    s.setItem(k, '1');
    s.removeItem(k);
    return s;
  } catch {
    return null;
  }
}

export function guardar(s: GameState): boolean {
  const st = storage();
  if (!st) return false;
  try {
    st.setItem(KEY, JSON.stringify({ ...s, fx: [] }));
    return true;
  } catch {
    return false;
  }
}

export function cargar(): GameState | null {
  const st = storage();
  if (!st) return null;
  try {
    const raw = st.getItem(KEY);
    if (!raw) return null;
    return validar(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function borrar(): void {
  try {
    storage()?.removeItem(KEY);
  } catch {
    /* nada */
  }
}

export function hayPartida(): boolean {
  try {
    return !!storage()?.getItem(KEY);
  } catch {
    return false;
  }
}

export function validar(obj: unknown): GameState | null {
  const s = obj as GameState;
  if (!s || typeof s !== 'object' || !s.estudio || !Array.isArray(s.workers) || !s.date) return null;
  if (s.version !== SAVE_VERSION) return null;
  s.fx = [];
  s.speed = 0;
  // partidas anteriores a la progresión
  if (!s.progreso) s.progreso = { ...PROGRESO_INICIAL, misiones: [], logros: [], notas: [] };
  return s;
}

export async function exportar(s: GameState): Promise<string> {
  const json = JSON.stringify({ ...s, fx: [] });
  const nombre = `partida-doble-${s.estudio.nombre.replace(/[^\w-]+/g, '_')}-${s.date}.json`;
  if (enClaude()) {
    const r = await claudeDescargar(nombre, json);
    if (r === 'ok') return 'Partida exportada.';
    if (r === 'no') return 'No se exportó la partida.';
  }
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'Partida exportada.';
}

export async function importar(file: File): Promise<GameState | null> {
  try {
    return validar(JSON.parse(await file.text()));
  } catch {
    return null;
  }
}
