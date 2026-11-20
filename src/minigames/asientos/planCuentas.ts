// Plan de cuentas genérico PyME argentino con codificación al estilo del plan argentino de Odoo.
// Es un plan de juego: sirve para registrar, cerrar y exponer según RT 9 / RT 54 en forma simplificada.

export type RubroEECC =
  | 'caja_bancos'
  | 'creditos_ventas'
  | 'otros_creditos'
  | 'bienes_cambio'
  | 'bienes_uso'
  | 'deudas_comerciales'
  | 'deudas_fiscales'
  | 'remuneraciones'
  | 'deudas_financieras'
  | 'otros_pasivos'
  | 'capital'
  | 'reservas'
  | 'resultados_acumulados'
  | 'ventas'
  | 'cmv'
  | 'gastos_admin'
  | 'gastos_com'
  | 'rfyt'
  | 'imp_ganancias';

export const RUBRO_LABEL: Record<RubroEECC, string> = {
  caja_bancos: 'Caja y bancos',
  creditos_ventas: 'Créditos por ventas',
  otros_creditos: 'Otros créditos',
  bienes_cambio: 'Bienes de cambio',
  bienes_uso: 'Bienes de uso',
  deudas_comerciales: 'Deudas comerciales',
  deudas_fiscales: 'Deudas fiscales',
  remuneraciones: 'Remuneraciones y cargas sociales',
  deudas_financieras: 'Deudas financieras',
  otros_pasivos: 'Otros pasivos',
  capital: 'Capital',
  reservas: 'Reservas',
  resultados_acumulados: 'Resultados acumulados',
  ventas: 'Ventas',
  cmv: 'Costo de mercaderías vendidas',
  gastos_admin: 'Gastos de administración',
  gastos_com: 'Gastos de comercialización',
  rfyt: 'Resultados financieros y por tenencia',
  imp_ganancias: 'Impuesto a las ganancias',
};

export type Seccion = 'activo' | 'pasivo' | 'pn' | 'resultado';
export const RUBRO_SECCION: Record<RubroEECC, Seccion> = {
  caja_bancos: 'activo',
  creditos_ventas: 'activo',
  otros_creditos: 'activo',
  bienes_cambio: 'activo',
  bienes_uso: 'activo',
  deudas_comerciales: 'pasivo',
  deudas_fiscales: 'pasivo',
  remuneraciones: 'pasivo',
  deudas_financieras: 'pasivo',
  otros_pasivos: 'pasivo',
  capital: 'pn',
  reservas: 'pn',
  resultados_acumulados: 'pn',
  ventas: 'resultado',
  cmv: 'resultado',
  gastos_admin: 'resultado',
  gastos_com: 'resultado',
  rfyt: 'resultado',
  imp_ganancias: 'resultado',
};

export const RUBROS_PATRIMONIALES: RubroEECC[] = ['caja_bancos', 'creditos_ventas', 'otros_creditos', 'bienes_cambio', 'bienes_uso', 'deudas_comerciales', 'deudas_fiscales', 'remuneraciones', 'deudas_financieras', 'otros_pasivos', 'capital', 'reservas', 'resultados_acumulados'];
export const RUBROS_RESULTADO: RubroEECC[] = ['ventas', 'cmv', 'gastos_admin', 'gastos_com', 'rfyt', 'imp_ganancias'];

export interface Cuenta {
  codigo: string;
  nombre: string;
  rubro: RubroEECC;
  naturaleza: 'deudora' | 'acreedora';
  /** resta dentro de su rubro (previsiones, depreciaciones acumuladas) */
  regularizadora?: boolean;
  /** cuenta de resultado */
  resultado?: boolean;
  /** palabras clave para el buscador */
  alias?: string;
}

const C = (codigo: string, nombre: string, rubro: RubroEECC, naturaleza: Cuenta['naturaleza'], extra: Partial<Cuenta> = {}): Cuenta => ({ codigo, nombre, rubro, naturaleza, ...extra });

export const PLAN: Cuenta[] = [
  C('1.1.01.01', 'Caja', 'caja_bancos', 'deudora', { alias: 'efectivo' }),
  C('1.1.01.02', 'Banco Nación c/c', 'caja_bancos', 'deudora', { alias: 'banco cuenta corriente transferencia cheque' }),
  C('1.1.03.01', 'Deudores por ventas', 'creditos_ventas', 'deudora', { alias: 'clientes cuenta corriente' }),
  C('1.1.03.02', 'Deudores morosos', 'creditos_ventas', 'deudora'),
  C('1.1.03.05', 'Socio Gómez cuenta particular', 'otros_creditos', 'deudora', { alias: 'socio retiro personal' }),
  C('1.1.03.09', 'Previsión para incobrables', 'creditos_ventas', 'acreedora', { regularizadora: true }),
  C('1.1.04.01', 'IVA Crédito Fiscal', 'otros_creditos', 'deudora', { alias: 'iva cf compras' }),
  C('1.1.04.02', 'Retenciones de IVA sufridas', 'otros_creditos', 'deudora'),
  C('1.1.04.03', 'Retenciones de Ganancias sufridas', 'otros_creditos', 'deudora'),
  C('1.1.04.04', 'Percepciones IIBB sufridas', 'otros_creditos', 'deudora', { alias: 'ingresos brutos percepcion' }),
  C('1.1.04.05', 'Anticipos de Ganancias', 'otros_creditos', 'deudora'),
  C('1.1.04.06', 'Gastos pagados por adelantado', 'otros_creditos', 'deudora', { alias: 'anticipado adelantado seguro' }),
  C('1.1.05.01', 'Mercaderías', 'bienes_cambio', 'deudora', { alias: 'stock inventario' }),
  C('1.2.01.01', 'Rodados', 'bienes_uso', 'deudora', { alias: 'camioneta auto' }),
  C('1.2.01.02', 'Muebles y útiles', 'bienes_uso', 'deudora'),
  C('1.2.01.03', 'Equipos de computación', 'bienes_uso', 'deudora', { alias: 'notebook pc servidor' }),
  C('1.2.01.09', 'Depreciación acumulada bienes de uso', 'bienes_uso', 'acreedora', { regularizadora: true, alias: 'amortizacion acumulada' }),
  C('2.1.01.01', 'Proveedores', 'deudas_comerciales', 'acreedora', { alias: 'cuenta corriente compras' }),
  C('2.1.02.01', 'Sueldos a pagar', 'remuneraciones', 'acreedora', { alias: 'haberes' }),
  C('2.1.02.02', 'Cargas sociales a pagar', 'remuneraciones', 'acreedora', { alias: 'contribuciones patronales 931' }),
  C('2.1.02.03', 'Retenciones a depositar (SUSS)', 'remuneraciones', 'acreedora', { alias: 'aportes jubilacion obra social' }),
  C('2.1.03.01', 'IVA Débito Fiscal', 'deudas_fiscales', 'acreedora', { alias: 'iva df ventas' }),
  C('2.1.03.02', 'IVA a pagar', 'deudas_fiscales', 'acreedora', { alias: 'saldo iva' }),
  C('2.1.03.03', 'IIBB a pagar', 'deudas_fiscales', 'acreedora', { alias: 'ingresos brutos' }),
  C('2.1.03.04', 'Retenciones de Ganancias a depositar (SICORE)', 'deudas_fiscales', 'acreedora', { alias: 'sicore retencion practicada' }),
  C('2.1.03.05', 'Impuesto a las ganancias a pagar', 'deudas_fiscales', 'acreedora', { alias: 'provision ganancias' }),
  C('2.1.04.01', 'Préstamos bancarios', 'deudas_financieras', 'acreedora', { alias: 'credito banco capital' }),
  C('2.1.04.02', 'Intereses a pagar', 'deudas_financieras', 'acreedora', { alias: 'intereses devengados' }),
  C('2.1.05.01', 'Anticipos de clientes', 'otros_pasivos', 'acreedora', { alias: 'seña adelanto cliente' }),
  C('2.1.06.01', 'Provisión para gastos', 'otros_pasivos', 'acreedora', { alias: 'gastos a pagar devengados' }),
  C('3.1.01.01', 'Capital social', 'capital', 'acreedora'),
  C('3.1.01.02', 'Ajuste del capital', 'capital', 'acreedora', { alias: 'reexpresion rt6 inflacion' }),
  C('3.2.01.01', 'Reserva legal', 'reservas', 'acreedora'),
  C('3.3.01.01', 'Resultados no asignados', 'resultados_acumulados', 'acreedora', { alias: 'rna acumulados' }),
  C('3.3.01.02', 'Resultado del ejercicio', 'resultados_acumulados', 'acreedora'),
  C('4.1.01.01', 'Ventas', 'ventas', 'acreedora', { resultado: true, alias: 'ingresos facturacion' }),
  C('4.1.02.01', 'Costo de mercaderías vendidas', 'cmv', 'deudora', { resultado: true, alias: 'cmv costo' }),
  C('4.2.01.01', 'Sueldos y jornales', 'gastos_admin', 'deudora', { resultado: true, alias: 'remuneraciones bruto' }),
  C('4.2.01.02', 'Cargas sociales', 'gastos_admin', 'deudora', { resultado: true, alias: 'contribuciones patronales' }),
  C('4.2.02.01', 'Alquileres', 'gastos_admin', 'deudora', { resultado: true, alias: 'local' }),
  C('4.2.02.02', 'Honorarios profesionales', 'gastos_admin', 'deudora', { resultado: true, alias: 'contador abogado' }),
  C('4.2.02.03', 'Servicios (luz, gas, internet)', 'gastos_admin', 'deudora', { resultado: true, alias: 'edenor epe luz gas telefono' }),
  C('4.2.02.04', 'Depreciación bienes de uso', 'gastos_admin', 'deudora', { resultado: true, alias: 'amortizacion' }),
  C('4.2.02.05', 'Deudores incobrables', 'gastos_com', 'deudora', { resultado: true, alias: 'incobrables quebranto' }),
  C('4.2.02.06', 'Publicidad y propaganda', 'gastos_com', 'deudora', { resultado: true, alias: 'marketing redes' }),
  C('4.2.03.01', 'Impuesto sobre los ingresos brutos', 'gastos_com', 'deudora', { resultado: true, alias: 'iibb' }),
  C('4.2.03.02', 'Impuesto a los débitos y créditos', 'gastos_admin', 'deudora', { resultado: true, alias: 'ley 25413 cheque' }),
  C('4.2.03.03', 'Gastos bancarios', 'gastos_admin', 'deudora', { resultado: true, alias: 'comisiones mantenimiento' }),
  C('4.3.01.01', 'Intereses perdidos', 'rfyt', 'deudora', { resultado: true, alias: 'intereses pagados prestamo' }),
  C('4.3.01.02', 'Intereses ganados', 'rfyt', 'acreedora', { resultado: true, alias: 'plazo fijo' }),
  C('4.3.02.01', 'RECPAM', 'rfyt', 'deudora', { resultado: true, alias: 'inflacion rt6 exposicion poder adquisitivo' }),
  C('4.3.02.02', 'Resultado por tenencia', 'rfyt', 'deudora', { resultado: true }),
  C('4.4.01.01', 'Impuesto a las ganancias', 'imp_ganancias', 'deudora', { resultado: true, alias: 'provision' }),
];

const POR_CODIGO = new Map(PLAN.map((c) => [c.codigo, c]));

export function cuenta(codigo: string): Cuenta {
  const c = POR_CODIGO.get(codigo);
  if (!c) throw new Error(`Cuenta inexistente: ${codigo}`);
  return c;
}
export const nombreCuenta = (codigo: string) => cuenta(codigo).nombre;
export const etiqueta = (codigo: string) => `${codigo} ${cuenta(codigo).nombre}`;

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/** Busca por código o por texto (nombre o alias). Las sugeridas van primero. */
export function buscarCuentas(q: string, sugeridas: string[] = [], max = 8): Cuenta[] {
  const t = norm(q.trim());
  const sug = sugeridas.map((c) => POR_CODIGO.get(c)).filter((c): c is Cuenta => !!c);
  if (!t) return sug.slice(0, max);
  const matches = PLAN.filter((c) => c.codigo.startsWith(t) || norm(c.nombre).includes(t) || (c.alias && norm(c.alias).includes(t)));
  const ordered = [...sug.filter((c) => matches.includes(c)), ...matches.filter((c) => !sug.includes(c))];
  return ordered.slice(0, max);
}

export const esPatrimonial = (codigo: string) => !cuenta(codigo).resultado;
