import { FACILITY_EVENT_CONFIG } from '../config/GameConfig.js';
import { GATES, CAMERA_ROOMS } from '../config/FacilityLayout.js';

/**
 * Simulation-relevant environmental events, driven by their own seeded RNG
 * stream so they are reproducible and never disturb entity rolls:
 *  - decontamination cycle: temporarily closes the Research Hall gate
 *  - camera signal faults: a feed drops out until it recovers or is reset
 *  - the isolation bulkhead, locked until the configured hour
 */
export class FacilityEvents {
  constructor(sim, config = FACILITY_EVENT_CONFIG) {
    this.sim = sim;
    this.config = config;
    this.rng = sim.rng.fork('facility');
    this.gates = {};
    for (const [id, g] of Object.entries(GATES)) this.gates[id] = { id, open: g.initiallyOpen };
    this.nextDecon = this.rng.range(config.deconIntervalMin, config.deconIntervalMax);
    this.deconUntil = -1;
    this.nextFault = config.cameraFaultStart + this.rng.range(0, config.cameraFaultIntervalMin);
    this.counts = { decon: 0, faults: 0 };
  }

  isGateOpen(id) {
    return this.gates[id]?.open ?? true;
  }

  get deconActive() {
    return !this.gates.DECON_GATE.open;
  }

  setGate(id, open, reason = '') {
    const g = this.gates[id];
    if (!g || g.open === open) return;
    g.open = open;
    this.sim.recordSystem('GATE', `${id} ${open ? 'OPEN' : 'SEALED'}${reason ? ` (${reason})` : ''}`, { gate: id, open });
    this.sim.bus.emit('facility:gate', { id, open, reason });
  }

  update(_dt) {
    const c = this.config;
    const time = this.sim.time;
    const hours = this.sim.gameHours;

    for (const [id, def] of Object.entries(GATES)) {
      if (def.releaseAtHour !== undefined && !this.gates[id].open && hours >= def.releaseAtHour - 1e-9) {
        this.setGate(id, true, 'released by facility automation');
      }
    }

    if (this.gates.DECON_GATE.open && time >= this.nextDecon) {
      this.deconUntil = time + c.deconClosedSeconds;
      this.counts.decon++;
      this.setGate('DECON_GATE', false, 'decontamination cycle');
    } else if (!this.gates.DECON_GATE.open && time >= this.deconUntil) {
      this.nextDecon = time + this.rng.range(c.deconIntervalMin, c.deconIntervalMax);
      this.setGate('DECON_GATE', true, 'cycle complete');
    }

    if (time >= this.nextFault) {
      const sv = this.sim.surveillance;
      const candidates = CAMERA_ROOMS.filter((r) => !sv.faults.has(r));
      if (candidates.length) {
        const room = this.rng.pick(candidates);
        sv.addFault(room, time + this.rng.range(c.cameraFaultDurationMin, c.cameraFaultDurationMax));
        this.counts.faults++;
      }
      this.nextFault = time + this.rng.range(c.cameraFaultIntervalMin, c.cameraFaultIntervalMax);
    }
  }
}
