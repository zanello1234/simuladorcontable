import * as A from '../../engine/actions';
import { hashSeed } from '../../engine/rng';
import { Relampago } from '../../minigames/relampago/Relampago';
import { useGame } from '../../store/game';
import { Modal } from '../components';

export function RelampagoModal() {
  const g = useGame((s) => s.game)!;
  const close = useGame((s) => s.openRelampago);
  const act = useGame((s) => s.act);
  return (
    <Modal full label="Despachar la pila">
      <Relampago
        seed={hashSeed(`${g.date}-${g.tick}`)}
        indice={g.inflacion.indice}
        onCancel={() => close(false)}
        onComplete={(r) => {
          act((d) => A.completarRelampago(d, r.aciertos, r.errores));
          close(false);
        }}
      />
    </Modal>
  );
}
