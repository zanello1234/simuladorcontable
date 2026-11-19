import { describe, expect, it } from 'vitest';
import { escala, evaluar, generarCasoGanancias, impuestoEscala, liquidar, opcionesImpuesto, opcionesSaldo, respuestasPerfectas } from './casoGanancias';

const client = { nombre: 'Jorge Pérez (Almacén Ricci)', rubro: 'comercio' as const, kind: 'ri_persona' as const, empleados: 2 };

describe('Ganancias PH', () => {
  it('la escala es continua y progresiva', () => {
    const t = escala(1);
    for (let i = 1; i < t.length; i++) {
      expect(t[i].desde).toBe(t[i - 1].hasta);
      expect(t[i].alicuota).toBeGreaterThan(t[i - 1].alicuota);
      // impuesto en el límite calculado desde ambos tramos coincide
      const lim = t[i].desde;
      expect(Math.abs(t[i - 1].fijo + (lim - t[i - 1].desde) * t[i - 1].alicuota - t[i].fijo)).toBeLessThan(0.01);
    }
    expect(impuestoEscala(0, t)).toBe(0);
    expect(impuestoEscala(1_000_000, t)).toBe(50_000);
  });

  it('con las respuestas correctas el score es 1 y la liquidación cierra (300 seeds)', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const caso = generarCasoGanancias(seed, client, '2026', 1 + (seed % 7) * 0.1);
      const perf = respuestasPerfectas(caso);
      const r = evaluar(caso, perf);
      expect(r.score, `seed ${seed}: ${r.errores.join(' | ')}`).toBe(1);
      const liq = liquidar(caso, perf);
      expect(liq.gnsi).toBeGreaterThanOrEqual(0);
      expect(Math.abs(liq.impDeterminado - liq.pagos - liq.saldo)).toBeLessThan(0.01);
      expect(Math.abs(liq.impDeterminado - (impuestoEscala(liq.gnsi, caso.tramos) + liq.impCedular))).toBeLessThan(0.01);
      expect(liq.dedGenerales).toBeLessThanOrEqual(liq.ganNeta);
      // una única opción correcta y 3 opciones distintas
      const oi = opcionesImpuesto(liq.gnsi, liq.impCedular, caso.tramos);
      const os = opcionesSaldo(caso);
      expect(oi.filter((o) => o.correcta).length).toBe(1);
      expect(os.filter((o) => o.correcta).length).toBe(1);
      expect(new Set(oi.map((o) => o.monto)).size).toBe(3);
      expect(new Set(os.map((o) => o.monto)).size).toBe(3);
    }
  });

  it('jugar mal baja el score y explica los errores', () => {
    const caso = generarCasoGanancias(7, client, '2026', 1);
    const perf = respuestasPerfectas(caso);
    const mal = { ...perf, rentas: Object.fromEntries(caso.rentas.map((r) => [r.id, 'c3' as const])), deducciones: Object.fromEntries(caso.deducciones.map((d) => [d.id, true])) };
    const r = evaluar(caso, mal);
    expect(r.score).toBeLessThan(0.8);
    expect(r.errores.length).toBeGreaterThan(0);
  });

  it('los topes de deducciones generales se aplican', () => {
    const caso = generarCasoGanancias(11, client, '2026', 1);
    const perf = respuestasPerfectas(caso);
    const liq = liquidar(caso, perf);
    for (const d of caso.deducciones) {
      const c = liq.detalleDG.find((x) => x.id === d.id);
      if (!d.deducible) expect(c).toBeUndefined();
      else {
        expect(c).toBeDefined();
        if (d.tope === 'pct5') expect(c!.computado).toBeLessThanOrEqual(liq.ganNeta * 0.05 + 0.01);
        if (d.tope === 'gni' || d.tope === 'alq40') expect(c!.computado).toBeLessThanOrEqual(caso.param.gni);
        if (d.tope === 'fijo') expect(c!.computado).toBeLessThanOrEqual(d.topeMonto!);
      }
    }
  });
});
