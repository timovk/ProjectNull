import { ENTITY_IDS } from '../config/GameConfig.js';
import { STATION } from '../config/FacilityLayout.js';

const { WANDERER, OBSERVER, ECHO, PATIENT } = ENTITY_IDS;

/** Where each room "is" for positional audio, relative to the station at the origin. */
export const SOUND_POSITIONS = {
  WEST_APPROACH: { x: -6.8, y: 1.0, z: -0.5 },
  EAST_APPROACH: { x: 6.8, y: 1.0, z: -0.5 },
  WEST_CORRIDOR: { x: -9, y: 1.4, z: -12 },
  EAST_CORRIDOR: { x: 9, y: 1.4, z: -12 },
  VENT_DUCT: { x: 0.8, y: 3.4, z: 1.4 },
  VENT_SHAFT: { x: 0.5, y: 4.5, z: -7 },
  CENTRAL_JUNCTION: { x: 0, y: 1.5, z: -20 },
  STORAGE: { x: -15, y: 1, z: -14 },
  ISOLATION: { x: -18, y: 1, z: -6 },
  RESEARCH_HALL: { x: 0, y: 1.5, z: -32 },
  CONTAINMENT_A: { x: 14, y: 1, z: -36 },
  CONTAINMENT_B: { x: -14, y: 1, z: -36 },
  ACOUSTICS_LAB: { x: 16, y: 1, z: -24 },
  [STATION]: { x: 0, y: 1.2, z: 0 }
};

const HOP_GAIN = [1, 0.75, 0.4, 0.2, 0.08];

/** Rooms right outside the station: a door approach or the duct above it. */
export const THRESHOLD_ROOMS = Object.freeze(['WEST_APPROACH', 'EAST_APPROACH', 'VENT_DUCT']);

/** Proximity of one subject, by sound hops from the station (0 = inside). */
export const THREAT_BY_HOPS = Object.freeze([1, 0.85, 0.55, 0.3, 0.12]);

/**
 * "The building holds its breath": true while an awake subject waits right
 * outside the station (at a door or in the duct) and is not leaving.
 */
export function hushActive(sim) {
  return sim.ai.entities.some((e) => e.aiLevel > 0 && e.state !== 'RETREATING' && THRESHOLD_ROOMS.includes(e.currentRoom));
}

/**
 * Dread drone level, 0..1. Mostly the nearest subject's proximity (nothing
 * until it is closer than about three rooms), plus a small rise through the
 * night so the late hours feel heavier.
 */
export function dreadLevel(threat, hourIndex = 0) {
  const near = Math.max(0, Math.min(1, (threat - 0.25) / 0.75));
  const late = Math.max(0, Math.min(1, hourIndex / 5));
  return Math.min(1, near * 0.85 + late * 0.15);
}

function direction(room) {
  if (room.startsWith('WEST')) return 'west';
  if (room.startsWith('EAST')) return 'east';
  if (room.startsWith('VENT')) return 'in the ventilation';
  return 'distant';
}

function closeness(hops) {
  return hops <= 1 ? 'close' : hops === 2 ? 'nearby' : 'far';
}

/**
 * Turns simulation events into positional sound and textual cues. Audio
 * carries real information: what you hear is where entities actually are.
 */
export class EntitySoundscape {
  constructor(game) {
    this.game = game;
    this.timers = new Map();
    this.lastRadioBand = 0;
    this.hush = false;
    this.dread = 0;
    const bus = game.bus;
    bus.on('entity:moved', (e) => this.onMoved(e));
    bus.on('entity:entryBlocked', (e) => this.onBlocked(e));
    bus.on('security:door', (e) => this.onDoor(e));
    bus.on('security:doorForced', (e) => this.onForced(e));
    bus.on('ai:transition', (e) => this.onTransition(e));
  }

  get audio() {
    return this.game.audio;
  }

  hops(room) {
    return this.game.sim.graph.soundDistancesFrom(STATION).get(room) ?? 9;
  }

  cue(text, category = 'entity') {
    this.game.subtitles.show(text, category);
  }

  reset() {
    this.timers.clear();
    this.lastRadioBand = 0;
    this.hush = false;
    this.dread = 0;
  }

  onMoved({ entityId, from, to, retreat }) {
    const sim = this.game.sim;
    if (!sim || this.game.state !== 'PLAYING') return;
    this.game.cameraSpeaker?.onMoved({ entityId, from, to });
    const hops = this.hops(to);
    if (hops > 4) return;
    const pos = SOUND_POSITIONS[to];
    const g = HOP_GAIN[hops];
    const a = this.audio;
    const dir = direction(to);
    switch (entityId) {
      case WANDERER: {
        const n = 3 + Math.floor(Math.random() * 2);
        for (let i = 0; i < n; i++) a.footstep(pos, { weight: 0.8, gain: g * (0.8 + Math.random() * 0.3), delay: i * (0.45 + Math.random() * 0.25) });
        if (hops <= 3) this.cue(`[Uneven footsteps, ${dir}, ${closeness(hops)}]`);
        break;
      }
      case OBSERVER:
        if (hops <= 2) {
          a.footstep(pos, { weight: 0.6, gain: g * 0.4 });
          a.jointClick(pos, g);
          this.cue(`[A single careful step, ${dir}]`);
        }
        break;
      case ECHO:
        if (to.startsWith('VENT')) {
          a.scrape(pos, g * 1.2);
          this.cue(to === 'VENT_DUCT' ? '[Scraping in the duct directly above]' : '[Metal scraping in the ventilation]');
        } else {
          a.whisper(pos, g);
          if (hops <= 3) this.cue(`[Distorted murmuring, ${dir}]`);
        }
        break;
      case PATIENT: {
        for (let i = 0; i < 3; i++) a.footstep(pos, { weight: 1.8, gain: g * 1.1, delay: i * 1.5 });
        if (hops <= 3) this.cue(retreat ? `[Heavy footsteps receding, ${dir}]` : `[Slow, heavy footsteps, ${dir}. They stop.]`);
        break;
      }
    }
  }

  onBlocked({ entityId, room, reason }) {
    const pos = SOUND_POSITIONS[room];
    const a = this.audio;
    const dir = direction(room);
    if (reason === 'DOOR_CLOSED') {
      if (entityId === PATIENT) {
        a.creak({ x: pos.x * 0.68, y: 1.2, z: pos.z }, 1.2);
        a.thud({ x: pos.x * 0.68, y: 1, z: pos.z }, 0.6);
        this.cue(`[The ${dir} door groans under a slow weight]`);
      } else {
        a.burst({ pos: { x: pos.x * 0.68, y: 1.3, z: pos.z }, buffer: 'white', type: 'bandpass', freq: 1200, q: 4, attack: 0.2, hold: 0.4, release: 0.4, peak: 0.06 });
        this.cue(`[Something brushes against the ${dir} door]`);
      }
    } else if (reason === 'SILENCE') {
      a.scrape(SOUND_POSITIONS.VENT_DUCT, 0.5);
      this.cue('[The scraping above pauses, listening]');
    } else if (reason === 'BARRIER') {
      this.cue(`[A low resonance against the field, ${dir}]`);
    }
  }

  onDoor({ id }) {
    const sim = this.game.sim;
    const pos = id === 'WEST_DOOR' ? { x: -4.5, y: 1.2, z: -0.5 } : { x: 4.5, y: 1.2, z: -0.5 };
    this.audio.doorMotor(pos);
    // The Echo repeats what it hears.
    const echo = sim.ai.get(ECHO);
    if (echo.currentRoom === 'VENT_DUCT' || echo.currentRoom === 'VENT_SHAFT') {
      const vpos = SOUND_POSITIONS[echo.currentRoom];
      this.audio.doorMotor(vpos, echo.currentRoom === 'VENT_DUCT' ? 0.45 : 0.25, 1.4, 'entity');
      this.cue('[The door sound repeats, distorted, from the vents]');
    }
  }

  onForced({ id }) {
    const pos = id === 'WEST_DOOR' ? { x: -4.6, y: 1.2, z: -0.5 } : { x: 4.6, y: 1.2, z: -0.5 };
    this.audio.creak(pos, 1.5);
    this.audio.burst({ pos, bus: 'ambient', buffer: 'pink', type: 'bandpass', freq: 300, sweepTo: 90, q: 3, attack: 0.3, hold: 0.6, release: 1.2, peak: 0.15 });
    this.cue(`[The ${id === 'WEST_DOOR' ? 'west' : 'east'} door motor grinds, then gives way]`, 'warning');
  }

  onTransition(rec) {
    if (rec.transition === 'RETREAT_BEGIN' && rec.entityId === PATIENT && rec.detail.startsWith('BARRIER')) {
      this.cue('[The weight behind the door shifts, and slowly withdraws]');
    }
  }

  /** Recurring presence sounds for entities waiting near the station. */
  update(dt) {
    const sim = this.game.sim;
    const now = performance.now() / 1000;
    let threat = 0;
    for (const e of sim.ai.entities) {
      if (e.aiLevel <= 0 && e.currentRoom === e.homeRoom) continue;
      const hops = this.hops(e.currentRoom);
      threat = Math.max(threat, [1, 0.85, 0.55, 0.3, 0.12][Math.min(4, hops)] ?? 0);
      const key = e.id;
      const due = this.timers.get(key) ?? now + 3;
      if (now < due) continue;
      const room = e.currentRoom;
      const pos = SOUND_POSITIONS[room];
      let next = 6 + Math.random() * 6;
      if (e.id === WANDERER && room.endsWith('APPROACH')) {
        this.audio.footstep(pos, { weight: 0.7, gain: 0.45 });
        this.audio.footstep(pos, { weight: 0.7, gain: 0.35, delay: 0.7 });
        if (Math.random() < 0.4) this.cue(`[Shuffling just outside the ${direction(room)} door]`);
      } else if (e.id === PATIENT && room.endsWith('APPROACH')) {
        this.audio.breath({ x: pos.x * 0.75, y: 1.6, z: pos.z }, 1);
        this.cue(`[Slow breathing behind the ${direction(room)} door]`);
        next = 7 + Math.random() * 5;
      } else if (e.id === ECHO && room === 'VENT_DUCT') {
        this.audio.scrape(pos, 0.8);
        if (Math.random() < 0.5) this.cue('[Something shifts in the duct above]');
        next = 4 + Math.random() * 4;
      } else if (e.id === ECHO && room === 'VENT_SHAFT') {
        this.audio.scrape(pos, 0.35);
        next = 8 + Math.random() * 6;
      } else if (e.id === OBSERVER && room.endsWith('APPROACH')) {
        this.audio.jointClick(pos, 0.6);
        next = 12 + Math.random() * 8;
      } else if (hops === 2 && Math.random() < 0.5) {
        this.audio.footstep(pos, { weight: e.id === PATIENT ? 1.8 : 0.9, gain: 0.25 });
        next = 10 + Math.random() * 10;
      } else {
        next = 8 + Math.random() * 8;
      }
      this.timers.set(key, now + next);
    }
    // The Observer's attention, while it is being watched.
    const obs = sim.ai.get(OBSERVER);
    this.audio.observedTone(obs.detected ? obs.agitation / 10 : 0);

    // Radio interference band changes produce a cue (only when the radio is on).
    const band = threat >= 0.85 ? 3 : threat >= 0.55 ? 2 : threat >= 0.3 ? 1 : 0;
    if (sim.security.radio && sim.security.powered && band !== this.lastRadioBand) {
      if (band > this.lastRadioBand && band >= 2) this.cue(band === 3 ? '[Radio: heavy interference]' : '[Radio: interference rising]', 'radio');
      this.lastRadioBand = band;
    }

    // Ambience: the bed hushes while something waits outside, and the dread
    // drone follows the nearest subject. Both carry real information.
    const hush = hushActive(sim);
    if (hush && !this.hush) this.cue('[The station seems to hold its breath]', 'ambient');
    this.hush = hush;
    this.dread = dreadLevel(threat, sim.progression.hourIndex);
    return threat;
  }
}
