// Minijuego de conciliación bancaria — generación del caso, evaluación y armado de la conciliación
// (funciones puras, testeables).
import { isBusinessDay, lastDayOfMonth, MESES, ymd } from '../../engine/calendar';
import { money2, r2 } from '../../engine/format';
import { cuit } from '../../engine/names';
import { makeRng, type Rng } from '../../engine/rng';
import type { Client, ISODate, Task } from '../../engine/types';

// ----------------------------------------------------------------------------- Tipos

export type Categoria = 'cheque_no_debitado' | 'deposito_transito' | 'gasto_bancario' | 'impuesto_25413' | 'error_registracion';

export const CATEGORIAS: { id: Categoria; label: string; corto: string; explicacion: string }[] = [
  {
    id: 'cheque_no_debitado',
    label: 'Cheque emitido no debitado',
    corto: 'Cheque no debitado',
    explicacion: 'el cheque ya está registrado en libros pero todavía no se presentó al cobro: en la conciliación se resta del saldo del banco.',
  },
  {
    id: 'deposito_transito',
    label: 'Depósito en tránsito / no acreditado',
    corto: 'Depósito en tránsito',
    explicacion: 'el depósito está en libros pero el banco lo acredita después del cierre: en la conciliación se suma al saldo del banco.',
  },
  {
    id: 'gasto_bancario',
    label: 'Gasto bancario no registrado (ajustar libros)',
    corto: 'Gasto bancario',
    explicacion: 'el banco ya lo debitó y falta registrarlo: se ajusta en libros (el IVA de la comisión es crédito fiscal si el cliente es Responsable Inscripto).',
  },
  {
    id: 'impuesto_25413',
    label: 'Impuesto Ley 25.413 no registrado (ajustar libros)',
    corto: 'Imp. Ley 25.413',
    explicacion: 'es el impuesto sobre créditos y débitos bancarios que debita el banco: se registra en libros (una parte puede computarse como pago a cuenta según el régimen vigente).',
  },
  {
    id: 'error_registracion',
    label: 'Error de registración',
    corto: 'Error de registración',
    explicacion: 'es el mismo movimiento registrado en libros con otro importe: se corrige el asiento por la diferencia.',
  },
];
export const CAT = Object.fromEntries(CATEGORIAS.map((c) => [c.id, c])) as Record<Categoria, (typeof CATEGORIAS)[number]>;

/** Movimiento con importe con signo desde el punto de vista de la cuenta: + entra plata, − sale. */
export interface Mov {
  id: string;
  fecha: ISODate;
  concepto: string;
  importe: number;
}

export interface OpcionSaldo {
  id: string;
  monto: number;
  correcta: boolean;
  explicacion: string;
}

export interface CasoConciliacion {
  periodo: string; // 'YYYY-MM'
  periodoLabel: string;
  empresa: string;
  banco: string;
  cuenta: string;
  esRI: boolean;
  saldoInicial: number;
  /** extracto bancario (crédito = importe > 0, débito = importe < 0) */
  extracto: Mov[];
  /** mayor de Banco (debe = importe > 0, haber = importe < 0) */
  mayor: Mov[];
  saldoBanco: number;
  saldoLibros: number;
  /** solución: parejas verdaderas [idBanco, idLibro] (incluye la del error) */
  pares: [string, string][];
  errorPar: [string, string];
  /** solución: categoría de cada partida que está de un solo lado */
  categoria: Record<string, Categoria>;
  /** ajuste a libros por el error (con signo) */
  ajusteError: number;
  contraCuentaError: string;
  saldoConciliado: number;
  opcionesSaldo: OpcionSaldo[];
}

// ----------------------------------------------------------------------------- Generación

const BANCOS = ['Banco del Litoral', 'Banco Ribereño', 'Banco Federal del Centro', 'Banco de la Costa'];
const PROVEEDORES = ['Distribuidora Norte SRL', 'Papelera Rosario SA', 'Transportes El Ceibo', 'Insumos del Litoral SA', 'Mayorista San Martín', 'Gráfica Oroño SRL', 'Ferretería Industrial Sur', 'Envases Paraná SA'];
const CLIENTES = ['Comercial Pichincha SRL', 'Alberdi Servicios SA', 'Grupo Fisherton SA', 'La Ribera SAS', 'Construcciones Funes SRL', 'Agro Roldán SA', 'Logística Puerto Norte'];
const SERVICIOS = ['ENERGIA ELECTRICA', 'TELEFONIA E INTERNET', 'SEGURO INTEGRAL COMERCIO', 'AGUA Y CLOACAS'];

function periodoDe(task: Task, client: Client): string {
  if (/^\d{4}-\d{2}$/.test(task.periodo)) return task.periodo;
  if (/^\d{4}$/.test(task.periodo)) return `${task.periodo}-${String(client.cierre ?? 12).padStart(2, '0')}`;
  return task.vence.slice(0, 7);
}

function diaHabil(rng: Rng, y: number, m: number, desde: number, hasta: number): ISODate {
  const ult = lastDayOfMonth(y, m);
  const a = Math.max(1, Math.min(desde, ult));
  const b = Math.max(a, Math.min(hasta, ult));
  for (let i = 0; i < 20; i++) {
    const d = ymd(y, m, rng.int(a, b));
    if (isBusinessDay(d)) return d;
  }
  return ultimoHabil(y, m);
}

function ultimoHabil(y: number, m: number): ISODate {
  for (let d = lastDayOfMonth(y, m); d >= 1; d--) {
    const f = ymd(y, m, d);
    if (isBusinessDay(f)) return f;
  }
  return ymd(y, m, lastDayOfMonth(y, m));
}

/** Transpone dos dígitos contiguos de la parte entera (error típico de tipeo). */
export function transponer(x: number): number {
  const ent = Math.floor(x);
  const cent = r2(x - ent);
  const s = String(ent).split('');
  // preferimos transponer en el medio del número (145.320 → 154.320), no el primer dígito
  const desde = s.length >= 5 ? 1 : 0;
  for (let i = desde; i < Math.min(desde + 3, s.length - 1); i++) {
    if (s[i] !== s[i + 1] && !(i === 0 && s[i + 1] === '0')) {
      [s[i], s[i + 1]] = [s[i + 1], s[i]];
      return r2(Number(s.join('')) + cent);
    }
  }
  return r2(x + 9000);
}

interface Raw {
  fecha: ISODate;
  fechaLibro?: ISODate;
  banco?: { concepto: string; importe: number };
  libro?: { concepto: string; importe: number };
  tipo: 'par' | 'error' | 'banco' | 'libro';
  cat?: Categoria;
  bId?: string;
  lId?: string;
}

export function generarCasoConciliacion(seed: number, client: Client, task: Task, indice: number): CasoConciliacion {
  const rng = makeRng(seed ^ 0xc0c111);
  const periodo = periodoDe(task, client);
  const [y, m] = periodo.split('-').map(Number);
  const ult = lastDayOfMonth(y, m);
  const escala = indice * Math.min(3, Math.max(0.5, client.volumen / 100));
  const monto = (a: number, b: number) => r2(rng.range(a, b) * escala);
  const saldoInicial = r2(rng.range(1_500_000, 6_000_000) * escala);
  const raws: Raw[] = [];
  const nroCheque = () => rng.int(10000, 99999);
  const nroFact = () => `${String(rng.int(1, 5)).padStart(4, '0')}-${String(rng.int(100, 9999)).padStart(8, '0')}`;

  // --- movimientos que están en ambos lados
  const nPares = rng.int(5, 8);
  for (let i = 0; i < nPares; i++) {
    const tipo = rng.weighted([
      { item: 'cobranza', w: 3 },
      { item: 'deposito', w: 1.5 },
      { item: 'cheque', w: 3 },
      { item: 'transfProv', w: 2 },
      { item: 'debAut', w: 1 },
    ] as const);
    const fecha = diaHabil(rng, y, m, 2, ult - 4);
    if (tipo === 'cobranza') {
      const cli = rng.pick(CLIENTES);
      const x = monto(250_000, 2_200_000);
      raws.push({ fecha, tipo: 'par', banco: { concepto: `TRANSF. RECIBIDA CUIT ${cuit(rng, 'soc')}`, importe: x }, libro: { concepto: `Cobranza FC A ${nroFact()} – ${cli}`, importe: x } });
    } else if (tipo === 'deposito') {
      const x = monto(100_000, 900_000);
      raws.push({ fecha, tipo: 'par', banco: { concepto: `DEPOSITO EFECTIVO SUC. ${String(rng.int(1, 99)).padStart(3, '0')}`, importe: x }, libro: { concepto: 'Depósito de la recaudación en efectivo', importe: x } });
    } else if (tipo === 'cheque') {
      const n = nroCheque();
      const x = monto(80_000, 900_000);
      raws.push({
        fecha,
        fechaLibro: diaHabil(rng, y, m, 1, Number(fecha.slice(8, 10))),
        tipo: 'par',
        banco: { concepto: `CHEQUE ${String(n).padStart(8, '0')} COMPENSADO`, importe: -x },
        libro: { concepto: `Pago a ${rng.pick(PROVEEDORES)} – Ch. ${n}`, importe: -x },
      });
    } else if (tipo === 'transfProv') {
      const prov = rng.pick(PROVEEDORES);
      const x = monto(120_000, 1_200_000);
      raws.push({ fecha, tipo: 'par', banco: { concepto: `TRANSF. A CBU ...${rng.int(1000, 9999)} ${prov.split(' ')[0].toUpperCase()}`, importe: -x }, libro: { concepto: `Pago a ${prov} – transferencia`, importe: -x } });
    } else {
      const srv = rng.pick(SERVICIOS);
      const x = r2(rng.range(40_000, 250_000) * indice);
      raws.push({ fecha, tipo: 'par', banco: { concepto: `DEB. AUTOMATICO ${srv}`, importe: -x }, libro: { concepto: `Débito automático ${srv.toLowerCase()}`, importe: -x } });
    }
  }

  // --- error de registración (mismo movimiento, importe transpuesto en libros)
  let contraCuentaError: string;
  {
    const fecha = diaHabil(rng, y, m, 3, ult - 4);
    if (rng.chance(0.6)) {
      const n = nroCheque();
      const x = monto(100_000, 800_000);
      const xl = transponer(x);
      raws.push({
        fecha,
        tipo: 'error',
        banco: { concepto: `CHEQUE ${String(n).padStart(8, '0')} COMPENSADO`, importe: -x },
        libro: { concepto: `Pago a ${rng.pick(PROVEEDORES)} – Ch. ${n}`, importe: -xl },
      });
      contraCuentaError = 'Proveedores';
    } else {
      const x = monto(200_000, 1_500_000);
      const xl = transponer(x);
      raws.push({
        fecha,
        tipo: 'error',
        banco: { concepto: `TRANSF. RECIBIDA CUIT ${cuit(rng, 'soc')}`, importe: x },
        libro: { concepto: `Cobranza FC A ${nroFact()} – ${rng.pick(CLIENTES)}`, importe: xl },
      });
      contraCuentaError = 'Deudores por ventas';
    }
  }

  // --- partidas solo en el banco (ajustan libros)
  const fin = ultimoHabil(y, m);
  const comision = r2(rng.range(18_000, 45_000) * indice);
  const iva = r2(comision * 0.21);
  raws.push({ fecha: fin, tipo: 'banco', cat: 'gasto_bancario', banco: { concepto: 'COMISION MANTENIMIENTO CUENTA', importe: -comision } });
  raws.push({ fecha: fin, tipo: 'banco', cat: 'gasto_bancario', banco: { concepto: 'IVA 21% S/COMISION', importe: -iva } });
  const bancoMovs = raws.filter((r) => r.banco).map((r) => r.banco!.importe);
  const debitos = bancoMovs.filter((x) => x < 0).reduce((a, b) => a - b, 0);
  const creditos = bancoMovs.filter((x) => x > 0).reduce((a, b) => a + b, 0);
  raws.push({ fecha: fin, tipo: 'banco', cat: 'impuesto_25413', banco: { concepto: 'IMP. LEY 25413 S/DEBITOS', importe: -r2(debitos * 0.006) } });
  raws.push({ fecha: fin, tipo: 'banco', cat: 'impuesto_25413', banco: { concepto: 'IMP. LEY 25413 S/CREDITOS', importe: -r2(creditos * 0.006) } });

  // --- partidas solo en libros (ajustan el saldo del banco en la conciliación)
  const nCh = rng.int(1, 2);
  for (let i = 0; i < nCh; i++) {
    const n = nroCheque();
    raws.push({ fecha: diaHabil(rng, y, m, ult - 6, ult), tipo: 'libro', cat: 'cheque_no_debitado', libro: { concepto: `Pago a ${rng.pick(PROVEEDORES)} – Ch. ${n}`, importe: -monto(90_000, 700_000) } });
  }
  raws.push({ fecha: fin, tipo: 'libro', cat: 'deposito_transito', libro: { concepto: 'Depósito de la recaudación en efectivo', importe: monto(150_000, 900_000) } });

  // --- armado con ids por orden de fecha (los ids no revelan las parejas)
  const conBanco = raws.filter((r) => r.banco).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.banco!.importe - b.banco!.importe);
  const extracto: Mov[] = conBanco.map((r, i) => {
    r.bId = `b${i + 1}`;
    return { id: r.bId, fecha: r.fecha, concepto: r.banco!.concepto, importe: r.banco!.importe };
  });
  const conLibro = raws.filter((r) => r.libro).sort((a, b) => (a.fechaLibro ?? a.fecha).localeCompare(b.fechaLibro ?? b.fecha) || b.libro!.importe - a.libro!.importe);
  const mayor: Mov[] = conLibro.map((r, i) => {
    r.lId = `l${i + 1}`;
    return { id: r.lId, fecha: r.fechaLibro ?? r.fecha, concepto: r.libro!.concepto, importe: r.libro!.importe };
  });

  const pares: [string, string][] = raws.filter((r) => r.tipo === 'par' || r.tipo === 'error').map((r) => [r.bId!, r.lId!]);
  const err = raws.find((r) => r.tipo === 'error')!;
  const errorPar: [string, string] = [err.bId!, err.lId!];
  const categoria: Record<string, Categoria> = {};
  for (const r of raws) {
    if (r.tipo === 'banco') categoria[r.bId!] = r.cat!;
    if (r.tipo === 'libro') categoria[r.lId!] = r.cat!;
  }
  const ajusteError = r2(err.banco!.importe - err.libro!.importe);
  const total = (xs: Mov[]) => r2(xs.reduce((a, b) => a + b.importe, 0));
  const saldoBanco = r2(saldoInicial + total(extracto));
  const saldoLibros = r2(saldoInicial + total(mayor));
  const soloBanco = extracto.filter((x) => categoria[x.id]);
  const soloLibros = mayor.filter((x) => categoria[x.id]);
  const saldoConciliado = r2(saldoLibros + total(soloBanco) + ajusteError);

  // --- opciones de saldo
  const distractores: Omit<OpcionSaldo, 'id'>[] = [
    { monto: saldoLibros, correcta: false, explicacion: 'Elegiste el saldo contable sin ajustar: faltaba registrar gastos bancarios, el impuesto Ley 25.413 y corregir el error.' },
    { monto: r2(saldoBanco - total(soloLibros)), correcta: false, explicacion: 'Invertiste los signos: los depósitos en tránsito se suman al saldo del banco y los cheques no debitados se restan.' },
    { monto: saldoBanco, correcta: false, explicacion: 'Elegiste el saldo del extracto sin ajustar: hay depósitos en tránsito y cheques pendientes de débito.' },
    { monto: r2(saldoLibros + total(soloBanco)), correcta: false, explicacion: 'Registraste gastos e impuestos pero te faltó corregir el error de registración.' },
  ];
  const elegidos: Omit<OpcionSaldo, 'id'>[] = [{ monto: saldoConciliado, correcta: true, explicacion: '' }];
  for (const d of rng.shuffle(distractores)) {
    if (elegidos.length >= 3) break;
    if (elegidos.every((e) => Math.abs(e.monto - d.monto) > 0.5)) elegidos.push(d);
  }
  const opcionesSaldo = rng.shuffle(elegidos).map((o, i) => ({ ...o, id: `s${i}` }));

  return {
    periodo,
    periodoLabel: `${MESES[m - 1]} ${y}`,
    empresa: client.nombre,
    banco: rng.pick(BANCOS),
    cuenta: `Cta. Cte. $ N° ${rng.int(100, 999)}-${rng.int(100000, 999999)}/${rng.int(0, 9)}`,
    esRI: client.kind !== 'monotributista',
    saldoInicial,
    extracto,
    mayor,
    saldoBanco,
    saldoLibros,
    pares,
    errorPar,
    categoria,
    ajusteError,
    contraCuentaError,
    saldoConciliado,
    opcionesSaldo,
  };
}

// ----------------------------------------------------------------------------- Jugada y evaluación

export interface Jugada {
  pares: [string, string][];
  clasif: Record<string, Categoria>;
  saldoId: string | null;
}

export interface ItemClasificar {
  key: string;
  banco?: Mov;
  libro?: Mov;
  /** diferencia de importes si es una pareja que no coincide */
  diferencia?: number;
}

export const parKey = (b: string, l: string) => `${b}|${l}`;

export function itemsAClasificar(caso: CasoConciliacion, pares: [string, string][]): ItemClasificar[] {
  const B = new Map(caso.extracto.map((x) => [x.id, x]));
  const L = new Map(caso.mayor.map((x) => [x.id, x]));
  const usadosB = new Set(pares.map((p) => p[0]));
  const usadosL = new Set(pares.map((p) => p[1]));
  const items: ItemClasificar[] = [];
  for (const [b, l] of pares) {
    const d = r2(B.get(b)!.importe - L.get(l)!.importe);
    if (Math.abs(d) > 0.005) items.push({ key: parKey(b, l), banco: B.get(b), libro: L.get(l), diferencia: d });
  }
  for (const x of caso.extracto) if (!usadosB.has(x.id)) items.push({ key: x.id, banco: x });
  for (const x of caso.mayor) if (!usadosL.has(x.id)) items.push({ key: x.id, libro: x });
  return items;
}

export interface EvaluacionConciliacion {
  score: number;
  partes: { pares: number; clasif: number; saldo: number };
  errores: string[];
  resumen: string;
}

const q = (s: string) => `«${s}»`;

export function evaluarConciliacion(caso: CasoConciliacion, j: Jugada): EvaluacionConciliacion {
  const B = new Map(caso.extracto.map((x) => [x.id, x]));
  const L = new Map(caso.mayor.map((x) => [x.id, x]));
  const verdad = new Set(caso.pares.map(([b, l]) => parKey(b, l)));
  const jug = new Set(j.pares.map(([b, l]) => parKey(b, l)));
  const errores: string[] = [];
  const errKey = parKey(...caso.errorPar);

  // 1) emparejamiento
  let bien = 0;
  let mal = 0;
  for (const k of jug) {
    if (verdad.has(k)) bien++;
    else mal++;
  }
  const sPares = Math.max(0, Math.min(1, (bien - 0.5 * mal) / caso.pares.length));
  for (const [b, l] of caso.pares) {
    if (jug.has(parKey(b, l))) continue;
    if (parKey(b, l) === errKey) continue; // se comenta en la clasificación
    errores.push(`No emparejaste ${q(B.get(b)!.concepto)} con ${q(L.get(l)!.concepto)}: es el mismo movimiento (${money2(Math.abs(B.get(b)!.importe))}).`);
  }
  for (const [b, l] of j.pares) {
    if (!verdad.has(parKey(b, l))) errores.push(`Emparejaste ${q(B.get(b)!.concepto)} con ${q(L.get(l)!.concepto)}, pero no son el mismo movimiento.`);
  }

  // 2) clasificación
  const usadosB = new Set(j.pares.map((p) => p[0]));
  const usadosL = new Set(j.pares.map((p) => p[1]));
  const ids = Object.keys(caso.categoria);
  let okC = 0;
  for (const id of ids) {
    const esBanco = id.startsWith('b');
    const libre = esBanco ? !usadosB.has(id) : !usadosL.has(id);
    const cat = caso.categoria[id];
    const mov = (esBanco ? B : L).get(id)!;
    if (libre && j.clasif[id] === cat) {
      okC++;
      continue;
    }
    const elegida = libre ? j.clasif[id] : undefined;
    errores.push(`${q(mov.concepto)} (${money2(Math.abs(mov.importe))}) es ${q(CAT[cat].corto)}${elegida ? `, no ${q(CAT[elegida].corto)}` : ''}: ${CAT[cat].explicacion}`);
  }
  const [eb, el] = caso.errorPar;
  const errOk =
    (jug.has(errKey) && j.clasif[errKey] === 'error_registracion') ||
    (!usadosB.has(eb) && !usadosL.has(el) && j.clasif[eb] === 'error_registracion' && j.clasif[el] === 'error_registracion');
  if (errOk) okC++;
  else
    errores.push(
      `${q(B.get(eb)!.concepto)} y ${q(L.get(el)!.concepto)} son el mismo movimiento con importes distintos (${money2(Math.abs(B.get(eb)!.importe))} vs ${money2(Math.abs(L.get(el)!.importe))}): error de registración, se corrige en libros por ${money2(Math.abs(caso.ajusteError))}.`,
    );
  const totalC = ids.length + 1;
  const sClasif = okC / totalC;

  // 3) saldo
  const op = caso.opcionesSaldo.find((o) => o.id === j.saldoId);
  const sSaldo = op?.correcta ? 1 : 0;
  if (!op?.correcta) {
    errores.push(`${op ? op.explicacion : 'No elegiste el saldo conciliado.'} El saldo conciliado era ${money2(caso.saldoConciliado)}.`);
  }

  const score = 0.4 * sPares + 0.4 * sClasif + 0.2 * sSaldo;
  const MAX = 8;
  const lista = errores.length > MAX ? [...errores.slice(0, MAX), `…y ${errores.length - MAX} observación(es) más.`] : errores;
  const resumen = `Emparejaste bien ${bien} de ${caso.pares.length} movimientos${mal ? ` (${mal} pareja${mal > 1 ? 's' : ''} incorrecta${mal > 1 ? 's' : ''})` : ''}, clasificaste ${okC} de ${totalC} partidas y el saldo conciliado ${sSaldo ? 'cierra' : 'no cierra'}.`;
  return { score, partes: { pares: sPares, clasif: sClasif, saldo: sSaldo }, errores: lista, resumen };
}

/** La jugada perfecta (para tests y como referencia). */
export function jugadaPerfecta(caso: CasoConciliacion): Jugada {
  const clasif: Record<string, Categoria> = { ...caso.categoria, [parKey(...caso.errorPar)]: 'error_registracion' };
  return { pares: caso.pares.map((p) => [...p] as [string, string]), clasif, saldoId: caso.opcionesSaldo.find((o) => o.correcta)!.id };
}

// ----------------------------------------------------------------------------- Conciliación armada y asientos

export interface Conciliacion {
  saldoBanco: number;
  depositosTransito: Mov[];
  chequesPendientes: Mov[];
  bancoAjustado: number;
  saldoLibros: number;
  gastos: Mov[];
  impuestos: Mov[];
  ajusteError: number;
  librosAjustado: number;
}

export function armarConciliacion(caso: CasoConciliacion): Conciliacion {
  const total = (xs: Mov[]) => r2(xs.reduce((a, b) => a + b.importe, 0));
  const porCat = (xs: Mov[], c: Categoria) => xs.filter((x) => caso.categoria[x.id] === c);
  const depositosTransito = porCat(caso.mayor, 'deposito_transito');
  const chequesPendientes = porCat(caso.mayor, 'cheque_no_debitado');
  const gastos = porCat(caso.extracto, 'gasto_bancario');
  const impuestos = porCat(caso.extracto, 'impuesto_25413');
  return {
    saldoBanco: caso.saldoBanco,
    depositosTransito,
    chequesPendientes,
    bancoAjustado: r2(caso.saldoBanco + total(depositosTransito) + total(chequesPendientes)),
    saldoLibros: caso.saldoLibros,
    gastos,
    impuestos,
    ajusteError: caso.ajusteError,
    librosAjustado: r2(caso.saldoLibros + total(gastos) + total(impuestos) + caso.ajusteError),
  };
}

export interface Asiento {
  titulo: string;
  lineas: { cuenta: string; debe: number; haber: number }[];
}

export function asientosAjuste(caso: CasoConciliacion): Asiento[] {
  const c = armarConciliacion(caso);
  const cuentaBanco = `${caso.banco} c/c`;
  const asientos: Asiento[] = [];
  const comision = c.gastos.filter((g) => !g.concepto.startsWith('IVA')).reduce((a, b) => a - b.importe, 0);
  const iva = c.gastos.filter((g) => g.concepto.startsWith('IVA')).reduce((a, b) => a - b.importe, 0);
  const totGastos = r2(comision + iva);
  asientos.push({
    titulo: 'Gastos bancarios del período',
    lineas: caso.esRI
      ? [
          { cuenta: 'Gastos bancarios', debe: r2(comision), haber: 0 },
          { cuenta: 'IVA Crédito Fiscal', debe: r2(iva), haber: 0 },
          { cuenta: cuentaBanco, debe: 0, haber: totGastos },
        ]
      : [
          { cuenta: 'Gastos bancarios', debe: totGastos, haber: 0 },
          { cuenta: cuentaBanco, debe: 0, haber: totGastos },
        ],
  });
  const imp = r2(-c.impuestos.reduce((a, b) => a + b.importe, 0));
  asientos.push({
    titulo: 'Impuesto s/ créditos y débitos bancarios (Ley 25.413)',
    lineas: [
      { cuenta: 'Impuesto s/ créditos y débitos bancarios', debe: imp, haber: 0 },
      { cuenta: cuentaBanco, debe: 0, haber: imp },
    ],
  });
  const d = Math.abs(caso.ajusteError);
  asientos.push({
    titulo: 'Corrección del error de registración',
    lineas:
      caso.ajusteError > 0
        ? [
            { cuenta: cuentaBanco, debe: d, haber: 0 },
            { cuenta: caso.contraCuentaError, debe: 0, haber: d },
          ]
        : [
            { cuenta: caso.contraCuentaError, debe: d, haber: 0 },
            { cuenta: cuentaBanco, debe: 0, haber: d },
          ],
  });
  return asientos;
}
