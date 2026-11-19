// Nueva partida.
import { addBusinessDays, adjustToBusinessDay, monthKey, ymd } from './calendar';
import { ANIO_INICIAL, DIFICULTAD, SAVE_VERSION } from './config';
import { generarCliente, honorarioReferencia } from './clients';
import { cuit } from './names';
import { avatar as genAvatar } from './names';
import { generarTareasDelMes } from './obligations';
import { makeRng } from './rng';
import { asignacionAutomatica } from './simulation';
import { asignarObligatoriasDelMes } from './titular';
import { PROGRESO_INICIAL } from './progression';
import { generarCandidatos, titular } from './staff';
import type { Client, GameState, Message, NewGameConfig } from './types';

export function newGame(cfg: NewGameConfig): GameState {
  const seed = cfg.seed ?? Math.floor(Math.random() * 2 ** 31);
  const rng = makeRng(seed);
  // arranca el año laboral: primer lunes de marzo ("después del verano")
  const hoy = adjustToBusinessDay(ymd(ANIO_INICIAL, 3, 1));
  const dif = DIFICULTAD[cfg.dificultad];
  let seq = 0;
  const id = (p: string) => `${p}${++seq}`;

  const av = cfg.avatar ?? genAvatar(rng);
  const propio: Client = {
    id: 'estudio',
    nombre: `${cfg.nombreEstudio} (estudio propio)`,
    cuit: cuit(rng, 'm'),
    kind: 'monotributista',
    rubro: 'servicios',
    jurisdiccion: 'local',
    empleados: 0,
    volumen: 15,
    ordenDocumental: 1,
    pagador: 1,
    honorario: 0,
    honorarioActualizadoEl: hoy,
    honorarioIndice: 1,
    satisfaccion: 100,
    desde: hoy,
    riesgoFiscal: 0.05,
    erroresLatentes: [],
    categoria: 'C',
    avatar: av,
    activo: true,
    propio: true,
  };

  // cartera inicial: los clientes que te llevaste de tu último trabajo
  const base = { nivel: 1, hoy, indice: 1 };
  const iniciales: Client[] = [
    { ...generarCliente(rng, { ...base, id: id('c'), kind: 'monotributista', rubro: 'servicios' }), ordenDocumental: 0.85, pagador: 0.9 },
    { ...generarCliente(rng, { ...base, id: id('c'), kind: 'ri_persona', rubro: 'comercio' }), ordenDocumental: 0.6, pagador: 0.7, empleados: 1 },
    { ...generarCliente(rng, { ...base, id: id('c'), kind: 'srl', rubro: 'gastronomia' }), ordenDocumental: 0.3, pagador: 0.55, empleados: 4, volumen: 180 },
    { ...generarCliente(rng, { ...base, id: id('c'), kind: 'monotributista', rubro: 'comercio' }), ordenDocumental: 0.4, pagador: 0.45 },
    { ...generarCliente(rng, { ...base, id: id('c'), kind: 'ri_persona', rubro: 'salud' }), ordenDocumental: 0.75, pagador: 0.85, empleados: 0 },
    { ...generarCliente(rng, { ...base, id: id('c'), kind: 'sas', rubro: 'servicios' }), ordenDocumental: 0.55, pagador: 0.7, empleados: 2, volumen: 120, cierre: 12 },
  ];
  for (const c of iniciales) {
    c.activo = true;
    c.honorario = Math.round((honorarioReferencia(c, 1) * 0.92) / 1000) * 1000;
    c.satisfaccion = 68;
  }

  const s: GameState = {
    version: SAVE_VERSION,
    rngState: rng.state(),
    tick: 0,
    date: hoy,
    hour: 9,
    speed: 0,
    estudio: {
      nombre: cfg.nombreEstudio,
      titular: cfg.titular,
      especialidad: cfg.especialidad,
      dificultad: cfg.dificultad,
      caja: dif.caja,
      reputacion: 30,
      nivel: 1,
      oficina: 0,
      marketing: 0,
      condicion: 'monotributista',
      diasEnRojo: 0,
      idle: 'networking',
      politicaRevision: 'criticas',
      autoAsignar: true,
      nroFactura: 0,
      inicio: hoy,
      faltasEticas: 0,
    },
    clients: [propio, ...iniciales],
    workers: [titular(cfg.titular, cfg.especialidad, av, hoy)],
    candidates: [],
    tasks: [],
    prospects: [],
    tools: [],
    ledger: [],
    invoices: [],
    monthly: [],
    inbox: [],
    events: [],
    flags: { arcaCaida: false, corteLuz: false, prorroga: false },
    inflacion: { mensual: dif.inflacion, indice: 1, historia: [] },
    fx: [],
    fxSeq: 0,
    stats: { presentadasATiempo: 0, presentadasTarde: 0, multasPagadas: 0, inspeccionesSuperadas: 0, inspeccionesConAjuste: 0, clientesGanados: 0, clientesPerdidos: 0, minijuegosJugados: 0, mejorCaja: dif.caja },
    tutorial: [],
    progreso: { ...PROGRESO_INICIAL, misiones: [], logros: [], notas: [] },
    horasCliente: {},
    objetivos: [],
    idSeq: 100,
  };

  const nuevoId = () => {
    s.idSeq += 1;
    return `t${s.idSeq}`;
  };
  const mes = monthKey(hoy);
  for (const c of s.clients) s.tasks.push(...generarTareasDelMes(rng, c, mes, hoy, nuevoId));
  asignarObligatoriasDelMes(s, rng, s.tasks);
  // lo que vence en la primera semana ya tiene los papeles (no es justo empezar con un incendio imposible)
  const limite = addBusinessDays(hoy, 4);
  for (const t of s.tasks) {
    if (t.vence <= limite) {
      t.docsLlegan = hoy;
      t.docsRecibidos = true;
    }
  }
  s.candidates = generarCandidatos(rng, 1, 1, () => {
    s.idSeq += 1;
    return `w${s.idSeq}`;
  });
  s.rngState = rng.state();
  asignacionAutomatica(s);

  const bienvenida: Omit<Message, 'id'>[] = [
    {
      date: hoy,
      hour: 9,
      canal: 'sistema',
      de: 'Partida Doble',
      asunto: `👋 Bienvenido/a a ${cfg.nombreEstudio}`,
      cuerpo:
        'Arrancás con 6 clientes que te siguieron desde tu último trabajo, una notebook y la mesa del living.\n\n' +
        '• El reloj corre: cada obligación tiene vencimiento. Si vence sin presentar, hay multa.\n' +
        '• Cada tarea pasa por: recopilar papeles → carga → liquidación → revisión → presentación.\n' +
        '• Podés hacer las liquidaciones vos mismo con el botón 🎮 "Hacerla yo" (modo simulador).\n' +
        '• Facturá los abonos a principio de mes, cobrá, pagá sueldos y gastos.\n' +
        '• Sumá clientes, contratá gente y herramientas (¡incluida IA!) para crecer.\n\n' +
        'Tip: cuando no tenés tareas, hacés networking y aparecen más prospectos.',
      leido: false,
      importante: true,
    },
  ];
  s.inbox = bienvenida.map((m, i) => ({ ...m, id: `m${i + 1}` }));
  return s;
}
