// Botón de sonido con panel: música y efectos (on/off + volumen).
import { useState, useSyncExternalStore } from 'react';
import { audio } from './audio';
import { callar, hablar, vocesDisponibles } from './voice';

export function useAudioPrefs() {
  return useSyncExternalStore(
    (fn) => audio.subscribe(fn),
    () => audio.getPrefs(),
  );
}

export function AudioControls({ variant = 'topbar' }: { variant?: 'topbar' | 'floating' }) {
  const p = useAudioPrefs();
  const [open, setOpen] = useState(false);
  const muted = !p.musica && !p.efectos;
  return (
    <div className={`audio-ctl ${variant}`}>
      <button
        className="btn ghost sm audio-btn"
        onClick={() => {
          audio.unlock();
          setOpen(!open);
        }}
        aria-expanded={open}
        aria-label="Sonido"
        title="Música y efectos"
      >
        {muted ? '🔇' : p.musica ? '🎵' : '🔊'}
      </button>
      {open && (
        <div className="menu-pop audio-pop" role="dialog" aria-label="Sonido">
          <div className="audio-row">
            <label className="audio-check">
              <input id="aud-musica" type="checkbox" checked={p.musica} onChange={(e) => audio.setPrefs({ musica: e.target.checked })} />
              <span>🎵 Música</span>
            </label>
            <input id="aud-vol-musica" type="range" min={0} max={1} step={0.05} value={p.volMusica} disabled={!p.musica} onChange={(e) => audio.setPrefs({ volMusica: Number(e.target.value) })} aria-label="Volumen de la música" />
          </div>
          <div className="audio-row">
            <label className="audio-check">
              <input id="aud-efectos" type="checkbox" checked={p.efectos} onChange={(e) => audio.setPrefs({ efectos: e.target.checked })} />
              <span>🔔 Efectos</span>
            </label>
            <input
              id="aud-vol-efectos"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={p.volEfectos}
              disabled={!p.efectos}
              onChange={(e) => audio.setPrefs({ volEfectos: Number(e.target.value) })}
              onPointerUp={() => audio.sfx('cobro')}
              aria-label="Volumen de los efectos"
            />
          </div>
          {vocesDisponibles() && (
            <div className="audio-row">
              <label className="audio-check">
                <input
                  id="aud-voces"
                  type="checkbox"
                  checked={p.voces}
                  onChange={(e) => {
                    audio.setPrefs({ voces: e.target.checked });
                    if (e.target.checked) void hablar('Hola, acá tu estudio. ¡Vamos a trabajar!', 'sistema', { prioridad: true });
                    else callar();
                  }}
                />
                <span>🗣️ Voces</span>
              </label>
              <span className="tiny muted">Clientes, inspector y avisos hablados</span>
            </div>
          )}
          <p className="tiny muted">La música cambia con el clima del estudio: más rápida con vencimientos encima y tensa cuando cae una inspección.</p>
          <button className="btn sm block" onClick={() => setOpen(false)}>
            Listo
          </button>
        </div>
      )}
    </div>
  );
}
