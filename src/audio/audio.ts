// =============================================================================
// Audio procedural (Web Audio API): música de fondo y efectos, sin archivos externos.
//
// Música: loop de "milonga lounge" en La menor (bajo en tresillo 3-3-2, marcato de
// bandoneón sintetizado, melodía generada con variaciones y percusión suave). El clima
// cambia con el juego: menú → tranqui → apurado → tensión (vencimientos, inspección).
// =============================================================================

export type Mood = 'menu' | 'calm' | 'busy' | 'tension';
export type Sfx =
  | 'click'
  | 'blip'
  | 'presentada'
  | 'tarde'
  | 'cobro'
  | 'pago'
  | 'multa'
  | 'puerta'
  | 'inspector'
  | 'arca'
  | 'contratacion'
  | 'renuncia'
  | 'nivel'
  | 'herramienta'
  | 'corregido'
  | 'telefono'
  | 'exito'
  | 'fallo'
  | 'notificacion';

export interface AudioPrefs {
  musica: boolean;
  efectos: boolean;
  voces: boolean;
  volMusica: number; // 0..1
  volEfectos: number; // 0..1
}

const PREFS_KEY = 'partida-doble:audio';
const DEFAULT_PREFS: AudioPrefs = { musica: true, efectos: true, voces: true, volMusica: 0.45, volEfectos: 0.7 };

const mtof = (m: number) => 440 * 2 ** ((m - 69) / 12);
/** ganancia de mezcla de cada bus (el compresor del master contiene los picos) */
const MUSIC_GAIN = 1.8;
const SFX_GAIN = 3;

// ----------------------------------------------------------------------------- armonía

interface Chord {
  root: number; // midi del bajo
  tones: number[]; // voces medias
  scale: number[]; // notas posibles para la melodía (midi, octava 5)
}
const A_MENOR_ARM = [69, 71, 72, 74, 76, 77, 80, 81]; // la menor armónica
const CH: Record<string, Chord> = {
  Am: { root: 45, tones: [57, 60, 64], scale: [69, 72, 76, 81, 71, 74] },
  Dm: { root: 50, tones: [57, 62, 65], scale: [69, 74, 77, 81, 72, 76] },
  G7: { root: 43, tones: [59, 62, 65], scale: [71, 74, 77, 79, 72, 76] },
  Cmaj7: { root: 48, tones: [59, 64, 67], scale: [72, 76, 79, 71, 74, 81] },
  Fmaj7: { root: 41, tones: [57, 60, 64], scale: [69, 72, 77, 76, 74, 81] },
  Dm7: { root: 50, tones: [57, 60, 65], scale: [69, 72, 74, 77, 76, 81] },
  E7: { root: 40, tones: [56, 62, 64], scale: [68, 71, 74, 76, 77, 80] },
  Bb: { root: 46, tones: [58, 62, 65], scale: [70, 74, 77, 69, 72, 76] },
  F: { root: 41, tones: [57, 60, 65], scale: [69, 72, 77, 74, 76, 81] },
};
const PROGRESIONES: Record<Mood, string[]> = {
  menu: ['Am', 'Dm', 'G7', 'Cmaj7', 'Fmaj7', 'Dm7', 'E7', 'Am'],
  calm: ['Am', 'Dm', 'G7', 'Cmaj7', 'Fmaj7', 'Dm7', 'E7', 'Am'],
  busy: ['Am', 'Dm', 'G7', 'Cmaj7', 'Fmaj7', 'Dm7', 'E7', 'E7'],
  tension: ['Am', 'Bb', 'E7', 'Am', 'Dm', 'Bb', 'E7', 'E7'],
};
const TEMPO: Record<Mood, number> = { menu: 84, calm: 94, busy: 106, tension: 116 };

// patrones rítmicos de melodía (posiciones en semicorcheas dentro del compás)
const RITMOS = [
  [0, 3, 6, 8, 12],
  [0, 2, 4, 7, 8, 11, 12],
  [2, 3, 6, 10, 11, 14],
  [0, 6, 8, 10, 12, 14],
  [0, 3, 4, 6, 8],
  [4, 6, 7, 8, 12, 14],
];

// ----------------------------------------------------------------------------- motor

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private musicFilter!: BiquadFilterNode;
  private sfxBus!: GainNode;
  private noise!: AudioBuffer;
  private prefs: AudioPrefs = { ...DEFAULT_PREFS };
  private mood: Mood = 'menu';
  private paused = false;
  private ducked = false;
  private timer: number | null = null;
  private nextTime = 0;
  private step = 0;
  private melodia = new Map<number, { t: number; midi: number; dur: number }[]>();
  private ultimaNota = 76;
  private seed = 1;
  private lastSfx = new Map<Sfx, number>();
  private listeners = new Set<() => void>();

  constructor() {
    this.prefs = cargarPrefs();
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (!this.ctx) return;
        if (document.hidden) void this.ctx.suspend();
        else void this.ctx.resume();
      });
    }
  }

  // ---------------------------------------------------------------- estado público
  getPrefs = () => this.prefs;
  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }
  setPrefs(p: Partial<AudioPrefs>) {
    this.prefs = { ...this.prefs, ...p };
    guardarPrefs(this.prefs);
    this.aplicarVolumen();
    if (this.prefs.musica) this.startMusic();
    else this.stopMusic();
    this.listeners.forEach((l) => l());
  }

  /** Llamar desde un gesto del usuario (click / tecla): crea o reanuda el contexto. */
  unlock() {
    try {
      if (!this.ctx) this.init();
      if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
      if (this.prefs.musica) this.startMusic();
    } catch {
      /* sin audio */
    }
  }

  setMood(m: Mood) {
    this.mood = m;
  }
  setPaused(p: boolean) {
    if (this.paused === p) return;
    this.paused = p;
    this.aplicarVolumen();
  }
  setDucked(d: boolean) {
    if (this.ducked === d) return;
    this.ducked = d;
    this.aplicarVolumen();
  }

  // ---------------------------------------------------------------- init
  private init() {
    const AC: typeof AudioContext | undefined = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    this.musicFilter = ctx.createBiquadFilter();
    this.musicFilter.type = 'lowpass';
    this.musicFilter.frequency.value = 18000;
    this.musicBus = ctx.createGain();
    this.musicBus.connect(this.musicFilter).connect(this.master);
    this.sfxBus = ctx.createGain();
    this.sfxBus.connect(this.master);
    this.noise = crearRuido(ctx);
    this.aplicarVolumen(true);
  }

  private aplicarVolumen(inmediato = false) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const k = inmediato ? 0.01 : 0.25;
    let vm = this.prefs.musica ? this.prefs.volMusica * MUSIC_GAIN : 0;
    if (this.paused) vm *= 0.45;
    if (this.ducked) vm *= 0.5;
    this.musicBus.gain.setTargetAtTime(vm, t, k);
    this.musicFilter.frequency.setTargetAtTime(this.paused ? 900 : 18000, t, k);
    this.sfxBus.gain.setTargetAtTime(this.prefs.efectos ? this.prefs.volEfectos * SFX_GAIN : 0, t, 0.02);
  }

  // ---------------------------------------------------------------- música
  private startMusic() {
    if (!this.ctx || this.timer !== null) return;
    this.nextTime = this.ctx.currentTime + 0.12;
    this.step = 0;
    this.melodia.clear();
    this.timer = window.setInterval(() => this.scheduler(), 25);
  }
  private stopMusic() {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }
  private scheduler() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    while (this.nextTime < this.ctx.currentTime + 0.15) {
      tocarPaso(this.ctx, this.musicBus, this.noise, this.mood, this.step, this.nextTime, this);
      this.nextTime += 60 / TEMPO[this.mood] / 4;
      this.step += 1;
    }
  }

  /** Genera (y cachea) la melodía de un compás. Pública para el render offline de tests. */
  melodiaDe(compas: number, chord: Chord, mood: Mood): { t: number; midi: number; dur: number }[] {
    const hit = this.melodia.get(compas);
    if (hit) return hit;
    this.seed = (this.seed * 1103515245 + 12345 + compas * 7919) >>> 0;
    const rnd = () => {
      this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
      return this.seed / 4294967296;
    };
    const frase = Math.floor(compas / 8);
    // pregunta y respuesta: en tranqui, la melodía descansa una vuelta de cada dos
    const descansa = (mood === 'calm' && frase % 2 === 1) || (mood === 'menu' && frase % 2 === 0 && compas % 8 < 4);
    const out: { t: number; midi: number; dur: number }[] = [];
    if (!descansa) {
      const ritmo = RITMOS[Math.floor(rnd() * RITMOS.length)];
      for (let i = 0; i < ritmo.length; i++) {
        const pos = ritmo[i];
        const fuerte = pos % 4 === 0;
        const cands = fuerte ? chord.scale.slice(0, 3) : chord.scale.concat(A_MENOR_ARM);
        let best = cands[0];
        let bestD = Infinity;
        for (const c of cands) {
          const d = Math.abs(c - this.ultimaNota) + rnd() * 5;
          if (d < bestD && d > 0.5) {
            bestD = d;
            best = c;
          }
        }
        this.ultimaNota = best;
        const sig = ritmo[i + 1] ?? 16;
        out.push({ t: pos, midi: best, dur: Math.min(4, sig - pos) });
      }
    }
    this.melodia.set(compas, out);
    if (this.melodia.size > 64) this.melodia.delete(this.melodia.keys().next().value as number);
    return out;
  }

  // ---------------------------------------------------------------- efectos
  sfx(name: Sfx) {
    if (!this.ctx || !this.prefs.efectos || this.ctx.state !== 'running') return;
    const now = performance.now();
    const min = name === 'click' ? 40 : name === 'blip' ? 140 : 260;
    if (now - (this.lastSfx.get(name) ?? 0) < min) return;
    this.lastSfx.set(name, now);
    tocarSfx(this.ctx, this.sfxBus, this.noise, name);
  }
}

// ----------------------------------------------------------------------------- instrumentos

type Ctx = BaseAudioContext;

function crearRuido(ctx: Ctx): AudioBuffer {
  const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

interface ToneOpts {
  type?: OscillatorType;
  gain?: number;
  attack?: number;
  release?: number;
  glideTo?: number;
  filter?: number;
  detune?: number;
  vibrato?: number;
}

function tono(ctx: Ctx, out: AudioNode, freq: number, t: number, dur: number, o: ToneOpts = {}): void {
  const osc = ctx.createOscillator();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(freq, t);
  if (o.glideTo) osc.frequency.exponentialRampToValueAtTime(o.glideTo, t + dur);
  if (o.detune) osc.detune.value = o.detune;
  const g = ctx.createGain();
  const peak = o.gain ?? 0.1;
  const a = o.attack ?? 0.005;
  const r = o.release ?? dur;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + r);
  let node: AudioNode = osc;
  if (o.filter) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = o.filter;
    osc.connect(f);
    node = f;
  }
  if (o.vibrato) {
    const lfo = ctx.createOscillator();
    const lg = ctx.createGain();
    lfo.frequency.value = 5.2;
    lg.gain.setValueAtTime(0, t);
    lg.gain.linearRampToValueAtTime(o.vibrato, t + 0.18);
    lfo.connect(lg).connect(osc.detune);
    lfo.start(t);
    lfo.stop(t + a + r + 0.05);
  }
  node.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + a + r + 0.05);
}

function ruido(ctx: Ctx, out: AudioNode, buf: AudioBuffer, t: number, dur: number, o: { gain: number; tipo: BiquadFilterType; freq: number; freqTo?: number; q?: number }): void {
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = o.tipo;
  f.frequency.setValueAtTime(o.freq, t);
  if (o.freqTo) f.frequency.exponentialRampToValueAtTime(o.freqTo, t + dur);
  if (o.q) f.Q.value = o.q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(o.gain, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(out);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.02);
}

/** Campana: fundamental + parcial inarmónico. */
function campana(ctx: Ctx, out: AudioNode, midi: number, t: number, gain = 0.08, dur = 0.9): void {
  const f = mtof(midi);
  tono(ctx, out, f, t, dur, { gain, release: dur });
  tono(ctx, out, f * 2.76, t, dur * 0.5, { gain: gain * 0.35, release: dur * 0.5 });
  tono(ctx, out, f * 5.4, t, dur * 0.25, { gain: gain * 0.15, release: dur * 0.25 });
}

/** Acorde staccato tipo bandoneón: dos sierras desafinadas por nota, filtradas. */
function bandoneon(ctx: Ctx, out: AudioNode, notas: number[], t: number, dur: number, gain: number): void {
  for (const n of notas) {
    tono(ctx, out, mtof(n), t, dur, { type: 'sawtooth', gain, attack: 0.012, release: dur, filter: 1500, detune: -7 });
    tono(ctx, out, mtof(n), t, dur, { type: 'sawtooth', gain: gain * 0.8, attack: 0.012, release: dur, filter: 1500, detune: 7 });
  }
}

function bombo(ctx: Ctx, out: AudioNode, t: number, gain: number): void {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.frequency.setValueAtTime(115, t);
  osc.frequency.exponentialRampToValueAtTime(44, t + 0.14);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
  osc.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + 0.3);
}

function tocarPaso(ctx: Ctx, out: AudioNode, noise: AudioBuffer, mood: Mood, step: number, t: number, eng: { melodiaDe: AudioEngine['melodiaDe'] }): void {
  const prog = PROGRESIONES[mood];
  const compas = Math.floor(step / 16);
  const s = step % 16;
  const ch = CH[prog[compas % prog.length]];
  const sp = 60 / TEMPO[mood] / 4; // duración de una semicorchea
  const tension = mood === 'tension';
  const movido = mood === 'busy' || tension;

  // bajo: tresillo de milonga (3-3-2) o corcheas insistentes en tensión
  if (tension) {
    if (s % 2 === 0) tono(ctx, out, mtof(s % 4 === 0 ? ch.root : ch.root + 7), t, sp * 1.6, { type: 'triangle', gain: 0.2, release: sp * 1.6, filter: 700 });
  } else {
    const bajo: Record<number, number> = { 0: ch.root, 3: ch.root + 7, 6: ch.root + 12, 8: ch.root, 11: ch.root + 7, 14: ch.root + 5 };
    if (bajo[s] !== undefined) {
      tono(ctx, out, mtof(bajo[s]), t, sp * 2.6, { type: 'triangle', gain: 0.22, release: sp * 2.6, filter: 650 });
      tono(ctx, out, mtof(bajo[s] - 12), t, sp * 2.2, { gain: 0.1, release: sp * 2.2 });
    }
  }

  // marcato del bandoneón
  if (mood === 'menu' || mood === 'calm') {
    if (s === 0 || s === 8) tono(ctx, out, mtof(ch.tones[1]), t, sp * 7, { type: 'triangle', gain: 0.028, attack: 0.25, release: sp * 7 });
    if (s === 4 || s === 12) bandoneon(ctx, out, ch.tones, t, sp * 1.2, 0.016);
  } else {
    if (s % 4 === 0) bandoneon(ctx, out, ch.tones, t, sp * 1.3, s % 8 === 0 ? 0.022 : 0.016);
    if (tension && s === 15) bandoneon(ctx, out, ch.tones.map((n) => n + 1), t, sp * 0.8, 0.012); // arrastre
  }

  // percusión
  if (mood !== 'menu') {
    if (s === 0 || s === 8) bombo(ctx, out, t, movido ? 0.32 : 0.22);
    if (s % 4 === 2) ruido(ctx, out, noise, t, 0.045, { gain: 0.05, tipo: 'highpass', freq: 7000 });
    if (movido && s % 2 === 1) ruido(ctx, out, noise, t, 0.03, { gain: 0.022, tipo: 'highpass', freq: 9000 });
    if (s === 3 || s === 11) tono(ctx, out, 1250, t, 0.05, { gain: 0.035, release: 0.05 }); // clave
  }

  // melodía (violín/flauta sintetizada)
  const mel = eng.melodiaDe(compas, ch, mood);
  for (const n of mel) {
    if (n.t !== s) continue;
    const dur = n.dur * sp * 0.92;
    tono(ctx, out, mtof(n.midi), t, dur, { type: 'triangle', gain: tension ? 0.075 : 0.065, attack: 0.025, release: dur, vibrato: 9 });
    tono(ctx, out, mtof(n.midi + 12), t, dur * 0.6, { gain: 0.012, attack: 0.02, release: dur * 0.6 });
  }
}

function tocarSfx(ctx: Ctx, out: AudioNode, noise: AudioBuffer, name: Sfx): void {
  const t = ctx.currentTime + 0.01;
  switch (name) {
    case 'click':
      tono(ctx, out, 1900, t, 0.025, { gain: 0.035, release: 0.025 });
      break;
    case 'blip':
      tono(ctx, out, 880, t, 0.08, { gain: 0.05, glideTo: 1320, release: 0.08 });
      break;
    case 'presentada':
      ruido(ctx, out, noise, t, 0.32, { gain: 0.07, tipo: 'bandpass', freq: 500, freqTo: 4000, q: 1.2 });
      campana(ctx, out, 88, t + 0.24, 0.06, 0.7);
      campana(ctx, out, 95, t + 0.32, 0.045, 0.8);
      break;
    case 'tarde':
      ruido(ctx, out, noise, t, 0.3, { gain: 0.06, tipo: 'bandpass', freq: 500, freqTo: 2500, q: 1.2 });
      campana(ctx, out, 72, t + 0.24, 0.06, 0.8);
      tono(ctx, out, mtof(67), t + 0.4, 0.3, { type: 'triangle', gain: 0.04, glideTo: mtof(63), release: 0.3 });
      break;
    case 'cobro':
      ruido(ctx, out, noise, t, 0.06, { gain: 0.09, tipo: 'highpass', freq: 3000 });
      campana(ctx, out, 96, t + 0.05, 0.07, 0.5);
      campana(ctx, out, 100, t + 0.11, 0.07, 0.7);
      for (let i = 0; i < 5; i++) tono(ctx, out, 3000 + Math.random() * 2500, t + 0.16 + i * 0.045, 0.06, { gain: 0.025, release: 0.06 });
      break;
    case 'pago':
      tono(ctx, out, 660, t, 0.12, { type: 'triangle', gain: 0.04, release: 0.12 });
      tono(ctx, out, 440, t + 0.1, 0.18, { type: 'triangle', gain: 0.04, release: 0.18 });
      break;
    case 'multa': {
      const notas = [55, 54, 53, 52];
      notas.forEach((n, i) => tono(ctx, out, mtof(n), t + i * 0.24, i === 3 ? 0.7 : 0.22, { type: 'sawtooth', gain: 0.07, attack: 0.03, release: i === 3 ? 0.7 : 0.22, filter: 900, vibrato: i === 3 ? 30 : 0 }));
      break;
    }
    case 'puerta':
      campana(ctx, out, 76, t, 0.07, 0.9);
      campana(ctx, out, 72, t + 0.38, 0.07, 1.1);
      break;
    case 'inspector':
      tono(ctx, out, mtof(33), t, 1.6, { type: 'sawtooth', gain: 0.08, attack: 0.5, release: 1.4, filter: 380 });
      tono(ctx, out, mtof(34), t, 1.6, { type: 'sawtooth', gain: 0.07, attack: 0.5, release: 1.4, filter: 380 });
      tono(ctx, out, 58, t, 0.8, { gain: 0.25, glideTo: 40, release: 0.8 });
      tono(ctx, out, 58, t + 0.55, 0.8, { gain: 0.2, glideTo: 40, release: 0.8 });
      break;
    case 'arca':
      [0, 0.12, 0.24].forEach((d) => tono(ctx, out, d === 0.24 ? 520 : 780, t + d, 0.09, { type: 'square', gain: 0.035, release: 0.09, filter: 2500 }));
      break;
    case 'contratacion':
      [67, 72, 76, 79].forEach((n, i) => tono(ctx, out, mtof(n), t + i * 0.08, 0.2, { type: 'triangle', gain: 0.06, release: 0.2 }));
      bandoneon(ctx, out, [67, 72, 76], t + 0.34, 0.5, 0.025);
      break;
    case 'renuncia':
      tono(ctx, out, mtof(64), t, 0.3, { type: 'triangle', gain: 0.06, release: 0.3 });
      tono(ctx, out, mtof(59), t + 0.28, 0.6, { type: 'triangle', gain: 0.06, release: 0.6, vibrato: 15 });
      break;
    case 'nivel':
      [72, 76, 79, 84].forEach((n, i) => tono(ctx, out, mtof(n), t + i * 0.1, 0.25, { type: 'triangle', gain: 0.07, release: 0.25 }));
      bandoneon(ctx, out, [60, 64, 67, 72], t + 0.42, 1.1, 0.03);
      campana(ctx, out, 96, t + 0.42, 0.06, 1.2);
      ruido(ctx, out, noise, t + 0.42, 1.2, { gain: 0.04, tipo: 'highpass', freq: 6000 });
      break;
    case 'herramienta':
      tono(ctx, out, 220, t, 0.35, { type: 'sawtooth', gain: 0.05, glideTo: 880, release: 0.35, filter: 2200 });
      campana(ctx, out, 93, t + 0.3, 0.05, 0.5);
      campana(ctx, out, 98, t + 0.38, 0.04, 0.6);
      break;
    case 'corregido':
      tono(ctx, out, 1320, t, 0.06, { gain: 0.04, glideTo: 1760, release: 0.06 });
      campana(ctx, out, 93, t + 0.06, 0.05, 0.5);
      break;
    case 'telefono':
      for (const d of [0, 0.55]) {
        for (let i = 0; i < 8; i++) {
          tono(ctx, out, 440, t + d + i * 0.05, 0.045, { gain: 0.03, release: 0.045 });
          tono(ctx, out, 480, t + d + i * 0.05, 0.045, { gain: 0.03, release: 0.045 });
        }
      }
      break;
    case 'exito':
      [72, 76, 79, 84].forEach((n, i) => tono(ctx, out, mtof(n), t + i * 0.07, 0.3, { type: 'triangle', gain: 0.065, release: 0.3 }));
      campana(ctx, out, 96, t + 0.3, 0.06, 0.9);
      break;
    case 'fallo':
      [64, 60, 57].forEach((n, i) => tono(ctx, out, mtof(n), t + i * 0.16, 0.3, { type: 'triangle', gain: 0.06, release: 0.3 }));
      break;
    case 'notificacion':
      campana(ctx, out, 84, t, 0.05, 0.5);
      campana(ctx, out, 88, t + 0.12, 0.05, 0.6);
      break;
  }
}

// ----------------------------------------------------------------------------- preferencias

function storage(): Storage | null {
  // en la versión publicada en claude.ai no se usa almacenamiento del navegador
  if (import.meta.env.MODE === 'single' || import.meta.env.MODE === 'real-single') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
function cargarPrefs(): AudioPrefs {
  try {
    const raw = storage()?.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : { ...DEFAULT_PREFS };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}
function guardarPrefs(p: AudioPrefs): void {
  try {
    storage()?.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* nada */
  }
}

export const audio = new AudioEngine();
if (import.meta.env.DEV) (window as unknown as { __audio: AudioEngine }).__audio = audio;

/** Render offline de N compases (para tests de nivel y clipping). */
export async function renderOffline(mood: Mood, compases: number, sampleRate = 22050): Promise<Float32Array> {
  const dur = (compases * 16 * 60) / TEMPO[mood] / 4 + 1;
  const ctx = new OfflineAudioContext(1, Math.ceil(dur * sampleRate), sampleRate);
  const bus = ctx.createGain();
  bus.gain.value = DEFAULT_PREFS.volMusica * MUSIC_GAIN * 0.9;
  bus.connect(ctx.destination);
  const noise = crearRuido(ctx);
  const fake = new AudioEngine();
  for (let st = 0; st < compases * 16; st++) tocarPaso(ctx, bus, noise, mood, st, 0.05 + (st * 60) / TEMPO[mood] / 4, fake);
  const buf = await ctx.startRendering();
  return buf.getChannelData(0);
}

/** Render offline de un efecto. */
export async function renderSfxOffline(name: Sfx, sampleRate = 22050): Promise<Float32Array> {
  const ctx = new OfflineAudioContext(1, sampleRate * 2.5, sampleRate);
  const bus = ctx.createGain();
  bus.gain.value = DEFAULT_PREFS.volEfectos * SFX_GAIN * 0.9;
  bus.connect(ctx.destination);
  tocarSfx(ctx, bus, crearRuido(ctx), name);
  const buf = await ctx.startRendering();
  return buf.getChannelData(0);
}

export const SFX_LIST: Sfx[] = ['click', 'blip', 'presentada', 'tarde', 'cobro', 'pago', 'multa', 'puerta', 'inspector', 'arca', 'contratacion', 'renuncia', 'nivel', 'herramienta', 'corregido', 'telefono', 'exito', 'fallo', 'notificacion'];
