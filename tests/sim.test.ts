// Simulación headless: juega 18 meses con un "piloto automático" razonable y verifica que el
// motor no explote y que la economía sea jugable.
import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import * as A from '../src/engine/actions';
import { newGame } from '../src/engine/newGame';
import { tick } from '../src/engine/simulation';
import type { GameState } from '../src/engine/types';
import { firstBusinessDayOfMonth, monthKey } from '../src/engine/calendar';
import { clientesActivos } from '../src/engine/core';
import { opcionesDe } from '../src/dialog/dialogs';
import { makeRng } from '../src/engine/rng';

function piloto(s: GameState, opts: { contratar: boolean; ia: boolean }): GameState {
  return produce(s, (d) => {
    // eventos: primera opción habilitada
    while (d.events.length) {
      const ev = d.events[0];
      const op = ev.opciones.find((o) => !o.disabled) ?? ev.opciones[0];
      A.elegirOpcion(d, ev.id, op.id);
    }
    if (d.estudio.facturasEmitidasMes !== monthKey(d.date)) A.facturarMes(d);
    let guard = 0;
    while (d.dialogo && guard++ < 20) {
      if (d.dialogo.resumen !== undefined) A.cerrarConversacion(d);
      else {
        const ops = opcionesDe(d.dialogo, d, makeRng(d.rngState)).filter((o) => o.habilitada);
        if (!ops.length) break;
        A.responderConversacion(d, ops[0].o.id);
      }
    }
    // el piloto "juega" las tareas que exigen al titular (con un puntaje de jugador decente)
    for (const t of d.tasks) if (t.estado === 'pendiente' && t.requiereTitular && A.minijuegoDisponible(d, t.id).ok) A.completarMinijuego(d, t.id, 0.9, 2);
    for (const p of [...d.prospects]) A.enviarPropuesta(d, p.id, p.honorarioReferencia);
    if (opts.contratar) {
      const carga = d.tasks.filter((t) => t.estado === 'pendiente').length;
      if (carga > d.workers.length * 9 && d.estudio.caja > 4_000_000 * d.inflacion.indice) {
        if (d.workers.length >= [2, 4, 8, 14][d.estudio.oficina] && d.estudio.oficina < 3) A.mudarOficina(d, d.estudio.oficina + 1);
        const cand = d.candidates.find((c) => c.role === 'junior' || c.role === 'semisenior' || c.role === 'administrativo');
        if (cand) A.contratar(d, cand.id);
      }
    }
    if (opts.ia && d.estudio.caja > 2_000_000) {
      for (const id of ['bot_arca', 'ia_carga', 'factura_auto', 'tablero_vencimientos', 'backup_nube'] as const) A.comprarHerramienta(d, id);
    }
    // aumento trimestral de abonos
    if (d.date === firstBusinessDayOfMonth(monthKey(d.date)) && ['2027-06', '2027-09', '2027-12', '2028-03', '2028-06'].includes(monthKey(d.date)) && d.hour === 9) A.actualizarHonorarios(d, 0.06);
    tick(d);
  });
}

describe('simulación de 18 meses', () => {
  for (const cfg of [
    { nombre: 'solo', contratar: false, ia: false, dif: 'normal' as const },
    { nombre: 'crece', contratar: true, ia: true, dif: 'normal' as const },
    { nombre: 'argentina', contratar: true, ia: true, dif: 'argentina' as const },
  ]) {
    it(`estrategia ${cfg.nombre}`, () => {
      let s = newGame({ nombreEstudio: 'Test', titular: 'Tester', especialidad: 'impuestos', dificultad: cfg.dif, seed: 12345 });
      let ticks = 0;
      while (s.date < '2028-09-01' && !s.gameOver && ticks < 60000) {
        s = piloto(s, cfg);
        ticks++;
      }
      const resumen = s.monthly.map((m) => `${m.mes} caja ${(m.caja / 1e6).toFixed(1)}M res ${(m.resultado / 1e6).toFixed(2)}M cli ${m.clientes} rep ${m.reputacion.toFixed(0)} ok ${m.presentadasATiempo} tarde ${m.presentadasTarde}`);
      console.log(`\n=== ${cfg.nombre} ===\n` + resumen.join('\n'));
      console.log('workers', s.workers.length, 'tools', s.tools.join(','), 'nivel', s.estudio.nivel, 'gameOver', s.gameOver?.motivo, 'stats', JSON.stringify(s.stats));
      console.log('pendientes', s.tasks.filter((t) => t.estado === 'pendiente').length, 'clientes', clientesActivos(s).length, 'indice', s.inflacion.indice.toFixed(2));
      expect(s.monthly.length).toBeGreaterThan(cfg.dif === "argentina" ? 2 : 5);
      expect(Number.isFinite(s.estudio.caja)).toBe(true);
    }, 120_000);
  }
});
