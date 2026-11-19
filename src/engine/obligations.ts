// Obligaciones: qué tiene que presentar cada cliente, cuándo vence y cuánto trabajo lleva.
//
// Vencimientos: reglas de juego inspiradas en el calendario de ARCA por terminación de CUIT.
// Si el día cae inhábil se corre al próximo hábil (regla real). Días exactos [A CONFIRMAR]
// contra el calendario oficial del año.
import { addBusinessDays, adjustToBusinessDay, diffDays, lastDayOfMonth, month, nextMonthKey, nthBusinessDay, periodoCorto, year, ymd } from './calendar';
import { FACTOR_HORAS, MULTA_F931, MULTA_FORMAL_PH, MULTA_FORMAL_SOC, MULTA_REQUERIMIENTO, MULTA_SUELDOS_TARDE } from './config';
import { terminacion } from './names';
import type { Rng } from './rng';
import type { Area, Client, ISODate, MinigameId, ObligationKind, StepKind, Task, TaskStep } from './types';

export interface ObligationTemplate {
  kind: ObligationKind;
  nombre: string;
  organismo: string;
  area: Area;
  icon: string;
  /** se considera "crítica" para la política de revisión */
  critica: boolean;
  minigame?: MinigameId;
  aplica: (c: Client) => boolean;
  /** si en el mes `mes` ('YYYY-MM') hay que generar la tarea, devuelve el período; si no, null */
  genera: (c: Client, mes: string) => string | null;
  /** día del mes en que se genera (por defecto, el primer día hábil) */
  diaGeneracion?: number;
  vence: (c: Client, periodo: string) => ISODate;
  horas: (c: Client) => Partial<Record<StepKind, number>>;
  /** días hábiles máximos de demora en traer la documentación (cliente desordenado) */
  demoraDocs: number;
  multa: (c: Client) => number;
  descripcion: string;
}

const esSociedad = (c: Client) => c.kind === 'srl' || c.kind === 'sas' || c.kind === 'sa';
const esRI = (c: Client) => c.kind !== 'monotributista';
const vol = (c: Client) => Math.min(4, Math.max(0.4, c.volumen / 100));
const emp = (c: Client) => Math.max(1, c.empleados);
const pick = (c: Client, tabla: number[]) => tabla[terminacion(c.cuit)];
const mesAnterior = (mes: string) => nextMonthKey(mes, -1);
const diaDelMesSiguiente = (periodo: string, dia: number): ISODate => {
  const [y, m] = nextMonthKey(periodo).split('-').map(Number);
  return adjustToBusinessDay(ymd(y, m, Math.min(dia, lastDayOfMonth(y, m))));
};
const multaDDJJ = (c: Client) => (esSociedad(c) ? MULTA_FORMAL_SOC : MULTA_FORMAL_PH);

export const OBLIGACIONES: ObligationTemplate[] = [
  {
    kind: 'iva',
    nombre: 'DDJJ IVA',
    organismo: 'ARCA',
    area: 'impuestos',
    icon: '🧾',
    critica: true,
    minigame: 'iva',
    aplica: esRI,
    genera: (_c, mes) => mesAnterior(mes),
    vence: (c, p) => diaDelMesSiguiente(p, pick(c, [18, 18, 19, 19, 20, 20, 21, 21, 22, 22])),
    horas: (c) => ({ recopilar: 0.5, carga: 2.3 * vol(c), liquidacion: 1.1 + 0.35 * vol(c), revision: 0.7 + 0.2 * vol(c), presentacion: 0.5 }),
    demoraDocs: 11,
    multa: multaDDJJ,
    descripcion: 'Liquidación mensual de IVA: débito y crédito fiscal, saldo técnico, retenciones y percepciones.',
  },
  {
    kind: 'iibb',
    nombre: 'Ingresos Brutos',
    organismo: 'API Santa Fe / Comisión Arbitral',
    area: 'impuestos',
    icon: '🏛️',
    critica: false,
    aplica: esRI,
    genera: (_c, mes) => mesAnterior(mes),
    vence: (c, p) =>
      c.jurisdiccion === 'convenio'
        ? diaDelMesSiguiente(p, pick(c, [15, 15, 15, 16, 16, 16, 17, 17, 17, 17]))
        : diaDelMesSiguiente(p, pick(c, [13, 13, 14, 14, 15, 15, 16, 16, 17, 17])),
    horas: (c) => ({ recopilar: 0.3, carga: 0.6 * vol(c), liquidacion: c.jurisdiccion === 'convenio' ? 1.6 : 0.8, revision: 0.4, presentacion: 0.4 }),
    demoraDocs: 9,
    multa: (c) => multaDDJJ(c) * 0.5,
    descripcion: 'Anticipo mensual de IIBB (local o Convenio Multilateral CM03 / SIFERE).',
  },
  {
    kind: 'sueldos',
    nombre: 'Liquidación de sueldos',
    organismo: 'Empleador (LCT)',
    area: 'sueldos',
    icon: '💵',
    critica: true,
    minigame: 'sueldos',
    aplica: (c) => c.empleados > 0,
    // las novedades del mes se recopilan en la última semana
    genera: (_c, mes) => mes,
    diaGeneracion: 22,
    // los recibos tienen que estar antes del 4º día hábil (plazo de pago, LCT art. 128)
    vence: (_c, p) => {
      const [y, m] = nextMonthKey(p).split('-').map(Number);
      return nthBusinessDay(y, m, 3);
    },
    horas: (c) => ({ recopilar: 0.4, carga: 0.25 * emp(c), liquidacion: 0.35 * emp(c) + 0.5, revision: 0.3 + 0.08 * emp(c), presentacion: 0.4 }),
    demoraDocs: 3,
    multa: () => MULTA_SUELDOS_TARDE,
    descripcion: 'Novedades del mes, recibos de haberes y Libro de Sueldos Digital.',
  },
  {
    kind: 'f931',
    nombre: 'F.931 (SUSS)',
    organismo: 'ARCA',
    area: 'sueldos',
    icon: '👷',
    critica: false,
    aplica: (c) => c.empleados > 0,
    genera: (_c, mes) => mesAnterior(mes),
    vence: (c, p) => diaDelMesSiguiente(p, pick(c, [9, 9, 9, 9, 10, 10, 10, 11, 11, 11])),
    horas: (c) => ({ carga: 0.5 + 0.1 * emp(c), liquidacion: 0.6, revision: 0.3, presentacion: 0.4 }),
    demoraDocs: 0,
    multa: () => MULTA_F931,
    descripcion: 'DDJJ de aportes y contribuciones de la seguridad social.',
  },
  {
    kind: 'monotributo',
    nombre: 'VEP Monotributo',
    organismo: 'ARCA',
    area: 'impuestos',
    icon: '🪪',
    critica: false,
    aplica: (c) => c.kind === 'monotributista',
    genera: (_c, mes) => mes,
    vence: (_c, p) => {
      const [y, m] = p.split('-').map(Number);
      return adjustToBusinessDay(ymd(y, m, 20));
    },
    horas: () => ({ presentacion: 0.4 }),
    demoraDocs: 0,
    multa: () => 25_000,
    descripcion: 'Generar el VEP de la cuota mensual y avisarle al cliente.',
  },
  {
    kind: 'recategorizacion',
    nombre: 'Recategorización Monotributo',
    organismo: 'ARCA',
    area: 'impuestos',
    icon: '📊',
    critica: true,
    minigame: 'recategorizacion',
    aplica: (c) => c.kind === 'monotributista',
    genera: (_c, mes) => (mes.endsWith('-02') ? `${mes.slice(0, 4)}-S1` : mes.endsWith('-08') ? `${mes.slice(0, 4)}-S2` : null),
    vence: (_c, p) => adjustToBusinessDay(ymd(Number(p.slice(0, 4)), p.endsWith('S1') ? 2 : 8, 20)),
    horas: (c) => ({ recopilar: 0.4, carga: 0.6 + 0.4 * vol(c), liquidacion: 0.8, revision: 0.4, presentacion: 0.4 }),
    demoraDocs: 6,
    multa: () => 80_000,
    descripcion: 'Ingresos de los últimos 12 meses, superficie, energía y alquileres: ¿sube, baja o queda?',
  },
  {
    kind: 'ganancias_ph',
    nombre: 'Ganancias Personas Humanas',
    organismo: 'ARCA',
    area: 'impuestos',
    icon: '📑',
    critica: true,
    minigame: 'ganancias_ph',
    aplica: (c) => c.kind === 'ri_persona',
    genera: (_c, mes) => (mes.endsWith('-04') ? String(Number(mes.slice(0, 4)) - 1) : null),
    vence: (c, p) => adjustToBusinessDay(ymd(Number(p) + 1, 6, pick(c, [11, 11, 11, 12, 12, 12, 13, 13, 13, 13]))),
    horas: (c) => ({ recopilar: 1, carga: 3 * vol(c), liquidacion: 4, revision: 1.5, presentacion: 0.8 }),
    demoraDocs: 25,
    multa: multaDDJJ,
    descripcion: 'DDJJ anual: rentas por categoría, deducciones y anticipos.',
  },
  {
    kind: 'bienes_personales',
    nombre: 'Bienes Personales',
    organismo: 'ARCA',
    area: 'impuestos',
    icon: '🏠',
    critica: false,
    aplica: (c) => c.kind === 'ri_persona',
    genera: (_c, mes) => (mes.endsWith('-04') ? String(Number(mes.slice(0, 4)) - 1) : null),
    vence: (c, p) => adjustToBusinessDay(ymd(Number(p) + 1, 6, pick(c, [11, 11, 11, 12, 12, 12, 13, 13, 13, 13]))),
    horas: () => ({ recopilar: 0.5, carga: 1, liquidacion: 1.2, revision: 0.5, presentacion: 0.5 }),
    demoraDocs: 25,
    multa: multaDDJJ,
    descripcion: 'DDJJ anual de bienes al 31/12: valuación y mínimo no imponible.',
  },
  {
    kind: 'balance',
    nombre: 'Estados contables',
    organismo: 'Sociedad / Registro Público',
    area: 'contabilidad',
    icon: '📚',
    critica: true,
    minigame: 'conciliacion',
    aplica: esSociedad,
    genera: (c, mes) => {
      const cierre = c.cierre ?? 12;
      const [y, m] = mes.split('-').map(Number);
      const mesCierre = m - 1 === 0 ? 12 : m - 1;
      return mesCierre === cierre ? String(m - 1 === 0 ? y - 1 : y) : null;
    },
    // 4 meses desde el cierre (plazo de aprobación de los EECC)
    vence: (c, p) => {
      const cierre = c.cierre ?? 12;
      const key = nextMonthKey(`${p}-${String(cierre).padStart(2, '0')}`, 4);
      const [y, m] = key.split('-').map(Number);
      return adjustToBusinessDay(ymd(y, m, lastDayOfMonth(y, m)));
    },
    horas: (c) => ({ recopilar: 2, carga: 8 * vol(c), liquidacion: 8 + 2 * vol(c), revision: 3, presentacion: 1 }),
    demoraDocs: 30,
    multa: () => 0,
    descripcion: 'Cierre de ejercicio: conciliaciones, ajustes, EECC según RT 54 y memoria.',
  },
  {
    kind: 'ganancias_soc',
    nombre: 'Ganancias Sociedades',
    organismo: 'ARCA',
    area: 'impuestos',
    icon: '🏢',
    critica: true,
    aplica: esSociedad,
    genera: (c, mes) => {
      const cierre = c.cierre ?? 12;
      const [y, m] = mes.split('-').map(Number);
      // se genera 2 meses después del cierre
      const key = nextMonthKey(`${y}-${String(m).padStart(2, '0')}`, -2);
      return Number(key.slice(5, 7)) === cierre ? key.slice(0, 4) : null;
    },
    vence: (c, p) => {
      const cierre = c.cierre ?? 12;
      const key = nextMonthKey(`${p}-${String(cierre).padStart(2, '0')}`, 5);
      const [y, m] = key.split('-').map(Number);
      return adjustToBusinessDay(ymd(y, m, pick(c, [13, 13, 13, 14, 14, 14, 15, 15, 15, 15])));
    },
    horas: (c) => ({ carga: 1.5, liquidacion: 4 + vol(c), revision: 1.5, presentacion: 0.8 }),
    demoraDocs: 0,
    multa: multaDDJJ,
    descripcion: 'Balance impositivo: ajustes al resultado contable, quebrantos y anticipos.',
  },
];

export const OBLIGACION: Record<string, ObligationTemplate> = Object.fromEntries(OBLIGACIONES.map((o) => [o.kind, o]));

/** Metadatos de tareas especiales (no periódicas) */
export const ESPECIALES: Partial<Record<ObligationKind, { nombre: string; area: Area; icon: string; critica: boolean; multa: (c: Client) => number }>> = {
  requerimiento: { nombre: 'Requerimiento ARCA', area: 'impuestos', icon: '🕵️', critica: true, multa: () => MULTA_REQUERIMIENTO },
  control: { nombre: 'Control de comprobantes', area: 'impuestos', icon: '🔎', critica: true, multa: () => 0 },
  rectificativa: { nombre: 'DDJJ rectificativa', area: 'impuestos', icon: '🩹', critica: true, multa: () => 0 },
  consulta: { nombre: 'Trabajo especial', area: 'impuestos', icon: '💼', critica: false, multa: () => 0 },
};

export function areaDe(kind: ObligationKind): Area {
  return OBLIGACION[kind]?.area ?? ESPECIALES[kind]?.area ?? 'impuestos';
}
export function iconDe(kind: ObligationKind): string {
  return OBLIGACION[kind]?.icon ?? ESPECIALES[kind]?.icon ?? '📄';
}
export function nombreDe(kind: ObligationKind): string {
  return OBLIGACION[kind]?.nombre ?? ESPECIALES[kind]?.nombre ?? kind;
}
export function esCritica(kind: ObligationKind): boolean {
  return OBLIGACION[kind]?.critica ?? ESPECIALES[kind]?.critica ?? false;
}
export function multaDe(kind: ObligationKind, c: Client): number {
  return OBLIGACION[kind]?.multa(c) ?? ESPECIALES[kind]?.multa(c) ?? 0;
}

const ORDEN: StepKind[] = ['recopilar', 'carga', 'liquidacion', 'revision', 'presentacion'];

export function buildSteps(horas: Partial<Record<StepKind, number>>): TaskStep[] {
  return ORDEN.filter((k) => (horas[k] ?? 0) > 0).map((k) => ({ kind: k, horasTotales: Math.round((horas[k] ?? 0) * FACTOR_HORAS * 10) / 10, horasHechas: 0 }));
}

/** Calcula cuándo llega la documentación del cliente (días hábiles desde hoy). */
export function calcularDocsLlegan(rng: Rng, c: Client, hoy: ISODate, vence: ISODate, demoraMax: number, factor = 1): ISODate {
  if (demoraMax <= 0 || c.propio) return hoy;
  const desorden = 1 - c.ordenDocumental;
  let dias = Math.round((1 + rng.next() * demoraMax * (0.25 + desorden * 1.1)) * factor);
  const margen = diffDays(vence, hoy);
  // los desordenados a veces traen todo sobre la hora (o tarde)
  if (desorden > 0.6 && rng.chance(0.35)) dias = Math.max(dias, Math.round(margen * 0.75));
  let llegan = addBusinessDays(hoy, Math.max(0, dias));
  if (llegan >= vence && !(desorden > 0.75 && rng.chance(0.25))) llegan = addBusinessDays(hoy, Math.max(0, Math.floor(margen * 0.6)));
  return llegan;
}

/** Genera las tareas del mes para un cliente. `dia` = undefined → las de inicio de mes; número → las de ese día de generación. */
export function generarTareasDelMes(rng: Rng, c: Client, mes: string, hoy: ISODate, nuevoId: () => string, docsFactor = 1, dia?: number): Task[] {
  const out: Task[] = [];
  for (const o of OBLIGACIONES) {
    if (!o.aplica(c)) continue;
    if (o.diaGeneracion !== dia) continue;
    const periodo = o.genera(c, mes);
    if (!periodo) continue;
    const vence = o.vence(c, periodo);
    if (vence < hoy) continue;
    const t: Task = {
      id: nuevoId(),
      clientId: c.id,
      kind: o.kind,
      periodo,
      titulo: `${o.nombre} ${periodoCorto(periodo)}`,
      vence,
      generada: hoy,
      docsLlegan: hoy,
      docsRecibidos: false,
      reclamos: 0,
      steps: buildSteps(o.horas(c)),
      stepIndex: 0,
      estado: 'pendiente',
      errores: 0,
      corregidos: 0,
      saltearRevision: false,
      vencida: false,
      minigame: o.minigame,
    };
    t.docsLlegan = calcularDocsLlegan(rng, c, hoy, vence, o.demoraDocs, docsFactor);
    t.docsRecibidos = t.docsLlegan <= hoy;
    if (t.steps[0]?.kind !== 'recopilar') t.docsRecibidos = true;
    out.push(t);
  }
  return out;
}

/** Horas mensuales promedio que demanda un cliente (para presupuestar). */
export function horasMensualesEstimadas(c: Client): number {
  let total = 0;
  for (const o of OBLIGACIONES) {
    if (!o.aplica(c)) continue;
    const h = Object.values(o.horas(c)).reduce((a, b) => a + (b ?? 0), 0) * FACTOR_HORAS;
    let veces = 12;
    if (o.kind === 'recategorizacion') veces = 2;
    if (['ganancias_ph', 'bienes_personales', 'balance', 'ganancias_soc'].includes(o.kind)) veces = 1;
    total += (h * veces) / 12;
  }
  return Math.round(total * 10) / 10;
}

export function horasRestantes(t: Task): number {
  return t.steps.slice(t.stepIndex).reduce((a, s) => a + (s.skipped ? 0 : Math.max(0, s.horasTotales - s.horasHechas)), 0);
}

export const mesDe = (d: ISODate) => `${year(d)}-${String(month(d)).padStart(2, '0')}`;
