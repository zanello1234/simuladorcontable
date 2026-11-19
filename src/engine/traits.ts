// Rasgos de personalidad del equipo: le dan carácter a cada persona y cambian cómo trabaja.
import type { Rasgo, StepKind } from './types';

export interface RasgoDef {
  id: Rasgo;
  icon: string;
  nombre: string;
  descripcion: string;
  /** multiplicador de velocidad */
  velocidad?: number;
  /** multiplicador de probabilidad de error */
  error?: number;
  /** multiplicador de estrés acumulado por hora */
  estres?: number;
  /** multiplicador de experiencia ganada */
  xp?: number;
  /** multiplicador de detección en revisión */
  detect?: number;
  /** bonus de moral diario a los demás */
  moralEquipo?: number;
  /** multiplicador de estrés en horas extra (nocturno) */
  estresExtra?: number;
  /** pasos a los que aplica velocidad/error (si falta, todos) */
  pasos?: StepKind[];
  /** solo para el titular no aplica */
  soloEmpleados?: boolean;
}

export const RASGOS: Record<Rasgo, RasgoDef> = {
  mateador: { id: 'mateador', icon: '🧉', nombre: 'Mateador/a', descripcion: 'Ceba para todos. Sube la moral del equipo cada día.', moralEquipo: 0.6, velocidad: 0.95 },
  perfeccionista: { id: 'perfeccionista', icon: '🔬', nombre: 'Perfeccionista', descripcion: 'Comete la mitad de errores, pero tarda un 15% más.', error: 0.5, velocidad: 0.85, detect: 1.2 },
  rapido: { id: 'rapido', icon: '⚡', nombre: 'Rápido/a', descripcion: 'Un 20% más veloz. Se le escapan más cosas.', velocidad: 1.2, error: 1.35 },
  nocturno: { id: 'nocturno', icon: '🦉', nombre: 'Nocturno/a', descripcion: 'Las horas extra casi no lo/a estresan.', estresExtra: 0.3 },
  zen: { id: 'zen', icon: '🧘', nombre: 'Zen', descripcion: 'Acumula la mitad de estrés.', estres: 0.5 },
  chusma: { id: 'chusma', icon: '🗣️', nombre: 'Chusma', descripcion: 'Se entera de todo: a veces avisa de clientes que andan buscando contador.', velocidad: 0.95 },
  hincha: { id: 'hincha', icon: '⚽', nombre: 'Hincha', descripcion: 'Cuando juega la Selección, no rinde. El resto del año, moral alta.', moralEquipo: 0.2 },
  aprendiz: { id: 'aprendiz', icon: '📚', nombre: 'Aprendiz', descripcion: 'Gana experiencia el doble de rápido.', xp: 2 },
  detallista: { id: 'detallista', icon: '🔍', nombre: 'Detallista', descripcion: 'Revisa como nadie: +35% de detección de errores.', detect: 1.35 },
  distraido: { id: 'distraido', icon: '🌀', nombre: 'Distraído/a', descripcion: 'Simpático/a, pero comete un 25% más de errores en la carga.', error: 1.25, pasos: ['carga'] },
};

export const RASGOS_LISTA = Object.values(RASGOS);
