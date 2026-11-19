// Voces humanas: dentro de claude.ai usa la capability `tts` (voces de Claude); afuera, la voz del
// sistema (Web Speech API) en castellano. Si no hay ninguna, no pasa nada.
import { audio } from './audio';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Tts = { speak: (t: string | { text: string; voice?: string }[], o?: Record<string, unknown>) => Promise<void>; stop: () => void; onState?: (fn: (e: { state: string }) => void) => void };

let ttsP: Promise<Tts | null> | null = null;
let hablando = false;
let ultima = 0;
let colaPendiente: string | null = null;

function claudeTts(): Promise<Tts | null> {
  if (ttsP) return ttsP;
  const w = window as any;
  if (typeof w.claude?.use !== 'function') return (ttsP = Promise.resolve(null));
  const pr: Promise<Tts | null> = w.claude
    .use('tts')
    .then((t: Tts | null) => t ?? null)
    .catch(() => null);
  ttsP = pr;
  return pr;
}

export type VozPersona = 'cliente_f' | 'cliente_m' | 'inspector' | 'sistema' | 'titular';
const VOZ_CLAUDE: Record<VozPersona, string> = { cliente_f: 'airy', cliente_m: 'rounded', inspector: 'glassy', sistema: 'buttery', titular: 'buttery' };

function vozSistema(persona: VozPersona): SpeechSynthesisVoice | undefined {
  const voces = window.speechSynthesis?.getVoices?.() ?? [];
  const es = voces.filter((v) => /^es/i.test(v.lang));
  if (!es.length) return undefined;
  const ar = es.filter((v) => /AR/i.test(v.lang));
  const pool = ar.length ? ar : es;
  // intentar alternar voces por persona
  const idx = { cliente_f: 0, cliente_m: 1, inspector: 2, sistema: 0, titular: 1 }[persona];
  return pool[idx % pool.length];
}

export function vocesDisponibles(): boolean {
  const w = window as any;
  return typeof w.claude?.use === 'function' || !!window.speechSynthesis;
}

/** Dice una frase (si las voces están habilitadas). Las frases se espacian para no abrumar. */
export async function hablar(texto: string, persona: VozPersona = 'sistema', opts: { prioridad?: boolean } = {}): Promise<void> {
  if (!audio.getPrefs().voces) return;
  const ahora = Date.now();
  if (!opts.prioridad && (hablando || ahora - ultima < 2500)) {
    colaPendiente = texto;
    return;
  }
  ultima = ahora;
  hablando = true;
  audio.setDucked(true);
  try {
    const t = await claudeTts();
    if (t) {
      try {
        await t.speak(texto, { voice: VOZ_CLAUDE[persona], language: 'es', rate: 1.05 });
      } catch {
        /* not_granted / busy / etc.: silencio */
      }
    } else if (window.speechSynthesis) {
      await new Promise<void>((res) => {
        const u = new SpeechSynthesisUtterance(texto);
        const v = vozSistema(persona);
        if (v) u.voice = v;
        u.lang = v?.lang ?? 'es-AR';
        u.rate = persona === 'inspector' ? 0.92 : 1.02;
        u.pitch = persona === 'cliente_f' ? 1.15 : persona === 'inspector' ? 0.85 : 1;
        u.onend = () => res();
        u.onerror = () => res();
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
        setTimeout(res, 12_000);
      });
    }
  } finally {
    hablando = false;
    audio.setDucked(false);
    if (colaPendiente) {
      const p = colaPendiente;
      colaPendiente = null;
      setTimeout(() => void hablar(p, 'sistema'), 400);
    }
  }
}

export function callar(): void {
  colaPendiente = null;
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* nada */
  }
  void claudeTts().then((t) => t?.stop());
}

// precargar voces del sistema (Chrome las carga async)
try {
  window.speechSynthesis?.getVoices();
  window.speechSynthesis?.addEventListener?.('voiceschanged', () => window.speechSynthesis.getVoices());
} catch {
  /* nada */
}
