import { useGame } from '../../store/game';
import { Modal } from '../components';
import { WorkerCard } from '../WorkerCard';

export function WorkerModal() {
  const g = useGame((s) => s.game)!;
  const id = useGame((s) => s.workerModalId);
  const close = useGame((s) => s.openWorker);
  const w = g.workers.find((x) => x.id === id);
  if (!w) return null;
  return (
    <Modal onClose={() => close(undefined)} label={w.nombre}>
      <div className="modal-pad">
        <WorkerCard w={w} full />
        <button className="btn block mt" onClick={() => close(undefined)}>
          Cerrar
        </button>
      </div>
    </Modal>
  );
}
