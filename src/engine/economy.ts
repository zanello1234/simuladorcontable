// Economía del estudio: facturación, cobranzas, gastos fijos, sueldos, inflación e impuestos propios.
import { addBusinessDays, adjustToBusinessDay, day, firstBusinessDayOfMonth, lastDayOfMonth, month, monthKey, nthBusinessDay, year, ymd } from './calendar';
import { CARGAS_SOCIALES, COSTOS_FIJOS, DIFICULTAD, IMPUESTOS_ESTUDIO, MARKETING, MONOTRIBUTO_CATEGORIAS, OFICINAS } from './config';
import { ajustarSatisfaccion, clientesActivos, cliente, fx, msg, mov, nid, precio } from './core';
import type { Rng } from './rng';
import { TOOL, hasEspecial } from './tools';
import type { Client, GameState, Invoice, ISODate, MonthlySummary } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

/** Día en que un cliente paga una factura (o undefined si no paga). */
export function calcularPago(rng: Rng, c: Client, emitida: ISODate, factor = 1): ISODate | undefined {
  const p = c.pagador;
  if (p < 0.3 && rng.chance(0.35)) return undefined; // moroso
  const base = p > 0.8 ? rng.int(1, 6) : p > 0.55 ? rng.int(4, 14) : p > 0.35 ? rng.int(10, 30) : rng.int(20, 55);
  return addBusinessDays(emitida, Math.round(base * factor));
}

export function emitirFactura(s: GameState, rng: Rng, c: Client, monto: number, concepto: string, periodo: string): Invoice {
  s.estudio.nroFactura += 1;
  const tipo = s.estudio.condicion === 'ri' ? 'A' : 'C';
  const inv: Invoice = {
    id: nid(s, 'f'),
    numero: `${tipo} 0001-${String(s.estudio.nroFactura).padStart(8, '0')}`,
    clientId: c.id,
    periodo,
    concepto,
    monto: Math.round(monto),
    emitida: s.date,
    vence: addBusinessDays(s.date, 8),
    pagaEl: undefined,
  };
  // facturar tarde demora el cobro
  const atraso = (day(s.date) > 10 ? 1.3 : 1) * DIFICULTAD[s.estudio.dificultad].pagos;
  inv.pagaEl = calcularPago(rng, c, s.date, atraso);
  s.invoices.push(inv);
  if (s.invoices.length > 1500) s.invoices.splice(0, s.invoices.length - 1500);
  return inv;
}

/** Emite los abonos del mes a todos los clientes activos. */
export function emitirAbonos(s: GameState, rng: Rng): { cantidad: number; total: number } {
  const mes = monthKey(s.date);
  if (s.estudio.facturasEmitidasMes === mes) return { cantidad: 0, total: 0 };
  let total = 0;
  let cantidad = 0;
  for (const c of clientesActivos(s)) {
    if (c.honorario <= 0) continue;
    emitirFactura(s, rng, c, c.honorario, `Honorarios profesionales ${pad(month(s.date))}/${year(s.date)}`, mes);
    total += c.honorario;
    cantidad += 1;
  }
  s.estudio.facturasEmitidasMes = mes;
  return { cantidad, total };
}

/** Cobranzas del día. */
export function procesarCobranzas(s: GameState): void {
  let total = 0;
  let n = 0;
  for (const inv of s.invoices) {
    if (inv.cobradaEl || inv.incobrable || !inv.pagaEl || inv.pagaEl > s.date) continue;
    const c = cliente(s, inv.clientId);
    inv.cobradaEl = s.date;
    mov(s, inv.monto, 'honorarios', `Cobro ${inv.numero} · ${c?.nombre ?? ''}`);
    total += inv.monto;
    n += 1;
    if (n <= 3) fx(s, 'cobro', { clientId: inv.clientId, monto: inv.monto });
  }
  if (n > 3) fx(s, 'cobro', { monto: total, texto: `${n} cobros` });
}

export const costoMensualHerramientas = (s: GameState) => s.tools.reduce((a, id) => a + precio(s, TOOL[id]?.costoMensual ?? 0), 0);
export const costoSueldos = (s: GameState) => s.workers.reduce((a, w) => a + w.sueldo * (1 + CARGAS_SOCIALES), 0);

export function cuotaMonotributoPropia(s: GameState): number {
  const ingresos12 = facturadoUltimos12(s);
  const cat = MONOTRIBUTO_CATEGORIAS.find((k) => ingresos12 <= k.ingresos * s.inflacion.indice) ?? MONOTRIBUTO_CATEGORIAS[MONOTRIBUTO_CATEGORIAS.length - 1];
  return precio(s, cat.cuotaServicios);
}

export function facturadoUltimos12(s: GameState): number {
  const desde = `${year(s.date) - 1}-${pad(month(s.date))}`;
  return s.invoices.filter((i) => i.periodo >= desde || i.emitida.slice(0, 7) >= desde).reduce((a, i) => a + i.monto, 0);
}

/** Gastos que vencen hoy (se llama una vez por día hábil). */
export function procesarGastosDelDia(s: GameState): void {
  const y = year(s.date);
  const m = month(s.date);
  const hoy = s.date;
  const enDia = (d: number) => adjustToBusinessDay(ymd(y, m, Math.min(d, lastDayOfMonth(y, m)))) === hoy;
  let egresos = 0;
  const pagar = (monto: number, cat: Parameters<typeof mov>[2], concepto: string) => {
    if (monto <= 0) return;
    mov(s, -monto, cat, concepto);
    egresos += monto;
  };

  // 1er día hábil: software, marketing y préstamo
  if (hoy === firstBusinessDayOfMonth(monthKey(hoy))) {
    for (const id of s.tools) {
      const t = TOOL[id];
      if (t && t.costoMensual > 0) pagar(precio(s, t.costoMensual), 'software', `Suscripción ${t.nombre}`);
    }
    pagar(precio(s, MARKETING[s.estudio.marketing].costo), 'marketing', `Marketing: ${MARKETING[s.estudio.marketing].nombre}`);
    const pr = s.estudio.prestamo;
    if (pr && pr.restantes > 0) {
      pagar(pr.cuota, 'otros', `Cuota préstamo bancario (quedan ${pr.restantes - 1})`);
      pr.restantes -= 1;
      if (pr.restantes <= 0) s.estudio.prestamo = undefined;
    }
  }
  // 4º día hábil: sueldos del equipo (LCT art. 128)
  if (hoy === nthBusinessDay(y, m, 4)) {
    const equipo = s.workers.filter((w) => w.id !== 'player');
    if (equipo.length) {
      const bruto = equipo.reduce((a, w) => a + w.sueldo, 0);
      pagar(bruto, 'sueldos', `Sueldos ${equipo.length} empleado/s`);
      pagar(bruto * CARGAS_SOCIALES, 'cargas_sociales', 'Contribuciones patronales y ART');
      fx(s, 'pago', { monto: bruto * (1 + CARGAS_SOCIALES), texto: 'Sueldos' });
    }
  }
  // SAC: 30/6 y 18/12
  if ((m === 6 && enDia(30)) || (m === 12 && enDia(18))) {
    const equipo = s.workers.filter((w) => w.id !== 'player');
    const sac = equipo.reduce((a, w) => a + w.sueldo / 2, 0);
    if (sac > 0) {
      pagar(sac, 'sueldos', 'Aguinaldo (SAC)');
      pagar(sac * CARGAS_SOCIALES, 'cargas_sociales', 'Contribuciones sobre SAC');
      msg(s, { canal: 'sistema', de: 'Sistema', asunto: '💸 Aguinaldo pagado', cuerpo: `Se pagó el medio aguinaldo al equipo: ${Math.round(sac).toLocaleString('es-AR')} pesos más contribuciones.` });
    }
  }
  // día 10: alquiler, servicios e insumos
  if (enDia(10)) {
    const of = OFICINAS[s.estudio.oficina];
    pagar(precio(s, of.alquiler), 'alquiler', `Alquiler ${of.nombre}`);
    pagar(precio(s, COSTOS_FIJOS.servicios * (1 + s.estudio.oficina * 0.6)), 'servicios', 'Luz, internet y teléfono');
    pagar(precio(s, COSTOS_FIJOS.porPuesto * s.workers.length), 'servicios', 'Insumos, papelería y cafetería');
  }
  // día 15: Caja profesional; marzo: matrícula
  if (enDia(15)) {
    pagar(precio(s, COSTOS_FIJOS.cajaProfesional), 'impuestos', 'Aporte Caja de Seguridad Social (profesionales)');
    if (m === 3) pagar(precio(s, COSTOS_FIJOS.matriculaAnual), 'impuestos', 'Derecho de ejercicio profesional (CPCE)');
  }
  // día 20: impuestos propios
  if (enDia(20)) {
    if (s.estudio.condicion === 'monotributista') {
      pagar(cuotaMonotributoPropia(s), 'impuestos', 'Cuota Monotributo del estudio');
    } else {
      const mesAnt = monthKey(addBusinessDays(firstBusinessDayOfMonth(monthKey(hoy)), -1));
      const fact = s.invoices.filter((i) => i.emitida.slice(0, 7) === mesAnt).reduce((a, i) => a + i.monto, 0);
      pagar(fact * IMPUESTOS_ESTUDIO.riSobreFacturado, 'impuestos', 'IVA, IIBB y anticipos del estudio');
    }
  }
  if (egresos > 0 && !s.fx.some((f) => f.tick === s.tick && f.kind === 'pago')) fx(s, 'pago', { monto: egresos });
}

/** Inflación del mes (aleatoria alrededor de la tasa base de la dificultad). */
export function actualizarInflacion(s: GameState, rng: Rng, base: number): number {
  let tasa = base * rng.range(0.6, 1.45);
  if (s.estudio.dificultad === 'argentina' && rng.chance(0.08)) tasa *= rng.range(2, 3.5); // "salto"
  tasa = Math.round(tasa * 1000) / 1000;
  s.inflacion.mensual = tasa;
  s.inflacion.indice = Math.round(s.inflacion.indice * (1 + tasa) * 10000) / 10000;
  s.inflacion.historia.push({ mes: monthKey(s.date), tasa });
  if (s.inflacion.historia.length > 60) s.inflacion.historia.shift();
  return tasa;
}

/** Resumen del mes que terminó (para gráficos). */
export function resumirMes(s: GameState, mes: string): MonthlySummary {
  const movs = s.ledger.filter((l) => l.date.startsWith(mes));
  const cobrado = movs.filter((l) => l.categoria === 'honorarios' && l.monto > 0).reduce((a, l) => a + l.monto, 0);
  const egresos = movs.filter((l) => l.monto < 0).reduce((a, l) => a + l.monto, 0);
  const multas = movs.filter((l) => l.categoria === 'multas').reduce((a, l) => a + l.monto, 0);
  const otrosIngresos = movs.filter((l) => l.monto > 0 && l.categoria !== 'honorarios').reduce((a, l) => a + l.monto, 0);
  const facturado = s.invoices.filter((i) => i.emitida.startsWith(mes)).reduce((a, i) => a + i.monto, 0);
  const presentadas = s.tasks.filter((t) => t.presentadaEl?.startsWith(mes));
  return {
    mes,
    facturado,
    cobrado,
    egresos: -egresos,
    multas: -multas,
    resultado: cobrado + otrosIngresos + egresos,
    caja: s.estudio.caja,
    clientes: clientesActivos(s).length,
    reputacion: s.estudio.reputacion,
    presentadasATiempo: presentadas.filter((t) => t.estado === 'presentada').length,
    presentadasTarde: presentadas.filter((t) => t.estado === 'presentada_tarde').length,
  };
}

/** Cuentas por cobrar vencidas por cliente */
export function deudaVencida(s: GameState, clientId: string): { monto: number; facturas: number } {
  const inv = s.invoices.filter((i) => i.clientId === clientId && !i.cobradaEl && !i.incobrable && i.vence < s.date);
  return { monto: inv.reduce((a, i) => a + i.monto, 0), facturas: inv.length };
}

export function porCobrar(s: GameState): number {
  return s.invoices.filter((i) => !i.cobradaEl && !i.incobrable).reduce((a, i) => a + i.monto, 0);
}

/** Actualización de abonos: reacción de cada cliente. */
export function aplicarAumento(s: GameState, rng: Rng, c: Client, pct: number): 'ok' | 'enojado' | 'se_va' {
  const atraso = s.inflacion.indice / c.honorarioIndice - 1;
  let golpe = pct * 35;
  if (pct > atraso) golpe += (pct - atraso) * 140;
  if (hasEspecial(s.tools, 'portal')) golpe *= 0.85;
  ajustarSatisfaccion(c, -golpe);
  c.honorario = Math.round((c.honorario * (1 + pct)) / 1000) * 1000;
  c.honorarioActualizadoEl = s.date;
  c.honorarioIndice = pct >= atraso ? s.inflacion.indice : c.honorarioIndice * (1 + pct);
  if (c.satisfaccion < 22 && rng.chance(0.5)) return 'se_va';
  return golpe > 8 ? 'enojado' : 'ok';
}
