import { useEffect, useRef } from 'react';
import { useGameAudio } from '../audio/useGameAudio';
import { MS_POR_HORA } from '../engine/config';
import * as cloud from '../engine/cloud';
import * as save from '../engine/save';
import { OfficeScene } from '../scene/OfficeScene';
import { useGame, type Tab } from '../store/game';
import { noLeidos, pendientes, Toasts } from './components';
import { ClientModal } from './modals/ClientModal';
import { EventModal } from './modals/EventModal';
import { GameOverModal } from './modals/GameOverModal';
import { IntroModal } from './modals/IntroModal';
import { MinigameModal } from './modals/MinigameModal';
import { WorkerModal } from './modals/WorkerModal';
import { Bandeja } from './screens/Bandeja';
import { Clientes } from './screens/Clientes';
import { Equipo } from './screens/Equipo';
import { Escritorio } from './screens/Escritorio';
import { Finanzas } from './screens/Finanzas';
import { Herramientas } from './screens/Herramientas';
import { Tareas } from './screens/Tareas';
import { TopBar } from './TopBar';

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'escritorio', icon: '🏠', label: 'Escritorio' },
  { id: 'tareas', icon: '📅', label: 'Tareas' },
  { id: 'clientes', icon: '🤝', label: 'Clientes' },
  { id: 'equipo', icon: '👥', label: 'Equipo' },
  { id: 'herramientas', icon: '🤖', label: 'Herramientas' },
  { id: 'finanzas', icon: '💰', label: 'Finanzas' },
  { id: 'bandeja', icon: '📥', label: 'Bandeja' },
];

export function GameScreen() {
  const g = useGame((s) => s.game)!;
  const tab = useGame((s) => s.tab);
  const setTab = useGame((s) => s.setTab);
  const tick = useGame((s) => s.tick);
  const minigame = useGame((s) => s.minigameTaskId);
  const workerModal = useGame((s) => s.workerModalId);
  const clientModal = useGame((s) => s.clientModalId);
  const showIntro = useGame((s) => s.showIntro);
  const openWorker = useGame((s) => s.openWorker);
  const togglePause = useGame((s) => s.togglePause);
  const setSpeed = useGame((s) => s.setSpeed);

  const bloqueado = g.events.length > 0 || !!minigame || !!g.gameOver || showIntro;
  useGameAudio(g, bloqueado);

  // bucle de juego
  useEffect(() => {
    if (g.speed === 0 || bloqueado) return;
    const id = window.setInterval(() => tick(), MS_POR_HORA[g.speed as 1 | 2 | 3]);
    return () => window.clearInterval(id);
  }, [g.speed, bloqueado, tick]);

  // autoguardado: local cada día de juego; en la nube como mucho cada 45 s reales
  const ultimaNube = useRef(Date.now());
  useEffect(() => {
    save.guardar(g);
    if (Date.now() - ultimaNube.current > 45_000) {
      ultimaNube.current = Date.now();
      void cloud.cloudGuardar(g);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g.date]);

  // atajos de teclado
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.code === 'Space') {
        e.preventDefault();
        togglePause();
      } else if (['Digit1', 'Digit2', 'Digit3'].includes(e.code)) setSpeed(Number(e.code.slice(5)) as 1 | 2 | 3);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [togglePause, setSpeed]);

  const badges: Partial<Record<Tab, number>> = {
    tareas: pendientes(g).filter((t) => t.vence <= g.date).length || undefined,
    clientes: g.prospects.length || undefined,
    bandeja: noLeidos(g) || undefined,
  };

  return (
    <div className="game">
      <TopBar />
      <div className="scene-wrap">
        <OfficeScene state={g} onWorkerClick={(id) => openWorker(id)} onDoorClick={() => setTab('clientes')} onCalendarClick={() => setTab('tareas')} />
        {g.speed === 0 && !bloqueado && (
          <button className="paused-badge" onClick={togglePause}>
            ⏸ En pausa — tocá para seguir
          </button>
        )}
      </div>
      <nav className="tabs" aria-label="Secciones">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)} aria-current={tab === t.id ? 'page' : undefined}>
            <span className="tab-icon" aria-hidden>
              {t.icon}
            </span>
            <span className="tab-label">{t.label}</span>
            {badges[t.id] ? <span className="badge">{badges[t.id]}</span> : null}
          </button>
        ))}
      </nav>
      <main className="panel" key={tab}>
        {tab === 'escritorio' && <Escritorio />}
        {tab === 'tareas' && <Tareas />}
        {tab === 'clientes' && <Clientes />}
        {tab === 'equipo' && <Equipo />}
        {tab === 'herramientas' && <Herramientas />}
        {tab === 'finanzas' && <Finanzas />}
        {tab === 'bandeja' && <Bandeja />}
      </main>
      <Toasts />
      {showIntro && <IntroModal />}
      {!showIntro && g.events.length > 0 && !minigame && <EventModal />}
      {minigame && <MinigameModal />}
      {workerModal && !minigame && <WorkerModal />}
      {clientModal && !minigame && <ClientModal />}
      {g.gameOver && <GameOverModal />}
    </div>
  );
}
