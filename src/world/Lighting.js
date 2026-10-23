import * as THREE from 'three';

/**
 * Drives every light from simulation state plus presentation-only effects:
 * cosmetic flicker (disabled by the "disable flickering" setting and never
 * carrying gameplay information), the slow failure dim, and the morning ramp.
 */
export class LightingController {
  constructor(facility, settings) {
    this.f = facility;
    this.settings = settings;
    this.flicker = new Map(); // key -> { until, phase }
    this.nextFlickerAt = 8;
    this.time = 0;
    this.morningColor = new THREE.Color(0xffe2b8);
    this.baseColor = new THREE.Color(0xdfe8d8);
    this.eased = {};
  }

  reset() {
    this.flicker.clear();
    this.nextFlickerAt = 8;
    this.eased = {};
  }

  /**
   * No-startle mode eases every light change (including the power-failure
   * blackout) over a few seconds instead of switching instantly.
   */
  ease(key, target, dt) {
    if (!this.settings.get('noStartle') || this.eased[key] === undefined) {
      this.eased[key] = target;
      return target;
    }
    this.eased[key] += (target - this.eased[key]) * Math.min(1, dt * 0.8);
    return this.eased[key];
  }

  flickerValue(key, time) {
    if (this.settings.get('disableFlicker') || this.settings.get('noStartle')) return 1;
    const f = this.flicker.get(key);
    if (!f || time > f.until) return 1;
    const x = Math.sin(time * 61 + f.phase) * Math.sin(time * 23 + f.phase * 2);
    return x > 0.1 ? 1 : 0.25;
  }

  triggerFlicker(key, duration = 0.6, time = this.time) {
    this.flicker.set(key, { until: time + duration, phase: Math.random() * 10 });
  }

  /**
   * @param state.failure  0..1 progress of a failure sequence (lights die)
   * @param state.morning  0..1 progress of the victory ramp
   */
  update(dt, time, sim, state = {}) {
    this.time = time;
    const L = this.f.lights.station;
    const sec = sim.security;
    const failure = state.failure ?? 0;
    const morning = state.morning ?? 0;
    const failDim = 1 - smooth(failure);

    if (time > this.nextFlickerAt) {
      const keys = ['stationA', 'stationB', 'maintenance', 'approachW', 'approachE'];
      this.triggerFlicker(keys[Math.floor(Math.random() * keys.length)], 0.3 + Math.random() * 0.8, time);
      this.nextFlickerAt = time + 12 + Math.random() * 35;
    }

    let mainI = 42;
    let fillI = 22;
    let tube = 1;
    let emergency = 0;
    if (sec.stationLights === 'LOW') {
      mainI = 12;
      fillI = 4;
      tube = 0.35;
    } else if (sec.stationLights === 'EMERGENCY') {
      mainI = 0;
      fillI = 0;
      tube = 0;
      emergency = 11 + Math.sin(time * 1.2) * 1.5;
    }
    if (morning > 0) {
      const k = smooth(morning);
      mainI = mainI + (55 - mainI) * k;
      fillI = fillI + (20 - fillI) * k;
      tube = tube + (1 - tube) * k;
      emergency *= 1 - k;
      L.main.color.copy(this.baseColor).lerp(this.morningColor, k);
      L.fill.color.copy(L.main.color);
    } else {
      L.main.color.copy(this.baseColor);
      L.fill.color.copy(this.baseColor);
    }
    mainI = this.ease('main', mainI, dt);
    fillI = this.ease('fill', fillI, dt);
    tube = this.ease('tube', tube, dt);
    emergency = this.ease('emergency', emergency, dt);
    const fa = this.flickerValue('stationA', time);
    const fb = this.flickerValue('stationB', time);
    L.main.intensity = mainI * fa * failDim;
    L.fill.intensity = fillI * fb * failDim;
    L.emergency.intensity = emergency * (1 - failure * 0.8);
    L.emergencyLamp.material.color.setHex(emergency > 0 ? 0xff3020 : 0x222222);
    L.fixtures[0].tubes.forEach((t) => t.material.color.setScalar(0.92 * tube * fa * failDim + 0.08));
    L.fixtures[1].tubes.forEach((t) => t.material.color.setScalar(0.92 * tube * fb * failDim + 0.08));
    L.monitorGlow.intensity = (sim.surveillance.operational ? 1.2 : 0.1) * failDim;
    L.ambient.intensity = this.ease('ambient', sec.stationLights === 'EMERGENCY' ? 0.2 : sec.stationLights === 'LOW' ? 0.26 : 0.4, dt) * (1 - failure * 0.9) + morning * 0.2;
    const shadows = this.settings.get('shadows');
    if (L.main.castShadow !== shadows) L.main.castShadow = shadows;

    // Approaches: dim bulbs, corridor fixtures beyond reflect corridor lighting.
    const powered = !sim.power.failed;
    for (const side of ['WEST', 'EAST']) {
      const room = this.f.rooms[`${side}_APPROACH`];
      const lit = sec.isCorridorLit(`${side}_CORRIDOR`);
      const fl = this.flickerValue(side === 'WEST' ? 'approachW' : 'approachE', time);
      room.lights.lamp.intensity = this.ease(`lamp${side}`, (powered ? 7 : 1.8) + (lit ? 1.5 : 0), dt) * fl * (1 - failure * 0.7);
      room.lights.bulb.material.color.setScalar(powered ? 0.9 * fl : 0.3);
      room.lights.corridorLamp.intensity = lit ? 14 : 0;
      room.lights.corridorTube.material.color.setHex(lit ? 0xeef4ea : 0x3a3c3e);
    }

    const m = this.f.lights.maintenance;
    const mf = this.flickerValue('maintenance', time);
    m.lamp.intensity = this.ease('maint', powered ? 18 : 3, dt) * mf * failDim;
    m.bulb.material.color.setScalar((powered ? 0.9 : 0.3) * mf);
    const e = this.f.lights.electrical;
    e.lamp.intensity = this.ease('elec', powered ? 16 : 3, dt) * failDim;
    this.f.lights.pump.lamp.intensity = 2.2 * failDim;
    this.f.lights.restricted.glow.intensity = (0.6 + Math.sin(time * 0.8) * 0.25) * failDim;
  }

  /** Updates the lights of the remote room currently on camera. */
  updateRemoteRoom(room, sim, time, dt) {
    if (!room || room.main) return;
    if (room.corridorLights) {
      const lit = sim.security.isCorridorLit(room.id);
      const powered = !sim.power.failed;
      for (const l of room.corridorLights.bright) l.intensity += ((lit ? 30 : 0) - l.intensity) * Math.min(1, dt * 10);
      for (const t of room.corridorLights.tubes) t.material.color.setHex(lit ? 0xeef4ea : 0x303234);
      room.corridorLights.emergency.intensity = powered ? 4 : 5;
    }
    if (room.decon) {
      const d = room.decon;
      const active = sim.facility.deconActive;
      const targetY = active ? d.closedY : d.openY;
      d.shutter.position.y += (targetY - d.shutter.position.y) * Math.min(1, dt * 1.2);
      const beat = active ? (Math.sin(time * 6) > 0 ? 1 : 0.15) : 0;
      d.beaconMat.color.setScalar(0.2 + beat * 0.8).multiply(new THREE.Color(1, 0.65, 0.15));
      d.light.intensity = beat * 4;
      d.label.visible = active;
    }
    if (room.spinner) room.spinner.rotation.z += dt * 4;
    if (room.flicker && !this.settings.get('disableFlicker')) {
      for (const f of room.flicker) {
        if (!f.light) continue;
        const r = Math.sin(time * 37 + f.base * 11) * Math.sin(time * 13 + f.base);
        f.light.intensity = f.base * (r > 0.92 ? 0.3 : 1);
      }
    } else if (room.flicker) {
      for (const f of room.flicker) if (f.light) f.light.intensity = f.base;
    }
  }

  setQuality(quality) {
    const high = quality !== 'low';
    // Low quality removes decorative lights (one-time shader recompile).
    this.f.lights.pump.lamp.visible = high;
    this.f.lights.restricted.glow.visible = high;
    for (const side of ['WEST', 'EAST']) this.f.rooms[`${side}_APPROACH`].lights.corridorLamp.visible = high;
  }
}

function smooth(t) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}
