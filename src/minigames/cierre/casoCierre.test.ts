import { describe, expect, it } from 'vitest';
import { balancea } from '../asientos/asiento';
import { cuenta, RUBRO_SECCION } from '../asientos/planCuentas';
import { aplicarAjustes, estadosDesde, evaluarCierre, generarCasoCierre, opcionesReserva, opcionesResultado, reservaLegal, resultadoDe, respuestasPerfectasCierre } from './casoCierre';

const client = { nombre: 'Metalúrgica Sur SA', rubro: 'industria' as const, kind: 'sa' as const, empleados: 5, volumen: 300, cierre: 12 };

const sumaSeccion = (saldos: { cuenta: string; saldo: number }[], sec: 'activo' | 'pasivo' | 'pn' | 'resultado') => saldos.filter((s) => RUBRO_SECCION[cuenta(s.cuenta).rubro] === sec).reduce((a, s) => a + s.saldo, 0);

describe('Cierre de ejercicio', () => {
  it('300 seeds: pre-cierre y post-cierre cierran, A = P + PN, score perfecto 1, opciones únicas', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const caso = generarCasoCierre(seed, { ...client, cierre: [12, 6, 3][seed % 3] }, '2027', 1 + (seed % 4) * 0.25);
      expect(caso.ajustes.length).toBeGreaterThanOrEqual(6);
      expect(caso.ajustes.length).toBeLessThanOrEqual(9);
      // pre-cierre: suma de saldos (deudores +, acreedores −) = 0
      expect(Math.abs(caso.preCierre.reduce((a, s) => a + s.saldo, 0))).toBeLessThan(0.01);
      for (const a of caso.ajustes) {
        if (a.solucion.lineas.length) expect(balancea(a.solucion), `${seed} ${a.id}`).toBe(true);
        expect(a.opciones.length).toBe(3);
        expect(a.opciones[a.correcta]).toBe(a.solucion);
        for (const o of a.opciones) if (o.lineas.length) expect(balancea(o), `opción ${seed} ${a.id}`).toBe(true);
      }
      const perf = respuestasPerfectasCierre(caso);
      const saldos = aplicarAjustes(caso.preCierre, perf.ajustes);
      expect(Math.abs(saldos.reduce((a, s) => a + s.saldo, 0)), `post ${seed}`).toBeLessThan(0.01);
      // A = P + PN + resultado
      const A = sumaSeccion(saldos, 'activo');
      const P = -sumaSeccion(saldos, 'pasivo');
      const PN = -sumaSeccion(saldos, 'pn');
      const R = resultadoDe(saldos);
      expect(Math.abs(A - (P + PN + R)), `igualdad ${seed}`).toBeLessThan(0.01);
      const est = estadosDesde(saldos, perf.clasif);
      expect(Math.abs(est.totalActivo - (est.totalPasivo + est.totalPN))).toBeLessThan(0.01);
      expect(Math.abs(est.er.neto - R)).toBeLessThan(0.01);
      const r = evaluarCierre(caso, perf);
      expect(r.score, `seed ${seed}: ${r.errores.join(' | ')}`).toBe(1);
      const or = opcionesResultado(R, saldos);
      const orl = opcionesReserva(R, saldos);
      expect(or.filter((o) => o.correcta).length).toBe(1);
      expect(orl.filter((o) => o.correcta).length).toBe(1);
      expect(new Set(or.map((o) => o.monto)).size).toBe(3);
      expect(new Set(orl.map((o) => o.monto)).size).toBe(3);
      // elegir siempre la opción incorrecta baja el score
      const malas = Object.fromEntries(caso.ajustes.map((a) => [a.id, a.opciones[(a.correcta + 1) % 3]]));
      expect(evaluarCierre(caso, { ...perf, ajustes: malas }).score).toBeLessThan(0.8);
    }
  });

  it('reserva legal respeta el tope del 20% del capital', () => {
    const saldos = [{ cuenta: '3.1.01.01', saldo: -1_000_000 }, { cuenta: '3.2.01.01', saldo: -190_000 }];
    expect(reservaLegal(1_000_000, saldos)).toBe(10_000);
    expect(reservaLegal(100_000, saldos)).toBe(5_000);
    expect(reservaLegal(-5, saldos)).toBe(0);
  });
});
