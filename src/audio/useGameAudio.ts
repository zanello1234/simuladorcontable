// Conecta el estado del juego con el audio: clima de la música, pausa y efectos por evento.
import { useEffect, useMemo, useRef } from 'react';
import { addBusinessDays } from '../engine/calendar';
import type { FxKind, GameState } from '../engine/types';
import { audio, type Mood, type Sfx } from './audio';
import { hablar, type VozPersona } from './voice';

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

  // eventos con decisión (+ voz)
  const evId = g.events[0]?.id;
  const evDef = g.events[0]?.defId;
  const evTitulo = g.events[0]?.titulo;
  const evCliente = g.events[0]?.clientId;
  useEffect(() => {
    if (!evId || !evDef) return;
    const s = evDef in EVENTO_SFX ? EVENTO_SFX[evDef] : 'notificacion';
    if (s) audio.sfx(s);
    const c = g.clients.find((x) => x.id === evCliente);
    const vozCliente: VozPersona = c?.avatar.peinado === 'largo' || c?.avatar.peinado === 'rodete' ? 'cliente_f' : 'cliente_m';
    const frase = fraseEvento(evDef, evTitulo ?? '', c?.nombre.split(' (')[0]);
    if (frase) void hablar(frase.texto, frase.persona === 'cliente' ? vozCliente : frase.persona);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evId, evDef]);
}

function fraseEvento(defId: string, titulo: string, cliente?: string): { texto: string; persona: VozPersona | 'cliente' } | null {
  switch (defId) {
    case 'inspeccion':
      return { texto: `Buenos días. Vengo de ARCA. Traigo un requerimiento para ${cliente ?? 'su cliente'}. Tienen diez días hábiles.`, persona: 'inspector' };
    case 'resultado_inspeccion':
      return { texto: 'Concluida la verificación, se detectaron inconsistencias en las declaraciones juradas. Corresponde ajuste.', persona: 'inspector' };
    case 'multa_quien_paga':
    case 'multas_varias':
      return { texto: '¿Cómo que hay una multa? ¡Vos tenías que avisarme!', persona: 'cliente' };
    case 'consulta_cliente':
      return { texto: `Hola, soy ${cliente ?? 'tu cliente'}. Te hago una consulta rápida, ¿tenés un minuto?`, persona: 'cliente' };
    case 'dibujar':
      return { texto: 'Dale, dibujame un poco los números. Nadie se va a dar cuenta.', persona: 'cliente' };
    case 'cliente_moroso':
      return { texto: 'Sí, sí, la semana que viene te transfiero, sin falta.', persona: 'cliente' };
    case 'arca_caida':
      return { texto: 'Atención: la página de ARCA no responde y hoy hay vencimientos.', persona: 'sistema' };
    case 'nota_mes':
      return { texto: titulo.replace('Cierre de', 'Cierre del mes.').replace(': nota', '. Nota'), persona: 'sistema' };
    case 'renuncia':
      return { texto: 'Me ofrecieron algo mejor. Lo pensé mucho, pero presento la renuncia.', persona: 'cliente' };
    case 'pedido_aumento':
      return { texto: 'Con esta inflación no llego a fin de mes. Necesito un aumento.', persona: 'cliente' };
    case 'regalo':
      return { texto: '¡Pasé a dejarles algo! Gracias por bancarme siempre.', persona: 'cliente' };
    case 'caja_roja':
      return { texto: 'Alerta: la caja del estudio está en rojo.', persona: 'sistema' };
    default:
      return null;
  }
}
