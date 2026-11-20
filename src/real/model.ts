// Modelo de datos REAL del estudio (lo que el titular carga). Vive dentro del artefacto.
import type { ClientKind, ISODate, LedgerCategoria, Objetivo, Role } from '../engine/types';

export type TipoCliente = ClientKind | 'otro';
export type Riesgo = 'bajo' | 'medio' | 'alto';

export interface RClient {
  id: string;
  razonSocial: string;
  cuit: string;
  tipo: TipoCliente;
  rubro: string;
  jurisdiccion: 'local' | 'convenio';
  empleados: number;
  honorarioMensual: number;
  honorarioActualizadoEl: ISODate;
  responsable: string; // id equipo
  estado: 'activo' | 'baja';
  riesgo: Riesgo;
  notas: string;
}

export interface RVencimiento {
  id: string;
  clienteId: string;
  impuesto: string;
  periodo: string;
  vence: ISODate;
  estado: 'pendiente' | 'presentada' | 'presentada_tarde';
  presentadaEl: ISODate | '';
  responsable: string;
  horasEstimadas: number;
  notas: string;
}

export interface RFactura {
  id: string;
  clienteId: string;
  numero: string;
  emitida: ISODate;
  vence: ISODate;
  monto: number;
  concepto: string;
  estado: 'pendiente' | 'cobrada' | 'incobrable';
  cobradaEl: ISODate | '';
}

export interface RCobro {
  id: string;
  facturaId: string;
  clienteId: string;
  fecha: ISODate;
  monto: number;
  medio: string;
}

export interface RGasto {
  id: string;
  fecha: ISODate;
  concepto: string;
  categoria: LedgerCategoria;
  monto: number;
  recurrente: boolean;
  diaDelMes: number;
}

export interface RHora {
  id: string;
  fecha: ISODate;
  clienteId: string;
  colaborador: string; // id equipo
  horas: number;
  tarea: string;
}

export interface RPersona {
  id: string;
  nombre: string;
  rol: Role;
  costoMensual: number;
  horasSemanales: number;
  activo: boolean;
}

export interface RConfig {
  cajaHoy: number;
  cajaHoyFecha: ISODate;
  diasCobro: number;
  inflacionMensualEstimada: number; // 0.03 = 3%
  nombreEstudio: string;
  titular: string;
}

export interface RealData {
  clientes: RClient[];
  vencimientos: RVencimiento[];
  facturas: RFactura[];
  cobros: RCobro[];
  gastos: RGasto[];
  horas: RHora[];
  equipo: RPersona[];
  objetivos: Objetivo[];
  config: RConfig;
}

export type Entidad = 'clientes' | 'vencimientos' | 'facturas' | 'cobros' | 'gastos' | 'horas' | 'equipo' | 'objetivos';
export const ENTIDADES: Entidad[] = ['clientes', 'vencimientos', 'facturas', 'cobros', 'gastos', 'horas', 'equipo', 'objetivos'];

export const hoyISO = (): ISODate => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const CONFIG_DEFAULT: RConfig = { cajaHoy: 0, cajaHoyFecha: hoyISO(), diasCobro: 10, inflacionMensualEstimada: 0.025, nombreEstudio: 'Be OnlyOne', titular: 'Cr. Martín Zanello' };

export const DATA_VACIA: RealData = { clientes: [], vencimientos: [], facturas: [], cobros: [], gastos: [], horas: [], equipo: [], objetivos: [], config: { ...CONFIG_DEFAULT } };

// ----------------------------------------------------------------------------- esquema por entidad (para formularios, CSV y validación)

export type Campo = { key: string; label: string; tipo: 'texto' | 'numero' | 'fecha' | 'bool' | 'select'; opciones?: { v: string; label: string }[]; requerido?: boolean; ref?: 'clientes' | 'equipo' | 'facturas' };

export const TIPO_CLIENTE: { v: TipoCliente; label: string }[] = [
  { v: 'monotributista', label: 'Monotributista' },
  { v: 'ri_persona', label: 'RI persona humana' },
  { v: 'srl', label: 'SRL' },
  { v: 'sas', label: 'SAS' },
  { v: 'sa', label: 'SA' },
  { v: 'otro', label: 'Otro' },
];
export const ROLES_R: { v: Role; label: string }[] = [
  { v: 'titular', label: 'Titular' },
  { v: 'senior', label: 'Senior' },
  { v: 'semisenior', label: 'Semi senior' },
  { v: 'junior', label: 'Junior' },
  { v: 'liquidador', label: 'Liquidador/a de sueldos' },
  { v: 'administrativo', label: 'Administrativo/a' },
  { v: 'cadete', label: 'Cadete' },
];
export const CATEGORIAS_GASTO: { v: LedgerCategoria; label: string }[] = [
  { v: 'sueldos', label: 'Sueldos' },
  { v: 'cargas_sociales', label: 'Cargas sociales' },
  { v: 'alquiler', label: 'Alquiler' },
  { v: 'servicios', label: 'Servicios' },
  { v: 'software', label: 'Software' },
  { v: 'impuestos', label: 'Impuestos y Caja profesional' },
  { v: 'marketing', label: 'Marketing' },
  { v: 'capacitacion', label: 'Capacitación' },
  { v: 'otros', label: 'Otros' },
];
export const IMPUESTOS = ['IVA', 'IIBB', 'Sueldos', 'F.931', 'Monotributo', 'Recategorización', 'Ganancias PH', 'Bienes Personales', 'Ganancias Soc.', 'Balance', 'Registración', 'Otro'];

export const ESQUEMA: Record<Entidad, Campo[]> = {
  clientes: [
    { key: 'id', label: 'ID', tipo: 'texto' },
    { key: 'razonSocial', label: 'Razón social', tipo: 'texto', requerido: true },
    { key: 'cuit', label: 'CUIT', tipo: 'texto' },
    { key: 'tipo', label: 'Tipo', tipo: 'select', opciones: TIPO_CLIENTE },
    { key: 'rubro', label: 'Rubro', tipo: 'texto' },
    { key: 'jurisdiccion', label: 'IIBB', tipo: 'select', opciones: [{ v: 'local', label: 'Local' }, { v: 'convenio', label: 'Convenio Multilateral' }] },
    { key: 'empleados', label: 'Empleados', tipo: 'numero' },
    { key: 'honorarioMensual', label: 'Abono mensual', tipo: 'numero', requerido: true },
    { key: 'honorarioActualizadoEl', label: 'Abono actualizado el', tipo: 'fecha' },
    { key: 'responsable', label: 'Responsable', tipo: 'select', ref: 'equipo' },
    { key: 'estado', label: 'Estado', tipo: 'select', opciones: [{ v: 'activo', label: 'Activo' }, { v: 'baja', label: 'Baja' }] },
    { key: 'riesgo', label: 'Riesgo fiscal', tipo: 'select', opciones: [{ v: 'bajo', label: 'Bajo' }, { v: 'medio', label: 'Medio' }, { v: 'alto', label: 'Alto' }] },
    { key: 'notas', label: 'Notas', tipo: 'texto' },
  ],
  vencimientos: [
    { key: 'id', label: 'ID', tipo: 'texto' },
    { key: 'clienteId', label: 'Cliente', tipo: 'select', ref: 'clientes', requerido: true },
    { key: 'impuesto', label: 'Impuesto', tipo: 'select', opciones: IMPUESTOS.map((i) => ({ v: i, label: i })), requerido: true },
    { key: 'periodo', label: 'Período', tipo: 'texto' },
    { key: 'vence', label: 'Vence', tipo: 'fecha', requerido: true },
    { key: 'estado', label: 'Estado', tipo: 'select', opciones: [{ v: 'pendiente', label: 'Pendiente' }, { v: 'presentada', label: 'Presentada' }, { v: 'presentada_tarde', label: 'Presentada tarde' }] },
    { key: 'presentadaEl', label: 'Presentada el', tipo: 'fecha' },
    { key: 'responsable', label: 'Responsable', tipo: 'select', ref: 'equipo' },
    { key: 'horasEstimadas', label: 'Horas estimadas', tipo: 'numero' },
    { key: 'notas', label: 'Notas', tipo: 'texto' },
  ],
  facturas: [
    { key: 'id', label: 'ID', tipo: 'texto' },
    { key: 'clienteId', label: 'Cliente', tipo: 'select', ref: 'clientes', requerido: true },
    { key: 'numero', label: 'Número', tipo: 'texto' },
    { key: 'emitida', label: 'Emitida', tipo: 'fecha', requerido: true },
    { key: 'vence', label: 'Vence', tipo: 'fecha' },
    { key: 'monto', label: 'Monto', tipo: 'numero', requerido: true },
    { key: 'concepto', label: 'Concepto', tipo: 'texto' },
    { key: 'estado', label: 'Estado', tipo: 'select', opciones: [{ v: 'pendiente', label: 'Pendiente' }, { v: 'cobrada', label: 'Cobrada' }, { v: 'incobrable', label: 'Incobrable' }] },
    { key: 'cobradaEl', label: 'Cobrada el', tipo: 'fecha' },
  ],
  cobros: [
    { key: 'id', label: 'ID', tipo: 'texto' },
    { key: 'clienteId', label: 'Cliente', tipo: 'select', ref: 'clientes', requerido: true },
    { key: 'facturaId', label: 'Factura', tipo: 'select', ref: 'facturas' },
    { key: 'fecha', label: 'Fecha', tipo: 'fecha', requerido: true },
    { key: 'monto', label: 'Monto', tipo: 'numero', requerido: true },
    { key: 'medio', label: 'Medio', tipo: 'texto' },
  ],
  gastos: [
    { key: 'id', label: 'ID', tipo: 'texto' },
    { key: 'fecha', label: 'Fecha', tipo: 'fecha', requerido: true },
    { key: 'concepto', label: 'Concepto', tipo: 'texto', requerido: true },
    { key: 'categoria', label: 'Categoría', tipo: 'select', opciones: CATEGORIAS_GASTO },
    { key: 'monto', label: 'Monto', tipo: 'numero', requerido: true },
    { key: 'recurrente', label: 'Recurrente', tipo: 'bool' },
    { key: 'diaDelMes', label: 'Día del mes', tipo: 'numero' },
  ],
  horas: [
    { key: 'id', label: 'ID', tipo: 'texto' },
    { key: 'fecha', label: 'Fecha', tipo: 'fecha', requerido: true },
    { key: 'clienteId', label: 'Cliente', tipo: 'select', ref: 'clientes', requerido: true },
    { key: 'colaborador', label: 'Quién', tipo: 'select', ref: 'equipo' },
    { key: 'horas', label: 'Horas', tipo: 'numero', requerido: true },
    { key: 'tarea', label: 'Tarea', tipo: 'texto' },
  ],
  equipo: [
    { key: 'id', label: 'ID', tipo: 'texto' },
    { key: 'nombre', label: 'Nombre', tipo: 'texto', requerido: true },
    { key: 'rol', label: 'Rol', tipo: 'select', opciones: ROLES_R },
    { key: 'costoMensual', label: 'Costo mensual (sueldo + cargas)', tipo: 'numero' },
    { key: 'horasSemanales', label: 'Horas semanales', tipo: 'numero' },
    { key: 'activo', label: 'Activo', tipo: 'bool' },
  ],
  objetivos: [
    { key: 'id', label: 'ID', tipo: 'texto' },
    { key: 'tipo', label: 'Tipo', tipo: 'select', opciones: [{ v: 'clientes', label: 'Clientes activos' }, { v: 'facturacion', label: 'Abonos mensuales' }, { v: 'caja', label: 'Caja' }, { v: 'racha', label: 'Racha de presentaciones' }] },
    { key: 'meta', label: 'Meta', tipo: 'numero', requerido: true },
    { key: 'creado', label: 'Desde', tipo: 'fecha' },
    { key: 'cumplidoEl', label: 'Cumplido el', tipo: 'fecha' },
  ],
};

export const ENTIDAD_LABEL: Record<Entidad, { label: string; icon: string; ayuda: string }> = {
  clientes: { label: 'Clientes', icon: '🤝', ayuda: 'La cartera: razón social, tipo, abono mensual, responsable y riesgo.' },
  vencimientos: { label: 'Vencimientos', icon: '📅', ayuda: 'Obligaciones por cliente con fecha de vencimiento y estado. Podés generarlas por mes.' },
  facturas: { label: 'Facturas', icon: '🧾', ayuda: 'Honorarios facturados: emisión, vencimiento, monto y si se cobró.' },
  cobros: { label: 'Cobros', icon: '💰', ayuda: 'Lo que entró en caja (vinculado o no a una factura).' },
  gastos: { label: 'Gastos', icon: '💸', ayuda: 'Egresos del estudio. Marcá los recurrentes con su día del mes para proyectar la caja.' },
  horas: { label: 'Horas', icon: '⏱️', ayuda: 'Horas trabajadas por cliente: sin esto no hay $/hora ni margen.' },
  equipo: { label: 'Equipo', icon: '👥', ayuda: 'Las personas del estudio (vos incluido), con costo mensual y horas semanales.' },
  objetivos: { label: 'Objetivos', icon: '🎯', ayuda: 'Metas propias que el tablero sigue.' },
};

export function filaVacia(ent: Entidad, hoy: ISODate): Record<string, unknown> {
  const base: Record<Entidad, Record<string, unknown>> = {
    clientes: { tipo: 'srl', jurisdiccion: 'local', empleados: 0, honorarioMensual: 0, honorarioActualizadoEl: hoy, estado: 'activo', riesgo: 'bajo', rubro: '', cuit: '', responsable: '', notas: '' },
    vencimientos: { impuesto: 'IVA', periodo: hoy.slice(0, 7), vence: hoy, estado: 'pendiente', presentadaEl: '', responsable: '', horasEstimadas: 2, notas: '' },
    facturas: { emitida: hoy, vence: hoy, monto: 0, concepto: 'Honorarios profesionales', estado: 'pendiente', cobradaEl: '', numero: '' },
    cobros: { fecha: hoy, monto: 0, medio: 'Transferencia', facturaId: '' },
    gastos: { fecha: hoy, concepto: '', categoria: 'otros', monto: 0, recurrente: false, diaDelMes: Number(hoy.slice(8)) },
    horas: { fecha: hoy, horas: 1, tarea: '', colaborador: '' },
    equipo: { rol: 'junior', costoMensual: 0, horasSemanales: 40, activo: true },
    objetivos: { tipo: 'clientes', meta: 10, creado: hoy },
  };
  return { ...base[ent] };
}

let seq = 0;
export const nuevoId = (p: string) => `${p}${Date.now().toString(36)}${(seq++ % 1000).toString(36)}`;

/** Normaliza una fila cruda (CSV o formulario) a su tipo. */
export function normalizar(ent: Entidad, raw: Record<string, unknown>, hoy: ISODate): Record<string, unknown> {
  const out: Record<string, unknown> = { ...filaVacia(ent, hoy) };
  for (const c of ESQUEMA[ent]) {
    const v = raw[c.key];
    if (v === undefined || v === null || v === '') continue;
    if (c.tipo === 'numero') out[c.key] = parseNum(v);
    else if (c.tipo === 'bool') out[c.key] = v === true || /^(s[ií]|true|1|x|yes)$/i.test(String(v).trim());
    else if (c.tipo === 'fecha') out[c.key] = parseFecha(String(v));
    else if (c.tipo === 'select' && c.opciones) {
      const s = String(v).trim();
      const op = c.opciones.find((o) => o.v === s || o.label.toLowerCase() === s.toLowerCase());
      out[c.key] = op ? op.v : c.opciones[0].v;
    } else out[c.key] = String(v).trim();
  }
  if (!out.id) out.id = nuevoId(ent.slice(0, 2));
  return out;
}

export function parseNum(v: unknown): number {
  if (typeof v === 'number') return v;
  const t = String(v).replace(/\s|\$/g, '');
  if (!t) return 0;
  let norm: string;
  if (t.includes(',') && t.includes('.')) norm = t.lastIndexOf(',') > t.lastIndexOf('.') ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  else if (t.includes(',')) norm = t.replace(',', '.');
  else norm = t;
  const n = Number(norm);
  return Number.isFinite(n) ? n : 0;
}

export function parseFecha(s: string): string {
  const t = s.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return t;
}
