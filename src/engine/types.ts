// =============================================================================
// Partida Doble — tipos centrales del juego (contrato entre motor, UI, escena y minijuegos)
// =============================================================================

/** Fecha ISO 'YYYY-MM-DD' (sin hora). */
export type ISODate = string;

export type Area = 'impuestos' | 'sueldos' | 'contabilidad';
export const AREAS: Area[] = ['impuestos', 'sueldos', 'contabilidad'];

// ----------------------------------------------------------------------------- Clientes

export type ClientKind = 'monotributista' | 'ri_persona' | 'srl' | 'sas' | 'sa';
export type Rubro =
  | 'comercio'
  | 'servicios'
  | 'gastronomia'
  | 'construccion'
  | 'agro'
  | 'industria'
  | 'salud'
  | 'transporte';
export type Jurisdiccion = 'local' | 'convenio';

export type Peinado = 'corto' | 'largo' | 'rodete' | 'pelado' | 'rulos' | 'flequillo';

/** Aspecto de un personaje (empleados, titular, clientes, inspector). */
export interface Avatar {
  piel: string; // color hex
  pelo: string; // color hex
  peinado: Peinado;
  ropa: string; // color hex
  anteojos: boolean;
  barba: boolean;
}

export interface LatentError {
  taskId: string;
  kind: ObligationKind;
  periodo: string;
  /** 1 = leve (formal), 2 = moderado, 3 = grave (impuesto omitido relevante) */
  gravedad: 1 | 2 | 3;
  desde: ISODate;
}

export interface Client {
  id: string;
  nombre: string;
  /** CUIT ficticio formateado 'XX-XXXXXXXX-X' */
  cuit: string;
  kind: ClientKind;
  rubro: Rubro;
  jurisdiccion: Jurisdiccion;
  empleados: number;
  /** comprobantes por mes aproximados (escala horas de carga) */
  volumen: number;
  /** 0..1 — qué tan ordenado/puntual trae la documentación */
  ordenDocumental: number;
  /** 0..1 — qué tan puntual paga los honorarios */
  pagador: number;
  /** abono mensual vigente en ARS */
  honorario: number;
  /** fecha de la última actualización del abono */
  honorarioActualizadoEl: ISODate;
  /** índice de inflación al momento de la última actualización (para medir atraso) */
  honorarioIndice: number;
  satisfaccion: number; // 0..100
  desde: ISODate;
  /** 0..1 propensión a ser fiscalizado */
  riesgoFiscal: number;
  erroresLatentes: LatentError[];
  /** mes de cierre de ejercicio (1-12) para sociedades */
  cierre?: number;
  /** categoría de monotributo (A..K) */
  categoria?: string;
  avatar: Avatar;
  activo: boolean;
  /** el propio estudio como contribuyente ("en casa de herrero...") */
  propio?: boolean;
  bajaEl?: ISODate;
  motivoBaja?: string;
}

// ----------------------------------------------------------------------------- Obligaciones y tareas

export type ObligationKind =
  | 'iva'
  | 'iibb'
  | 'sueldos'
  | 'f931'
  | 'monotributo'
  | 'recategorizacion'
  | 'ganancias_ph'
  | 'bienes_personales'
  | 'balance'
  | 'ganancias_soc'
  | 'requerimiento' // respuesta a fiscalización ARCA
  | 'rectificativa'
  | 'consulta'; // trabajo extra cobrable

export type StepKind = 'recopilar' | 'carga' | 'liquidacion' | 'revision' | 'presentacion';

export const STEP_LABEL: Record<StepKind, string> = {
  recopilar: 'Recopilar documentación',
  carga: 'Carga en sistema',
  liquidacion: 'Liquidación / preparación',
  revision: 'Revisión',
  presentacion: 'Presentación y VEP',
};

export interface TaskStep {
  kind: StepKind;
  horasTotales: number;
  horasHechas: number;
  hechoPor?: string; // worker id, 'ia:<toolId>' o 'minijuego'
  skipped?: boolean;
}

export type TaskEstado = 'pendiente' | 'presentada' | 'presentada_tarde';

export type MinigameId = 'iva' | 'sueldos' | 'recategorizacion' | 'conciliacion';

export interface Task {
  id: string;
  clientId: string;
  kind: ObligationKind;
  /** '2027-01' (mensual) · '2027-S1' (semestral) · '2026' (anual) · libre para eventos */
  periodo: string;
  titulo: string;
  vence: ISODate;
  generada: ISODate;
  /** día en que el cliente entrega la documentación */
  docsLlegan: ISODate;
  docsRecibidos: boolean;
  reclamos: number;
  steps: TaskStep[];
  stepIndex: number;
  estado: TaskEstado;
  asignadoA?: string; // worker id
  /** errores latentes acumulados en esta tarea (no detectados aún) */
  errores: number;
  /** errores detectados y corregidos en revisión */
  corregidos: number;
  saltearRevision: boolean;
  presentadaEl?: ISODate;
  vencida: boolean; // ya se aplicó la consecuencia de vencimiento
  /** honorario extra que se factura al terminar (consultas, requerimientos cobrables) */
  honorarioExtra?: number;
  /** minijuego disponible para el paso de liquidación */
  minigame?: MinigameId;
  minigameScore?: number;
  prioridad?: boolean;
}

// ----------------------------------------------------------------------------- Equipo

export type Role = 'titular' | 'cadete' | 'administrativo' | 'liquidador' | 'junior' | 'semisenior' | 'senior';

export type WorkerStatus = 'trabajando' | 'ocioso' | 'esperando' | 'agotado' | 'networking' | 'estudiando' | 'descansando' | 'minijuego';

export interface Worker {
  id: string; // 'player' para el titular
  nombre: string;
  role: Role;
  skills: Record<Area, number>; // 0..100
  velocidad: number; // 0.6..1.4
  /** sueldo bruto mensual (0 para el titular) */
  sueldo: number;
  moral: number; // 0..100
  estres: number; // 0..100
  queue: string[]; // ids de tareas en orden de trabajo
  horasExtra: boolean;
  contratadoEl: ISODate;
  avatar: Avatar;
  deskIndex: number;
  // --- derivados cada tick (para la escena) ---
  status: WorkerStatus;
  statusText: string;
  currentTaskId?: string;
  /** horas bloqueadas (p.ej. el titular jugando un minijuego) */
  ocupadoHoras: number;
  renunciaEl?: ISODate;
  /** horas trabajadas en el mes (para extras y reportes) */
  horasMes: number;
  horasExtraMes: number;
}

export interface Candidate {
  id: string;
  nombre: string;
  role: Role;
  skills: Record<Area, number>;
  velocidad: number;
  sueldo: number; // pretensión
  avatar: Avatar;
  bio: string;
}

// ----------------------------------------------------------------------------- Herramientas

export type ToolCategory = 'software' | 'ia' | 'infra' | 'servicio';
export type ToolId =
  | 'planilla'
  | 'sistema_contable'
  | 'erp_nube'
  | 'liquidador_sueldos'
  | 'bot_arca'
  | 'ia_carga'
  | 'ia_revisor'
  | 'ia_documentacion'
  | 'ia_conciliacion'
  | 'factura_auto'
  | 'tablero_vencimientos'
  | 'portal_clientes'
  | 'backup_nube'
  | 'ups'
  | 'firma_digital'
  | 'crm';

/** Objeto que la escena dibuja en la oficina cuando se posee la herramienta */
export type SceneProp = 'servidor' | 'robot' | 'impresora' | 'ups' | 'pantalla' | 'tablet' | 'router' | 'cajafuerte';

export interface ToolEffect {
  step?: StepKind;
  area?: Area;
  kinds?: ObligationKind[];
  /** multiplicador de horas del paso (0.5 = la mitad) */
  horasMult?: number;
  /** multiplicador de probabilidad de error del paso */
  errorMult?: number;
  /** multiplicador de probabilidad de detección en revisión */
  detectMult?: number;
}

export interface ToolDef {
  id: ToolId;
  nombre: string;
  categoria: ToolCategory;
  icon: string; // emoji
  descripcion: string;
  /** precios base (pesos de enero del año inicial); se indexan por inflación */
  costoInicial: number;
  costoMensual: number;
  nivelRequerido: number;
  efectos: ToolEffect[];
  /** efectos especiales manejados por el motor */
  especial?: 'auto_reclamo' | 'factura_auto' | 'alertas' | 'backup' | 'ups' | 'mas_prospectos' | 'portal';
  /** herramientas del mismo grupo no se acumulan: por paso se aplica la mejor */
  grupo?: string;
  sceneProp?: SceneProp;
  /** advertencia de uso (p.ej. IA sin revisión humana) */
  advertencia?: string;
}

// ----------------------------------------------------------------------------- Finanzas

export type LedgerCategoria =
  | 'honorarios'
  | 'sueldos'
  | 'cargas_sociales'
  | 'alquiler'
  | 'servicios'
  | 'software'
  | 'multas'
  | 'impuestos'
  | 'marketing'
  | 'capacitacion'
  | 'mudanza'
  | 'indemnizacion'
  | 'otros';

export interface LedgerEntry {
  id: string;
  date: ISODate;
  concepto: string;
  monto: number; // + ingreso, − egreso
  categoria: LedgerCategoria;
}

export interface Invoice {
  id: string;
  numero: string; // 'C 0001-00000012'
  clientId: string;
  periodo: string;
  concepto: string;
  monto: number;
  emitida: ISODate;
  vence: ISODate;
  /** fecha estimada en que el cliente paga (secreta para el jugador) */
  pagaEl?: ISODate;
  cobradaEl?: ISODate;
  incobrable?: boolean;
}

export interface MonthlySummary {
  mes: string; // '2027-01'
  facturado: number;
  cobrado: number;
  egresos: number;
  multas: number;
  resultado: number;
  caja: number;
  clientes: number;
  reputacion: number;
  presentadasATiempo: number;
  presentadasTarde: number;
}

// ----------------------------------------------------------------------------- Comunicación y eventos

export type Canal = 'whatsapp' | 'email' | 'dfe' | 'sistema' | 'telefono';

export interface Message {
  id: string;
  date: ISODate;
  hour: number;
  canal: Canal;
  de: string;
  asunto: string;
  cuerpo: string;
  leido: boolean;
  clientId?: string;
  taskId?: string;
  importante?: boolean;
}

export interface EventOption {
  id: string;
  label: string;
  hint?: string;
  /** deshabilitada (p.ej. sin plata) */
  disabled?: boolean;
}

export interface ActiveEvent {
  id: string;
  defId: string;
  date: ISODate;
  titulo: string;
  texto: string;
  icon: string;
  opciones: EventOption[];
  params: Record<string, string | number>;
  clientId?: string;
  workerId?: string;
}

export interface Prospect {
  id: string;
  llego: ISODate;
  expira: ISODate;
  origen: 'referido' | 'web' | 'redes' | 'networking' | 'camara' | 'colega';
  mensaje: string;
  client: Client; // borrador (activo=false)
  honorarioReferencia: number;
  horasEstimadas: number;
  /** pista sobre el orden documental del cliente (lo que se percibe en la entrevista) */
  pista: string;
}

// ----------------------------------------------------------------------------- Efectos visuales (para la escena)

export type FxKind =
  | 'paso_completo'
  | 'presentada'
  | 'presentada_tarde'
  | 'error'
  | 'error_detectado'
  | 'cobro'
  | 'pago'
  | 'multa'
  | 'cliente_llega'
  | 'prospecto_llega'
  | 'inspector'
  | 'arca_caida'
  | 'contratacion'
  | 'renuncia'
  | 'nivel'
  | 'herramienta'
  | 'idea';

export interface FxEvent {
  id: number; // creciente
  tick: number;
  kind: FxKind;
  workerId?: string;
  clientId?: string;
  monto?: number;
  texto?: string;
}

// ----------------------------------------------------------------------------- Estado general

export type Dificultad = 'facil' | 'normal' | 'argentina';
export type PlayerIdle = 'networking' | 'estudiar' | 'descansar';
export type PoliticaRevision = 'siempre' | 'criticas' | 'nunca';

export interface Estudio {
  nombre: string;
  titular: string;
  especialidad: Area;
  dificultad: Dificultad;
  caja: number;
  reputacion: number; // 0..100
  nivel: number; // 1..5
  oficina: number; // 0..3 (índice en OFICINAS)
  marketing: number; // 0..3
  /** condición fiscal del propio estudio */
  condicion: 'monotributista' | 'ri';
  diasEnRojo: number;
  facturasEmitidasMes?: string; // '2027-03' si ya se facturó ese mes
  /** actividad del titular cuando no tiene tareas */
  idle: PlayerIdle;
  politicaRevision: PoliticaRevision;
  autoAsignar: boolean;
  /** contador para numerar facturas propias */
  nroFactura: number;
  /** año/mes de inicio */
  inicio: ISODate;
  prestamo?: { cuota: number; restantes: number };
  /** veces que el titular aceptó "dibujar" números */
  faltasEticas: number;
}

export interface Inflacion {
  /** inflación mensual vigente (0.02 = 2%) */
  mensual: number;
  /** índice acumulado desde el inicio (1 = enero inicial) */
  indice: number;
  historia: { mes: string; tasa: number }[];
}

export interface DayFlags {
  arcaCaida: boolean;
  corteLuz: boolean;
  /** vencimientos de hoy prorrogados al próximo día hábil */
  prorroga: boolean;
  /** el titular llamó a la mesa de ayuda de ARCA (sube la chance de prórroga) */
  reclamoArca?: boolean;
  /** horas de networking del titular hoy (suben la chance de prospectos) */
  networking?: number;
}

export interface GameOver {
  motivo: 'quiebra' | 'reputacion' | 'matricula';
  texto: string;
  date: ISODate;
}

export interface Stats {
  presentadasATiempo: number;
  presentadasTarde: number;
  multasPagadas: number;
  inspeccionesSuperadas: number;
  inspeccionesConAjuste: number;
  clientesGanados: number;
  clientesPerdidos: number;
  minijuegosJugados: number;
  mejorCaja: number;
}

export interface GameState {
  version: number;
  rngState: number;
  tick: number;
  date: ISODate;
  hour: number; // 9..18 (18 = cierre del día) — con horas extra hasta 20
  speed: 0 | 1 | 2 | 3;
  estudio: Estudio;
  clients: Client[];
  workers: Worker[];
  candidates: Candidate[];
  tasks: Task[];
  prospects: Prospect[];
  tools: ToolId[];
  ledger: LedgerEntry[];
  invoices: Invoice[];
  monthly: MonthlySummary[];
  inbox: Message[];
  events: ActiveEvent[];
  flags: DayFlags;
  inflacion: Inflacion;
  fx: FxEvent[];
  fxSeq: number;
  stats: Stats;
  /** pasos del tutorial ya mostrados */
  tutorial: string[];
  gameOver?: GameOver;
  idSeq: number;
}

export interface NewGameConfig {
  nombreEstudio: string;
  titular: string;
  especialidad: Area;
  dificultad: Dificultad;
  seed?: number;
  avatar?: Avatar;
}
