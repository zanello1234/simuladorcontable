import { useEffect, useMemo } from 'react';
import { hablar } from '../../audio/voice';
import { DialogView } from '../../dialog/DialogView';
import { DIALOGO, opcionesDe } from '../../dialog/dialogs';
import type { DialogState } from '../../dialog/types';
import * as A from '../../engine/actions';
import { makeRng } from '../../engine/rng';
import { useGame } from '../../store/game';
import { Modal } from '../components';

export function DialogModal() {
  const g = useGame((s) => s.game)!;
  const act = useGame((s) => s.act);
  const toast = useGame((s) => s.toast);
  const st = g.dialogo as DialogState | undefined;
  const def = st ? DIALOGO[st.defId] : undefined;
  const c = st ? g.clients.find((x) => x.id === st.clientId) : undefined;
  const titular = g.workers.find((w) => w.id === 'player')!;
  // las opciones se calculan con un rng derivado (solo lectura: el estado real avanza en la acción)
  const opciones = useMemo(() => (st && def ? opcionesDe(st, g, makeRng(g.rngState)) : []), [st, def, g]);
  // voz: la última línea del cliente
  const ultima = st?.historial[st.historial.length - 1];
  useEffect(() => {
    if (!ultima || ultima.quien !== 'cliente' || !c) return;
    const fem = c.avatar.peinado === 'largo' || c.avatar.peinado === 'rodete';
    void hablar(ultima.texto, fem ? 'cliente_f' : 'cliente_m');
  }, [ultima, c]);
  if (!st || !def || !c) return null;
  return (
    <Modal wide label={def.titulo}>
      <DialogView
        state={st}
        def={def}
        client={c}
        titular={titular}
        opciones={opciones}
        onOption={(id) => act((d) => A.responderConversacion(d, id), { silent: true })}
        onClose={() => {
          const r = act((d) => A.cerrarConversacion(d), { silent: true });
          if (r && r.texto) toast(r.texto, 'info');
        }}
      />
    </Modal>
  );
}
