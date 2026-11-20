import { describe, expect, it } from 'vitest';
import { capacidad7, cumplimiento, equipoResumen, flujoFondos90, informeMensualCSV, rentabilidadClientes, resumenSemana, riesgoProfesional } from '../engine/analytics';
import { toGameState } from './adapter';
import { parseCSV, mapearCabeceras } from './csv';
import { DATA_VACIA, ESQUEMA, normalizar, type RealData } from './model';

const HOY = '2026-11-20';

function muestra(): RealData {
  return {
    ...structuredClone(DATA_VACIA),
    config: { cajaHoy: 2_000_000, cajaHoyFecha: '2026-11-01', diasCobro: 10, inflacionMensualEstimada: 0.03, nombreEstudio: 'Test', titular: 'Cra. Test' },
    equipo: [
      { id: 'mz', nombre: 'Martín', rol: 'titular', costoMensual: 0, horasSemanales: 40, activo: true },
      { id: 'ju', nombre: 'Juli', rol: 'junior', costoMensual: 1_500_000, horasSemanales: 40, activo: true },
    ],
    clientes: [
      { id: 'c1', razonSocial: 'Ferretería López SRL', cuit: '30-12345678-9', tipo: 'srl', rubro: 'comercio', jurisdiccion: 'local', empleados: 4, honorarioMensual: 400_000, honorarioActualizadoEl: '2026-05-01', responsable: 'ju', estado: 'activo', riesgo: 'medio', notas: '' },
      { id: 'c2', razonSocial: 'Ana Pérez', cuit: '27-11111111-3', tipo: 'monotributista', rubro: 'servicios', jurisdiccion: 'local', empleados: 0, honorarioMensual: 80_000, honorarioActualizadoEl: '2026-11-01', responsable: 'mz', estado: 'activo', riesgo: 'bajo', notas: '' },
      { id: 'c3', razonSocial: 'Baja SA', cuit: '', tipo: 'sa', rubro: '', jurisdiccion: 'convenio', empleados: 10, honorarioMensual: 900_000, honorarioActualizadoEl: '2026-01-01', responsable: '', estado: 'baja', riesgo: 'alto', notas: '' },
    ],
    vencimientos: [
      { id: 'v1', clienteId: 'c1', impuesto: 'IVA', periodo: '2026-10', vence: '2026-11-19', estado: 'presentada', presentadaEl: '2026-11-18', responsable: 'ju', horasEstimadas: 3, notas: '' },
      { id: 'v2', clienteId: 'c1', impuesto: 'Sueldos', periodo: '2026-11', vence: '2026-12-03', estado: 'pendiente', presentadaEl: '', responsable: 'ju', horasEstimadas: 2, notas: '' },
      { id: 'v3', clienteId: 'c2', impuesto: 'Monotributo', periodo: '2026-11', vence: '2026-11-10', estado: 'pendiente', presentadaEl: '', responsable: 'mz', horasEstimadas: 0.5, notas: '' },
    ],
    facturas: [
      { id: 'f1', clienteId: 'c1', numero: 'A 0001-00000100', emitida: '2026-11-03', vence: '2026-11-13', monto: 400_000, concepto: 'Honorarios 11/2026', estado: 'pendiente', cobradaEl: '' },
      { id: 'f2', clienteId: 'c2', numero: 'A 0001-00000101', emitida: '2026-11-03', vence: '2026-11-13', monto: 80_000, concepto: 'Honorarios 11/2026', estado: 'cobrada', cobradaEl: '2026-11-10' },
    ],
    cobros: [{ id: 'k1', facturaId: 'f2', clienteId: 'c2', fecha: '2026-11-10', monto: 80_000, medio: 'Transferencia' }],
    gastos: [
      { id: 'g1', fecha: '2026-11-10', concepto: 'Alquiler', categoria: 'alquiler', monto: 500_000, recurrente: true, diaDelMes: 10 },
      { id: 'g2', fecha: '2026-11-05', concepto: 'Internet', categoria: 'servicios', monto: 40_000, recurrente: true, diaDelMes: 5 },
    ],
    horas: [
      { id: 'h1', fecha: '2026-11-04', clienteId: 'c1', colaborador: 'ju', horas: 6, tarea: 'IVA' },
      { id: 'h2', fecha: '2026-10-04', clienteId: 'c1', colaborador: 'ju', horas: 20, tarea: 'Varios' },
    ],
    objetivos: [{ id: 'o1', tipo: 'clientes', meta: 5, creado: '2026-11-01' }],
  };
}

describe('adaptador real → GameState', () => {
  it('con datos vacíos nada explota', () => {
    const g = toGameState(structuredClone(DATA_VACIA), HOY);
    expect(g.workers.length).toBe(1);
    expect(() => [cumplimiento(g), capacidad7(g), rentabilidadClientes(g), flujoFondos90(g), riesgoProfesional(g), equipoResumen(g), resumenSemana(g), informeMensualCSV(g)]).not.toThrow();
    expect(flujoFondos90(g).semanas.length).toBe(13);
  });
  it('con datos de muestra los indicadores son coherentes', () => {
    const g = toGameState(muestra(), HOY);
    expect(g.workers.map((w) => w.id).sort()).toEqual(['ju', 'player']);
    // caja = 2M + cobro 80k − alquiler 500k − internet 40k (posteriores al 1/11)
    expect(g.estudio.caja).toBe(2_000_000 + 80_000 - 500_000 - 40_000);
    const rent = rentabilidadClientes(g);
    expect(rent.length).toBe(2); // el de baja no cuenta
    const c1 = rent.find((r) => r.id === 'c1')!;
    expect(c1.atraso).toBeGreaterThan(0.15); // 6 meses al 3%
    expect(c1.horasPromedio).toBeGreaterThan(0);
    const cum = cumplimiento(g);
    expect(cum.enTermino).toBe(1);
    expect(cum.vencidasSinPresentar).toBe(1); // monotributo vencido el 10/11
    const flujo = flujoFondos90(g);
    expect(flujo.movimientos.some((m) => m.concepto.includes('Alquiler'))).toBe(true);
    expect(flujo.movimientos.some((m) => m.concepto.includes('Sueldos y cargas del equipo'))).toBe(true);
    expect(flujo.movimientos.some((m) => m.monto === 400_000)).toBe(true); // factura pendiente
    expect(g.estudio.real?.costosFijosMensuales).toBe(540_000);
    expect(g.progreso.mejorRacha).toBe(1);
    expect(informeMensualCSV(g)).toContain('Ferretería');
  });
});

describe('CSV', () => {
  it('parsea con ; y decimales con coma, y mapea cabeceras por etiqueta', () => {
    const p = parseCSV('Razón social;CUIT;Abono mensual;Tipo\n"López, SRL";30-1;"1.250.000,50";SRL\nAna;27-1;80000;Monotributista');
    expect(p.rows.length).toBe(2);
    const map = mapearCabeceras(p.headers, ESQUEMA.clientes);
    expect(map['Razón social']).toBe('razonSocial');
    expect(map['Abono mensual']).toBe('honorarioMensual');
    const raw: Record<string, unknown> = {};
    for (const [h, k] of Object.entries(map)) raw[k] = p.rows[0][h];
    const fila = normalizar('clientes', raw, HOY);
    expect(fila.honorarioMensual).toBe(1_250_000.5);
    expect(fila.tipo).toBe('srl');
    expect(fila.razonSocial).toBe('López, SRL');
  });
});
