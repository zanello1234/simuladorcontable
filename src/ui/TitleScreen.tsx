import { useEffect, useRef, useState } from 'react';
import { fechaAR } from '../engine/calendar';
import { cloudMeta, type CloudMeta } from '../engine/cloud';
import { AudioControls } from '../audio/AudioControls';
import { DIFICULTAD } from '../engine/config';
import { avatar as genAvatar } from '../engine/names';
import { makeRng } from '../engine/rng';
import * as save from '../engine/save';
import type { Area, Avatar, Dificultad } from '../engine/types';
import { AvatarFace } from '../scene/Avatar';
import { useGame } from '../store/game';
import { Segmented } from './components';

const FLOTANTES = ['🧾', '📊', '💵', '📅', '🧮', '📎', '🏛️', '🧉', '📒', '✅', '💼', '📑'];

export function TitleScreen() {
  const start = useGame((s) => s.start);
  const continuar = useGame((s) => s.continuar);
  const load = useGame((s) => s.load);
  const toast = useGame((s) => s.toast);
  const [modo, setModo] = useState<'menu' | 'nueva'>('menu');
  const [nombre, setNombre] = useState('Estudio Contable');
  const [titular, setTitular] = useState('');
  const [esp, setEsp] = useState<Area>('impuestos');
  const [dif, setDif] = useState<Dificultad>('normal');
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const av: Avatar = genAvatar(makeRng(seed));
  const fileRef = useRef<HTMLInputElement>(null);
  const continuarNube = useGame((s) => s.continuarNube);
  const [nube, setNube] = useState<CloudMeta | null>(null);
  const [cargando, setCargando] = useState(false);
  useEffect(() => {
    let vivo = true;
    void cloudMeta().then((m) => vivo && setNube(m));
    return () => {
      vivo = false;
    };
  }, []);
  const hay = save.hayPartida() || !!nube;

  return (
    <div className="title">
      <div className="title-bg" aria-hidden>
        {FLOTANTES.map((f, i) => (
          <span key={i} style={{ left: `${(i * 83) % 100}%`, animationDelay: `${-i * 1.7}s`, animationDuration: `${14 + (i % 5) * 3}s` }}>
            {f}
          </span>
        ))}
      </div>
      <div className="title-card anim-pop">
        <div className="logo">
          <span className="logo-icon">📒</span>
          <h1>
            Partida <em>Doble</em>
          </h1>
          <p>El simulador del estudio contable argentino</p>
        </div>

        {modo === 'menu' ? (
          <div className="col title-menu">
            {nube && (
              <button
                className="btn primary block"
                disabled={cargando}
                onClick={async () => {
                  setCargando(true);
                  if (!(await continuarNube())) toast('No se pudo traer la partida de la nube.', 'warn');
                  setCargando(false);
                }}
              >
                {cargando ? 'Cargando…' : `☁️ Continuar: ${nube.estudio} (${fechaAR(nube.fecha)})`}
              </button>
            )}
            {save.hayPartida() && (
              <button className={`btn block ${nube ? '' : 'primary'}`} onClick={() => !continuar() && toast('No se pudo cargar la partida guardada.', 'warn')}>
                ▶ Continuar partida {nube ? '(este dispositivo)' : ''}
              </button>
            )}
            <button className={`btn block ${hay ? '' : 'primary'}`} onClick={() => setModo('nueva')}>
              ✨ Nueva partida
            </button>
            <button className="btn block ghost" onClick={() => fileRef.current?.click()}>
              📂 Importar partida (.json)
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const g = await save.importar(f);
                if (g) load(g);
                else toast('El archivo no es una partida válida.', 'warn');
              }}
            />
            <p className="tiny muted center mt">Vencimientos, ARCA, sueldos, multas, inspecciones e inflación. ¿Te animás?</p>
          </div>
        ) : (
          <form
            className="col new-game"
            onSubmit={(e) => {
              e.preventDefault();
              start({ nombreEstudio: nombre.trim() || 'Estudio Contable', titular: titular.trim() || 'Cr. Titular', especialidad: esp, dificultad: dif, seed, avatar: av });
            }}
          >
            <div className="row">
              <button type="button" className="avatar-pick" onClick={() => setSeed(Math.floor(Math.random() * 1e9))} title="Cambiar aspecto">
                <AvatarFace avatar={av} size={72} />
                <span className="tiny">🎲 cambiar</span>
              </button>
              <div className="col grow">
                <label className="field">
                  <span>Tu nombre</span>
                  <input value={titular} onChange={(e) => setTitular(e.target.value)} placeholder="Cr. Juan Pérez" maxLength={40} />
                </label>
                <label className="field">
                  <span>Nombre del estudio</span>
                  <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={40} />
                </label>
              </div>
            </div>
            <div className="field">
              <span>Tu especialidad</span>
              <Segmented<Area>
                value={esp}
                onChange={setEsp}
                options={[
                  { v: 'impuestos', label: '🧾 Impuestos' },
                  { v: 'sueldos', label: '💵 Sueldos' },
                  { v: 'contabilidad', label: '📚 Contabilidad' },
                ]}
              />
            </div>
            <div className="field">
              <span>Dificultad</span>
              <Segmented<Dificultad>
                value={dif}
                onChange={setDif}
                options={(Object.keys(DIFICULTAD) as Dificultad[]).map((k) => ({ v: k, label: DIFICULTAD[k].label }))}
              />
              <span className="tiny muted">{DIFICULTAD[dif].descripcion}</span>
            </div>
            <div className="row mt">
              <button type="button" className="btn ghost" onClick={() => setModo('menu')}>
                Volver
              </button>
              <div className="spacer" />
              <button type="submit" className="btn primary">
                Abrir el estudio →
              </button>
            </div>
          </form>
        )}
      </div>
      <AudioControls variant="floating" />
      <p className="title-foot tiny">Simulación con fines educativos y de entretenimiento. Valores de juego: no constituyen asesoramiento profesional.</p>
    </div>
  );
}
