// Selectores puros para el Tablero del titular: cumplimiento, capacidad, rentabilidad por cliente,
// flujo de fondos proyectado, riesgo profesional, equipo, resumen semanal e informe CSV.
import { addBusinessDays, addDays, adjustToBusinessDay, businessDaysBetween, day, diffDays, fechaAR, firstBusinessDayOfMonth, isBusinessDay, lastDayOfMonth, month, monthKey, nextMonthKey, nthBusinessDay, weekday, year, ymd } from './calendar';
import { honorarioReferencia } from './clients';
import { CARGAS_SOCIALES, COSTOS_FIJOS, IMPUESTOS_ESTUDIO, MARKETING, OFICINAS } from './config';
import { costoMensualHerramientas, costoSueldos, cuotaMonotributoPropia, deudaVencida } from './economy';
import { areaDe, horasMensualesEstimadas, horasRestantes, nombreDe } from './obligations';
import { cargaHoras } from './simulation';
import { TOOLS } from './tools';
import { RASGOS } from './traits';
import type { Area, Client, GameState, Task, Worker } from './types';
import { AREAS } from './types';

export type Semaforo = 'ok' | 'warn' | 'bad';
const TOOL_COSTO = new Map(TOOLS.map((t) => [t.id as string, t.costoMensual]));
const clientesActivos = (s: GameState) => s.clients.filter((c) => c.activo && !c.propio);
const pend = (s: GameState) => s.tasks.filter((t) => t.estado === 'pendiente');
const r1 = (n: number) => Math.round(n * 10) / 10;
export const corto = (n: string) => n.split(' (')[0];

/** Costos fijos mensuales del estudio (misma fórmula que la UI, sin depender de ella). */
export function costoMensualEstudio(s: GameState): number {
  if (s.estudio.real) return costoSueldos(s) + s.estudio.real.costosFijosMensuales;
  const i = s.inflacion.indice;
  const of = OFICINAS[s.estudio.oficina];
  return costoSueldos(s) + costoMensualHerramientas(s) + (of.alquiler + COSTOS_FIJOS.servicios * (1 + s.estudio.oficina * 0.6) + COSTOS_FIJOS.porPuesto * s.workers.length + COSTOS_FIJOS.cajaProfesional + MARKETING[s.estudio.marketing].costo) * i;
}
export const ingresosMensuales = (s: GameState) => clientesActivos(s).reduce((a, c) => a + c.honorario, 0);
/** Capacidad mensual del equipo en horas (≈ 20 días hábiles × 8 h × velocidad). */
export const capacidadMensual = (s: GameState) => s.workers.filter((w) => !w.renunciaEl).reduce((a, w) => a + 160 * w.velocidad, 0);
export const costoHora = (s: GameState) => costoMensualEstudio(s) / Math.max(1, capacidadMensual(s));

// ----------------------------------------------------------------------------- cumplimiento

export interface Cumplimiento {
  mes: string;
  enTermino: number;
  tarde: number;
  vencidasSinPresentar: number;
  pct: number; // 0..1
  semaforo: Semaforo;
  anterior: { mes: string; enTermino: number; tarde: number; pct: number };
  titularPendientes: Task[];
}

function cumplMes(s: GameState, mes: string) {
  const pres = s.tasks.filter((t) => t.presentadaEl?.startsWith(mes));
  const enTermino = pres.filter((t) => t.estado === 'presentada').length;
  const tarde = pres.length - enTermino;
  const vencidas = s.tasks.filter((t) => t.estado === 'pendiente' && t.vence < s.date && t.vence.startsWith(mes)).length;
  const total = pres.length + vencidas;
  return { enTermino, tarde, vencidas, pct: total ? enTermino / total : 1 };
}

export function cumplimiento(s: GameState): Cumplimiento {
  const mes = monthKey(s.date);
  const ant = nextMonthKey(mes, -1);
  const a = cumplMes(s, mes);
  const b = cumplMes(s, ant);
  return {
    mes,
    enTermino: a.enTermino,
    tarde: a.tarde,
    vencidasSinPresentar: a.vencidas,
    pct: a.pct,
    semaforo: a.pct >= 0.95 ? 'ok' : a.pct >= 0.8 ? 'warn' : 'bad',
    anterior: { mes: ant, enTermino: b.enTermino, tarde: b.tarde, pct: b.pct },
    titularPendientes: pend(s).filter((t) => t.requiereTitular && ['recopilar', 'carga', 'liquidacion'].includes(t.steps[t.stepIndex]?.kind ?? '')).sort((x, y) => (x.vence < y.vence ? -1 : 1)),
  };
}

// ----------------------------------------------------------------------------- capacidad 7 días

export interface Capacidad7 {
  hasta: string;
  horasPorArea: Record<Area, number>;
  horasTotal: number;
  capacidad: number;
  ratio: number;
  semaforo: Semaforo;
  personas: { id: string; nombre: string; carga: number; capacidad: number; ratio: number; semaforo: Semaforo }[];
}

export function capacidad7(s: GameState): Capacidad7 {
  const hasta = addBusinessDays(s.date, 7);
  const horasPorArea = { impuestos: 0, sueldos: 0, contabilidad: 0 } as Record<Area, number>;
  for (const t of pend(s)) if (t.vence <= hasta) horasPorArea[areaDe(t.kind)] += horasRestantes(t);
  const horasTotal = AREAS.reduce((a, k) => a + horasPorArea[k], 0);
  const activos = s.workers.filter((w) => !w.renunciaEl || w.renunciaEl > hasta);
  const personas = activos.map((w) => {
    const capacidad = Math.max(0, 7 * 8 * w.velocidad - w.ocupadoHoras);
    const carga = cargaHoras(s, w);
    const ratio = capacidad ? carga / capacidad : carga > 0 ? 9 : 0;
    return { id: w.id, nombre: w.id === 'player' ? 'Vos' : w.nombre, carga: r1(carga), capacidad: r1(capacidad), ratio, semaforo: (ratio > 1 ? 'bad' : ratio > 0.75 ? 'warn' : 'ok') as Semaforo };
  });
  const capacidad = personas.reduce((a, p) => a + p.capacidad, 0);
  const ratio = capacidad ? horasTotal / capacidad : horasTotal > 0 ? 9 : 0;
  return { hasta, horasPorArea, horasTotal: r1(horasTotal), capacidad: r1(capacidad), ratio, semaforo: ratio > 1 ? 'bad' : ratio > 0.75 ? 'warn' : 'ok', personas: personas.sort((a, b) => b.ratio - a.ratio) };
}

// ----------------------------------------------------------------------------- rentabilidad por cliente

export type Etiqueta = 'pierde plata' | 'desactualizado' | 'moroso' | 'riesgoso' | 'estrella';
export interface RentabilidadCliente {
  id: string;
  nombre: string;
  kind: Client['kind'];
  honorario: number;
  referencia: number;
  horasMes: number;
  horasPromedio: number;
  porHora: number;
  costoHora: number;
  margen: number; // honorario − horasPromedio × costoHora
  margenPct: number;
  atraso: number; // inflación acumulada desde la última actualización
  deuda: number;
  facturasVencidas: number;
  satisfaccion: number;
  erroresLatentes: number;
  riesgoFiscal: number;
  etiquetas: Etiqueta[];
}

export function rentabilidadClientes(s: GameState): RentabilidadCliente[] {
  const ch = costoHora(s);
  return clientesActivos(s)
    .map((c) => {
      const hc = s.horasCliente[c.id];
      const meses = Math.max(1, Math.round(diffDays(s.date, c.desde) / 30.4));
      const horasPromedio = hc && hc.total > 0 ? hc.total / meses : horasMensualesEstimadas(c);
      const horasMes = hc?.mes ?? 0;
      const porHora = c.honorario / Math.max(0.5, horasPromedio);
      const margen = c.honorario - horasPromedio * ch;
      const atraso = s.inflacion.indice / c.honorarioIndice - 1;
      const d = deudaVencida(s, c.id);
      const etiquetas: Etiqueta[] = [];
      if (margen < 0) etiquetas.push('pierde plata');
      if (atraso > 0.15) etiquetas.push('desactualizado');
      if (d.facturas >= 2) etiquetas.push('moroso');
      if (c.erroresLatentes.length >= 3 || c.riesgoFiscal >= 0.45) etiquetas.push('riesgoso');
      if (!etiquetas.length && c.satisfaccion >= 75 && margen > 0 && c.pagador > 0.6) etiquetas.push('estrella');
      return {
        id: c.id,
        nombre: corto(c.nombre),
        kind: c.kind,
        honorario: c.honorario,
        referencia: honorarioReferencia(c, s.inflacion.indice),
        horasMes: r1(horasMes),
        horasPromedio: r1(horasPromedio),
        porHora: Math.round(porHora),
        costoHora: Math.round(ch),
        margen: Math.round(margen),
        margenPct: c.honorario ? margen / c.honorario : 0,
        atraso,
        deuda: d.monto,
        facturasVencidas: d.facturas,
        satisfaccion: c.satisfaccion,
        erroresLatentes: c.erroresLatentes.length,
        riesgoFiscal: c.riesgoFiscal,
        etiquetas,
      };
    })
    .sort((a, b) => b.margen - a.margen);
}

// ----------------------------------------------------------------------------- flujo de fondos 90 días

export interface SemanaFlujo {
  semana: string; // fecha de inicio (lunes o día inicial)
  label: string;
  ingresos: number;
  egresos: number;
  saldo: number;
}
export interface FlujoFondos {
  semanas: SemanaFlujo[];
  minimo: { fecha: string; saldo: number };
  alerta: boolean;
  totalIngresos: number;
  totalEgresos: number;
  /** detalle para el informe */
  movimientos: { fecha: string; concepto: string; monto: number }[];
}

const diasPago = (p: number) => (p > 0.8 ? 4 : p > 0.55 ? 9 : p > 0.35 ? 20 : 38);

export function flujoFondos90(s: GameState): FlujoFondos {
  const movs: { fecha: string; concepto: string; monto: number }[] = [];
  const fin = addDays(s.date, 90);
  const i = s.inflacion.indice;
  const clientes = new Map(s.clients.map((c) => [c.id, c]));
  // facturas emitidas pendientes
  for (const inv of s.invoices) {
    if (inv.cobradaEl || inv.incobrable) continue;
    const c = clientes.get(inv.clientId);
    let f = inv.pagaEl;
    if (!f) {
      if (c && c.pagador < 0.3) continue; // probable incobrable
      f = addBusinessDays(inv.emitida, s.estudio.real ? s.estudio.real.diasCobro : diasPago(c?.pagador ?? 0.5));
    }
    if (f < s.date) f = addBusinessDays(s.date, 2);
    if (f <= fin) movs.push({ fecha: f, concepto: `Cobro ${inv.numero} · ${corto(c?.nombre ?? '')}`, monto: inv.monto });
  }
  // abonos futuros
  const actuales = clientesActivos(s);
  let mes = monthKey(s.date);
  const yaFact = s.estudio.facturasEmitidasMes === mes;
  for (let k = 0; k < 4; k++) {
    const emision = firstBusinessDayOfMonth(mes);
    if (!(k === 0 && yaFact) && emision >= s.date) {
      for (const c of actuales) {
        if (c.pagador < 0.3) continue;
        const f = addBusinessDays(emision, s.estudio.real ? s.estudio.real.diasCobro : diasPago(c.pagador));
        if (f <= fin) movs.push({ fecha: f, concepto: `Abono ${mes.slice(5)}/${mes.slice(0, 4)} · ${corto(c.nombre)}`, monto: c.honorario });
      }
    }
    mes = nextMonthKey(mes);
  }
  // egresos con fecha
  if (s.estudio.real) {
    for (const e of s.estudio.real.egresosProyectados) if (e.fecha >= s.date && e.fecha <= fin && e.monto > 0) movs.push({ fecha: e.fecha, concepto: e.concepto, monto: -Math.round(e.monto) });
  }
  const equipo = s.estudio.real ? [] : s.workers.filter((w) => w.id !== 'player');
  const bruto = equipo.reduce((a, w) => a + w.sueldo, 0);
  const of = OFICINAS[s.estudio.oficina];
  const software = s.tools.reduce((a, id) => a + Math.round(((TOOL_COSTO.get(id) ?? 0) * i) / 1000) * 1000, 0);
  let prestamos = s.estudio.prestamo?.restantes ?? 0;
  let m = monthKey(s.date);
  for (let k = 0; k < (s.estudio.real ? 0 : 4); k++) {
    const [y, mm] = m.split('-').map(Number);
    const enDia = (d: number) => adjustToBusinessDay(ymd(y, mm, Math.min(d, lastDayOfMonth(y, mm))));
    const push = (fecha: string, concepto: string, monto: number) => {
      if (monto > 0 && fecha >= s.date && fecha <= fin) movs.push({ fecha, concepto, monto: -Math.round(monto) });
    };
    const primero = firstBusinessDayOfMonth(m);
    push(primero, 'Software y suscripciones', software);
    push(primero, `Marketing: ${MARKETING[s.estudio.marketing].nombre}`, MARKETING[s.estudio.marketing].costo * i);
    if (prestamos > 0 && s.estudio.prestamo && primero >= s.date) {
      push(primero, 'Cuota préstamo', s.estudio.prestamo.cuota);
      prestamos -= 1;
    }
    push(nthBusinessDay(y, mm, 4), `Sueldos y cargas (${equipo.length})`, bruto * (1 + CARGAS_SOCIALES));
    if (mm === 6) push(enDia(30), 'Aguinaldo (SAC)', (bruto / 2) * (1 + CARGAS_SOCIALES));
    if (mm === 12) push(enDia(18), 'Aguinaldo (SAC)', (bruto / 2) * (1 + CARGAS_SOCIALES));
    push(enDia(10), 'Alquiler, servicios e insumos', (of.alquiler + COSTOS_FIJOS.servicios * (1 + s.estudio.oficina * 0.6) + COSTOS_FIJOS.porPuesto * s.workers.length) * i);
    push(enDia(15), 'Caja profesional', COSTOS_FIJOS.cajaProfesional * i);
    if (mm === 3) push(enDia(15), 'Matrícula CPCE', COSTOS_FIJOS.matriculaAnual * i);
    if (s.estudio.condicion === 'monotributista') push(enDia(20), 'Monotributo del estudio', cuotaMonotributoPropia(s));
    else push(enDia(20), 'IVA, IIBB y anticipos del estudio', ingresosMensuales(s) * IMPUESTOS_ESTUDIO.riSobreFacturado);
    m = nextMonthKey(m);
  }
  movs.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
  // agrupar por semana (desde hoy, bloques de 7 días)
  const semanas: SemanaFlujo[] = [];
  let saldo = s.estudio.caja;
  let minimo = { fecha: s.date, saldo };
  for (let w = 0; w < 13; w++) {
    const ini = addDays(s.date, w * 7);
    const finS = addDays(s.date, w * 7 + 6);
    let ingresos = 0;
    let egresos = 0;
    for (const mv of movs) {
      if (mv.fecha < ini || mv.fecha > finS) continue;
      if (mv.monto > 0) ingresos += mv.monto;
      else egresos += -mv.monto;
    }
    saldo += ingresos - egresos;
    if (saldo < minimo.saldo) minimo = { fecha: finS, saldo };
    semanas.push({ semana: ini, label: `${day(ini)}/${String(month(ini)).padStart(2, '0')}`, ingresos: Math.round(ingresos), egresos: Math.round(egresos), saldo: Math.round(saldo) });
  }
  return {
    semanas,
    minimo: { fecha: minimo.fecha, saldo: Math.round(minimo.saldo) },
    alerta: minimo.saldo < 0,
    totalIngresos: semanas.reduce((a, x) => a + x.ingresos, 0),
    totalEgresos: semanas.reduce((a, x) => a + x.egresos, 0),
    movimientos: movs,
  };
}


// ----------------------------------------------------------------------------- riesgo profesional

export interface RiesgoProfesional {
  indice: number; // 0..100
  semaforo: Semaforo;
  erroresPonderados: number;
  topClientes: { id: string; nombre: string; errores: number; gravedad: number; riesgoFiscal: number; puntaje: number }[];
  controlesPendientes: Task[];
  titularPendientes: Task[];
  faltasEticas: number;
  estresTitular: number;
  detalle: string[];
}

export function riesgoProfesional(s: GameState): RiesgoProfesional {
  const cs = clientesActivos(s);
  const topClientes = cs
    .map((c) => {
      const gravedad = c.erroresLatentes.reduce((a, e) => a + e.gravedad, 0);
      return { id: c.id, nombre: corto(c.nombre), errores: c.erroresLatentes.length, gravedad, riesgoFiscal: c.riesgoFiscal, puntaje: gravedad * 2 + c.riesgoFiscal * 10 };
    })
    .filter((x) => x.puntaje > 0)
    .sort((a, b) => b.puntaje - a.puntaje)
    .slice(0, 5);
  const erroresPonderados = cs.reduce((a, c) => a + c.erroresLatentes.reduce((b, e) => b + e.gravedad, 0), 0);
  const controlesPendientes = pend(s).filter((t) => t.kind === 'control');
  const titularPendientes = pend(s).filter((t) => t.requiereTitular && ['recopilar', 'carga', 'liquidacion'].includes(t.steps[t.stepIndex]?.kind ?? '')).sort((a, b) => (a.vence < b.vence ? -1 : 1));
  const p = s.workers.find((w) => w.id === 'player');
  const estres = p?.estres ?? 0;
  const vencidas = pend(s).filter((t) => t.vence < s.date).length;
  let indice = 0;
  indice += Math.min(40, erroresPonderados * 3);
  indice += Math.min(15, controlesPendientes.length * 7);
  indice += Math.min(15, titularPendientes.filter((t) => businessDaysBetween(s.date, t.vence) <= 3).length * 7);
  indice += Math.min(10, vencidas * 3);
  indice += Math.min(15, s.estudio.faltasEticas * 8);
  indice += estres > 85 ? 5 : 0;
  indice = Math.round(Math.min(100, indice));
  const detalle: string[] = [];
  if (erroresPonderados) detalle.push(`${erroresPonderados} puntos de errores latentes en ${cs.filter((c) => c.erroresLatentes.length).length} clientes`);
  if (controlesPendientes.length) detalle.push(`${controlesPendientes.length} control/es de comprobantes sin hacer`);
  if (vencidas) detalle.push(`${vencidas} obligación/es vencidas sin presentar`);
  if (s.estudio.faltasEticas) detalle.push(`${s.estudio.faltasEticas} falta/s ética/s: la matrícula está en juego`);
  if (estres > 85) detalle.push('Titular al límite de estrés: más errores');
  return { indice, semaforo: indice < 25 ? 'ok' : indice < 55 ? 'warn' : 'bad', erroresPonderados, topClientes, controlesPendientes, titularPendientes, faltasEticas: s.estudio.faltasEticas, estresTitular: estres, detalle };
}

// ----------------------------------------------------------------------------- equipo

export interface PersonaResumen {
  id: string;
  nombre: string;
  role: Worker['role'];
  carga: number;
  capacidadSemanal: number;
  ratio: number;
  estres: number;
  moral: number;
  costo: number;
  horasExtraMes: number;
  horasMes: number;
  rasgo?: { icon: string; nombre: string };
  skillProm: number;
  semaforo: Semaforo;
}
export interface EquipoResumen {
  personas: PersonaResumen[];
  sueldosSobreIngresos: number;
  sano: boolean;
  aprendiendo?: { id: string; nombre: string };
  costoLaboralMensual: number;
}

export function equipoResumen(s: GameState): EquipoResumen {
  const personas = s.workers.map((w) => {
    const carga = cargaHoras(s, w);
    const capacidadSemanal = Math.max(0, 5 * 8 * w.velocidad - w.ocupadoHoras);
    const ratio = capacidadSemanal ? carga / capacidadSemanal : carga > 0 ? 9 : 0;
    const skillProm = AREAS.reduce((a, k) => a + w.skills[k], 0) / 3;
    return {
      id: w.id,
      nombre: w.id === 'player' ? `${w.nombre} (vos)` : w.nombre,
      role: w.role,
      carga: r1(carga),
      capacidadSemanal: r1(capacidadSemanal),
      ratio,
      estres: Math.round(w.estres),
      moral: Math.round(w.moral),
      costo: Math.round(w.sueldo * (1 + CARGAS_SOCIALES)),
      horasExtraMes: w.horasExtraMes,
      horasMes: w.horasMes,
      rasgo: w.rasgo ? { icon: RASGOS[w.rasgo].icon, nombre: RASGOS[w.rasgo].nombre } : undefined,
      skillProm,
      semaforo: (w.estres > 80 || ratio > 1.2 ? 'bad' : w.estres > 60 || ratio > 0.85 || w.moral < 35 ? 'warn' : 'ok') as Semaforo,
    };
  });
  const ingresos = ingresosMensuales(s);
  const costoLaboralMensual = costoSueldos(s);
  const ratio = ingresos ? costoLaboralMensual / ingresos : costoLaboralMensual > 0 ? 9 : 0;
  // quién aprende más: el de menor skill promedio con el rasgo aprendiz primero
  const emp = personas.filter((p) => p.id !== 'player');
  const ap = s.workers.find((w) => w.rasgo === 'aprendiz' && w.id !== 'player');
  const menor = emp.sort((a, b) => a.skillProm - b.skillProm)[0];
  const aprendiendo = ap ? { id: ap.id, nombre: ap.nombre } : menor ? { id: menor.id, nombre: menor.nombre } : undefined;
  return { personas: personas.sort((a, b) => (a.id === 'player' ? -1 : b.id === 'player' ? 1 : b.ratio - a.ratio)), sueldosSobreIngresos: ratio, sano: ratio < 0.45, aprendiendo, costoLaboralMensual: Math.round(costoLaboralMensual) };
}

// ----------------------------------------------------------------------------- resumen de la semana (reunión de lunes)

export interface ResumenSemana {
  desde: string;
  hasta: string;
  vencimientosPorDia: { fecha: string; tareas: Task[] }[];
  cobrosEsperados: number;
  pagosSemana: { fecha: string; concepto: string; monto: number }[];
  prospectosPorVencer: { id: string; nombre: string; expira: string }[];
  titularPendientes: Task[];
  horasPendientes: number;
  capacidad: number;
}

export function resumenSemana(s: GameState): ResumenSemana {
  // semana laboral: desde hoy hasta el próximo viernes (o 5 días hábiles)
  const desde = s.date;
  let hasta = desde;
  for (let i = 0; i < 7; i++) {
    const d = addDays(desde, i);
    if (weekday(d) === 5) {
      hasta = d;
      break;
    }
    hasta = d;
  }
  if (hasta < addBusinessDays(desde, 1)) hasta = addBusinessDays(desde, 4);
  const dias: { fecha: string; tareas: Task[] }[] = [];
  for (let d = desde; d <= hasta; d = addDays(d, 1)) {
    if (!isBusinessDay(d)) continue;
    const tareas = pend(s).filter((t) => t.vence === d);
    if (tareas.length) dias.push({ fecha: d, tareas });
  }
  const flujo = flujoFondos90(s);
  const enSemana = flujo.movimientos.filter((m) => m.fecha >= desde && m.fecha <= hasta);
  const horasPendientes = pend(s).filter((t) => t.vence <= hasta).reduce((a, t) => a + horasRestantes(t), 0);
  const capacidad = s.workers.reduce((a, w) => a + Math.max(0, Math.max(1, businessDaysBetween(desde, hasta) + 1) * 8 * w.velocidad - w.ocupadoHoras), 0);
  return {
    desde,
    hasta,
    vencimientosPorDia: dias,
    cobrosEsperados: enSemana.filter((m) => m.monto > 0).reduce((a, m) => a + m.monto, 0),
    pagosSemana: enSemana.filter((m) => m.monto < 0),
    prospectosPorVencer: s.prospects.filter((p) => p.expira <= hasta).map((p) => ({ id: p.id, nombre: corto(p.client.nombre), expira: p.expira })),
    titularPendientes: pend(s).filter((t) => t.requiereTitular && t.vence <= addBusinessDays(hasta, 3) && ['recopilar', 'carga', 'liquidacion'].includes(t.steps[t.stepIndex]?.kind ?? '')),
    horasPendientes: r1(horasPendientes),
    capacidad: r1(capacidad),
  };
}

// ----------------------------------------------------------------------------- informe CSV

const num = (n: number, d = 0) => n.toFixed(d).replace('.', ',');
const esc = (v: string | number) => {
  const t = String(v).replace(/"/g, '""');
  return /[;"\n]/.test(t) ? `"${t}"` : t;
};
const fila = (...cols: (string | number)[]) => cols.map(esc).join(';');

export function informeMensualCSV(s: GameState): string {
  const L: string[] = [];
  const c = cumplimiento(s);
  const cap = capacidad7(s);
  const rc = rentabilidadClientes(s);
  const fl = flujoFondos90(s);
  const rp = riesgoProfesional(s);
  const eq = equipoResumen(s);
  L.push(fila('PARTIDA DOBLE · Informe del titular'), fila('Estudio', s.estudio.nombre), fila('Fecha', fechaAR(s.date)), fila('Nivel', s.estudio.nivel), '');
  L.push(fila('RESUMEN'));
  L.push(fila('Caja', num(s.estudio.caja)));
  L.push(fila('Mínimo proyectado 90 días', num(fl.minimo.saldo)), fila('Fecha del mínimo', fechaAR(fl.minimo.fecha)));
  L.push(fila('Abonos mensuales', num(ingresosMensuales(s))), fila('Costos fijos mensuales', num(costoMensualEstudio(s))));
  L.push(fila('Costo hora del estudio', num(costoHora(s))), fila('Reputación', num(s.estudio.reputacion, 1)), fila('Índice de riesgo', rp.indice), fila('Clientes activos', rc.length), '');
  L.push(fila('CUMPLIMIENTO'), fila('Mes', 'En término', 'Tarde', 'Vencidas sin presentar', '% en término'));
  L.push(fila(c.mes, c.enTermino, c.tarde, c.vencidasSinPresentar, num(c.pct * 100, 1)));
  L.push(fila(c.anterior.mes, c.anterior.enTermino, c.anterior.tarde, '', num(c.anterior.pct * 100, 1)));
  L.push(fila('Horas pendientes 7 días', num(cap.horasTotal, 1)), fila('Capacidad 7 días', num(cap.capacidad, 1)), '');
  L.push(fila('CLIENTES'), fila('Cliente', 'Tipo', 'Abono', 'Referencia', 'Horas/mes', '$/hora', 'Margen', 'Atraso %', 'Deuda vencida', 'Satisfacción', 'Errores latentes', 'Etiquetas'));
  for (const r of rc) L.push(fila(r.nombre, r.kind, num(r.honorario), num(r.referencia), num(r.horasPromedio, 1), num(r.porHora), num(r.margen), num(r.atraso * 100, 1), num(r.deuda), num(r.satisfaccion), r.erroresLatentes, r.etiquetas.join(', ')));
  L.push('');
  L.push(fila('FLUJO DE FONDOS 90 DÍAS'), fila('Semana', 'Ingresos', 'Egresos', 'Saldo'));
  for (const w of fl.semanas) L.push(fila(fechaAR(w.semana), num(w.ingresos), num(w.egresos), num(w.saldo)));
  L.push('');
  L.push(fila('EQUIPO'), fila('Persona', 'Rol', 'Carga h', 'Capacidad semanal h', 'Estrés', 'Moral', 'Costo laboral', 'Horas extra mes', 'Rasgo'));
  for (const p of eq.personas) L.push(fila(p.nombre, p.role, num(p.carga, 1), num(p.capacidadSemanal, 1), p.estres, p.moral, num(p.costo), p.horasExtraMes, p.rasgo?.nombre ?? ''));
  L.push(fila('Sueldos / ingresos', num(eq.sueldosSobreIngresos * 100, 1) + '%'));
  L.push('');
  L.push(fila('RIESGO'), ...rp.detalle.map((d) => fila(d)));
  for (const t of rp.titularPendientes) L.push(fila('Obligatoria del titular', `${nombreDe(t.kind)} ${t.periodo}`, fechaAR(t.vence)));
  return L.join('\n');
}

export const mesLabel = (m: string) => `${m.slice(5)}/${m.slice(0, 4)}`;
export const anioMes = (s: GameState) => `${year(s.date)}-${String(month(s.date)).padStart(2, '0')}`;
