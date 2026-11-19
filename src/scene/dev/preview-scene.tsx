// Preview de desarrollo de la escena (no forma parte del juego). Abrir /preview-scene.html
// Parámetros URL: ?lvl=0..3&hour=9..20&workers=n&arca=1&luz=1&prorroga=1&insp=1&tools=all|a,b&speed=0..3&h=alto
import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../styles.css';
import type { Avatar, FxKind, GameState, Peinado, Task, ToolId, Worker, WorkerStatus } from '../../engine/types';
import { OfficeScene } from '../OfficeScene';
import { AvatarFace } from '../Avatar';
import { OFICINAS } from '../../engine/config';

const ALL_TOOLS: ToolId[] = ['planilla', 'sistema_contable', 'erp_nube', 'liquidador_sueldos', 'bot_arca', 'ia_carga', 'ia_revisor', 'ia_documentacion', 'ia_conciliacion', 'factura_auto', 'tablero_vencimientos', 'portal_clientes', 'backup_nube', 'ups', 'firma_digital', 'crm'];
const STATUSES: WorkerStatus[] = ['trabajando', 'ocioso', 'esperando', 'agotado', 'networking', 'estudiando', 'descansando', 'minijuego'];
const PEINADOS: Peinado[] = ['corto', 'largo', 'rodete', 'pelado', 'rulos', 'flequillo'];
const PIELES = ['#f6d3b3', '#e8b48f', '#c98f65', '#a86b48', '#7a4a30'];
const PELOS = ['#2b1d16', '#5a3a22', '#c2873e', '#1a1a1a', '#8a8a8a', '#b5462f'];
const ROPAS = ['#2f6fb5', '#1f8a70', '#c8414f', '#6b4a8a', '#d98e04', '#3d4a59', '#e57a9a'];
const NOMBRES = ['Martín Zanello', 'Lucía Fernández', 'Diego Gómez', 'Sofía Rodríguez', 'Pablo Ruiz', 'Carla Pereyra', 'Nico Benítez', 'Ana Suárez', 'Julián Ortiz', 'Flor Medina', 'Tomás Acosta', 'Vale Romero', 'Gastón Sosa', 'Meli Torres'];

const q = new URLSearchParams(location.search);
const num = (k: string, d: number) => (q.has(k) ? Number(q.get(k)) : d);

function avatar(i: number): Avatar {
  return { piel: PIELES[(i * 3) % PIELES.length], pelo: PELOS[(i * 5 + 1) % PELOS.length], peinado: PEINADOS[i % PEINADOS.length], ropa: ROPAS[(i * 2) % ROPAS.length], anteojos: i % 3 === 1, barba: i % 4 === 2 };
}

function worker(i: number, status: WorkerStatus, estres: number): Worker {
  return {
    id: i === 0 ? 'player' : `w${i}`,
    nombre: NOMBRES[i % NOMBRES.length],
    role: i === 0 ? 'titular' : 'junior',
    skills: { impuestos: 50, sueldos: 40, contabilidad: 45 },
    velocidad: 1,
    sueldo: 1_000_000,
    moral: 70,
    estres,
    queue: Array.from({ length: (i * 3) % 9 }, (_, k) => `t${k}`),
    horasExtra: false,
    contratadoEl: '2027-01-04',
    avatar: i === 0 ? { piel: '#f1c9a5', pelo: '#4a3426', peinado: 'corto', ropa: '#1d3557', anteojos: true, barba: true } : avatar(i),
    deskIndex: i,
    status,
    statusText: status === 'trabajando' ? `IVA 02/2027 · Ferretería López SRL (${40 + i * 5}%)` : status === 'esperando' ? 'Esperando documentación de Panadería Don José' : status,
    ocupadoHoras: 0,
    horasMes: 0,
    horasExtraMes: 0,
  };
}

function baseState(): GameState {
  const lvl = num('lvl', 1);
  const n = Math.min(OFICINAS[lvl].escritorios, num('workers', OFICINAS[lvl].escritorios));
  const workers = Array.from({ length: n }, (_, i) => worker(i, (q.get('st') as WorkerStatus) || STATUSES[i % STATUSES.length], i === 3 ? 95 : i === 1 ? 78 : 30));
  const tools = q.get('tools') === 'all' ? ALL_TOOLS : ((q.get('tools') || '').split(',').filter(Boolean) as ToolId[]);
  const task = (id: string, vence: string, kind: Task['kind'] = 'iva'): Task => ({
    id, clientId: 'c1', kind, periodo: '2027-02', titulo: 'IVA 02/2027', vence, generada: '2027-03-01', docsLlegan: '2027-03-05', docsRecibidos: true, reclamos: 0,
    steps: [], stepIndex: 0, estado: 'pendiente', errores: 0, corregidos: 0, saltearRevision: false, vencida: false,
  });
  return {
    version: 1, rngState: 1, tick: 100, date: '2027-03-17', hour: num('hour', 11), speed: num('speed', 1) as 0 | 1 | 2 | 3,
    estudio: {
      nombre: q.get('nombre') || 'Estudio Zanello', titular: 'Martín Zanello', especialidad: 'impuestos', dificultad: 'normal', caja: 3_000_000, reputacion: 40, nivel: 2,
      oficina: lvl, marketing: 0, condicion: 'monotributista', diasEnRojo: 0, idle: 'networking', politicaRevision: 'siempre', autoAsignar: true, nroFactura: 1, inicio: '2027-01-04', faltasEticas: 0,
    },
    clients: [{
      id: 'c1', nombre: 'Ferretería López SRL', cuit: '30-71234567-8', kind: 'srl', rubro: 'comercio', jurisdiccion: 'local', empleados: 3, volumen: 150, ordenDocumental: 0.6, pagador: 0.7,
      honorario: 400_000, honorarioActualizadoEl: '2027-01-04', honorarioIndice: 1, satisfaccion: 70, desde: '2027-01-04', riesgoFiscal: 0.2, erroresLatentes: [], cierre: 12,
      avatar: { piel: '#e8b48f', pelo: '#2b1d16', peinado: 'pelado', ropa: '#b5485a', anteojos: false, barba: true }, activo: true,
    }],
    workers, candidates: [],
    tasks: [task('t1', '2027-03-18'), task('t2', '2027-03-19'), task('t3', '2027-03-30'), ...(q.get('insp') === '1' ? [task('r1', '2027-03-30', 'requerimiento')] : [])],
    prospects: [], tools, ledger: [], invoices: [], monthly: [], inbox: [], events: [],
    flags: { arcaCaida: q.get('arca') === '1', corteLuz: q.get('luz') === '1', prorroga: q.get('prorroga') === '1' },
    inflacion: { mensual: 0.02, indice: 1, historia: [] },
    fx: [], fxSeq: 0,
    stats: { presentadasATiempo: 0, presentadasTarde: 0, multasPagadas: 0, inspeccionesSuperadas: 0, inspeccionesConAjuste: 0, clientesGanados: 0, clientesPerdidos: 0, minijuegosJugados: 0, mejorCaja: 0 },
    tutorial: [],
    progreso: { misiones: [], logros: [], racha: 0, mejorRacha: 0, notas: [], relampagoMejor: 0 }, idSeq: 10,
  };
}

const FX_KINDS: FxKind[] = ['paso_completo', 'presentada', 'presentada_tarde', 'error_detectado', 'cobro', 'pago', 'multa', 'cliente_llega', 'prospecto_llega', 'inspector', 'arca_caida', 'contratacion', 'renuncia', 'nivel', 'herramienta', 'idea', 'error'];

function Preview() {
  const [s, setS] = useState<GameState>(baseState);
  const fire = (kind: FxKind) =>
    setS((p) => {
      const ids = p.workers.map((w) => w.id);
      const id = p.fxSeq + 1;
      return { ...p, fxSeq: id, fx: [...p.fx.slice(-20), { id, tick: p.tick, kind, workerId: ids[id % ids.length], clientId: 'c1', monto: 385_000, texto: kind === 'herramienta' ? 'Asistente IA de carga' : kind === 'nivel' ? '¡Nivel 2: Estudio en crecimiento!' : undefined }] };
    });
  useEffect(() => {
    (window as unknown as { __fire: typeof fire }).__fire = fire;
  });
  // reloj: avanza la hora como el juego real
  useEffect(() => {
    if (q.get('clock') !== '1') return;
    const t = setInterval(() => setS((p) => (p.speed === 0 ? p : { ...p, tick: p.tick + 1, hour: p.hour >= 20 ? 9 : p.hour + 1 })), 1800);
    return () => clearInterval(t);
  }, []);
  const set = (patch: Partial<GameState>) => setS((p) => ({ ...p, ...patch }));
  const lvl = s.estudio.oficina;
  const h = q.get('h') || 'clamp(220px, 42vh, 460px)';
  const faces = useMemo(() => s.workers.slice(0, 6), [s.workers]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ height: h, width: '100%' }}>
        <OfficeScene state={s} onWorkerClick={(id) => console.log('worker', id)} onDoorClick={() => console.log('door')} onCalendarClick={() => console.log('calendar')} />
      </div>
      {q.get('ui') !== '0' && (
        <div className="card" style={{ margin: 10 }}>
          <div className="row wrap">
            {[0, 1, 2, 3].map((l) => (
              <button key={l} className={`btn sm ${l === lvl ? 'primary' : ''}`} onClick={() => setS((p) => ({ ...p, estudio: { ...p.estudio, oficina: l }, workers: Array.from({ length: OFICINAS[l].escritorios }, (_, i) => worker(i, STATUSES[i % STATUSES.length], i === 3 ? 95 : 30)) }))}>
                Nivel {l}
              </button>
            ))}
            <label className="small">Hora {s.hour} <input type="range" min={8} max={20} value={s.hour} onChange={(e) => set({ hour: Number(e.target.value) })} /></label>
            {[0, 1, 2, 3].map((sp) => (
              <button key={sp} className={`btn sm ${s.speed === sp ? 'primary' : ''}`} onClick={() => set({ speed: sp as 0 | 1 | 2 | 3 })}>x{sp}</button>
            ))}
            <button className="btn sm" onClick={() => set({ flags: { ...s.flags, arcaCaida: !s.flags.arcaCaida } })}>ARCA caída</button>
            <button className="btn sm" onClick={() => set({ flags: { ...s.flags, corteLuz: !s.flags.corteLuz } })}>Corte de luz</button>
            <button className="btn sm" onClick={() => set({ tools: s.tools.length ? [] : ALL_TOOLS })}>Herramientas: {s.tools.length}</button>
            <button className="btn sm" onClick={() => set({ events: s.events.length ? [] : [{ id: 'e', defId: 'inspeccion', date: s.date, titulo: 'Inspección', texto: '', icon: '🕵️', opciones: [], params: {} }] })}>Inspector</button>
          </div>
          <div className="row wrap" style={{ marginTop: 8 }}>
            {FX_KINDS.map((k) => (
              <button key={k} className="btn sm" onClick={() => fire(k)}>{k}</button>
            ))}
          </div>
          <div className="row wrap" style={{ marginTop: 8 }}>
            {faces.map((w) => <AvatarFace key={w.id} avatar={w.avatar} size={48} bg="#e9dfcc" title={w.nombre} />)}
            <AvatarFace avatar={faces[0].avatar} size={28} />
          </div>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Preview />
  </StrictMode>,
);
