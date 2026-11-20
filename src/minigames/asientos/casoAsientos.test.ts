import { describe, expect, it } from 'vitest';
import { balancea } from './asiento';
import { evaluarAsientos, generarCasoAsientos, respuestasPerfectas, sumasYSaldos } from './casoAsientos';
import { buscarCuentas, cuenta, PLAN } from './planCuentas';

const client = { nombre: 'Ferretería López SRL', rubro: 'comercio' as const, kind: 'srl' as const, empleados: 3, volumen: 160 };

describe('Asientos del mes', () => {
  it('el plan de cuentas tiene códigos únicos y el buscador funciona', () => {
    expect(new Set(PLAN.map((c) => c.codigo)).size).toBe(PLAN.length);
    expect(buscarCuentas('iva').map((c) => c.codigo)).toContain('1.1.04.01');
    expect(buscarCuentas('2.1.02')[0].codigo.startsWith('2.1.02')).toBe(true);
    expect(buscarCuentas('', ['1.1.01.01'])[0].codigo).toBe('1.1.01.01');
  });

  it('300 seeds: todo asiento correcto balancea, el score perfecto es 1 y hay 8–12 operaciones', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const caso = generarCasoAsientos(seed, { ...client, empleados: seed % 3 }, `2027-${String((seed % 12) + 1).padStart(2, '0')}`, 1 + (seed % 5) * 0.2);
      expect(caso.operaciones.length).toBeGreaterThanOrEqual(8);
      expect(caso.operaciones.length).toBeLessThanOrEqual(12);
      for (const o of caso.operaciones) {
        if (o.noRegistrar) expect(o.solucion.lineas.length).toBe(0);
        else expect(balancea(o.solucion), `${seed} ${o.id}`).toBe(true);
        expect(balancea(o.propuesta), `propuesta ${seed} ${o.id}`).toBe(true);
        for (const l of [...o.solucion.lineas, ...o.propuesta.lineas]) expect(() => cuenta(l.cuenta)).not.toThrow();
        for (const c of o.sugeridas) expect(() => cuenta(c)).not.toThrow();
      }
      const r = evaluarAsientos(caso, respuestasPerfectas(caso));
      expect(r.score, `seed ${seed}: ${r.errores.join(' | ')}`).toBe(1);
      // la propuesta del sistema (con error) nunca es perfecta
      const malas = Object.fromEntries(caso.operaciones.map((o) => [o.id, o.propuesta]));
      expect(evaluarAsientos(caso, malas).score).toBeLessThan(0.8);
    }
  });

  it('sumas y saldos del libro diario balancean', () => {
    const caso = generarCasoAsientos(7, client, '2027-05', 1);
    const ss = sumasYSaldos(respuestasPerfectas(caso));
    const d = ss.reduce((a, r) => a + r.debe, 0);
    const h = ss.reduce((a, r) => a + r.haber, 0);
    expect(Math.abs(d - h)).toBeLessThan(0.01);
  });
});
