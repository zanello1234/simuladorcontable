import { describe, expect, it } from 'vitest';
import { mockClient, mockTask } from '../dev/mocks-mg2';
import { armarConciliacion, asientosAjuste, evaluarConciliacion, generarCasoConciliacion, itemsAClasificar, jugadaPerfecta, transponer } from './caso';

const client = mockClient();
const caso = (s: number, periodo = '2027-03') => generarCasoConciliacion(s, client, mockTask('balance', periodo), 1.2);

describe('minijuego conciliación bancaria', () => {
  it('la conciliación cierra: banco ± partidas == libros ± ajustes', () => {
    for (let s = 1; s < 200; s++) {
      const c = caso(s);
      const k = armarConciliacion(c);
      expect(k.bancoAjustado).toBeCloseTo(k.librosAjustado, 2);
      expect(k.librosAjustado).toBeCloseTo(c.saldoConciliado, 2);
      expect(c.extracto.length).toBeGreaterThanOrEqual(8);
      expect(c.extracto.length).toBeLessThanOrEqual(14);
    }
  });

  it('periodo anual usa el mes de cierre', () => {
    const c = generarCasoConciliacion(3, mockClient({ cierre: 6 }), mockTask('balance', '2026'), 1);
    expect(c.periodo).toBe('2026-06');
  });

  it('jugada perfecta = score 1', () => {
    for (let s = 1; s < 100; s++) {
      const c = caso(s);
      const ev = evaluarConciliacion(c, jugadaPerfecta(c));
      expect(ev.score).toBeCloseTo(1, 6);
      expect(ev.errores).toHaveLength(0);
      // con las parejas correctas, lo que queda para clasificar es exactamente lo de un solo lado + el error
      const items = itemsAClasificar(c, c.pares);
      expect(items).toHaveLength(Object.keys(c.categoria).length + 1);
    }
  });

  it('error dejado sin emparejar pero clasificado en ambos lados cuenta como clasificado', () => {
    const c = caso(11);
    const p = jugadaPerfecta(c);
    const [eb, el] = c.errorPar;
    const j = { ...p, pares: p.pares.filter(([b]) => b !== eb), clasif: { ...p.clasif, [eb]: 'error_registracion' as const, [el]: 'error_registracion' as const } };
    const ev = evaluarConciliacion(c, j);
    expect(ev.partes.clasif).toBe(1);
    expect(ev.partes.pares).toBeLessThan(1);
  });

  it('sin jugar = score 0 y opciones de saldo distintas', () => {
    const c = caso(5);
    const ev = evaluarConciliacion(c, { pares: [], clasif: {}, saldoId: null });
    expect(ev.score).toBe(0);
    const m = c.opcionesSaldo.map((o) => o.monto.toFixed(2));
    expect(new Set(m).size).toBe(3);
    expect(c.opcionesSaldo.filter((o) => o.correcta)).toHaveLength(1);
  });

  it('asientos balancean', () => {
    for (let s = 1; s < 50; s++) {
      for (const a of asientosAjuste(caso(s))) {
        const d = a.lineas.reduce((x, l) => x + l.debe, 0);
        const h = a.lineas.reduce((x, l) => x + l.haber, 0);
        expect(d).toBeCloseTo(h, 2);
      }
    }
  });

  it('transponer cambia el importe', () => {
    expect(transponer(145320.5)).toBe(154320.5);
    expect(transponer(100000)).not.toBe(100000);
  });
});
