import { VOICE_LINE_INDEX } from '../content/VoiceLines.js';

/** Browser text-to-speech settings per speaker, plus preferred system voices. */
export const SYNTH_PROFILES = {
  R: { rate: 0.95, pitch: 0.9, prefer: [/guy.*natural/i, /david/i, /mark/i, /george/i, /ryan/i, /uk english male/i, /daniel/i, /alex/i, /\bmale/i] },
  TAPE: { rate: 0.82, pitch: 0.8, prefer: [/guy.*natural/i, /david/i, /mark/i, /george/i, /ryan/i, /uk english male/i, /daniel/i, /alex/i, /\bmale/i] },
  VARGA: { rate: 0.9, pitch: 1.0, prefer: [/susan/i, /aria.*natural/i, /jenny/i, /moira/i, /karen/i, /uk english female/i, /female/i] },
  FACILITY: { rate: 0.86, pitch: 0.7, prefer: [/zira/i, /hazel/i, /uk english female/i, /samantha/i, /karen/i, /moira/i, /female/i] }
};

const STALE_MS = { R: 60000, TAPE: 60000, VARGA: 60000, FACILITY: 25000 };
const RADIO_POS = { x: 4.1, y: 1.25, z: 2.0 };
const TAPE_POS = { x: 4.5, y: 0.9, z: 11.5 };
const CASSETTE_POS = { x: 2.2, y: 0.2, z: 15.6 }; // Varga's cassette, at the Sublevel B door

/**
 * Spoken lines, one at a time, in order.
 *
 * For each line the system uses, in order of preference:
 *   1. a recorded clip (public/voice/<id>.ogg|.mp3|.wav, listed in
 *      public/voice/manifest.json, which `npm run dev/build` regenerates),
 *      played through the game's audio graph with a per-speaker effect
 *      (radio, tape, hall), normalised and faded in;
 *   2. the browser's built-in text-to-speech ("synthesized voices" setting);
 *   3. nothing (the text is always shown anyway).
 */
export class VoiceSystem {
  constructor(settings, audio) {
    this.settings = settings;
    this.audio = audio;
    this.queue = [];
    this.current = null;
    this.paused = false;
    this.clips = new Map();
    this.buffers = new Map();
    this.chains = null;
    this.voiceCache = new Map();
    this.synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
    if (this.synth) {
      this.synth.addEventListener?.('voiceschanged', () => this.voiceCache.clear());
      this.synth.getVoices();
    }
    settings.onChange((k) => {
      if (k === 'voiceVolume' || k === 'masterVolume' || k === '*') this.applyVolume();
      if (k === 'synthVoices' && !settings.get('synthVoices') && this.current && !this.current.clip) this.skipCurrent();
    });
    this.loadManifest();
  }

  async loadManifest() {
    try {
      const res = await fetch('voice/manifest.json', { cache: 'no-cache' });
      if (!res.ok) return;
      const manifest = await res.json();
      for (const entry of manifest.files ?? []) {
        const file = typeof entry === 'string' ? entry : entry.file;
        const id = typeof entry === 'string' ? file.replace(/\.(ogg|mp3|wav)$/i, '') : entry.id;
        this.clips.set(id, `voice/${file}`);
      }
    } catch {
      /* no manifest: browser voices only */
    }
  }

  get recordedCount() {
    return this.clips.size;
  }

  /** Queue a line by id. Returns true if it will be heard. */
  say(id) {
    const line = VOICE_LINE_INDEX.get(id);
    if (!line) return false;
    const clip = this.clips.has(line.id);
    const synth = !clip && this.synth && this.settings.get('synthVoices');
    if (!clip && !synth) return false;
    this.queue.push({ line, clip, queuedAt: performance.now() });
    if (this.queue.length > 6) this.queue.shift();
    this.pump();
    return true;
  }

  pump() {
    if (this.current || this.paused) return;
    const now = performance.now();
    while (this.queue.length && now - this.queue[0].queuedAt > STALE_MS[this.queue[0].line.speaker]) this.queue.shift();
    const item = this.queue.shift();
    if (!item) return;
    this.current = item;
    if (item.clip) this.playClip(item);
    else this.speak(item);
  }

  finish(item) {
    if (this.current !== item) return;
    clearTimeout(item.timeout);
    this.current = null;
    setTimeout(() => this.pump(), 400);
  }

  // ------------------------------------------------------------- browser voice

  volumeFor(speaker) {
    const s = this.settings;
    const gentle = s.get('noStartle') ? 0.8 : 1;
    const v = s.get('masterVolume') * s.get('voiceVolume') * gentle * (speaker === 'FACILITY' ? 0.85 : 1);
    return Math.max(0, Math.min(1, v));
  }

  pickVoice(speaker) {
    if (this.voiceCache.has(speaker)) return this.voiceCache.get(speaker);
    const voices = (this.synth?.getVoices() ?? []).filter((v) => /^en/i.test(v.lang));
    let chosen = null;
    for (const re of SYNTH_PROFILES[speaker].prefer) {
      chosen = voices.find((v) => re.test(v.name));
      if (chosen) break;
    }
    chosen ??= voices[0] ?? null;
    if (voices.length) this.voiceCache.set(speaker, chosen);
    return chosen;
  }

  speak(item) {
    const { line } = item;
    const p = SYNTH_PROFILES[line.speaker];
    const u = new SpeechSynthesisUtterance(line.text);
    const voice = this.pickVoice(line.speaker);
    if (voice) u.voice = voice;
    u.lang = voice?.lang ?? 'en-US';
    u.rate = p.rate;
    u.pitch = p.pitch;
    u.volume = this.volumeFor(line.speaker);
    u.onend = () => this.finish(item);
    u.onerror = () => this.finish(item);
    item.utterance = u;
    // Safety net: some browsers occasionally never fire onend.
    item.timeout = setTimeout(() => {
      if (this.current === item) {
        this.synth.cancel();
        this.finish(item);
      }
    }, 4000 + line.text.length * 110);
    this.synth.speak(u);
  }

  // ------------------------------------------------------------- recorded clips

  buildChains() {
    const a = this.audio;
    const ctx = a.ctx;
    const f = (type, freq, q = 0.7) => {
      const n = ctx.createBiquadFilter();
      n.type = type;
      n.frequency.value = freq;
      n.Q.value = q;
      return n;
    };
    this.bus = ctx.createGain();
    this.bus.connect(a.master);
    const radioIn = ctx.createGain();
    const radioShape = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i / 255) * 2 - 1;
      curve[i] = Math.tanh(x * 2.2) / Math.tanh(2.2);
    }
    radioShape.curve = curve;
    const radioPan = a.panner(RADIO_POS);
    radioIn.connect(f('highpass', 320)).connect(f('lowpass', 3000)).connect(radioShape).connect(radioPan).connect(this.bus);
    const tapeIn = ctx.createGain();
    const tapePan = a.panner(TAPE_POS);
    tapeIn.connect(f('highpass', 180)).connect(f('lowpass', 4200)).connect(tapePan).connect(this.bus);
    const cassetteIn = ctx.createGain();
    cassetteIn.connect(f('highpass', 220)).connect(f('lowpass', 3600)).connect(a.panner(CASSETTE_POS)).connect(this.bus);
    const hallIn = ctx.createGain();
    hallIn.connect(this.bus);
    const send = ctx.createGain();
    send.gain.value = 0.45;
    hallIn.connect(send);
    send.connect(a.reverb);
    this.chains = { R: radioIn, TAPE: tapeIn, VARGA: cassetteIn, FACILITY: hallIn };
    this.applyVolume();
  }

  applyVolume() {
    if (!this.bus) return;
    const s = this.settings;
    this.audio.ramp(this.bus.gain, s.get('voiceVolume') * (s.get('noStartle') ? 0.8 : 1), 0.3);
  }

  async loadBuffer(id) {
    if (this.buffers.has(id)) return this.buffers.get(id);
    const res = await fetch(this.clips.get(id));
    if (!res.ok) throw new Error(`voice clip ${id}: ${res.status}`);
    const buffer = await this.audio.ctx.decodeAudioData(await res.arrayBuffer());
    // Normalise loudness: every clip peaks at the same safe level.
    let peak = 0;
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const d = buffer.getChannelData(c);
      for (let i = 0; i < d.length; i += 4) peak = Math.max(peak, Math.abs(d[i]));
    }
    const entry = { buffer, gain: peak > 0 ? Math.min(4, 0.5 / peak) : 1 };
    this.buffers.set(id, entry);
    return entry;
  }

  async playClip(item) {
    const a = this.audio;
    try {
      if (!a.ready) throw new Error('audio not started');
      if (!this.chains) this.buildChains();
      const { buffer, gain } = await this.loadBuffer(item.line.id);
      if (this.current !== item) return;
      const ctx = a.ctx;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const g = ctx.createGain();
      const t0 = ctx.currentTime + 0.05;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(gain, t0 + (this.settings.get('noStartle') ? 0.3 : 0.12));
      src.connect(g);
      g.connect(this.chains[item.line.speaker] ?? this.chains.FACILITY);
      src.onended = () => this.finish(item);
      item.source = src;
      src.start(t0);
    } catch {
      // Clip unavailable: fall back to the browser voice, or skip.
      if (this.current !== item) return;
      if (this.synth && this.settings.get('synthVoices')) this.speak(item);
      else this.finish(item);
    }
  }

  // ------------------------------------------------------------- control

  skipCurrent() {
    const item = this.current;
    if (!item) return;
    try {
      item.source?.stop();
    } catch {
      /* already stopped */
    }
    if (!item.clip) this.synth?.cancel();
    this.finish(item);
  }

  pause() {
    this.paused = true;
    this.synth?.pause();
    if (this.bus) this.audio.ramp(this.bus.gain, 0, 0.2);
  }

  resume() {
    this.paused = false;
    this.synth?.resume();
    this.applyVolume();
    this.pump();
  }

  /** Silence everything and forget the queue (new night, menu, failure). */
  stop() {
    this.queue = [];
    const item = this.current;
    this.current = null;
    if (item) {
      clearTimeout(item.timeout);
      try {
        item.source?.stop();
      } catch {
        /* already stopped */
      }
    }
    this.synth?.cancel();
    this.paused = false;
    this.applyVolume();
  }
}
