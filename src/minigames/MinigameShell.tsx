// Marco común de los minijuegos: encabezado, instrucciones, cuerpo y pie con acciones.
import type { ReactNode } from 'react';

interface Props {
  icon: string;
  titulo: string;
  subtitulo?: string;
  instrucciones?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  onCancel: () => void;
}

export function MinigameShell({ icon, titulo, subtitulo, instrucciones, children, footer, onCancel }: Props) {
  return (
    <div className="mg">
      <header className="mg-head">
        <div className="mg-icon" aria-hidden>{icon}</div>
        <div className="mg-titles">
          <h2>{titulo}</h2>
          {subtitulo && <p className="muted">{subtitulo}</p>}
        </div>
        <button className="btn ghost sm" onClick={onCancel} aria-label="Salir del minijuego">✕ Salir</button>
      </header>
      {instrucciones && <div className="mg-help">{instrucciones}</div>}
      <div className="mg-body">{children}</div>
      {footer && <footer className="mg-foot">{footer}</footer>}
    </div>
  );
}

/** Pantalla de resultado reutilizable (score + errores educativos). */
export function MinigameResultView({ score, resumen, errores, onContinue }: { score: number; resumen: string; errores: string[]; onContinue: () => void }) {
  const tono = score >= 0.95 ? 'ok' : score >= 0.7 ? 'warn' : 'bad';
  const label = score >= 0.95 ? '¡Impecable!' : score >= 0.7 ? 'Bien, con observaciones' : 'Hay errores importantes';
  return (
    <div className={`mg-result ${tono}`}>
      <div className="mg-score">{Math.round(score * 100)}<small>/100</small></div>
      <h3>{label}</h3>
      <p>{resumen}</p>
      {errores.length > 0 && (
        <ul className="mg-errors">
          {errores.map((e, i) => <li key={i}>{e}</li>)}
        </ul>
      )}
      <button className="btn primary" onClick={onContinue}>Continuar</button>
    </div>
  );
}
