// Minijuego de liquidación de sueldos — generación del caso, opciones y evaluación (funciones puras).
// Modelo simplificado inspirado en el CCT 130/75 (Empleados de Comercio).
import { HORAS_MES, SUELDOS } from '../../engine/config';
import { r2, money2 } from '../../engine/format';
import { hashSeed, makeRng, type Rng } from '../../engine/rng';
import { cuit, nombrePersona } from '../../engine/names';
import { MESES } from '../../engine/calendar';
import type { Client, Task } from '../../engine/types';

// ----------------------------------------------------------------------------- Tipos

export interface EmpleadoCaso {
  legajo: number;
  nombre: string;
  cuil: string;
  categoria: string;
  /** fecha de ingreso dd/mm/aaaa */
  ingreso: string;
  /** años de antigüedad computables */
  anios: number;
  basico: number;
  /** ausencias injustificadas del mes */
  ausencias: number;
  /** horas extra en días hábiles (recargo 50%) */
  horasExtra: number;
}

export interface CasoSueldos {
  periodo: string; // 'YYYY-MM'
  periodoLabel: string; // 'marzo 2027'
  empresa: string;
  cuit: string;
  empleados: EmpleadoCaso[];
  /** empleados que liquida el sistema (no se juegan) */
  restantes: number;
  /** junio/diciembre: aviso de que el SAC va en recibo aparte */
  esMesSAC: boolean;
}

export type ConceptoKey = 'antiguedad' | 'horasExtra' | 'presentismo' | 'base' | 'aportes';
/** orden de las preguntas por empleado */
export const CONCEPTOS: ConceptoKey[] = ['antiguedad', 'horasExtra', 'presentismo', 'base', 'aportes'];

export const CONCEPTO_LABEL: Record<ConceptoKey, string> = {
  antiguedad: 'Antigüedad',
  horasExtra: 'Horas extra al 50%',
  presentismo: 'Presentismo (asistencia y puntualidad)',
  base: 'Base para aportes',
  aportes: 'Aportes del trabajador',
};

/** ponderación de cada decisión en el score (por empleado) */
export const PESOS: Record<ConceptoKey | 'neto', number> = {
  antiguedad: 1,
  horasExtra: 1,
  presentismo: 1,
  base: 2,
  aportes: 2,
  neto: 3,
};

export interface AporteLinea {
  concepto: string;
  tasa: number;
  monto: number;
}

export interface Opcion {
  id: string;
  /** null = "No corresponde" */
  monto: number | null;
  label: string;
  correcta: boolean;
  /** por qué está mal (si el jugador la elige y es incorrecta) */
  explicacion: string;
  /** solo para la pregunta de aportes */
  lineas?: AporteLinea[];
}

export type Respuestas = Partial<Record<ConceptoKey, Opcion>>;

export interface Liquidacion {
  basico: number;
  antiguedad: number;
  horasExtra: number;
  presentismo: number;
  remunerativo: number;
  aportes: AporteLinea[];
  totalAportes: number;
  neto: number;
}

// ----------------------------------------------------------------------------- Generación

const CATEGORIAS = ['Administrativo A', 'Administrativo B', 'Administrativo C', 'Vendedor A', 'Vendedor B', 'Cajero A', 'Cajero B', 'Auxiliar B', 'Maestranza A'];

function periodoDe(task: Task): string {
  if (/^\d{4}-\d{2}$/.test(task.periodo)) return task.periodo;
  if (/^\d{4}$/.test(task.periodo)) return `${task.periodo}-12`;
  return task.vence.slice(0, 7);
}

export function generarCasoSueldos(seed: number, client: Client, task: Task, indice: number): CasoSueldos {
  const rng = makeRng(seed ^ 0x51ed05);
  const periodo = periodoDe(task);
  const [y, m] = periodo.split('-').map(Number);
  const total = Math.max(client.empleados, 1);
  const n = Math.min(total, 3);
  const empleados: EmpleadoCaso[] = [];
  const usados = new Set<string>();
  for (let i = 0; i < n; i++) {
    let p = nombrePersona(rng);
    while (usados.has(p.nombre)) p = nombrePersona(rng);
    usados.add(p.nombre);
    const anios = rng.chance(0.2) ? 0 : rng.int(1, 14);
    const ingresoY = y - anios;
    const ingresoM = anios === 0 ? rng.int(1, Math.max(1, m - 1)) : rng.int(1, 12);
    const ingresoD = rng.int(1, 28);
    // el primer empleado casi siempre tiene algo "interesante" para decidir
    const ausencias = rng.chance(i === 0 ? 0.35 : 0.25) ? rng.int(1, 2) : 0;
    const horasExtra = rng.chance(0.6) ? rng.int(2, 12) : 0;
    const basico = r2(rng.range(1_100_000, 1_500_000) * indice);
    empleados.push({
      legajo: 100 + rng.int(1, 899),
      nombre: p.nombre,
      cuil: cuit(rng, p.genero),
      categoria: rng.pick(CATEGORIAS),
      ingreso: `${String(ingresoD).padStart(2, '0')}/${String(ingresoM).padStart(2, '0')}/${ingresoY}`,
      anios,
      basico,
      ausencias,
      horasExtra,
    });
  }
  return {
    periodo,
    periodoLabel: `${MESES[m - 1]} ${y}`,
    empresa: client.nombre,
    cuit: client.cuit,
    empleados,
    restantes: total - n,
    esMesSAC: m === 6 || m === 12,
  };
}

// ----------------------------------------------------------------------------- Cálculo correcto

export function aportesSobre(base: number, conSindicato = true, osTasa = SUELDOS.obraSocial): AporteLinea[] {
  const l: AporteLinea[] = [
    { concepto: 'Jubilación (SIPA)', tasa: SUELDOS.jubilacion, monto: r2(base * SUELDOS.jubilacion) },
    { concepto: 'Ley 19.032 (INSSJP)', tasa: SUELDOS.ley19032, monto: r2(base * SUELDOS.ley19032) },
    { concepto: 'Obra social', tasa: osTasa, monto: r2(base * osTasa) },
  ];
  if (conSindicato) l.push({ concepto: 'Cuota sindical', tasa: SUELDOS.sindicato, monto: r2(base * SUELDOS.sindicato) });
  return l;
}

const sum = (xs: number[]) => r2(xs.reduce((a, b) => a + b, 0));

export function liquidacionCorrecta(e: EmpleadoCaso): Liquidacion {
  const antiguedad = e.anios > 0 ? r2(e.basico * SUELDOS.antiguedadPorAnio * e.anios) : 0;
  const horasExtra = e.horasExtra > 0 ? r2(((e.basico + antiguedad) / HORAS_MES) * 1.5 * e.horasExtra) : 0;
  const presentismo = e.ausencias === 0 ? r2((e.basico + antiguedad) * SUELDOS.presentismo) : 0;
  const remunerativo = sum([e.basico, antiguedad, horasExtra, presentismo]);
  const aportes = aportesSobre(remunerativo);
  const totalAportes = sum(aportes.map((a) => a.monto));
  return { basico: e.basico, antiguedad, horasExtra, presentismo, remunerativo, aportes, totalAportes, neto: r2(remunerativo - totalAportes) };
}

// ----------------------------------------------------------------------------- Opciones

interface Cand {
  monto: number;
  explicacion: string;
}

const NC_ID = 'nc';

function armar(rng: Rng, correcto: number | null, cands: Cand[], explicacionNC: string, correctaSiNC: string): Opcion[] {
  const elegidos: Cand[] = [];
  const distinto = (x: number) => Math.abs(x - (correcto ?? -1)) > 0.5 && elegidos.every((c) => Math.abs(c.monto - x) > 0.5) && x > 0;
  for (const c of rng.shuffle([...cands])) {
    if (elegidos.length >= (correcto === null ? 3 : 2)) break;
    if (distinto(c.monto)) elegidos.push(c);
  }
  const ops: Opcion[] = elegidos.map((c) => ({
    id: '',
    monto: r2(c.monto),
    label: money2(r2(c.monto)),
    correcta: false,
    explicacion: correcto === null ? correctaSiNC : c.explicacion,
  }));
  if (correcto !== null) ops.push({ id: '', monto: correcto, label: money2(correcto), correcta: true, explicacion: '' });
  rng.shuffle(ops);
  ops.forEach((o, i) => (o.id = `o${i}`));
  ops.push({ id: NC_ID, monto: null, label: 'No corresponde', correcta: correcto === null, explicacion: explicacionNC });
  return ops;
}

/** valor numérico elegido (No corresponde = 0) */
const v = (o?: Opcion) => o?.monto ?? 0;

/**
 * Opciones de una pregunta. Se calculan sobre las respuestas previas del jugador para que el
 * recibo sea coherente: se evalúa el MÉTODO en cada paso y el neto final contra la liquidación correcta.
 */
export function opcionesPara(e: EmpleadoCaso, key: ConceptoKey, resp: Respuestas, seed: number): Opcion[] {
  const rng = makeRng(hashSeed(`${seed}:${e.legajo}:${key}`));
  const b = e.basico;
  const a = v(resp.antiguedad);
  const hx = v(resp.horasExtra);
  const pr = v(resp.presentismo);

  switch (key) {
    case 'antiguedad': {
      const correcto = e.anios > 0 ? r2(b * SUELDOS.antiguedadPorAnio * e.anios) : null;
      const n = Math.max(e.anios, 1);
      return armar(
        rng,
        correcto,
        [
          { monto: b * 0.02 * n, explicacion: 'Usaste 2% por año. En el CCT 130/75 la antigüedad es 1% del básico por cada año.' },
          { monto: b * 0.01, explicacion: 'Pusiste 1% del básico sin multiplicar por los años de antigüedad.' },
          { monto: b * 0.01 * (n + 1), explicacion: 'Contaste un año de más: se computan años completos de servicio.' },
          { monto: b * 0.01 * n * (13 / 12), explicacion: 'La antigüedad se calcula sobre el básico de convenio, no sobre básico + presentismo.' },
          { monto: b * 0.015 * n, explicacion: 'El porcentaje es 1% por año sobre el básico.' },
        ],
        `Sí correspondía: ${e.anios} año(s) de antigüedad × 1% del básico = ${money2(correcto ?? 0)}.`,
        'Ingresó hace menos de un año: todavía no tiene años completos de antigüedad, no corresponde el adicional.',
      );
    }
    case 'horasExtra': {
      const correcto = e.horasExtra > 0 ? r2(((b + a) / HORAS_MES) * 1.5 * e.horasExtra) : null;
      const h = e.horasExtra > 0 ? e.horasExtra : 4;
      return armar(
        rng,
        correcto,
        [
          { monto: ((b + a) / HORAS_MES) * 2 * h, explicacion: 'Las liquidaste al 100%. En días hábiles el recargo es del 50% (LCT); el 100% es para sábados después de las 13, domingos y feriados.' },
          { monto: (b / HORAS_MES) * 1.5 * h, explicacion: 'Calculaste el valor hora solo con el básico: tiene que incluir la antigüedad.' },
          { monto: ((b + a) / HORAS_MES) * h, explicacion: 'Te olvidaste el recargo: la hora extra en día hábil se paga con 50% adicional.' },
          { monto: ((b + a) / 240) * 1.5 * h, explicacion: 'El divisor para el valor hora en este juego es 200 horas mensuales.' },
        ],
        `Sí correspondía: ${e.horasExtra} hs × valor hora (básico + antigüedad) / ${HORAS_MES} × 1,5 = ${money2(correcto ?? 0)}.`,
        'No hizo horas extra este mes: no corresponde liquidarlas.',
      );
    }
    case 'presentismo': {
      const correcto = e.ausencias === 0 ? r2((b + a) * SUELDOS.presentismo) : null;
      return armar(
        rng,
        correcto,
        [
          { monto: b / 12, explicacion: 'Lo calculaste sobre el básico solo. El adicional por asistencia y puntualidad es 1/12 de (básico + antigüedad).' },
          { monto: (b + a) * 0.1, explicacion: 'Usaste 10%. El adicional es la doceava parte (8,33%) de básico + antigüedad.' },
          { monto: (b + a + hx) / 12, explicacion: 'Incluiste las horas extra en la base del presentismo: va sobre básico + antigüedad.' },
          { monto: (b + a) * 0.05, explicacion: 'El adicional es 1/12 (8,33%) de básico + antigüedad, no 5%.' },
        ],
        `Sí correspondía: sin ausencias injustificadas cobra 1/12 de (básico + antigüedad) = ${money2(correcto ?? 0)}.`,
        `Tuvo ${e.ausencias} ausencia(s) injustificada(s) en el mes: pierde el adicional por asistencia y puntualidad.`,
      );
    }
    case 'base': {
      const rem = r2(b + a + hx + pr);
      const cands: Cand[] = [
        { monto: b + a, explicacion: 'Tomaste solo básico + antigüedad. Presentismo y horas extra también son remunerativos y pagan aportes.' },
        { monto: b, explicacion: 'Tomaste solo el básico. Los aportes van sobre todo el bruto remunerativo.' },
        { monto: rem * 0.81, explicacion: 'Aplicaste los aportes sobre el neto. Se calculan sobre la remuneración bruta remunerativa.' },
      ];
      if (hx > 0) cands.push({ monto: rem - hx, explicacion: 'Excluiste las horas extra: son remunerativas y tributan aportes.' });
      if (pr > 0) cands.push({ monto: rem - pr, explicacion: 'Excluiste el presentismo: es un adicional remunerativo y paga aportes.' });
      const ops = armar(rng, rem, cands, '', '');
      // la base siempre corresponde: sacamos el "No corresponde"
      return ops.filter((o) => o.id !== NC_ID);
    }
    case 'aportes': {
      const base = v(resp.base);
      const mk = (id: string, lineas: AporteLinea[], correcta: boolean, explicacion: string): Opcion => {
        const total = sum(lineas.map((l) => l.monto));
        return {
          id,
          monto: total,
          label: lineas.map((l) => `${shortName(l.concepto)} ${pctTxt(l.tasa)}`).join(' · '),
          correcta,
          explicacion,
          lineas,
        };
      };
      const ops = [
        mk('', aportesSobre(base), true, ''),
        mk('', aportesSobre(base, false), false, 'Te faltó la cuota sindical: en el juego, todos los empleados de comercio aportan 2% al sindicato.'),
        mk('', aportesSobre(base, true, 0.06), false, 'Usaste 6% de obra social: ese porcentaje es la contribución del empleador. El aporte del trabajador es 3%.'),
      ];
      rng.shuffle(ops);
      ops.forEach((o, i) => (o.id = `o${i}`));
      return ops;
    }
  }
}

function shortName(c: string): string {
  if (c.startsWith('Jubilación')) return 'Jubilación';
  if (c.startsWith('Ley 19.032')) return 'Ley 19.032';
  if (c.startsWith('Obra')) return 'Obra social';
  return 'Sindicato';
}
const pctTxt = (t: number) => `${(t * 100).toLocaleString('es-AR', { maximumFractionDigits: 2 })}%`;

// ----------------------------------------------------------------------------- Recibo del jugador

export function reciboDesde(e: EmpleadoCaso, resp: Respuestas): Liquidacion {
  const antiguedad = v(resp.antiguedad);
  const horasExtra = v(resp.horasExtra);
  const presentismo = v(resp.presentismo);
  const remunerativo = sum([e.basico, antiguedad, horasExtra, presentismo]);
  const aportes = resp.aportes?.lineas ?? [];
  const totalAportes = sum(aportes.map((a) => a.monto));
  return { basico: e.basico, antiguedad, horasExtra, presentismo, remunerativo, aportes, totalAportes, neto: r2(remunerativo - totalAportes) };
}

export const completo = (resp: Respuestas) => CONCEPTOS.every((k) => resp[k] !== undefined);

// ----------------------------------------------------------------------------- Evaluación

export interface EvaluacionSueldos {
  score: number;
  resumen: string;
  errores: string[];
  netosOk: number;
}

export function evaluarSueldos(caso: CasoSueldos, respuestas: Respuestas[]): EvaluacionSueldos {
  let ok = 0;
  let total = 0;
  let netosOk = 0;
  const errores: string[] = [];
  caso.empleados.forEach((e, i) => {
    const r = respuestas[i] ?? {};
    const nombre = e.nombre.split(' ')[0];
    for (const k of CONCEPTOS) {
      total += PESOS[k];
      const o = r[k];
      if (o?.correcta) ok += PESOS[k];
      else errores.push(`${nombre} — ${CONCEPTO_LABEL[k]}: ${o ? o.explicacion : 'sin responder.'}`);
    }
    total += PESOS.neto;
    const real = liquidacionCorrecta(e);
    const jugador = reciboDesde(e, r);
    if (Math.abs(real.neto - jugador.neto) < 0.01) {
      ok += PESOS.neto;
      netosOk++;
    } else {
      errores.push(`${nombre} — Neto a cobrar: liquidaste ${money2(jugador.neto)} y correspondía ${money2(real.neto)} (bruto remunerativo ${money2(real.remunerativo)} − aportes ${money2(real.totalAportes)}).`);
    }
  });
  const score = total > 0 ? ok / total : 0;
  const n = caso.empleados.length;
  const resumen =
    netosOk === n
      ? `${n === 1 ? 'El recibo cerró' : `Los ${n} recibos cerraron`} con el neto correcto.${caso.restantes > 0 ? ` El sistema liquidó a los otros ${caso.restantes}.` : ''}`
      : `${netosOk} de ${n} neto(s) correcto(s). Revisá los conceptos marcados antes de mandar los recibos.`;
  const MAX = 12;
  const lista = errores.length > MAX ? [...errores.slice(0, MAX), `…y ${errores.length - MAX} observación(es) más.`] : errores;
  return { score, resumen, errores: lista, netosOk };
}
