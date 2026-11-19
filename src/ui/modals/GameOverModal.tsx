import { fechaLarga } from '../../engine/calendar';
import { money } from '../../engine/format';
import * as save from '../../engine/save';
import { useGame } from '../../store/game';
import { Modal, Stat } from '../components';

export function GameOverModal() {
  const g = useGame((s) => s.game)!;
  const salir = useGame((s) => s.salir);
  const go = g.gameOver!;
  const icon = go.motivo === 'quiebra' ? '📉' : go.motivo === 'matricula' ? '⚖️' : '🫥';
  return (
    <Modal label="Fin del juego">
      <div className="event anim-pop">
        <div className="event-icon">{icon}</div>
        <h2>Fin de la partida</h2>
        <p className="event-text">{go.texto}</p>
        <p className="small muted">{fechaLarga(go.date)}</p>
        <div className="stats-grid mt">
          <Stat label="Presentadas a tiempo" value={g.stats.presentadasATiempo} />
          <Stat label="Presentadas tarde" value={g.stats.presentadasTarde} />
          <Stat label="Clientes ganados" value={g.stats.clientesGanados} />
          <Stat label="Mejor caja" value={money(g.stats.mejorCaja)} />
        </div>
        <button
          className="btn primary mt"
          onClick={() => {
            save.borrar();
            salir();
          }}
        >
          Volver al menú
        </button>
      </div>
    </Modal>
  );
}
