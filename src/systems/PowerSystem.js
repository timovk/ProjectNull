import { POWER_CONFIG } from '../config/GameConfig.js';

/**
 * Electricity. Drain is the sum of every powered consumer, in percent per
 * second, and is recomputed every fixed step from live system state.
 * Reaching zero triggers a power failure, which is NOT an automatic death:
 * see SecuritySystem.onPowerFailure and the BLACKOUT_AI_BONUS.
 */
export class PowerSystem {
  constructor(sim, config = POWER_CONFIG) {
    this.sim = sim;
    this.config = config;
    this.level = config.initial;
    this.failed = false;
    this.failedAt = null;
    this.drainPerSecond = 0;
    this.totalConsumed = 0;
    this.breakdown = {
      facilityBase: 0, stationLights: 0, workstation: 0, cameras: 0, ventilation: 0,
      radio: 0, doors: 0, corridorLights: 0, barrier: 0
    };
  }

  computeDrain() {
    const D = this.config.drain;
    const b = this.breakdown;
    const s = this.sim.security;
    const sv = this.sim.surveillance;
    if (this.failed) {
      for (const k in b) b[k] = 0;
      return 0;
    }
    b.facilityBase = D.facilityBase;
    b.stationLights = s.stationLights === 'NORMAL' ? D.stationLightsNormal : s.stationLights === 'LOW' ? D.stationLightsLow : 0;
    b.workstation = s.rack ? D.workstationRack : 0;
    b.cameras = sv.viewing && sv.operational ? D.cameraViewing : 0;
    b.ventilation = s.fan ? D.ventilationFan : 0;
    b.radio = s.radio ? D.radio : 0;
    b.doors = D.doorClosed * s.poweredClosedDoorCount();
    b.corridorLights = D.corridorLight * s.litCorridorCount();
    b.barrier = s.barrier ? D.barrier : 0;
    let total = 0;
    for (const k in b) total += b[k];
    return total;
  }

  update(dt) {
    this.drainPerSecond = this.computeDrain();
    if (this.failed) return;
    const used = this.drainPerSecond * dt;
    this.level -= used;
    this.totalConsumed += used;
    if (this.level <= 0) this.fail();
  }

  /** One-off cost. Returns false if there is not enough charge. */
  spend(amount) {
    if (this.failed || this.level < amount) return false;
    this.level -= amount;
    this.totalConsumed += amount;
    if (this.level <= 0) this.fail();
    return true;
  }

  charge(amount) {
    this.level = Math.min(100, this.level + amount);
    if (this.failed && this.level > 0) {
      this.failed = false;
      this.sim.onPowerRestored();
    }
  }

  fail() {
    this.level = 0;
    if (this.failed) return;
    this.failed = true;
    this.failedAt = this.sim.time;
    this.sim.onPowerFailure();
  }

  /** Estimated seconds until empty at the current drain. */
  get secondsRemaining() {
    return this.drainPerSecond > 0 ? this.level / this.drainPerSecond : Infinity;
  }
}
