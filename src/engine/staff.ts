// Equipo: candidatos, productividad, errores y costo laboral.
import { CARGAS_SOCIALES, ERROR_BASE, ROLES } from './config';
import { avatar, nombrePersona } from './names';
import type { Rng } from './rng';
import { RASGOS, RASGOS_LISTA } from './traits';
import type { Area, Avatar, Candidate, Rasgo, Role, StepKind, Worker } from './types';
import { AREAS } from './types';

const BIOS: Record<Role, string[]> = {
  titular: [''],
  cadete: ['Estudia Ciencias Económicas a la noche. Conoce cada ventanilla del centro.', 'Tiene moto y no le teme a ninguna fila.', 'Primer trabajo. Muy voluntarioso/a.'],
  administrativo: ['Viene de un comercio, tipea a 90 palabras por minuto.', 'Ordenado/a hasta la obsesión. Etiqueta todo.', 'Experiencia en carga de libros IVA en otro estudio.'],
  liquidador: ['Liquidó Comercio, UOM y Gastronómicos durante 8 años.', 'Sabe de memoria las escalas de la paritaria.', 'Ex RRHH de una cadena de supermercados.'],
  junior: ['Recién recibido/a, promedio 8,5. Quiere aprender de todo.', 'Hizo la pasantía en una Big Four.', 'Le encanta la tecnología y la IA aplicada.'],
  semisenior: ['5 años en un estudio mediano. Se banca los vencimientos.', 'Especialista en IVA y Convenio Multilateral.', 'Arma balances con los ojos cerrados.'],
  senior: ['15 años de profesión. Atendió decenas de fiscalizaciones.', 'Ex inspector/a de la DGI. Conoce el otro lado del mostrador.', 'Docente universitario/a de Impuestos.'],
};

export function generarCandidato(rng: Rng, role: Role, indice: number, id: string): Candidate {
  const r = ROLES[role];
  const p = nombrePersona(rng);
  const skills = {} as Record<Area, number>;
  for (const a of AREAS) {
    let v = rng.int(r.skill[0], r.skill[1]);
    if (r.foco && a === r.foco) v = rng.int(55, 85);
    skills[a] = v;
  }
  // un área fuerte aleatoria para roles profesionales
  if (role === 'junior' || role === 'semisenior' || role === 'senior') {
    const fuerte = rng.pick(AREAS);
    skills[fuerte] = Math.min(95, skills[fuerte] + rng.int(5, 12));
  }
  const velocidad = Math.round(rng.range(0.78, 1.28) * 100) / 100;
  const prom = AREAS.reduce((a, k) => a + skills[k], 0) / 3;
  const factor = 0.88 + (prom - (r.skill[0] + r.skill[1]) / 2) / 120 + (velocidad - 1) * 0.25;
  const rasgo: Rasgo | undefined = rng.chance(0.75) ? rng.pick(RASGOS_LISTA).id : undefined;
  return {
    id,
    nombre: p.nombre,
    role,
    skills,
    velocidad,
    sueldo: Math.round((r.sueldo * indice * factor) / 10_000) * 10_000,
    avatar: avatar(rng, p.genero),
    bio: rng.pick(BIOS[role]),
    rasgo,
  };
}

export function generarCandidatos(rng: Rng, nivel: number, indice: number, nextId: () => string): Candidate[] {
  const roles: { item: Role; w: number }[] = [
    { item: 'cadete', w: 2 },
    { item: 'administrativo', w: 3 },
    { item: 'liquidador', w: 2 },
    { item: 'junior', w: 3 },
    { item: 'semisenior', w: nivel >= 2 ? 2 : 1 },
    { item: 'senior', w: nivel >= 2 ? 1.5 : 0.5 },
  ];
  const n = 3 + Math.min(3, nivel);
  return Array.from({ length: n }, () => generarCandidato(rng, rng.weighted(roles), indice, nextId()));
}

export function nuevoWorker(c: Candidate, hoy: string, deskIndex: number): Worker {
  return {
    id: c.id,
    nombre: c.nombre,
    role: c.role,
    skills: { ...c.skills },
    velocidad: c.velocidad,
    sueldo: c.sueldo,
    moral: 72,
    estres: 10,
    queue: [],
    horasExtra: false,
    contratadoEl: hoy,
    avatar: c.avatar,
    deskIndex,
    status: 'ocioso',
    statusText: 'Acomodando el escritorio',
    ocupadoHoras: 0,
    horasMes: 0,
    horasExtraMes: 0,
    rasgo: c.rasgo,
  };
}

export function titular(nombre: string, especialidad: Area, av: Avatar, hoy: string): Worker {
  const skills = { impuestos: 55, sueldos: 48, contabilidad: 55 } as Record<Area, number>;
  skills[especialidad] = 72;
  return {
    id: 'player',
    nombre,
    role: 'titular',
    skills,
    velocidad: 1.1,
    sueldo: 0,
    moral: 85,
    estres: 5,
    queue: [],
    horasExtra: false,
    contratadoEl: hoy,
    avatar: av,
    deskIndex: 0,
    status: 'ocioso',
    statusText: 'Cebando el primer mate',
    ocupadoHoras: 0,
    horasMes: 0,
    horasExtraMes: 0,
  };
}

/** Horas efectivas que avanza un trabajador en una hora de reloj. */
export function eficiencia(w: Worker, area: Area, step: StepKind): number {
  const skill = w.skills[area];
  const bonus = ROLES[w.role].bonusPaso?.[step] ?? 1;
  const estres = w.estres > 85 ? 0.6 : w.estres > 70 ? 0.85 : 1;
  const moral = w.moral < 30 ? 0.8 : w.moral > 80 ? 1.05 : 1;
  // la revisión exige criterio: con poca experiencia se avanza muy lento
  const criterio = step === 'revision' ? 0.35 + skill / 120 : 0.45 + (skill / 100) * 0.75;
  const r = w.rasgo ? RASGOS[w.rasgo] : undefined;
  const rv = r && (!r.pasos || r.pasos.includes(step)) ? (r.velocidad ?? 1) : 1;
  return w.velocidad * criterio * bonus * estres * moral * rv;
}

/** Multiplicador de estrés por hora según rasgo. */
export function factorEstres(w: Worker, extra: boolean): number {
  const r = w.rasgo ? RASGOS[w.rasgo] : undefined;
  if (!r) return 1;
  return (r.estres ?? 1) * (extra ? (r.estresExtra ?? 1) : 1);
}
export function factorXp(w: Worker): number {
  return (w.rasgo && RASGOS[w.rasgo].xp) || 1;
}

/** Probabilidad de introducir un error al completar un paso. */
export function probError(w: Worker, area: Area, step: StepKind, toolErrorMult: number): number {
  const base = ERROR_BASE[step];
  const skill = w.skills[area];
  const estres = w.estres > 70 ? 1.35 : 1;
  const r = w.rasgo ? RASGOS[w.rasgo] : undefined;
  const re = r && (!r.pasos || r.pasos.includes(step)) ? (r.error ?? 1) : 1;
  return Math.min(0.85, base * (1.6 - skill / 100) * estres * toolErrorMult * re);
}

/** Probabilidad de detectar cada error en la revisión. */
export function probDeteccion(w: Worker, area: Area, autoRevision: boolean, detectMult: number): number {
  const skill = w.skills[area];
  const rd = (w.rasgo && RASGOS[w.rasgo].detect) || 1;
  return Math.min(0.97, (0.3 + (skill / 100) * 0.62) * detectMult * rd * (autoRevision ? 0.6 : 1));
}

export const costoLaboral = (w: Worker) => w.sueldo * (1 + CARGAS_SOCIALES);
