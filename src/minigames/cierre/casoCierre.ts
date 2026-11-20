// Caso del minijuego "Cierre de ejercicio": balance pre-cierre, ajustes, clasificación y estados.
import { makeRng, type Rng } from '../../engine/rng';
import { money } from '../../engine/format';
import type { Client } from '../../engine/types';
import { D, H, comparar, round, type Asiento } from '../asientos/asiento';
import type { Chip } from '../asientos/casoAsientos';
import { PLAN, RUBRO_SECCION, cuenta, type RubroEECC } from '../asientos/planCuentas';
import type { MinigameResult } from '../types';

/** Parámetros de juego [A CONFIRMAR]: alícuota de Ganancias sociedades simplificada (art. 73, tramo máximo). */
export const ALICUOTA_GANANCIAS = 0.35;
/** vidas útiles en años (línea recta) */
export const VIDA_UTIL: Record<string, number> = { '1.2.01.01': 5, '1.2.01.02': 10, '1.2.01.03': 3 };

export interface SaldoCuenta {
  cuenta: string;
  /** positivo = saldo deudor, negativo = acreedor */
  saldo: number;
}
export type Plazo = 'corriente' | 'no_corriente' | 'na';

export interface Ajuste {
  id: string;
  titulo: string;
  datos: string[];
  chips: Chip[];
  sugeridas: string[];
  solucion: Asiento;
  /** 3 asientos propuestos (uno es la solución) */
  opciones: Asiento[];
  correcta: number;
  explicacion: string;
}

export interface CasoCierre {
  ejercicio: string;
  cierreLabel: string;
  cliente: string;
  preCierre: SaldoCuenta[];
  ajustes: Ajuste[];
  /** plazo esperado por cuenta patrimonial */
  plazos: Record<string, Plazo>;
  fichaPlazo: Record<string, string>;
  coefRT6: number;
}

type ClientLike = Pick<Client, 'nombre' | 'rubro' | 'volumen' | 'empleados' | 'kind' | 'cierre'>;
const r0 = (n: number) => Math.round(n);
const MESES_L = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function generarCasoCierre(seed: number, client: ClientLike, periodo: string, indice: number): CasoCierre {
  const rng = makeRng(seed);
  const k = indice * Math.max(0.6, Math.min(3, (client.volumen ?? 150) / 150));
  /** n expresado en miles de pesos base */
  const M = (n: number) => r0(n * k) * 1000;
  const mesCierre = client.cierre ?? 12;
  const ejercicio = periodo;
  const emp = Math.max(1, Math.min(8, client.empleados ?? 2));

  // --- bienes de uso (valor de origen, meses en uso en el ejercicio)
  const rodados = M(rng.int(5000, 9000));
  const equipos = M(rng.int(1200, 2400));
  const muebles = M(rng.int(700, 1400));
  const mesesEquipos = rng.pick([12, 12, 6, 9]);
  const depAcum = M(rng.int(1500, 3000));
  const capital = M(rng.int(1500, 4000));
  const reservaExistente = r0(capital * rng.range(0.02, 0.1) / 1000) * 1000;
  const prestamo = M(rng.int(2000, 4500));
  const prestamoNC = rng.chance(0.5);
  const anticipos = M(rng.int(400, 900));
  const morosos = M(rng.int(400, 900));
  const morososViejos = r0(morosos * rng.range(0.4, 0.8) / 1000) * 1000;
  const mercaderias = M(rng.int(2500, 4500));

  const pre: Record<string, number> = {
    '1.1.01.01': M(rng.int(200, 500)),
    '1.1.01.02': 0, // plug
    '1.1.03.01': M(rng.int(3500, 6000)),
    '1.1.03.02': morosos,
    '1.1.04.03': M(rng.int(120, 300)),
    '1.1.04.05': M(rng.int(200, 500)),
    '1.1.05.01': mercaderias,
    '1.2.01.01': rodados,
    '1.2.01.02': muebles,
    '1.2.01.03': equipos,
    '1.2.01.09': -depAcum,
    '2.1.01.01': -M(rng.int(2400, 3600)),
    '2.1.02.02': -M(rng.int(300, 500)) * (emp > 2 ? 1 : 0.5),
    '2.1.03.02': -M(rng.int(350, 600)),
    '2.1.03.03': -M(rng.int(100, 220)),
    '2.1.04.01': -prestamo,
    '2.1.05.01': -anticipos,
    '3.1.01.01': -capital,
    '3.2.01.01': -reservaExistente,
    '3.3.01.01': -M(rng.int(800, 2000)),
    '4.1.01.01': -M(rng.int(22000, 36000)),
    '4.1.02.01': M(rng.int(12000, 18000)),
    '4.2.01.01': M(rng.int(1100, 1500) * emp),
    '4.2.01.02': 0,
    '4.2.02.01': M(rng.int(1200, 2400)),
    '4.2.02.02': M(rng.int(600, 1200)),
    '4.2.02.03': M(rng.int(400, 900)),
    '4.2.02.06': M(rng.int(300, 800)),
    '4.2.03.01': 0,
    '4.2.03.03': M(rng.int(150, 350)),
    '4.3.01.01': M(rng.int(300, 700)),
  };
  pre['4.2.01.02'] = r0(pre['4.2.01.01'] * 0.27);
  pre['4.2.03.01'] = r0(-pre['4.1.01.01'] * 0.035);
  // plug banco: Activo = Pasivo + PN (+ resultados)
  let suma = Object.values(pre).reduce((a, b) => a + b, 0);
  let banco = -suma;
  if (banco < M(300)) {
    pre['4.1.01.01'] -= M(300) - banco;
    suma = Object.values(pre).reduce((a, b) => a + b, 0);
    banco = -suma;
  }
  pre['1.1.01.02'] = round(banco);

  // --- ajustes
  const ajustes: Ajuste[] = [];
  const opcionesDe = (rng: Rng, correcto: Asiento, malos: Asiento[]): { opciones: Asiento[]; correcta: number } => {
    const arr = rng.shuffle([correcto, ...malos.slice(0, 2)]);
    return { opciones: arr, correcta: arr.indexOf(correcto) };
  };
  const mesC = MESES_L[mesCierre - 1];
  const mesSig = MESES_L[mesCierre % 12];

  const posibles: (() => Ajuste)[] = [];
  // 1 intereses devengados
  posibles.push(() => {
    const tasa = rng.pick([0.03, 0.035, 0.04]);
    const meses = rng.int(1, 2);
    const monto = r0(prestamo * tasa * meses);
    const sol: Asiento = { lineas: [D('4.3.01.01', monto), H('2.1.04.02', monto)] };
    const o = opcionesDe(rng, sol, [{ lineas: [D('4.3.01.01', monto), H('2.1.04.01', monto)] }, { lineas: [D('4.3.01.01', monto), H('1.1.01.02', monto)] }]);
    return { id: 'intereses', titulo: 'Intereses del préstamo devengados y no pagados', datos: [`Préstamo bancario: capital ${money(prestamo)} · tasa ${(tasa * 100).toFixed(1)}% mensual`, `La última cuota se pagó hace ${meses} mes/es; la próxima vence en ${mesSig}`, `Intereses devengados al cierre: ${money(monto)}`], chips: [{ label: 'Intereses devengados', monto }, { label: 'Capital', monto: prestamo }], sugeridas: ['4.3.01.01', '2.1.04.02', '2.1.04.01', '1.1.01.02'], solucion: sol, ...o, explicacion: 'Los intereses se devengan con el tiempo aunque no se paguen: gasto financiero contra Intereses a pagar (no contra el capital del préstamo ni contra el banco).' };
  });
  // 2 provisión de gastos
  posibles.push(() => {
    const neto = M(rng.int(90, 220));
    const sol: Asiento = { lineas: [D('4.2.02.03', neto), H('2.1.06.01', neto)] };
    const o = opcionesDe(rng, sol, [{ lineas: [D('4.2.02.03', r0(neto * 1.21)), H('2.1.06.01', r0(neto * 1.21))] }, { lineas: [D('4.2.02.03', neto), H('1.1.01.02', neto)] }]);
    return { id: 'provision', titulo: `Factura de luz de ${mesC} que llega en ${mesSig}`, datos: [`Consumo de ${mesC} según medidor: neto estimado ${money(neto)} (+ IVA ${money(r0(neto * 0.21))})`, `La factura se emite y se paga en ${mesSig}`], chips: [{ label: 'Neto', monto: neto }, { label: 'Total con IVA', monto: r0(neto * 1.21) }], sugeridas: ['4.2.02.03', '2.1.06.01', '2.1.01.01', '1.1.04.01'], solucion: sol, ...o, explicacion: 'El gasto se devenga en el ejercicio en que se consumió el servicio: se provisiona por el neto. El IVA recién se computa cuando existe la factura.' };
  });
  // 3 depreciación (siempre)
  const depR = r0(rodados / VIDA_UTIL['1.2.01.01']);
  const depE = r0((equipos / VIDA_UTIL['1.2.01.03']) * (mesesEquipos / 12));
  const depM = r0(muebles / VIDA_UTIL['1.2.01.02']);
  const dep = depR + depE + depM;
  const depSol: Asiento = { lineas: [D('4.2.02.04', dep), H('1.2.01.09', dep)] };
  const depMala = depR + r0(equipos / 3) + depM;
  ajustes.push({
    id: 'depreciacion',
    titulo: 'Depreciación de bienes de uso del ejercicio',
    datos: [`Rodados: valor de origen ${money(rodados)} · vida útil 5 años · 12 meses en uso`, `Equipos de computación: ${money(equipos)} · vida útil 3 años · ${mesesEquipos} meses en uso`, `Muebles y útiles: ${money(muebles)} · vida útil 10 años · 12 meses en uso`, 'Método: línea recta, sin valor residual'],
    chips: [{ label: 'Total', monto: dep }, { label: 'Rodados', monto: depR }, { label: 'Equipos', monto: depE }, { label: 'Muebles', monto: depM }],
    sugeridas: ['4.2.02.04', '1.2.01.09', '1.2.01.01', '1.2.01.03'],
    solucion: depSol,
    ...opcionesDe(rng, depSol, [{ lineas: [D('4.2.02.04', depMala), H('1.2.01.09', depMala)] }, { lineas: [D('4.2.02.04', dep), H('1.2.01.01', depR), H('1.2.01.03', depE), H('1.2.01.02', depM)] }]),
    explicacion: `Depreciación lineal proporcional a los meses de uso (los equipos solo ${mesesEquipos}/12). Se acredita la Depreciación acumulada (regularizadora), nunca el bien.`,
  });
  // 4 previsión incobrables (siempre)
  const prevSol: Asiento = { lineas: [D('4.2.02.05', morososViejos), H('1.1.03.09', morososViejos)] };
  ajustes.push({
    id: 'prevision',
    titulo: 'Previsión para deudores incobrables',
    datos: [`Deudores morosos: ${money(morosos)}`, `De ellos, ${money(morososViejos)} tienen más de 180 días de atraso y gestión judicial iniciada`, 'Política: previsionar el 100% de la mora mayor a 180 días'],
    chips: [{ label: 'Mora > 180 días', monto: morososViejos }, { label: 'Morosos total', monto: morosos }],
    sugeridas: ['4.2.02.05', '1.1.03.09', '1.1.03.02', '1.1.03.01'],
    solucion: prevSol,
    ...opcionesDe(rng, prevSol, [{ lineas: [D('4.2.02.05', morososViejos), H('1.1.03.02', morososViejos)] }, { lineas: [D('4.2.02.05', morosos), H('1.1.03.09', morosos)] }]),
    explicacion: 'Se constituye una previsión (cuenta regularizadora del activo) por la mora estimada incobrable; el crédito no se da de baja hasta que la incobrabilidad sea definitiva.',
  });
  // 5 mercaderías
  posibles.push(() => {
    const fisico = r0(mercaderias * rng.range(0.9, 0.97) / 1000) * 1000;
    const dif = mercaderias - fisico;
    const sol: Asiento = { lineas: [D('4.1.02.01', dif), H('1.1.05.01', dif)] };
    const o = opcionesDe(rng, sol, [{ lineas: [D('4.3.02.02', dif), H('1.1.05.01', dif)] }, { lineas: [D('1.1.05.01', dif), H('4.1.02.01', dif)] }]);
    return { id: 'inventario', titulo: 'Ajuste de mercaderías al inventario físico', datos: [`Saldo contable de Mercaderías: ${money(mercaderias)}`, `Recuento físico al cierre valuado a costo: ${money(fisico)}`, `Diferencia (faltante/mermas): ${money(dif)}`], chips: [{ label: 'Diferencia', monto: dif }, { label: 'Físico', monto: fisico }, { label: 'Libros', monto: mercaderias }], sugeridas: ['4.1.02.01', '1.1.05.01', '4.3.02.02'], solucion: sol, ...o, explicacion: 'El faltante de inventario ajusta el costo de ventas contra Mercaderías. El resultado por tenencia es para cambios de valor, no para mermas.' };
  });
  // 6 anticipo entregado
  posibles.push(() => {
    const neto = round(anticipos / 1.21);
    const iva = round(anticipos - neto);
    const sol: Asiento = { lineas: [D('2.1.05.01', anticipos), H('4.1.01.01', neto), H('2.1.03.01', iva)] };
    const o = opcionesDe(rng, sol, [{ lineas: [D('2.1.05.01', anticipos), H('4.1.01.01', anticipos)] }, { lineas: [D('1.1.01.02', anticipos), H('4.1.01.01', neto), H('2.1.03.01', iva)] }]);
    return { id: 'anticipo', titulo: 'Anticipo de cliente cuya mercadería ya se entregó', datos: [`Anticipos de clientes registrados: ${money(anticipos)} (total con IVA)`, `El remito de entrega es del ${rng.int(20, 28)} de ${mesC}; la factura quedó sin emitir`, `Neto ${money(neto)} · IVA ${money(iva)}`], chips: [{ label: 'Anticipo', monto: anticipos }, { label: 'Neto', monto: neto }, { label: 'IVA', monto: iva }], sugeridas: ['2.1.05.01', '4.1.01.01', '2.1.03.01', '1.1.01.02'], solucion: sol, ...o, explicacion: 'Con la entrega se perfecciona la venta: el pasivo por anticipo se cancela contra Ventas (neto) e IVA Débito Fiscal.' };
  });
  // 7 sueldos devengados no pagados
  posibles.push(() => {
    const bruto = M(rng.int(1100, 1500) * emp);
    const aportes = r0(bruto * 0.17);
    const contrib = r0(bruto * 0.27);
    const neto = bruto - aportes;
    const sol: Asiento = { lineas: [D('4.2.01.01', bruto), D('4.2.01.02', contrib), H('2.1.02.01', neto), H('2.1.02.03', aportes), H('2.1.02.02', contrib)] };
    const o = opcionesDe(rng, sol, [{ lineas: [D('4.2.01.01', neto), H('2.1.02.01', neto)] }, { lineas: [D('4.2.01.01', bruto), H('2.1.02.01', neto), H('2.1.02.03', aportes)] }]);
    return { id: 'sueldos', titulo: `Sueldos de ${mesC} devengados, se pagan en ${mesSig}`, datos: [`Remuneraciones brutas ${money(bruto)} · aportes 17% ${money(aportes)} · neto ${money(neto)}`, `Contribuciones patronales 27% ${money(contrib)}`, 'Nada de esto está registrado al cierre'], chips: [{ label: 'Bruto', monto: bruto }, { label: 'Neto', monto: neto }, { label: 'Aportes', monto: aportes }, { label: 'Contribuciones', monto: contrib }], sugeridas: ['4.2.01.01', '4.2.01.02', '2.1.02.01', '2.1.02.02', '2.1.02.03'], solucion: sol, ...o, explicacion: 'Devengado: el costo laboral completo del mes de cierre es gasto del ejercicio aunque se pague después.' };
  });
  const elegidos = rng.shuffle(posibles).slice(0, rng.int(2, 4)).map((f) => f());
  ajustes.unshift(...elegidos.filter((a) => a.id !== 'sueldos'));
  const sue = elegidos.find((a) => a.id === 'sueldos');
  if (sue) ajustes.push(sue);

  // 8 RT 6 (siempre)
  const coef = rng.pick([1.25, 1.3, 1.35, 1.4]);
  const dBu = r0((rodados + equipos + muebles) * (coef - 1));
  const dCap = r0(capital * (coef - 1));
  const dR = r0(rodados * (coef - 1));
  const dE = r0(equipos * (coef - 1));
  const dM = dBu - dR - dE;
  const rt6Sol: Asiento = dBu >= dCap ? { lineas: [D('1.2.01.01', dR), D('1.2.01.03', dE), D('1.2.01.02', dM), H('3.1.01.02', dCap), H('4.3.02.01', dBu - dCap)] } : { lineas: [D('1.2.01.01', dR), D('1.2.01.03', dE), D('1.2.01.02', dM), D('4.3.02.01', dCap - dBu), H('3.1.01.02', dCap)] };
  ajustes.push({
    id: 'rt6',
    titulo: 'Ajuste por inflación contable (RT 6, simplificado)',
    datos: [`Coeficiente de reexpresión del ejercicio: ${coef.toFixed(2)}`, `Bienes de uso (no monetarios) a valor de origen: rodados ${money(rodados)}, equipos ${money(equipos)}, muebles ${money(muebles)} → reexpresión +${money(dBu)}`, `Capital social ${money(capital)} → ajuste del capital +${money(dCap)}`, 'Las partidas monetarias (caja, bancos, créditos y deudas en pesos) no se reexpresan: generan RECPAM por diferencia', 'Simplificación de juego: la depreciación acumulada y el CMV no se reexpresan [A CONFIRMAR]'],
    chips: [{ label: 'Δ Rodados', monto: dR }, { label: 'Δ Equipos', monto: dE }, { label: 'Δ Muebles', monto: dM }, { label: 'Δ Capital', monto: dCap }, { label: 'RECPAM', monto: Math.abs(dBu - dCap) }],
    sugeridas: ['1.2.01.01', '1.2.01.03', '1.2.01.02', '3.1.01.02', '4.3.02.01', '4.3.02.02'],
    solucion: rt6Sol,
    ...opcionesDe(rng, rt6Sol, [{ lineas: [D('1.2.01.01', dR), D('1.2.01.03', dE), D('1.2.01.02', dM), H('4.3.02.02', dBu)] }, { lineas: [D('1.2.01.01', dR), D('1.2.01.03', dE), D('1.2.01.02', dM), H('4.3.02.01', dBu)] }]),
    explicacion: 'Se reexpresan los rubros no monetarios (bienes de uso y capital). La contrapartida neta es el RECPAM: si el activo no monetario supera al capital reexpuesto, la posición monetaria neta era pasiva y el RECPAM es ganancia.',
  });

  // 9 impuesto a las ganancias (siempre, último): sobre el resultado luego de los demás ajustes
  const saldosParciales = aplicarAjustes(preToList(pre), Object.fromEntries(ajustes.map((a) => [a.id, a.solucion])));
  const resultadoAntes = resultadoDe(saldosParciales);
  const gan = resultadoAntes > 0 ? r0(resultadoAntes * ALICUOTA_GANANCIAS) : 0;
  const resultadoPre = resultadoDe(preToList(pre));
  const ganMala = r0(Math.max(0, resultadoPre) * ALICUOTA_GANANCIAS);
  const ganSol: Asiento = gan > 0 ? { lineas: [D('4.4.01.01', gan), H('2.1.03.05', gan)] } : { lineas: [] };
  const malos = [{ lineas: [D('4.4.01.01', ganMala || 1), H('2.1.03.05', ganMala || 1)] }, { lineas: [D('4.4.01.01', gan || ganMala || 1), H('1.1.04.05', gan || ganMala || 1)] }];
  ajustes.push({
    id: 'ganancias',
    titulo: 'Provisión del impuesto a las ganancias',
    datos: [`Resultado contable antes del impuesto (con todos los ajustes anteriores): ${money(resultadoAntes)}`, `Alícuota de juego: ${ALICUOTA_GANANCIAS * 100}% sobre el resultado contable [A CONFIRMAR: escala art. 73 y ajustes impositivos]`, `Impuesto determinado: ${money(gan)}`, 'Los anticipos ingresados se compensan recién al presentar la DDJJ'],
    chips: [{ label: 'Impuesto', monto: gan }, { label: 'Sobre resultado sin ajustar', monto: ganMala }],
    sugeridas: ['4.4.01.01', '2.1.03.05', '1.1.04.05'],
    solucion: ganSol,
    ...opcionesDe(rng, ganSol, malos),
    explicacion: 'El impuesto del ejercicio es un gasto devengado contra Impuesto a las ganancias a pagar. Se calcula sobre el resultado ya ajustado; los anticipos no se netean en este asiento.',
  });

  // plazos
  const plazos: Record<string, Plazo> = {};
  const fichaPlazo: Record<string, string> = {};
  const saldosFinales = aplicarAjustes(preToList(pre), Object.fromEntries(ajustes.map((a) => [a.id, a.solucion])));
  for (const sc of saldosFinales) {
    const c = cuenta(sc.cuenta);
    const sec = RUBRO_SECCION[c.rubro];
    if (sec === 'resultado' || sec === 'pn') plazos[sc.cuenta] = 'na';
    else if (c.rubro === 'bienes_uso') {
      plazos[sc.cuenta] = 'no_corriente';
      fichaPlazo[sc.cuenta] = 'Se usa por varios ejercicios';
    } else if (sc.cuenta === '2.1.04.01') {
      plazos[sc.cuenta] = prestamoNC ? 'no_corriente' : 'corriente';
      fichaPlazo[sc.cuenta] = prestamoNC ? 'Vence íntegramente en 18 meses' : 'Vence íntegramente en 9 meses';
    } else {
      plazos[sc.cuenta] = 'corriente';
      fichaPlazo[sc.cuenta] = 'Se realiza o exige dentro de los 12 meses';
    }
  }
  return { ejercicio, cierreLabel: `ejercicio cerrado el ${new Date(Date.UTC(Number(ejercicio), mesCierre, 0)).getUTCDate()} de ${mesC} de ${ejercicio}`, cliente: client.nombre, preCierre: preToList(pre), ajustes, plazos, fichaPlazo, coefRT6: coef };
}

function preToList(pre: Record<string, number>): SaldoCuenta[] {
  return Object.entries(pre)
    .filter(([, v]) => v !== 0)
    .map(([cuenta, saldo]) => ({ cuenta, saldo: round(saldo) }))
    .sort((a, b) => (a.cuenta < b.cuenta ? -1 : 1));
}

export function aplicarAjustes(pre: SaldoCuenta[], asientos: Record<string, Asiento | undefined>): SaldoCuenta[] {
  const m = new Map(pre.map((s) => [s.cuenta, s.saldo]));
  for (const a of Object.values(asientos)) for (const l of a?.lineas ?? []) m.set(l.cuenta, round((m.get(l.cuenta) ?? 0) + l.debe - l.haber));
  return [...m.entries()]
    .filter(([, v]) => Math.abs(v) >= 0.5)
    .map(([cuenta, saldo]) => ({ cuenta, saldo }))
    .sort((a, b) => (a.cuenta < b.cuenta ? -1 : 1));
}

/** Resultado del ejercicio (positivo = ganancia) a partir de los saldos. */
export function resultadoDe(saldos: SaldoCuenta[]): number {
  return round(-saldos.filter((s) => cuenta(s.cuenta).resultado).reduce((a, s) => a + s.saldo, 0));
}

export interface Clasif {
  rubro?: RubroEECC;
  plazo?: Plazo;
}
export interface RespuestasCierre {
  ajustes: Record<string, Asiento | undefined>;
  clasif: Record<string, Clasif>;
  resultadoOpcion?: number;
  reservaOpcion?: number;
}

export function capitalTotal(saldos: SaldoCuenta[]): number {
  return -saldos.filter((s) => s.cuenta === '3.1.01.01' || s.cuenta === '3.1.01.02').reduce((a, s) => a + s.saldo, 0);
}
export function reservaExistente(saldos: SaldoCuenta[]): number {
  return -(saldos.find((s) => s.cuenta === '3.2.01.01')?.saldo ?? 0);
}
/** Reserva legal (LGS art. 70): 5% de la ganancia hasta alcanzar el 20% del capital. */
export function reservaLegal(resultado: number, saldos: SaldoCuenta[]): number {
  if (resultado <= 0) return 0;
  const tope = Math.max(0, capitalTotal(saldos) * 0.2 - reservaExistente(saldos));
  return round(Math.min(resultado * 0.05, tope));
}

export function opcionesResultado(correcto: number, saldos: SaldoCuenta[]): { monto: number; correcta: boolean; label: string }[] {
  const imp = saldos.find((s) => s.cuenta === '4.4.01.01')?.saldo ?? 0;
  const recpam = saldos.find((s) => s.cuenta === '4.3.02.01')?.saldo ?? 0;
  const set = new Map<number, string>();
  set.set(correcto, 'Resultado neto del ejercicio');
  const sinImp = round(correcto + imp);
  if (!set.has(sinImp)) set.set(sinImp, 'Resultado antes del impuesto a las ganancias');
  const sinRecpam = round(correcto + recpam);
  if (!set.has(sinRecpam)) set.set(sinRecpam, 'Sin computar el RECPAM');
  if (set.size < 3) set.set(round(correcto * 1.1), 'Sin la provisión de gastos');
  return [...set.entries()].slice(0, 3).map(([monto]) => ({ monto, correcta: monto === correcto, label: '' }));
}
export function opcionesReserva(resultado: number, saldos: SaldoCuenta[]): { monto: number; correcta: boolean; detalle: string }[] {
  const ok = reservaLegal(resultado, saldos);
  const cinco = round(Math.max(0, resultado) * 0.05);
  const out = new Map<number, string>();
  out.set(ok, 'Reserva legal del ejercicio');
  if (!out.has(cinco)) out.set(cinco, '5% del resultado sin considerar el tope del 20% del capital');
  if (out.size < 3) out.set(round(Math.max(0, resultado) * 0.2), '20% del resultado');
  if (out.size < 3) out.set(0, 'No constituir reserva');
  return [...out.entries()].slice(0, 3).map(([monto, detalle]) => ({ monto, correcta: monto === ok, detalle }));
}

export function respuestasPerfectasCierre(caso: CasoCierre): RespuestasCierre {
  const ajustes = Object.fromEntries(caso.ajustes.map((a) => [a.id, { lineas: a.solucion.lineas.map((l) => ({ ...l })) }]));
  const saldos = aplicarAjustes(caso.preCierre, ajustes);
  const clasif: Record<string, Clasif> = {};
  for (const s of saldos) clasif[s.cuenta] = { rubro: cuenta(s.cuenta).rubro, plazo: caso.plazos[s.cuenta] ?? 'na' };
  const res = resultadoDe(saldos);
  return { ajustes, clasif, resultadoOpcion: res, reservaOpcion: reservaLegal(res, saldos) };
}

export function evaluarCierre(caso: CasoCierre, resp: RespuestasCierre): MinigameResult {
  const errores: string[] = [];
  // ajustes 50%
  let pa = 0;
  for (const a of caso.ajustes) {
    const cmp = comparar(resp.ajustes[a.id] ?? { lineas: [] }, a.solucion);
    const sc = cmp.cuentas * 0.6 + cmp.importes * 0.4;
    pa += sc;
    if (sc < 0.999) errores.push(`${a.titulo}: ${cmp.faltan.length ? `faltó ${cmp.faltan.map((l) => `${l.debe ? 'debitar' : 'acreditar'} ${l.cuenta}`).join(', ')}` : cmp.importesMal.length ? `importe incorrecto en ${cmp.importesMal.map((l) => l.cuenta).join(', ')}` : 'asiento incorrecto'}. ${a.explicacion}`);
  }
  const ajustesScore = pa / caso.ajustes.length;
  // clasificación 30% (sobre los saldos resultantes de LOS ASIENTOS CORRECTOS, para no castigar dos veces)
  const saldos = aplicarAjustes(caso.preCierre, Object.fromEntries(caso.ajustes.map((a) => [a.id, a.solucion])));
  let pc = 0;
  const malClasif: string[] = [];
  for (const s of saldos) {
    const c = cuenta(s.cuenta);
    const r = resp.clasif[s.cuenta] ?? {};
    const rubroOk = r.rubro === c.rubro;
    const plazoEsp = caso.plazos[s.cuenta] ?? 'na';
    const plazoOk = plazoEsp === 'na' ? true : r.plazo === plazoEsp;
    pc += (rubroOk ? 0.7 : 0) + (plazoOk ? 0.3 : 0);
    if (!rubroOk || !plazoOk) malClasif.push(`${c.nombre}${!rubroOk ? ` (va en ${RUBRO_LABEL_SAFE(c.rubro)})` : ''}${!plazoOk ? ` (${plazoEsp === 'no_corriente' ? 'no corriente' : 'corriente'}: ${caso.fichaPlazo[s.cuenta] ?? ''})` : ''}`);
  }
  const clasifScore = saldos.length ? pc / saldos.length : 1;
  if (malClasif.length) errores.push(`Clasificación en rubros: ${malClasif.slice(0, 6).join('; ')}${malClasif.length > 6 ? ` y ${malClasif.length - 6} más` : ''}.`);
  // estados 20%
  const res = resultadoDe(saldos);
  const resOk = resp.resultadoOpcion !== undefined && Math.abs(resp.resultadoOpcion - res) < 1;
  const rl = reservaLegal(res, saldos);
  const rlOk = resp.reservaOpcion !== undefined && Math.abs(resp.reservaOpcion - rl) < 1;
  if (!resOk) errores.push(`El resultado del ejercicio era ${money(res)}: es la suma de todas las cuentas de resultado después de los ajustes, incluido el impuesto a las ganancias y el RECPAM.`);
  if (!rlOk) errores.push(`Reserva legal (LGS art. 70): 5% de la ganancia del ejercicio hasta alcanzar el 20% del capital (incluido el ajuste del capital). Correspondía ${money(rl)}.`);
  const estadosScore = (resOk ? 0.5 : 0) + (rlOk ? 0.5 : 0);
  const score = Math.round((ajustesScore * 0.5 + clasifScore * 0.3 + estadosScore * 0.2) * 1000) / 1000;
  const resumen = score >= 0.999 ? `Ejercicio cerrado sin observaciones: resultado ${money(res)}, EECC listos para firmar.` : `Cierre con observaciones: ajustes ${Math.round(ajustesScore * 100)}%, exposición ${Math.round(clasifScore * 100)}%, estados ${Math.round(estadosScore * 100)}%.`;
  return { score, resumen, errores: errores.slice(0, 8).concat(errores.length > 8 ? [`…y ${errores.length - 8} observaciones más`] : []) };
}

function RUBRO_LABEL_SAFE(r: RubroEECC): string {
  const found = PLAN.find((c) => c.rubro === r);
  void found;
  return r.replace(/_/g, ' ');
}

// ----------------------------------------------------------------------------- estados contables

export interface Estados {
  activoCorriente: [string, number][];
  activoNoCorriente: [string, number][];
  pasivoCorriente: [string, number][];
  pasivoNoCorriente: [string, number][];
  pn: [string, number][];
  totalActivo: number;
  totalPasivo: number;
  totalPN: number;
  er: { ventas: number; cmv: number; bruto: number; admin: number; com: number; rfyt: number; antesImp: number; imp: number; neto: number };
}

/** Arma ESP y ER con la clasificación dada (la del jugador o la correcta). */
export function estadosDesde(saldos: SaldoCuenta[], clasif: Record<string, Clasif>): Estados {
  const rubroTot = (pred: (c: Clasif, s: SaldoCuenta) => boolean, signo: 1 | -1) => {
    const m = new Map<string, number>();
    for (const s of saldos) {
      const c = clasif[s.cuenta] ?? {};
      if (!c.rubro || !pred(c, s)) continue;
      m.set(c.rubro, round((m.get(c.rubro) ?? 0) + s.saldo * signo));
    }
    return [...m.entries()];
  };
  const esSec = (sec: 'activo' | 'pasivo' | 'pn') => (c: Clasif) => !!c.rubro && RUBRO_SECCION[c.rubro] === sec;
  const activoCorriente = rubroTot((c) => esSec('activo')(c) && c.plazo !== 'no_corriente', 1);
  const activoNoCorriente = rubroTot((c) => esSec('activo')(c) && c.plazo === 'no_corriente', 1);
  const pasivoCorriente = rubroTot((c) => esSec('pasivo')(c) && c.plazo !== 'no_corriente', -1);
  const pasivoNoCorriente = rubroTot((c) => esSec('pasivo')(c) && c.plazo === 'no_corriente', -1);
  const pn = rubroTot(esSec('pn'), -1);
  const suma = (l: [string, number][]) => round(l.reduce((a, [, v]) => a + v, 0));
  const resultado = resultadoDe(saldos);
  pn.push(['resultado_ejercicio', resultado]);
  const porRubro = (r: RubroEECC) => round(saldos.filter((s) => (clasif[s.cuenta]?.rubro ?? cuenta(s.cuenta).rubro) === r).reduce((a, s) => a + s.saldo, 0));
  const ventas = -porRubro('ventas');
  const cmv = porRubro('cmv');
  const admin = porRubro('gastos_admin');
  const com = porRubro('gastos_com');
  const rfyt = porRubro('rfyt');
  const imp = porRubro('imp_ganancias');
  const bruto = round(ventas - cmv);
  const antesImp = round(bruto - admin - com - rfyt);
  return { activoCorriente, activoNoCorriente, pasivoCorriente, pasivoNoCorriente, pn, totalActivo: suma(activoCorriente) + suma(activoNoCorriente), totalPasivo: suma(pasivoCorriente) + suma(pasivoNoCorriente), totalPN: suma(pn), er: { ventas, cmv, bruto, admin, com, rfyt, antesImp, imp, neto: round(antesImp - imp) } };
}
