import { useEffect, useRef, useState } from 'react';
import { AudioControls } from '../audio/AudioControls';
import { fechaLarga, feriadoNombre } from '../engine/calendar';
import { NIVELES } from '../engine/config';
import { moneyShort, pct } from '../engine/format';
import * as cloud from '../engine/cloud';
import * as save from '../engine/save';
import { useGame } from '../store/game';

export function TopBar() {
  const g = useGame((s) => s.game)!;
  const setSpeed = useGame((s) => s.setSpeed);
  const salir = useGame((s) => s.salir);
  const toast = useGame((s) => s.toast);
  const setIntro = useGame((s) => s.setIntro);
  const [menu, setMenu] = useState(false);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  const prevCaja = useRef(g.estudio.caja);

  useEffect(() => {
    const prev = prevCaja.current;
    prevCaja.current = g.estudio.caja;
    if (g.estudio.caja === prev) return;
    setFlash(g.estudio.caja > prev ? 'up' : 'down');
    const id = setTimeout(() => setFlash(null), 700);
    return () => clearTimeout(id);
  }, [g.estudio.caja]);

  const nivel = NIVELES[g.estudio.nivel - 1];
  const feriado = feriadoNombre(g.date);
  const hora = `${String(Math.min(g.hour, 20)).padStart(2, '0')}:00`;

  return (
    <header className="topbar">
      <div className="tb-brand">
        <span className="tb-logo" aria-hidden>
          📒
        </span>
        <div className="tb-names">
          <b>{g.estudio.nombre}</b>
          <span>
            Nv {g.estudio.nivel} · {nivel.nombre}
          </span>
        </div>
      </div>

      <div className="tb-clock" title={feriado ?? ''}>
        <span className="tb-time mono">{hora}</span>
        <span className="tb-date">{fechaLarga(g.date)}</span>
      </div>

      <div className="tb-speed" role="group" aria-label="Velocidad">
        {([0, 1, 2, 3] as const).map((n) => (
          <button key={n} className={g.speed === n ? 'on' : ''} onClick={() => setSpeed(n)} title={['Pausa (espacio)', 'Normal (1)', 'Rápido (2)', 'Muy rápido (3)'][n]} aria-pressed={g.speed === n}>
            {['⏸', '▶', '⏩', '⏭'][n]}
          </button>
        ))}
      </div>

      <div className="tb-stats">
        <div className={`tb-stat caja ${g.estudio.caja < 0 ? 'neg' : ''} ${flash ?? ''}`} title="Caja">
          <span aria-hidden>💰</span>
          <b className="mono">{moneyShort(g.estudio.caja)}</b>
        </div>
        <div className="tb-stat" title={`Reputación ${g.estudio.reputacion.toFixed(1)}/100`}>
          <span aria-hidden>⭐</span>
          <b>{Math.round(g.estudio.reputacion)}</b>
        </div>
        <div className="tb-stat hide-sm" title="Inflación del último mes">
          <span aria-hidden>📈</span>
          <b>{pct(g.inflacion.mensual, 1)}</b>
        </div>
      </div>

      <AudioControls />
      <div className="tb-menu">
        <button className="btn ghost sm" onClick={() => setMenu(!menu)} aria-expanded={menu} aria-label="Menú">
          ☰
        </button>
        {menu && (
          <div className="menu-pop" onMouseLeave={() => setMenu(false)}>
            <button
              onClick={async () => {
                setMenu(false);
                const local = save.guardar(g);
                const nube = await cloud.cloudGuardar(g);
                toast(nube ? '☁️ Partida guardada en tu cuenta: seguila desde cualquier dispositivo.' : local ? 'Partida guardada en este navegador.' : 'No se pudo guardar: exportala a un archivo.', nube || local ? 'ok' : 'warn');
              }}
            >
              💾 Guardar
            </button>
            <button
              onClick={async () => {
                setMenu(false);
                toast(await save.exportar(g), 'info');
              }}
            >
              📤 Exportar partida (.json)
            </button>
            <button
              onClick={() => {
                setIntro(true);
                setMenu(false);
              }}
            >
              ❓ Cómo se juega
            </button>
            <button
              onClick={() => {
                setMenu(false);
                salir();
              }}
            >
              🚪 Salir al menú
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
