// Conecta el estado del juego con el audio: clima de la música, pausa y efectos por evento.
import { useEffect, useMemo, useRef } from 'react';
import { addBusinessDays } from '../engine/calendar';
import type { FxKind, GameState } from '../engine/types';
import { audio, type Mood, type Sfx } from './audio';

const FX_SFX: Partial<Record<FxKind, Sfx>> = {
  paso_completo: 'blip',
  presentada: 'presentada',
  presentada_tarde: 'tarde',
  error_detectado: 'corregido',
  cobro: 'cobro',
  pago: 'pago',
  multa: 'multa',
  cliente_llega: 'puerta',
  prospecto_llega: 'puerta',
  inspector: 'inspector',
  arca_caida: 'arca',
  contratacion: 'contratacion',
  renuncia: 'renuncia',
  nivel: 'nivel',
  herramienta: 'herramienta',
  idea: 'notificacion',
  logro: 'nivel',
  mision: 'exito',
  racha: 'corregido',
};

// eventos que ya suenan por su FX o que no necesitan sonido propio
const EVENTO_SFX: Record<string, Sfx | null> = {
  inspeccion: null,
  arca_caida: null,
  resultado_inspeccion: 'inspector',
  multa_quien_paga: 'notificacion',
  multas_varias: 'notificacion',
  consulta_cliente: 'telefono',
  dibujar: 'telefono',
  cliente_moroso: 'telefono',
  regalo: 'puerta',
  caja_roja: 'arca',
  pedido_aumento: 'notificacion',
  renuncia: 'renuncia',
  nota_mes: 'notificacion',
};

export function climaDe(g: GameState): Mood {
  const tension =
    g.flags.arcaCaida ||
    g.estudio.caja < 0 ||
    g.events.some((e) => e.defId === 'inspeccion' || e.defId === 'resultado_inspeccion' || e.defId === 'caja_roja') ||
    g.tasks.some((t) => t.estado === 'pendiente' && (t.kind === 'requerimiento' || t.vence <= g.date));
  if (tension) return 'tension';
  const limite = addBusinessDays(g.date, 2);
  const urgentes = g.tasks.filter((t) => t.estado === 'pendiente' && t.vence <= limite).length;
  return urgentes >= 3 || g.speed === 3 ? 'busy' : 'calm';
}

export function useGameAudio(g: GameState, modalAbierto: boolean): void {
  const mood = useMemo(() => climaDe(g), [g]);
  useEffect(() => audio.setMood(mood), [mood]);
  useEffect(() => audio.setPaused(g.speed === 0), [g.speed]);
  useEffect(() => audio.setDucked(modalAbierto), [modalAbierto]);

  // efectos de la escena (solo los nuevos)
  const lastFx = useRef<number>(g.fxSeq);
  useEffect(() => {
    const nuevos = g.fx.filter((f) => f.id > lastFx.current);
    if (!nuevos.length) return;
    lastFx.current = Math.max(...nuevos.map((f) => f.id));
    const sonados = new Set<Sfx>();
    for (const f of nuevos) {
      const s = FX_SFX[f.kind];
      if (s && !sonados.has(s)) {
        sonados.add(s);
        audio.sfx(s);
      }
    }
  }, [g.fx]);

  // eventos con decisión
  const evId = g.events[0]?.id;
  const evDef = g.events[0]?.defId;
  useEffect(() => {
    if (!evId || !evDef) return;
    const s = evDef in EVENTO_SFX ? EVENTO_SFX[evDef] : 'notificacion';
    if (s) audio.sfx(s);
  }, [evId, evDef]);
}
