// Tablero Be OnlyOne: la versión real del tablero del titular, con el look del juego.
import { useEffect, useState } from 'react';
import { fechaLarga } from '../engine/calendar';
import { moneyShort } from '../engine/format';
import { useGame } from '../store/game';
import { Toasts } from '../ui/components';
import { Tablero } from '../ui/screens/Tablero';
import type { Entidad } from './model';
import { Agenda } from './screens/Agenda';
import { Cargar } from './screens/Cargar';
import { Config } from './screens/Config';
import { instalarSincroniaObjetivos, useReal } from './store';

type RTab = 'tablero' | 'agenda' | 'cargar' | 'config';
const TABS: { id: RTab; icon: string; label: string }[] = [
  { id: 'tablero', icon: '📊', label: 'Tablero' },
  { id: 'agenda', icon: '📅', label: 'Agenda' },
  { id: 'cargar', icon: '🗂️', label: 'Cargar datos' },
  { id: 'config', icon: '⚙️', label: 'Configuración' },
];

export function RealApp() {
  const { data, cargando, init, modo } = useReal();
  const g = useGame((s) => s.game);
  const [tab, setTab] = useState<RTab>('tablero');
  const [abrir, setAbrir] = useState<{ ent: Entidad; id?: string } | null>(null);

  useEffect(() => {
    void init();
    const off = instalarSincroniaObjetivos();
    // los clics del Tablero del juego (cliente / persona / "ir a tareas") se redirigen a las pantallas reales
    const off2 = useGame.subscribe((s, prev) => {
      if (s.clientModalId && s.clientModalId !== prev.clientModalId) {
        setAbrir({ ent: 'clientes', id: s.clientModalId });
        setTab('cargar');
        useGame.setState({ clientModalId: undefined });
      }
      if (s.workerModalId && s.workerModalId !== prev.workerModalId) {
        const id = s.workerModalId === 'player' ? useReal.getState().data.equipo.find((p) => p.rol === 'titular')?.id : s.workerModalId;
        setAbrir({ ent: 'equipo', id });
        setTab('cargar');
        useGame.setState({ workerModalId: undefined });
      }
      if (s.tab !== prev.tab && s.tab === 'tareas') {
        setTab('agenda');
        useGame.setState({ tab: 'tablero' });
      }
    });
    return () => {
      off();
      off2();
    };
  }, [init]);

  const vacio = !data.clientes.length && !data.equipo.length;
  const hoy = g?.date ?? new Date().toISOString().slice(0, 10);

  return (
    <div className="game real">
      <header className="topbar">
        <div className="tb-brand">
          <span className="tb-logo" aria-hidden>📒</span>
          <div className="tb-names">
            <b>{data.config.nombreEstudio || 'Tablero'}</b>
            <span>{data.config.titular}{modo === 'nube' ? ' · guardado en el artefacto' : modo === 'local' ? ' · guardado en este navegador' : ''}</span>
          </div>
        </div>
        <div className="tb-clock">
          <span className="tb-date">{fechaLarga(hoy)}</span>
        </div>
        <div className="tb-stats">
          <div className={`tb-stat caja ${(g?.estudio.caja ?? 0) < 0 ? 'neg' : ''}`} title="Caja estimada hoy">
            <span aria-hidden>💰</span>
            <b className="mono">{moneyShort(g?.estudio.caja ?? 0)}</b>
          </div>
          <div className="tb-stat" title="Clientes activos">
            <span aria-hidden>🤝</span>
            <b>{data.clientes.filter((c) => c.estado === 'activo').length}</b>
          </div>
        </div>
      </header>
      <nav className="tabs" aria-label="Secciones">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)} aria-current={tab === t.id ? 'page' : undefined}>
            <span className="tab-icon" aria-hidden>{t.icon}</span>
            <span className="tab-label">{t.label}</span>
          </button>
        ))}
      </nav>
      <main className="panel">
        {cargando || !g ? (
          <p className="muted">Cargando…</p>
        ) : tab === 'tablero' ? (
          vacio ? (
            <div className="screen">
              <div className="card bienvenida">
                <h2>📒 Tablero del titular</h2>
                <p>Acá vas a ver cumplimiento, capacidad de la semana, flujo de fondos a 90 días, rentabilidad por cliente, riesgo, equipo y objetivos. Todo se calcula con lo que cargues; los datos quedan guardados en este artefacto.</p>
                <ol className="small">
                  <li><b>Equipo</b>: cargate vos (rol Titular) y a tu gente, con costo mensual y horas semanales.</li>
                  <li><b>Clientes</b>: a mano o pegando un CSV exportado de Odoo/Excel. Después, en Vencimientos, <b>Generar</b> el mes.</li>
                  <li><b>Gastos recurrentes, facturas y cobros</b> del mes; <b>horas</b> por cliente a medida que trabajás.</li>
                </ol>
                <button className="btn primary" onClick={() => setTab('cargar')}>Empezar a cargar →</button>
              </div>
            </div>
          ) : (
            <Tablero />
          )
        ) : tab === 'agenda' ? (
          <Agenda />
        ) : tab === 'cargar' ? (
          <Cargar entidadInicial={abrir?.ent} editarId={abrir?.id} onConsumido={() => setAbrir(null)} />
        ) : (
          <Config />
        )}
      </main>
      <Toasts />
    </div>
  );
}
