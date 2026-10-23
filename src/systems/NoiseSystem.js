import { NOISE_CONFIG } from '../config/GameConfig.js';
import { STATION } from '../config/FacilityLayout.js';

/**
 * Acoustic model shared by the AI (Subject 03) and the diagnostics UI.
 *
 * Station noise is the sum of every audible system in the player's zone.
 * Remote sources (lit corridors, diagnostic pings, the decontamination
 * cycle) sit in their own rooms. Propagation (per-hop falloff) is applied by
 * the listener, not here.
 */
export class NoiseSystem {
  constructor(sim, config = NOISE_CONFIG) {
    this.sim = sim;
    this.config = config;
    this.stationNoise = 0;
    this.components = {
      base: 0, stationLights: 0, workstation: 0, cameras: 0, ventilation: 0, radio: 0,
      doors: 0, barrier: 0, player: 0, doorMotors: 0, auxCell: 0
    };
    this.pulses = { door: 0, aux: 0 };
    this.pings = [];
    this.sources = [];
    this.peak = 0;
  }

  pulse(kind) {
    if (kind in this.pulses) this.pulses[kind] = 1;
  }

  addPing(room) {
    this.pings.push({ room, start: this.sim.time, until: this.sim.time + this.config.remote.pingDuration });
  }

  update(dt) {
    const C = this.config.station;
    const R = this.config.remote;
    const sim = this.sim;
    const s = sim.security;
    const sv = sim.surveillance;
    const powered = !sim.power.failed;
    const c = this.components;

    if (dt > 0) {
      this.pulses.door *= Math.exp(-dt / C.doorPulseTau);
      this.pulses.aux *= Math.exp(-dt / C.auxCellPulseTau);
    }

    c.base = C.base;
    c.stationLights = s.stationLights === 'NORMAL' ? C.stationLightsNormal : s.stationLights === 'LOW' ? C.stationLightsLow : 0;
    c.workstation = sv.operational ? C.workstationRack : 0;
    c.cameras = sv.viewing && sv.operational ? C.cameraViewing : 0;
    c.ventilation = s.fan && powered ? C.ventilationFan : 0;
    c.radio = s.radio && powered ? C.radio : 0;
    c.doors = C.doorClosedHum * s.poweredClosedDoorCount();
    c.barrier = s.barrierActive ? C.barrier : 0;
    c.player = (sim.player.walking ? C.playerWalking : 0) + (sim.player.working ? C.playerWorking : 0);
    c.doorMotors = C.doorPulse * this.pulses.door;
    c.auxCell = C.auxCellPulse * this.pulses.aux;

    let total = 0;
    for (const k in c) total += c[k];
    this.stationNoise = total;
    if (total > this.peak) this.peak = total;

    const sources = this.sources;
    sources.length = 0;
    sources.push({ room: STATION, level: total, decoy: false, kind: 'station' });
    for (const [room, on] of Object.entries(s.corridorLights)) {
      if (on && powered) sources.push({ room, level: R.corridorLight, decoy: false, kind: 'light' });
    }
    const time = sim.time;
    for (let i = this.pings.length - 1; i >= 0; i--) {
      const p = this.pings[i];
      if (time >= p.until) {
        this.pings.splice(i, 1);
        continue;
      }
      const remaining = 1 - (time - p.start) / (p.until - p.start);
      sources.push({ room: p.room, level: R.ping * remaining, decoy: true, kind: 'ping' });
    }
    if (sim.facility.deconActive) sources.push({ room: 'RESEARCH_HALL', level: R.deconCycle, decoy: false, kind: 'decon' });
  }
}
