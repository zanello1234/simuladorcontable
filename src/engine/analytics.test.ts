import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import * as A from './actions';
import { capacidad7, cumplimiento, equipoResumen, flujoFondos90, informeMensualCSV, rentabilidadClientes, resumenSemana, riesgoProfesional } from './analytics';
import { monthKey } from './calendar';
import { newGame } from './newGame';
import { tick } from './simulation';
import type { GameState } from './types';

function jugar(meses: number): GameState {
  let s = newGame({ nombreEstudio: 'Test', titular: 'Tester', especialidad: 'impuestos', dificultad: 'normal', seed: 777 });
  const fin = monthKey(s.date);
  const [y, m] = fin.split('-').map(Number);
  const hasta = `${y + Math.floor((m - 1 + meses) / 12)}-${String(((m - 1 + meses) % 12) + 1).padStart(2, '0')}-01`;
  let guard = 0;
  while (s.date < hasta && !s.gameOver && guard++ < 20000) {
    s = produce(s, (d) => {
      while (d.events.length) A.elegirOpcion(d, d.events[0].id, (d.events[0].opciones.find((o) => !o.disabled) ?? d.events[0].opciones[0]).id);
      if (d.dialogo) {
        if (d.dialogo.resumen !== undefined) A.cerrarConversacion(d);
        else A.cerrarConversacion(d);
      }
      if (d.estudio.facturasEmitidasMes !== monthKey(d.date)) A.facturarMes(d);
      for (const p of [...d.prospects]) A.enviarPropuesta(d, p.id, p.honorarioReferencia);
      for (const t of d.tasks) if (t.estado === 'pendiente' && t.requiereTitular && A.minijuegoDisponible(d, t.id).ok) A.completarMinijuego(d, t.id, 0.9, 2);
      tick(d);
    });
  }
  return s;
}

describe('analytics', () => {
  const s0 = newGame({ nombreEstudio: 'Test', titular: 'Tester', especialidad: 'impuestos', dificultad: 'normal', seed: 1 });
  const s3 = jugar(3);

  it('cumplimiento arranca en 100% y luego cuenta presentaciones', () => {
    const c0 = cumplimiento(s0);
    expect(c0.pct).toBe(1);
    const c3 = cumplimiento(s3);
    expect(c3.enTermino + c3.tarde + c3.vencidasSinPresentar).toBeGreaterThanOrEqual(0);
    expect(c3.pct).toBeGreaterThanOrEqual(0);
    expect(c3.pct).toBeLessThanOrEqual(1);
    expect(['ok', 'warn', 'bad']).toContain(c3.semaforo);
  });

  it('capacidad7 suma horas por área y capacidad por persona', () => {
    const c = capacidad7(s3);
    expect(c.capacidad).toBeGreaterThan(0);
    expect(c.horasTotal).toBeCloseTo(c.horasPorArea.impuestos + c.horasPorArea.sueldos + c.horasPorArea.contabilidad, 0);
    expect(c.personas.length).toBe(s3.workers.length);
    for (const p of c.personas) expect(p.ratio).toBeGreaterThanOrEqual(0);
  });

  it('rentabilidad por cliente usa horas reales y etiqueta', () => {
    const r = rentabilidadClientes(s3);
    expect(r.length).toBe(s3.clients.filter((c) => c.activo && !c.propio).length);
    for (const x of r) {
      expect(x.porHora).toBeGreaterThan(0);
      expect(x.horasPromedio).toBeGreaterThan(0);
      expect(Number.isFinite(x.margen)).toBe(true);
      if (x.margen < 0) expect(x.etiquetas).toContain('pierde plata');
    }
    expect(Object.values(s3.horasCliente).some((h) => h.total > 0)).toBe(true);
  });

  it('flujo de fondos 90 días: 13 semanas, saldo encadenado y mínimo coherente', () => {
    const f = flujoFondos90(s3);
    expect(f.semanas.length).toBe(13);
    let saldo = s3.estudio.caja;
    for (const w of f.semanas) {
      saldo += w.ingresos - w.egresos;
      expect(w.saldo).toBe(Math.round(saldo));
      expect(w.ingresos).toBeGreaterThanOrEqual(0);
      expect(w.egresos).toBeGreaterThanOrEqual(0);
    }
    expect(f.minimo.saldo).toBeLessThanOrEqual(s3.estudio.caja);
    expect(f.alerta).toBe(f.minimo.saldo < 0);
    expect(f.totalEgresos).toBeGreaterThan(0);
  });

  it('riesgo profesional entre 0 y 100 con semáforo', () => {
    const r = riesgoProfesional(s3);
    expect(r.indice).toBeGreaterThanOrEqual(0);
    expect(r.indice).toBeLessThanOrEqual(100);
    expect(r.topClientes.length).toBeLessThanOrEqual(5);
  });

  it('equipo y semana', () => {
    const e = equipoResumen(s3);
    expect(e.personas[0].id).toBe('player');
    expect(e.sueldosSobreIngresos).toBeGreaterThanOrEqual(0);
    const w = resumenSemana(s3);
    expect(w.hasta >= w.desde).toBe(true);
    expect(w.capacidad).toBeGreaterThan(0);
  });

  it('informe CSV con secciones y decimales con coma', () => {
    const csv = informeMensualCSV(s3);
    for (const sec of ['RESUMEN', 'CUMPLIMIENTO', 'CLIENTES', 'FLUJO DE FONDOS 90 DÍAS', 'EQUIPO', 'RIESGO']) expect(csv).toContain(sec);
    expect(csv.split('\n').length).toBeGreaterThan(20);
    expect(csv).toMatch(/\d,\d/);
  });
});
