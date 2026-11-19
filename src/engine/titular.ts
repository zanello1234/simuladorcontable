// "Tenés que hacerla vos": tareas que exigen al titular en el modo simulador.
//
// Reglas de juego:
//  - Ganancias de personas humanas siempre la liquida el titular (es la DDJJ más sensible del año).
//  - Cada mes, una o dos DDJJ de IVA "marcadas" (el cliente la pide personalmente, hubo intimación,
//    o es la primera del cliente) las tiene que hacer el titular.
//  - Cuando un cliente trae comprobantes sospechosos aparece un "Control de comprobantes" previo al IVA:
//    si no se hace (o se hace mal), el crédito fiscal apócrifo queda en la DDJJ y es un error latente grave.
import { addBusinessDays, businessDaysBetween } from './calendar';
import { ajustarSatisfaccion, cliente, fx, msg, nid, player, quitarDeColas } from './core';
import { buildSteps } from './obligations';
import type { Rng } from './rng';
import type { Client, GameState, Task } from './types';

const corto = (n: string) => n.split(' (')[0];

const MOTIVOS = [
  'El cliente pidió que la liquides vos personalmente.',
  'Le llegó una intimación por este impuesto: no es momento de delegar.',
  'Es la primera DDJJ de este cliente con el estudio: hay que conocer el caso.',
  'Cambió de actividad y hay operaciones nuevas que requieren criterio.',
  'Tuvo una nota de crédito grande y un saldo a favor raro: merece tu mirada.',
];

export function marcarRequiereTitular(t: Task, motivo: string): void {
  t.requiereTitular = true;
  t.motivoTitular = motivo;
  t.prioridad = true;
}

/** Al generar las tareas del mes: marca cuáles tiene que hacer el titular y crea controles de comprobantes. */
export function asignarObligatoriasDelMes(s: GameState, rng: Rng, nuevas: Task[]): void {
  const ya = new Set<string>();
  for (const t of nuevas) {
    if (t.kind === 'ganancias_ph') {
      marcarRequiereTitular(t, 'La DDJJ anual de Ganancias la firma y la liquida el titular.');
      ya.add(t.id);
    }
  }
  const cuantas = s.estudio.dificultad === 'argentina' ? 2 : 1;
  const ivas = rng.shuffle(nuevas.filter((t) => t.kind === 'iva' && !ya.has(t.id) && !cliente(s, t.clientId)?.propio));
  const marcadas = ivas.slice(0, Math.min(cuantas, ivas.length));
  for (const t of marcadas) {
    const c = cliente(s, t.clientId);
    const primera = c && businessDaysBetween(c.desde, s.date) < 25;
    const motivo = primera ? MOTIVOS[2] : c && c.erroresLatentes.length > 0 ? MOTIVOS[1] : rng.pick([MOTIVOS[0], MOTIVOS[3], MOTIVOS[4]]);
    marcarRequiereTitular(t, motivo);
    msg(s, { canal: 'whatsapp', de: corto(c?.nombre ?? ''), asunto: `🎮 ${t.titulo}: la tenés que hacer vos`, cuerpo: `${motivo} Abrí la tarea y usá "Hacerla yo" antes del ${t.vence.split('-').reverse().join('/')}: tu equipo no puede avanzar la liquidación.`, clientId: t.clientId, taskId: t.id, importante: true });
  }
  // controles de comprobantes: proporcional al riesgo fiscal del cliente
  let controles = 0;
  for (const t of nuevas) {
    if (t.kind !== 'iva' || controles >= 2) continue;
    const c = cliente(s, t.clientId);
    if (!c || c.propio) continue;
    const p = 0.05 + c.riesgoFiscal * 0.35 + (c.rubro === 'construccion' || c.rubro === 'transporte' ? 0.08 : 0);
    if (!rng.chance(p)) continue;
    crearControl(s, c, t);
    controles += 1;
  }
}

export function crearControl(s: GameState, c: Client, iva: Task): Task {
  const vence = addBusinessDays(iva.vence, -2) > s.date ? addBusinessDays(iva.vence, -2) : iva.vence;
  const t: Task = {
    id: nid(s, 't'),
    clientId: c.id,
    kind: 'control',
    periodo: iva.periodo,
    titulo: `Control de comprobantes ${iva.titulo.replace(/^DDJJ IVA /, '')}`,
    vence,
    generada: s.date,
    docsLlegan: iva.docsLlegan,
    docsRecibidos: iva.docsRecibidos,
    reclamos: 0,
    steps: buildSteps({ recopilar: 0.3, liquidacion: 2, presentacion: 0.2 }),
    stepIndex: 0,
    estado: 'pendiente',
    errores: 0,
    corregidos: 0,
    saltearRevision: true,
    vencida: false,
    minigame: 'apocrifas',
    prioridad: true,
    requiereTitular: true,
    motivoTitular: 'Hay facturas de proveedores nuevos con pinta rara. Antes de computar el crédito fiscal, revisalas.',
    vinculadaA: iva.id,
  };
  if (t.steps[0]?.kind === 'recopilar' && t.docsRecibidos) t.stepIndex = 1;
  s.tasks.push(t);
  msg(s, { canal: 'whatsapp', de: corto(c.nombre), asunto: '📎 Te mando las facturas de un proveedor nuevo', cuerpo: `Conseguí un proveedor que me hace muy buen precio, "${'Comercial ' + rng2(c)} SRL". Te paso las facturas para que las cargues en el IVA de este mes. ¡Son un montón de crédito fiscal! 😃`, clientId: c.id, taskId: t.id, importante: true });
  return t;
}
const rng2 = (c: Client) => ['Norte', 'Sur', 'Litoral', 'del Centro', 'Pampa'][c.cuit.charCodeAt(3) % 5];

/** ¿Este trabajador puede avanzar este paso? */
export function bloqueoTitular(t: Task, workerId: string): string | null {
  if (!t.requiereTitular) return null;
  const st = t.steps[t.stepIndex];
  if (!st || (st.kind !== 'carga' && st.kind !== 'liquidacion')) return null;
  return workerId === 'player' ? 'Hacela vos con 🎮 (modo simulador)' : 'Esta la tiene que hacer el titular 🎮';
}

/** Un control de comprobantes vencido o mal hecho contamina la DDJJ de IVA vinculada. */
export function cerrarControl(s: GameState, rng: Rng, t: Task, score: number | undefined): void {
  const c = cliente(s, t.clientId);
  const iva = s.tasks.find((x) => x.id === t.vinculadaA);
  if (!c) return;
  const omitido = score === undefined;
  const malo = !omitido && score < 0.7;
  if (omitido || malo) {
    const grav = 3 as const;
    const n = omitido ? 2 : 1;
    for (let i = 0; i < n; i++) c.erroresLatentes.push({ taskId: iva?.id ?? t.id, kind: 'iva', periodo: t.periodo, gravedad: grav, desde: s.date });
    c.riesgoFiscal = Math.min(0.95, c.riesgoFiscal + (omitido ? 0.15 : 0.08));
    if (iva) iva.errores += n;
    msg(s, {
      canal: 'sistema',
      de: 'Control interno',
      asunto: omitido ? `⚠️ Crédito fiscal sin controlar · ${corto(c.nombre)}` : `⚠️ Control flojo · ${corto(c.nombre)}`,
      cuerpo: omitido
        ? 'No se controlaron las facturas del proveedor nuevo y el crédito fiscal se computó igual. Si alguna es apócrifa, ARCA lo va a detectar tarde o temprano (y la multa por omisión no es chica).'
        : 'El control dejó pasar comprobantes dudosos. Quedó riesgo en la DDJJ de IVA.',
      clientId: c.id,
      importante: true,
    });
    return;
  }
  // bien hecho: el cliente aprende (o se enoja un poco porque "era buen precio")
  c.riesgoFiscal = Math.max(0.03, c.riesgoFiscal - 0.05);
  ajustarSatisfaccion(c, rng.chance(0.6) ? 2 : -3);
  fx(s, 'idea', { workerId: 'player', texto: 'Facturas truchas afuera ✔' });
}

/** Al vencer un control sin hacer. */
export function vencerControl(s: GameState, rng: Rng, t: Task): void {
  cerrarControl(s, rng, t, undefined);
  t.estado = 'presentada_tarde';
  t.presentadaEl = s.date;
  quitarDeColas(s, t.id);
}

export const tareasQueDeboHacer = (s: GameState) => s.tasks.filter((t) => t.estado === 'pendiente' && t.requiereTitular && ['recopilar', 'carga', 'liquidacion'].includes(t.steps[t.stepIndex]?.kind ?? ''));

export function titularOcupado(s: GameState): boolean {
  return player(s).ocupadoHoras > 0;
}
