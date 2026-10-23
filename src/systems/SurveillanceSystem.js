import { SURVEILLANCE_CONFIG, POWER_CONFIG } from '../config/GameConfig.js';
import { CAMERA_ROOMS } from '../config/FacilityLayout.js';

/**
 * Simulation-side surveillance state: which feed is selected, whether the
 * operator is looking at it, signal faults, movement disruptions and the
 * workstation's thermal load (the rack overheats while ventilation is off).
 *
 * The 3D camera renderer reads this state; it never invents feed content.
 */
export class SurveillanceSystem {
  constructor(sim, config = SURVEILLANCE_CONFIG) {
    this.sim = sim;
    this.config = config;
    this.selected = config.defaultCamera;
    this.viewing = false;
    this.faults = new Map(); // room -> until (sim time)
    this.disruptions = new Map(); // room -> until
    this.thermal = 0;
    this.shutdownUntil = -1;
    this.pingCooldownUntil = 0;
    this.usage = { viewSeconds: 0, switches: 0, pings: 0, relayResets: 0, thermalShutdowns: 0 };
  }

  get operational() {
    return this.sim.security.rack && !this.sim.power.failed && this.sim.time >= this.shutdownUntil;
  }

  get thermalShutdown() {
    return this.sim.time < this.shutdownUntil;
  }

  isFeedAvailable(room) {
    return this.operational && !this.faults.has(room);
  }

  isWatching(room) {
    return this.viewing && this.selected === room && this.isFeedAvailable(room);
  }

  isDisrupted(room) {
    return (this.disruptions.get(room) ?? -1) > this.sim.time;
  }

  /** OK | DISRUPTED | NO_SIGNAL | THERMAL | OFFLINE | NO_POWER */
  feedStatus(room) {
    if (this.sim.power.failed) return 'NO_POWER';
    if (!this.sim.security.rack) return 'OFFLINE';
    if (this.thermalShutdown) return 'THERMAL';
    if (this.faults.has(room)) return 'NO_SIGNAL';
    if (this.isDisrupted(room)) return 'DISRUPTED';
    return 'OK';
  }

  setViewing(viewing) {
    this.viewing = !!viewing;
    return { ok: true };
  }

  selectCamera(room) {
    if (!CAMERA_ROOMS.includes(room)) return { ok: false, reason: 'UNKNOWN_CAMERA' };
    if (this.selected !== room) {
      this.selected = room;
      this.usage.switches++;
      this.sim.bus.emit('surveillance:select', { room });
    }
    return { ok: true };
  }

  disrupt(room) {
    if (!room) return;
    this.disruptions.set(room, this.sim.time + this.config.disruptionSeconds);
  }

  addFault(room, until) {
    this.faults.set(room, until);
    this.sim.recordSystem('CAMERA_FAULT', `${room} signal lost`, { room });
    this.sim.bus.emit('surveillance:fault', { room, active: true });
  }

  relayReset() {
    if (!this.sim.security.powered) return { ok: false, reason: 'NO_POWER' };
    if (!this.faults.size) return { ok: false, reason: 'NO_FAULTS' };
    if (!this.sim.power.spend(POWER_CONFIG.relayResetCost)) return { ok: false, reason: 'NO_POWER' };
    const rooms = [...this.faults.keys()];
    this.faults.clear();
    this.usage.relayResets++;
    this.sim.recordSystem('RELAY_RESET', `Signal relay reset (${rooms.join(', ')})`, { rooms });
    for (const room of rooms) this.sim.bus.emit('surveillance:fault', { room, active: false });
    return { ok: true };
  }

  ping(room) {
    if (!CAMERA_ROOMS.includes(room)) return { ok: false, reason: 'UNKNOWN_ROOM' };
    if (!this.operational) return { ok: false, reason: 'OFFLINE' };
    if (this.sim.time < this.pingCooldownUntil) return { ok: false, reason: 'COOLDOWN' };
    if (!this.sim.power.spend(POWER_CONFIG.pingCost)) return { ok: false, reason: 'NO_POWER' };
    this.pingCooldownUntil = this.sim.time + this.config.pingCooldown;
    this.usage.pings++;
    this.sim.noise.addPing(room);
    this.sim.recordSystem('PING', `Acoustic diagnostic ping in ${room}`, { room });
    this.sim.bus.emit('surveillance:ping', { room });
    return { ok: true };
  }

  get pingCooldownRemaining() {
    return Math.max(0, this.pingCooldownUntil - this.sim.time);
  }

  update(dt) {
    const c = this.config;
    const sec = this.sim.security;
    const time = this.sim.time;
    if (this.operational) {
      if (sec.fan) this.thermal -= c.thermalCool * dt;
      else this.thermal += (this.viewing ? c.thermalRiseViewing : c.thermalRiseIdle) * dt;
      if (this.viewing) this.usage.viewSeconds += dt;
    } else {
      this.thermal -= c.thermalCoolRackOff * dt;
    }
    this.thermal = Math.max(0, Math.min(1, this.thermal));
    if (this.thermal >= 1 && !this.thermalShutdown) {
      this.shutdownUntil = time + c.thermalShutdownSeconds;
      this.thermal = c.thermalAfterShutdown;
      this.usage.thermalShutdowns++;
      this.sim.recordSystem('THERMAL_SHUTDOWN', 'Workstation thermal shutdown', {});
      this.sim.bus.emit('surveillance:thermal', { shutdown: true });
    }
    for (const [room, until] of this.faults) {
      if (time >= until) {
        this.faults.delete(room);
        this.sim.bus.emit('surveillance:fault', { room, active: false });
      }
    }
    for (const [room, until] of this.disruptions) if (time >= until) this.disruptions.delete(room);
  }
}
