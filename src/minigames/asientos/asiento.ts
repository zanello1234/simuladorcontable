// Modelo de asiento y comparación con la solución (compartido por "Asientos del mes" y "Cierre").
export interface Linea {
  cuenta: string; // código del plan
  debe: number;
  haber: number;
}
export interface Asiento {
  lineas: Linea[];
}

export const D = (cuenta: string, monto: number): Linea => ({ cuenta, debe: round(monto), haber: 0 });
export const H = (cuenta: string, monto: number): Linea => ({ cuenta, debe: 0, haber: round(monto) });
export const round = (n: number) => Math.round(n * 100) / 100;

export const totalDebe = (a: Asiento) => round(a.lineas.reduce((s, l) => s + l.debe, 0));
export const totalHaber = (a: Asiento) => round(a.lineas.reduce((s, l) => s + l.haber, 0));
export const diferencia = (a: Asiento) => round(totalDebe(a) - totalHaber(a));
export const balancea = (a: Asiento) => a.lineas.length > 0 && Math.abs(diferencia(a)) < 0.5 && a.lineas.every((l) => l.cuenta && (l.debe > 0 || l.haber > 0));

const lado = (l: Linea) => (l.debe > 0 ? 'D' : 'H');
const monto = (l: Linea) => (l.debe > 0 ? l.debe : l.haber);

export interface Comparacion {
  /** fracción de líneas de la solución con cuenta y lado correctos (penaliza líneas de más) */
  cuentas: number;
  /** fracción de líneas de la solución con cuenta, lado e importe correctos */
  importes: number;
  faltan: Linea[];
  sobran: Linea[];
  importesMal: Linea[];
}

/** Compara el asiento del jugador con la solución. Un asiento vacío contra una solución vacía es perfecto. */
export function comparar(jugador: Asiento, solucion: Asiento, tolerancia = 1): Comparacion {
  if (!solucion.lineas.length) {
    const ok = jugador.lineas.length === 0;
    return { cuentas: ok ? 1 : 0, importes: ok ? 1 : 0, faltan: [], sobran: jugador.lineas, importesMal: [] };
  }
  // agrupar por cuenta+lado (una misma cuenta puede aparecer una vez por lado)
  const agrupar = (a: Asiento) => {
    const m = new Map<string, number>();
    for (const l of a.lineas) {
      const k = `${l.cuenta}|${lado(l)}`;
      m.set(k, round((m.get(k) ?? 0) + monto(l)));
    }
    return m;
  };
  const sol = agrupar(solucion);
  const jug = agrupar(jugador);
  let cuentasOk = 0;
  let importesOk = 0;
  const faltan: Linea[] = [];
  const importesMal: Linea[] = [];
  for (const [k, m] of sol) {
    const [c, l] = k.split('|');
    if (jug.has(k)) {
      cuentasOk += 1;
      if (Math.abs((jug.get(k) ?? 0) - m) <= tolerancia) importesOk += 1;
      else importesMal.push(l === 'D' ? D(c, m) : H(c, m));
    } else faltan.push(l === 'D' ? D(c, m) : H(c, m));
  }
  const sobran: Linea[] = [];
  for (const [k, m] of jug) {
    if (!sol.has(k)) {
      const [c, l] = k.split('|');
      sobran.push(l === 'D' ? D(c, m) : H(c, m));
    }
  }
  const n = sol.size;
  const cuentas = Math.max(0, (cuentasOk - sobran.length * 0.5) / n);
  const importes = Math.max(0, (importesOk - sobran.length * 0.5) / n);
  return { cuentas, importes, faltan, sobran, importesMal };
}

export const asientoVacio = (): Asiento => ({ lineas: [] });
export const clonar = (a: Asiento): Asiento => ({ lineas: a.lineas.map((l) => ({ ...l })) });
