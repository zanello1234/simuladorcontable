import { describe, expect, it } from 'vitest';
import { determinar, evaluarIva, generarCasoIva, respuestasPerfectas, totales } from './casoIva';

const cliente = { nombre: 'Ferretería López', rubro: 'comercio' as const, kind: 'srl' as const, volumen: 150 };

describe('IVA — caso generado', () => {
  it('es determinístico por seed', () => {
    expect(generarCasoIva(42, cliente, '2027-03', 1)).toEqual(generarCasoIva(42, cliente, '2027-03', 1));
  });

  it('respuestas perfectas dan score 1 en muchos seeds y rubros', () => {
    const rubros = ['comercio', 'servicios', 'gastronomia', 'construccion', 'agro', 'industria', 'salud', 'transporte'] as const;
    for (let seed = 1; seed <= 300; seed++) {
      const c = { ...cliente, rubro: rubros[seed % rubros.length], volumen: (seed * 37) % 400 };
      const caso = generarCasoIva(seed, c, '2027-05', 1 + (seed % 5) / 10);
      const r = evaluarIva(caso, respuestasPerfectas(caso));
      expect(r.score).toBe(1);
      expect(r.errores).toEqual([]);
      expect(caso.comprobantes.length).toBeGreaterThanOrEqual(8);
      expect(caso.comprobantes.length).toBeLessThanOrEqual(17);
      expect(caso.opciones.filter((o) => o.correcta)).toHaveLength(1);
      expect(caso.opciones.length).toBeGreaterThanOrEqual(2);
      const labels = new Set(caso.opciones.map((o) => o.label));
      expect(labels.size).toBe(caso.opciones.length);
    }
  });

  it('la solución es consistente con la determinación', () => {
    const caso = generarCasoIva(7, cliente, '2027-02', 1.3);
    const p = respuestasPerfectas(caso);
    const { df, cf } = totales(caso.comprobantes, p.clasif);
    expect(df).toBeCloseTo(caso.solucion.df, 2);
    expect(cf).toBeCloseTo(caso.solucion.cf, 2);
    expect(determinar(df, cf, caso.saldoAnterior, caso.solucion.pagosACuenta)).toEqual(caso.solucion.resultado);
  });

  it('todo "No computa" y sin resultado da score bajo con feedback', () => {
    const caso = generarCasoIva(9, cliente, '2027-02', 1);
    const clasif = Object.fromEntries(caso.comprobantes.map((c) => [c.id, 'no_computa' as const]));
    const r = evaluarIva(caso, { clasif, pagos: {} });
    expect(r.score).toBeLessThan(0.5);
    expect(r.errores.length).toBeGreaterThan(3);
  });

  it('determinar: pagos a cuenta mayores al saldo técnico generan libre disponibilidad', () => {
    expect(determinar(1000, 400, 0, 800)).toEqual({ aPagar: 0, stFavor: 0, sld: 200 });
    expect(determinar(1000, 1200, 0, 50)).toEqual({ aPagar: 0, stFavor: 200, sld: 50 });
    expect(determinar(1000, 400, 100, 100)).toEqual({ aPagar: 400, stFavor: 0, sld: 0 });
  });
});
