// Catálogo de herramientas (software, IA, infraestructura). Precios base en pesos de enero inicial.
import type { Area, ObligationKind, StepKind, ToolDef, ToolId } from './types';

export const TOOLS: ToolDef[] = [
  {
    id: 'sistema_contable',
    nombre: 'Sistema contable de escritorio',
    categoria: 'software',
    icon: '💾',
    descripcion: 'Plan de cuentas, asientos y libros IVA. Adiós a la planilla gigante.',
    costoInicial: 400_000,
    costoMensual: 60_000,
    nivelRequerido: 1,
    grupo: 'erp',
    efectos: [{ step: 'carga', horasMult: 0.8 }, { step: 'liquidacion', area: 'contabilidad', horasMult: 0.85 }],
    sceneProp: 'servidor',
  },
  {
    id: 'erp_nube',
    nombre: 'ERP en la nube (open source)',
    categoria: 'software',
    icon: '☁️',
    descripcion: 'Contabilidad, facturación y localización argentina integradas. Los clientes cargan, vos controlás.',
    costoInicial: 1_400_000,
    costoMensual: 230_000,
    nivelRequerido: 2,
    grupo: 'erp',
    efectos: [
      { step: 'carga', horasMult: 0.55, errorMult: 0.85 },
      { step: 'liquidacion', area: 'contabilidad', horasMult: 0.7 },
      { step: 'liquidacion', area: 'impuestos', horasMult: 0.85 },
    ],
    sceneProp: 'servidor',
  },
  {
    id: 'liquidador_sueldos',
    nombre: 'Software de liquidación de sueldos',
    categoria: 'software',
    icon: '🧮',
    descripcion: 'Convenios colectivos actualizados, recibos y Libro de Sueldos Digital en un clic.',
    costoInicial: 300_000,
    costoMensual: 90_000,
    nivelRequerido: 1,
    efectos: [
      { area: 'sueldos', step: 'carga', horasMult: 0.5, errorMult: 0.7 },
      { area: 'sueldos', step: 'liquidacion', horasMult: 0.55, errorMult: 0.7 },
    ],
    sceneProp: 'pantalla',
  },
  {
    id: 'bot_arca',
    nombre: 'Bot descargador de ARCA (RPA)',
    categoria: 'ia',
    icon: '🤖',
    descripcion: 'Baja solo "Mis Comprobantes", retenciones y percepciones de todos los clientes.',
    costoInicial: 500_000,
    costoMensual: 80_000,
    nivelRequerido: 1,
    efectos: [{ step: 'carga', kinds: ['iva', 'iibb', 'recategorizacion', 'monotributo'], horasMult: 0.45 }],
    sceneProp: 'robot',
  },
  {
    id: 'ia_carga',
    nombre: 'IA de clasificación de comprobantes',
    categoria: 'ia',
    icon: '🧠',
    descripcion: 'Un modelo de lenguaje lee PDFs y fotos de tickets, los clasifica y los carga.',
    costoInicial: 200_000,
    costoMensual: 180_000,
    nivelRequerido: 1,
    grupo: 'ia_carga',
    efectos: [{ step: 'carga', horasMult: 0.35, errorMult: 1.5 }],
    advertencia: 'Rinde muchísimo, pero sin revisión humana se cuelan errores. No es magia, es ingeniería: alguien tiene que validar.',
    sceneProp: 'robot',
  },
  {
    id: 'ia_revisor',
    nombre: 'IA revisora de DDJJ (controles cruzados)',
    categoria: 'ia',
    icon: '🔎',
    descripcion: 'Cruza libros IVA, F.931, IIBB y extractos. Marca inconsistencias para que las mire una persona.',
    costoInicial: 300_000,
    costoMensual: 200_000,
    nivelRequerido: 2,
    efectos: [{ step: 'revision', horasMult: 0.6, detectMult: 1.5 }],
    sceneProp: 'pantalla',
  },
  {
    id: 'ia_documentacion',
    nombre: 'Agente IA de reclamo de documentación',
    categoria: 'ia',
    icon: '💬',
    descripcion: 'Le escribe a cada cliente por WhatsApp, le recuerda qué falta y ordena lo que manda.',
    costoInicial: 150_000,
    costoMensual: 120_000,
    nivelRequerido: 1,
    especial: 'auto_reclamo',
    efectos: [{ step: 'recopilar', horasMult: 0.5 }],
    sceneProp: 'tablet',
  },
  {
    id: 'ia_conciliacion',
    nombre: 'IA de conciliación bancaria',
    categoria: 'ia',
    icon: '🏦',
    descripcion: 'Empareja extractos con el mayor y propone los asientos de ajuste.',
    costoInicial: 250_000,
    costoMensual: 150_000,
    nivelRequerido: 2,
    efectos: [
      { area: 'contabilidad', step: 'carga', horasMult: 0.5 },
      { area: 'contabilidad', step: 'liquidacion', horasMult: 0.75 },
    ],
    sceneProp: 'robot',
  },
  {
    id: 'factura_auto',
    nombre: 'Facturación electrónica automática',
    categoria: 'software',
    icon: '🧾',
    descripcion: 'Emite y envía los abonos el primer día hábil de cada mes. Cobrás antes.',
    costoInicial: 100_000,
    costoMensual: 50_000,
    nivelRequerido: 1,
    especial: 'factura_auto',
    efectos: [],
    sceneProp: 'impresora',
  },
  {
    id: 'tablero_vencimientos',
    nombre: 'Tablero de vencimientos y alertas',
    categoria: 'software',
    icon: '📅',
    descripcion: 'Semáforo de vencimientos por cliente, alertas a 3 días y priorización automática.',
    costoInicial: 150_000,
    costoMensual: 40_000,
    nivelRequerido: 1,
    especial: 'alertas',
    efectos: [],
    sceneProp: 'pantalla',
  },
  {
    id: 'portal_clientes',
    nombre: 'Portal de clientes',
    categoria: 'servicio',
    icon: '🗂️',
    descripcion: 'Los clientes suben la documentación ordenada y ven el estado de sus impuestos.',
    costoInicial: 600_000,
    costoMensual: 100_000,
    nivelRequerido: 2,
    especial: 'portal',
    efectos: [{ step: 'recopilar', horasMult: 0.6 }],
    sceneProp: 'tablet',
  },
  {
    id: 'firma_digital',
    nombre: 'Firma digital (token)',
    categoria: 'infra',
    icon: '🔐',
    descripcion: 'Firmás balances, certificaciones y presentaciones sin imprimir ni ir al Consejo.',
    costoInicial: 120_000,
    costoMensual: 10_000,
    nivelRequerido: 1,
    efectos: [{ step: 'presentacion', horasMult: 0.5 }],
    sceneProp: 'cajafuerte',
  },
  {
    id: 'backup_nube',
    nombre: 'Backup en la nube',
    categoria: 'infra',
    icon: '🛡️',
    descripcion: 'Copia automática cada noche. Te salva de ransomware y discos que mueren.',
    costoInicial: 50_000,
    costoMensual: 35_000,
    nivelRequerido: 1,
    especial: 'backup',
    efectos: [],
    sceneProp: 'router',
  },
  {
    id: 'ups',
    nombre: 'UPS + notebooks',
    categoria: 'infra',
    icon: '🔋',
    descripcion: 'Cuando se corta la luz, el estudio sigue trabajando.',
    costoInicial: 450_000,
    costoMensual: 0,
    nivelRequerido: 1,
    especial: 'ups',
    efectos: [],
    sceneProp: 'ups',
  },
  {
    id: 'crm',
    nombre: 'CRM comercial',
    categoria: 'software',
    icon: '📈',
    descripcion: 'Seguimiento de prospectos y propuestas. Más consultas y mejor tasa de cierre.',
    costoInicial: 200_000,
    costoMensual: 90_000,
    nivelRequerido: 2,
    especial: 'mas_prospectos',
    efectos: [],
    sceneProp: 'pantalla',
  },
];

export const TOOL: Record<ToolId, ToolDef> = Object.fromEntries(TOOLS.map((t) => [t.id, t])) as Record<ToolId, ToolDef>;

export const hasTool = (owned: ToolId[], id: ToolId) => owned.includes(id);
export const hasEspecial = (owned: ToolId[], esp: NonNullable<ToolDef['especial']>) => owned.some((id) => TOOL[id]?.especial === esp);

function aplica(e: ToolDef['efectos'][number], step: StepKind, area: Area, kind: ObligationKind) {
  if (e.step && e.step !== step) return false;
  if (e.area && e.area !== area) return false;
  if (e.kinds && !e.kinds.includes(kind)) return false;
  return true;
}

/** Multiplicadores combinados de las herramientas para un paso. */
export function toolMods(owned: ToolId[], step: StepKind, area: Area, kind: ObligationKind): { horas: number; error: number; detect: number; usadas: ToolId[] } {
  const porGrupo = new Map<string, { horas: number; error: number; detect: number; id: ToolId }>();
  for (const id of owned) {
    const t = TOOL[id];
    if (!t) continue;
    let horas = 1;
    let error = 1;
    let detect = 1;
    let toca = false;
    for (const e of t.efectos) {
      if (!aplica(e, step, area, kind)) continue;
      toca = true;
      horas *= e.horasMult ?? 1;
      error *= e.errorMult ?? 1;
      detect *= e.detectMult ?? 1;
    }
    if (!toca) continue;
    const g = t.grupo ?? t.id;
    const prev = porGrupo.get(g);
    if (!prev || horas < prev.horas) porGrupo.set(g, { horas, error, detect, id });
  }
  let horas = 1;
  let error = 1;
  let detect = 1;
  const usadas: ToolId[] = [];
  for (const v of porGrupo.values()) {
    horas *= v.horas;
    error *= v.error;
    detect *= v.detect;
    usadas.push(v.id);
  }
  return { horas: Math.max(0.15, horas), error, detect, usadas };
}
