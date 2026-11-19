import { describe, expect, it } from 'vitest';
import { EXCLUSION, categoriaPara, evaluarRecat, generarCasoRecat, respuestasPerfectasRecat, tablaEscalada } from './casoRecat';

describe('Recategorización — caso generado', () => {
  it('categoriaPara toma la primera categoría cuyo tope no se supera', () => {
    const t = tablaEscalada(1);
    expect(categoriaPara(t, 'superficie', 30)).toBe(0);
    expect(categoriaPara(t, 'superficie', 31)).toBe(1);
    expect(categoriaPara(t, 'superficie', 160)).toBe(6);
    expect(categoriaPara(t, 'superficie', 201)).toBe(EXCLUSION);
    expect(categoriaPara(t, 'ingresos', t[10].ingresos + 1)).toBe(EXCLUSION);
  });

  it('respuestas perfectas dan 1; final = máximo de parámetros', () => {
    let exclusiones = 0;
    let porParametro = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const caso = generarCasoRecat(seed, { rubro: seed % 2 ? 'comercio' : 'servicios', categoria: 'C' }, '2027-S1', 1 + (seed % 7) / 10);
      const r = evaluarRecat(caso, respuestasPerfectasRecat(caso));
      expect(r.score).toBe(1);
      expect(caso.categoriaFinal).toBe(Math.max(...caso.parametros.map((p) => p.categoria)));
      expect(caso.opcionesIngresos.filter((o) => o.correcta)).toHaveLength(1);
      expect(caso.opcionesIngresos.length).toBeGreaterThanOrEqual(3);
      const neto = caso.meses.reduce((a, m) => a + m.facturado - m.nc, 0);
      expect(neto).toBeCloseTo(caso.ingresos, 1);
      expect(caso.meses).toHaveLength(12);
      if (caso.categoriaFinal === EXCLUSION) exclusiones++;
      else if (caso.determinante !== 'ingresos') porParametro++;
    }
    expect(exclusiones).toBeGreaterThan(15);
    expect(porParametro).toBeGreaterThan(100);
  });

  it('S1 usa enero–diciembre del año anterior; S2 julio–junio', () => {
    const a = generarCasoRecat(3, { rubro: 'comercio' }, '2027-S1', 1);
    expect(a.meses[0].mes).toBe('2026-01');
    expect(a.meses[11].mes).toBe('2026-12');
    const b = generarCasoRecat(3, { rubro: 'comercio' }, '2027-S2', 1);
    expect(b.meses[0].mes).toBe('2026-07');
    expect(b.meses[11].mes).toBe('2027-06');
  });

  it('respuestas vacías dan 0 y explican', () => {
    const caso = generarCasoRecat(11, { rubro: 'servicios' }, '2027-S2', 1);
    const r = evaluarRecat(caso, { params: {} });
    expect(r.score).toBe(0);
    expect(r.errores.length).toBe(6);
  });
});
