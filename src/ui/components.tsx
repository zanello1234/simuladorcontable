// Componentes de UI reutilizables.
import { useEffect, type ReactNode } from 'react';
import { businessDaysBetween } from '../engine/calendar';
import { OFICINAS } from '../engine/config';
import { costoMensualHerramientas, costoSueldos } from '../engine/economy';
import { MARKETING, COSTOS_FIJOS } from '../engine/config';
import { horasRestantes } from '../engine/obligations';
import { cargaHoras } from '../engine/simulation';
import type { GameState, Task, Worker } from '../engine/types';
import { STEP_LABEL } from '../engine/types';
import { useGame } from '../store/game';

// ----------------------------------------------------------------------------- selectores

export const pendientes = (g: GameState) => g.tasks.filter((t) => t.estado === 'pendiente');
export const diasHasta = (g: GameState, fecha: string) => (fecha < g.date ? -businessDaysBetween(fecha, g.date) : businessDaysBetween(g.date, fecha));
export function semaforo(g: GameState, t: Task): 'ok' | 'warn' | 'bad' {
  const d = diasHasta(g, t.vence);
  const h = horasRestantes(t);
  if (d < 0 || t.vencida) return 'bad';
  if (d <= 1 || (d <= 3 && h > 6)) return 'bad';
  if (d <= 4) return 'warn';
  return 'ok';
}
export function venceTexto(g: GameState, t: Task): string {
  const d = diasHasta(g, t.vence);
  if (t.vencida || d < 0) return 'VENCIDA';
  if (d === 0) return 'Vence HOY';
  if (d === 1) return 'Vence mañana';
  return `${d} días háb.`;
}
export const cargaDe = (g: GameState, w: Worker) => cargaHoras(g, w);
export const capacidadDiaria = (w: Worker) => 8 * w.velocidad;
export const ingresoMensual = (g: GameState) => g.clients.filter((c) => c.activo && !c.propio).reduce((a, c) => a + c.honorario, 0);
export function costoMensual(g: GameState): number {
  const i = g.inflacion.indice;
  const of = OFICINAS[g.estudio.oficina];
  return (
    costoSueldos(g) +
    costoMensualHerramientas(g) +
    (of.alquiler + COSTOS_FIJOS.servicios * (1 + g.estudio.oficina * 0.6) + COSTOS_FIJOS.porPuesto * g.workers.length + COSTOS_FIJOS.cajaProfesional + MARKETING[g.estudio.marketing].costo) * i
  );
}
export const noLeidos = (g: GameState) => g.inbox.filter((m) => !m.leido).length;
export const corto = (n: string) => n.split(' (')[0];
export const primerNombre = (n: string) => n.split(' ')[0];

// ----------------------------------------------------------------------------- componentes

export function Bar({ value, max = 100, tone, label }: { value: number; max?: number; tone?: 'ok' | 'warn' | 'bad'; label?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={`bar ${tone ?? ''}`} title={label} role="meter" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
      <i style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'pos' | 'neg' }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className={`stat-value ${tone ?? ''}`}>{value}</span>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  );
}

export function Cara({ v }: { v: number }) {
  const e = v >= 80 ? '😄' : v >= 60 ? '🙂' : v >= 40 ? '😐' : v >= 22 ? '😠' : '🤬';
  return (
    <span className="cara" title={`Satisfacción ${Math.round(v)}/100`}>
      {e}
    </span>
  );
}

export function StepDots({ t }: { t: Task }) {
  return (
    <div className="steps" aria-label={`Paso ${t.stepIndex + 1} de ${t.steps.length}`}>
      {t.steps.map((st, i) => {
        const estado = st.skipped ? 'skip' : i < t.stepIndex ? 'done' : i === t.stepIndex ? 'cur' : 'todo';
        const pct = i === t.stepIndex ? Math.min(100, (st.horasHechas / st.horasTotales) * 100) : 0;
        return (
          <span key={i} className={`step ${estado}`} title={`${STEP_LABEL[st.kind]}${st.skipped ? ' (salteada)' : ''} · ${st.horasTotales} h`}>
            {estado === 'cur' && <i style={{ width: `${pct}%` }} />}
          </span>
        );
      })}
    </div>
  );
}

export function Modal({ children, onClose, wide, full, label }: { children: ReactNode; onClose?: () => void; wide?: boolean; full?: boolean; label?: string }) {
  useEffect(() => {
    if (!onClose) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="modal-back" onClick={onClose} role="dialog" aria-modal="true" aria-label={label}>
      <div className={`modal ${wide ? 'wide' : ''} ${full ? 'full' : ''}`} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function Empty({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-icon">{icon}</span>
      <div>{children}</div>
    </div>
  );
}

export function Section({ title, right, children, className }: { title: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card section ${className ?? ''}`}>
      <header className="section-head">
        <h3>{title}</h3>
        <div className="spacer" />
        {right}
      </header>
      {children}
    </section>
  );
}

export function Toasts() {
  const toasts = useGame((s) => s.toasts);
  const dismiss = useGame((s) => s.dismissToast);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <button key={t.id} className={`toast ${t.tone}`} onClick={() => dismiss(t.id)}>
          {t.texto}
        </button>
      ))}
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange, size }: { value: T; options: { v: T; label: ReactNode; title?: string }[]; onChange: (v: T) => void; size?: 'sm' }) {
  return (
    <div className={`seg ${size ?? ''}`} role="radiogroup">
      {options.map((o) => (
        <button key={o.v} role="radio" aria-checked={value === o.v} className={value === o.v ? 'on' : ''} onClick={() => onChange(o.v)} title={o.title}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-ui" aria-hidden />
      <span>{label}</span>
    </label>
  );
}
