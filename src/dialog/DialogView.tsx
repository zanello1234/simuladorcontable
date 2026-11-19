// Vista de conversación: estilo visual novel liviana (avatares + burbujas + opciones). Pura sobre props.
import { useEffect, useRef } from 'react';
import { AvatarFace, type Mood } from '../scene/Avatar';
import type { Client, Worker } from '../engine/types';
import type { DialogDef, DialogOption, DialogState, Tono } from './types';
import './dialog.css';

const TONO: Record<Tono, { label: string; cls: string }> = {
  firme: { label: 'Firme', cls: 'firme' },
  empatico: { label: 'Empático', cls: 'empatico' },
  comercial: { label: 'Comercial', cls: 'comercial' },
  etico: { label: 'Ético', cls: 'etico' },
  cedes: { label: 'Cedés', cls: 'cedes' },
};

export interface DialogViewProps {
  state: DialogState;
  def: DialogDef;
  client: Client;
  titular: Worker;
  /** opciones ya resueltas (texto y habilitación) para el nodo actual */
  opciones: { o: DialogOption; habilitada: boolean; texto: string }[];
  onOption: (id: string) => void;
  onClose: () => void;
}

const corto = (n: string) => n.split(' (')[0];

export function DialogView({ state, def, client, titular, opciones, onOption, onClose }: DialogViewProps) {
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [state.historial.length]);

  const ultimaCliente = [...state.historial].reverse().find((l) => l.quien === 'cliente');
  const moodCliente: Mood = ultimaCliente?.mood ?? 'neutral';
  const final = state.resumen !== undefined;
  const ultimoTitular = state.historial.filter((l) => l.quien === 'titular').length;

  return (
    <div className="dlg" role="dialog" aria-label={def.titulo}>
      <header className="dlg-head">
        <span className="dlg-icon" aria-hidden>
          {def.icon}
        </span>
        <div className="col tight grow minw0">
          <h2 className="ellipsis">{def.titulo}</h2>
          <span className="small muted ellipsis">Conversación con {corto(client.nombre)}</span>
        </div>
        <button className="btn ghost sm" onClick={onClose} aria-label="Cerrar conversación">
          ✕
        </button>
      </header>

      <div className="dlg-stage">
        <figure className={`dlg-actor cliente ${ultimaCliente && state.historial[state.historial.length - 1]?.quien === 'cliente' ? 'talking' : ''}`}>
          <AvatarFace avatar={client.avatar} size={96} mood={moodCliente} />
          <figcaption>{corto(client.nombre)}</figcaption>
        </figure>
        <div className="dlg-log" ref={scroller}>
          {state.historial.map((l, i) => (
            <div key={i} className={`dlg-line ${l.quien} anim-up`}>
              {l.quien === 'narrador' ? <em>{l.texto}</em> : <p>{l.texto}</p>}
            </div>
          ))}
          {final && (
            <div className="dlg-fin anim-pop">
              <b>Fin de la conversación</b>
              {state.resumen && <span>{state.resumen}</span>}
            </div>
          )}
        </div>
        <figure className={`dlg-actor titular ${state.historial[state.historial.length - 1]?.quien === 'titular' ? 'talking' : ''}`}>
          <AvatarFace avatar={titular.avatar} size={96} mood={ultimoTitular > 0 ? 'neutral' : 'feliz'} />
          <figcaption>Vos</figcaption>
        </figure>
      </div>

      <footer className="dlg-opts">
        {final ? (
          <button className="btn primary block" onClick={onClose} autoFocus>
            Cerrar
          </button>
        ) : (
          opciones.map(({ o, habilitada, texto }) => (
            <button key={o.id} className={`btn dlg-opt ${habilitada ? '' : 'off'}`} disabled={!habilitada} onClick={() => onOption(o.id)} title={!habilitada && o.hint ? o.hint : undefined}>
              <span className="dlg-opt-text">{texto}</span>
              <span className="dlg-opt-meta">
                {o.tono && <span className={`chip tono ${TONO[o.tono].cls}`}>{TONO[o.tono].label}</span>}
                {o.hint && <small className="muted">{o.hint}</small>}
              </span>
            </button>
          ))
        )}
      </footer>
    </div>
  );
}
