// Verifica el grafo de cada diálogo: todos los nodos existen, todas las ramas llegan a un final sin excepciones.
import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { newGame } from '../engine/newGame';
import { makeRng } from '../engine/rng';
import type { GameState } from '../engine/types';
import { avanzar, DIALOGOS, elegirDialogo, iniciarDialogo, opcionesDe } from './dialogs';
import type { DialogState } from './types';

const base = newGame({ nombreEstudio: 'T', titular: 'Cr. Test', especialidad: 'impuestos', dificultad: 'normal', seed: 1 });

function explorar(g: GameState, st: DialogState, seed: number, finales: Set<string>, prof = 0): void {
  expect(prof).toBeLessThan(30);
  if (st.resumen !== undefined) {
    finales.add(st.nodoId);
    return;
  }
  const opts = opcionesDe(st, g, makeRng(seed));
  expect(opts.length, `${st.defId}/${st.nodoId} sin opciones ni final`).toBeGreaterThan(0);
  for (const { o } of opts) {
    // probar también la rama "requiere" forzando que la condición se cumpla cuando depende de herramientas
    for (const s2 of [seed, seed + 1, seed + 2]) {
      let next = st;
      const g2 = produce(g, (d) => {
        if (o.requiere) d.tools.push('portal_clientes');
        next = avanzar(st, d, makeRng(s2), o.id);
      });
      if (next === st || next.historial.length === st.historial.length) continue; // opción deshabilitada
      explorar(g2, next, s2 * 7 + 1, finales, prof + 1);
    }
  }
}

describe('diálogos', () => {
  for (const def of DIALOGOS) {
    it(`${def.id}: todas las ramas terminan y los nodos existen`, () => {
      // nodos referenciados estáticamente
      for (const [id, n] of Object.entries(def.nodos)) {
        if (typeof n.siguiente === 'string') expect(def.nodos[n.siguiente], `${def.id}/${id} → ${n.siguiente}`).toBeDefined();
        for (const o of n.opciones ?? []) if (typeof o.siguiente === 'string') expect(def.nodos[o.siguiente], `${def.id}/${id}/${o.id} → ${o.siguiente}`).toBeDefined();
        if (!n.fin && !n.opciones?.length) expect(n.siguiente, `${def.id}/${id} sin salida`).toBeDefined();
      }
      const finales = new Set<string>();
      for (const c of base.clients.filter((x) => !x.propio)) {
        for (const seed of [1, 2, 3]) {
          const g0 = produce(base, (d) => {
            const cc = d.clients.find((x) => x.id === c.id)!;
            cc.satisfaccion = seed === 1 ? 30 : seed === 2 ? 60 : 85;
            cc.ordenDocumental = seed === 1 ? 0.2 : 0.7;
            if (seed === 3) cc.erroresLatentes.push({ taskId: 'x', kind: 'iva', periodo: '2027-01', gravedad: 2, desde: d.date });
            d.estudio.reputacion = seed === 1 ? 20 : 70;
          });
          const cl = g0.clients.find((x) => x.id === c.id)!;
          const r = makeRng(seed);
          const params = def.params ? def.params(g0, cl, r) : {};
          let st = iniciarDialogo(def, cl, params);
          const g1 = produce(g0, (d) => void (st = avanzar(st, d, r)));
          explorar(g1, st, seed * 13, finales);
        }
      }
      expect(finales.size).toBeGreaterThan(0);
    });
  }
  it('elegirDialogo devuelve algo aplicable', () => {
    const r = elegirDialogo(base, makeRng(5));
    expect(r).not.toBeNull();
    expect(r!.def.aplica(base, r!.c)).toBe(true);
  });
  it('los efectos cambian el estado (consecuencias reales)', () => {
    const def = DIALOGOS.find((d) => d.id === 'honorarios')!;
    const c = base.clients.find((x) => !x.propio)!;
    let st = iniciarDialogo(def, c, {});
    const g1 = produce(base, (d) => void (st = avanzar(st, d, makeRng(1))));
    const g2 = produce(g1, (d) => void (st = avanzar(st, d, makeRng(1), 'bajar')));
    expect(g2.clients.find((x) => x.id === c.id)!.honorario).toBeLessThan(c.honorario);
    expect(st.resumen).toBeDefined();
  });
});
