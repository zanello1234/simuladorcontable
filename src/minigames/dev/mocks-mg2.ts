// Mocks de cliente y tarea para previsualizar/testear minijuegos.
import type { Client, ObligationKind, Task } from '../../engine/types';

export function mockClient(over: Partial<Client> = {}): Client {
  return {
    id: 'c1',
    nombre: 'Ferretería El Ceibo S.R.L.',
    cuit: '30-71234567-8',
    kind: 'srl',
    rubro: 'comercio',
    jurisdiccion: 'local',
    empleados: 4,
    volumen: 140,
    ordenDocumental: 0.6,
    pagador: 0.8,
    honorario: 420_000,
    honorarioActualizadoEl: '2027-01-01',
    honorarioIndice: 1,
    satisfaccion: 70,
    desde: '2026-03-01',
    riesgoFiscal: 0.2,
    erroresLatentes: [],
    cierre: 12,
    avatar: { piel: '#e0b48c', pelo: '#3b2a1e', peinado: 'corto', ropa: '#2f6fb5', anteojos: false, barba: true },
    activo: true,
    ...over,
  };
}

export function mockTask(kind: ObligationKind, periodo: string, over: Partial<Task> = {}): Task {
  return {
    id: `t-${kind}-${periodo}`,
    clientId: 'c1',
    kind,
    periodo,
    titulo: `${kind} ${periodo}`,
    vence: '2027-04-10',
    generada: '2027-04-01',
    docsLlegan: '2027-04-02',
    docsRecibidos: true,
    reclamos: 0,
    steps: [],
    stepIndex: 2,
    estado: 'pendiente',
    errores: 0,
    corregidos: 0,
    saltearRevision: false,
    vencida: false,
    ...over,
  };
}
