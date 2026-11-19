// Acciones del jugador. Cada una muta el estado (dentro de immer) y devuelve un texto para el toast.
import { addBusinessDays, businessDaysBetween, diffDays, monthKey } from './calendar';
import { MARKETING, NIVEL_POR_KIND, OFICINAS, ROLES } from './config';
import { ajustarSatisfaccion, cliente, clientesActivos, escritorios, fx, msg, mov, nivelCalculado, player, precio, quitarDeColas, tarea, worker } from './core';
import { probabilidadAceptacion } from './clients';
import { aplicarAumento, emitirAbonos } from './economy';
import { darDeBaja, resolverEvento } from './events';
import { money } from './format';
import { makeRng, type Rng } from './rng';
import { aplicarMinijuego, asignacionAutomatica, incorporarCliente, ordenarCola, prepararSiguientePaso, retirarWorker } from './simulation';
import { nuevoWorker } from './staff';
import { TOOL, hasTool } from './tools';
import type { GameState, PlayerIdle, PoliticaRevision, ToolId } from './types';

export interface Resultado {
  ok: boolean;
  texto: string;
}
const ok = (texto: string): Resultado => ({ ok: true, texto });
const no = (texto: string): Resultado => ({ ok: false, texto });

function conRng<T>(s: GameState, fn: (rng: Rng) => T): T {
  const rng = makeRng(s.rngState);
  const r = fn(rng);
  s.rngState = rng.state();
  return r;
}

// ----------------------------------------------------------------------------- tareas

export function asignarTarea(s: GameState, taskId: string, workerId: string | undefined): Resultado {
  const t = tarea(s, taskId);
  if (!t || t.estado !== 'pendiente') return no('La tarea ya no está pendiente.');
  quitarDeColas(s, taskId);
  t.asignadoA = workerId;
  const w = worker(s, workerId);
  if (w) {
    w.queue.push(taskId);
    if (s.estudio.autoAsignar) ordenarCola(s, w);
    return ok(`${t.titulo} → ${w.id === 'player' ? 'vos' : w.nombre.split(' ')[0]}`);
  }
  return ok('Tarea sin asignar.');
}

export function moverEnCola(s: GameState, workerId: string, taskId: string, dir: -1 | 1): Resultado {
  const w = worker(s, workerId);
  if (!w) return no('');
  const i = w.queue.indexOf(taskId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= w.queue.length) return no('');
  [w.queue[i], w.queue[j]] = [w.queue[j], w.queue[i]];
  return ok('');
}

export function priorizar(s: GameState, taskId: string): Resultado {
  const t = tarea(s, taskId);
  if (!t) return no('');
  t.prioridad = !t.prioridad;
  const w = worker(s, t.asignadoA);
  if (w) {
    if (s.estudio.autoAsignar) ordenarCola(s, w);
    else if (t.prioridad) {
      w.queue = [taskId, ...w.queue.filter((x) => x !== taskId)];
    }
  }
  return ok(t.prioridad ? `⭐ ${t.titulo} priorizada` : 'Prioridad quitada');
}

export function toggleRevision(s: GameState, taskId: string): Resultado {
  const t = tarea(s, taskId);
  if (!t) return no('');
  t.saltearRevision = !t.saltearRevision;
  if (t.saltearRevision) prepararSiguientePaso(s, t, worker(s, t.asignadoA));
  return ok(t.saltearRevision ? 'Se presentará sin revisión (más riesgo de errores).' : 'Se revisará antes de presentar.');
}

export function reclamarDocs(s: GameState, taskId: string): Resultado {
  const t = tarea(s, taskId);
  if (!t || t.docsRecibidos) return no('Ya está la documentación.');
  const c = cliente(s, t.clientId);
  if (!c) return no('');
  return conRng(s, (rng) => {
    t.reclamos += 1;
    const yaReclamadoHoy = s.inbox.some((m) => m.taskId === t.id && m.date === s.date && m.de === 'Vos');
    if (yaReclamadoHoy) return no('Ya le escribiste hoy. No lo agobies.');
    msg(s, { canal: 'whatsapp', de: 'Vos', asunto: `Reclamo a ${c.nombre.split(' (')[0]}`, cuerpo: `Hola! ¿Me mandás lo de ${t.titulo}? Vence el ${t.vence.split('-').reverse().join('/')} 🙏`, clientId: c.id, taskId: t.id, leido: true });
    if (t.reclamos > 2) ajustarSatisfaccion(c, -1.5);
    const p = 0.35 + c.ordenDocumental * 0.4;
    if (rng.chance(p)) {
      const faltan = Math.max(0, businessDaysBetween(s.date, t.docsLlegan));
      const nuevos = Math.max(0, faltan - rng.int(1, 4));
      t.docsLlegan = addBusinessDays(s.date, nuevos);
      if (nuevos === 0) t.docsRecibidos = true;
      return ok(`${c.nombre.split(' (')[0]}: "¡Uy, perdón! Te lo mando ${t.docsRecibidos ? 'ya' : 'mañana'}" 👍`);
    }
    return ok(`${c.nombre.split(' (')[0]}: "Sí sí, esta semana te lo junto" 🙄`);
  });
}

export function completarMinijuego(s: GameState, taskId: string, score: number, horas: number): Resultado {
  const t = tarea(s, taskId);
  if (!t || t.estado !== 'pendiente') return no('');
  conRng(s, (rng) => aplicarMinijuego(s, rng, t, score, horas));
  return ok(score >= 0.95 ? '¡Impecable! Liquidación lista para revisar y presentar.' : 'Liquidación lista. Ojo: puede haber quedado algún error.');
}

/** ¿Se puede jugar el minijuego de esta tarea ahora? */
export function minijuegoDisponible(s: GameState, taskId: string): { ok: boolean; motivo?: string } {
  const t = tarea(s, taskId);
  if (!t || !t.minigame || t.estado !== 'pendiente') return { ok: false, motivo: 'Sin minijuego' };
  const step = t.steps[t.stepIndex];
  if (!step) return { ok: false };
  if (!t.docsRecibidos) return { ok: false, motivo: 'Falta la documentación del cliente' };
  if (!['recopilar', 'carga', 'liquidacion'].includes(step.kind)) return { ok: false, motivo: 'La liquidación ya está hecha' };
  const p = player(s);
  if (p.ocupadoHoras > 0) return { ok: false, motivo: 'Estás ocupado/a con otra cosa' };
  return { ok: true };
}

// ----------------------------------------------------------------------------- clientes

export function enviarPropuesta(s: GameState, prospectId: string, honorario: number): Resultado {
  const p = s.prospects.find((x) => x.id === prospectId);
  if (!p) return no('El prospecto ya no está.');
  if (NIVEL_POR_KIND[p.client.kind] > s.estudio.nivel) return no(`Necesitás nivel ${NIVEL_POR_KIND[p.client.kind]} para tomar una ${p.client.kind.toUpperCase()}.`);
  return conRng(s, (rng) => {
    const prob = probabilidadAceptacion(honorario, p.honorarioReferencia, s.estudio.reputacion, hasTool(s.tools, 'crm'), p.origen);
    s.prospects = s.prospects.filter((x) => x.id !== prospectId);
    if (!rng.chance(prob)) {
      msg(s, { canal: 'email', de: p.client.nombre.split(' (')[0], asunto: 'Propuesta rechazada', cuerpo: `Gracias por la propuesta de ${money(honorario)}/mes, pero se nos va de presupuesto.`, leido: true });
      return no(`${p.client.nombre.split(' (')[0]} rechazó la propuesta.`);
    }
    const c = p.client;
    c.honorario = Math.round(honorario / 1000) * 1000;
    const r = honorario / p.honorarioReferencia;
    c.satisfaccion = Math.max(40, Math.min(90, c.satisfaccion + (1 - r) * 30));
    incorporarCliente(s, rng, c);
    fx(s, 'cliente_llega', { clientId: c.id, texto: '🤝 ¡Nuevo cliente!' });
    msg(s, { canal: 'whatsapp', de: c.nombre.split(' (')[0], asunto: '🤝 ¡Aceptó!', cuerpo: `¡Arrancamos! Abono de ${money(c.honorario)}. Ya te mando las claves fiscales.`, clientId: c.id, leido: true });
    const nv = nivelCalculado(s);
    if (nv > s.estudio.nivel) s.estudio.nivel = Math.max(s.estudio.nivel, nv);
    return ok(`¡${c.nombre.split(' (')[0]} es tu nuevo cliente! (${money(c.honorario)}/mes)`);
  });
}

export function rechazarProspecto(s: GameState, prospectId: string): Resultado {
  s.prospects = s.prospects.filter((x) => x.id !== prospectId);
  return ok('Prospecto descartado.');
}

export function darDeBajaCliente(s: GameState, clientId: string): Resultado {
  const c = cliente(s, clientId);
  if (!c || c.propio) return no('');
  darDeBaja(s, c, 'Baja decidida por el estudio');
  return ok(`Diste de baja a ${c.nombre.split(' (')[0]}.`);
}

export function actualizarHonorarios(s: GameState, pct: number, clientId?: string): Resultado {
  return conRng(s, (rng) => {
    const cs = clientId ? clientesActivos(s).filter((c) => c.id === clientId) : clientesActivos(s);
    let enojados = 0;
    const seVan: string[] = [];
    for (const c of cs) {
      const r = aplicarAumento(s, rng, c, pct);
      if (r === 'enojado') enojados++;
      if (r === 'se_va') {
        seVan.push(c.nombre.split(' (')[0]);
        darDeBaja(s, c, 'No aceptó el aumento');
      }
    }
    return ok(`Abonos actualizados ${Math.round(pct * 100)}%.${enojados ? ` ${enojados} cliente/s se quejaron.` : ''}${seVan.length ? ` Se fueron: ${seVan.join(', ')}.` : ''}`);
  });
}

export function setHonorario(s: GameState, clientId: string, honorario: number): Resultado {
  const c = cliente(s, clientId);
  if (!c) return no('');
  const pct = honorario / c.honorario - 1;
  if (pct > 0) return actualizarHonorarios(s, pct, clientId);
  c.honorario = Math.round(honorario / 1000) * 1000;
  ajustarSatisfaccion(c, Math.min(10, -pct * 40));
  return ok('Abono reducido. El cliente, chocho.');
}

// ----------------------------------------------------------------------------- finanzas

export function facturarMes(s: GameState): Resultado {
  if (s.estudio.facturasEmitidasMes === monthKey(s.date)) return no('Ya facturaste este mes.');
  return conRng(s, (rng) => {
    const r = emitirAbonos(s, rng);
    if (!r.cantidad) return no('No hay clientes para facturar.');
    fx(s, 'idea', { texto: `🧾 ${r.cantidad} facturas` });
    return ok(`Emitiste ${r.cantidad} facturas por ${money(r.total)}.`);
  });
}

export function setMarketing(s: GameState, nivel: number): Resultado {
  s.estudio.marketing = Math.max(0, Math.min(MARKETING.length - 1, nivel));
  return ok(`Marketing: ${MARKETING[s.estudio.marketing].nombre}.`);
}

// ----------------------------------------------------------------------------- equipo

export function contratar(s: GameState, candidateId: string): Resultado {
  const c = s.candidates.find((x) => x.id === candidateId);
  if (!c) return no('El candidato ya no está disponible.');
  if (s.workers.length >= escritorios(s)) return no('No hay escritorios libres. Mudate a una oficina más grande.');
  const usados = new Set(s.workers.map((w) => w.deskIndex));
  let desk = 0;
  while (usados.has(desk)) desk++;
  const w = nuevoWorker(c, s.date, desk);
  s.workers.push(w);
  s.candidates = s.candidates.filter((x) => x.id !== candidateId);
  fx(s, 'contratacion', { workerId: w.id, texto: w.nombre });
  msg(s, { canal: 'sistema', de: 'Equipo', asunto: `🎉 Se sumó ${w.nombre}`, cuerpo: `${ROLES[w.role].label}. Sueldo bruto ${money(w.sueldo)} (+ cargas sociales). Período de prueba: 6 meses (LCT art. 92 bis).`, leido: true });
  asignacionAutomatica(s);
  return ok(`¡Bienvenido/a ${w.nombre.split(' ')[0]}!`);
}

export function despedir(s: GameState, workerId: string): Resultado {
  const w = worker(s, workerId);
  if (!w || w.id === 'player') return no('');
  const meses = diffDays(s.date, w.contratadoEl) / 30.4;
  let costo: number;
  let detalle: string;
  if (meses < 6) {
    costo = w.sueldo * 0.5;
    detalle = 'Período de prueba: solo preaviso de 15 días.';
  } else {
    const anios = Math.max(1, Math.round(meses / 12));
    costo = w.sueldo * anios + w.sueldo * (meses >= 60 ? 2 : 1) + w.sueldo * 0.5;
    detalle = `Indemnización art. 245 (${anios} sueldo/s), preaviso e integración del mes.`;
  }
  mov(s, -costo, 'indemnizacion', `Desvinculación ${w.nombre}`);
  retirarWorker(s, w.id, detalle);
  for (const o of s.workers) if (o.id !== 'player') o.moral = Math.max(0, o.moral - 6);
  asignacionAutomatica(s);
  return ok(`Desvinculaste a ${w.nombre.split(' ')[0]}. Costo: ${money(costo)}.`);
}

export function toggleHorasExtra(s: GameState, workerId: string): Resultado {
  const w = worker(s, workerId);
  if (!w) return no('');
  w.horasExtra = !w.horasExtra;
  return ok(w.horasExtra ? `${w.id === 'player' ? 'Vas a' : w.nombre.split(' ')[0] + ' va a'} quedarse hasta las 20 (recargo 50%).` : 'Horario normal.');
}

export function darAumento(s: GameState, workerId: string, pct: number): Resultado {
  const w = worker(s, workerId);
  if (!w || w.id === 'player') return no('');
  w.sueldo = Math.round((w.sueldo * (1 + pct)) / 1000) * 1000;
  w.moral = Math.min(100, w.moral + pct * 120);
  return ok(`${w.nombre.split(' ')[0]} recibió un ${Math.round(pct * 100)}% de aumento.`);
}

export function darDiaLibre(s: GameState, workerId: string): Resultado {
  const w = worker(s, workerId);
  if (!w) return no('');
  w.ocupadoHoras += 8;
  w.status = 'descansando';
  w.statusText = 'Día libre 🏖️';
  w.estres = Math.max(0, w.estres - 35);
  w.moral = Math.min(100, w.moral + 6);
  return ok(`${w.id === 'player' ? 'Te tomás' : w.nombre.split(' ')[0] + ' se toma'} el día. Estrés −35.`);
}

// ----------------------------------------------------------------------------- herramientas e infraestructura

export function comprarHerramienta(s: GameState, id: ToolId): Resultado {
  const t = TOOL[id];
  if (!t || hasTool(s.tools, id)) return no('Ya la tenés.');
  if (t.nivelRequerido > s.estudio.nivel) return no(`Requiere nivel ${t.nivelRequerido}.`);
  const costo = precio(s, t.costoInicial);
  if (s.estudio.caja < costo) return no('No te alcanza la caja.');
  mov(s, -costo, 'software', `Implementación ${t.nombre}`);
  s.tools.push(id);
  fx(s, 'herramienta', { texto: t.nombre });
  return ok(`${t.icon} ${t.nombre} implementada.`);
}

export function cancelarHerramienta(s: GameState, id: ToolId): Resultado {
  if (!hasTool(s.tools, id)) return no('');
  s.tools = s.tools.filter((x) => x !== id);
  return ok(`Cancelaste ${TOOL[id].nombre}.`);
}

export function mudarOficina(s: GameState, n: number): Resultado {
  const of = OFICINAS[n];
  if (!of || n === s.estudio.oficina) return no('');
  if (of.nivelRequerido > s.estudio.nivel) return no(`Requiere nivel ${of.nivelRequerido}.`);
  if (n < s.estudio.oficina && s.workers.length > of.escritorios) return no('Tenés más gente que escritorios en esa oficina.');
  const costo = precio(s, of.mudanza);
  if (s.estudio.caja < costo) return no('No te alcanza la caja para la mudanza.');
  mov(s, -costo, 'mudanza', `Mudanza a ${of.nombre}`);
  s.estudio.oficina = n;
  // reubicar escritorios
  s.workers.forEach((w, i) => (w.deskIndex = i));
  fx(s, 'nivel', { texto: of.nombre });
  return ok(`¡Nueva oficina: ${of.nombre}!`);
}

// ----------------------------------------------------------------------------- configuración

export function setIdle(s: GameState, idle: PlayerIdle): Resultado {
  s.estudio.idle = idle;
  return ok('');
}
export function setPoliticaRevision(s: GameState, p: PoliticaRevision): Resultado {
  s.estudio.politicaRevision = p;
  for (const t of s.tasks) if (t.estado === 'pendiente') prepararSiguientePaso(s, t, worker(s, t.asignadoA));
  return ok('');
}
export function setAutoAsignar(s: GameState, v: boolean): Resultado {
  s.estudio.autoAsignar = v;
  if (v) asignacionAutomatica(s);
  return ok(v ? 'Asignación automática activada.' : 'Asignación manual: vos repartís el trabajo.');
}

export function elegirOpcion(s: GameState, eventId: string, opcion: string): Resultado {
  return conRng(s, (rng) => ok(resolverEvento(s, eventId, opcion, rng)));
}

export function marcarLeido(s: GameState, id?: string): Resultado {
  for (const m of s.inbox) if (!id || m.id === id) m.leido = true;
  return ok('');
}

export function marcarTutorial(s: GameState, paso: string): void {
  if (!s.tutorial.includes(paso)) s.tutorial.push(paso);
}

// ----------------------------------------------------------------------------- relámpago

/** Resultado de "Despachar la pila": cada acierto avanza media hora de carga en las tareas más urgentes. */
export function completarRelampago(s: GameState, aciertos: number, errores: number): Resultado {
  const p = player(s);
  s.progreso.relampagoEl = s.date;
  if (aciertos > s.progreso.relampagoMejor) s.progreso.relampagoMejor = aciertos;
  let horas = aciertos * 0.5;
  const pend = s.tasks.filter((t) => t.estado === 'pendiente' && t.docsRecibidos).sort((a, b) => (a.vence < b.vence ? -1 : 1));
  let avanzadas = 0;
  for (const t of pend) {
    if (horas <= 0) break;
    const st = t.steps[t.stepIndex];
    if (!st || (st.kind !== 'carga' && st.kind !== 'recopilar')) continue;
    const falta = st.horasTotales - st.horasHechas;
    const usa = Math.min(falta, horas);
    st.horasHechas += usa;
    st.hechoPor = 'player';
    horas -= usa;
    avanzadas += 1;
    if (st.horasHechas >= st.horasTotales - 1e-6) {
      t.stepIndex += 1;
      prepararSiguientePaso(s, t, p);
      fx(s, 'paso_completo', { workerId: 'player', texto: 'Carga' });
    }
  }
  p.estres = Math.max(0, Math.min(100, p.estres - aciertos * 0.4 + errores * 1.2));
  p.ocupadoHoras += 1;
  p.statusText = 'Despachando la pila ⚡';
  if (s.estudio.autoAsignar) for (const w of s.workers) ordenarCola(s, w);
  fx(s, 'idea', { texto: `⚡ ${aciertos} despachados` });
  return ok(avanzadas ? `Despachaste ${aciertos} comprobantes: adelantaste la carga de ${avanzadas} tarea/s.` : `${aciertos} aciertos. No había carga pendiente para adelantar, pero bajaste el estrés.`);
}
