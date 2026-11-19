// Generación del caso de IVA mensual (RI) y cálculo de la solución — funciones puras.
import { makeRng, type Rng } from '../../engine/rng';
import { money2, r2 } from '../../engine/format';
import { lastDayOfMonth, periodoLabel } from '../../engine/calendar';
import type { Client, ClientKind, Rubro } from '../../engine/types';
import type { MinigameResult } from '../types';

export type Clasif = 'debito' | 'credito' | 'no_computa';
export type TipoComp = 'FA' | 'FB' | 'FC' | 'NCA' | 'NCB';

export const TIPO_LABEL: Record<TipoComp, string> = {
  FA: 'Factura A',
  FB: 'Factura B',
  FC: 'Factura C',
  NCA: 'Nota de crédito A',
  NCB: 'Nota de crédito B',
};

export const CLASIF_LABEL: Record<Clasif, string> = {
  debito: 'Débito fiscal',
  credito: 'Crédito fiscal',
  no_computa: 'No computa',
};

export type CategoriaComp = 'venta_a' | 'venta_b' | 'nc_emitida' | 'compra' | 'compra_percep' | 'compra_b' | 'compra_c' | 'no_vinculada' | 'nc_recibida';

export interface Comprobante {
  id: string;
  fecha: string; // ISO
  tipo: TipoComp;
  sentido: 'emitido' | 'recibido';
  numero: string;
  contraparte: string;
  condicion: 'RI' | 'Consumidor final' | 'Monotributo';
  concepto: string;
  /** neto gravado (para B/C recibidas: total, porque no discrimina) */
  neto: number;
  alicuota: number;
  /** IVA discriminado (o débito contenido en Factura B emitida). 0 si no discrimina. */
  iva: number;
  /** IVA que se suma si se clasifica como débito o crédito (en B/C recibidas: el "IVA contenido" que alguien computaría mal) */
  ivaAplicable: number;
  discrimina: boolean;
  percepcion?: number;
  total: number;
  signo: 1 | -1;
  /** clasificaciones aceptadas como correctas (la primera es la "canónica") */
  aceptadas: Clasif[];
  explicacion: string;
  categoria: CategoriaComp;
}

export type TipoPago = 'ret_iva' | 'percep_iva' | 'ret_gan' | 'percep_iibb';

export interface PagoACuenta {
  id: string;
  tipo: TipoPago;
  titulo: string;
  detalle: string;
  monto: number;
  corresponde: boolean;
  explicacion: string;
}

export interface Resultado {
  aPagar: number;
  stFavor: number;
  sld: number;
}

export type ErrorResultado = 'sin_saldo_ant' | 'suma_saldo_ant' | 'con_gan' | 'computa_no_computables' | 'sin_percep' | 'nc_signo' | 'sin_pagos';

export interface OpcionResultado {
  id: string;
  resultado: Resultado;
  label: string;
  correcta: boolean;
  error?: ErrorResultado;
}

export interface CasoIva {
  periodo: string;
  periodoLabel: string;
  comprobantes: Comprobante[];
  pagos: PagoACuenta[];
  saldoAnterior: number;
  solucion: { df: number; cf: number; saldoTecnico: number; pagosACuenta: number; resultado: Resultado };
  opciones: OpcionResultado[];
}

// ----------------------------------------------------------------------------- cálculo

/** Aporte de un comprobante a DF/CF según cómo lo clasificó el jugador. */
export function aporte(c: Comprobante, cl: Clasif | undefined): { df: number; cf: number } {
  if (!cl || cl === 'no_computa') return { df: 0, cf: 0 };
  const v = c.ivaAplicable;
  if (cl === 'debito') return { df: c.sentido === 'emitido' ? c.signo * v : v, cf: 0 };
  return { df: 0, cf: c.sentido === 'recibido' ? c.signo * v : v };
}

export function totales(comps: Comprobante[], clasif: Record<string, Clasif | undefined>): { df: number; cf: number } {
  let df = 0;
  let cf = 0;
  for (const c of comps) {
    const a = aporte(c, clasif[c.id]);
    df += a.df;
    cf += a.cf;
  }
  return { df: r2(df), cf: r2(cf) };
}

/** Determinación: saldo técnico (DF − CF − saldo a favor anterior) y luego pagos a cuenta. */
export function determinar(df: number, cf: number, saldoAnterior: number, pagos: number): Resultado {
  const st = r2(df - cf - saldoAnterior);
  if (st > 0) {
    const f = r2(st - pagos);
    return f >= 0 ? { aPagar: f, stFavor: 0, sld: 0 } : { aPagar: 0, stFavor: 0, sld: r2(-f) };
  }
  return { aPagar: 0, stFavor: r2(-st), sld: r2(pagos) };
}

export function labelResultado(r: Resultado): string {
  if (r.aPagar > 0) return `Saldo a pagar: ${money2(r.aPagar)}`;
  const parts: string[] = [];
  if (r.stFavor > 0) parts.push(`Saldo técnico a favor: ${money2(r.stFavor)}`);
  if (r.sld > 0) parts.push(`Libre disponibilidad a favor: ${money2(r.sld)}`);
  return parts.length ? parts.join(' · ') : 'Sin saldo: la DDJJ da cero';
}

const mismoResultado = (a: Resultado, b: Resultado) =>
  Math.abs(a.aPagar - b.aPagar) < 1 && Math.abs(a.stFavor - b.stFavor) < 1 && Math.abs(a.sld - b.sld) < 1;

export const EXPLICACION_ERROR: Record<ErrorResultado, string> = {
  sin_saldo_ant: 'No restaste el saldo técnico a favor del período anterior: se arrastra y se compensa contra el saldo técnico de este mes, antes de los pagos a cuenta.',
  suma_saldo_ant: 'Sumaste el saldo técnico a favor del período anterior en vez de restarlo: es un crédito a tu favor que reduce el impuesto.',
  con_gan: 'Computaste una retención que no es de IVA (Ganancias/IIBB): cada retención o percepción es pago a cuenta solo del impuesto al que corresponde.',
  computa_no_computables: 'Computaste crédito fiscal de comprobantes que no lo generan (Factura B/C o gasto no vinculado con la actividad gravada).',
  sin_percep: 'No computaste la percepción de IVA que te hicieron en una compra: es un pago a cuenta del período.',
  nc_signo: 'Sumaste la nota de crédito emitida al débito fiscal: una NC emitida lo reduce.',
  sin_pagos: 'No restaste los pagos a cuenta (retenciones y percepciones de IVA): se imputan después del saldo técnico.',
};

// ----------------------------------------------------------------------------- datos para generar

const PROVEEDORES_RI = [
  'Distribuidora Litoral SA',
  'Mayorista Rosario SRL',
  'Logística Paraná SA',
  'Papelera Central SRL',
  'Transportes Ruta 9 SRL',
  'Servicios Integrales Pampa SAS',
  'Insumos del Sur SRL',
  'Tecnología Rosarina SAS',
  'Telecomunicaciones del Litoral SA',
  'Inmobiliaria Oroño SRL',
];
const CLIENTES_RI = [
  'Constructora Pellegrini SA',
  'Agroservicios Casilda SRL',
  'Supermercados del Norte SA',
  'Metalúrgica Funes SRL',
  'Clínica San Lorenzo SA',
  'Hotel Puerto Norte SAS',
  'Cooperativa Agrícola Arroyo Seco',
  'Estudio Jurídico Córdoba & Asoc. SRL',
];
const MONOTRIBUTISTAS = [
  ['Juan Pérez', 'Flete urbano'],
  ['Lucía Gómez', 'Diseño gráfico del catálogo'],
  ['Carlos Ibarra', 'Reparación eléctrica del local'],
  ['Marta Sosa', 'Servicio de limpieza mensual'],
  ['Diego Romero', 'Arreglo de plomería'],
  ['Valeria Ruiz', 'Catering para reunión con clientes'],
] as const;
const COMERCIOS_B = [
  ['Supermercado El Ahorro', 'Compra de artículos de limpieza (ticket factura B)'],
  ['Estación de Servicio Ruta 33', 'Combustible (te dieron factura B)'],
  ['Librería Del Centro', 'Útiles de oficina (factura B)'],
  ['Corralón San Martín', 'Materiales varios (factura B)'],
] as const;
const NO_VINCULADOS = [
  'Televisor 65" para la casa del socio',
  'Paquete turístico familiar a Bariloche',
  'Muebles para la casa quinta del titular',
  'Bicicleta para el hijo del socio',
];

const VENTAS: Record<Rubro, { concepto: string; alic: number }[]> = {
  comercio: [
    { concepto: 'Venta de mercadería', alic: 0.21 },
    { concepto: 'Venta mayorista de artículos de ferretería', alic: 0.21 },
    { concepto: 'Venta de electrodomésticos', alic: 0.21 },
  ],
  servicios: [
    { concepto: 'Servicio de consultoría', alic: 0.21 },
    { concepto: 'Mantenimiento mensual de sistemas', alic: 0.21 },
    { concepto: 'Servicio de capacitación in company', alic: 0.21 },
  ],
  gastronomia: [
    { concepto: 'Servicio de catering para evento', alic: 0.21 },
    { concepto: 'Consumos del salón', alic: 0.21 },
  ],
  construccion: [
    { concepto: 'Certificado de obra — local comercial', alic: 0.21 },
    { concepto: 'Certificado de obra — vivienda', alic: 0.105 },
  ],
  agro: [
    { concepto: 'Venta de granos (soja)', alic: 0.105 },
    { concepto: 'Labores de cosecha a terceros', alic: 0.105 },
    { concepto: 'Venta de rollos de alfalfa', alic: 0.105 },
  ],
  industria: [
    { concepto: 'Venta de productos terminados', alic: 0.21 },
    { concepto: 'Venta de piezas mecanizadas', alic: 0.21 },
  ],
  salud: [
    { concepto: 'Venta de insumos médicos', alic: 0.21 },
    { concepto: 'Alquiler de equipamiento médico', alic: 0.21 },
  ],
  transporte: [
    { concepto: 'Flete de carga Rosario – Buenos Aires', alic: 0.21 },
    { concepto: 'Servicio de logística y almacenaje', alic: 0.21 },
  ],
};

const COMPRAS: Record<Rubro, string[]> = {
  comercio: ['Compra de mercadería para reventa', 'Flete de mercadería', 'Alquiler del local'],
  servicios: ['Licencias de software', 'Alquiler de oficina', 'Servicio de internet empresarial'],
  gastronomia: ['Compra de insumos de cocina', 'Bebidas para reventa', 'Mantenimiento de cámara de frío'],
  construccion: ['Cemento y hierro', 'Alquiler de maquinaria', 'Subcontrato de electricidad'],
  agro: ['Semillas y agroquímicos', 'Reparación de cosechadora', 'Gasoil para maquinaria'],
  industria: ['Materia prima (acero)', 'Energía eléctrica industrial', 'Mantenimiento de tornos'],
  salud: ['Insumos descartables', 'Service de equipos', 'Alquiler del consultorio'],
  transporte: ['Neumáticos para camiones', 'Reparación de unidad', 'Seguro de flota'],
};

const ESCALA_KIND: Record<ClientKind, number> = { monotributista: 0.6, ri_persona: 1, srl: 1.8, sas: 1.5, sa: 3 };

const pad = (n: number, w: number) => String(n).padStart(w, '0');

function fechaEn(rng: Rng, periodo: string): string {
  const [y, m] = periodo.split('-').map(Number);
  const d = rng.int(1, lastDayOfMonth(y, m));
  return `${y}-${pad(m, 2)}-${pad(d, 2)}`;
}

/** Normaliza el período: si no es 'YYYY-MM' usa enero del año que contenga. */
function normPeriodo(p: string): string {
  if (/^\d{4}-\d{2}$/.test(p)) return p;
  const y = /^\d{4}/.test(p) ? p.slice(0, 4) : '2027';
  return `${y}-01`;
}

// ----------------------------------------------------------------------------- generación

export function generarCasoIva(seed: number, client: Pick<Client, 'nombre' | 'rubro' | 'kind' | 'volumen'>, periodoIn: string, indice: number): CasoIva {
  const rng = makeRng(seed);
  const periodo = normPeriodo(periodoIn);
  const s = (ESCALA_KIND[client.kind] ?? 1) * Math.max(0.2, indice);
  const monto = (min: number, max: number) => r2(rng.range(min, max) * s);

  const n = Math.max(8, Math.min(16, Math.round(8 + (client.volumen || 0) / 40)));
  const nBC = n >= 12 ? 2 : 1;
  const nNCRec = n >= 11 ? 1 : 0;
  const fijos = 1 /* NC emitida */ + 1 /* compra con percepción */ + 1 /* no vinculada */ + nBC + nNCRec;
  const resto = Math.max(4, n - fijos);
  const nVentas = Math.max(2, Math.ceil(resto * 0.55));
  const nCompras = Math.max(2, resto - nVentas);

  const comps: Omit<Comprobante, 'id'>[] = [];
  const ventasRubro = VENTAS[client.rubro] ?? VENTAS.comercio;
  const comprasRubro = COMPRAS[client.rubro] ?? COMPRAS.comercio;
  let nroPropio = rng.int(120, 4800);
  const pvPropio = pad(rng.int(1, 5), 4);
  const nroEmit = () => `${pvPropio}-${pad(++nroPropio, 8)}`;
  const nroRec = () => `${pad(rng.int(1, 12), 4)}-${pad(rng.int(1000, 99999), 8)}`;

  // --- ventas
  const ventasA: Omit<Comprobante, 'id'>[] = [];
  for (let i = 0; i < nVentas; i++) {
    const v = rng.pick(ventasRubro);
    const esB = i > 0 && rng.chance(0.35);
    const neto = esB ? monto(40_000, 420_000) : monto(260_000, 1_650_000);
    const iva = r2(neto * v.alic);
    const c: Omit<Comprobante, 'id'> = esB
      ? {
          fecha: fechaEn(rng, periodo),
          tipo: 'FB',
          sentido: 'emitido',
          numero: nroEmit(),
          contraparte: 'Consumidor final',
          condicion: 'Consumidor final',
          concepto: v.concepto,
          neto,
          alicuota: v.alic,
          iva,
          ivaAplicable: iva,
          discrimina: false,
          total: r2(neto + iva),
          signo: 1,
          aceptadas: ['debito'],
          explicacion: 'Factura B a consumidor final: no discrimina IVA, pero el débito fiscal existe igual (está contenido en el precio).',
          categoria: 'venta_b',
        }
      : {
          fecha: fechaEn(rng, periodo),
          tipo: 'FA',
          sentido: 'emitido',
          numero: nroEmit(),
          contraparte: rng.pick(CLIENTES_RI),
          condicion: 'RI',
          concepto: v.concepto,
          neto,
          alicuota: v.alic,
          iva,
          ivaAplicable: iva,
          discrimina: true,
          total: r2(neto + iva),
          signo: 1,
          aceptadas: ['debito'],
          explicacion: 'Factura A emitida a un Responsable Inscripto: el IVA facturado es débito fiscal.',
          categoria: 'venta_a',
        };
    comps.push(c);
    if (c.tipo === 'FA') ventasA.push(c);
  }

  // --- NC emitida (sobre una venta A)
  {
    const base = ventasA[0];
    const neto = r2(base.neto * rng.range(0.05, 0.15));
    const iva = r2(neto * base.alicuota);
    comps.push({
      fecha: fechaEn(rng, periodo),
      tipo: 'NCA',
      sentido: 'emitido',
      numero: nroEmit(),
      contraparte: base.contraparte,
      condicion: 'RI',
      concepto: 'Bonificación por pronto pago',
      neto,
      alicuota: base.alicuota,
      iva,
      ivaAplicable: iva,
      discrimina: true,
      total: r2(neto + iva),
      signo: -1,
      aceptadas: ['debito', 'credito'],
      explicacion: 'Nota de crédito emitida: reduce el débito fiscal (o se computa como crédito fiscal; el efecto en el saldo es el mismo).',
      categoria: 'nc_emitida',
    });
  }

  // --- compras computables
  const comprasA: Omit<Comprobante, 'id'>[] = [];
  for (let i = 0; i < nCompras; i++) {
    const neto = monto(70_000, 720_000);
    const alic = client.rubro === 'agro' && rng.chance(0.4) ? 0.105 : 0.21;
    const iva = r2(neto * alic);
    const c: Omit<Comprobante, 'id'> = {
      fecha: fechaEn(rng, periodo),
      tipo: 'FA',
      sentido: 'recibido',
      numero: nroRec(),
      contraparte: rng.pick(PROVEEDORES_RI),
      condicion: 'RI',
      concepto: rng.pick(comprasRubro),
      neto,
      alicuota: alic,
      iva,
      ivaAplicable: iva,
      discrimina: true,
      total: r2(neto + iva),
      signo: 1,
      aceptadas: ['credito'],
      explicacion: 'Factura A de un proveedor RI, vinculada con tu actividad gravada: el IVA discriminado es crédito fiscal.',
      categoria: 'compra',
    };
    comps.push(c);
    comprasA.push(c);
  }

  // --- compra con percepción de IVA
  let percepcionMonto = 0;
  let percepcionProv = '';
  {
    const neto = monto(160_000, 640_000);
    const iva = r2(neto * 0.21);
    percepcionMonto = r2(neto * 0.03);
    percepcionProv = rng.pick(PROVEEDORES_RI.slice(0, 4));
    comps.push({
      fecha: fechaEn(rng, periodo),
      tipo: 'FA',
      sentido: 'recibido',
      numero: nroRec(),
      contraparte: percepcionProv,
      condicion: 'RI',
      concepto: rng.pick(comprasRubro),
      neto,
      alicuota: 0.21,
      iva,
      ivaAplicable: iva,
      discrimina: true,
      percepcion: percepcionMonto,
      total: r2(neto + iva + percepcionMonto),
      signo: 1,
      aceptadas: ['credito'],
      explicacion: 'Factura A con percepción: el IVA discriminado es crédito fiscal; la percepción va aparte, como pago a cuenta.',
      categoria: 'compra_percep',
    });
  }

  // --- compras B / C (no generan crédito)
  for (let i = 0; i < nBC; i++) {
    const esC = i === 0 ? rng.chance(0.6) : true;
    const total = monto(30_000, 260_000);
    if (esC) {
      const [nom, conc] = rng.pick(MONOTRIBUTISTAS);
      comps.push({
        fecha: fechaEn(rng, periodo),
        tipo: 'FC',
        sentido: 'recibido',
        numero: nroRec(),
        contraparte: nom,
        condicion: 'Monotributo',
        concepto: conc,
        neto: total,
        alicuota: 0,
        iva: 0,
        ivaAplicable: r2(total - total / 1.21),
        discrimina: false,
        total,
        signo: 1,
        aceptadas: ['no_computa'],
        explicacion: 'Factura C de un monotributista: no hay IVA discriminado, así que no genera crédito fiscal.',
        categoria: 'compra_c',
      });
    } else {
      const [nom, conc] = rng.pick(COMERCIOS_B);
      comps.push({
        fecha: fechaEn(rng, periodo),
        tipo: 'FB',
        sentido: 'recibido',
        numero: nroRec(),
        contraparte: nom,
        condicion: 'RI',
        concepto: conc,
        neto: total,
        alicuota: 0,
        iva: 0,
        ivaAplicable: r2(total - total / 1.21),
        discrimina: false,
        total,
        signo: 1,
        aceptadas: ['no_computa'],
        explicacion: 'Factura B recibida: el IVA no está discriminado, así que no podés computarlo como crédito fiscal (para eso tenías que pedir Factura A).',
        categoria: 'compra_b',
      });
    }
  }

  // --- gasto no vinculado (Factura A, pero no computable)
  {
    const neto = monto(380_000, 1_400_000);
    const iva = r2(neto * 0.21);
    comps.push({
      fecha: fechaEn(rng, periodo),
      tipo: 'FA',
      sentido: 'recibido',
      numero: nroRec(),
      contraparte: rng.pick(['Electro Hogar Rosario SA', 'Turismo Patagonia SRL', 'Mueblería Alberdi SRL', 'Bicicletería Fisherton SAS']),
      condicion: 'RI',
      concepto: rng.pick(NO_VINCULADOS),
      neto,
      alicuota: 0.21,
      iva,
      ivaAplicable: iva,
      discrimina: true,
      total: r2(neto + iva),
      signo: 1,
      aceptadas: ['no_computa'],
      explicacion: 'Aunque sea Factura A, es un consumo personal no vinculado con la actividad gravada: ese IVA no es crédito fiscal computable.',
      categoria: 'no_vinculada',
    });
  }

  // --- NC recibida
  if (nNCRec) {
    const base = comprasA[0];
    const neto = r2(base.neto * rng.range(0.06, 0.2));
    const iva = r2(neto * base.alicuota);
    comps.push({
      fecha: fechaEn(rng, periodo),
      tipo: 'NCA',
      sentido: 'recibido',
      numero: nroRec(),
      contraparte: base.contraparte,
      condicion: 'RI',
      concepto: 'Devolución de mercadería / descuento obtenido',
      neto,
      alicuota: base.alicuota,
      iva,
      ivaAplicable: iva,
      discrimina: true,
      total: r2(neto + iva),
      signo: -1,
      aceptadas: ['credito', 'debito'],
      explicacion: 'Nota de crédito recibida: reduce el crédito fiscal que habías computado (es una restitución; si la mostrás como débito el efecto es el mismo).',
      categoria: 'nc_recibida',
    });
  }

  comps.sort((a, b) => (a.fecha === b.fecha ? (a.sentido === b.sentido ? 0 : a.sentido === 'emitido' ? -1 : 1) : a.fecha < b.fecha ? -1 : 1));
  const comprobantes: Comprobante[] = comps.map((c, i) => ({ ...c, id: `c${i + 1}` }));

  // --- solución
  const correctas: Record<string, Clasif> = {};
  for (const c of comprobantes) correctas[c.id] = c.aceptadas[0];
  const { df, cf } = totales(comprobantes, correctas);

  // --- pagos a cuenta
  const pagosArr: Omit<PagoACuenta, 'id'>[] = [];
  const ventaRet = ventasA[ventasA.length - 1];
  const retIva = r2(ventaRet.iva * rng.pick([0.5, 0.8]));
  pagosArr.push({
    tipo: 'ret_iva',
    titulo: 'Certificado de retención de IVA',
    detalle: `Agente de retención: ${ventaRet.contraparte} · cobro de tu factura`,
    monto: retIva,
    corresponde: true,
    explicacion: 'La retención de IVA que te practicó un cliente es un pago a cuenta del impuesto: se resta después del saldo técnico.',
  });
  pagosArr.push({
    tipo: 'percep_iva',
    titulo: 'Percepción de IVA sufrida',
    detalle: `Percibida por ${percepcionProv} en su Factura A`,
    monto: percepcionMonto,
    corresponde: true,
    explicacion: 'La percepción de IVA que te cobró un proveedor es un pago a cuenta del período (no es crédito fiscal).',
  });
  const retGan = r2(ventasA[0].neto * 0.02);
  pagosArr.push({
    tipo: 'ret_gan',
    titulo: 'Certificado de retención de Ganancias',
    detalle: `Agente de retención: ${ventasA[0].contraparte}`,
    monto: retGan,
    corresponde: false,
    explicacion: 'La retención de Ganancias es pago a cuenta de Ganancias, no de IVA.',
  });
  let percIibb = 0;
  if (rng.chance(0.55)) {
    percIibb = r2(comprasA[comprasA.length - 1].neto * 0.025);
    pagosArr.push({
      tipo: 'percep_iibb',
      titulo: 'Percepción de Ingresos Brutos',
      detalle: `Percibida por ${comprasA[comprasA.length - 1].contraparte}`,
      monto: percIibb,
      corresponde: false,
      explicacion: 'La percepción de Ingresos Brutos se computa en la DDJJ de IIBB, no en la de IVA.',
    });
  }
  rng.shuffle(pagosArr);
  const pagos: PagoACuenta[] = pagosArr.map((p, i) => ({ ...p, id: `p${i + 1}` }));
  const pac = r2(retIva + percepcionMonto);

  // --- saldo técnico a favor del período anterior
  const base = Math.max(0, df - cf);
  const saldoAnterior = rng.chance(0.4) ? 0 : r2(base * rng.range(0.05, 0.28));

  const resultado = determinar(df, cf, saldoAnterior, pac);
  const saldoTecnico = r2(df - cf - saldoAnterior);

  // --- opciones de resultado (1 correcta + 2 distractores con errores típicos)
  const ncEmit = comprobantes.filter((c) => c.categoria === 'nc_emitida').reduce((a, c) => a + c.iva, 0);
  const noComputables = comprobantes.filter((c) => c.aceptadas[0] === 'no_computa').reduce((a, c) => a + c.ivaAplicable, 0);
  const candidatos: { error: ErrorResultado; r: Resultado }[] = [
    { error: 'computa_no_computables', r: determinar(df, cf + noComputables, saldoAnterior, pac) },
    { error: 'con_gan', r: determinar(df, cf, saldoAnterior, pac + retGan + percIibb) },
    { error: 'sin_percep', r: determinar(df, cf, saldoAnterior, pac - percepcionMonto) },
    { error: 'nc_signo', r: determinar(df + 2 * ncEmit, cf, saldoAnterior, pac) },
    { error: 'sin_pagos', r: determinar(df, cf, saldoAnterior, 0) },
  ];
  if (saldoAnterior > 0) {
    candidatos.push({ error: 'sin_saldo_ant', r: determinar(df, cf, 0, pac) });
    candidatos.push({ error: 'suma_saldo_ant', r: determinar(df, cf, -saldoAnterior, pac) });
  }
  rng.shuffle(candidatos);
  const elegidos: { error: ErrorResultado; r: Resultado }[] = [];
  for (const c of candidatos) {
    if (elegidos.length >= 2) break;
    if (mismoResultado(c.r, resultado)) continue;
    if (elegidos.some((e) => mismoResultado(e.r, c.r))) continue;
    elegidos.push(c);
  }
  const opcionesArr: Omit<OpcionResultado, 'id'>[] = [
    { resultado, label: labelResultado(resultado), correcta: true },
    ...elegidos.map((e) => ({ resultado: e.r, label: labelResultado(e.r), correcta: false, error: e.error })),
  ];
  rng.shuffle(opcionesArr);
  const opciones = opcionesArr.map((o, i) => ({ ...o, id: `o${i + 1}` }));

  return {
    periodo,
    periodoLabel: periodoLabel(periodo),
    comprobantes,
    pagos,
    saldoAnterior,
    solucion: { df, cf, saldoTecnico, pagosACuenta: pac, resultado },
    opciones,
  };
}

// ----------------------------------------------------------------------------- evaluación

export interface RespuestasIva {
  clasif: Record<string, Clasif | undefined>;
  pagos: Record<string, boolean | undefined>;
  opcionId?: string;
}

export const PESOS_IVA = { clasificacion: 0.6, pagos: 0.2, resultado: 0.2 };

export function respuestasPerfectas(caso: CasoIva): RespuestasIva {
  const clasif: Record<string, Clasif> = {};
  for (const c of caso.comprobantes) clasif[c.id] = c.aceptadas[0];
  const pagos: Record<string, boolean> = {};
  for (const p of caso.pagos) pagos[p.id] = p.corresponde;
  return { clasif, pagos, opcionId: caso.opciones.find((o) => o.correcta)?.id };
}

export function evaluarIva(caso: CasoIva, resp: RespuestasIva): MinigameResult {
  const errores: string[] = [];

  let okClasif = 0;
  for (const c of caso.comprobantes) {
    const cl = resp.clasif[c.id];
    if (cl && c.aceptadas.includes(cl)) okClasif++;
    else {
      const signo = c.signo < 0 ? ' (NC)' : '';
      errores.push(`${TIPO_LABEL[c.tipo]} ${c.numero} — ${c.contraparte}${signo}: ${cl ? `la marcaste como «${CLASIF_LABEL[cl]}». ` : 'quedó sin clasificar. '}${c.explicacion}`);
    }
  }
  let okPagos = 0;
  for (const p of caso.pagos) {
    const sel = !!resp.pagos[p.id];
    if (sel === p.corresponde) okPagos++;
    else errores.push(`${p.titulo} (${money2(p.monto)}): ${sel ? 'la computaste y no correspondía. ' : 'no la computaste. '}${p.explicacion}`);
  }
  const opcion = caso.opciones.find((o) => o.id === resp.opcionId);
  const correcta = caso.opciones.find((o) => o.correcta)!;
  const okRes = !!opcion?.correcta;
  if (!okRes) {
    errores.push(
      `Resultado: ${opcion ? `elegiste «${opcion.label}»` : 'no elegiste resultado'}; lo correcto era «${correcta.label}». ${opcion?.error ? EXPLICACION_ERROR[opcion.error] : ''}`.trim(),
    );
  }

  const nC = caso.comprobantes.length;
  const nP = caso.pagos.length;
  const score = r2(PESOS_IVA.clasificacion * (okClasif / nC) + PESOS_IVA.pagos * (okPagos / nP) + PESOS_IVA.resultado * (okRes ? 1 : 0));
  const s = caso.solucion;
  const resumen = `DF ${money2(s.df)} · CF ${money2(s.cf)} · ${labelResultado(s.resultado)}. Clasificaste bien ${okClasif}/${nC} comprobantes y ${okPagos}/${nP} pagos a cuenta${okRes ? '; resultado correcto.' : '; el resultado no coincide.'}`;
  return { score: Math.min(1, Math.max(0, score)), resumen, errores: errores.length > 8 ? [...errores.slice(0, 8), `…y ${errores.length - 8} observaciones más.`] : errores };
}
