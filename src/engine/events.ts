// Eventos con decisiones (cartas que interrumpen el juego).
import { addBusinessDays, periodoCorto, periodoLabel } from './calendar';
import { AJUSTE_FISCALIZACION, DIFICULTAD } from './config';
import { ajustarReputacion, ajustarSatisfaccion, clientesActivos, cliente, fx, msg, mov, nid, player, precio, quitarDeColas, worker } from './core';
import { buildSteps, nombreDe } from './obligations';
import type { Rng } from './rng';
import { hasEspecial } from './tools';
import type { ActiveEvent, Area, Client, GameState, LatentError, ObligationKind, StepKind, Task } from './types';
import { money } from './format';

type Crear = (s: GameState, rng: Rng) => ActiveEvent | null;
type Resolver = (s: GameState, ev: ActiveEvent, opcion: string, rng: Rng) => string;

interface EventDef {
  id: string;
  /** peso del evento en el sorteo diario (0 = no sale por azar) */
  peso?: (s: GameState) => number;
  crear?: Crear;
  resolver: Resolver;
}

const P = (ev: ActiveEvent, k: string) => ev.params[k];
const nueva = (s: GameState, e: Omit<ActiveEvent, 'id' | 'date'>): ActiveEvent => ({ id: nid(s, 'e'), date: s.date, ...e });

export function lanzarEvento(s: GameState, ev: ActiveEvent | null): void {
  if (!ev) return;
  s.events.push(ev);
}

/** Crea una tarea especial (requerimiento, rectificativa, consulta). */
export function crearTareaEspecial(
  s: GameState,
  c: Client,
  kind: ObligationKind,
  titulo: string,
  horas: Partial<Record<StepKind, number>>,
  diasHabiles: number,
  extra: Partial<Task> = {},
): Task {
  const t: Task = {
    id: nid(s, 't'),
    clientId: c.id,
    kind,
    periodo: extra.periodo ?? s.date.slice(0, 7),
    titulo,
    vence: addBusinessDays(s.date, diasHabiles),
    generada: s.date,
    docsLlegan: s.date,
    docsRecibidos: true,
    reclamos: 0,
    steps: buildSteps(horas),
    stepIndex: 0,
    estado: 'pendiente',
    errores: 0,
    corregidos: 0,
    saltearRevision: false,
    vencida: false,
    ...extra,
  };
  if (t.steps[0]?.kind === 'recopilar' && extra.docsLlegan) t.docsRecibidos = extra.docsLlegan <= s.date;
  s.tasks.push(t);
  return t;
}

function mejorEn(s: GameState, area: Area, sinTitular = false) {
  const ws = s.workers.filter((w) => !(sinTitular && w.id === 'player') && !w.renunciaEl);
  return ws.sort((a, b) => b.skills[area] - a.skills[area])[0];
}

function asignar(s: GameState, t: Task, workerId?: string) {
  const w = worker(s, workerId);
  if (!w) return;
  quitarDeColas(s, t.id);
  t.asignadoA = w.id;
  w.queue.unshift(t.id);
}

// ----------------------------------------------------------------------------- Definiciones

const DEFS: EventDef[] = [
  {
    id: 'multa_quien_paga',
    resolver: (s, ev, op) => {
      const c = cliente(s, String(P(ev, 'clientId')));
      const monto = Number(P(ev, 'monto'));
      if (!c) return '';
      if (op === 'absorber') {
        mov(s, -monto, 'multas', `Multa ${P(ev, 'titulo')} · ${c.nombre}`);
        fx(s, 'multa', { monto });
        ajustarSatisfaccion(c, -2);
        return `Pagaste ${money(monto)}. El cliente valora que te hagas cargo.`;
      }
      if (op === 'mitad') {
        mov(s, -monto / 2, 'multas', `50% multa ${P(ev, 'titulo')} · ${c.nombre}`);
        fx(s, 'multa', { monto: monto / 2 });
        ajustarSatisfaccion(c, -9);
        return `Compartieron la multa. ${c.nombre.split(' (')[0]} quedó medio molesto/a.`;
      }
      ajustarSatisfaccion(c, -20);
      ajustarReputacion(s, -1);
      return `${c.nombre.split(' (')[0]} pagó la multa... y no le gustó nada.`;
    },
  },
  {
    id: 'multas_varias',
    resolver: (s, ev, op) => {
      const items = JSON.parse(String(P(ev, 'items'))) as [string, number, string][];
      let pagado = 0;
      for (const [cid, monto, titulo] of items) {
        const c = cliente(s, cid);
        if (!c) continue;
        if (op === 'absorber') {
          mov(s, -monto, 'multas', `Multa ${titulo} · ${c.nombre}`);
          pagado += monto;
          ajustarSatisfaccion(c, -2);
        } else if (op === 'mitad') {
          mov(s, -monto / 2, 'multas', `50% multa ${titulo} · ${c.nombre}`);
          pagado += monto / 2;
          ajustarSatisfaccion(c, -9);
        } else {
          ajustarSatisfaccion(c, -20);
        }
      }
      if (op === 'trasladar') ajustarReputacion(s, -1.5);
      if (pagado) fx(s, 'multa', { monto: pagado });
      return op === 'trasladar' ? 'Los clientes pagaron las multas... y no están nada contentos.' : `Pagaste ${money(pagado)} en multas. Toca reorganizar el trabajo.`;
    },
  },
  {
    id: 'arca_caida',
    resolver: (s, _ev, op) => {
      if (op === 'mesa') {
        s.flags.reclamoArca = true;
        player(s).ocupadoHoras += 1;
        return 'Estuviste 50 minutos con música de espera. Te dijeron que "están trabajando para solucionarlo".';
      }
      return 'A esperar. Mientras tanto, el equipo avanza con lo que no requiere presentar.';
    },
  },
  {
    id: 'corte_luz',
    resolver: () => 'Mate a la luz de la ventana. A ver cuándo vuelve.',
  },
  {
    id: 'inspeccion',
    resolver: (s, ev, op) => {
      const c = cliente(s, String(P(ev, 'clientId')));
      if (!c) return '';
      const t = crearTareaEspecial(s, c, 'requerimiento', `Requerimiento ARCA · ${c.nombre.split(' (')[0]}`, { recopilar: 1.5, carga: 2, liquidacion: 6, revision: 1.5, presentacion: 1 }, 10, {
        prioridad: true,
        docsRecibidos: false,
        docsLlegan: addBusinessDays(s.date, 2),
        periodo: 'fiscalizacion',
      });
      if (op === 'cobrar') {
        t.honorarioExtra = Math.round((c.honorario * 1.5) / 1000) * 1000;
        ajustarSatisfaccion(c, -5);
        asignar(s, t, mejorEn(s, 'impuestos')?.id);
        return `Le vas a facturar ${money(t.honorarioExtra)} por la atención de la fiscalización.`;
      }
      if (op === 'yo') {
        asignar(s, t, 'player');
        ajustarSatisfaccion(c, 4);
        return 'Lo atendés personalmente. El cliente se queda tranquilo.';
      }
      asignar(s, t, mejorEn(s, 'impuestos', true)?.id ?? 'player');
      return 'Asignado al mejor del equipo en impuestos.';
    },
  },
  {
    id: 'resultado_inspeccion',
    resolver: (s, ev, op) => {
      const c = cliente(s, String(P(ev, 'clientId')));
      const monto = Number(P(ev, 'monto'));
      if (!c) return '';
      if (op === 'absorber') {
        mov(s, -monto, 'multas', `Ajuste fiscalización asumido · ${c.nombre}`);
        fx(s, 'multa', { monto });
        ajustarSatisfaccion(c, -6);
        return 'Asumiste el costo del error. Doloroso, pero conservás al cliente.';
      }
      if (op === 'mitad') {
        mov(s, -monto / 2, 'multas', `50% ajuste fiscalización · ${c.nombre}`);
        fx(s, 'multa', { monto: monto / 2 });
        ajustarSatisfaccion(c, -16);
        return 'Repartieron el costo del ajuste.';
      }
      ajustarSatisfaccion(c, -35);
      ajustarReputacion(s, -3);
      return 'El cliente pagó todo el ajuste. Está furioso y lo comenta en la Cámara.';
    },
  },
  {
    id: 'error_descubierto',
    resolver: (s, ev, op) => {
      const c = cliente(s, String(P(ev, 'clientId')));
      if (!c) return '';
      const grav = Number(P(ev, 'gravedad'));
      const intereses = precio(s, 90_000 * grav);
      const t = crearTareaEspecial(s, c, 'rectificativa', `Rectificativa ${P(ev, 'titulo')}`, { carga: 1 + grav * 0.5, liquidacion: 1.5 + grav, revision: 0.7, presentacion: 0.5 }, 10, {
        prioridad: true,
        periodo: String(P(ev, 'periodo')),
      });
      if (op === 'asumo') {
        mov(s, -intereses, 'multas', `Intereses resarcitorios · ${c.nombre}`);
        ajustarSatisfaccion(c, -4);
        ajustarReputacion(s, 0.3);
        return `Rectificás sin cargo y pagás ${money(intereses)} de intereses. Profesionalismo.`;
      }
      if (op === 'cobro') {
        t.honorarioExtra = Math.round((c.honorario * 0.5) / 1000) * 1000;
        ajustarSatisfaccion(c, -25);
        ajustarReputacion(s, -1);
        return 'Le cobrás la rectificativa de un error tuyo. Mmm...';
      }
      ajustarSatisfaccion(c, -14);
      return 'Rectificás sin cargo; los intereses los paga el cliente.';
    },
  },
  {
    id: 'consulta_cliente',
    peso: (s) => (clientesActivos(s).length > 0 ? 1.2 : 0),
    crear: (s, rng) => {
      const cs = clientesActivos(s);
      if (!cs.length) return null;
      const c = rng.pick(cs);
      const temas = [
        { t: '¿me conviene pasar de monotributo a SAS?', h: 4 },
        { t: 'quiere armar un plan de pagos por deudas de ARCA', h: 3 },
        { t: 'necesita una certificación de ingresos para un crédito', h: 2 },
        { t: 'pregunta cómo blanquear a su empleada', h: 3 },
        { t: 'quiere saber cuánto va a pagar de Ganancias si vende el local', h: 5 },
        { t: 'necesita un flujo de fondos para presentar al banco', h: 6 },
        { t: 'le llegó una intimación de la API y no entiende nada', h: 3 },
      ];
      const tema = rng.pick(temas);
      const hon = precio(s, 35_000 * tema.h);
      return nueva(s, {
        defId: 'consulta_cliente',
        icon: '☎️',
        titulo: 'Consulta fuera del abono',
        texto: `${c.nombre.split(' (')[0]} ${tema.t}. Calculás unas ${tema.h} horas de trabajo. ¿Qué hacés?`,
        clientId: c.id,
        params: { clientId: c.id, tema: tema.t, horas: tema.h, honorario: hon },
        opciones: [
          { id: 'cobrar', label: `Presupuestarlo aparte (${money(hon)})`, hint: 'Lo que está fuera del alcance, se cobra.' },
          { id: 'gratis', label: 'Hacerlo sin cargo', hint: 'El cliente feliz, pero ojo con el scope creep.' },
          { id: 'no', label: 'Derivarlo / no tomarlo' },
        ],
      });
    },
    resolver: (s, ev, op, rng) => {
      const c = cliente(s, String(P(ev, 'clientId')));
      if (!c) return '';
      const h = Number(P(ev, 'horas'));
      if (op === 'no') {
        ajustarSatisfaccion(c, -4);
        return 'Le recomendaste otro profesional.';
      }
      const t = crearTareaEspecial(s, c, 'consulta', `Consulta: ${String(P(ev, 'tema')).slice(0, 38)}…`, { liquidacion: h * 0.7, revision: h * 0.15, presentacion: h * 0.15 }, 8);
      if (op === 'cobrar') {
        if (rng.chance(0.75)) {
          t.honorarioExtra = Number(P(ev, 'honorario'));
          return 'Aceptó el presupuesto. Trabajo extra facturable.';
        }
        s.tasks = s.tasks.filter((x) => x.id !== t.id);
        ajustarSatisfaccion(c, -3);
        return 'Le pareció caro y lo va a "pensar".';
      }
      ajustarSatisfaccion(c, 6);
      return 'Lo hacés sin cargo. El cliente te ama (y la próxima va a pedir más).';
    },
  },
  {
    id: 'pedido_aumento',
    peso: (s) => (s.workers.some((w) => w.id !== 'player' && !w.renunciaEl) ? 0.7 : 0),
    crear: (s, rng) => {
      const ws = s.workers.filter((w) => w.id !== 'player' && !w.renunciaEl);
      if (!ws.length) return null;
      const w = ws.sort((a, b) => a.moral - b.moral)[0];
      const pct = rng.pick([0.08, 0.1, 0.12, 0.15, 0.2]);
      return nueva(s, {
        defId: 'pedido_aumento',
        icon: '🙋',
        titulo: 'Pedido de aumento',
        texto: `${w.nombre} te pide un aumento del ${Math.round(pct * 100)}%. "Con la inflación no llego a fin de mes". Hoy cobra ${money(w.sueldo)}.`,
        workerId: w.id,
        params: { workerId: w.id, pct },
        opciones: [
          { id: 'si', label: `Darle el ${Math.round(pct * 100)}%` },
          { id: 'mitad', label: `Ofrecer la mitad (${Math.round(pct * 50)}%)` },
          { id: 'no', label: 'Ahora no se puede' },
        ],
      });
    },
    resolver: (s, ev, op) => {
      const w = worker(s, String(P(ev, 'workerId')));
      const pct = Number(P(ev, 'pct'));
      if (!w) return '';
      if (op === 'si') {
        w.sueldo = Math.round((w.sueldo * (1 + pct)) / 1000) * 1000;
        w.moral = Math.min(100, w.moral + 18);
        return `${w.nombre.split(' ')[0]} vuelve contento/a a su escritorio.`;
      }
      if (op === 'mitad') {
        w.sueldo = Math.round((w.sueldo * (1 + pct / 2)) / 1000) * 1000;
        w.moral = Math.min(100, w.moral + 4);
        return 'Aceptó, sin mucho entusiasmo.';
      }
      w.moral = Math.max(0, w.moral - 18);
      return `${w.nombre.split(' ')[0]} no dijo nada. Pero se le nota.`;
    },
  },
  {
    id: 'paritarias',
    resolver: (s, ev, op) => {
      const pct = Number(P(ev, 'pct'));
      const equipo = s.workers.filter((w) => w.id !== 'player');
      if (op === 'aplicar') {
        for (const w of equipo) {
          w.sueldo = Math.round((w.sueldo * (1 + pct)) / 1000) * 1000;
          w.moral = Math.min(100, w.moral + 6);
        }
        return 'Sueldos actualizados según paritarias.';
      }
      if (op === 'mitad') {
        for (const w of equipo) {
          w.sueldo = Math.round((w.sueldo * (1 + pct / 2)) / 1000) * 1000;
          w.moral = Math.max(0, w.moral - 8);
        }
        return 'Aplicaste la mitad. El equipo lo nota.';
      }
      for (const w of equipo) w.moral = Math.max(0, w.moral - 22);
      return 'No ajustaste. El clima en la oficina está tenso (y hay riesgo de reclamo).';
    },
  },
  {
    id: 'renuncia',
    resolver: (s, ev, op, rng) => {
      const w = worker(s, String(P(ev, 'workerId')));
      if (!w) return '';
      if (op === 'contraoferta' && rng.chance(0.55)) {
        w.sueldo = Math.round((w.sueldo * 1.2) / 1000) * 1000;
        w.moral = 70;
        w.estres = Math.max(0, w.estres - 30);
        return `${w.nombre.split(' ')[0]} aceptó quedarse con un 20% más.`;
      }
      w.renunciaEl = addBusinessDays(s.date, 10);
      return `${w.nombre.split(' ')[0]} se va el ${w.renunciaEl.split('-').reverse().join('/')}. Redistribuí sus tareas.`;
    },
  },
  {
    id: 'cliente_moroso',
    resolver: (s, ev, op, rng) => {
      const c = cliente(s, String(P(ev, 'clientId')));
      if (!c) return '';
      const pend = s.invoices.filter((i) => i.clientId === c.id && !i.cobradaEl && !i.incobrable);
      if (op === 'reclamar') {
        if (rng.chance(0.6)) {
          pend.forEach((i) => (i.pagaEl = addBusinessDays(s.date, 3)));
          ajustarSatisfaccion(c, -3);
          return 'Prometió transferir esta semana.';
        }
        ajustarSatisfaccion(c, -6);
        return '"Te pago la semana que viene, sin falta". Ajá.';
      }
      if (op === 'baja') {
        pend.forEach((i) => (i.incobrable = true));
        darDeBaja(s, c, 'Baja por falta de pago');
        return 'Diste de baja al cliente y pasaste la deuda a incobrables.';
      }
      return 'Le das un poco más de tiempo.';
    },
  },
  {
    id: 'dibujar',
    peso: (s) => (clientesActivos(s).some((c) => c.kind !== 'monotributista') ? 0.45 : 0),
    crear: (s, rng) => {
      const cs = clientesActivos(s).filter((c) => c.kind !== 'monotributista');
      if (!cs.length) return null;
      const c = rng.pick(cs);
      const bonus = Math.round((c.honorario * 2) / 1000) * 1000;
      return nueva(s, {
        defId: 'dibujar',
        icon: '🖍️',
        titulo: '"Dibujame un poco los números"',
        texto: `${c.nombre.split(' (')[0]} te pide que le "acomodes" unas facturas de un proveedor que no existe para bajar el IVA. Te ofrece ${money(bonus)} "por la molestia".`,
        clientId: c.id,
        params: { clientId: c.id, bonus },
        opciones: [
          { id: 'no', label: 'Ni loco. Le explico los riesgos', hint: 'Facturas apócrifas = evasión. Tu matrícula vale más.' },
          { id: 'planificar', label: 'Propongo planificación fiscal legal (cobrable)' },
          { id: 'si', label: 'Bueno, por esta vez...', hint: '⚠️ Puede costarte la matrícula.' },
        ],
      });
    },
    resolver: (s, ev, op) => {
      const c = cliente(s, String(P(ev, 'clientId')));
      if (!c) return '';
      if (op === 'si') {
        mov(s, Number(P(ev, 'bonus')), 'otros', `"Gestión especial" · ${c.nombre}`);
        const e: LatentError = { taskId: 'dibujo', kind: 'iva', periodo: s.date.slice(0, 7), gravedad: 3, desde: s.date };
        c.erroresLatentes.push(e, { ...e });
        c.riesgoFiscal = Math.min(0.95, c.riesgoFiscal + 0.35);
        s.estudio.faltasEticas += 1;
        ajustarSatisfaccion(c, 12);
        return 'La plata entró. Ahora hay que rezar que no lo fiscalicen.';
      }
      if (op === 'planificar') {
        const t = crearTareaEspecial(s, c, 'consulta', 'Planificación fiscal', { liquidacion: 4, revision: 1, presentacion: 0.5 }, 10);
        t.honorarioExtra = Math.round((c.honorario * 0.8) / 1000) * 1000;
        ajustarSatisfaccion(c, -2);
        ajustarReputacion(s, 0.5);
        return 'Le armás una propuesta legal para ordenar su carga fiscal.';
      }
      ajustarSatisfaccion(c, -10);
      ajustarReputacion(s, 1);
      return 'Le explicaste por qué no. Se fue rezongando, pero tu firma sigue limpia.';
    },
  },
  {
    id: 'ransomware',
    peso: (s) => (s.tasks.some((t) => t.estado === 'pendiente') ? 0.25 : 0),
    crear: (s) => {
      const backup = hasEspecial(s.tools, 'backup');
      return nueva(s, {
        defId: 'ransomware',
        icon: '💀',
        titulo: 'Ransomware en la PC',
        texto: backup
          ? 'Alguien abrió "FACTURA_ADJUNTA.pdf.exe". La PC encriptó todo y pide bitcoins... pero tenés backup en la nube.'
          : 'Alguien abrió "FACTURA_ADJUNTA.pdf.exe". Se encriptaron las carpetas de clientes y piden un rescate. No hay backup.',
        params: { backup: backup ? 1 : 0, costo: precio(s, 600_000) },
        opciones: backup
          ? [{ id: 'restaurar', label: 'Restaurar el backup de anoche' }]
          : [
              { id: 'tecnico', label: `Llamar a un técnico (${money(precio(s, 600_000))})`, hint: 'Recupera parte del trabajo.' },
              { id: 'recargar', label: 'Formatear y recargar todo', hint: 'Se pierde el avance de carga.' },
            ],
      });
    },
    resolver: (s, ev, op) => {
      if (op === 'restaurar') return 'Backup restaurado. Nadie perdió nada. Bien ahí con la inversión.';
      const pend = s.tasks.filter((t) => t.estado === 'pendiente');
      const factor = op === 'tecnico' ? 0.5 : 0;
      if (op === 'tecnico') mov(s, -Number(P(ev, 'costo')), 'otros', 'Técnico informático (ransomware)');
      for (const t of pend) for (const st of t.steps) if ((st.kind === 'carga' || st.kind === 'liquidacion') && st.horasHechas < st.horasTotales) st.horasHechas *= factor;
      return op === 'tecnico' ? 'Se recuperó la mitad del trabajo en curso.' : 'A recargar todo. Moraleja: backup.';
    },
  },
  {
    id: 'nueva_rg',
    peso: (s) => (clientesActivos(s).filter((c) => c.kind !== 'monotributista').length >= 2 ? 0.35 : 0),
    crear: (s, rng) => {
      const n = rng.int(5600, 5899);
      const ri = clientesActivos(s).filter((c) => c.kind !== 'monotributista');
      return nueva(s, {
        defId: 'nueva_rg',
        icon: '📜',
        titulo: `Salió la RG ${n}`,
        texto: `ARCA publicó en el Boletín Oficial un nuevo régimen de información para responsables inscriptos. Afecta a ${ri.length} clientes: hay que presentar un informativo en 12 días hábiles.`,
        params: { rg: n },
        opciones: [
          { id: 'cobrar', label: 'Lo cobro aparte', hint: 'Es un trabajo nuevo, fuera del abono.' },
          { id: 'incluir', label: 'Lo incluyo en el abono' },
        ],
      });
    },
    resolver: (s, ev, op) => {
      const ri = clientesActivos(s).filter((c) => c.kind !== 'monotributista');
      for (const c of ri) {
        const t = crearTareaEspecial(s, c, 'consulta', `Informativo RG ${P(ev, 'rg')}`, { carga: 0.6 + c.volumen / 300, liquidacion: 0.5, presentacion: 0.3 }, 12);
        if (op === 'cobrar') {
          t.honorarioExtra = Math.round((c.honorario * 0.25) / 1000) * 1000;
          ajustarSatisfaccion(c, -3);
        } else ajustarSatisfaccion(c, 1);
      }
      return op === 'cobrar' ? 'Informaste el adicional a los clientes.' : 'Lo absorbés. Más horas, misma plata.';
    },
  },
  {
    id: 'capacitacion',
    peso: () => 0.35,
    crear: (s, rng) => {
      const area = rng.pick<Area>(['impuestos', 'sueldos', 'contabilidad']);
      const temas: Record<Area, string> = { impuestos: 'Novedades tributarias del año', sueldos: 'Liquidación de sueldos avanzada', contabilidad: 'RT 54 y estados contables PyME' };
      const costo = precio(s, 120_000);
      return nueva(s, {
        defId: 'capacitacion',
        icon: '🎓',
        titulo: 'Curso en el Consejo Profesional',
        texto: `El CPCE dicta "${temas[area]}". Son 6 horas. Cuesta ${money(costo)} por persona.`,
        params: { area, costo },
        opciones: [
          { id: 'yo', label: 'Voy yo' },
          { id: 'equipo', label: `Mando a todo el equipo (${money(costo * s.workers.length)})` },
          { id: 'no', label: 'Este mes no' },
        ],
      });
    },
    resolver: (s, ev, op) => {
      const area = String(P(ev, 'area')) as Area;
      const costo = Number(P(ev, 'costo'));
      if (op === 'no') return 'Será la próxima.';
      const quienes = op === 'yo' ? [player(s)] : s.workers;
      mov(s, -costo * quienes.length, 'capacitacion', `Curso CPCE (${quienes.length} persona/s)`);
      for (const w of quienes) {
        w.skills[area] = Math.min(98, w.skills[area] + 6);
        w.ocupadoHoras += 6;
        w.moral = Math.min(100, w.moral + 4);
      }
      return `+6 de habilidad en ${area} para ${quienes.length === 1 ? 'vos' : 'todo el equipo'}.`;
    },
  },
  {
    id: 'regalo',
    peso: (s) => (clientesActivos(s).some((c) => c.satisfaccion > 80) ? 0.4 : 0),
    crear: (s, rng) => {
      const c = rng.pick(clientesActivos(s).filter((x) => x.satisfaccion > 80));
      if (!c) return null;
      const regalo = rng.pick(['una caja de alfajores', 'un vino de Mendoza', 'medialunas para todos', 'un termo nuevo para el mate', 'una docena de facturas de la panadería']);
      return nueva(s, {
        defId: 'regalo',
        icon: '🎁',
        titulo: 'Un cliente agradecido',
        texto: `${c.nombre.split(' (')[0]} pasó por el estudio y dejó ${regalo}. "Gracias por bancarme siempre".`,
        clientId: c.id,
        params: {},
        opciones: [{ id: 'ok', label: '¡Qué lindo! 🥰' }],
      });
    },
    resolver: (s) => {
      for (const w of s.workers) w.moral = Math.min(100, w.moral + 5);
      return 'El equipo se pone contento. +moral.';
    },
  },
  {
    id: 'seleccion',
    peso: (s) => (s.hour < 14 ? 0.15 : 0),
    crear: (s) =>
      nueva(s, {
        defId: 'seleccion',
        icon: '⚽',
        titulo: 'Juega la Selección a las 16',
        texto: 'Es eliminatoria. El equipo te mira de reojo. Alguien ya trajo la tele.',
        params: {},
        opciones: [
          { id: 'ver', label: 'Lo vemos todos juntos', hint: '2 horas menos de trabajo, mucha moral.' },
          { id: 'trabajar', label: 'Se trabaja. Lo ven en el celular' },
        ],
      }),
    resolver: (s, _ev, op) => {
      if (op === 'ver') {
        for (const w of s.workers) {
          w.ocupadoHoras += 2;
          w.moral = Math.min(100, w.moral + 12);
          w.estres = Math.max(0, w.estres - 10);
        }
        return '¡GOOOOL! El equipo vuelve con todo.';
      }
      for (const w of s.workers) w.moral = Math.max(0, w.moral - 6);
      return 'Se trabajó... a medias. Todos con un auricular puesto.';
    },
  },
  {
    id: 'cartera',
    peso: (s) => (s.estudio.nivel >= 2 && s.estudio.caja > precio(s, 6_000_000) ? 0.12 : 0),
    crear: (s, rng) => {
      const n = rng.int(3, 6);
      const costo = precio(s, 1_400_000 * n);
      return nueva(s, {
        defId: 'cartera',
        icon: '🤝',
        titulo: 'Un colega vende su cartera',
        texto: `Un contador de la vieja guardia se jubila y te ofrece ${n} clientes por ${money(costo)}. "Son buena gente, algunos un poco desordenados".`,
        params: { n, costo },
        opciones: [
          { id: 'comprar', label: `Comprar la cartera (${money(costo)})` },
          { id: 'no', label: 'No, gracias' },
        ],
      });
    },
    resolver: (s, ev, op, rng) => {
      if (op !== 'comprar') return 'Le deseaste una feliz jubilación.';
      const n = Number(P(ev, 'n'));
      mov(s, -Number(P(ev, 'costo')), 'otros', 'Compra de cartera de clientes');
      incorporarCartera(s, rng, n);
      return `¡Sumaste ${n} clientes! Revisá sus tareas.`;
    },
  },
  {
    id: 'caja_roja',
    resolver: (s, _ev, op) => {
      if (op === 'prestamo' && !s.estudio.prestamo) {
        const capital = precio(s, 3_000_000);
        mov(s, capital, 'otros', 'Préstamo bancario');
        s.estudio.prestamo = { cuota: Math.round((capital * 1.55) / 12), restantes: 12 };
        return `Ingresaron ${money(capital)}. 12 cuotas de ${money(s.estudio.prestamo.cuota)}.`;
      }
      return 'A cuidar cada peso: cobrá lo atrasado y revisá gastos fijos.';
    },
  },
  {
    id: 'pasaste_ri',
    resolver: () => 'Ahora facturás con IVA y tenés más obligaciones propias. ¡Es crecer!',
  },
  {
    id: 'info',
    resolver: () => '',
  },
];

const DEF = Object.fromEntries(DEFS.map((d) => [d.id, d]));

export function resolverEvento(s: GameState, eventId: string, opcion: string, rng: Rng): string {
  const ev = s.events.find((e) => e.id === eventId);
  if (!ev) return '';
  const def = DEF[ev.defId];
  const txt = def ? def.resolver(s, ev, opcion, rng) : '';
  s.events = s.events.filter((e) => e.id !== eventId);
  return txt;
}

/** Sorteo diario de eventos aleatorios. */
export function sortearEventoDiario(s: GameState, rng: Rng): void {
  const mult = DIFICULTAD[s.estudio.dificultad].eventos;
  if (s.events.length > 0) return;
  if (!rng.chance(0.075 * mult)) return;
  const candidatos = DEFS.filter((d) => d.peso && d.crear).map((d) => ({ item: d, w: d.peso!(s) }));
  if (!candidatos.some((c) => c.w > 0)) return;
  const def = rng.weighted(candidatos);
  lanzarEvento(s, def.crear!(s, rng));
}

// ----------------------------------------------------------------------------- Eventos disparados por el motor

/** Multas del día: una sola decisión para todas (las del propio estudio se pagan directo). */
export function eventoMultas(s: GameState, items: { c: Client; t: Task; monto: number }[]): void {
  const ajenas = items.filter((i) => !i.c.propio);
  for (const i of items.filter((x) => x.c.propio)) {
    mov(s, -i.monto, 'multas', `Multa propia: ${i.t.titulo}`);
    fx(s, 'multa', { monto: i.monto });
    msg(s, { canal: 'dfe', de: 'ARCA · Domicilio Fiscal Electrónico', asunto: `Multa: ${i.t.titulo} (estudio)`, cuerpo: 'En casa de herrero, cuchillo de palo. Se debitó la multa por presentación fuera de término de tu propio estudio.', importante: true });
  }
  if (ajenas.length === 1) return eventoMulta(s, ajenas[0].c, ajenas[0].t, ajenas[0].monto);
  if (!ajenas.length) return;
  const total = ajenas.reduce((a, i) => a + i.monto, 0);
  lanzarEvento(
    s,
    nueva(s, {
      defId: 'multas_varias',
      icon: '💸',
      titulo: `${ajenas.length} multas por presentaciones fuera de término`,
      texto: `Vencieron sin presentar: ${ajenas.map((i) => `${i.t.titulo} (${i.c.nombre.split(' (')[0]})`).join(', ')}. Total de multas: ${money(total)}. ¿Quién las paga?`,
      params: { items: JSON.stringify(ajenas.map((i) => [i.c.id, i.monto, i.t.titulo])) },
      opciones: [
        { id: 'absorber', label: `Las pago yo (${money(total)})`, hint: 'Fue culpa del estudio.' },
        { id: 'mitad', label: `Mitad y mitad (${money(total / 2)})` },
        { id: 'trasladar', label: 'Que las paguen los clientes', hint: 'Satisfacción −20 a cada uno.' },
      ],
    }),
  );
}

export function eventoMulta(s: GameState, c: Client, t: Task, monto: number): void {
  lanzarEvento(
    s,
    nueva(s, {
      defId: 'multa_quien_paga',
      icon: '💸',
      titulo: 'Multa por presentación fuera de término',
      texto: `Venció "${t.titulo}" de ${c.nombre.split(' (')[0]} sin presentar. Corresponde una multa de ${money(monto)}. ¿Quién la paga?`,
      clientId: c.id,
      params: { clientId: c.id, monto, titulo: t.titulo },
      opciones: [
        { id: 'absorber', label: `La pago yo (${money(monto)})`, hint: 'Fue culpa del estudio.' },
        { id: 'mitad', label: 'Mitad y mitad' },
        { id: 'trasladar', label: 'Que la pague el cliente', hint: 'Satisfacción −20.' },
      ],
    }),
  );
}

export function eventoInspeccion(s: GameState, c: Client): void {
  lanzarEvento(
    s,
    nueva(s, {
      defId: 'inspeccion',
      icon: '🕵️',
      titulo: '¡Fiscalización de ARCA!',
      texto: `Llegó al Domicilio Fiscal Electrónico de ${c.nombre.split(' (')[0]} un requerimiento: piden libros IVA, extractos bancarios y papeles de trabajo de los últimos 12 meses. Plazo: 10 días hábiles. Si hubo errores en las DDJJ, puede haber ajuste.`,
      clientId: c.id,
      params: { clientId: c.id },
      opciones: [
        { id: 'equipo', label: 'Asignarlo al mejor del equipo' },
        { id: 'yo', label: 'Lo atiendo personalmente', hint: 'El cliente se queda más tranquilo.' },
        { id: 'cobrar', label: 'Atenderlo y cobrarlo aparte' },
      ],
    }),
  );
  fx(s, 'inspector', { clientId: c.id });
  msg(s, { canal: 'dfe', de: 'ARCA · Fiscalización', asunto: `Requerimiento F.8000 · ${c.nombre}`, cuerpo: 'Se le requiere aportar la documentación detallada en el plazo de 10 días hábiles bajo apercibimiento de aplicar las sanciones previstas en la Ley 11.683.', clientId: c.id, importante: true });
}

/** Al presentar la respuesta a un requerimiento: ¿encuentran errores? */
export function cerrarInspeccion(s: GameState, rng: Rng, t: Task): void {
  const c = cliente(s, t.clientId);
  if (!c) return;
  const encontrados: LatentError[] = [];
  for (const e of c.erroresLatentes) {
    const p = Math.min(0.95, 0.45 + 0.12 * e.gravedad + 0.1 * t.errores);
    if (rng.chance(p)) encontrados.push(e);
  }
  if (!encontrados.length) {
    s.stats.inspeccionesSuperadas += 1;
    ajustarReputacion(s, 3);
    ajustarSatisfaccion(c, 10);
    fx(s, 'idea', { texto: 'Sin ajustes ✔' });
    msg(s, { canal: 'dfe', de: 'ARCA · Fiscalización', asunto: `Fiscalización cerrada sin ajustes · ${c.nombre}`, cuerpo: 'Se concluyó la verificación sin observaciones. ¡Impecable! Tu reputación sube.', clientId: c.id, importante: true });
    return;
  }
  c.erroresLatentes = c.erroresLatentes.filter((e) => !encontrados.includes(e));
  s.stats.inspeccionesConAjuste += 1;
  // lo que el estudio podría asumir: multa por omisión + intereses (el impuesto es del cliente)
  const mult = c.kind === 'sa' ? 1.6 : c.kind === 'monotributista' ? 0.35 : c.kind === 'ri_persona' ? 0.7 : 1;
  const monto = Math.round(encontrados.reduce((a, e) => a + e.gravedad * (c.honorario * 0.6 + precio(s, AJUSTE_FISCALIZACION) * mult), 0) / 1000) * 1000;
  const dibujos = encontrados.filter((e) => e.taskId === 'dibujo').length;
  ajustarReputacion(s, -4);
  if (dibujos > 0) {
    ajustarReputacion(s, -15);
    if (s.estudio.faltasEticas >= 2) {
      s.gameOver = {
        motivo: 'matricula',
        date: s.date,
        texto: 'ARCA detectó facturas apócrifas que vos mismo cargaste. El Tribunal de Ética del Consejo Profesional suspendió tu matrícula. Fin del estudio.',
      };
      return;
    }
    msg(s, { canal: 'email', de: 'Tribunal de Ética · CPCE', asunto: 'Apercibimiento', cuerpo: 'Se le aplica un apercibimiento por su participación en el uso de facturas apócrifas. Una reincidencia implicará la suspensión de la matrícula.', importante: true });
  }
  lanzarEvento(
    s,
    nueva(s, {
      defId: 'resultado_inspeccion',
      icon: '⚖️',
      titulo: 'Ajuste de la fiscalización',
      texto: `ARCA encontró ${encontrados.length} error/es en DDJJ de ${c.nombre.split(' (')[0]} (${encontrados.map((e) => `${nombreDe(e.kind)} ${periodoCorto(e.periodo)}`).join(', ')}). Ajuste + intereses + multa: ${money(monto)}.`,
      clientId: c.id,
      params: { clientId: c.id, monto },
      opciones: [
        { id: 'absorber', label: `El estudio asume el error (${money(monto)})` },
        { id: 'mitad', label: 'Compartir el costo' },
        { id: 'trasladar', label: 'Que lo pague el cliente', hint: 'Satisfacción −35.' },
      ],
    }),
  );
}

export function eventoErrorDescubierto(s: GameState, rng: Rng, c: Client, e: LatentError): void {
  const quien = rng.chance(0.5) ? 'El propio cliente' : 'Una intimación de ARCA';
  const titulo = `${nombreDe(e.kind)} ${periodoCorto(e.periodo)}`;
  lanzarEvento(
    s,
    nueva(s, {
      defId: 'error_descubierto',
      icon: '🩹',
      titulo: 'Apareció un error',
      texto: `${quien} detectó un error en la DDJJ "${titulo}" de ${c.nombre.split(' (')[0]} (${periodoLabel(e.periodo)}). Hay que rectificar.`,
      clientId: c.id,
      params: { clientId: c.id, gravedad: e.gravedad, titulo, periodo: e.periodo },
      opciones: [
        { id: 'asumo', label: 'Rectifico sin cargo y pago los intereses', hint: 'Fue error del estudio.' },
        { id: 'cliente', label: 'Rectifico sin cargo; intereses a cargo del cliente' },
        { id: 'cobro', label: 'Le cobro la rectificativa' },
      ],
    }),
  );
}

export function eventoParitarias(s: GameState, pct: number): void {
  if (!s.workers.some((w) => w.id !== 'player')) return;
  lanzarEvento(
    s,
    nueva(s, {
      defId: 'paritarias',
      icon: '🤝',
      titulo: 'Paritarias de Comercio',
      texto: `El gremio y las cámaras acordaron un ${Math.round(pct * 100)}% de aumento para el trimestre. Los sueldos de convenio se tienen que ajustar.`,
      params: { pct },
      opciones: [
        { id: 'aplicar', label: `Aplicar el ${Math.round(pct * 100)}%` },
        { id: 'mitad', label: 'Aplicar la mitad' },
        { id: 'nada', label: 'No ajustar', hint: 'Riesgo de reclamo laboral y renuncias.' },
      ],
    }),
  );
}

export function eventoRenuncia(s: GameState, workerId: string): void {
  const w = worker(s, workerId);
  if (!w || w.renunciaEl || s.events.some((e) => e.defId === 'renuncia' && e.workerId === workerId)) return;
  lanzarEvento(
    s,
    nueva(s, {
      defId: 'renuncia',
      icon: '🚪',
      titulo: `${w.nombre} presenta la renuncia`,
      texto: `"Me ofrecieron algo mejor y estoy muy quemado/a". Moral ${Math.round(w.moral)}, estrés ${Math.round(w.estres)}.`,
      workerId: w.id,
      params: { workerId: w.id },
      opciones: [
        { id: 'contraoferta', label: 'Contraoferta: +20% de sueldo' },
        { id: 'aceptar', label: 'Aceptar la renuncia' },
      ],
    }),
  );
}

export function eventoMoroso(s: GameState, c: Client, deuda: number, facturas: number): void {
  if (s.events.some((e) => e.defId === 'cliente_moroso' && e.clientId === c.id)) return;
  lanzarEvento(
    s,
    nueva(s, {
      defId: 'cliente_moroso',
      icon: '🧾',
      titulo: 'Cliente moroso',
      texto: `${c.nombre.split(' (')[0]} debe ${facturas} facturas (${money(deuda)}). Sigue mandando papeles como si nada.`,
      clientId: c.id,
      params: { clientId: c.id },
      opciones: [
        { id: 'reclamar', label: 'Llamarlo y reclamar' },
        { id: 'baja', label: 'Darlo de baja' },
        { id: 'esperar', label: 'Esperar un poco más' },
      ],
    }),
  );
}

export function eventoInfo(s: GameState, icon: string, titulo: string, texto: string, boton = 'Entendido'): void {
  lanzarEvento(s, nueva(s, { defId: 'info', icon, titulo, texto, params: {}, opciones: [{ id: 'ok', label: boton }] }));
}

// ----------------------------------------------------------------------------- utilidades

export function darDeBaja(s: GameState, c: Client, motivo: string): void {
  c.activo = false;
  c.bajaEl = s.date;
  c.motivoBaja = motivo;
  for (const t of s.tasks.filter((x) => x.clientId === c.id && x.estado === 'pendiente')) quitarDeColas(s, t.id);
  s.tasks = s.tasks.filter((x) => !(x.clientId === c.id && x.estado === 'pendiente'));
  s.stats.clientesPerdidos += 1;
}

/** usado por el evento "cartera": se resuelve en simulation para evitar import circular */
let incorporarCartera: (s: GameState, rng: Rng, n: number) => void = () => {};
export function registrarIncorporarCartera(fn: typeof incorporarCartera) {
  incorporarCartera = fn;
}
