/**
 * Procedural audio (Web Audio API). No audio files are required.
 *
 * Safety rules enforced here:
 *  - The AudioContext is only created from a user gesture (init()).
 *  - Every one-shot has an attack of at least 25 ms and a capped peak.
 *  - All output passes a brick-wall limiter and a fixed safety gain.
 *  - Volume changes are smoothed (setTargetAtTime), never stepped.
 *
 * Buses: ambient, entity, interface (each with its own volume setting), all
 * feeding the master bus.
 */
const MAX_MASTER = 0.8;

export class AudioSystem {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.ready = false;
    this.layers = {};
    this.failure = 0;
    this.paused = false;
    settings.onChange(() => this.applyVolumes());
  }

  /** No-startle mode (setting): softer envelopes, no random spikes. */
  get gentle() {
    return !!this.settings.get('noStartle');
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended' && !this.paused) this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.masterFilter = ctx.createBiquadFilter();
    this.masterFilter.type = 'lowpass';
    this.masterFilter.frequency.value = 20000;
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -14;
    this.limiter.knee.value = 8;
    this.limiter.ratio.value = 16;
    this.limiter.attack.value = 0.004;
    this.limiter.release.value = 0.3;
    this.safety = ctx.createGain();
    this.safety.gain.value = 0.85;
    this.master.connect(this.masterFilter);
    this.masterFilter.connect(this.limiter);
    this.limiter.connect(this.safety);
    this.safety.connect(ctx.destination);

    this.buses = {};
    for (const name of ['ambient', 'entity', 'ui']) {
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(this.master);
      this.buses[name] = g;
    }
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.makeImpulse(2.4, 2.2);
    this.reverbGain = ctx.createGain();
    this.reverbGain.gain.value = 0.35;
    this.reverb.connect(this.reverbGain);
    this.reverbGain.connect(this.buses.entity);

    this.noise = {
      white: this.makeNoise('white'),
      pink: this.makeNoise('pink'),
      brown: this.makeNoise('brown')
    };
    this.buildLayers();
    this.ready = true;
    this.applyVolumes();
  }

  // ------------------------------------------------------------- utilities

  makeNoise(kind, seconds = 4) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'white') d[i] = w * 0.5;
      else if (kind === 'pink') {
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      } else {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      }
    }
    // Crossfade the loop seam.
    const fade = Math.floor(ctx.sampleRate * 0.05);
    for (let i = 0; i < fade; i++) {
      const k = i / fade;
      d[len - fade + i] = d[len - fade + i] * (1 - k) + d[i] * k;
    }
    return buf;
  }

  makeImpulse(seconds, decay) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  panner(pos) {
    const p = this.ctx.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = 1.5;
    p.maxDistance = 80;
    p.rolloffFactor = 1.1;
    this.setPannerPosition(p, pos);
    return p;
  }

  setPannerPosition(p, pos) {
    if (p.positionX) {
      p.positionX.value = pos.x;
      p.positionY.value = pos.y;
      p.positionZ.value = pos.z;
    } else p.setPosition(pos.x, pos.y, pos.z);
  }

  loopSource(buffer) {
    const s = this.ctx.createBufferSource();
    s.buffer = buffer;
    s.loop = true;
    s.loopStart = Math.random() * 1.5;
    s.start(0, Math.random() * buffer.duration);
    return s;
  }

  ramp(param, value, time = 0.4) {
    if (!this.ctx) return;
    param.setTargetAtTime(value, this.ctx.currentTime, Math.max(0.01, time / 3));
  }

  // ----------------------------------------------------------- continuous

  buildLayers() {
    const ctx = this.ctx;
    const L = this.layers;
    const amb = this.buses.ambient;
    const chain = (...nodes) => {
      for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
      return nodes[nodes.length - 1];
    };
    const filter = (type, freq, q = 0.7) => {
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      return f;
    };
    const gain = (v) => {
      const g = ctx.createGain();
      g.gain.value = v;
      return g;
    };

    // Room tone and distant machinery.
    L.room = gain(0.07);
    chain(this.loopSource(this.noise.brown), filter('lowpass', 240), L.room, amb);
    L.machinery = gain(0.05);
    chain(this.loopSource(this.noise.brown), filter('lowpass', 70), L.machinery, amb);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05;
    const lfoGain = gain(0.025);
    lfo.connect(lfoGain);
    lfoGain.connect(L.machinery.gain);
    lfo.start();

    // Ventilation (positional at the fan).
    L.vent = gain(0);
    L.ventPan = this.panner({ x: 3.45, y: 2.3, z: -3.2 });
    chain(this.loopSource(this.noise.pink), filter('bandpass', 520, 0.6), filter('lowpass', 2200), L.vent, L.ventPan, amb);

    // Electrical hum of the station lights.
    L.hum = gain(0);
    L.humPan = this.panner({ x: 0, y: 2.9, z: 0.2 });
    for (const [f, v, type] of [[60, 0.02, 'sine'], [120, 0.011, 'sine'], [180, 0.004, 'triangle']]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      const g = gain(v);
      o.connect(g);
      g.connect(L.hum);
      o.start();
    }
    const buzz = ctx.createOscillator();
    buzz.type = 'sawtooth';
    buzz.frequency.value = 120;
    const buzzGain = gain(0.0025);
    chain(buzz, filter('bandpass', 3000, 6), buzzGain, L.hum);
    buzz.start();
    chain(L.hum, L.humPan, amb);

    // Surveillance rack.
    L.rack = gain(0);
    L.rackPan = this.panner({ x: -3.75, y: 1.2, z: -2.6 });
    chain(this.loopSource(this.noise.pink), filter('highpass', 2800), L.rack, L.rackPan, amb);
    const whine = ctx.createOscillator();
    whine.frequency.value = 247;
    const whineGain = gain(0.12);
    chain(whine, whineGain, L.rack);
    whine.start();

    // Containment field.
    L.barrier = gain(0);
    L.barrierPan = this.panner({ x: 0, y: 1.2, z: -0.5 });
    const b1 = ctx.createOscillator();
    b1.type = 'sawtooth';
    b1.frequency.value = 55;
    const b2 = ctx.createOscillator();
    b2.frequency.value = 110.6;
    const bf = filter('lowpass', 380);
    b1.connect(bf);
    b2.connect(bf);
    chain(bf, L.barrier, L.barrierPan, amb);
    b1.start();
    b2.start();

    // Radio: band-passed static with crackle and occasional tones.
    L.radio = gain(0);
    L.radioPan = this.panner({ x: 4.1, y: 1.25, z: 2.0 });
    L.radioCrackle = gain(0.3);
    chain(this.loopSource(this.noise.white), filter('bandpass', 1700, 1.4), L.radioCrackle, L.radio);
    L.radioTone = gain(0);
    const rt = ctx.createOscillator();
    rt.frequency.value = 880;
    L.radioToneOsc = rt;
    chain(rt, L.radioTone, L.radio);
    rt.start();
    chain(L.radio, L.radioPan, amb);
    this.radioNextTone = 0;
    this.radioInterference = 0;

    // Generator in the electrical room.
    L.gen = gain(0.05);
    L.genPan = this.panner({ x: 5.2, y: 0.8, z: 7.3 });
    const gosc = ctx.createOscillator();
    gosc.type = 'sawtooth';
    gosc.frequency.value = 48;
    chain(gosc, filter('lowpass', 160), L.gen);
    gosc.start();
    chain(L.gen, L.genPan, amb);

    // Water in the pump room.
    L.water = gain(0.035);
    L.waterPan = this.panner({ x: -1.4, y: -1.2, z: 9 });
    chain(this.loopSource(this.noise.pink), filter('bandpass', 900, 0.4), L.water, L.waterPan, amb);

    // Tape hiss for audio logs.
    L.tape = gain(0);
    chain(this.loopSource(this.noise.white), filter('highpass', 4000), L.tape, this.buses.ui);
  }

  applyVolumes() {
    if (!this.ready) return;
    const s = this.settings;
    const pausedDuck = this.paused ? 0 : 1;
    this.ramp(this.master.gain, Math.min(MAX_MASTER, s.get('masterVolume') * MAX_MASTER) * pausedDuck * (this.fadeLevel ?? 1), 0.6);
    this.ramp(this.buses.ambient.gain, s.get('ambientVolume'), 0.4);
    this.ramp(this.buses.entity.gain, s.get('entityVolume'), 0.4);
    this.ramp(this.buses.ui.gain, s.get('interfaceVolume'), 0.4);
  }

  /** Global fade (start of night, end screens). 0..1 */
  setFade(level, time = 2.5) {
    this.fadeLevel = level;
    if (!this.ready) return;
    const s = this.settings;
    this.ramp(this.master.gain, Math.min(MAX_MASTER, s.get('masterVolume') * MAX_MASTER) * level * (this.paused ? 0 : 1), time);
  }

  setPaused(paused) {
    this.paused = paused;
    if (!this.ready) return;
    this.applyVolumes();
  }

  /** Failure sequence: progressively muffles and lowers everything. */
  setFailure(k) {
    this.failure = k;
    if (!this.ready) return;
    const f = 20000 * Math.pow(1 - Math.min(0.985, k), 2.2) + 120;
    this.ramp(this.masterFilter.frequency, f, 0.5);
  }

  updateListener(camera) {
    if (!this.ready) return;
    const l = this.ctx.listener;
    const p = camera.position;
    const fwd = camera.getWorldDirection(this._fwd ?? (this._fwd = camera.position.clone()));
    if (l.positionX) {
      const t = this.ctx.currentTime;
      l.positionX.setTargetAtTime(p.x, t, 0.02);
      l.positionY.setTargetAtTime(p.y, t, 0.02);
      l.positionZ.setTargetAtTime(p.z, t, 0.02);
      l.forwardX.setTargetAtTime(fwd.x, t, 0.02);
      l.forwardY.setTargetAtTime(fwd.y, t, 0.02);
      l.forwardZ.setTargetAtTime(fwd.z, t, 0.02);
      l.upX.value = 0;
      l.upY.value = 1;
      l.upZ.value = 0;
    } else {
      l.setPosition(p.x, p.y, p.z);
      l.setOrientation(fwd.x, fwd.y, fwd.z, 0, 1, 0);
    }
  }

  /**
   * Per-frame update of continuous layers from simulation state.
   * `threat` 0..1 = proximity of the nearest active entity (radio interference).
   */
  updateLayers(sim, dt, threat = 0) {
    if (!this.ready) return;
    const L = this.layers;
    const sec = sim.security;
    const powered = !sim.power.failed;
    this.ramp(L.vent.gain, sec.fan && powered ? 0.16 : 0, 1.5);
    const humLevel = !powered ? 0 : sec.stationLights === 'NORMAL' ? 1 : sec.stationLights === 'LOW' ? 0.35 : 0;
    this.ramp(L.hum.gain, humLevel, 0.8);
    this.ramp(L.rack.gain, sim.surveillance.operational ? 0.018 : 0, 0.8);
    this.ramp(L.barrier.gain, sec.barrierActive ? 0.06 : 0, 0.8);
    this.ramp(L.gen.gain, powered ? 0.05 : 0.0, 2);
    // Radio: interference rises as something approaches (unreliable on purpose).
    const radioOn = sec.radio && powered;
    this.radioInterference += (threat - this.radioInterference) * Math.min(1, dt * 0.5);
    this.ramp(L.radio.gain, radioOn ? 0.05 + this.radioInterference * 0.05 : 0, 0.6);
    const spike = this.gentle ? 0 : Math.random() < 0.08 + this.radioInterference * 0.3 ? Math.random() * 0.4 : 0;
    const crackle = 0.15 + this.radioInterference * 0.6 + spike;
    L.radioCrackle.gain.setTargetAtTime(crackle, this.ctx.currentTime, this.gentle ? 0.3 : 0.03);
    const now = this.ctx.currentTime;
    if (radioOn && now > this.radioNextTone) {
      this.radioNextTone = now + 9 + Math.random() * 20;
      const base = [440, 523, 587, 659][Math.floor(Math.random() * 4)] * (1 - this.radioInterference * 0.15);
      for (let i = 0; i < 4; i++) {
        const t0 = now + i * 0.42;
        L.radioToneOsc.frequency.setValueAtTime(base * (i % 2 ? 1 : 1.25), t0);
        L.radioTone.gain.setTargetAtTime(this.gentle ? 0.04 : 0.06, t0, this.gentle ? 0.1 : 0.02);
        L.radioTone.gain.setTargetAtTime(0, t0 + 0.22, 0.04);
      }
    }
  }

  tape(on) {
    if (!this.ready) return;
    this.ramp(this.layers.tape.gain, on ? 0.02 : 0, 0.6);
  }

  // ------------------------------------------------------------ one-shots

  /** Filtered noise burst with a gentle envelope. */
  burst({ pos = null, bus = 'entity', buffer = 'white', type = 'bandpass', freq = 800, q = 1, sweepTo = null, attack = 0.03, hold = 0.05, release = 0.3, peak = 0.2, delay = 0, reverb = 0.3, rate = 1 }) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noise[buffer];
    src.playbackRate.value = rate;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t0);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t0 + attack + hold + release);
    f.Q.value = q;
    const g = ctx.createGain();
    // No-startle mode: every non-interface sound swells in and is quieter.
    const soft = this.gentle && bus !== 'ui';
    attack = Math.max(soft ? 0.22 : 0.025, attack);
    const p = Math.min(0.35, peak) * (soft ? 0.65 : 1);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(p, t0 + attack);
    g.gain.setValueAtTime(p, t0 + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + release);
    src.connect(f);
    f.connect(g);
    let out = g;
    if (pos) {
      const pan = this.panner(pos);
      g.connect(pan);
      out = pan;
    }
    out.connect(this.buses[bus]);
    if (reverb > 0) {
      const rg = ctx.createGain();
      rg.gain.value = reverb;
      out.connect(rg);
      rg.connect(this.reverb);
    }
    src.start(t0, Math.random() * 2);
    src.stop(t0 + attack + hold + release + 0.1);
  }

  tone({ pos = null, bus = 'entity', type = 'sine', freq = 440, sweepTo = null, attack = 0.03, hold = 0.05, release = 0.3, peak = 0.1, delay = 0, reverb = 0.2 }) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (sweepTo) o.frequency.exponentialRampToValueAtTime(sweepTo, t0 + attack + hold + release);
    const g = ctx.createGain();
    const soft = this.gentle && bus !== 'ui';
    attack = Math.max(soft ? 0.22 : 0.025, attack);
    const p = Math.min(0.3, peak) * (soft ? 0.65 : 1);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(p, t0 + attack);
    g.gain.setValueAtTime(p, t0 + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + release);
    o.connect(g);
    let out = g;
    if (pos) {
      const pan = this.panner(pos);
      g.connect(pan);
      out = pan;
    }
    out.connect(this.buses[bus]);
    if (reverb > 0) {
      const rg = this.ctx.createGain();
      rg.gain.value = reverb;
      out.connect(rg);
      rg.connect(this.reverb);
    }
    o.start(t0);
    o.stop(t0 + attack + hold + release + 0.1);
  }

  footstep(pos, { weight = 1, gain = 1, delay = 0, bus = 'entity' } = {}) {
    this.burst({ pos, bus, buffer: 'brown', type: 'lowpass', freq: 260 + 200 / weight, q: 0.8, attack: 0.025, hold: 0.02, release: 0.22 * weight, peak: 0.22 * gain, delay, reverb: 0.4 });
    this.tone({ pos, bus, freq: 70 / Math.sqrt(weight), sweepTo: 45, attack: 0.025, hold: 0.01, release: 0.18 * weight, peak: 0.12 * gain * weight, delay, reverb: 0.2 });
  }

  playerStep(pos) {
    this.burst({ pos: { x: pos.x, y: 0.1, z: pos.z }, bus: 'ambient', buffer: 'brown', type: 'lowpass', freq: 520, attack: 0.025, hold: 0.01, release: 0.12, peak: 0.07, reverb: 0.15 });
  }

  doorMotor(pos, gain = 1, delay = 0, bus = 'ambient') {
    this.burst({ pos, bus, buffer: 'pink', type: 'bandpass', freq: 240, sweepTo: 420, q: 2, attack: 0.08, hold: 0.45, release: 0.3, peak: 0.14 * gain, delay, reverb: 0.3 });
    this.tone({ pos, bus, type: 'sawtooth', freq: 85, sweepTo: 120, attack: 0.08, hold: 0.4, release: 0.25, peak: 0.03 * gain, delay, reverb: 0.1 });
    this.burst({ pos, bus, buffer: 'brown', type: 'lowpass', freq: 160, attack: 0.04, hold: 0.02, release: 0.35, peak: 0.16 * gain, delay: delay + 0.6, reverb: 0.4 });
  }

  creak(pos, gain = 1) {
    this.burst({ pos, bus: 'ambient', buffer: 'white', type: 'bandpass', freq: 340, sweepTo: 210, q: 18, attack: 0.3, hold: 0.6, release: 0.8, peak: 0.12 * gain, reverb: 0.6 });
  }

  scrape(pos, gain = 1, delay = 0) {
    this.burst({ pos, buffer: 'white', type: 'bandpass', freq: 1600, sweepTo: 900, q: 3, attack: 0.25, hold: 0.5, release: 0.6, peak: 0.08 * gain, delay, reverb: 0.5 });
    this.burst({ pos, buffer: 'pink', type: 'bandpass', freq: 600, q: 5, attack: 0.3, hold: 0.3, release: 0.5, peak: 0.05 * gain, delay: delay + 0.2, reverb: 0.5 });
  }

  drip(pos) {
    this.tone({ pos, bus: 'ambient', freq: 1300, sweepTo: 600, attack: 0.025, hold: 0.0, release: 0.15, peak: 0.03, reverb: 0.8 });
  }

  thud(pos, gain = 1) {
    this.burst({ pos, bus: 'ambient', buffer: 'brown', type: 'lowpass', freq: 110, attack: 0.05, hold: 0.05, release: 0.6, peak: 0.12 * gain, reverb: 0.8 });
  }

  breath(pos, gain = 1) {
    this.burst({ pos, buffer: 'pink', type: 'bandpass', freq: 420, sweepTo: 520, q: 1.5, attack: 1.2, hold: 0.2, release: 1.4, peak: 0.07 * gain, reverb: 0.3 });
    this.burst({ pos, buffer: 'pink', type: 'bandpass', freq: 380, sweepTo: 300, q: 1.5, attack: 0.9, hold: 0.1, release: 1.8, peak: 0.05 * gain, delay: 2.6, reverb: 0.3 });
  }

  whisper(pos, gain = 1) {
    for (let i = 0; i < 3; i++) {
      this.burst({ pos, buffer: 'white', type: 'bandpass', freq: 2400 + Math.random() * 1600, sweepTo: 1200, q: 6, attack: 0.4, hold: 0.1, release: 0.5, peak: 0.04 * gain, delay: i * 0.35, reverb: 0.7, rate: 0.7 });
    }
  }

  knock(pos, gain = 1) {
    for (let i = 0; i < 3; i++) this.burst({ pos, bus: 'ambient', buffer: 'brown', type: 'lowpass', freq: 300, attack: 0.025, hold: 0.01, release: 0.25, peak: 0.1 * gain, delay: i * 0.9, reverb: 0.7 });
  }

  jointClick(pos, gain = 1) {
    this.burst({ pos, buffer: 'white', type: 'highpass', freq: 3500, attack: 0.025, hold: 0.0, release: 0.06, peak: 0.05 * gain, reverb: 0.5 });
  }

  observedTone(level) {
    if (!this.ready) return;
    if (!this.layers.observed) {
      const o = this.ctx.createOscillator();
      o.frequency.value = 4400;
      const g = this.ctx.createGain();
      g.gain.value = 0;
      o.connect(g);
      g.connect(this.buses.entity);
      o.start();
      this.layers.observed = g;
    }
    this.ramp(this.layers.observed.gain, Math.min(0.006, level * 0.006), 1.5);
  }

  /** Soft squelch when a radio message comes in (from the radio on the shelf). */
  radioChirp() {
    const pos = { x: 4.1, y: 1.25, z: 2.0 };
    this.burst({ pos, bus: 'ambient', buffer: 'white', type: 'bandpass', freq: 1900, q: 1.5, attack: 0.15, hold: 0.12, release: 0.35, peak: 0.05, reverb: 0.1 });
    this.tone({ pos, bus: 'ambient', freq: 1250, attack: 0.08, hold: 0.06, release: 0.12, peak: 0.02, delay: 0.1, reverb: 0 });
  }

  uiClick() {
    this.tone({ bus: 'ui', freq: 1150, attack: 0.025, hold: 0, release: 0.05, peak: 0.04, reverb: 0 });
  }

  uiSwitch() {
    this.burst({ bus: 'ui', buffer: 'white', type: 'highpass', freq: 2500, attack: 0.025, hold: 0.05, release: 0.1, peak: 0.03, reverb: 0 });
    this.tone({ bus: 'ui', freq: 640, attack: 0.025, hold: 0.02, release: 0.05, peak: 0.02, delay: 0.05, reverb: 0 });
  }

  uiDeny() {
    this.tone({ bus: 'ui', freq: 220, attack: 0.03, hold: 0.08, release: 0.08, peak: 0.04, reverb: 0 });
  }

  chime() {
    [523, 659, 784].forEach((f, i) => this.tone({ bus: 'ui', freq: f, attack: 0.15, hold: 0.3, release: 1.6, peak: 0.035, delay: i * 0.45, reverb: 0.6 }));
  }

  buttonClunk(pos) {
    this.burst({ pos, bus: 'ui', buffer: 'brown', type: 'lowpass', freq: 400, attack: 0.025, hold: 0.0, release: 0.1, peak: 0.08, reverb: 0.1 });
  }
}
