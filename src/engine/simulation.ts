// Motor de simulación: avanza el reloj hora por hora, hace trabajar al equipo, procesa
// vencimientos, cobranzas, gastos, eventos y el ciclo mensual.
import { addBusinessDays, adjustToBusinessDay, businessDaysBetween, diffDays, month, monthKey, nextBusinessDay, year, ymd } from './calendar';
import { CARGAS_SOCIALES, DIFICULTAD, HORAS_MES, HORA_FIN, HORA_FIN_EXTRA, HORA_INICIO, MARKETING, MONOTRIBUTO_CATEGORIAS, NIVELES, RECARGO_HORA_EXTRA } from './config';
import {
  ajustarReputacion,
  ajustarSatisfaccion,
  clientesActivos,
  cliente,
  estudioPropio,
  fx,
  msg,
  nid,
  nivelCalculado,
  precio,
  quitarDeColas,
  tarea,
} from './core';
import { generarProspecto, honorarioReferencia } from './clients';
import { actualizarInflacion, deudaVencida, emitirAbonos, emitirFactura, facturadoUltimos12, procesarCobranzas, procesarGastosDelDia, resumirMes } from './economy';
import {
  cerrarInspeccion,
  darDeBaja,
  eventoErrorDescubierto,
  eventoInfo,
  eventoInspeccion,
  eventoMoroso,
  eventoMultas,
  eventoParitarias,
  eventoRenuncia,
  eventoVacaciones,
  lanzarEvento,
  registrarIncorporarCartera,
  sortearEventoDiario,
} from './events';
import { money } from './format';
import { OBLIGACIONES, areaDe, esCritica, generarTareasDelMes, horasRestantes, multaDe } from './obligations';
import { generarCliente } from './clients';
import { makeRng, type Rng } from './rng';
import { eficiencia, factorEstres, factorXp, generarCandidatos, probDeteccion, probError } from './staff';
import { calcularNota, evaluarProgresion, NOTA_TEXTO, registrarPresentacion } from './progression';
import { RASGOS } from './traits';
import { asignarObligatoriasDelMes, bloqueoTitular, cerrarControl, vencerControl } from './titular';
import { generarProspecto as genProspectoChusma } from './clients';
import { hasEspecial, toolMods } from './tools';
import type { GameState, Task, Worker } from './types';
import { STEP_LABEL } from './types';

const corto = (n: string) => n.split(' (')[0];
const PASO_CORTO: Record<string, string> = { recopilar: 'Ordenando papeles', carga: 'Cargando', liquidacion: 'Liquidando', revision: 'Revisando', presentacion: 'Presentando' };

/** Hora en que termina la jornada (con horas extra si alguien las tiene habilitadas). */
export const finJornada = (s: GameState) => (s.workers.some((w) => w.horasExtra) ? HORA_FIN_EXTRA : HORA_FIN);

/** Avanza una hora de juego. */
export function tick(s: GameState): void {
  if (s.gameOver) return;
  const rng = makeRng(s.rngState);
  s.tick += 1;
  if (s.hour >= finJornada(s)) cerrarDia(s, rng);
  else {
    simularHora(s, rng);
    s.hour += 1;
  }
  evaluarProgresion(s);
  s.rngState = rng.state();
}

// ----------------------------------------------------------------------------- trabajo por hora

function simularHora(s: GameState, rng: Rng): void {
  const h = s.hour;
  const sinLuz = s.flags.corteLuz && !hasEspecial(s.tools, 'ups');
  for (const w of s.workers) {
    w.currentTaskId = undefined;
    if (w.ocupadoHoras > 0) {
      w.ocupadoHoras = Math.max(0, w.ocupadoHoras - 1);
      continue;
    }
    if (h >= HORA_FIN && !w.horasExtra) {
      w.status = 'descansando';
      w.statusText = 'Ya se fue a casa';
      continue;
    }
    if (h === 13) {
      w.status = 'descansando';
      w.statusText = 'Almorzando 🥪';
      w.estres = Math.max(0, w.estres - 2);
      continue;
    }
    if (sinLuz) {
      w.status = 'esperando';
      w.statusText = 'Sin luz... ⚡';
      continue;
    }
    if (w.estres >= 100) {
      w.status = 'agotado';
      w.statusText = 'Quemado/a. Necesita descansar';
      w.estres -= 4;
      continue;
    }
    const t = elegirTarea(s, w);
    if (!t) {
      ocioso(s, w);
      continue;
    }
    trabajar(s, rng, w, t, h >= HORA_FIN);
  }
}

function bloqueo(s: GameState, t: Task): string | null {
  const step = t.steps[t.stepIndex];
  if (!step) return 'sin pasos';
  if (step.kind === 'recopilar' && !t.docsRecibidos) return `Esperando papeles de ${corto(cliente(s, t.clientId)?.nombre ?? '')}`;
  const bt = bloqueoTitular(t, t.asignadoA ?? '');
  if (bt) return bt;
  if (step.kind === 'presentacion' && s.flags.arcaCaida) return 'ARCA no responde 😤';
  return null;
}

export function elegirTarea(s: GameState, w: Worker): Task | undefined {
  for (const id of w.queue) {
    const t = tarea(s, id);
    if (!t || t.estado !== 'pendiente') continue;
    if (!bloqueo(s, t) && !bloqueoTitular(t, w.id)) return t;
  }
  return undefined;
}

function ocioso(s: GameState, w: Worker): void {
  const bloqueada = w.queue.map((id) => tarea(s, id)).find((t) => t && t.estado === 'pendiente');
  if (bloqueada) {
    w.status = 'esperando';
    w.statusText = bloqueoTitular(bloqueada, w.id) ?? bloqueo(s, bloqueada) ?? 'Esperando';
    w.estres = Math.max(0, w.estres - 0.5);
    return;
  }
  if (w.id === 'player') {
    const idle = s.estudio.idle;
    if (idle === 'networking') {
      w.status = 'networking';
      w.statusText = 'Llamando a contactos 📞';
      s.flags.networking = (s.flags.networking ?? 0) + 1;
    } else if (idle === 'estudiar') {
      w.status = 'estudiando';
      w.statusText = 'Estudiando normativa 📚';
      const area = (['impuestos', 'sueldos', 'contabilidad'] as const).reduce((a, b) => (w.skills[a] <= w.skills[b] ? a : b));
      w.skills[area] = Math.min(95, w.skills[area] + 0.08);
    } else {
      w.status = 'descansando';
      w.statusText = 'Recargando energía ☕';
      w.estres = Math.max(0, w.estres - 3);
    }
    return;
  }
  w.status = 'ocioso';
  w.statusText = 'Tomando mate 🧉';
  w.estres = Math.max(0, w.estres - 1.5);
}

function trabajar(s: GameState, rng: Rng, w: Worker, t: Task, extra: boolean): void {
  const step = t.steps[t.stepIndex];
  const area = areaDe(t.kind);
  const mods = toolMods(s.tools, step.kind, area, t.kind);
  let avance = eficiencia(w, area, step.kind) / mods.horas;
  if (hasEspecial(s.tools, 'alertas') && diffDays(t.vence, s.date) <= 2) avance *= 1.1;
  step.horasHechas += avance;
  step.hechoPor = w.id;
  const c = cliente(s, t.clientId);
  w.status = 'trabajando';
  w.statusText = `${PASO_CORTO[step.kind]} ${t.titulo} · ${corto(c?.nombre ?? '')}`;
  w.currentTaskId = t.id;
  w.horasMes += 1;
  const carga = w.queue.reduce((a, id) => a + (tarea(s, id) ? horasRestantes(tarea(s, id)!) : 0), 0);
  w.estres = Math.min(100, w.estres + ((extra ? 2.4 : 0.35) + (carga > 40 ? 0.5 : 0)) * factorEstres(w, extra));
  if (extra) {
    w.horasExtraMes += 1;
    if (w.id !== 'player') {
      const valor = (w.sueldo / HORAS_MES) * (1 + RECARGO_HORA_EXTRA) * (1 + CARGAS_SOCIALES);
      acumularEgreso(s, 'Horas extra', valor);
    }
  }
  if (step.horasHechas >= step.horasTotales - 1e-6) completarPaso(s, rng, t, w);
}

function acumularEgreso(s: GameState, concepto: string, monto: number): void {
  const last = s.ledger[s.ledger.length - 1];
  if (last && last.date === s.date && last.concepto === concepto) {
    last.monto -= Math.round(monto);
    s.estudio.caja -= Math.round(monto);
  } else {
    s.estudio.caja -= Math.round(monto);
    s.ledger.push({ id: nid(s, 'l'), date: s.date, concepto, monto: -Math.round(monto), categoria: 'sueldos' });
  }
}

export function completarPaso(s: GameState, rng: Rng, t: Task, w: Worker): void {
  const step = t.steps[t.stepIndex];
  const area = areaDe(t.kind);
  const mods = toolMods(s.tools, step.kind, area, t.kind);
  step.horasHechas = step.horasTotales;
  step.hechoPor = w.id;
  if (step.kind === 'revision') {
    const auto = t.steps.some((st) => st.hechoPor === w.id && (st.kind === 'carga' || st.kind === 'liquidacion'));
    const pd = probDeteccion(w, area, auto, mods.detect);
    let det = 0;
    for (let i = 0; i < t.errores; i++) if (rng.chance(pd)) det++;
    if (det > 0) {
      t.errores -= det;
      t.corregidos += det;
      fx(s, 'error_detectado', { workerId: w.id, texto: det === 1 ? '¡Error corregido!' : `¡${det} errores corregidos!` });
    }
  } else if (rng.chance(probError(w, area, step.kind, mods.error))) {
    t.errores += 1;
  }
  const xp = 0.12 * step.horasTotales * (1 - w.skills[area] / 100) * (w.id === 'player' ? 1 : 1.3) * factorXp(w);
  w.skills[area] = Math.min(95, Math.round((w.skills[area] + xp) * 100) / 100);
  t.stepIndex += 1;
  if (t.stepIndex < t.steps.length) fx(s, 'paso_completo', { workerId: w.id, texto: STEP_LABEL[step.kind] });
  prepararSiguientePaso(s, t, w);
  if (t.stepIndex >= t.steps.length) finalizarTarea(s, rng, t, w);
}

function debeSaltearRevision(s: GameState, t: Task): boolean {
  if (t.saltearRevision) return true;
  const pol = s.estudio.politicaRevision;
  if (pol === 'nunca') return true;
  if (pol === 'criticas' && !esCritica(t.kind)) return true;
  return false;
}

/** Saltea la revisión si corresponde, o la deriva al mejor revisor disponible. */
export function prepararSiguientePaso(s: GameState, t: Task, preparador?: Worker): void {
  while (t.stepIndex < t.steps.length && t.steps[t.stepIndex].kind === 'revision' && debeSaltearRevision(s, t)) {
    t.steps[t.stepIndex].skipped = true;
    t.stepIndex += 1;
  }
  const step = t.steps[t.stepIndex];
  if (!step || step.kind !== 'revision' || !s.estudio.autoAsignar) return;
  const area = areaDe(t.kind);
  const base = preparador?.skills[area] ?? 0;
  // revisa alguien con más criterio que quien preparó (segregación de funciones), considerando su carga
  const revisores = s.workers.filter(
    (w) => !w.renunciaEl && w.id !== preparador?.id && w.skills[area] >= Math.max(45, base + 5) && w.role !== 'cadete' && w.role !== 'administrativo',
  );
  if (!revisores.length) return;
  const rev = revisores.sort((a, b) => b.skills[area] - cargaHoras(s, b) / 3 - (a.skills[area] - cargaHoras(s, a) / 3))[0];
  if (rev && rev.id !== t.asignadoA) {
    quitarDeColas(s, t.id);
    t.asignadoA = rev.id;
    rev.queue.push(t.id);
    ordenarCola(s, rev);
  }
}

function finalizarTarea(s: GameState, rng: Rng, t: Task, w: Worker): void {
  const c = cliente(s, t.clientId);
  const tarde = s.date > t.vence;
  t.estado = tarde ? 'presentada_tarde' : 'presentada';
  t.presentadaEl = s.date;
  quitarDeColas(s, t.id);
  if (c) {
    for (let i = 0; i < t.errores; i++) {
      const grav = esCritica(t.kind) ? rng.pick([1, 2, 2, 3] as const) : rng.pick([1, 1, 2] as const);
      c.erroresLatentes.push({ taskId: t.id, kind: t.kind, periodo: t.periodo, gravedad: grav, desde: s.date });
    }
    if (c.erroresLatentes.length > 12) c.erroresLatentes.splice(0, c.erroresLatentes.length - 12);
    if (!tarde) {
      ajustarSatisfaccion(c, 1.5);
      ajustarReputacion(s, 0.16);
      s.stats.presentadasATiempo += 1;
    } else s.stats.presentadasTarde += 1;
    registrarPresentacion(s, !tarde);
    if (t.honorarioExtra && t.honorarioExtra > 0 && !c.propio) {
      emitirFactura(s, rng, c, t.honorarioExtra, `Honorarios: ${t.titulo}`, t.periodo);
    }
    if (t.kind === 'requerimiento') cerrarInspeccion(s, rng, t);
    if (t.kind === 'control') cerrarControl(s, rng, t, t.minigameScore ?? 0);
    if (t.kind === 'auditoria') {
      ajustarReputacion(s, t.errores > 0 ? -2 : tarde ? 1 : 4);
      msg(s, { canal: 'email', de: corto(c.nombre), asunto: t.errores > 0 ? 'El banco observó el informe de auditoría' : '✅ Informe de auditoría entregado', cuerpo: t.errores > 0 ? 'El analista del banco encontró inconsistencias entre el informe y los estados contables. Mala imagen.' : 'El banco aprobó la línea de crédito con tu informe. ¡Gracias!', clientId: c.id });
    }
  }
  fx(s, tarde ? 'presentada_tarde' : 'presentada', { workerId: w.id, clientId: t.clientId, texto: t.titulo });
}

// ----------------------------------------------------------------------------- colas

export function cargaHoras(s: GameState, w: Worker): number {
  return w.queue.reduce((a, id) => {
    const t = tarea(s, id);
    return a + (t && t.estado === 'pendiente' ? horasRestantes(t) : 0);
  }, 0);
}

export function ordenarCola(s: GameState, w: Worker): void {
  const info = new Map(w.queue.map((id) => [id, tarea(s, id)]));
  w.queue = w.queue
    .filter((id) => info.get(id)?.estado === 'pendiente')
    .sort((a, b) => {
      const ta = info.get(a)!;
      const tb = info.get(b)!;
      if (!!ta.prioridad !== !!tb.prioridad) return ta.prioridad ? -1 : 1;
      if (ta.vence !== tb.vence) return ta.vence < tb.vence ? -1 : 1;
      return ta.generada < tb.generada ? -1 : 1;
    });
}

export function asignacionAutomatica(s: GameState): void {
  const enCola = new Set(s.workers.flatMap((w) => w.queue));
  const sinAsignar = s.tasks.filter((t) => t.estado === 'pendiente' && !enCola.has(t.id)).sort((a, b) => (a.vence < b.vence ? -1 : 1));
  if (s.estudio.autoAsignar) {
    const disponibles = s.workers.filter((w) => !w.renunciaEl);
    const carga = new Map(disponibles.map((w) => [w.id, cargaHoras(s, w)]));
    for (const t of sinAsignar) {
      const area = areaDe(t.kind);
      let best: Worker | undefined;
      let bestScore = Infinity;
      if (t.requiereTitular) {
        const p = disponibles.find((w) => w.id === 'player');
        if (p) {
          p.queue.push(t.id);
          t.asignadoA = 'player';
          carga.set('player', (carga.get('player') ?? 0) + horasRestantes(t));
        }
        continue;
      }
      for (const w of disponibles) {
        const cap = 8 * w.velocidad;
        const score = (carga.get(w.id) ?? 0) / cap + (100 - w.skills[area]) / 30 + (w.id === 'player' ? 0.6 : 0);
        if (score < bestScore) {
          bestScore = score;
          best = w;
        }
      }
      if (!best) continue;
      best.queue.push(t.id);
      t.asignadoA = best.id;
      carga.set(best.id, (carga.get(best.id) ?? 0) + horasRestantes(t));
    }
    for (const w of s.workers) ordenarCola(s, w);
  } else {
    for (const t of sinAsignar) t.asignadoA = undefined;
  }
}

// ----------------------------------------------------------------------------- cierre del día

function cerrarDia(s: GameState, rng: Rng): void {
  const hoy = s.date;
  // prórroga si ARCA estuvo caída en día de vencimiento
  const vencenHoy = s.tasks.filter((t) => t.estado === 'pendiente' && t.vence === hoy);
  if (s.flags.arcaCaida && vencenHoy.length && rng.chance(s.flags.reclamoArca ? 0.75 : 0.5)) {
    const manana = nextBusinessDay(hoy);
    vencenHoy.forEach((t) => (t.vence = manana));
    s.flags.prorroga = true;
    msg(s, { canal: 'dfe', de: 'ARCA', asunto: '✅ Se consideran en término las presentaciones de hoy', cuerpo: 'Por inconvenientes técnicos, las DDJJ con vencimiento hoy se considerarán presentadas en término si se presentan hasta el próximo día hábil.', importante: true });
  }
  // vencimientos
  const multas: { c: (typeof s.clients)[number]; t: Task; monto: number }[] = [];
  for (const t of s.tasks) {
    if (t.estado !== 'pendiente' || t.vencida || t.vence > hoy) continue;
    t.vencida = true;
    const c = cliente(s, t.clientId);
    if (!c) continue;
    if (t.kind === 'control') {
      vencerControl(s, rng, t);
      continue;
    }
    const monto = Math.round(precio(s, multaDe(t.kind, c)) * DIFICULTAD[s.estudio.dificultad].multas);
    ajustarSatisfaccion(c, c.propio ? 0 : -12);
    ajustarReputacion(s, c.propio ? -0.3 : -0.8);
    if (monto > 0) multas.push({ c, t, monto });
    else if (t.kind === 'balance') {
      ajustarSatisfaccion(c, -10);
      msg(s, { canal: 'email', de: corto(c.nombre), asunto: `Balance fuera de plazo`, cuerpo: 'El banco nos pide el balance para renovar la línea de crédito y todavía no está. ¿Qué pasó?', clientId: c.id, importante: true });
    }
    msg(s, { canal: 'dfe', de: 'ARCA · DFE', asunto: `Vencido: ${t.titulo} · ${corto(c.nombre)}`, cuerpo: `La obligación "${t.titulo}" venció el ${t.vence.split('-').reverse().join('/')} sin presentar. Presentala cuanto antes para cortar intereses.`, clientId: c.id, taskId: t.id, importante: true });
  }
  if (multas.length) eventoMultas(s, multas);
  // prospectos (usa el networking del día)
  sortearProspecto(s, rng);
  // rasgos que afectan al equipo
  const moralEquipo = s.workers.reduce((a, w) => a + ((w.rasgo && RASGOS[w.rasgo].moralEquipo) || 0), 0);
  if (moralEquipo > 0) for (const w of s.workers) w.moral = Math.min(100, w.moral + moralEquipo);
  const chusma = s.workers.find((w) => w.rasgo === 'chusma');
  if (chusma && s.prospects.length < 4 && rng.chance(0.03)) {
    const pr = genProspectoChusma(rng, { nivel: s.estudio.nivel, hoy: s.date, indice: s.inflacion.indice, id: nid(s, 'c'), origen: 'colega' });
    s.prospects.push(pr);
    fx(s, 'prospecto_llega', { texto: corto(pr.client.nombre) });
    msg(s, { canal: 'whatsapp', de: chusma.nombre.split(' ')[0], asunto: '🗣️ Dato: andan buscando contador', cuerpo: `Me contaron que ${corto(pr.client.nombre)} está descontento con su estudio. Ya le pasé tu número 😉`, importante: true });
  }
  // equipo
  for (const w of [...s.workers]) {
    if (w.renunciaEl && hoy >= w.renunciaEl) {
      retirarWorker(s, w.id, `${w.nombre} dejó el estudio.`);
      continue;
    }
    if (w.estres > 75) w.moral = Math.max(0, w.moral - 1.5);
    else if (w.estres < 40 && w.moral < 80) w.moral = Math.min(100, w.moral + 0.5);
    if (w.id !== 'player' && w.moral < 18 && rng.chance(0.15)) eventoRenuncia(s, w.id);
    w.estres = Math.max(0, w.estres - 6);
  }
  const p = s.workers.find((w) => w.id === 'player');
  if (p && p.estres >= 95 && !s.events.some((e) => e.defId === 'info' && e.titulo.includes('quemado'))) {
    eventoInfo(s, '🥵', 'Estás quemado/a', 'Trabajaste demasiado. Mañana vas a rendir la mitad si no bajás un cambio: delegá, contratá o poné al titular en "Descansar" cuando no tenga tareas.');
  }
  avanzarDia(s, rng);
}

export function retirarWorker(s: GameState, workerId: string, texto: string): void {
  const w = s.workers.find((x) => x.id === workerId);
  if (!w || w.id === 'player') return;
  for (const id of w.queue) {
    const t = tarea(s, id);
    if (t) t.asignadoA = undefined;
  }
  s.workers = s.workers.filter((x) => x.id !== workerId);
  fx(s, 'renuncia', { texto: w.nombre });
  msg(s, { canal: 'sistema', de: 'Equipo', asunto: `👋 ${w.nombre} ya no trabaja en el estudio`, cuerpo: `${texto} Sus tareas quedaron sin asignar.` });
}

function avanzarDia(s: GameState, rng: Rng): void {
  const prev = s.date;
  const next = nextBusinessDay(prev);
  const dias = diffDays(next, prev);
  if (dias > 1) {
    for (const w of s.workers) {
      w.estres = Math.max(0, w.estres - 10 * (dias - 1));
      w.moral = Math.min(100, w.moral + 1);
    }
  }
  s.date = next;
  s.hour = HORA_INICIO;
  s.flags = { arcaCaida: false, corteLuz: false, prorroga: false };
  if (monthKey(next) !== monthKey(prev)) inicioDeMes(s, rng, monthKey(prev));
  inicioDeDia(s, rng);
}

// ----------------------------------------------------------------------------- inicio del día

/** Tareas con día de generación propio (p.ej. sueldos el 22). */
function generarTareasDelDia(s: GameState, rng: Rng): void {
  const y = year(s.date);
  const m = month(s.date);
  const dias = new Set(OBLIGACIONES.map((o) => o.diaGeneracion).filter((d): d is number => d !== undefined));
  for (const dia of dias) {
    if (adjustToBusinessDay(ymd(y, m, dia)) !== s.date) continue;
    const docsFactor = hasEspecial(s.tools, 'portal') ? 0.6 : 1;
    for (const c of s.clients.filter((x) => x.activo)) s.tasks.push(...generarTareasDelMes(rng, c, monthKey(s.date), s.date, () => nid(s, 't'), docsFactor, dia));
  }
}

function inicioDeDia(s: GameState, rng: Rng): void {
  generarTareasDelDia(s, rng);
  const est = s.estudio as unknown as { vacaciones2?: string[] };
  if (est.vacaciones2 && month(s.date) === 1 && Number(s.date.slice(8)) >= 16) {
    for (const id of est.vacaciones2) {
      const w = s.workers.find((x) => x.id === id);
      if (w) {
        w.ocupadoHoras += 80;
        w.estres = 0;
      }
    }
    est.vacaciones2 = undefined;
  }
  const mult = DIFICULTAD[s.estudio.dificultad].eventos;
  const vencenPronto = s.tasks.some((t) => t.estado === 'pendiente' && t.vence <= addBusinessDays(s.date, 1) && t.steps[t.stepIndex]?.kind === 'presentacion');
  const vencenHoy = s.tasks.some((t) => t.estado === 'pendiente' && t.vence === s.date);
  if (rng.chance((vencenHoy ? 0.1 : 0.02) * mult)) {
    s.flags.arcaCaida = true;
    fx(s, 'arca_caida');
    if (vencenHoy || vencenPronto) {
      lanzarEvento(s, {
        id: nid(s, 'e'),
        defId: 'arca_caida',
        date: s.date,
        icon: '🔥',
        titulo: 'ARCA está caída',
        texto: 'La página de ARCA tira "Error 503 - Servicio no disponible" y hoy hay vencimientos. Nadie puede presentar nada. Puede salir una prórroga... o no.',
        params: {},
        opciones: [
          { id: 'ok', label: 'Seguimos con otra cosa' },
          { id: 'mesa', label: 'Llamar a la mesa de ayuda', hint: '1 hora del titular. Sube la chance de prórroga.' },
        ],
      });
    } else msg(s, { canal: 'sistema', de: 'Sistema', asunto: '🔥 ARCA no responde', cuerpo: 'Hoy no se puede presentar nada en ARCA. Por suerte no hay vencimientos.' });
  }
  const verano = [12, 1, 2].includes(month(s.date));
  if (rng.chance((verano ? 0.025 : 0.008) * mult)) {
    s.flags.corteLuz = true;
    const ups = hasEspecial(s.tools, 'ups');
    if (!ups) eventoInfo(s, '⚡', 'Se cortó la luz', 'Corte en todo el barrio. Sin luz no hay PC ni internet. Mientras dure, nadie trabaja.', 'Qué se le va a hacer');
    else msg(s, { canal: 'sistema', de: 'Sistema', asunto: '⚡ Corte de luz (la UPS aguantó)', cuerpo: 'Las notebooks y la UPS mantuvieron el estudio funcionando.' });
  }
  // documentación que llega
  const llegadas = s.tasks.filter((t) => t.estado === 'pendiente' && !t.docsRecibidos && t.docsLlegan <= s.date);
  for (const t of llegadas) if (t.kind === 'control' && t.steps[t.stepIndex]?.kind === 'recopilar') t.stepIndex += 1;
  const porCliente = new Map<string, Task[]>();
  for (const t of llegadas) {
    t.docsRecibidos = true;
    porCliente.set(t.clientId, [...(porCliente.get(t.clientId) ?? []), t]);
  }
  let visitas = 0;
  for (const [cid, ts] of porCliente) {
    const c = cliente(s, cid);
    if (!c || c.propio) continue;
    if (visitas < 2) fx(s, 'cliente_llega', { clientId: cid, texto: 'Trae papeles' });
    visitas += 1;
    msg(s, { canal: 'whatsapp', de: corto(c.nombre), asunto: '📎 Documentación', cuerpo: `Te mandé todo lo de: ${ts.map((t) => t.titulo).join(', ')}. ${c.ordenDocumental < 0.35 ? 'Creo que está todo... o casi 😅' : '¡Avisame si falta algo!'}`, clientId: cid, leido: true });
  }
  // agente IA de reclamos
  if (hasEspecial(s.tools, 'auto_reclamo')) {
    for (const t of s.tasks) {
      if (t.estado === 'pendiente' && !t.docsRecibidos && rng.chance(0.3)) t.docsLlegan = t.docsLlegan > s.date ? addBusinessDays(s.date, Math.max(0, businessDaysBetween(s.date, t.docsLlegan) - 1)) : t.docsLlegan;
    }
  }
  procesarCobranzas(s);
  procesarGastosDelDia(s);
  // prospectos vencidos
  for (const p of s.prospects.filter((x) => x.expira < s.date)) {
    msg(s, { canal: 'email', de: corto(p.client.nombre), asunto: 'Gracias igual', cuerpo: 'Al final seguimos con otro estudio. ¡Éxitos!', leido: true });
  }
  s.prospects = s.prospects.filter((x) => x.expira >= s.date);
  // tablero de alertas
  if (hasEspecial(s.tools, 'alertas')) {
    for (const t of s.tasks) {
      if (t.estado !== 'pendiente' || t.prioridad) continue;
      if (businessDaysBetween(s.date, t.vence) <= 3 && horasRestantes(t) > 1) {
        t.prioridad = true;
        msg(s, { canal: 'sistema', de: 'Tablero de vencimientos', asunto: `⚠️ ${t.titulo} vence en ≤3 días`, cuerpo: `${corto(cliente(s, t.clientId)?.nombre ?? '')}: faltan ${horasRestantes(t).toFixed(1)} h de trabajo. Se priorizó automáticamente.`, taskId: t.id, leido: true });
      }
    }
  }
  sortearEventoDiario(s, rng);
  asignacionAutomatica(s);
  // caja en rojo
  if (s.estudio.caja < 0) {
    s.estudio.diasEnRojo += 1;
    if (s.estudio.diasEnRojo === 1)
      lanzarEvento(s, {
        id: nid(s, 'e'),
        defId: 'caja_roja',
        date: s.date,
        icon: '🚨',
        titulo: 'La caja está en rojo',
        texto: `Tenés ${money(s.estudio.caja)}. Si seguís en negativo más de 45 días hábiles, el estudio quiebra.`,
        params: {},
        opciones: [
          { id: 'prestamo', label: `Pedir un préstamo bancario (${money(precio(s, 3_000_000))})`, disabled: !!s.estudio.prestamo, hint: '12 cuotas, tasa alta.' },
          { id: 'ajustar', label: 'Ajustar el cinturón' },
        ],
      });
    if (s.estudio.diasEnRojo === 30) eventoInfo(s, '🚨', 'Quedan 15 días', 'Hace 30 días hábiles que la caja está en negativo. Cobrá, recortá gastos o despedí personal.');
    if (s.estudio.diasEnRojo > 45) s.gameOver = { motivo: 'quiebra', date: s.date, texto: 'La caja estuvo en rojo demasiado tiempo. No pudiste pagar sueldos ni alquiler y tuviste que cerrar el estudio.' };
  } else {
    if (s.estudio.diasEnRojo >= 20) (s.stats as unknown as { rojoSuperado?: boolean }).rojoSuperado = true;
    s.estudio.diasEnRojo = 0;
  }
  if (s.estudio.reputacion <= 0 && clientesActivos(s).length === 0) s.gameOver = { motivo: 'reputacion', date: s.date, texto: 'Te quedaste sin clientes y sin reputación. Nadie quiere poner su contabilidad en tus manos.' };
}

function sortearProspecto(s: GameState, rng: Rng): void {
  if (s.prospects.length >= 4) return;
  const felices = clientesActivos(s).filter((c) => c.satisfaccion > 78);
  let p = 0.045 + MARKETING[s.estudio.marketing].prospectos + s.estudio.reputacion / 1600 + (s.flags.networking ?? 0) * 0.012 + Math.min(0.06, felices.length * 0.004);
  if (hasEspecial(s.tools, 'mas_prospectos')) p += 0.03;
  if (month(s.date) === 1) p *= 0.5;
  if (!rng.chance(p)) return;
  const refShare = felices.length * 0.004 / p;
  const referidoPor = felices.length && rng.chance(refShare) ? corto(rng.pick(felices).nombre) : undefined;
  const origen = s.estudio.marketing >= 3 && rng.chance(0.3) ? 'camara' : undefined;
  const pr = generarProspecto(rng, { nivel: s.estudio.nivel, hoy: s.date, indice: s.inflacion.indice, id: nid(s, 'c'), referidoPor, origen });
  s.prospects.push(pr);
  fx(s, 'prospecto_llega', { texto: corto(pr.client.nombre) });
  msg(s, { canal: pr.origen === 'web' ? 'email' : 'whatsapp', de: corto(pr.client.nombre), asunto: '🙋 Nueva consulta: quiere ser cliente', cuerpo: `${pr.mensaje}\n\nAbrí "Clientes → Prospectos" para mandarle una propuesta.`, importante: true });
}

// ----------------------------------------------------------------------------- inicio de mes

function inicioDeMes(s: GameState, rng: Rng, mesAnterior: string): void {
  const mes = monthKey(s.date);
  s.monthly.push(resumirMes(s, mesAnterior));
  if (s.monthly.length > 72) s.monthly.shift();
  const nota = calcularNota(s, mesAnterior);
  s.progreso.notas.push(nota);
  if (s.progreso.notas.length > 36) s.progreso.notas.shift();
  const nt = NOTA_TEXTO[nota.nota];
  ajustarReputacion(s, nt.rep);
  lanzarEvento(s, {
    id: nid(s, 'e'),
    defId: 'nota_mes',
    date: s.date,
    icon: nt.icon,
    titulo: `Cierre de ${mesAnterior.slice(5)}/${mesAnterior.slice(0, 4)}: nota ${nota.nota}`,
    texto: `${nt.titulo}. ${nt.frase}\n\n${nota.detalle.join(' · ')}\n\nPuntaje ${nota.puntos}/100 · Reputación ${nt.rep >= 0 ? '+' : ''}${nt.rep}`,
    params: {},
    opciones: [{ id: 'ok', label: nota.nota <= 'B' ? '¡Seguimos así!' : 'A mejorar' }],
  });
  const tasa = actualizarInflacion(s, rng, DIFICULTAD[s.estudio.dificultad].inflacion);
  const propio = estudioPropio(s);
  if (propio) propio.empleados = s.workers.filter((w) => w.id !== 'player').length;
  // tareas del mes
  const docsFactor = (hasEspecial(s.tools, 'portal') ? 0.6 : 1) * (hasEspecial(s.tools, 'auto_reclamo') ? 0.8 : 1) * DIFICULTAD[s.estudio.dificultad].docs;
  let nuevas = 0;
  const generadas: Task[] = [];
  for (const c of s.clients.filter((x) => x.activo)) {
    const ts = generarTareasDelMes(rng, c, mes, s.date, () => nid(s, 't'), docsFactor);
    s.tasks.push(...ts);
    generadas.push(...ts);
    nuevas += ts.length;
  }
  asignarObligatoriasDelMes(s, rng, generadas);
  // facturación
  if (hasEspecial(s.tools, 'factura_auto')) {
    const r = emitirAbonos(s, rng);
    if (r.cantidad) msg(s, { canal: 'sistema', de: 'Facturación automática', asunto: `🧾 ${r.cantidad} facturas emitidas`, cuerpo: `Se emitieron y enviaron los abonos del mes por ${money(r.total)}.`, leido: true });
  } else if (clientesActivos(s).length) {
    msg(s, { canal: 'sistema', de: 'Recordatorio', asunto: '🧾 Emití las facturas del mes', cuerpo: 'Entrá a Finanzas y emití los abonos. Cuanto antes factures, antes cobrás (después del día 10 los clientes pagan más tarde).', importante: true });
  }
  msg(s, {
    canal: 'sistema',
    de: 'Sistema',
    asunto: `📅 Arrancó ${mes.slice(5)}/${mes.slice(0, 4)}: ${nuevas} obligaciones nuevas`,
    cuerpo: `Inflación del mes: ${(tasa * 100).toFixed(1)}%. Revisá la agenda de vencimientos y repartí el trabajo.`,
    leido: true,
  });
  s.candidates = generarCandidatos(rng, s.estudio.nivel, s.inflacion.indice, () => nid(s, 'w'));
  if (month(s.date) === 1) eventoVacaciones(s);
  if ([1, 4, 7, 10].includes(month(s.date))) {
    const ult = s.inflacion.historia.slice(-3).reduce((a, h) => a * (1 + h.tasa), 1) - 1;
    eventoParitarias(s, Math.max(0.03, Math.round(ult * 100) / 100));
  }
  // clientes: satisfacción, bajas, morosos, errores
  let moroso = false;
  let errorDescubierto = false;
  for (const c of clientesActivos(s)) {
    if (hasEspecial(s.tools, 'portal')) ajustarSatisfaccion(c, 1);
    ajustarSatisfaccion(c, (70 - c.satisfaccion) * 0.04);
    if (c.satisfaccion < 18 && rng.chance(0.6)) {
      darDeBaja(s, c, 'Insatisfecho con el servicio');
      ajustarReputacion(s, -2);
      msg(s, { canal: 'email', de: corto(c.nombre), asunto: '👋 Nos vamos a otro estudio', cuerpo: 'No estamos conformes con el servicio. Te pedimos que nos pases las claves y la documentación.', clientId: c.id, importante: true });
      continue;
    }
    const d = deudaVencida(s, c.id);
    if (!moroso && d.facturas >= 2) {
      eventoMoroso(s, c, d.monto, d.facturas);
      moroso = true;
    }
    if (!errorDescubierto) {
      const e = c.erroresLatentes.find((x) => rng.chance(0.022 * x.gravedad));
      if (e) {
        c.erroresLatentes = c.erroresLatentes.filter((x) => x !== e);
        eventoErrorDescubierto(s, rng, c, e);
        errorDescubierto = true;
      }
    }
  }
  // fiscalización
  if (!s.tasks.some((t) => t.kind === 'requerimiento' && t.estado === 'pendiente')) {
    for (const c of rng.shuffle(clientesActivos(s).slice())) {
      const p = (0.004 + c.riesgoFiscal * 0.012 + c.erroresLatentes.length * 0.008) * DIFICULTAD[s.estudio.dificultad].fiscal;
      if (rng.chance(p)) {
        eventoInspeccion(s, c);
        break;
      }
    }
  }
  // el propio estudio se pasó del monotributo
  if (s.estudio.condicion === 'monotributista') {
    const tope = MONOTRIBUTO_CATEGORIAS[MONOTRIBUTO_CATEGORIAS.length - 1].ingresos * s.inflacion.indice;
    if (facturadoUltimos12(s) > tope) {
      s.estudio.condicion = 'ri';
      if (propio) propio.kind = 'ri_persona';
      lanzarEvento(s, {
        id: nid(s, 'e'),
        defId: 'pasaste_ri',
        date: s.date,
        icon: '📈',
        titulo: '¡Te pasaste del Monotributo!',
        texto: 'La facturación de los últimos 12 meses superó el tope de la categoría máxima. El estudio queda excluido del régimen: ahora sos Responsable Inscripto (IVA, Ganancias, IIBB).',
        params: {},
        opciones: [{ id: 'ok', label: 'A facturar con IVA' }],
      });
    }
  }
  // nivel
  const nivel = nivelCalculado(s);
  if (nivel > s.estudio.nivel) {
    s.estudio.nivel = nivel;
    fx(s, 'nivel', { texto: NIVELES[nivel - 1].nombre });
    eventoInfo(s, '🏆', `¡Nivel ${nivel}: ${NIVELES[nivel - 1].nombre}!`, desbloqueos(nivel), '¡Vamos!');
  }
  for (const w of s.workers) {
    w.horasMes = 0;
    w.horasExtraMes = 0;
  }
  // limpieza
  const limite = addBusinessDays(s.date, -170);
  s.tasks = s.tasks.filter((t) => t.estado === 'pendiente' || (t.presentadaEl ?? '9999') >= limite);
  s.inbox = s.inbox.filter((m, i) => i < 120 || !m.leido);
}

export function desbloqueos(nivel: number): string {
  const d: Record<number, string> = {
    2: 'Se desbloquean: oficina mediana, clientes de Convenio Multilateral, ERP en la nube, IA revisora, IA de conciliación, portal de clientes y CRM.',
    3: 'Se desbloquean: piso corporativo y clientes Sociedad Anónima. Ya sos un estudio de referencia en la ciudad.',
    4: 'Los clientes grandes te buscan. Más prospectos de cámaras empresarias.',
    5: '¡Firma líder! Sos el estudio que todos quieren tener. Se desbloquean los encargos de auditoría externa de grandes empresas.',
    6: 'Firma regional: clientes de otras provincias (más Convenio Multilateral) y mejores candidatos.',
    7: '¡Firma nacional! Llegaste a la cima. Ahora el desafío es sostenerla.',
  };
  return d[nivel] ?? '';
}

// ----------------------------------------------------------------------------- utilidades exportadas

export function incorporarCliente(s: GameState, rng: Rng, c: (typeof s.clients)[number]): void {
  c.activo = true;
  c.desde = s.date;
  c.honorarioActualizadoEl = s.date;
  c.honorarioIndice = s.inflacion.indice;
  s.clients.push(c);
  s.stats.clientesGanados += 1;
  const docsFactor = hasEspecial(s.tools, 'portal') ? 0.6 : 1;
  const ts = generarTareasDelMes(rng, c, monthKey(s.date), s.date, () => nid(s, 't'), docsFactor);
  s.tasks.push(...ts);
  asignacionAutomatica(s);
}

registrarIncorporarCartera((s, rng, n) => {
  for (let i = 0; i < n; i++) {
    const c = generarCliente(rng, { nivel: s.estudio.nivel, hoy: s.date, indice: s.inflacion.indice, id: nid(s, 'c') });
    c.honorario = Math.round((honorarioReferencia(c, s.inflacion.indice) * 0.9) / 1000) * 1000;
    c.satisfaccion = 58;
    incorporarCliente(s, rng, c);
    fx(s, 'cliente_llega', { clientId: c.id });
  }
});

/** Juega una tarea con el minijuego: completa carga + liquidación con la calidad obtenida. */
export function aplicarMinijuego(s: GameState, rng: Rng, t: Task, score: number, horas: number): void {
  const p = s.workers.find((w) => w.id === 'player')!;
  for (let i = t.stepIndex; i < t.steps.length; i++) {
    const st = t.steps[i];
    if (st.kind === 'carga' || st.kind === 'liquidacion' || st.kind === 'recopilar') {
      st.horasHechas = st.horasTotales;
      st.hechoPor = 'minijuego';
      t.stepIndex = i + 1;
    } else break;
  }
  t.minigameScore = score;
  if (score < 0.95) {
    const n = score >= 0.75 ? 1 : score >= 0.5 ? 2 : 3;
    for (let i = 0; i < n; i++) if (rng.chance(Math.min(0.95, (1 - score) * 1.6 + 0.2))) t.errores += 1;
  }
  const area = areaDe(t.kind);
  p.skills[area] = Math.min(95, p.skills[area] + 0.5 + score * 1.5);
  p.ocupadoHoras += horas;
  p.status = 'minijuego';
  p.statusText = `Haciendo ${t.titulo} a mano ✍️`;
  s.stats.minijuegosJugados += 1;
  fx(s, 'paso_completo', { workerId: 'player', texto: `${Math.round(score * 100)}/100` });
  // si estaba asignada a otro, se la queda el titular para revisar/presentar
  if (t.asignadoA !== 'player') {
    quitarDeColas(s, t.id);
    t.asignadoA = 'player';
    p.queue.push(t.id);
  }
  prepararSiguientePaso(s, t, p);
  if (s.estudio.autoAsignar) for (const w of s.workers) ordenarCola(s, w);
}

export { cargaHoras as cargaDe };
