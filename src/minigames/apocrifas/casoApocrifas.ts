// Control de comprobantes: detección de facturas apócrifas. Lógica pura (generación, consultas y evaluación).
//
// Realismo: cada comprobante trae los datos que un contador mira de verdad (CUIT, CAE y su vencimiento,
// letra, condición del emisor, forma de pago) y permite "consultas" que simulan los servicios de ARCA
// (constancia de inscripción, base APOC, validación de comprobante) y una averiguación de capacidad operativa.
// Valores legales marcados [A CONFIRMAR] se usan como valores de juego.
import { addDays, fechaAR, lastDayOfMonth, ymd } from '../../engine/calendar';
import { r2 } from '../../engine/format';
import { cuit as cuitValido } from '../../engine/names';
import { makeRng, type Rng } from '../../engine/rng';
import type { Client, Rubro } from '../../engine/types';

export type Letra = 'A' | 'B' | 'C' | 'M';
export type Consulta = 'constancia' | 'apoc' | 'validar' | 'capacidad' | 'pago';
export type Motivo =
  | 'cuit_invalido'
  | 'apoc'
  | 'cae_inexistente'
  | 'cae_vencido'
  | 'actividad_incompatible'
  | 'sin_capacidad'
  | 'pago_irregular'
  | 'letra_inconsistente'
  | 'duplicado'
  | 'cuit_inactivo';

export const MOTIVOS: { id: Motivo; label: string; corto: string }[] = [
  { id: 'cuit_invalido', label: 'CUIT con dígito verificador inválido', corto: 'CUIT inválido' },
  { id: 'apoc', label: 'Emisor incluido en la base APOC de ARCA', corto: 'Base APOC' },
  { id: 'cae_inexistente', label: 'CAE inexistente / no coincide con el comprobante', corto: 'CAE no registrado' },
  { id: 'cae_vencido', label: 'Comprobante emitido con CAE vencido', corto: 'CAE vencido' },
  { id: 'actividad_incompatible', label: 'Actividad declarada incompatible con lo facturado', corto: 'Actividad incompatible' },
  { id: 'sin_capacidad', label: 'Emisor sin capacidad operativa (usina)', corto: 'Sin capacidad operativa' },
  { id: 'pago_irregular', label: 'Pago irregular (efectivo sobre el tope / cheque a un tercero)', corto: 'Pago irregular' },
  { id: 'letra_inconsistente', label: 'Letra inconsistente con la condición del emisor', corto: 'Letra inconsistente' },
  { id: 'duplicado', label: 'Comprobante duplicado (ya cargado en otro período)', corto: 'Duplicado' },
  { id: 'cuit_inactivo', label: 'Emisor dado de baja / CUIT inactivo', corto: 'CUIT inactivo' },
];
export const MOTIVO = Object.fromEntries(MOTIVOS.map((m) => [m.id, m])) as unknown as Record<Motivo, { label: string; corto: string }>;

export const CONSULTAS: { id: Consulta; label: string; icon: string; descripcion: string }[] = [
  { id: 'constancia', label: 'Constancia de inscripción', icon: '📋', descripcion: 'Actividad declarada, condición frente al IVA, fecha de inscripción y estado del CUIT.' },
  { id: 'apoc', label: 'Consulta APOC', icon: '🚫', descripcion: '¿El emisor figura en la base de facturas apócrifas de ARCA?' },
  { id: 'validar', label: 'Validar comprobante', icon: '✅', descripcion: '¿El CAE, número y fecha existen para ese CUIT en ARCA?' },
  { id: 'capacidad', label: 'Capacidad operativa', icon: '🏭', descripcion: 'Empleados declarados, antigüedad y qué hay en el domicilio fiscal.' },
  { id: 'pago', label: 'Forma de pago', icon: '💳', descripcion: 'Cómo se pagó: transferencia al emisor, efectivo, cheque y a quién.' },
];

export interface Constancia {
  actividad: string;
  condicion: 'Responsable Inscripto' | 'Monotributista' | 'Exento';
  inscriptoDesde: string; // ISO
  estado: 'Activo' | 'Baja de oficio' | 'CUIT inactivo (limitado)';
}
export interface Capacidad {
  empleados: number;
  mesesInscripto: number;
  domicilio: string; // qué hay en el domicilio
  bienes: string;
}
export interface Pago {
  medio: 'Transferencia bancaria' | 'Efectivo' | 'Cheque propio' | 'Cheque de tercero endosado' | 'Tarjeta corporativa' | 'E-cheq';
  destinatario: string;
  detalle: string;
}

export interface Factura {
  id: string;
  letra: Letra;
  ptoVta: string; // '0003'
  numero: string; // '00001234'
  fecha: string; // ISO
  emisor: string;
  cuit: string;
  condicionEmisor: 'Responsable Inscripto' | 'Monotributista';
  domicilio: string;
  concepto: string;
  neto: number;
  iva: number;
  total: number;
  cae: string; // 14 dígitos
  caeVto: string; // ISO
  pagoResumen: string; // lo que se ve en la factura/registro contable
  // datos de las consultas
  constancia: Constancia;
  /** actividad que sería coherente con lo facturado */
  actividadEsperada: string;
  enApoc: boolean;
  validacion: 'Comprobante registrado' | 'Comprobante NO registrado para ese CUIT' | 'CAE no corresponde al comprobante';
  capacidad: Capacidad;
  pago: Pago;
  // solución
  apocrifa: boolean;
  motivo?: Motivo;
  /** consultas que revelan el problema (para el feedback) */
  pista: string;
  /** qué consulta lo destapa (o 'ninguna' si se ve a simple vista) */
  revelaCon: Consulta | 'vista';
}

export interface CasoApocrifas {
  periodo: string;
  periodoLabel: string;
  cliente: string;
  facturas: Factura[];
  presupuestoConsultas: number;
  /** tope de juego para pagos en efectivo (Ley 25.345, valor de juego indexado) [A CONFIRMAR] */
  topeEfectivo: number;
  /** número de un comprobante cargado el período anterior (para el duplicado) */
  cargadosAntes: string[];
}

// ----------------------------------------------------------------------------- CUIT

/** Verifica el dígito módulo 11 de un CUIT 'XX-XXXXXXXX-X'. */
export function cuitEsValido(c: string): boolean {
  const d = c.replace(/\D/g, '');
  if (d.length !== 11) return false;
  const w = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const s = d
    .slice(0, 10)
    .split('')
    .reduce((a, x, i) => a + Number(x) * w[i], 0);
  let v = 11 - (s % 11);
  if (v === 11) v = 0;
  if (v === 10) return false;
  return v === Number(d[10]);
}

function cuitInvalido(rng: Rng, tipo: 'soc' | 'm' | 'f'): string {
  const ok = cuitValido(rng, tipo);
  const v = Number(ok.slice(-1));
  let nuevo = (v + rng.int(1, 9)) % 10;
  let cand = ok.slice(0, -1) + nuevo;
  while (cuitEsValido(cand)) {
    nuevo = (nuevo + 1) % 10;
    cand = ok.slice(0, -1) + nuevo;
  }
  return cand;
}

// ----------------------------------------------------------------------------- datos

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const RAZON_PREF = ['Distribuidora', 'Insumos', 'Logística', 'Servicios', 'Comercial', 'Mayorista', 'Suministros', 'Tecnología', 'Proveeduría', 'Corralón', 'Agro', 'Industrias'];
const RAZON_SUF = ['del Litoral', 'Paraná', 'Rosario', 'del Centro', 'San Martín', 'Oroño', 'Fisherton', 'Norte', 'del Sur', 'Pellegrini', 'Alberdi', 'La Ribera', 'Río Tercero', 'Las Heras'];
const SOC = ['S.A.', 'S.R.L.', 'S.A.S.', 'S.R.L.', 'S.A.'];
const PERSONAS = ['Juan Carlos Ledesma', 'María Eugenia Rossi', 'Walter Giménez', 'Analía Quiroga', 'Rubén Darío Acosta', 'Patricia Benítez', 'Oscar Medina', 'Silvana Ferrari', 'Hugo Pereyra', 'Mónica Suárez'];
const CALLES = ['Córdoba', 'San Lorenzo', 'Mitre', 'Pellegrini', 'Ov. Lagos', 'Rioja', 'Mendoza', 'San Juan', 'Urquiza', 'Entre Ríos', 'Alem', 'Av. Francia', 'Bv. Oroño', 'Av. Alberdi', 'Av. Provincias Unidas'];
const CIUDADES = ['Rosario', 'Rosario', 'Rosario', 'Funes', 'Roldán', 'Granadero Baigorria', 'Villa Gdor. Gálvez', 'San Lorenzo', 'Pérez'];

interface Rubrica {
  conceptos: { c: string; min: number; max: number; actividad: string }[];
}
const COMPRAS: Record<Rubro, Rubrica> = {
  comercio: {
    conceptos: [
      { c: 'Mercadería de reventa (según remito)', min: 400_000, max: 3_200_000, actividad: 'Venta al por mayor de artículos de ferretería' },
      { c: 'Bolsas y packaging', min: 60_000, max: 240_000, actividad: 'Fabricación de envases de papel y cartón' },
      { c: 'Flete y distribución', min: 90_000, max: 380_000, actividad: 'Transporte automotor de cargas' },
      { c: 'Servicio de limpieza del local', min: 80_000, max: 180_000, actividad: 'Servicios de limpieza de edificios' },
      { c: 'Publicidad en redes', min: 50_000, max: 150_000, actividad: 'Servicios de publicidad' },
    ],
  },
  servicios: {
    conceptos: [
      { c: 'Honorarios por consultoría informática', min: 200_000, max: 1_500_000, actividad: 'Servicios de consultores en informática' },
      { c: 'Alquiler de oficina', min: 300_000, max: 900_000, actividad: 'Servicios inmobiliarios por cuenta propia' },
      { c: 'Licencias de software', min: 90_000, max: 400_000, actividad: 'Edición de programas de informática' },
      { c: 'Servicio de coworking', min: 120_000, max: 300_000, actividad: 'Servicios empresariales n.c.p.' },
      { c: 'Capacitación del personal', min: 80_000, max: 260_000, actividad: 'Enseñanza para adultos y servicios de enseñanza n.c.p.' },
    ],
  },
  gastronomia: {
    conceptos: [
      { c: 'Carnes y achuras', min: 300_000, max: 1_600_000, actividad: 'Venta al por mayor de carnes rojas' },
      { c: 'Bebidas y cervezas', min: 150_000, max: 700_000, actividad: 'Venta al por mayor de bebidas' },
      { c: 'Verduras y frutas', min: 90_000, max: 350_000, actividad: 'Venta al por mayor de frutas y verduras' },
      { c: 'Servicio de lavandería (mantelería)', min: 60_000, max: 160_000, actividad: 'Lavado y limpieza de artículos de tela' },
      { c: 'Gas envasado', min: 70_000, max: 220_000, actividad: 'Venta al por menor de gas en garrafas' },
    ],
  },
  construccion: {
    conceptos: [
      { c: 'Cemento, cal y áridos', min: 500_000, max: 3_500_000, actividad: 'Venta al por mayor de materiales de construcción' },
      { c: 'Mano de obra subcontratada (albañilería)', min: 600_000, max: 4_000_000, actividad: 'Construcción, reforma y reparación de edificios' },
      { c: 'Alquiler de andamios', min: 120_000, max: 500_000, actividad: 'Alquiler de maquinaria y equipo de construcción' },
      { c: 'Hierro y acero', min: 400_000, max: 2_800_000, actividad: 'Venta al por mayor de productos siderúrgicos' },
      { c: 'Servicio de volquetes', min: 80_000, max: 300_000, actividad: 'Recolección y transporte de residuos' },
    ],
  },
  agro: {
    conceptos: [
      { c: 'Semillas y agroquímicos', min: 800_000, max: 5_000_000, actividad: 'Venta al por mayor de semillas y agroquímicos' },
      { c: 'Servicio de siembra y cosecha', min: 700_000, max: 4_500_000, actividad: 'Servicios de maquinaria agrícola' },
      { c: 'Gasoil', min: 300_000, max: 1_600_000, actividad: 'Venta al por menor de combustibles' },
      { c: 'Flete de granos', min: 250_000, max: 1_400_000, actividad: 'Transporte automotor de cargas' },
      { c: 'Repuestos de maquinaria', min: 120_000, max: 700_000, actividad: 'Venta de repuestos de maquinaria agrícola' },
    ],
  },
  industria: {
    conceptos: [
      { c: 'Materia prima (chapa y perfiles)', min: 900_000, max: 5_000_000, actividad: 'Venta al por mayor de productos siderúrgicos' },
      { c: 'Mantenimiento de máquinas', min: 200_000, max: 900_000, actividad: 'Reparación y mantenimiento de maquinaria' },
      { c: 'Energía (distribuidora)', min: 300_000, max: 1_300_000, actividad: 'Distribución de energía eléctrica' },
      { c: 'Elementos de seguridad e higiene', min: 60_000, max: 250_000, actividad: 'Venta al por mayor de indumentaria de trabajo' },
      { c: 'Servicio de calibración', min: 80_000, max: 240_000, actividad: 'Ensayos y análisis técnicos' },
    ],
  },
  salud: {
    conceptos: [
      { c: 'Insumos descartables', min: 150_000, max: 900_000, actividad: 'Venta al por mayor de productos farmacéuticos' },
      { c: 'Mantenimiento de equipos médicos', min: 120_000, max: 600_000, actividad: 'Reparación de equipo médico' },
      { c: 'Alquiler del consultorio', min: 250_000, max: 700_000, actividad: 'Servicios inmobiliarios por cuenta propia' },
      { c: 'Esterilización de material', min: 60_000, max: 200_000, actividad: 'Servicios de esterilización' },
      { c: 'Software de turnos', min: 40_000, max: 150_000, actividad: 'Edición de programas de informática' },
    ],
  },
  transporte: {
    conceptos: [
      { c: 'Gasoil', min: 600_000, max: 3_500_000, actividad: 'Venta al por menor de combustibles' },
      { c: 'Cubiertas', min: 300_000, max: 1_500_000, actividad: 'Venta de cámaras y cubiertas' },
      { c: 'Service y repuestos', min: 150_000, max: 800_000, actividad: 'Mantenimiento y reparación de vehículos' },
      { c: 'Peajes y estacionamiento', min: 40_000, max: 200_000, actividad: 'Servicios de explotación de rutas por peaje' },
      { c: 'Seguro de flota', min: 200_000, max: 900_000, actividad: 'Servicios de seguros' },
    ],
  },
};
const ACTIVIDADES_RARAS = ['Venta al por menor de calzado', 'Peluquería y tratamientos de belleza', 'Servicios de kiosco', 'Cría de ganado bovino', 'Alquiler de canchas de fútbol 5', 'Servicios de fotocopiado', 'Venta al por menor de prendas de vestir'];
const DOMICILIOS_RAROS = ['Terreno baldío con pastizal; sin cartel ni construcción.', 'Casa de familia; la vecina nunca escuchó hablar de la empresa.', 'Departamento monoambiente en un 8º piso.', 'Local cerrado hace más de un año, con cartel de "Se alquila".', 'Galpón vacío, sin energía eléctrica contratada.'];
const DOMICILIOS_OK = ['Galpón de 600 m² con playa de carga y 2 camiones.', 'Local a la calle con vidriera y cartel iluminado.', 'Oficinas en 3er piso, recepción y 6 puestos de trabajo.', 'Planta industrial con portería y estacionamiento.', 'Depósito con estanterías y personal uniformado.', 'Local comercial activo en avenida principal.'];

const pad = (n: number, l: number) => String(n).padStart(l, '0');
const redondo = (n: number, a: number) => Math.round(n / a) * a;
const sumaDigitos = (s: string) => s.split('').reduce((a, d) => a + Number(d), 0);

function caeDe(rng: Rng, cuitStr: string, fecha: string): string {
  // 14 dígitos: dos del año, dos del mes, 9 pseudoaleatorios y un dígito de control (juego)
  const yy = fecha.slice(2, 4);
  const mm = fecha.slice(5, 7);
  let s = yy + mm;
  for (let i = 0; i < 9; i++) s += String(rng.int(0, 9));
  s += String((sumaDigitos(s) + sumaDigitos(cuitStr.replace(/\D/g, ''))) % 10);
  return s;
}

function razonSocial(rng: Rng): { nombre: string; tipo: 'soc' | 'm' | 'f' } {
  if (rng.chance(0.3)) {
    const p = rng.pick(PERSONAS);
    return { nombre: p, tipo: rng.chance(0.5) ? 'm' : 'f' };
  }
  return { nombre: `${rng.pick(RAZON_PREF)} ${rng.pick(RAZON_SUF)} ${rng.pick(SOC)}`, tipo: 'soc' };
}

function domicilio(rng: Rng): string {
  return `${rng.pick(CALLES)} ${rng.int(100, 4800)}, ${rng.pick(CIUDADES)}, Santa Fe`;
}

// ----------------------------------------------------------------------------- generación

export function generarCasoApocrifas(seed: number, client: Pick<Client, 'nombre' | 'rubro' | 'kind' | 'volumen'>, periodoIn: string, indice: number): CasoApocrifas {
  const rng = makeRng((seed ^ 0x5bd1e995) >>> 0);
  const periodo = /^\d{4}-\d{2}$/.test(periodoIn) ? periodoIn : '2027-03';
  const [y, m] = periodo.split('-').map(Number);
  const ultimo = lastDayOfMonth(y, m);
  const rub = COMPRAS[client.rubro] ?? COMPRAS.comercio;
  const topeEfectivo = redondo(1_000_000 * indice, 10_000); // valor de juego [A CONFIRMAR]
  const n = Math.min(14, Math.max(10, 10 + Math.floor((client.volumen ?? 100) / 120)));
  const nTruchas = rng.int(3, Math.min(5, n - 6));
  const motivosPool = rng.shuffle<Motivo>(['cuit_invalido', 'apoc', 'cae_inexistente', 'cae_vencido', 'actividad_incompatible', 'sin_capacidad', 'pago_irregular', 'letra_inconsistente', 'duplicado', 'cuit_inactivo']);
  const motivos = motivosPool.slice(0, nTruchas);
  const idxTruchas = new Set(rng.shuffle(Array.from({ length: n }, (_, i) => i)).slice(0, nTruchas));
  const cargadosAntes: string[] = [];
  const facturas: Factura[] = [];
  const usados = new Set<string>();
  let k = 0;

  for (let i = 0; i < n; i++) {
    const concepto = rng.pick(rub.conceptos);
    const trucha = idxTruchas.has(i);
    const motivo = trucha ? motivos[k++] : undefined;
    const { nombre, tipo } = razonSocial(rng);
    let cuitStr = cuitValido(rng, tipo);
    let letra = 'A' as Letra;
    let condicionEmisor: Factura['condicionEmisor'] = 'Responsable Inscripto';
    const esMono = !trucha && rng.chance(0.15);
    if (esMono) {
      letra = 'C';
      condicionEmisor = 'Monotributista';
    }
    const fecha = ymd(y, m, rng.int(1, ultimo));
    let neto = redondo(rng.range(concepto.min, concepto.max) * indice, rng.chance(0.3) ? 1000 : 1);
    if (!trucha && rng.chance(0.25)) neto = redondo(neto, 50_000); // montos redondos también en legítimas
    let caeVto = addDays(fecha, rng.int(3, 10));
    let constancia: Constancia = { actividad: concepto.actividad, condicion: esMono ? 'Monotributista' : 'Responsable Inscripto', inscriptoDesde: ymd(y - rng.int(2, 25), rng.int(1, 12), 1), estado: 'Activo' };
    let enApoc = false;
    let validacion: Factura['validacion'] = 'Comprobante registrado';
    let capacidad: Capacidad = { empleados: rng.int(2, 60), mesesInscripto: 0, domicilio: rng.pick(DOMICILIOS_OK), bienes: rng.pick(['Vehículos utilitarios declarados', 'Inmueble propio', 'Maquinaria declarada en bienes personales / balance', 'Flota de 3 camiones', 'Sin bienes registrables, pero con personal y local alquilado']) };
    let pago: Pago = { medio: 'Transferencia bancaria', destinatario: nombre, detalle: 'A cuenta bancaria del emisor (CBU coincide con el CUIT).' };
    if (!trucha && rng.chance(0.2)) pago = { medio: rng.pick(['Cheque propio', 'E-cheq', 'Tarjeta corporativa']), destinatario: nombre, detalle: 'A la orden del emisor.' };
    if (!trucha && neto < topeEfectivo * 0.6 && rng.chance(0.2)) pago = { medio: 'Efectivo', destinatario: nombre, detalle: 'Pago en efectivo por debajo del tope legal, con recibo del emisor.' };
    let pista = '';
    let revelaCon: Factura['revelaCon'] = 'vista';
    let ptoVta = pad(rng.int(1, 12), 4);
    let numero = pad(rng.int(1000, 99_999_999 % 300_000), 8);

    switch (motivo) {
      case 'cuit_invalido':
        cuitStr = cuitInvalido(rng, tipo);
        pista = 'El dígito verificador del CUIT no cierra con el módulo 11: ese CUIT no existe. Se ve en la propia factura.';
        revelaCon = 'vista';
        break;
      case 'apoc':
        enApoc = true;
        pista = 'El emisor figura en la base APOC de ARCA (usinas de facturas apócrifas). Una consulta APOC lo destapaba.';
        revelaCon = 'apoc';
        break;
      case 'cae_inexistente':
        validacion = rng.chance(0.5) ? 'Comprobante NO registrado para ese CUIT' : 'CAE no corresponde al comprobante';
        pista = 'ARCA no tiene registrado ese comprobante para ese CUIT: el CAE es inventado. "Validar comprobante" lo mostraba.';
        revelaCon = 'validar';
        break;
      case 'cae_vencido':
        caeVto = addDays(fecha, -rng.int(2, 20));
        pista = 'La fecha de emisión es posterior al vencimiento del CAE impreso al pie. Se ve en la propia factura.';
        revelaCon = 'vista';
        break;
      case 'actividad_incompatible':
        constancia = { ...constancia, actividad: rng.pick(ACTIVIDADES_RARAS) };
        pista = `Factura "${concepto.c}" pero su actividad inscripta es "${constancia.actividad}". La constancia de inscripción lo mostraba.`;
        revelaCon = 'constancia';
        break;
      case 'sin_capacidad':
        neto = redondo(concepto.max * indice * rng.range(1.5, 2.5), 100_000);
        capacidad = { empleados: 0, mesesInscripto: rng.int(1, 4), domicilio: rng.pick(DOMICILIOS_RAROS), bienes: 'Sin bienes registrables ni habilitación municipal.' };
        constancia = { ...constancia, inscriptoDesde: ymd(y, Math.max(1, m - capacidad.mesesInscripto), 1) };
        pista = 'Inscripto hace pocos meses, sin empleados, con un domicilio fiscal donde no hay nada y facturando montos enormes y redondos: no tiene capacidad operativa para prestar eso.';
        revelaCon = 'capacidad';
        break;
      case 'pago_irregular':
        neto = Math.max(neto, redondo(topeEfectivo * rng.range(1.8, 4), 10_000));
        pago = rng.chance(0.5)
          ? { medio: 'Efectivo', destinatario: nombre, detalle: `Pago en efectivo por encima del tope de la Ley 25.345 (tope de juego ${Math.round(topeEfectivo).toLocaleString('es-AR')}).` }
          : { medio: 'Cheque de tercero endosado', destinatario: rng.pick(PERSONAS), detalle: 'Cheque endosado a una persona sin relación con el emisor.' };
        pista = 'El pago no fue a la cuenta del emisor: efectivo por encima del tope de la Ley antievasión 25.345 o cheque a un tercero sin relación. Sin medio de pago bancarizado, el gasto y el crédito fiscal no son computables.';
        revelaCon = 'pago';
        break;
      case 'letra_inconsistente':
        if (rng.chance(0.5)) {
          letra = 'A';
          condicionEmisor = 'Monotributista';
          constancia = { ...constancia, condicion: 'Monotributista' };
          pista = 'Un monotributista no puede emitir Factura A ni discriminar IVA. La letra no coincide con la condición del emisor que figura en la propia factura.';
        } else {
          letra = 'B';
          pista = 'Una Factura B no discrimina IVA: si viene con IVA desglosado, el comprobante es inconsistente y no genera crédito fiscal.';
        }
        revelaCon = 'vista';
        break;
      case 'duplicado':
        cargadosAntes.push(`${ptoVta}-${numero}`);
        pista = 'Ese punto de venta y número ya se cargó en el período anterior: computarlo de nuevo duplica el crédito fiscal. El listado de cargados antes lo mostraba.';
        revelaCon = 'vista';
        break;
      case 'cuit_inactivo':
        constancia = { ...constancia, estado: rng.chance(0.5) ? 'Baja de oficio' : 'CUIT inactivo (limitado)' };
        pista = 'El CUIT del emisor está dado de baja o limitado: no podía emitir comprobantes válidos en esa fecha. La constancia de inscripción lo mostraba.';
        revelaCon = 'constancia';
        break;
    }
    // asegurar números únicos dentro del período
    while (usados.has(`${ptoVta}-${numero}`)) {
      ptoVta = pad(rng.int(1, 12), 4);
      numero = pad(rng.int(1000, 300_000), 8);
    }
    usados.add(`${ptoVta}-${numero}`);

    const discrimina = letra === 'A' || letra === 'M' || (motivo === 'letra_inconsistente' && letra === 'B');
    const alic = concepto.c.toLowerCase().includes('verdura') || concepto.c.toLowerCase().includes('carne') ? 0.105 : 0.21;
    const iva = discrimina ? r2(neto * alic) : 0;
    const total = letra === 'C' || (letra === 'B' && !discrimina) ? r2(neto) : r2(neto + iva);
    facturas.push({
      id: `f${i + 1}`,
      letra,
      ptoVta,
      numero,
      fecha,
      emisor: nombre,
      cuit: cuitStr,
      condicionEmisor,
      domicilio: domicilio(rng),
      concepto: concepto.c,
      neto: r2(neto),
      iva,
      total,
      cae: caeDe(rng, cuitStr, fecha),
      caeVto,
      pagoResumen: pago.medio,
      constancia,
      actividadEsperada: concepto.actividad,
      enApoc,
      validacion,
      capacidad,
      pago,
      apocrifa: trucha,
      motivo,
      pista,
      revelaCon,
    });
  }
  // algunos legítimos "cargados antes" como distractores en el listado (números distintos)
  for (let j = 0; j < 3; j++) cargadosAntes.push(`${pad(rng.int(1, 12), 4)}-${pad(rng.int(1000, 300_000), 8)}`);

  return {
    periodo,
    periodoLabel: `${MESES[m - 1]} ${y}`,
    cliente: client.nombre,
    facturas: rng.shuffle(facturas),
    presupuestoConsultas: Math.round(n * 1.5),
    topeEfectivo,
    cargadosAntes: rng.shuffle(cargadosAntes),
  };
}

// ----------------------------------------------------------------------------- consultas (texto que devuelve cada servicio)

export function respuestaConsulta(caso: CasoApocrifas, f: Factura, c: Consulta): { titulo: string; lineas: string[]; alerta: boolean } {
  switch (c) {
    case 'constancia': {
      const k = f.constancia;
      const incompatible = k.actividad !== f.actividadEsperada;
      const alerta = k.estado !== 'Activo' || (f.letra === 'A' && k.condicion === 'Monotributista') || incompatible;
      return {
        titulo: 'Constancia de inscripción (ARCA)',
        lineas: [`CUIT ${f.cuit} · ${f.emisor}`, `Estado: ${k.estado}`, `Condición IVA: ${k.condicion}`, `Actividad principal: ${k.actividad}${incompatible ? ' ⚠️ (¿y factura ' + f.concepto.toLowerCase() + '?)' : ''}`, `Inscripto desde: ${fechaAR(k.inscriptoDesde)}`],
        alerta,
      };
    }
    case 'apoc':
      return { titulo: 'Base de facturas apócrifas (APOC)', lineas: [f.enApoc ? `⚠️ El CUIT ${f.cuit} FIGURA en la base APOC.` : `El CUIT ${f.cuit} no figura en la base APOC.`], alerta: f.enApoc };
    case 'validar':
      return {
        titulo: 'Constatación de comprobante',
        lineas: [`${f.letra} ${f.ptoVta}-${f.numero} · ${fechaAR(f.fecha)} · CAE ${f.cae}`, f.validacion === 'Comprobante registrado' ? 'Resultado: comprobante registrado ✔' : `Resultado: ⚠️ ${f.validacion}`],
        alerta: f.validacion !== 'Comprobante registrado',
      };
    case 'capacidad': {
      const k = f.capacidad;
      const alerta = k.empleados === 0 && k.mesesInscripto > 0;
      return {
        titulo: 'Capacidad operativa del emisor',
        lineas: [`Empleados declarados (F.931): ${k.empleados}`, k.mesesInscripto ? `Antigüedad: ${k.mesesInscripto} mes/es` : `Antigüedad: desde ${fechaAR(f.constancia.inscriptoDesde)}`, `Domicilio fiscal: ${k.domicilio}`, `Bienes: ${k.bienes}`],
        alerta,
      };
    }
    case 'pago': {
      const alerta = f.pago.medio === 'Cheque de tercero endosado' || (f.pago.medio === 'Efectivo' && f.total > caso.topeEfectivo);
      return { titulo: 'Forma de pago (según registros del cliente)', lineas: [`Medio: ${f.pago.medio}`, `Destinatario: ${f.pago.destinatario}`, f.pago.detalle], alerta };
    }
  }
}

// ----------------------------------------------------------------------------- evaluación

export interface Decision {
  rechaza: boolean;
  motivo?: Motivo;
}
export interface RespuestasApocrifas {
  decisiones: Record<string, Decision | undefined>;
  consultasUsadas: number;
}
export const PESOS = { decision: 0.6, motivo: 0.25, eficiencia: 0.15 };

export function respuestasPerfectas(caso: CasoApocrifas): RespuestasApocrifas {
  const decisiones: Record<string, Decision> = {};
  let consultas = 0;
  for (const f of caso.facturas) {
    decisiones[f.id] = f.apocrifa ? { rechaza: true, motivo: f.motivo } : { rechaza: false };
    if (f.apocrifa && f.revelaCon !== 'vista') consultas += 1;
  }
  return { decisiones, consultasUsadas: consultas };
}

/** Consultas "necesarias": una por factura apócrifa que no se ve a simple vista. Usar hasta el doble no penaliza. */
export function consultasNecesarias(caso: CasoApocrifas): number {
  return caso.facturas.filter((f) => f.apocrifa && f.revelaCon !== 'vista').length;
}

export interface Evaluacion {
  score: number;
  resumen: string;
  errores: string[];
  creditoComputado: number;
  creditoImpugnado: number;
  creditoApocrifoComputado: number; // lo que se dejó pasar
  truchasDetectadas: number;
  truchasTotal: number;
  falsosPositivos: number;
}

export function evaluarApocrifas(caso: CasoApocrifas, r: RespuestasApocrifas): Evaluacion {
  const errores: string[] = [];
  let puntosDec = 0;
  let maxDec = 0;
  let puntosMot = 0;
  let maxMot = 0;
  let creditoComputado = 0;
  let creditoImpugnado = 0;
  let creditoApocrifoComputado = 0;
  let truchasDetectadas = 0;
  let falsosPositivos = 0;
  const truchasTotal = caso.facturas.filter((f) => f.apocrifa).length;
  for (const f of caso.facturas) {
    const d = r.decisiones[f.id];
    const rechaza = !!d?.rechaza;
    const peso = f.apocrifa ? 2 : 1; // dejar pasar una trucha pesa el doble
    maxDec += peso;
    const ivaComp = f.iva;
    if (rechaza) creditoImpugnado += ivaComp;
    else creditoComputado += ivaComp;
    if (f.apocrifa) {
      maxMot += 1;
      if (rechaza) {
        puntosDec += peso;
        truchasDetectadas += 1;
        if (d?.motivo === f.motivo) puntosMot += 1;
        else errores.push(`${f.letra} ${f.ptoVta}-${f.numero} (${f.emisor}): la impugnaste bien, pero el motivo real era "${MOTIVO[f.motivo!].corto}". ${f.pista}`);
      } else {
        creditoApocrifoComputado += ivaComp || f.total * 0.21;
        errores.push(`${f.letra} ${f.ptoVta}-${f.numero} (${f.emisor}): la computaste y era apócrifa (${MOTIVO[f.motivo!].corto}). ${f.pista}`);
      }
    } else if (!rechaza) puntosDec += peso;
    else {
      puntosDec += peso * 0.5; // falso positivo: medio punto (prudencia excesiva también cuesta: le sacás crédito legítimo al cliente)
      falsosPositivos += 1;
      errores.push(`${f.letra} ${f.ptoVta}-${f.numero} (${f.emisor}): era legítima. ${motivoFalsoPositivo(f, d?.motivo)}`);
    }
  }
  const necesarias = consultasNecesarias(caso);
  const holgura = Math.max(necesarias * 2, 4);
  const efic = r.consultasUsadas <= holgura ? 1 : Math.max(0, 1 - (r.consultasUsadas - holgura) / Math.max(1, caso.presupuestoConsultas - holgura));
  if (efic < 1) errores.push(`Usaste ${r.consultasUsadas} consultas: con ${necesarias} bien elegidas alcanzaba. Mirá primero lo que la factura ya te dice (CUIT, letra, CAE y su vencimiento, número) y consultá solo lo que no podés ver.`);
  const score = Math.max(0, Math.min(1, (maxDec ? puntosDec / maxDec : 1) * PESOS.decision + (maxMot ? puntosMot / maxMot : 1) * PESOS.motivo + efic * PESOS.eficiencia));
  const resumen =
    truchasDetectadas === truchasTotal && falsosPositivos === 0
      ? `Detectaste las ${truchasTotal} facturas apócrifas y no impugnaste ninguna legítima.`
      : `Detectaste ${truchasDetectadas} de ${truchasTotal} apócrifas${falsosPositivos ? ` e impugnaste ${falsosPositivos} legítima/s` : ''}.`;
  return { score: Math.round(score * 1000) / 1000, resumen, errores, creditoComputado: r2(creditoComputado), creditoImpugnado: r2(creditoImpugnado), creditoApocrifoComputado: r2(creditoApocrifoComputado), truchasDetectadas, truchasTotal, falsosPositivos };
}

function motivoFalsoPositivo(f: Factura, m?: Motivo): string {
  const base: Partial<Record<Motivo, string>> = {
    sin_capacidad: 'Un proveedor nuevo o con montos redondos no es trucho por eso solo: tenía empleados, domicilio real y actividad compatible.',
    pago_irregular: f.pago.medio === 'Efectivo' ? 'El efectivo estaba por debajo del tope legal y con recibo: es computable.' : 'El pago fue bancarizado a nombre del emisor.',
    actividad_incompatible: 'Su actividad inscripta era compatible con lo facturado.',
    cuit_invalido: 'El CUIT verifica bien con el módulo 11.',
    cae_vencido: 'La fecha de emisión era anterior al vencimiento del CAE.',
    letra_inconsistente: f.letra === 'C' ? 'La Factura C de un monotributista es correcta (sin IVA discriminado): no genera crédito, pero el gasto es válido.' : 'La letra coincide con la condición del emisor.',
  };
  return (m && base[m]) ?? 'Impugnar un comprobante válido le quita crédito fiscal real al cliente y lo deja pagando de más.';
}

/** Multa estimada por omisión (art. 45: 1 vez el impuesto omitido) para el resumen final. */
export function riesgoEvitado(creditoImpugnadoApocrifo: number): { impuesto: number; multaArt45: number } {
  const impuesto = r2(creditoImpugnadoApocrifo);
  return { impuesto, multaArt45: impuesto };
}

export function creditoApocrifoImpugnado(caso: CasoApocrifas, r: RespuestasApocrifas): number {
  return r2(caso.facturas.filter((f) => f.apocrifa && r.decisiones[f.id]?.rechaza).reduce((a, f) => a + (f.letra === 'A' || f.letra === 'M' ? f.iva : 0), 0));
}
