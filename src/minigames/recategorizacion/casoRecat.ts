// Generación del caso de recategorización de Monotributo y cálculo de la solución — funciones puras.
import { makeRng, type Rng } from '../../engine/rng';
import { money, num, r2 } from '../../engine/format';
import { MESES_CORTOS, periodoLabel } from '../../engine/calendar';
import { MONOTRIBUTO_CATEGORIAS } from '../../engine/config';
import type { Client, Rubro } from '../../engine/types';
import type { MinigameResult } from '../types';

export type Actividad = 'servicios' | 'ventas';
export type ParamId = 'ingresos' | 'superficie' | 'energia' | 'alquiler';

/** índice 0..10 = A..K ; 11 = excede la K (exclusión) */
export const EXCLUSION = 11;
export const LETRAS = MONOTRIBUTO_CATEGORIAS.map((c) => c.cat as string);
export const catLabel = (i: number) => (i >= EXCLUSION ? 'Excede K' : LETRAS[i]);

export interface FilaTabla {
  cat: string;
  ingresos: number;
  superficie: number;
  energia: number;
  alquiler: number;
  cuotaServicios: number;
  cuotaVentas: number;
}

export interface MesFact {
  mes: string; // YYYY-MM
  label: string;
  facturado: number;
  nc: number;
}

export type ErrorIngresos = 'sin_nc' | 'once_meses' | 'anualizado' | 'trece_meses';

export interface OpcionIngresos {
  id: string;
  monto: number;
  correcta: boolean;
  error?: ErrorIngresos;
}

export interface ParametroRecat {
  id: ParamId;
  label: string;
  valor: number;
  display: string;
  categoria: number;
}

export interface CasoRecat {
  periodo: string;
  periodoLabel: string;
  actividad: Actividad;
  categoriaActual?: string;
  meses: MesFact[];
  totalFacturado: number;
  totalNC: number;
  ingresos: number;
  opcionesIngresos: OpcionIngresos[];
  parametros: ParametroRecat[];
  categoriaFinal: number;
  /** parámetro que define la categoría final */
  determinante: ParamId;
  tabla: FilaTabla[];
  cuota: number | null;
}

export const PARAM_LABEL: Record<ParamId, string> = {
  ingresos: 'Ingresos brutos (12 meses)',
  superficie: 'Superficie afectada',
  energia: 'Energía eléctrica consumida (anual)',
  alquiler: 'Alquileres devengados (anual)',
};

export const EXPLICACION_INGRESOS: Record<ErrorIngresos, string> = {
  sin_nc: 'Las notas de crédito emitidas restan: los ingresos brutos son lo facturado neto de anulaciones, devoluciones y descuentos.',
  once_meses: 'Se suman los ingresos de los últimos 12 meses completos del período, no 11.',
  trece_meses: 'Sumaste 13 meses: se toman solo los 12 meses del período que se recategoriza.',
  anualizado: 'Anualizar solo corresponde cuando no llegás a 12 meses de actividad; acá hay 12 meses completos y se suman tal cual.',
};

const ACT_POR_RUBRO: Record<Rubro, Actividad> = {
  comercio: 'ventas',
  gastronomia: 'ventas',
  agro: 'ventas',
  industria: 'ventas',
  servicios: 'servicios',
  salud: 'servicios',
  transporte: 'servicios',
  construccion: 'servicios',
};

export function tablaEscalada(indice: number): FilaTabla[] {
  const k = Math.max(0.2, indice);
  return MONOTRIBUTO_CATEGORIAS.map((c) => ({
    cat: c.cat,
    ingresos: Math.round(c.ingresos * k),
    superficie: c.superficie,
    energia: c.energia,
    alquiler: Math.round(c.alquiler * k),
    cuotaServicios: Math.round(c.cuotaServicios * k),
    cuotaVentas: Math.round(c.cuotaVentas * k),
  }));
}

const limite = (t: FilaTabla[], p: ParamId, i: number) => (p === 'ingresos' ? t[i].ingresos : p === 'superficie' ? t[i].superficie : p === 'energia' ? t[i].energia : t[i].alquiler);

/** Categoría que corresponde a un valor: la primera cuyo tope no se supera. */
export function categoriaPara(t: FilaTabla[], p: ParamId, valor: number): number {
  for (let i = 0; i < t.length; i++) if (valor <= limite(t, p, i)) return i;
  return EXCLUSION;
}

/** Índices "alcanzables" para un parámetro (los que son primera categoría de su tope). */
function categoriasValidas(t: FilaTabla[], p: ParamId): number[] {
  const out: number[] = [];
  for (let i = 0; i < t.length; i++) if (i === 0 || limite(t, p, i) > limite(t, p, i - 1)) out.push(i);
  return out;
}

function valorEnCategoria(rng: Rng, t: FilaTabla[], p: ParamId, cat: number): number {
  const hi = limite(t, p, cat);
  let lo = 0;
  for (let i = cat - 1; i >= 0; i--) {
    if (limite(t, p, i) < hi) {
      lo = limite(t, p, i);
      break;
    }
  }
  if (cat === 0) lo = hi * (p === 'alquiler' ? 0.25 : 0.35);
  const span = hi - lo;
  const v = lo + span * rng.range(0.08, 0.95);
  if (p === 'superficie') return Math.max(Math.floor(lo) + 1, Math.min(hi, Math.round(v)));
  if (p === 'energia') return Math.max(Math.floor(lo) + 1, Math.min(hi, Math.round(v)));
  return Math.round(v / 1000) * 1000;
}

/** Meses considerados: S1 → ene–dic del año anterior; S2 → jul del año anterior a jun. */
function mesesDelPeriodo(periodo: string): string[] {
  const m = /^(\d{4})-S([12])$/.exec(periodo);
  let y = 2027;
  let desde = 1;
  if (m) {
    y = Number(m[1]);
    if (m[2] === '1') {
      y -= 1;
      desde = 1;
    } else {
      y -= 1;
      desde = 7;
    }
  } else if (/^\d{4}/.test(periodo)) {
    y = Number(periodo.slice(0, 4)) - 1;
  }
  const out: string[] = [];
  for (let k = 0; k < 12; k++) {
    const mm = desde - 1 + k;
    const yy = y + Math.floor(mm / 12);
    out.push(`${yy}-${String((mm % 12) + 1).padStart(2, '0')}`);
  }
  return out;
}

function fmtValor(p: ParamId, v: number): string {
  if (p === 'superficie') return `${num(v)} m²`;
  if (p === 'energia') return `${num(v)} kW`;
  return money(v);
}

export function generarCasoRecat(seed: number, client: Pick<Client, 'rubro' | 'categoria'>, periodoIn: string, indice: number): CasoRecat {
  const rng = makeRng(seed);
  const tabla = tablaEscalada(indice);
  const actividad = ACT_POR_RUBRO[client.rubro] ?? 'servicios';
  const meses = mesesDelPeriodo(periodoIn);
  const periodo = /^\d{4}-S[12]$/.test(periodoIn) ? periodoIn : `${meses[11].slice(0, 4)}-S2`;

  // --- categoría por ingresos (≈10% exclusión)
  const exclusion = rng.chance(0.1);
  const catIng = exclusion ? EXCLUSION : rng.weighted([10, 12, 12, 11, 9, 8, 6, 4, 3, 2, 1].map((w, i) => ({ item: i, w })));
  let objetivo: number;
  if (exclusion) objetivo = tabla[10].ingresos * rng.range(1.03, 1.17);
  else {
    const hi = tabla[catIng].ingresos;
    const lo = catIng === 0 ? hi * 0.4 : tabla[catIng - 1].ingresos;
    objetivo = lo + (hi - lo) * rng.range(0.06, 0.94);
  }
  objetivo = Math.round(objetivo);

  // --- facturación mensual (creciente por inflación, con ruido) y alguna NC
  const pesos = meses.map((_, i) => Math.pow(0.98, 11 - i) * rng.range(0.75, 1.25));
  const sumaP = pesos.reduce((a, b) => a + b, 0);
  const hayNC = rng.chance(0.55);
  const mesNC = rng.int(1, 11);
  const ncMonto = hayNC ? r2(Math.round((objetivo / 12) * rng.range(0.16, 0.4))) : 0;
  const bruto = objetivo + ncMonto;
  const facturados = pesos.map((w) => r2(Math.round((bruto * w) / sumaP)));
  // ajustar redondeo para que el neto cierre exacto
  const diff = r2(bruto - facturados.reduce((a, b) => a + b, 0));
  facturados[11] = r2(facturados[11] + diff);
  const mesesFact: MesFact[] = meses.map((m, i) => ({
    mes: m,
    label: `${MESES_CORTOS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`,
    facturado: facturados[i],
    nc: hayNC && i === mesNC ? ncMonto : 0,
  }));
  const totalFacturado = r2(facturados.reduce((a, b) => a + b, 0));
  const totalNC = r2(ncMonto);
  const ingresos = r2(totalFacturado - totalNC);

  // --- opciones de ingresos
  const netoMes = mesesFact.map((m) => m.facturado - m.nc);
  const cand: { error: ErrorIngresos; monto: number }[] = [];
  if (hayNC) cand.push({ error: 'sin_nc', monto: totalFacturado });
  cand.push({ error: 'once_meses', monto: r2(ingresos - netoMes[rng.chance(0.5) ? 0 : 11]) });
  cand.push({ error: 'anualizado', monto: r2(netoMes.slice(6).reduce((a, b) => a + b, 0) * 2) });
  rng.shuffle(cand);
  // respaldo si algún distractor queda demasiado cerca del correcto
  cand.push({ error: 'once_meses', monto: r2(ingresos - Math.max(...netoMes)) });
  cand.push({ error: 'anualizado', monto: r2(netoMes.slice(0, 6).reduce((a, b) => a + b, 0) * 2) });
  cand.push({ error: 'anualizado', monto: r2(netoMes[11] * 12) });
  cand.push({ error: 'trece_meses', monto: r2(ingresos + netoMes[11] * 1.02) });
  const distintos: typeof cand = [];
  for (const c of cand) {
    if (distintos.length >= 2) break;
    if (Math.abs(c.monto - ingresos) <= ingresos * 0.01) continue;
    if (distintos.some((d) => Math.abs(d.monto - c.monto) <= ingresos * 0.01)) continue;
    distintos.push(c);
  }
  const opcionesIngresos: OpcionIngresos[] = rng
    .shuffle([{ monto: ingresos, correcta: true } as Omit<OpcionIngresos, 'id'>, ...distintos.map((d) => ({ monto: d.monto, correcta: false, error: d.error }))])
    .map((o, i) => ({ ...o, id: `i${i + 1}` }));

  // --- parámetros físicos
  const otros: ParamId[] = ['superficie', 'energia', 'alquiler'];
  const cats: Record<ParamId, number> = { ingresos: catIng, superficie: 0, energia: 0, alquiler: 0 };
  const base = exclusion ? 6 : catIng;
  const elegibles = otros.filter((p) => Math.max(...categoriasValidas(tabla, p)) > base);
  const subir = !exclusion && elegibles.length > 0 && rng.chance(0.6) ? rng.pick(elegibles) : undefined;
  for (const p of otros) {
    const validas = categoriasValidas(tabla, p);
    if (p === subir) {
      cats[p] = rng.pick(validas.filter((c) => c > base));
    } else {
      const bajas = validas.filter((c) => c <= base);
      const extra = !exclusion && rng.chance(0.12) ? validas.filter((c) => c > base) : [];
      cats[p] = rng.pick(extra.length ? extra : bajas.length ? bajas : [0]);
    }
  }
  const valores: Record<ParamId, number> = {
    ingresos,
    superficie: valorEnCategoria(rng, tabla, 'superficie', cats.superficie),
    energia: valorEnCategoria(rng, tabla, 'energia', cats.energia),
    alquiler: rng.chance(0.2) && cats.alquiler === 0 ? 0 : valorEnCategoria(rng, tabla, 'alquiler', cats.alquiler),
  };
  const parametros: ParametroRecat[] = (['ingresos', ...otros] as ParamId[]).map((p) => {
    const categoria = categoriaPara(tabla, p, valores[p]);
    return { id: p, label: PARAM_LABEL[p], valor: valores[p], display: fmtValor(p, valores[p]), categoria };
  });

  const categoriaFinal = Math.max(...parametros.map((p) => p.categoria));
  const determinante = parametros.reduce((a, b) => (b.categoria > a.categoria ? b : a)).id;
  const cuota = categoriaFinal >= EXCLUSION ? null : actividad === 'servicios' ? tabla[categoriaFinal].cuotaServicios : tabla[categoriaFinal].cuotaVentas;

  return {
    periodo,
    periodoLabel: periodoLabel(periodo),
    actividad,
    categoriaActual: client.categoria,
    meses: mesesFact,
    totalFacturado,
    totalNC,
    ingresos,
    opcionesIngresos,
    parametros,
    categoriaFinal,
    determinante,
    tabla,
    cuota,
  };
}

// ----------------------------------------------------------------------------- evaluación

export interface RespuestasRecat {
  ingresosId?: string;
  params: Partial<Record<ParamId, number>>;
  final?: number;
}

export const PESOS_RECAT = { ingresos: 0.25, parametro: 0.1, final: 0.35 };

export function respuestasPerfectasRecat(caso: CasoRecat): RespuestasRecat {
  const params: Partial<Record<ParamId, number>> = {};
  for (const p of caso.parametros) params[p.id] = p.categoria;
  return { ingresosId: caso.opcionesIngresos.find((o) => o.correcta)?.id, params, final: caso.categoriaFinal };
}

export function textoCategoria(i: number): string {
  if (i >= EXCLUSION) return 'Exclusión del régimen: pasa a Responsable Inscripto';
  return `Categoría ${LETRAS[i]}`;
}

export function evaluarRecat(caso: CasoRecat, r: RespuestasRecat): MinigameResult {
  const errores: string[] = [];
  let score = 0;

  const op = caso.opcionesIngresos.find((o) => o.id === r.ingresosId);
  if (op?.correcta) score += PESOS_RECAT.ingresos;
  else
    errores.push(
      `Ingresos brutos: ${op ? `elegiste ${money(op.monto)}` : 'no elegiste un total'}; lo correcto era ${money(caso.ingresos)} (facturado ${money(caso.totalFacturado)} − notas de crédito ${money(caso.totalNC)}). ${op?.error ? EXPLICACION_INGRESOS[op.error] : ''}`.trim(),
    );

  for (const p of caso.parametros) {
    const sel = r.params[p.id];
    if (sel === p.categoria) score += PESOS_RECAT.parametro;
    else
      errores.push(
        `${p.label} (${p.display}): corresponde ${catLabel(p.categoria)}${sel === undefined ? '' : `, no ${catLabel(sel)}`}. La categoría es la primera cuyo tope no superás.`,
      );
  }

  const det = caso.parametros.find((p) => p.id === caso.determinante)!;
  if (r.final === caso.categoriaFinal) score += PESOS_RECAT.final;
  else if (caso.categoriaFinal >= EXCLUSION)
    errores.push(`Los ingresos (${money(caso.ingresos)}) superan el tope de la categoría K: corresponde la exclusión del régimen y el alta como Responsable Inscripto (IVA y Ganancias).`);
  else if (r.final !== undefined && r.final >= EXCLUSION)
    errores.push('Ningún parámetro supera los máximos de la categoría K: no corresponde la exclusión del régimen.');
  else
    errores.push(
      `Categoría final: la que corresponde es la MAYOR que surja de cualquiera de los parámetros. Acá ${det.label.toLowerCase()} (${det.display}) te lleva a ${catLabel(caso.categoriaFinal)}${r.final !== undefined ? `, no a ${catLabel(r.final)}` : ''}.`,
    );

  const cuotaTxt = caso.cuota !== null ? ` · cuota mensual ${money(caso.cuota)} (${caso.actividad === 'servicios' ? 'servicios' : 'venta de bienes'})` : '';
  const elegido = r.final !== undefined ? ` Elegiste: ${textoCategoria(r.final)}.` : '';
  const resumen = `Correcto: ${textoCategoria(caso.categoriaFinal)}${cuotaTxt}.${elegido}`;
  return { score: Math.min(1, Math.max(0, r2(score))), resumen, errores: errores.length > 8 ? [...errores.slice(0, 8), `…y ${errores.length - 8} observaciones más.`] : errores };
}
