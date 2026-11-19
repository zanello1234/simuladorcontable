import { describe, expect, it } from 'vitest';
import { mockClient, mockTask } from '../dev/mocks-mg2';
import { CONCEPTOS, evaluarSueldos, generarCasoSueldos, liquidacionCorrecta, opcionesPara, reciboDesde, type Respuestas } from './caso';

const client = mockClient({ empleados: 5 });

function jugar(seed: number, elegir: (ops: ReturnType<typeof opcionesPara>) => ReturnType<typeof opcionesPara>[number]) {
  const caso = generarCasoSueldos(seed, client, mockTask('sueldos', '2027-03'), 1.3);
  const resp: Respuestas[] = caso.empleados.map((e) => {
    const r: Respuestas = {};
    for (const k of CONCEPTOS) r[k] = elegir(opcionesPara(e, k, r, seed));
    return r;
  });
  return { caso, resp };
}

describe('minijuego sueldos', () => {
  it('genera hasta 3 empleados y avisa el resto', () => {
    const caso = generarCasoSueldos(1, client, mockTask('sueldos', '2027-06'), 1);
    expect(caso.empleados).toHaveLength(3);
    expect(caso.restantes).toBe(2);
    expect(caso.esMesSAC).toBe(true);
  });

  it('cálculo correcto: neto = remunerativo − 19% de aportes', () => {
    for (let s = 1; s < 50; s++) {
      const caso = generarCasoSueldos(s, client, mockTask('sueldos', '2027-03'), 1);
      for (const e of caso.empleados) {
        const l = liquidacionCorrecta(e);
        expect(Math.abs(l.totalAportes - l.remunerativo * 0.19)).toBeLessThan(0.05);
        expect(l.neto).toBeCloseTo(l.remunerativo - l.totalAportes, 2);
        if (e.ausencias > 0) expect(l.presentismo).toBe(0);
      }
    }
  });

  it('eligiendo siempre la correcta el score es 1 y el neto coincide', () => {
    for (let s = 1; s < 60; s++) {
      const { caso, resp } = jugar(s, (ops) => ops.find((o) => o.correcta)!);
      caso.empleados.forEach((e, i) => expect(reciboDesde(e, resp[i]).neto).toBeCloseTo(liquidacionCorrecta(e).neto, 2));
      const ev = evaluarSueldos(caso, resp);
      expect(ev.score).toBe(1);
      expect(ev.errores).toHaveLength(0);
    }
  });

  it('cada pregunta tiene exactamente una opción correcta y opciones distintas', () => {
    for (let s = 1; s < 60; s++) {
      jugar(s, (ops) => {
        expect(ops.filter((o) => o.correcta)).toHaveLength(1);
        const montos = ops.filter((o) => o.monto !== null).map((o) => o.monto!.toFixed(2));
        expect(new Set(montos).size).toBe(montos.length);
        return ops.find((o) => o.correcta)!;
      });
    }
  });

  it('eligiendo mal baja el score y explica', () => {
    const { caso, resp } = jugar(7, (ops) => ops.find((o) => !o.correcta) ?? ops[0]);
    const ev = evaluarSueldos(caso, resp);
    expect(ev.score).toBeLessThan(0.3);
    expect(ev.errores.length).toBeGreaterThan(3);
  });
});
