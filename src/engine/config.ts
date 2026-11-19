// =============================================================================
// PARÁMETROS DEL JUEGO — un solo archivo para ajustar economía y normativa.
//
// IMPORTANTE: los importes son VALORES DE JUEGO expresados en "pesos de enero del año
// inicial" y se indexan con la inflación simulada. Son órdenes de magnitud verosímiles,
// no datos oficiales. Lo marcado [A CONFIRMAR] conviene contrastarlo con la normativa
// vigente si se quiere máximo realismo.
// =============================================================================
import type { Area, ClientKind, Dificultad, Role, StepKind } from './types';

export const ANIO_INICIAL = 2027;
export const SAVE_VERSION = 1;

export const HORA_INICIO = 9;
export const HORA_FIN = 18;
export const HORA_FIN_EXTRA = 20;

/** milisegundos reales por hora de juego según velocidad */
export const MS_POR_HORA: Record<1 | 2 | 3, number> = { 1: 1800, 2: 800, 3: 300 };

export const DIFICULTAD: Record<Dificultad, { label: string; caja: number; inflacion: number; eventos: number; descripcion: string }> = {
  facil: { label: 'Tranqui', caja: 6_000_000, inflacion: 0.015, eventos: 0.7, descripcion: 'Más caja inicial, inflación baja y menos sobresaltos.' },
  normal: { label: 'Normal', caja: 3_000_000, inflacion: 0.022, eventos: 1, descripcion: 'La experiencia de un estudio PyME típico.' },
  argentina: { label: 'Modo Argentina', caja: 1_500_000, inflacion: 0.06, eventos: 1.5, descripcion: 'Inflación alta, ARCA que se cae, clientes que pagan tarde. Suerte.' },
};

// ----------------------------------------------------------------------------- Oficinas y crecimiento

export const OFICINAS = [
  { nombre: 'Home office', escritorios: 2, alquiler: 0, mudanza: 0, nivelRequerido: 1, descripcion: 'La mesa del living. El mate siempre a mano.' },
  { nombre: 'Oficina chica', escritorios: 4, alquiler: 650_000, mudanza: 1_500_000, nivelRequerido: 1, descripcion: 'Dos ambientes en el centro, cerca de Tribunales.' },
  { nombre: 'Oficina mediana', escritorios: 8, alquiler: 1_600_000, mudanza: 4_000_000, nivelRequerido: 2, descripcion: 'Planta libre, sala de reuniones y cocina.' },
  { nombre: 'Piso corporativo', escritorios: 14, alquiler: 3_800_000, mudanza: 10_000_000, nivelRequerido: 3, descripcion: 'Un piso entero con vista al río.' },
] as const;

export const NIVELES = [
  { nivel: 1, nombre: 'Estudio unipersonal', clientes: 0, reputacion: 0 },
  { nivel: 2, nombre: 'Estudio en crecimiento', clientes: 7, reputacion: 35 },
  { nivel: 3, nombre: 'Estudio consolidado', clientes: 14, reputacion: 50 },
  { nivel: 4, nombre: 'Estudio de referencia', clientes: 25, reputacion: 65 },
  { nivel: 5, nombre: 'Firma líder', clientes: 40, reputacion: 80 },
] as const;

export const MARKETING = [
  { nombre: 'Boca en boca', costo: 0, prospectos: 0, descripcion: 'Solo referidos de clientes contentos.' },
  { nombre: 'Redes sociales', costo: 250_000, prospectos: 0.035, descripcion: 'Posteos y reels sobre vencimientos.' },
  { nombre: 'Publicidad online', costo: 700_000, prospectos: 0.08, descripcion: 'Anuncios segmentados a PyMEs de la zona.' },
  { nombre: 'Charlas en cámaras empresarias', costo: 1_500_000, prospectos: 0.13, descripcion: 'Posicionamiento como referente. Atrae clientes grandes.' },
] as const;

// ----------------------------------------------------------------------------- Equipo

export const ROLES: Record<Role, { label: string; sueldo: number; skill: [number, number]; foco?: Area; descripcion: string; bonusPaso?: Partial<Record<StepKind, number>> }> = {
  titular: { label: 'Titular', sueldo: 0, skill: [55, 70], descripcion: 'Vos. Firmás, revisás y apagás incendios.' },
  cadete: { label: 'Cadete', sueldo: 720_000, skill: [5, 20], descripcion: 'Busca papeles, reclama documentación y hace trámites.', bonusPaso: { recopilar: 1.8, presentacion: 1.3 } },
  administrativo: { label: 'Administrativo/a contable', sueldo: 950_000, skill: [20, 40], descripcion: 'Rápido en la carga de comprobantes.', bonusPaso: { carga: 1.5 } },
  liquidador: { label: 'Liquidador/a de sueldos', sueldo: 1_250_000, skill: [20, 35], foco: 'sueldos', descripcion: 'Especialista en sueldos, F.931 y convenios colectivos.' },
  junior: { label: 'Contador/a junior', sueldo: 1_150_000, skill: [30, 50], descripcion: 'Recién recibido/a. Aprende rápido.' },
  semisenior: { label: 'Contador/a semi senior', sueldo: 1_700_000, skill: [50, 68], descripcion: 'Liquida impuestos y prepara balances con autonomía.' },
  senior: { label: 'Contador/a senior', sueldo: 2_500_000, skill: [68, 88], descripcion: 'Revisa, supervisa y atiende fiscalizaciones.', bonusPaso: { revision: 1.3 } },
};

/** contribuciones patronales + ART aproximadas (valor de juego) [A CONFIRMAR] */
export const CARGAS_SOCIALES = 0.27;
/** LCT art. 201: recargo 50% horas extra en días hábiles */
export const RECARGO_HORA_EXTRA = 0.5;
/** divisor para valor hora (jornada completa) */
export const HORAS_MES = 200;

// ----------------------------------------------------------------------------- Costos fijos del estudio

export const COSTOS_FIJOS = {
  servicios: 70_000, // luz, internet, teléfono
  /** Caja de Seguridad Social para Profesionales en Cs. Económicas (aporte mensual, juego) [A CONFIRMAR] */
  cajaProfesional: 95_000,
  /** derecho de ejercicio profesional anual CPCE (se cobra en marzo, juego) [A CONFIRMAR] */
  matriculaAnual: 180_000,
  /** costo por escritorio ocupado (insumos, papelería, cafetería) */
  porPuesto: 25_000,
};

// ----------------------------------------------------------------------------- Honorarios de referencia

export const HONORARIO_BASE: Record<ClientKind, number> = {
  monotributista: 70_000,
  ri_persona: 190_000,
  srl: 360_000,
  sas: 330_000,
  sa: 600_000,
};
export const HONORARIO_POR_EMPLEADO = 28_000;
export const HONORARIO_POR_100_COMPROBANTES = 45_000;
export const RECARGO_CONVENIO = 1.3;

export const KIND_LABEL: Record<ClientKind, string> = {
  monotributista: 'Monotributista',
  ri_persona: 'Resp. Inscripto (persona humana)',
  srl: 'SRL',
  sas: 'SAS',
  sa: 'SA',
};

/** nivel de estudio requerido para captar cada tipo de cliente */
export const NIVEL_POR_KIND: Record<ClientKind, number> = { monotributista: 1, ri_persona: 1, srl: 1, sas: 1, sa: 3 };

// ----------------------------------------------------------------------------- Multas e impuestos (valores de juego)

/** Ley 11.683 art. 38 — multa formal automática por DDJJ fuera de término (según Ley 27.743) [A CONFIRMAR] */
export const MULTA_FORMAL_PH = 220_000;
export const MULTA_FORMAL_SOC = 440_000;
/** multa por F.931 fuera de término (valor de juego) */
export const MULTA_F931 = 160_000;
/** recargo por presentación de sueldos fuera de término (LCT art. 128: pago hasta el 4º día hábil) — costo de juego */
export const MULTA_SUELDOS_TARDE = 120_000;
/** resistencia a la fiscalización por no contestar un requerimiento */
export const MULTA_REQUERIMIENTO = 900_000;
/** ajuste por error grave detectado en fiscalización (base, se escala por tipo de cliente) */
export const AJUSTE_FISCALIZACION = 250_000;

/** impuestos del propio estudio */
export const IMPUESTOS_ESTUDIO = {
  /** si es RI: carga efectiva aproximada sobre lo facturado (IVA neto + IIBB + anticipos) */
  riSobreFacturado: 0.16,
};

// ----------------------------------------------------------------------------- Monotributo (tabla de juego)

/**
 * Tabla simplificada de categorías de Monotributo (valores de juego en pesos de enero del año
 * inicial, inspirados en los órdenes de magnitud vigentes). [A CONFIRMAR con la tabla oficial vigente]
 */
export const MONOTRIBUTO_CATEGORIAS = [
  { cat: 'A', ingresos: 12_600_000, superficie: 30, energia: 3330, alquiler: 2_930_000, cuotaServicios: 52_000, cuotaVentas: 52_000 },
  { cat: 'B', ingresos: 18_450_000, superficie: 45, energia: 5000, alquiler: 2_930_000, cuotaServicios: 59_000, cuotaVentas: 59_000 },
  { cat: 'C', ingresos: 25_860_000, superficie: 60, energia: 6700, alquiler: 4_000_000, cuotaServicios: 69_000, cuotaVentas: 67_600 },
  { cat: 'D', ingresos: 32_100_000, superficie: 85, energia: 10000, alquiler: 4_000_000, cuotaServicios: 88_700, cuotaVentas: 86_500 },
  { cat: 'E', ingresos: 37_770_000, superficie: 110, energia: 13000, alquiler: 5_020_000, cuotaServicios: 125_600, cuotaVentas: 113_500 },
  { cat: 'F', ingresos: 47_330_000, superficie: 150, energia: 16500, alquiler: 5_020_000, cuotaServicios: 158_000, cuotaVentas: 136_200 },
  { cat: 'G', ingresos: 56_600_000, superficie: 200, energia: 20000, alquiler: 6_000_000, cuotaServicios: 241_400, cuotaVentas: 166_500 },
  { cat: 'H', ingresos: 85_880_000, superficie: 200, energia: 20000, alquiler: 8_600_000, cuotaServicios: 548_000, cuotaVentas: 333_600 },
  { cat: 'I', ingresos: 96_130_000, superficie: 200, energia: 20000, alquiler: 8_600_000, cuotaServicios: 1_010_000, cuotaVentas: 498_100 },
  { cat: 'J', ingresos: 110_080_000, superficie: 200, energia: 20000, alquiler: 8_600_000, cuotaServicios: 1_223_700, cuotaVentas: 607_600 },
  { cat: 'K', ingresos: 151_700_000, superficie: 200, energia: 20000, alquiler: 8_600_000, cuotaServicios: 1_688_900, cuotaVentas: 735_300 },
] as const;

// ----------------------------------------------------------------------------- Sueldos (para minijuego y costos)

/** Aportes del trabajador (SIPA, Ley 19.032, Obra Social) y adicionales CCT 130/75 Comercio */
export const SUELDOS = {
  jubilacion: 0.11,
  ley19032: 0.03,
  obraSocial: 0.03,
  /** cuota sindical / aporte solidario (simplificado) */
  sindicato: 0.02,
  /** CCT 130/75: 1% del básico por año de antigüedad */
  antiguedadPorAnio: 0.01,
  /** CCT 130/75: adicional por asistencia y puntualidad (1/12) */
  presentismo: 1 / 12,
};

// ----------------------------------------------------------------------------- Errores y productividad

/** probabilidad base de error al completar cada paso (se ajusta por skill, estrés y herramientas) */
export const ERROR_BASE: Record<StepKind, number> = {
  recopilar: 0.02,
  carga: 0.05,
  liquidacion: 0.06,
  revision: 0,
  presentacion: 0.01,
};

/** factor global de horas (subir para que cada cliente demande más trabajo) */
export const FACTOR_HORAS = 1.0;
