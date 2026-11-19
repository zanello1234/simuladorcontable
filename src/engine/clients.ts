// Generación de clientes, prospectos y honorarios de referencia.
import { addBusinessDays } from './calendar';
import { HONORARIO_BASE, HONORARIO_POR_100_COMPROBANTES, HONORARIO_POR_EMPLEADO, MONOTRIBUTO_CATEGORIAS, NIVEL_POR_KIND, RECARGO_CONVENIO } from './config';
import { avatar, cuit, nombrePersona, razonSocial } from './names';
import { horasMensualesEstimadas } from './obligations';
import type { Rng } from './rng';
import type { Client, ClientKind, ISODate, Prospect, Rubro } from './types';

const RUBROS: Rubro[] = ['comercio', 'servicios', 'gastronomia', 'construccion', 'agro', 'industria', 'salud', 'transporte'];
const RIESGO_RUBRO: Record<Rubro, number> = { comercio: 0.15, servicios: 0.1, gastronomia: 0.3, construccion: 0.3, agro: 0.2, industria: 0.15, salud: 0.12, transporte: 0.22 };

export const redondear = (n: number, a = 1000) => Math.round(n / a) * a;

export function honorarioReferencia(c: Pick<Client, 'kind' | 'empleados' | 'volumen' | 'jurisdiccion'>, indice: number): number {
  let h = HONORARIO_BASE[c.kind] + c.empleados * HONORARIO_POR_EMPLEADO + (Math.max(0, c.volumen - 50) / 100) * HONORARIO_POR_100_COMPROBANTES;
  if (c.jurisdiccion === 'convenio') h *= RECARGO_CONVENIO;
  return redondear(h * indice);
}

export interface GenOpts {
  kind?: ClientKind;
  rubro?: Rubro;
  nivel: number;
  hoy: ISODate;
  indice: number;
  id: string;
  grande?: boolean;
}

export function generarCliente(rng: Rng, o: GenOpts): Client {
  const kinds: { item: ClientKind; w: number }[] = [
    { item: 'monotributista', w: o.grande ? 0 : 34 },
    { item: 'ri_persona', w: o.grande ? 5 : 30 },
    { item: 'srl', w: 16 + (o.grande ? 20 : 0) },
    { item: 'sas', w: 12 + (o.grande ? 10 : 0) },
    { item: 'sa', w: o.nivel >= NIVEL_POR_KIND.sa ? 8 + (o.grande ? 30 : 0) : 0 },
  ];
  const kind = o.kind ?? rng.weighted(kinds);
  const rubro = o.rubro ?? rng.pick(RUBROS);
  const persona = kind === 'monotributista' || kind === 'ri_persona';
  const gen = rng.chance(0.5) ? 'f' : 'm';
  const titular = nombrePersona(rng, gen).nombre;
  const nombre = razonSocial(rng, kind, rubro, titular);
  const [eMin, eMax] = { monotributista: [0, 1], ri_persona: [0, 3], srl: [2, 12], sas: [1, 8], sa: [8, 35] }[kind];
  const [vMin, vMax] = { monotributista: [10, 45], ri_persona: [40, 200], srl: [80, 380], sas: [60, 300], sa: [220, 850] }[kind];
  let empleados = rng.int(eMin, eMax);
  if (kind === 'monotributista' && rng.chance(0.75)) empleados = 0;
  const grandeMult = o.grande ? 1.5 : 1;
  const c: Client = {
    id: o.id,
    nombre,
    cuit: cuit(rng, persona ? gen : 'soc'),
    kind,
    rubro,
    jurisdiccion: !persona && o.nivel >= 2 && rng.chance(0.3) ? 'convenio' : kind === 'ri_persona' && o.nivel >= 2 && rng.chance(0.1) ? 'convenio' : 'local',
    empleados: Math.round(empleados * grandeMult),
    volumen: Math.round(rng.int(vMin, vMax) * grandeMult),
    ordenDocumental: Math.round(Math.min(0.97, Math.max(0.08, rng.next() * 0.6 + rng.next() * 0.4)) * 100) / 100,
    pagador: Math.round(Math.min(0.98, Math.max(0.15, rng.next() * 0.5 + rng.next() * 0.5)) * 100) / 100,
    honorario: 0,
    honorarioActualizadoEl: o.hoy,
    honorarioIndice: o.indice,
    satisfaccion: 65,
    desde: o.hoy,
    riesgoFiscal: Math.round((RIESGO_RUBRO[rubro] + rng.next() * 0.15) * 100) / 100,
    erroresLatentes: [],
    cierre: persona ? undefined : rng.chance(0.6) ? 12 : rng.pick([3, 6, 9, 4, 7, 10]),
    categoria: kind === 'monotributista' ? MONOTRIBUTO_CATEGORIAS[rng.int(0, 6)].cat : undefined,
    avatar: avatar(rng, gen),
    activo: false,
  };
  c.honorario = honorarioReferencia(c, o.indice);
  return c;
}

const ORIGENES: { item: Prospect['origen']; w: number }[] = [
  { item: 'referido', w: 0 },
  { item: 'web', w: 3 },
  { item: 'redes', w: 3 },
  { item: 'networking', w: 2 },
  { item: 'colega', w: 2 },
  { item: 'camara', w: 0 },
];

function mensajeProspecto(rng: Rng, c: Client, origen: Prospect['origen'], referidoPor?: string): string {
  const quien = c.nombre.split(' (')[0];
  const intros: Record<Prospect['origen'], string[]> = {
    referido: [`Hola, me pasó tu contacto ${referidoPor ?? 'un conocido'}, dice que sos un fenómeno.`, `${referidoPor ?? 'Un cliente tuyo'} me recomendó tu estudio.`],
    web: ['Vi tu página y quería pedir presupuesto.', 'Te encontré buscando "contador en Rosario".'],
    redes: ['Te sigo en Instagram, me encantan tus posteos de vencimientos.', 'Vi tu reel sobre monotributo y me sentí identificado/a.'],
    networking: ['Nos conocimos en el after de la Cámara, ¿te acordás?', 'Hablamos en el evento de emprendedores.'],
    colega: ['Un colega que se jubila me derivó con vos.', 'Mi contador anterior cerró el estudio y me pasó tu nombre.'],
    camara: ['Te escuché en la charla de la Cámara Empresaria. Necesitamos un estudio serio.', 'Somos socios de la Cámara y estamos cambiando de asesor.'],
  };
  const problemas = [
    'Mi contador anterior no me contesta el WhatsApp desde marzo.',
    'Tengo intimaciones de ARCA que no entiendo.',
    'Estamos creciendo y la planilla ya no da más.',
    'Necesito que alguien me ordene los papeles.',
    'Me quiero dedicar a vender y no a pelearme con los vencimientos.',
    'Quiero saber si estoy pagando de más.',
    'Arrancamos con la empresa y no sabemos por dónde empezar.',
  ];
  return `${rng.pick(intros[origen])} Soy ${quien}. ${rng.pick(problemas)}`;
}

function pistaOrden(c: Client): string {
  const o = c.ordenDocumental;
  const p = c.pagador;
  const docs = o > 0.72 ? 'Llegó con una carpeta con índice y los PDFs nombrados por mes.' : o > 0.45 ? 'Tiene los papeles más o menos al día.' : o > 0.25 ? 'Los comprobantes están "en algún mail".' : 'Trajo una bolsa de supermercado llena de tickets.';
  const pago = p > 0.75 ? 'Pregunta cuándo y cómo te transfiere.' : p > 0.45 ? 'Pide factura a fin de mes.' : 'Comenta que el estudio anterior "le cobraba carísimo"... y que les debe unos meses.';
  return `${docs} ${pago}`;
}

export function generarProspecto(rng: Rng, o: GenOpts & { referidoPor?: string; origen?: Prospect['origen'] }): Prospect {
  const origen = o.origen ?? (o.referidoPor ? 'referido' : rng.weighted(ORIGENES));
  const c = generarCliente(rng, { ...o, grande: o.grande || origen === 'camara' });
  if (origen === 'referido') {
    c.pagador = Math.min(0.98, c.pagador + 0.15);
    c.satisfaccion = 72;
  }
  return {
    id: `p${o.id}`,
    llego: o.hoy,
    expira: addBusinessDays(o.hoy, 7),
    origen,
    mensaje: mensajeProspecto(rng, c, origen, o.referidoPor),
    client: c,
    honorarioReferencia: honorarioReferencia(c, o.indice),
    horasEstimadas: horasMensualesEstimadas(c),
    pista: pistaOrden(c),
  };
}

/** Probabilidad de que el prospecto acepte un honorario dado. */
export function probabilidadAceptacion(honorario: number, referencia: number, reputacion: number, conCrm: boolean, origen: Prospect['origen']): number {
  const r = honorario / referencia;
  let p = 0.95 - (r - 0.8) * 1.15 + (reputacion - 50) / 220;
  if (conCrm) p += 0.05;
  if (origen === 'referido') p += 0.1;
  return Math.max(0.03, Math.min(0.97, p));
}
