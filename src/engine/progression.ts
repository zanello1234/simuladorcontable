// Progresión: misiones (metas de corto plazo con premio), logros (permanentes), rachas y la nota
// mensual del estudio. Todo se evalúa sobre el estado; no hay side effects fuera de `evaluarProgresion`.
import { monthKey } from './calendar';
import { ajustarReputacion, clientesActivos, fx, msg, mov, precio } from './core';
import { money } from './format';
import type { GameState, NotaMensual, Progreso } from './types';

export const PROGRESO_INICIAL: Progreso = { misiones: [], logros: [], racha: 0, mejorRacha: 0, notas: [], relampagoMejor: 0 };

export interface MisionDef {
  id: string;
  icon: string;
  titulo: string;
  texto: string;
  /** progreso 0..1 para la barra (opcional) */
  progreso?: (s: GameState) => number;
  cumplida: (s: GameState) => boolean;
  /** premio en pesos base (se indexa) y/o reputación */
  premioCaja?: number;
  premioRep?: number;
  /** misiones que deben estar completas antes de mostrarla */
  requiere?: string[];
}

const pres = (s: GameState) => s.stats.presentadasATiempo;
const herr = (s: GameState) => s.tools.length;
const equipo = (s: GameState) => s.workers.length - 1;

export const MISIONES: MisionDef[] = [
  { id: 'facturar', icon: '🧾', titulo: 'Primera facturación', texto: 'Emití las facturas del mes desde Finanzas (o desde la alerta del Escritorio).', cumplida: (s) => s.invoices.length > 0, premioRep: 1 },
  { id: 'presentar3', icon: '📨', titulo: 'Tres en término', texto: 'Presentá 3 obligaciones antes del vencimiento.', progreso: (s) => pres(s) / 3, cumplida: (s) => pres(s) >= 3, premioRep: 1 },
  { id: 'minijuego', icon: '🎮', titulo: 'Con tus propias manos', texto: 'Hacé una liquidación vos mismo con "🎮 Hacerla yo".', cumplida: (s) => s.stats.minijuegosJugados >= 1, premioCaja: 150_000, premioRep: 1 },
  { id: 'cliente', icon: '🤝', titulo: 'Primer cliente nuevo', texto: 'Cerrá una propuesta con un prospecto.', cumplida: (s) => s.stats.clientesGanados >= 1, premioRep: 2, requiere: ['facturar'] },
  { id: 'herramienta', icon: '🤖', titulo: 'Modernizarse', texto: 'Implementá tu primera herramienta.', cumplida: (s) => herr(s) >= 1, premioRep: 1 },
  { id: 'contratar', icon: '👥', titulo: 'Ya no estás solo/a', texto: 'Contratá a tu primer empleado/a.', cumplida: (s) => equipo(s) >= 1, premioCaja: 300_000, premioRep: 2, requiere: ['cliente'] },
  { id: 'racha10', icon: '🔥', titulo: 'Racha de 10', texto: 'Encadená 10 presentaciones en término sin ninguna tarde.', progreso: (s) => s.progreso.racha / 10, cumplida: (s) => s.progreso.mejorRacha >= 10, premioCaja: 400_000, premioRep: 2, requiere: ['presentar3'] },
  { id: 'clientes8', icon: '📈', titulo: 'Cartera de 8', texto: 'Llegá a 8 clientes activos.', progreso: (s) => clientesActivos(s).length / 8, cumplida: (s) => clientesActivos(s).length >= 8, premioRep: 3, requiere: ['cliente'] },
  { id: 'oficina', icon: '🏢', titulo: 'Salir del living', texto: 'Mudate a una oficina de verdad.', cumplida: (s) => s.estudio.oficina >= 1, premioRep: 3, requiere: ['contratar'] },
  { id: 'ia', icon: '🧠', titulo: 'No es magia, es ingeniería', texto: 'Implementá una herramienta de IA y tené activa la revisión (política "revisar todo" o "solo críticas").', cumplida: (s) => s.tools.some((t) => t.startsWith('ia_')) && s.estudio.politicaRevision !== 'nunca', premioRep: 3, requiere: ['herramienta'] },
  { id: 'actualizar', icon: '💲', titulo: 'Le ganás a la inflación', texto: 'Actualizá los abonos de todos los clientes (Clientes → Actualizar abonos).', cumplida: (s) => clientesActivos(s).length > 0 && clientesActivos(s).every((c) => c.honorarioActualizadoEl > s.estudio.inicio), premioRep: 2, requiere: ['facturar'] },
  { id: 'notaA', icon: '🏅', titulo: 'Mes perfecto', texto: 'Conseguí una nota A en el cierre de mes.', cumplida: (s) => s.progreso.notas.some((n) => n.nota === 'A'), premioCaja: 600_000, premioRep: 4, requiere: ['presentar3'] },
  { id: 'nivel2', icon: '⭐', titulo: 'Estudio en crecimiento', texto: 'Alcanzá el nivel 2 (7 clientes y reputación 35).', cumplida: (s) => s.estudio.nivel >= 2, premioCaja: 800_000, premioRep: 2, requiere: ['clientes8'] },
  { id: 'inspeccion', icon: '🕵️', titulo: 'Impecable ante ARCA', texto: 'Superá una fiscalización sin ajustes.', cumplida: (s) => s.stats.inspeccionesSuperadas >= 1, premioCaja: 1_000_000, premioRep: 5, requiere: ['nivel2'] },
  { id: 'clientes15', icon: '🚀', titulo: 'Cartera de 15', texto: 'Llegá a 15 clientes activos.', progreso: (s) => clientesActivos(s).length / 15, cumplida: (s) => clientesActivos(s).length >= 15, premioCaja: 1_500_000, premioRep: 4, requiere: ['nivel2'] },
  { id: 'nivel3', icon: '🏆', titulo: 'Estudio consolidado', texto: 'Alcanzá el nivel 3.', cumplida: (s) => s.estudio.nivel >= 3, premioCaja: 3_000_000, premioRep: 3, requiere: ['clientes15'] },
];

export interface LogroDef {
  id: string;
  icon: string;
  titulo: string;
  texto: string;
  cumplido: (s: GameState) => boolean;
  secreto?: boolean;
}

export const LOGROS: LogroDef[] = [
  { id: 'primera', icon: '📨', titulo: 'Primera presentación', texto: 'Presentaste tu primera DDJJ en término.', cumplido: (s) => pres(s) >= 1 },
  { id: 'cien', icon: '💯', titulo: 'Cien presentaciones', texto: '100 obligaciones presentadas en término.', cumplido: (s) => pres(s) >= 100 },
  { id: 'racha25', icon: '🔥', titulo: 'Imparable', texto: '25 presentaciones en término seguidas.', cumplido: (s) => s.progreso.mejorRacha >= 25 },
  { id: 'racha50', icon: '☄️', titulo: 'Reloj suizo', texto: '50 presentaciones en término seguidas.', cumplido: (s) => s.progreso.mejorRacha >= 50 },
  { id: 'millon', icon: '💰', titulo: 'Diez palos', texto: 'Caja de más de 10 millones.', cumplido: (s) => s.estudio.caja >= 10_000_000 },
  { id: 'cuarenta', icon: '🏦', titulo: 'Cincuenta palos', texto: 'Caja de más de 50 millones.', cumplido: (s) => s.estudio.caja >= 50_000_000 },
  { id: 'mg5', icon: '🎮', titulo: 'Manos a la obra', texto: 'Hiciste 5 liquidaciones a mano.', cumplido: (s) => s.stats.minijuegosJugados >= 5 },
  { id: 'mgperfecto', icon: '🎯', titulo: 'Sin un error', texto: 'Una liquidación a mano con 100/100.', cumplido: (s) => s.tasks.some((t) => t.minigameScore === 1) },
  { id: 'relampago', icon: '⚡', titulo: 'Despachador/a', texto: '20 aciertos en una partida relámpago.', cumplido: (s) => s.progreso.relampagoMejor >= 20 },
  { id: 'relampago35', icon: '🌩️', titulo: 'Rayo contable', texto: '35 aciertos en una partida relámpago.', cumplido: (s) => s.progreso.relampagoMejor >= 35 },
  { id: 'equipo5', icon: '👥', titulo: 'Estudio de verdad', texto: '5 personas trabajando con vos.', cumplido: (s) => equipo(s) >= 5 },
  { id: 'piso', icon: '🌆', titulo: 'Vista al río', texto: 'Te mudaste al piso corporativo.', cumplido: (s) => s.estudio.oficina >= 3 },
  { id: 'todasia', icon: '🤖', titulo: 'Estudio aumentado', texto: 'Tenés las cuatro herramientas de IA.', cumplido: (s) => ['ia_carga', 'ia_revisor', 'ia_documentacion', 'ia_conciliacion'].every((t) => s.tools.includes(t as never)) },
  { id: 'etica', icon: '⚖️', titulo: 'Matrícula limpia', texto: 'Rechazaste tres veces "dibujar" los números.', cumplido: (s) => (s.stats as unknown as { eticaOk?: number }).eticaOk !== undefined && (s.stats as unknown as { eticaOk: number }).eticaOk >= 3, secreto: true },
  { id: 'inspecciones3', icon: '🛡️', titulo: 'A prueba de inspectores', texto: 'Tres fiscalizaciones superadas sin ajustes.', cumplido: (s) => s.stats.inspeccionesSuperadas >= 3 },
  { id: 'sobreviviente', icon: '🧗', titulo: 'Sobreviviente', texto: 'Saliste de la caja en rojo después de 20 días hábiles.', cumplido: (s) => (s.stats as unknown as { rojoSuperado?: boolean }).rojoSuperado === true, secreto: true },
  { id: 'aniversario', icon: '🎂', titulo: 'Primer aniversario', texto: 'Un año de estudio.', cumplido: (s) => s.date >= `${Number(s.estudio.inicio.slice(0, 4)) + 1}${s.estudio.inicio.slice(4)}` },
  { id: 'notaA3', icon: '🥇', titulo: 'Trimestre de oro', texto: 'Tres meses seguidos con nota A.', cumplido: (s) => s.progreso.notas.slice(-3).length === 3 && s.progreso.notas.slice(-3).every((n) => n.nota === 'A') },
  { id: 'rep80', icon: '🌟', titulo: 'Referente', texto: 'Reputación 80 o más.', cumplido: (s) => s.estudio.reputacion >= 80 },
  { id: 'cartera30', icon: '🏙️', titulo: 'Media ciudad', texto: '30 clientes activos.', cumplido: (s) => clientesActivos(s).length >= 30 },
];

export function misionesVisibles(s: GameState): MisionDef[] {
  const done = new Set(s.progreso.misiones);
  return MISIONES.filter((m) => !done.has(m.id) && (m.requiere ?? []).every((r) => done.has(r))).slice(0, 4);
}

/** Evalúa misiones y logros; aplica premios y avisa. Se llama cada hora de juego. */
export function evaluarProgresion(s: GameState): void {
  const p = s.progreso;
  for (const m of misionesVisibles(s)) {
    if (!m.cumplida(s)) continue;
    p.misiones.push(m.id);
    const partes: string[] = [];
    if (m.premioCaja) {
      const monto = precio(s, m.premioCaja);
      mov(s, monto, 'otros', `Premio por misión: ${m.titulo}`);
      partes.push(money(monto));
    }
    if (m.premioRep) {
      ajustarReputacion(s, m.premioRep);
      partes.push(`+${m.premioRep} reputación`);
    }
    fx(s, 'mision', { texto: `${m.icon} ${m.titulo}` });
    msg(s, { canal: 'sistema', de: 'Misiones', asunto: `✅ Misión cumplida: ${m.titulo}`, cuerpo: `${m.texto}\n\nPremio: ${partes.join(' y ') || 'la satisfacción del deber cumplido'}.`, leido: true });
  }
  for (const l of LOGROS) {
    if (p.logros.includes(l.id) || !l.cumplido(s)) continue;
    p.logros.push(l.id);
    fx(s, 'logro', { texto: `${l.icon} ${l.titulo}` });
    msg(s, { canal: 'sistema', de: 'Logros', asunto: `🏅 Logro desbloqueado: ${l.titulo}`, cuerpo: l.texto, leido: true });
  }
}

/** Actualiza la racha al presentar. */
export function registrarPresentacion(s: GameState, aTiempo: boolean): void {
  const p = s.progreso;
  if (!aTiempo) {
    if (p.racha >= 5) fx(s, 'racha', { texto: `Racha perdida (${p.racha})` });
    p.racha = 0;
    return;
  }
  p.racha += 1;
  if (p.racha > p.mejorRacha) p.mejorRacha = p.racha;
  if ([5, 10, 25, 50, 100].includes(p.racha)) {
    const bono = p.racha >= 25 ? 1 : 0.5;
    ajustarReputacion(s, bono);
    fx(s, 'racha', { texto: `🔥 Racha ${p.racha}` });
  }
}

/** Nota del mes que terminó. */
export function calcularNota(s: GameState, mes: string): NotaMensual {
  const pres = s.tasks.filter((t) => t.presentadaEl?.startsWith(mes));
  const ok = pres.filter((t) => t.estado === 'presentada').length;
  const tarde = pres.length - ok;
  const vencidasPend = s.tasks.filter((t) => t.estado === 'pendiente' && t.vence < s.date && t.vence.startsWith(mes)).length;
  const movs = s.ledger.filter((l) => l.date.startsWith(mes));
  const resultado = movs.reduce((a, l) => a + l.monto, 0);
  const multas = -movs.filter((l) => l.categoria === 'multas').reduce((a, l) => a + l.monto, 0);
  const cs = clientesActivos(s);
  const sat = cs.length ? cs.reduce((a, c) => a + c.satisfaccion, 0) / cs.length : 70;
  const p = s.workers.find((w) => w.id === 'player');
  const detalle: string[] = [];
  let puntos = 0;
  // puntualidad (0-40)
  const punt = pres.length + vencidasPend ? ok / (pres.length + vencidasPend) : 1;
  puntos += Math.round(punt * 40);
  detalle.push(`Puntualidad: ${ok} en término, ${tarde + vencidasPend} fuera de término`);
  // resultado (0-25)
  puntos += resultado > 0 ? 25 : resultado > -500_000 * s.inflacion.indice ? 12 : 0;
  detalle.push(`Resultado del mes: ${money(resultado)}`);
  // multas (0-10)
  puntos += multas === 0 ? 10 : multas < 300_000 * s.inflacion.indice ? 5 : 0;
  if (multas > 0) detalle.push(`Multas pagadas: ${money(multas)}`);
  // satisfacción (0-15)
  puntos += Math.round(Math.max(0, Math.min(1, (sat - 40) / 50)) * 15);
  detalle.push(`Satisfacción promedio de clientes: ${Math.round(sat)}/100`);
  // tu salud (0-10)
  puntos += p && p.estres < 60 ? 10 : p && p.estres < 85 ? 5 : 0;
  if (p && p.estres >= 60) detalle.push(`Terminaste el mes con estrés ${Math.round(p.estres)}`);
  const nota: NotaMensual['nota'] = puntos >= 88 ? 'A' : puntos >= 72 ? 'B' : puntos >= 55 ? 'C' : puntos >= 38 ? 'D' : 'F';
  return { mes, nota, puntos, detalle };
}

export const NOTA_TEXTO: Record<NotaMensual['nota'], { icon: string; titulo: string; frase: string; rep: number }> = {
  A: { icon: '🥇', titulo: 'Mes sobresaliente', frase: 'Todo en término, clientes contentos y números en orden. Así se construye un estudio.', rep: 2 },
  B: { icon: '🥈', titulo: 'Muy buen mes', frase: 'Casi perfecto. Un detalle más y es un mes de manual.', rep: 1 },
  C: { icon: '🙂', titulo: 'Mes cumplidor', frase: 'Se zafó. Revisá qué vencimientos se escaparon y repartí mejor el trabajo.', rep: 0 },
  D: { icon: '😬', titulo: 'Mes flojo', frase: 'Varias cosas fuera de término o la caja sufrió. Los clientes empiezan a mirar para otro lado.', rep: -1.5 },
  F: { icon: '🚨', titulo: 'Mes para el olvido', frase: 'Multas, atrasos y clientes enojados. Hay que frenar la pelota: priorizá, delegá o reclamá papeles antes.', rep: -3 },
};

export const mesActual = (s: GameState) => monthKey(s.date);
