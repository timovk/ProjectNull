import { DOORS, ROOMS } from '../config/FacilityLayout.js';

function makeDoor(id) {
  return { id, closed: false, damaged: false, manualHold: false, lastChange: -Infinity, forcedBy: null };
}

/**
 * Doors, corridor lights, containment barrier, ventilation fan, workstation
 * rack, radio and station lighting. All state changes go through methods that
 * return { ok, reason } so the UI can explain refusals.
 */
export class SecuritySystem {
  constructor(sim) {
    this.sim = sim;
    this.doors = {};
    for (const id of Object.keys(DOORS)) this.doors[id] = makeDoor(id);
    this.corridorLights = {};
    for (const [id, room] of Object.entries(ROOMS)) if (room.lightable) this.corridorLights[id] = false;
    this.barrier = false;
    this.fan = true;
    this.rack = true;
    this.radio = true;
    this.stationLights = 'NORMAL'; // NORMAL | LOW | EMERGENCY
    this.usage = {
      doorCloses: 0, doorSeconds: 0, lightActivations: 0, lightSeconds: 0,
      barrierActivations: 0, barrierSeconds: 0, fanOffSeconds: 0, repairs: 0, manualHoldSeconds: 0
    };
  }

  get powered() {
    return !this.sim.power.failed;
  }

  // -------------------------------------------------------------- queries

  isDoorClosed(id) {
    const d = this.doors[id];
    if (!d) return false;
    if (d.manualHold) return true;
    return d.closed && !d.damaged && this.powered;
  }

  isCorridorLit(room) {
    return !!this.corridorLights[room] && this.powered;
  }

  get barrierActive() {
    return this.barrier && this.powered;
  }

  poweredClosedDoorCount() {
    if (!this.powered) return 0;
    let n = 0;
    for (const d of Object.values(this.doors)) if (d.closed && !d.damaged) n++;
    return n;
  }

  litCorridorCount() {
    if (!this.powered) return 0;
    let n = 0;
    for (const on of Object.values(this.corridorLights)) if (on) n++;
    return n;
  }

  // -------------------------------------------------------------- commands

  setDoor(id, closed) {
    const d = this.doors[id];
    if (!d) return { ok: false, reason: 'UNKNOWN_DOOR' };
    if (!this.powered) return { ok: false, reason: 'NO_POWER' };
    if (closed && d.damaged) return { ok: false, reason: 'MOTOR_DAMAGED' };
    if (d.closed === closed) return { ok: true };
    d.closed = closed;
    d.lastChange = this.sim.time;
    if (closed) this.usage.doorCloses++;
    this.sim.noise.pulse('door');
    this.sim.recordSystem('DOOR', `${id} ${closed ? 'CLOSED' : 'OPENED'}`, { door: id, closed });
    this.sim.bus.emit('security:door', { id, closed, damaged: d.damaged });
    return { ok: true };
  }

  toggleDoor(id) {
    const d = this.doors[id];
    if (!d) return { ok: false, reason: 'UNKNOWN_DOOR' };
    return this.setDoor(id, !d.closed);
  }

  setCorridorLight(room, on) {
    if (!(room in this.corridorLights)) return { ok: false, reason: 'UNKNOWN_LIGHT' };
    if (!this.powered && on) return { ok: false, reason: 'NO_POWER' };
    if (this.corridorLights[room] === on) return { ok: true };
    this.corridorLights[room] = on;
    if (on) this.usage.lightActivations++;
    this.sim.recordSystem('LIGHT', `${room} light ${on ? 'ON' : 'OFF'}`, { room, on });
    this.sim.bus.emit('security:light', { room, on });
    return { ok: true };
  }

  toggleCorridorLight(room) {
    return this.setCorridorLight(room, !this.corridorLights[room]);
  }

  setBarrier(on) {
    if (!this.powered && on) return { ok: false, reason: 'NO_POWER' };
    if (this.barrier === on) return { ok: true };
    this.barrier = on;
    if (on) this.usage.barrierActivations++;
    this.sim.recordSystem('BARRIER', `Containment barrier ${on ? 'ENGAGED' : 'RELEASED'}`, { on });
    this.sim.bus.emit('security:barrier', { on });
    return { ok: true };
  }

  setFan(on) {
    if (!this.powered && on) return { ok: false, reason: 'NO_POWER' };
    if (this.fan === on) return { ok: true };
    this.fan = on;
    this.sim.recordSystem('FAN', `Ventilation ${on ? 'ON' : 'OFF'}`, { on });
    this.sim.bus.emit('security:fan', { on });
    return { ok: true };
  }

  setRack(on) {
    if (!this.powered && on) return { ok: false, reason: 'NO_POWER' };
    if (this.rack === on) return { ok: true };
    this.rack = on;
    this.sim.recordSystem('RACK', `Surveillance rack ${on ? 'ONLINE' : 'OFFLINE'}`, { on });
    this.sim.bus.emit('security:rack', { on });
    return { ok: true };
  }

  setRadio(on) {
    if (!this.powered && on) return { ok: false, reason: 'NO_POWER' };
    if (this.radio === on) return { ok: true };
    this.radio = on;
    this.sim.bus.emit('security:radio', { on });
    return { ok: true };
  }

  setStationLights(mode) {
    if (!this.powered) return { ok: false, reason: 'NO_POWER' };
    if (mode !== 'NORMAL' && mode !== 'LOW') return { ok: false, reason: 'INVALID_MODE' };
    if (this.stationLights === mode) return { ok: true };
    this.stationLights = mode;
    this.sim.recordSystem('STATION_LIGHTS', `Station lighting ${mode}`, { mode });
    this.sim.bus.emit('security:stationLights', { mode });
    return { ok: true };
  }

  /** Mechanical door release, usable only without power. Held by the player. */
  setManualHold(id, hold) {
    const d = this.doors[id];
    if (!d) return { ok: false, reason: 'UNKNOWN_DOOR' };
    if (hold && this.powered) return { ok: false, reason: 'POWERED' };
    if (d.manualHold === hold) return { ok: true };
    d.manualHold = hold;
    this.sim.recordSystem('MANUAL_HOLD', `${id} manual hold ${hold ? 'ON' : 'OFF'}`, { door: id, hold });
    this.sim.bus.emit('security:manualHold', { id, hold });
    return { ok: true };
  }

  forceDoor(id, entityId) {
    const d = this.doors[id];
    if (!d) return;
    d.damaged = true;
    d.closed = false;
    d.forcedBy = entityId;
    d.lastChange = this.sim.time;
    this.sim.stats.doorsForced++;
    this.sim.recordSystem('DOOR_FORCED', `${id} motor forced by ${entityId}`, { door: id, entityId });
    this.sim.bus.emit('security:doorForced', { id, entityId });
  }

  repairDoor(id) {
    const d = this.doors[id];
    if (!d) return { ok: false, reason: 'UNKNOWN_DOOR' };
    if (!d.damaged) return { ok: false, reason: 'NOT_DAMAGED' };
    d.damaged = false;
    d.forcedBy = null;
    this.usage.repairs++;
    this.sim.recordSystem('DOOR_REPAIRED', `${id} motor repaired`, { door: id });
    this.sim.bus.emit('security:doorRepaired', { id });
    return { ok: true };
  }

  onPowerFailure() {
    for (const d of Object.values(this.doors)) d.closed = false;
    for (const k of Object.keys(this.corridorLights)) this.corridorLights[k] = false;
    this.barrier = false;
    this.fan = false;
    this.rack = false;
    this.radio = false;
    this.stationLights = 'EMERGENCY';
  }

  onPowerRestored() {
    for (const d of Object.values(this.doors)) d.manualHold = false;
    this.stationLights = 'LOW';
  }

  update(dt) {
    const u = this.usage;
    const closed = this.poweredClosedDoorCount();
    u.doorSeconds += closed * dt;
    u.lightSeconds += this.litCorridorCount() * dt;
    if (this.barrierActive) u.barrierSeconds += dt;
    if (!this.fan) u.fanOffSeconds += dt;
    for (const d of Object.values(this.doors)) if (d.manualHold) u.manualHoldSeconds += dt;
  }
}
