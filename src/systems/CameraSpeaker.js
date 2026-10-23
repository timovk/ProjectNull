import { ENTITY_IDS } from '../config/GameConfig.js';
import { ROOMS } from '../config/FacilityLayout.js';

const { WANDERER, OBSERVER, ECHO, PATIENT } = ENTITY_IDS;

/**
 * Each camera room's own sound, as heard through the workstation speaker.
 *   noise/type/freq/q/level : the room's air
 *   hum/humLevel            : mains hum, compressors, fans
 *   event                   : an occasional small sound of the room itself
 */
export const ROOM_SOUND_PROFILES = {
  CONTAINMENT_A: { noise: 'pink', type: 'bandpass', freq: 900, q: 0.8, level: 0.05, hum: 120, humLevel: 0.010, event: 'tick' },
  CONTAINMENT_B: { noise: 'pink', type: 'bandpass', freq: 820, q: 0.8, level: 0.05, hum: 120, humLevel: 0.010, event: 'tick' },
  ISOLATION: { noise: 'brown', type: 'lowpass', freq: 320, q: 0.7, level: 0.035, hum: 120, humLevel: 0.016, event: 'buzz' },
  ACOUSTICS_LAB: { noise: 'pink', type: 'lowpass', freq: 160, q: 0.7, level: 0.006, hum: 0, humLevel: 0, event: null }, // anechoic: almost nothing
  RESEARCH_HALL: { noise: 'pink', type: 'bandpass', freq: 600, q: 0.6, level: 0.045, hum: 60, humLevel: 0.012, event: 'drip' },
  STORAGE: { noise: 'pink', type: 'bandpass', freq: 420, q: 0.7, level: 0.05, hum: 55, humLevel: 0.028, event: 'creak' },
  CENTRAL_JUNCTION: { noise: 'brown', type: 'lowpass', freq: 420, q: 0.7, level: 0.055, hum: 60, humLevel: 0.010, event: 'creak' },
  WEST_CORRIDOR: { noise: 'pink', type: 'bandpass', freq: 700, q: 0.7, level: 0.035, hum: 120, humLevel: 0.004, event: 'drip' },
  EAST_CORRIDOR: { noise: 'pink', type: 'bandpass', freq: 700, q: 0.7, level: 0.035, hum: 120, humLevel: 0.004, event: 'drip' },
  WEST_APPROACH: { noise: 'brown', type: 'lowpass', freq: 360, q: 0.7, level: 0.04, hum: 0, humLevel: 0, event: null },
  EAST_APPROACH: { noise: 'brown', type: 'lowpass', freq: 360, q: 0.7, level: 0.04, hum: 0, humLevel: 0, event: null },
  VENT_SHAFT: { noise: 'pink', type: 'bandpass', freq: 480, q: 0.5, level: 0.08, hum: 31, humLevel: 0.03, event: null }
};

/** Feed states that carry room audio. */
export function feedHasAudio(status) {
  return status === 'OK' || status === 'DISRUPTED';
}

/** Awake subjects currently in a room (what the speaker can pick up). */
export function speakerOccupants(sim, room) {
  return sim.ai.entities.filter((e) => e.currentRoom === room && e.aiLevel > 0).map((e) => e.id);
}

const SPEAKER_POS = { x: 0, y: 1.27, z: -3.0 };
const LEVEL_OPEN = 1;
const LEVEL_STANDING = 0.18; // faintly audible from across the station

/**
 * The workstation speaker. While you watch a feed you hear that room: its
 * air and machinery, and anything moving or breathing in it. The sounds come
 * from the simulation (who is in the selected room), never invented.
 */
export class CameraSpeaker {
  constructor(game) {
    this.game = game;
    this.built = false;
    this.room = null;
    this.timers = new Map();
    this.nextEvent = 0;
  }

  get audio() {
    return this.game.audio;
  }

  build() {
    const a = this.audio;
    const ctx = a.ctx;
    const mk = (type, freq, q = 0.7) => {
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      return f;
    };
    const shaper = () => {
      const ws = ctx.createWaveShaper();
      const curve = new Float32Array(256);
      for (let i = 0; i < 256; i++) {
        const x = (i / 255) * 2 - 1;
        curve[i] = Math.tanh(x * 1.8) / Math.tanh(1.8);
      }
      ws.curve = curve;
      return ws;
    };
    // Two chains with the same small-speaker character: one for room tone
    // (ambient volume), one for subjects (entity volume).
    const chain = (bus) => {
      const input = ctx.createGain();
      const hp = mk('highpass', 280);
      const lp = mk('lowpass', 3400);
      const ws = shaper();
      const level = ctx.createGain();
      level.gain.value = 0;
      const pan = a.panner(SPEAKER_POS);
      input.connect(hp);
      hp.connect(lp);
      lp.connect(ws);
      ws.connect(level);
      level.connect(pan);
      pan.connect(a.buses[bus]);
      return { input, level };
    };
    this.amb = chain('ambient');
    this.ent = chain('entity');

    // Room air.
    this.airSrc = a.loopSource(a.noise.pink);
    this.airBrown = a.loopSource(a.noise.brown);
    this.airFilter = mk('bandpass', 600);
    this.airPink = ctx.createGain();
    this.airBrownGain = ctx.createGain();
    this.airPink.gain.value = 0;
    this.airBrownGain.gain.value = 0;
    this.airSrc.connect(this.airPink);
    this.airBrown.connect(this.airBrownGain);
    this.airPink.connect(this.airFilter);
    this.airBrownGain.connect(this.airFilter);
    this.airFilter.connect(this.amb.input);
    // Machinery hum.
    this.humOsc = ctx.createOscillator();
    this.humOsc.type = 'triangle';
    this.humOsc.frequency.value = 60;
    this.humGain = ctx.createGain();
    this.humGain.gain.value = 0;
    this.humOsc.connect(this.humGain);
    this.humGain.connect(this.amb.input);
    this.humOsc.start();
    // Static for a dead feed.
    const hiss = a.loopSource(a.noise.white);
    const hissHp = mk('highpass', 1500);
    this.hissGain = ctx.createGain();
    this.hissGain.gain.value = 0;
    hiss.connect(hissHp);
    hissHp.connect(this.hissGain);
    this.hissGain.connect(this.amb.input);
    this.built = true;
  }

  reset() {
    this.timers.clear();
    this.room = null;
  }

  /** Apply a room's profile with short crossfades (no clicks, no jumps). */
  applyProfile(room) {
    const a = this.audio;
    const p = ROOM_SOUND_PROFILES[room];
    if (!p) return;
    const t = a.ctx.currentTime;
    this.airFilter.type = p.type;
    this.airFilter.frequency.setTargetAtTime(p.freq, t, 0.08);
    this.airFilter.Q.setTargetAtTime(p.q, t, 0.08);
    this.humOsc.frequency.setTargetAtTime(p.hum || 60, t, 0.05);
  }

  update(sim, dt, { open, active }) {
    const a = this.audio;
    if (!a.ready) return;
    if (!this.built) this.build();
    const sv = sim.surveillance;
    const room = sv.selected;
    const status = sv.feedStatus(room);
    const audible = feedHasAudio(status);
    const gentle = a.gentle;
    const p = ROOM_SOUND_PROFILES[room] ?? ROOM_SOUND_PROFILES.CENTRAL_JUNCTION;
    if (room !== this.room) {
      this.room = room;
      this.applyProfile(room);
      this.timers.clear();
    }

    const level = !active || !sv.operational ? 0 : open ? LEVEL_OPEN : LEVEL_STANDING;
    a.ramp(this.amb.level.gain, level, 0.5);
    a.ramp(this.ent.level.gain, level, 0.5);
    const lit = ROOMS[room]?.lightable && sim.security.isCorridorLit(room);
    a.ramp(this.airPink.gain, audible && p.noise === 'pink' ? p.level : 0, 0.3);
    a.ramp(this.airBrownGain.gain, audible && p.noise === 'brown' ? p.level * 1.6 : 0, 0.3);
    a.ramp(this.humGain.gain, audible ? p.humLevel + (lit ? 0.014 : 0) : 0, 0.3);
    const disrupted = status === 'DISRUPTED';
    const hiss = !sv.operational ? 0 : !audible ? 0.035 : disrupted ? (gentle ? 0.008 : 0.03) : 0.002;
    a.ramp(this.hissGain.gain, hiss, gentle ? 0.6 : 0.15);

    if (!open || !audible || !active) return;
    const now = performance.now() / 1000;

    // The room's own small sounds.
    if (p.event && now > this.nextEvent) {
      this.nextEvent = now + 7 + Math.random() * 7;
      this.roomEvent(p.event);
    }

    // Whoever is in the room.
    for (const id of speakerOccupants(sim, room)) {
      const due = this.timers.get(id) ?? now + 1.2;
      if (now < due) {
        if (!this.timers.has(id)) this.timers.set(id, due);
        continue;
      }
      this.timers.set(id, now + this.presence(id, sim.ai.get(id)));
    }
  }

  roomEvent(kind) {
    const a = this.audio;
    const dest = this.amb.input;
    if (kind === 'drip') a.tone({ dest, bus: 'ambient', freq: 1250, sweepTo: 650, attack: 0.025, release: 0.18, peak: 0.05, reverb: 0 });
    else if (kind === 'tick') a.burst({ dest, bus: 'ambient', buffer: 'white', type: 'bandpass', freq: 2400, q: 4, attack: 0.025, hold: 0, release: 0.05, peak: 0.05, reverb: 0 });
    else if (kind === 'buzz') a.tone({ dest, bus: 'ambient', type: 'sawtooth', freq: 120, attack: 0.15, hold: 0.4, release: 0.3, peak: 0.012, reverb: 0 });
    else if (kind === 'creak') a.burst({ dest, bus: 'ambient', buffer: 'white', type: 'bandpass', freq: 380, sweepTo: 240, q: 14, attack: 0.3, hold: 0.4, release: 0.6, peak: 0.07, reverb: 0 });
  }

  steps(count, weight, gain, spacing) {
    const a = this.audio;
    const dest = this.ent.input;
    for (let i = 0; i < count; i++) {
      const delay = i * spacing * (0.85 + Math.random() * 0.3);
      a.burst({ dest, bus: 'entity', buffer: 'brown', type: 'lowpass', freq: 420 + 160 / weight, attack: 0.03, hold: 0.02, release: 0.2 * weight, peak: 0.16 * gain, delay, reverb: 0 });
      a.tone({ dest, bus: 'entity', freq: 95 / Math.sqrt(weight), sweepTo: 70, attack: 0.03, hold: 0.01, release: 0.16 * weight, peak: 0.07 * gain, delay, reverb: 0 });
    }
  }

  /** One presence sound for a subject in the watched room; returns seconds until the next. */
  presence(id, entity) {
    const a = this.audio;
    const dest = this.ent.input;
    const cam = ROOMS[this.room]?.camera ?? '';
    switch (id) {
      case WANDERER:
        this.steps(2, 0.8, 0.8, 0.6);
        this.game.subtitles.show(`[Camera audio, ${cam}: shuffling footsteps]`, 'entity');
        return 4 + Math.random() * 3;
      case OBSERVER:
        // It makes almost no sound. That is the point.
        if (Math.random() < 0.5) a.burst({ dest, bus: 'entity', buffer: 'white', type: 'highpass', freq: 3200, attack: 0.03, hold: 0, release: 0.05, peak: 0.05, reverb: 0 });
        if (entity?.watched) this.game.subtitles.show(`[Camera audio, ${cam}: nothing. Not even breathing]`, 'entity');
        return 9 + Math.random() * 6;
      case ECHO:
        for (let i = 0; i < 3; i++) a.burst({ dest, bus: 'entity', buffer: 'white', type: 'bandpass', freq: 2000 + Math.random() * 1200, sweepTo: 1100, q: 6, attack: 0.35, hold: 0.1, release: 0.45, peak: 0.06, delay: i * 0.35, reverb: 0, rate: 0.7 });
        this.game.subtitles.show(`[Camera audio, ${cam}: distorted murmuring]`, 'entity');
        return 5 + Math.random() * 3;
      case PATIENT:
        a.burst({ dest, bus: 'entity', buffer: 'pink', type: 'bandpass', freq: 440, sweepTo: 520, q: 1.5, attack: 1.2, hold: 0.2, release: 1.4, peak: 0.09, reverb: 0 });
        a.burst({ dest, bus: 'entity', buffer: 'pink', type: 'bandpass', freq: 400, sweepTo: 300, q: 1.5, attack: 0.9, hold: 0.1, release: 1.8, peak: 0.07, delay: 2.6, reverb: 0 });
        this.game.subtitles.show(`[Camera audio, ${cam}: slow, heavy breathing]`, 'entity');
        return 7 + Math.random() * 3;
      default:
        return 10;
    }
  }

  /** A subject walks into or out of the room on screen. */
  onMoved({ entityId, from, to }) {
    if (!this.built || !this.game.workstationOpen) return;
    const room = this.game.sim?.surveillance.selected;
    if (!room || (to !== room && from !== room)) return;
    if (!feedHasAudio(this.game.sim.surveillance.feedStatus(room))) return;
    const arriving = to === room;
    const cam = ROOMS[room]?.camera ?? '';
    const weight = entityId === PATIENT ? 1.8 : entityId === OBSERVER ? 0.6 : 0.9;
    const gain = arriving ? 0.9 : 0.5;
    if (entityId === ECHO) {
      this.audio.burst({ dest: this.ent.input, bus: 'entity', buffer: 'white', type: 'bandpass', freq: 1500, sweepTo: 800, q: 3, attack: 0.3, hold: 0.4, release: 0.6, peak: 0.07 * gain, reverb: 0 });
    } else {
      this.steps(entityId === OBSERVER ? 1 : 3, weight, gain, entityId === PATIENT ? 1.4 : 0.55);
    }
    this.game.subtitles.show(`[Camera audio, ${cam}: something ${arriving ? 'comes into' : 'leaves'} the room]`, 'entity');
    if (arriving) this.timers.set(entityId, performance.now() / 1000 + 3);
  }
}
