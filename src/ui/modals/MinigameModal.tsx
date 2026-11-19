import * as A from '../../engine/actions';
import { hashSeed } from '../../engine/rng';
import { MINIGAMES } from '../../minigames/registry';
import { useGame } from '../../store/game';
import { Modal } from '../components';

export function MinigameModal() {
  const g = useGame((s) => s.game)!;
  const id = useGame((s) => s.minigameTaskId);
  const close = useGame((s) => s.openMinigame);
  const act = useGame((s) => s.act);
  const toast = useGame((s) => s.toast);
  const t = g.tasks.find((x) => x.id === id);
  const c = t ? g.clients.find((x) => x.id === t.clientId) : undefined;
  if (!t || !c || !t.minigame) return null;
  const mg = MINIGAMES[t.minigame];
  const { Component } = mg;
  return (
    <Modal full label={mg.meta.titulo}>
      <Component
        task={t}
        client={c}
        seed={hashSeed(t.id + t.periodo)}
        indice={g.inflacion.indice}
        onCancel={() => close(undefined)}
        onComplete={(r) => {
          act((d) => A.completarMinijuego(d, t.id, r.score, mg.meta.horas), { silent: true });
          toast(r.score >= 0.95 ? `🎯 ${r.resumen}` : `📝 ${r.resumen}`, r.score >= 0.95 ? 'ok' : r.score >= 0.7 ? 'info' : 'warn');
          close(undefined);
        }}
      />
    </Modal>
  );
}
