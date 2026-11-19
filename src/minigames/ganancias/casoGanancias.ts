// Caso y solución del minijuego "DDJJ de Ganancias Personas Humanas" (Ley 20.628 t.o.).
// Lógica pura: generar caso, liquidar, evaluar. Montos en pesos de juego escalados por `indice`.
import { money2, r2 } from '../../engine/format';
import { makeRng, type Rng } from '../../engine/rng';
import type { Client } from '../../engine/types';
import type { MinigameResult } from '../types';

// ----------------------------------------------------------------------------- parámetros [A CONFIRMAR]
// Valores de juego en pesos de enero del año inicial; se escalan por `indice`. Contrastar con la tabla
// anual vigente de ARCA (deducciones personales art. 30 y escala art. 94) para máximo realismo.
export const PARAM_BASE = {
  gni: 3_500_000, // ganancia no imponible anual
  conyuge: 0.93, // × GNI
  hijo: 0.47, // × GNI (menor de 18 o incapacitado)
  deSimple: 2, // deducción especial autónomos (× GNI)
  deNuevos: 2.5, // nuevos profesionales / emprendedores (× GNI)
  deIncrementada: 3.8, // deducción especial para rentas de 4ª en relación de dependencia (× GNI)
  seguroVida: 120_000, // tope anual
  sepelio: 120_000, // tope anual
  interesesHipotecarios: 20_000, // tope anual (histórico, muy bajo)
  alicuotaCedular: 0.07, // dividendos
  ley25413: 0.33, // porción del impuesto sobre débitos y créditos computable
};
/** Escala progresiva art. 94: límite superior del tramo (base) y alícuota marginal. */
export const ESCALA_BASE: { hasta: number; alicuota: number }[] = [
  { hasta: 1_600_000, alicuota: 0.05 },
  { hasta: 3_200_000, alicuota: 0.09 },
  { hasta: 4_800_000, alicuota: 0.12 },
  { hasta: 6_400_000, alicuota: 0.15 },
  { hasta: 9_600_000, alicuota: 0.19 },
  { hasta: 12_800_000, alicuota: 0.23 },
  { hasta: 19_200_000, alicuota: 0.27 },
  { hasta: 25_600_000, alicuota: 0.31 },
  { hasta: Infinity, alicuota: 0.35 },
];

export interface Tramo {
  desde: number;
  hasta: number;
  fijo: number;
  alicuota: number;
}
export function escala(indice: number): Tramo[] {
  const out: Tramo[] = [];
  let desde = 0;
  let fijo = 0;
  for (const t of ESCALA_BASE) {
    const hasta = t.hasta === Infinity ? Infinity : Math.round(t.hasta * indice);
    out.push({ desde, hasta, fijo, alicuota: t.alicuota });
    if (hasta !== Infinity) fijo = r2(fijo + (hasta - desde) * t.alicuota);
    desde = hasta;
  }
  return out;
}
export function impuestoEscala(base: number, tramos: Tramo[]): number {
  if (base <= 0) return 0;
  const t = tramos.find((x) => base <= x.hasta) ?? tramos[tramos.length - 1];
  return r2(t.fijo + (base - t.desde) * t.alicuota);
}
export function tramoDe(base: number, tramos: Tramo[]): Tramo {
  return tramos.find((x) => base <= x.hasta) ?? tramos[tramos.length - 1];
}

// ----------------------------------------------------------------------------- tipos del caso

export type Cat = 'c1' | 'c2' | 'c3' | 'c4' | 'no' | 'cedular';
export const CAT_LABEL: Record<Cat, string> = {
  c1: '1ª categoría',
  c2: '2ª categoría',
  c3: '3ª categoría',
  c4: '4ª categoría',
  no: 'Exento / no gravado / no deducible',
  cedular: 'Cedular (dividendos)',
};
export const CAT_CORTO: Record<Cat, string> = { c1: '1ª', c2: '2ª', c3: '3ª', c4: '4ª', no: 'No grav.', cedular: 'Cedular' };

export interface Renta {
  id: string;
  titulo: string;
  detalle: string;
  /** + ingreso · − gasto */
  monto: number;
  cat: Cat;
  explicacion: string;
}

export type TopeTipo = 'ninguno' | 'pct5' | 'gni' | 'alq40' | 'fijo';
export interface Deduccion {
  id: string;
  titulo: string;
  detalle: string;
  monto: number;
  deducible: boolean;
  tope: TopeTipo;
  topeMonto?: number; // para 'fijo'
  explicacion: string;
}

export interface Carga {
  id: string;
  titulo: string;
  detalle: string;
  tipo: 'conyuge' | 'hijo';
  computa: boolean;
  explicacion: string;
}

export interface Pago {
  id: string;
  titulo: string;
  detalle: string;
  monto: number;
  corresponde: boolean;
  /** se descuenta del impuesto a los efectos de los anticipos (retenciones sí; anticipos no) */
  esRetencion: boolean;
  explicacion: string;
}

export interface Opcion {
  id: string;
  monto: number;
  label: string;
  correcta: boolean;
  error?: string;
}

export interface Liquidacion {
  porCat: Record<'c1' | 'c2' | 'c3' | 'c4', number>;
  ganNeta: number;
  dedGenerales: number;
  detalleDG: { id: string; computado: number }[];
  gni: number;
  conyuge: number;
  hijos: number;
  dedEspecial: number;
  tipoDE: 'simple' | 'nuevos' | 'incrementada' | 'mixta';
  gnsi: number;
  impEscala: number;
  dividendos: number;
  impCedular: number;
  impDeterminado: number;
  pagos: number;
  saldo: number; // + a pagar · − a favor
  retenciones: number;
  anticipoProx: number;
}

export interface CasoGanancias {
  periodo: string;
  contribuyente: string;
  nuevoProfesional: boolean;
  param: { gni: number; conyuge: number; hijo: number };
  tramos: Tramo[];
  rentas: Renta[];
  deducciones: Deduccion[];
  cargas: Carga[];
  pagos: Pago[];
  solucion: Liquidacion;
}

export interface Respuestas {
  rentas: Record<string, Cat | undefined>;
  deducciones: Record<string, boolean | undefined>;
  cargas: Record<string, boolean | undefined>;
  impuestoId?: string;
  pagos: Record<string, boolean | undefined>;
  saldoId?: string;
}

// ----------------------------------------------------------------------------- liquidación

const EXPLOTACION: Record<string, string> = {
  comercio: 'del comercio',
  servicios: 'de la consultora',
  gastronomia: 'del restaurante',
  construccion: 'de la constructora',
  agro: 'del campo',
  industria: 'del taller',
  salud: 'del consultorio',
  transporte: 'de la flota de camiones',
};

export function liquidar(caso: CasoGanancias, resp: Respuestas): Liquidacion {
  const porCat = { c1: 0, c2: 0, c3: 0, c4: 0 };
  let dividendos = 0;
  for (const r of caso.rentas) {
    const c = resp.rentas[r.id];
    if (c === 'c1' || c === 'c2' || c === 'c3' || c === 'c4') porCat[c] += r.monto;
    else if (c === 'cedular' && r.monto > 0) dividendos += r.monto;
  }
  // una categoría no puede dar negativa por gastos clasificados de más (quebranto de la categoría se compensa, simplificado)
  const ganNeta = r2(Math.max(0, porCat.c1 + porCat.c2 + porCat.c3 + porCat.c4));
  const { gni } = caso.param;
  const detalleDG: { id: string; computado: number }[] = [];
  let dg = 0;
  for (const d of caso.deducciones) {
    if (!resp.deducciones[d.id]) continue;
    let v = d.monto;
    if (d.tope === 'pct5') v = Math.min(v, ganNeta * 0.05);
    else if (d.tope === 'gni') v = Math.min(v, gni);
    else if (d.tope === 'alq40') v = Math.min(v * 0.4, gni);
    else if (d.tope === 'fijo') v = Math.min(v, d.topeMonto ?? v);
    v = r2(v);
    detalleDG.push({ id: d.id, computado: v });
    dg += v;
  }
  dg = r2(Math.min(dg, ganNeta));
  const restante = r2(ganNeta - dg);
  const gniComp = Math.min(gni, restante);
  let conyuge = 0;
  let hijos = 0;
  for (const c of caso.cargas) {
    if (!resp.cargas[c.id]) continue;
    if (c.tipo === 'conyuge') conyuge += caso.param.conyuge;
    else hijos += caso.param.hijo;
  }
  // deducción especial: simple (3ª+4ª) o incrementada sobre la porción de 4ª en relación de dependencia
  const g34 = Math.max(0, porCat.c3 + porCat.c4);
  const g4 = Math.max(0, porCat.c4);
  const simple = Math.min(g34, gni * (caso.nuevoProfesional ? PARAM_BASE.deNuevos : PARAM_BASE.deSimple));
  const incrementada = Math.min(g4, gni * PARAM_BASE.deIncrementada);
  let dedEspecial = Math.max(simple, incrementada);
  let tipoDE: Liquidacion['tipoDE'] = incrementada > simple ? 'incrementada' : caso.nuevoProfesional ? 'nuevos' : 'simple';
  if (incrementada > simple && porCat.c3 > 0) tipoDE = 'mixta';
  const personales = Math.min(restante, gniComp + conyuge + hijos + dedEspecial);
  dedEspecial = r2(dedEspecial);
  const gnsi = r2(Math.max(0, restante - personales));
  const impEscala = impuestoEscala(gnsi, caso.tramos);
  const impCedular = r2(dividendos * PARAM_BASE.alicuotaCedular);
  const impDeterminado = r2(impEscala + impCedular);
  let pagos = 0;
  let retenciones = 0;
  for (const p of caso.pagos) {
    if (!resp.pagos[p.id]) continue;
    pagos += p.monto;
    if (p.esRetencion) retenciones += p.monto;
  }
  pagos = r2(pagos);
  const saldo = r2(impDeterminado - pagos);
  const anticipoProx = r2(Math.max(0, (impEscala - retenciones) * 0.2));
  return { porCat, ganNeta, dedGenerales: dg, detalleDG, gni: r2(gniComp), conyuge: r2(conyuge), hijos: r2(hijos), dedEspecial, tipoDE, gnsi, impEscala, dividendos, impCedular, impDeterminado, pagos, saldo, retenciones, anticipoProx };
}

// ----------------------------------------------------------------------------- generación

const PERSONAS_F = ['Marta', 'Silvia', 'Carolina', 'Valeria', 'Gabriela'];
const PERSONAS_M = ['Jorge', 'Hernán', 'Pablo', 'Gustavo', 'Alejandro'];

export function generarCasoGanancias(seed: number, client: Pick<Client, 'nombre' | 'rubro' | 'kind' | 'empleados'>, periodo: string, indice: number): CasoGanancias {
  const rng = makeRng(seed);
  const K = (n: number) => Math.round((n * indice) / 100) * 100;
  const gni = K(PARAM_BASE.gni);
  const param = { gni, conyuge: K(PARAM_BASE.gni * PARAM_BASE.conyuge), hijo: K(PARAM_BASE.gni * PARAM_BASE.hijo) };
  const tramos = escala(indice);
  const nuevoProfesional = rng.chance(0.15);
  const nombre = client.nombre.split(' (')[0];
  const expl = EXPLOTACION[client.rubro] ?? 'de la actividad';
  const rentas: Renta[] = [];
  let n = 0;
  const add = (r: Omit<Renta, 'id'>) => rentas.push({ id: `r${++n}`, ...r });

  // --- 3ª categoría: explotación unipersonal (siempre, el cliente es RI)
  const ventas = K(rng.int(38_000, 110_000) * 1000);
  const costo = K(Math.round(ventas * rng.range(0.42, 0.6)));
  const sueldos = client.empleados > 0 ? K(client.empleados * rng.int(9_000, 14_000) * 1000) : 0;
  const gastosGrales = K(Math.round(ventas * rng.range(0.08, 0.14)));
  add({ titulo: `Ventas ${expl}`, detalle: 'Facturación neta de IVA del ejercicio', monto: ventas, cat: 'c3', explicacion: 'El resultado de una explotación unipersonal es renta de 3ª categoría.' });
  add({ titulo: 'Costo de mercadería / insumos', detalle: 'Compras del ejercicio ajustadas por existencias', monto: -costo, cat: 'c3', explicacion: 'Gasto necesario para obtener la renta de 3ª: se deduce de esa categoría.' });
  if (sueldos) add({ titulo: 'Sueldos y cargas sociales del personal', detalle: `${client.empleados} empleado/s`, monto: -sueldos, cat: 'c3', explicacion: 'Los sueldos del personal de la explotación son gasto deducible de 3ª.' });
  add({ titulo: 'Alquiler, servicios y gastos generales', detalle: 'Del local de la actividad', monto: -gastosGrales, cat: 'c3', explicacion: 'Gastos vinculados con la actividad: deducibles de 3ª.' });
  // trampas de 3ª (2 de 4)
  const trampas3: Omit<Renta, 'id'>[] = [
    { titulo: 'Multa de ARCA por presentación tardía', detalle: 'Pagada en el ejercicio', monto: -K(rng.int(200, 450) * 1000), cat: 'no', explicacion: 'Las multas fiscales no son deducibles: la ley las excluye expresamente.' },
    { titulo: 'Impuesto a las Ganancias pagado (saldo DDJJ anterior)', detalle: 'Ingresado en junio', monto: -K(rng.int(800, 2_500) * 1000), cat: 'no', explicacion: 'El propio impuesto a las ganancias nunca es deducible.' },
    { titulo: 'Viaje familiar a Brasil', detalle: 'Pagado con la cuenta de la actividad', monto: -K(rng.int(1_500, 3_000) * 1000), cat: 'no', explicacion: 'Gasto personal del contribuyente: no está vinculado con la obtención de renta gravada.' },
    { titulo: 'Gastos de representación', detalle: `Cenas con clientes: superan el tope del 1,5% de los sueldos`, monto: -K(rng.int(300, 600) * 1000), cat: 'no', explicacion: 'Los gastos de representación solo se deducen hasta el 1,5% de las remuneraciones pagadas; el excedente no computa (simplificado: acá todo el importe excede el tope).' },
  ];
  rng.shuffle(trampas3).slice(0, 2).forEach(add);

  // --- otras fuentes (2 de 3 bloques)
  const bloques = rng.shuffle(['c4', 'c1', 'c2']).slice(0, 2);
  if (bloques.includes('c4')) {
    const sueldoBruto = K(rng.int(18_000, 40_000) * 1000);
    add({ titulo: 'Sueldos en relación de dependencia', detalle: `Neto de aportes, según F.1357 · ${rng.pick(['Clínica Alberdi SRL', 'Universidad Nacional', 'Supermercados Norte SA'])}`, monto: sueldoBruto, cat: 'c4', explicacion: 'El trabajo personal en relación de dependencia es renta de 4ª categoría.' });
    if (rng.chance(0.5)) add({ titulo: 'Indemnización por antigüedad', detalle: 'Despido sin causa en el ejercicio', monto: K(rng.int(5_000, 12_000) * 1000), cat: 'no', explicacion: 'La indemnización por antigüedad (rubro del art. 245 LCT) está exenta de Ganancias.' });
    else add({ titulo: 'Honorarios como director de una SA', detalle: 'Asignados por asamblea', monto: K(rng.int(4_000, 9_000) * 1000), cat: 'c4', explicacion: 'Los honorarios de directores y síndicos son renta de 4ª categoría.' });
  }
  if (bloques.includes('c1')) {
    const alq = K(rng.int(4_800, 12_000) * 1000);
    const edificio = K(rng.int(60_000, 140_000) * 1000);
    add({ titulo: 'Alquiler de un departamento (locatario comercial)', detalle: 'Cobrado durante 12 meses', monto: alq, cat: 'c1', explicacion: 'La locación de inmuebles es renta de 1ª categoría.' });
    add({ titulo: 'Amortización del edificio alquilado', detalle: `2% anual sobre ${money2(edificio)} (valor del edificio sin terreno)`, monto: -r2(edificio * 0.02), cat: 'c1', explicacion: 'La amortización del 2% anual del edificio se deduce de la renta de 1ª categoría.' });
    add({ titulo: 'Expensas e impuesto inmobiliario del departamento alquilado', detalle: 'A cargo del propietario', monto: -K(rng.int(400, 900) * 1000), cat: 'c1', explicacion: 'Gastos de mantenimiento e impuestos del inmueble alquilado: deducibles de 1ª.' });
    if (rng.chance(0.5)) add({ titulo: 'Venta de la casa habitación', detalle: 'Vendió su vivienda para comprar otra', monto: K(rng.int(60_000, 120_000) * 1000), cat: 'no', explicacion: 'La venta de la casa habitación no está gravada para la persona humana.' });
  }
  if (bloques.includes('c2')) {
    add({ titulo: 'Intereses de plazo fijo en pesos', detalle: 'Banco local, sin cláusula de ajuste', monto: K(rng.int(600, 2_000) * 1000), cat: 'no', explicacion: 'Los intereses de plazos fijos en pesos en entidades locales están exentos (art. 26).' });
    add({ titulo: 'Dividendos de acciones de una SA local', detalle: 'Distribuidos en el ejercicio', monto: K(rng.int(1_500, 4_000) * 1000), cat: 'cedular', explicacion: 'Los dividendos tributan con el impuesto cedular al 7%: no entran en la escala progresiva.' });
    if (rng.chance(0.5)) add({ titulo: 'Intereses de un préstamo a un tercero', detalle: 'Documentado con pagaré', monto: K(rng.int(500, 1_500) * 1000), cat: 'c2', explicacion: 'Los intereses de préstamos entre particulares son renta de 2ª categoría.' });
  }

  // --- deducciones generales
  const deducciones: Deduccion[] = [];
  let m = 0;
  const dd = (d: Omit<Deduccion, 'id'>) => deducciones.push({ id: `d${++m}`, ...d });
  dd({ titulo: 'Aportes a la Caja de Autónomos', detalle: '12 cuotas pagadas en término', monto: K(rng.int(900, 1_800) * 1000), deducible: true, tope: 'ninguno', explicacion: 'Los aportes jubilatorios obligatorios se deducen íntegramente (art. 85).' });
  dd({ titulo: 'Cuota de la prepaga', detalle: 'Grupo familiar', monto: K(rng.int(2_400, 5_000) * 1000), deducible: true, tope: 'pct5', explicacion: 'La cuota médico-asistencial es deducible hasta el 5% de la ganancia neta.' });
  const pool: Omit<Deduccion, 'id'>[] = [
    { titulo: 'Donación a una fundación con exención reconocida', detalle: 'Transferencia bancaria, con recibo', monto: K(rng.int(300, 1_200) * 1000), deducible: true, tope: 'pct5', explicacion: 'Las donaciones a entidades exentas reconocidas se deducen hasta el 5% de la ganancia neta.' },
    { titulo: 'Sueldo y cargas de la empleada doméstica', detalle: 'Registrada, con F.102/RT', monto: K(rng.int(3_000, 5_000) * 1000), deducible: true, tope: 'gni', explicacion: 'El servicio doméstico registrado es deducible hasta el importe de la ganancia no imponible.' },
    { titulo: 'Alquiler de la vivienda', detalle: 'Contrato registrado; no es titular de inmuebles', monto: K(rng.int(4_000, 7_000) * 1000), deducible: true, tope: 'alq40', explicacion: 'Se deduce el 40% del alquiler de la casa habitación, con tope igual a la GNI, si no es titular de ningún inmueble.' },
    { titulo: 'Seguro de vida', detalle: 'Prima anual', monto: K(rng.int(200, 400) * 1000), deducible: true, tope: 'fijo', topeMonto: K(PARAM_BASE.seguroVida), explicacion: 'Las primas de seguro de vida se deducen con un tope anual fijo.' },
    { titulo: 'Intereses del crédito hipotecario de la vivienda', detalle: 'Según resumen del banco', monto: K(rng.int(800, 2_000) * 1000), deducible: true, tope: 'fijo', topeMonto: K(PARAM_BASE.interesesHipotecarios), explicacion: 'Los intereses hipotecarios de la casa habitación se deducen con un tope anual muy bajo (quedó desactualizado).' },
    { titulo: 'Gastos de sepelio de un familiar a cargo', detalle: 'Con factura de la cochería', monto: K(rng.int(300, 600) * 1000), deducible: true, tope: 'fijo', topeMonto: K(PARAM_BASE.sepelio), explicacion: 'Los gastos de sepelio del contribuyente o de cargas de familia se deducen con tope.' },
    { titulo: 'Expensas del departamento propio donde vive', detalle: '12 cuotas', monto: K(rng.int(1_200, 2_400) * 1000), deducible: false, tope: 'ninguno', explicacion: 'Las expensas de la vivienda propia son un gasto personal: no son deducibles.' },
    { titulo: 'Cuota del club', detalle: 'Socio vitalicio', monto: K(rng.int(400, 800) * 1000), deducible: false, tope: 'ninguno', explicacion: 'Gasto de consumo personal: no deducible.' },
    { titulo: 'Colegio privado de los hijos', detalle: '10 cuotas más matrícula', monto: K(rng.int(2_000, 4_500) * 1000), deducible: false, tope: 'ninguno', explicacion: 'La cuota del colegio no es deducible; lo que se admite con tope es el gasto educativo de servicios educativos… en el juego lo tratamos como no deducible [A CONFIRMAR].' },
    { titulo: 'Nafta del auto particular', detalle: 'Tickets de estación de servicio', monto: K(rng.int(600, 1_200) * 1000), deducible: false, tope: 'ninguno', explicacion: 'Combustible del auto de uso personal: gasto no vinculado con la renta.' },
  ];
  rng.shuffle(pool).slice(0, 6).forEach(dd);

  // --- cargas de familia
  const cargas: Carga[] = [];
  const genero = rng.chance(0.5) ? 'f' : 'm';
  const nombreConyuge = rng.pick(genero === 'f' ? PERSONAS_M : PERSONAS_F);
  const conyugeConIngresos = rng.chance(0.5);
  cargas.push({
    id: 'k1',
    titulo: `Cónyuge: ${nombreConyuge}`,
    detalle: conyugeConIngresos ? `Trabaja en relación de dependencia; ganó ${money2(K(rng.int(8_000, 20_000) * 1000))} en el año` : `Sin ingresos propios en el año (ama/o de casa)`,
    tipo: 'conyuge',
    computa: !conyugeConIngresos,
    explicacion: conyugeConIngresos ? 'El cónyuge solo se deduce si sus ingresos anuales no superan la ganancia no imponible.' : 'Cónyuge sin ingresos superiores a la GNI y residente: se deduce.',
  });
  const hijosPool: Omit<Carga, 'id'>[] = [
    { titulo: 'Hijo/a de 9 años', detalle: 'Vive con el contribuyente', tipo: 'hijo', computa: true, explicacion: 'Hijo menor de 18 años a cargo: se deduce.' },
    { titulo: 'Hija de 16 años', detalle: 'Estudiante secundaria', tipo: 'hijo', computa: true, explicacion: 'Hija menor de 18 años a cargo: se deduce.' },
    { titulo: 'Hijo de 22 años', detalle: 'Estudia ingeniería, no trabaja', tipo: 'hijo', computa: false, explicacion: 'Desde los 18 años el hijo deja de ser carga de familia, aunque estudie y no trabaje (salvo incapacidad para el trabajo).' },
    { titulo: 'Hija de 27 años con discapacidad', detalle: 'Certificado único de discapacidad; a cargo del contribuyente', tipo: 'hijo', computa: true, explicacion: 'Los hijos incapacitados para el trabajo se deducen sin límite de edad.' },
    { titulo: 'Sobrino de 12 años', detalle: 'Vive con el contribuyente, los padres lo mantienen', tipo: 'hijo', computa: false, explicacion: 'Solo hijos, hijastros y cónyuge/conviviente son cargas de familia; el sobrino no, y además no está a su cargo.' },
  ];
  rng.shuffle(hijosPool).slice(0, rng.int(2, 3)).forEach((h, i) => cargas.push({ id: `k${i + 2}`, ...h }));

  // --- liquidación correcta para dimensionar pagos a cuenta
  const base = (): CasoGanancias => ({ periodo, contribuyente: nombre, nuevoProfesional, param, tramos, rentas, deducciones, cargas, pagos: [], solucion: null as unknown as Liquidacion });
  let prelim = liquidar(base(), respuestasPerfectas(base()));
  // garantizamos una base imponible razonable (si las deducciones se comen todo, el caso no enseña nada)
  for (let i = 0; i < 4 && prelim.gnsi < gni * 2; i++) {
    rentas[0].monto = K(rentas[0].monto + gni * 2.5);
    prelim = liquidar(base(), respuestasPerfectas(base()));
  }
  const imp = prelim.impDeterminado;
  const pagos: Pago[] = [];
  let q = 0;
  const pp = (p: Omit<Pago, 'id'>) => pagos.push({ id: `p${++q}`, ...p });
  if (bloques.includes('c4')) pp({ titulo: 'Retenciones del empleador (SIRADIG · F.1357)', detalle: 'Retenidas mes a mes sobre el sueldo', monto: r2(Math.min(imp * rng.range(0.25, 0.45), imp)), corresponde: true, esRetencion: true, explicacion: 'Las retenciones sufridas sobre sueldos son pago a cuenta del impuesto anual.' });
  pp({ titulo: 'Anticipos ingresados durante el año', detalle: '5 anticipos del período', monto: r2(imp * rng.range(0.2, 0.4)), corresponde: true, esRetencion: false, explicacion: 'Los anticipos pagados se descuentan del impuesto determinado.' });
  pp({ titulo: 'Retenciones RG 830 de clientes', detalle: 'Certificados de retención de Ganancias', monto: r2(imp * rng.range(0.05, 0.15)), corresponde: true, esRetencion: true, explicacion: 'Las retenciones de Ganancias que practicaron los clientes son pago a cuenta.' });
  const opcionales: Omit<Pago, 'id'>[] = [
    { titulo: 'Percepción por compras en moneda extranjera', detalle: 'Régimen de percepción sobre consumos en dólares', monto: r2(imp * rng.range(0.03, 0.1)), corresponde: true, esRetencion: false, explicacion: 'Las percepciones sobre consumos en moneda extranjera son computables en Ganancias por quien es contribuyente del impuesto.' },
    { titulo: 'Impuesto sobre débitos y créditos (Ley 25.413)', detalle: `Total retenido por el banco; computable el 33%`, monto: r2(imp * rng.range(0.02, 0.06)), corresponde: true, esRetencion: false, explicacion: 'El impuesto al cheque se computa en parte (33%) como pago a cuenta de Ganancias. En el juego el importe ya viene calculado al 33%.' },
    { titulo: 'Saldo a favor de IVA (libre disponibilidad)', detalle: 'Según última DDJJ de IVA', monto: r2(imp * rng.range(0.1, 0.2)), corresponde: false, esRetencion: false, explicacion: 'El saldo a favor de IVA no se computa contra Ganancias en la DDJJ: en todo caso se compensa por otra vía.' },
    { titulo: 'Retenciones de Ingresos Brutos (SIRCREB)', detalle: 'Débitos bancarios de la provincia', monto: r2(imp * rng.range(0.03, 0.08)), corresponde: false, esRetencion: false, explicacion: 'Las retenciones de IIBB se computan en Ingresos Brutos, no en Ganancias.' },
  ];
  rng.shuffle(opcionales).slice(0, 3).forEach(pp);

  const caso: CasoGanancias = { periodo, contribuyente: nombre, nuevoProfesional, param, tramos, rentas, deducciones, cargas, pagos, solucion: null as unknown as Liquidacion };
  caso.solucion = liquidar(caso, respuestasPerfectas(caso));
  return caso;
}

// ----------------------------------------------------------------------------- opciones

/** Opciones de impuesto determinado para una base dada (correcta + 2 distractores típicos). */
export function opcionesImpuesto(gnsi: number, impCedular: number, tramos: Tramo[]): Opcion[] {
  const ok = r2(impuestoEscala(gnsi, tramos) + impCedular);
  const t = tramoDe(gnsi, tramos);
  const max = r2(gnsi * tramos[tramos.length - 1].alicuota + impCedular);
  const sinFijo = r2(Math.max(0, gnsi - t.desde) * t.alicuota + impCedular);
  const marginalTodo = r2(gnsi * t.alicuota + impCedular);
  const cand: Opcion[] = [
    { id: 'ok', monto: ok, label: money2(ok), correcta: true },
    { id: 'max', monto: max, label: money2(max), correcta: false, error: 'Aplicaste la alícuota máxima (35%) a toda la base. La escala es progresiva por tramos.' },
    { id: 'sinfijo', monto: sinFijo, label: money2(sinFijo), correcta: false, error: 'Olvidaste el importe fijo del tramo: el impuesto es fijo + alícuota sobre el excedente del límite inferior.' },
    { id: 'marg', monto: marginalTodo, label: money2(marginalTodo), correcta: false, error: 'Aplicaste la alícuota marginal a toda la base en vez de fijo + excedente.' },
  ];
  const out: Opcion[] = [cand[0]];
  for (const c of cand.slice(1)) if (out.length < 3 && !out.some((o) => Math.abs(o.monto - c.monto) < 1)) out.push(c);
  while (out.length < 3) {
    const f = r2(ok * (1.5 + out.length * 0.3) + 100_000 * out.length);
    out.push({ id: `x${out.length}`, monto: f, label: money2(f), correcta: false, error: 'No coincide con la escala.' });
  }
  return out.sort((a, b) => a.monto - b.monto);
}

/** Opciones de saldo (correcta + distractores) a partir de la solución. */
export function opcionesSaldo(caso: CasoGanancias): Opcion[] {
  const s = caso.solucion;
  const todos = r2(caso.pagos.reduce((a, p) => a + p.monto, 0));
  const lab = (v: number) => (v > 0 ? `Saldo a pagar ${money2(v)}` : v < 0 ? `Saldo a favor ${money2(-v)}` : 'Sin saldo');
  const cand: Opcion[] = [
    { id: 'ok', monto: s.saldo, label: lab(s.saldo), correcta: true },
    { id: 'sinpagos', monto: s.impDeterminado, label: lab(s.impDeterminado), correcta: false, error: 'No descontaste los pagos a cuenta.' },
    { id: 'todos', monto: r2(s.impDeterminado - todos), label: lab(r2(s.impDeterminado - todos)), correcta: false, error: 'Computaste pagos a cuenta que no corresponden a Ganancias.' },
    { id: 'sincedular', monto: r2(s.impEscala - s.pagos), label: lab(r2(s.impEscala - s.pagos)), correcta: false, error: 'Olvidaste el impuesto cedular sobre los dividendos.' },
  ];
  const out: Opcion[] = [cand[0]];
  for (const c of cand.slice(1)) if (out.length < 3 && !out.some((o) => Math.abs(o.monto - c.monto) < 1)) out.push(c);
  while (out.length < 3) {
    const f = r2(s.saldo + s.impDeterminado * 0.37 * out.length);
    out.push({ id: `y${out.length}`, monto: f, label: lab(f), correcta: false, error: 'No surge de la liquidación.' });
  }
  return out.sort((a, b) => a.monto - b.monto);
}

// ----------------------------------------------------------------------------- evaluación

export const PESOS = { rentas: 0.3, deducciones: 0.25, cargas: 0.1, determinacion: 0.2, pagosResultado: 0.15 };

export function respuestasPerfectas(caso: CasoGanancias): Respuestas {
  const rentas: Record<string, Cat> = {};
  for (const r of caso.rentas) rentas[r.id] = r.cat;
  const deducciones: Record<string, boolean> = {};
  for (const d of caso.deducciones) deducciones[d.id] = d.deducible;
  const cargas: Record<string, boolean> = {};
  for (const c of caso.cargas) cargas[c.id] = c.computa;
  const pagos: Record<string, boolean> = {};
  for (const p of caso.pagos) pagos[p.id] = p.corresponde;
  return { rentas, deducciones, cargas, pagos, impuestoId: 'ok', saldoId: 'ok' };
}

export function evaluar(caso: CasoGanancias, resp: Respuestas): MinigameResult {
  const errores: string[] = [];
  let okR = 0;
  for (const r of caso.rentas) {
    const c = resp.rentas[r.id];
    if (c === r.cat) okR++;
    else errores.push(`${r.titulo}: ${c ? `la pusiste en «${CAT_LABEL[c]}»` : 'quedó sin clasificar'}; va en «${CAT_LABEL[r.cat]}». ${r.explicacion}`);
  }
  let okD = 0;
  for (const d of caso.deducciones) {
    const v = !!resp.deducciones[d.id];
    if (v === d.deducible) okD++;
    else errores.push(`${d.titulo}: ${v ? 'la dedujiste y no corresponde. ' : 'no la dedujiste. '}${d.explicacion}`);
  }
  let okC = 0;
  for (const c of caso.cargas) {
    const v = !!resp.cargas[c.id];
    if (v === c.computa) okC++;
    else errores.push(`${c.titulo}: ${v ? 'la computaste y no corresponde. ' : 'no la computaste. '}${c.explicacion}`);
  }
  const liq = liquidar(caso, resp);
  const opI = opcionesImpuesto(liq.gnsi, liq.impCedular, caso.tramos);
  const elI = opI.find((o) => o.id === resp.impuestoId);
  const okI = !!elI?.correcta;
  if (!okI) errores.push(`Impuesto determinado: ${elI ? `elegiste ${elI.label}` : 'no elegiste'}; con tu base de ${money2(liq.gnsi)} correspondía ${opI.find((o) => o.correcta)!.label}. ${elI?.error ?? ''}`.trim());
  let okP = 0;
  for (const p of caso.pagos) {
    const v = !!resp.pagos[p.id];
    if (v === p.corresponde) okP++;
    else errores.push(`${p.titulo} (${money2(p.monto)}): ${v ? 'lo computaste y no corresponde. ' : 'no lo computaste. '}${p.explicacion}`);
  }
  const opS = opcionesSaldo(caso);
  const elS = opS.find((o) => o.id === resp.saldoId);
  const okS = !!elS?.correcta;
  if (!okS) errores.push(`Resultado: ${elS ? `elegiste «${elS.label}»` : 'no elegiste'}; lo correcto era «${opS.find((o) => o.correcta)!.label}». ${elS?.error ?? ''}`.trim());

  const score = r2(
    PESOS.rentas * (okR / caso.rentas.length) +
      PESOS.deducciones * (okD / caso.deducciones.length) +
      PESOS.cargas * (okC / caso.cargas.length) +
      PESOS.determinacion * (okI ? 1 : 0) +
      PESOS.pagosResultado * (0.5 * (okP / caso.pagos.length) + 0.5 * (okS ? 1 : 0)),
  );
  const s = caso.solucion;
  const resumen = `Ganancia neta ${money2(s.ganNeta)} · sujeta a impuesto ${money2(s.gnsi)} · impuesto determinado ${money2(s.impDeterminado)} · ${opS.find((o) => o.correcta)!.label}. Rentas ${okR}/${caso.rentas.length}, deducciones ${okD}/${caso.deducciones.length}, cargas ${okC}/${caso.cargas.length}.`;
  return { score: Math.min(1, Math.max(0, score)), resumen, errores: errores.length > 8 ? [...errores.slice(0, 8), `…y ${errores.length - 8} observaciones más.`] : errores };
}

/** Para tests: un RNG expuesto. */
export const _rng = (seed: number): Rng => makeRng(seed);
