// Adapta los datos reales del estudio a un GameState coherente, para reutilizar el Tablero y
// los selectores de analytics del juego sin cambios.
import { addDays, adjustToBusinessDay, lastDayOfMonth, monthKey, nextMonthKey, ymd } from '../engine/calendar';
import { CARGAS_SOCIALES } from '../engine/config';
import { avatar } from '../engine/names';
import { newGame } from '../engine/newGame';
import { hashSeed, makeRng } from '../engine/rng';
import type { Client, GameState, Invoice, ISODate, LedgerEntry, ObligationKind, Task, Worker } from '../engine/types';
import type { RealData, RPersona } from './model';

const IMPUESTO_KIND: Record<string, ObligationKind> = {
  IVA: 'iva',
  IIBB: 'iibb',
  Sueldos: 'sueldos',
  'F.931': 'f931',
  Monotributo: 'monotributo',
  Recategorización: 'recategorizacion',
  'Ganancias PH': 'ganancias_ph',
  'Bienes Personales': 'bienes_personales',
  'Ganancias Soc.': 'ganancias_soc',
  Balance: 'balance',
  Registración: 'registracion',
  Otro: 'consulta',
};
export const kindDe = (impuesto: string): ObligationKind => IMPUESTO_KIND[impuesto] ?? 'consulta';

const RIESGO_FISCAL = { bajo: 0.08, medio: 0.3, alto: 0.6 } as const;

function mesesEntre(a: ISODate, b: ISODate): number {
  const [ya, ma] = a.split('-').map(Number);
  const [yb, mb] = b.split('-').map(Number);
  return Math.max(0, (yb - ya) * 12 + (mb - ma));
}

export function workerDe(p: RPersona, deskIndex: number, hoy: ISODate): Worker {
  const sueldo = p.rol === 'titular' ? 0 : Math.round(p.costoMensual / (1 + CARGAS_SOCIALES));
  return {
    id: p.rol === 'titular' ? 'player' : p.id,
    nombre: p.nombre,
    role: p.rol,
    skills: { impuestos: 60, sueldos: 60, contabilidad: 60 },
    velocidad: Math.max(0.1, (p.horasSemanales || 40) / 40),
    sueldo,
    moral: 75,
    estres: 20,
    queue: [],
    horasExtra: false,
    contratadoEl: hoy,
    avatar: avatar(makeRng(hashSeed(p.id))),
    deskIndex,
    status: 'trabajando',
    statusText: '',
    ocupadoHoras: 0,
    horasMes: 0,
    horasExtraMes: 0,
  };
}

/** Egresos proyectados a 90 días a partir de gastos recurrentes (día del mes) y gastos futuros cargados. */
export function egresosProyectados(d: RealData, hoy: ISODate): { fecha: ISODate; concepto: string; monto: number }[] {
  const out: { fecha: ISODate; concepto: string; monto: number }[] = [];
  const fin = addDays(hoy, 90);
  let m = monthKey(hoy);
  for (let k = 0; k < 4; k++) {
    const [y, mm] = m.split('-').map(Number);
    for (const g of d.gastos) {
      if (!g.recurrente) continue;
      const dia = Math.min(Math.max(1, g.diaDelMes || Number(g.fecha.slice(8)) || 10), lastDayOfMonth(y, mm));
      const f = adjustToBusinessDay(ymd(y, mm, dia));
      if (f >= hoy && f <= fin) out.push({ fecha: f, concepto: g.concepto, monto: g.monto });
    }
    m = nextMonthKey(m);
  }
  for (const g of d.gastos) if (!g.recurrente && g.fecha > hoy && g.fecha <= fin) out.push({ fecha: g.fecha, concepto: g.concepto, monto: g.monto });
  // SAC del equipo (junio y diciembre) si hay costo de equipo cargado como recurrente de sueldos no hace falta duplicar
  return out.sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
}

export function toGameState(d: RealData, hoy: ISODate): GameState {
  const base = newGame({ nombreEstudio: d.config.nombreEstudio || 'Estudio', titular: d.config.titular || 'Titular', especialidad: 'impuestos', dificultad: 'normal', seed: 7 });
  const infl = Math.max(0, d.config.inflacionMensualEstimada || 0);
  const equipoActivo = d.equipo.filter((p) => p.activo);
  const workers: Worker[] = equipoActivo.map((p, i) => workerDe(p, i, hoy));
  if (!workers.some((w) => w.id === 'player')) {
    workers.unshift({ ...workerDe({ id: 'player', nombre: d.config.titular || 'Titular', rol: 'titular', costoMensual: 0, horasSemanales: 40, activo: true }, 0, hoy), id: 'player' });
  }
  const idEquipo = (id: string) => (equipoActivo.find((p) => p.id === id)?.rol === 'titular' ? 'player' : workers.some((w) => w.id === id) ? id : undefined);

  const clients: Client[] = d.clientes.map((c) => {
    const meses = mesesEntre(c.honorarioActualizadoEl || hoy, hoy);
    const riesgo = RIESGO_FISCAL[c.riesgo] ?? 0.1;
    const errores = c.riesgo === 'alto' ? 3 : c.riesgo === 'medio' ? 1 : 0;
    const kind = c.tipo === 'otro' ? 'ri_persona' : c.tipo;
    return {
      id: c.id,
      nombre: c.razonSocial,
      cuit: c.cuit || '00-00000000-0',
      kind,
      rubro: 'servicios',
      jurisdiccion: c.jurisdiccion,
      empleados: c.empleados || 0,
      volumen: 80,
      ordenDocumental: 0.6,
      pagador: 0.7,
      honorario: c.honorarioMensual || 0,
      honorarioActualizadoEl: c.honorarioActualizadoEl || hoy,
      // el índice de hoy es 1; el abono se fijó hace `meses` → índice de entonces = 1/(1+infl)^meses
      honorarioIndice: 1 / Math.pow(1 + infl, meses),
      satisfaccion: c.riesgo === 'alto' ? 55 : 75,
      desde: hoy,
      riesgoFiscal: riesgo,
      erroresLatentes: Array.from({ length: errores }, (_, i) => ({ taskId: 'real', kind: 'iva' as const, periodo: hoy.slice(0, 7), gravedad: (i === 0 ? 2 : 1) as 1 | 2 | 3, desde: hoy })),
      avatar: avatar(makeRng(hashSeed(c.id))),
      activo: c.estado === 'activo',
      bajaEl: c.estado === 'baja' ? hoy : undefined,
    };
  });

  const tasks: Task[] = d.vencimientos
    .filter((v) => clients.some((c) => c.id === v.clienteId))
    .map((v) => {
      const horas = Math.max(0.1, v.horasEstimadas || 1);
      const hecha = v.estado !== 'pendiente';
      return {
        id: v.id,
        clientId: v.clienteId,
        kind: kindDe(v.impuesto),
        periodo: v.periodo || v.vence.slice(0, 7),
        titulo: `${v.impuesto} ${v.periodo || ''}`.trim(),
        vence: v.vence,
        generada: v.vence,
        docsLlegan: hoy,
        docsRecibidos: true,
        reclamos: 0,
        steps: [{ kind: 'liquidacion', horasTotales: horas, horasHechas: hecha ? horas : 0 }],
        stepIndex: hecha ? 1 : 0,
        estado: v.estado,
        asignadoA: idEquipo(v.responsable),
        errores: 0,
        corregidos: 0,
        saltearRevision: true,
        presentadaEl: hecha ? v.presentadaEl || v.vence : undefined,
        vencida: !hecha && v.vence < hoy,
      };
    });
  for (const w of workers) w.queue = tasks.filter((t) => t.estado === 'pendiente' && t.asignadoA === w.id).map((t) => t.id);

  const invoices: Invoice[] = d.facturas
    .filter((f) => clients.some((c) => c.id === f.clienteId))
    .map((f, i) => ({
      id: f.id,
      numero: f.numero || `F-${i + 1}`,
      clientId: f.clienteId,
      periodo: f.emitida.slice(0, 7),
      concepto: f.concepto,
      monto: f.monto,
      emitida: f.emitida,
      vence: f.vence || f.emitida,
      pagaEl: f.estado === 'pendiente' ? (f.vence && f.vence >= hoy ? f.vence : undefined) : undefined,
      cobradaEl: f.estado === 'cobrada' ? f.cobradaEl || f.vence || f.emitida : undefined,
      incobrable: f.estado === 'incobrable',
    }));

  const ledger: LedgerEntry[] = [
    ...d.cobros.map((c) => ({ id: c.id, date: c.fecha, concepto: `Cobro · ${d.clientes.find((x) => x.id === c.clienteId)?.razonSocial ?? ''}`, monto: c.monto, categoria: 'honorarios' as const })),
    ...d.gastos.filter((g) => !g.recurrente || g.fecha <= hoy).map((g) => ({ id: g.id, date: g.fecha, concepto: g.concepto, monto: -g.monto, categoria: g.categoria })),
  ].sort((a, b) => (a.date < b.date ? -1 : 1));

  const horasCliente: GameState['horasCliente'] = {};
  const mesActual = hoy.slice(0, 7);
  for (const h of d.horas) {
    const hc = (horasCliente[h.clienteId] ??= { total: 0, mes: 0 });
    hc.total += h.horas;
    if (h.fecha.startsWith(mesActual)) hc.mes += h.horas;
  }
  for (const w of workers) w.horasMes = d.horas.filter((h) => h.fecha.startsWith(mesActual) && (h.colaborador === w.id || (w.id === 'player' && equipoActivo.find((p) => p.id === h.colaborador)?.rol === 'titular'))).reduce((a, h) => a + h.horas, 0);

  // caja hoy = caja declarada + movimientos posteriores a esa fecha
  const desdeCaja = d.config.cajaHoyFecha || hoy;
  const caja = (d.config.cajaHoy || 0) + ledger.filter((l) => l.date > desdeCaja && l.date <= hoy).reduce((a, l) => a + l.monto, 0);

  // resumen mensual últimos 12 meses
  const monthly: GameState['monthly'] = [];
  let m = nextMonthKey(mesActual, -11);
  for (let k = 0; k < 12; k++) {
    const fact = invoices.filter((i) => i.emitida.startsWith(m)).reduce((a, i) => a + i.monto, 0);
    const cob = d.cobros.filter((c) => c.fecha.startsWith(m)).reduce((a, c) => a + c.monto, 0);
    const egr = d.gastos.filter((g) => g.fecha.startsWith(m) && (!g.recurrente || g.fecha <= hoy)).reduce((a, g) => a + g.monto, 0);
    const pres = tasks.filter((t) => t.presentadaEl?.startsWith(m));
    monthly.push({ mes: m, facturado: fact, cobrado: cob, egresos: egr, multas: 0, resultado: cob - egr, caja: 0, clientes: clients.filter((c) => c.activo).length, reputacion: 0, presentadasATiempo: pres.filter((t) => t.estado === 'presentada').length, presentadasTarde: pres.filter((t) => t.estado === 'presentada_tarde').length });
    m = nextMonthKey(m);
  }

  // racha: presentaciones en término consecutivas (ordenadas por fecha de presentación)
  const pres = tasks.filter((t) => t.presentadaEl).sort((a, b) => ((a.presentadaEl ?? '') < (b.presentadaEl ?? '') ? -1 : 1));
  let racha = 0;
  let mejor = 0;
  for (const t of pres) {
    racha = t.estado === 'presentada' ? racha + 1 : 0;
    mejor = Math.max(mejor, racha);
  }

  // costos fijos reales = gastos recurrentes que no son sueldos/cargas (eso va por el equipo)
  const costosFijos = d.gastos.filter((g) => g.recurrente && g.categoria !== 'sueldos' && g.categoria !== 'cargas_sociales').reduce((a, g) => a + g.monto, 0);
  const sueldosRecurrentes = d.gastos.filter((g) => g.recurrente && (g.categoria === 'sueldos' || g.categoria === 'cargas_sociales')).reduce((a, g) => a + g.monto, 0);
  const egresos = egresosProyectados(d, hoy);
  // si no cargó sueldos como gasto recurrente, proyectar el costo del equipo el 4º día hábil
  if (sueldosRecurrentes === 0) {
    const costoEquipo = equipoActivo.filter((p) => p.rol !== 'titular').reduce((a, p) => a + (p.costoMensual || 0), 0);
    if (costoEquipo > 0) {
      let mm = mesActual;
      for (let k = 0; k < 4; k++) {
        const [y, mo] = mm.split('-').map(Number);
        const f = adjustToBusinessDay(ymd(y, mo, 4));
        if (f >= hoy && f <= addDays(hoy, 90)) egresos.push({ fecha: f, concepto: 'Sueldos y cargas del equipo', monto: costoEquipo });
        mm = nextMonthKey(mm);
      }
    }
  }

  const activos = clients.filter((c) => c.activo).length;
  return {
    ...base,
    date: hoy,
    hour: 9,
    speed: 0,
    estudio: {
      ...base.estudio,
      nombre: d.config.nombreEstudio || 'Estudio',
      titular: d.config.titular || 'Titular',
      caja,
      reputacion: 70,
      nivel: activos >= 40 ? 5 : activos >= 25 ? 4 : activos >= 14 ? 3 : activos >= 7 ? 2 : 1,
      oficina: 0,
      marketing: 0,
      condicion: 'ri',
      facturasEmitidasMes: invoices.some((i) => i.emitida.startsWith(mesActual)) ? mesActual : undefined,
      inicio: hoy,
      real: { costosFijosMensuales: costosFijos, egresosProyectados: egresos.sort((a, b) => (a.fecha < b.fecha ? -1 : 1)), diasCobro: Math.max(0, d.config.diasCobro || 0) },
    },
    clients,
    workers,
    candidates: [],
    tasks,
    prospects: [],
    tools: [],
    ledger,
    invoices,
    monthly,
    inbox: [],
    events: [],
    flags: { arcaCaida: false, corteLuz: false, prorroga: false },
    inflacion: { mensual: infl, indice: 1, historia: [] },
    fx: [],
    fxSeq: 0,
    stats: { ...base.stats, presentadasATiempo: pres.filter((t) => t.estado === 'presentada').length, presentadasTarde: pres.filter((t) => t.estado === 'presentada_tarde').length, mejorCaja: caja },
    tutorial: [],
    progreso: { misiones: [], logros: [], racha, mejorRacha: mejor, notas: [], relampagoMejor: 0 },
    horasCliente,
    objetivos: d.objetivos,
    dialogo: undefined,
    gameOver: undefined,
  };
}
