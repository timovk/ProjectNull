import * as THREE from 'three';
import { formatGameClock } from '../core/GameClock.js';
import { ENTITY_IDS } from '../config/GameConfig.js';

/**
 * Keeps every station prop in sync with the simulation: doors, buttons,
 * lamps, the wall clock, the fan, the rack, the barrier field and the three
 * desk screens (status terminal, acoustic monitor, power gauge).
 */
export class StationPresenter {
  constructor(facility, feedRenderer, settings) {
    this.f = facility;
    this.settings = settings;
    this.refs = facility.refs;
    this.feedMaterial = new THREE.MeshBasicMaterial({ map: feedRenderer.monitorRT.texture, toneMapped: false });
    this.offMaterial = facility.m.screenOff;
    this.terminal = makeScreen(512, 384);
    this.acoustic = makeScreen(512, 384);
    this.gauge = makeScreen(256, 150);
    this.refs.terminalScreen.material = this.terminal.material;
    this.refs.acousticScreen.material = this.acoustic.material;
    this.refs.powerGauge.material = this.gauge.material;
    this.noiseHistory = new Array(120).fill(0);
    this.nextSlow = 0;
    this.nextFast = 0;
    this.fanSpeed = 1;
    this.barrierStrength = 0;
  }

  reset() {
    this.noiseHistory.fill(0);
    this.fanSpeed = 1;
    this.barrierStrength = 0;
    for (const d of Object.values(this.refs.doors)) d.update(0, { closed: false, damaged: false, leakLight: 0, shadow: 0, instant: true });
    const ed = this.refs.electricalDoor;
    ed.open = ed.target = 0;
    ed.hinge.rotation.y = 0;
    this.f.kit.colliders.find((c) => c.tag === 'electricalDoor').enabled = true;
  }

  update(dt, time, sim, game) {
    const sec = sim.security;
    const R = this.refs;
    const presence = game.entities.doorPresence(sim);

    // Doors.
    for (const [id, door] of Object.entries(R.doors)) {
      const side = id === 'WEST_DOOR' ? 'WEST' : 'EAST';
      const d = sec.doors[id];
      const approachLight = sim.power.failed ? 0.25 : sec.isCorridorLit(`${side}_CORRIDOR`) ? 1 : 0.7;
      door.update(dt, {
        closed: sec.isDoorClosed(id),
        damaged: d.damaged,
        leakLight: approachLight * (1 - (game.failureProgress ?? 0)),
        shadow: presence[side].shadow
      });
      const panel = R.panels[side];
      const closed = sec.isDoorClosed(id);
      panel.doorBtn.material.color.setHex(!sec.powered ? 0x1a1a1a : d.damaged ? (Math.sin(time * 5) > 0 ? 0xff8a10 : 0x301a00) : closed ? 0xff3a2a : 0x3aff5a);
      panel.lightBtn.material.color.setHex(sec.isCorridorLit(`${side}_CORRIDOR`) ? 0xffd070 : 0x262626);
      panel.manualLever.position.y = d.manualHold ? 0.85 : 1.1;
      if (R.breakerLamps[id]) R.breakerLamps[id].material.color.setHex(d.damaged ? (Math.sin(time * 4) > 0 ? 0xff3020 : 0x300000) : 0x30ff60);
    }

    // Wall clock.
    const hours = sim.gameHours;
    R.clock.hourHand.rotation.z = -((hours % 12) / 12) * Math.PI * 2;
    R.clock.minuteHand.rotation.z = -((hours * 60) % 60) / 60 * Math.PI * 2;

    // Fan (spins down/up gradually).
    const fanTarget = sec.fan && !sim.power.failed ? 1 : 0;
    this.fanSpeed += (fanTarget - this.fanSpeed) * Math.min(1, dt * 0.6);
    R.fan.blades.rotation.z -= dt * 18 * this.fanSpeed;
    R.fan.lever.position.y = fanTarget ? 0.04 : -0.04;

    // Rack LEDs.
    const op = sim.surveillance.operational;
    R.rack.leds.forEach((led, i) => {
      const on = op && Math.sin(time * (2 + (i % 7)) + i * 1.7) > -0.2;
      led.material = on ? (sim.surveillance.thermal > 0.7 && i % 3 === 0 ? this.f.m.ledAmber : this.f.m.ledGreen) : this.f.m.ledOff;
    });
    R.rack.rackSwitch.material = sec.rack ? this.f.m.ledGreen : this.f.m.ledRed;

    // Barrier.
    const target = sec.barrierActive ? 1 : 0;
    this.barrierStrength += (target - this.barrierStrength) * Math.min(1, dt * 2.5);
    R.barrier.lever.rotation.x = sec.barrier ? -0.6 : 0.6;
    R.barrier.lamp.material.color.setHex(sec.barrierActive ? 0x60c8ff : 0x222222);
    for (const plane of R.barrierFields) {
      plane.visible = this.barrierStrength > 0.01;
      plane.material.uniforms.uTime.value = time;
      plane.material.uniforms.uStrength.value = this.barrierStrength;
      plane.material.uniforms.uCalm.value = this.settings.get('reducedDistortion') || this.settings.get('disableFlicker') ? 1 : 0;
    }

    // Other lamps.
    R.relayLamp.material.color.setHex(sim.surveillance.faults.size ? (Math.sin(time * 3) > 0 ? 0xff3020 : 0x300000) : 0x30ff60);
    R.radio.lamp.material.color.setHex(sec.radio && sec.powered ? 0xffb030 : 0x1a1a1a);
    R.radio.dial.rotation.y += dt * (sec.radio ? 0.2 : 0);
    R.stationLightSwitch.material = sec.stationLights === 'NORMAL' ? this.f.m.ledAmber : this.f.m.ledOff;
    R.auxCell.lamp.material.color.setHex(sim.auxCellUsed ? 0x222222 : 0xffb030);
    R.auxCell.lever.rotation.x = sim.auxCellUsed ? 0.5 : -0.4;

    // Electrical room door (hinged, presentation + collider).
    const ed = R.electricalDoor;
    ed.open += (ed.target - ed.open) * Math.min(1, dt * 3);
    ed.hinge.rotation.y = -ed.open * 1.6;
    const col = this.f.kit.colliders.find((c) => c.tag === 'electricalDoor');
    if (col) col.enabled = ed.target < 0.5;

    // Desk monitor shows the CCTV feed only while the rack is up.
    const feedOn = op && !game.failureHidesFeed;
    const wanted = feedOn ? this.feedMaterial : this.offMaterial;
    if (R.feedScreen.material !== wanted) R.feedScreen.material = wanted;

    if (time >= this.nextFast) {
      this.nextFast = time + 0.1;
      this.noiseHistory.push(sim.noise.stationNoise);
      this.noiseHistory.shift();
      this.drawAcoustic(sim);
    }
    if (time >= this.nextSlow) {
      this.nextSlow = time + 0.5;
      this.drawTerminal(sim, game);
      this.drawGauge(sim);
    }
  }

  drawTerminal(sim, game) {
    const { ctx, w, h } = this.terminal;
    const on = !sim.power.failed;
    ctx.fillStyle = '#020604';
    ctx.fillRect(0, 0, w, h);
    if (!on) {
      this.terminal.texture.needsUpdate = true;
      return;
    }
    const sec = sim.security;
    ctx.fillStyle = '#7dffa8';
    ctx.font = 'bold 22px "Courier New", monospace';
    ctx.fillText('N-17 FACILITY STATUS', 18, 34);
    ctx.font = '18px "Courier New", monospace';
    ctx.fillText(formatGameClock(sim.gameHours), 390, 34);
    const lines = [
      `MAIN POWER  ${sim.power.level.toFixed(1).padStart(5)}%   ${(sim.power.drainPerSecond * 60).toFixed(1)}%/MIN`,
      `W DOOR ${doorText(sec, 'WEST_DOOR')}   E DOOR ${doorText(sec, 'EAST_DOOR')}`,
      `W LIGHT ${sec.isCorridorLit('WEST_CORRIDOR') ? 'ON ' : 'OFF'}     E LIGHT ${sec.isCorridorLit('EAST_CORRIDOR') ? 'ON ' : 'OFF'}`,
      `BARRIER ${sec.barrierActive ? 'ENGAGED' : 'STANDBY'}  VENT ${sec.fan ? 'ON ' : 'OFF'}`,
      `RACK ${sim.surveillance.operational ? 'ONLINE ' : 'OFFLINE'} TEMP ${(40 + sim.surveillance.thermal * 45).toFixed(0)}C`,
      `CAM FAULTS ${sim.surveillance.faults.size}   DECON ${sim.facility.deconActive ? 'CYCLING' : 'IDLE'}`
    ];
    lines.forEach((l, i) => ctx.fillText(l, 18, 72 + i * 26));
    ctx.fillStyle = '#3f8a5a';
    ctx.fillRect(18, 236, w - 36, 2);
    ctx.fillStyle = '#9dffbf';
    ctx.font = '16px "Courier New", monospace';
    const msgs = game.messages.slice(-5);
    msgs.forEach((m, i) => ctx.fillText(`> ${m.text}`.slice(0, 50), 18, 262 + i * 24));
    this.terminal.texture.needsUpdate = true;
  }

  drawAcoustic(sim) {
    const { ctx, w, h } = this.acoustic;
    ctx.fillStyle = '#05040a';
    ctx.fillRect(0, 0, w, h);
    if (sim.power.failed) {
      this.acoustic.texture.needsUpdate = true;
      return;
    }
    const echo = sim.ai.get(ENTITY_IDS.ECHO);
    const threshold = echo.listenThreshold();
    const maxN = 0.9;
    const y = (v) => h - 40 - (Math.min(v, maxN) / maxN) * (h - 90);
    ctx.fillStyle = '#ffcf6a';
    ctx.font = 'bold 20px "Courier New", monospace';
    ctx.fillText('ACOUSTIC SIGNATURE / STATION', 16, 30);
    ctx.fillStyle = 'rgba(255,60,40,0.18)';
    ctx.fillRect(16, 50, w - 32, y(threshold) - 50);
    ctx.strokeStyle = '#ff5a3a';
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(16, y(threshold));
    ctx.lineTo(w - 16, y(threshold));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#ff7a5a';
    ctx.font = '14px "Courier New", monospace';
    ctx.fillText('S-03 RESPONSE THRESHOLD (EST.)', 20, y(threshold) - 8);
    ctx.strokeStyle = '#ffd88a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    this.noiseHistory.forEach((v, i) => {
      const x = 16 + (i / (this.noiseHistory.length - 1)) * (w - 32);
      if (i === 0) ctx.moveTo(x, y(v));
      else ctx.lineTo(x, y(v));
    });
    ctx.stroke();
    const now = sim.noise.stationNoise;
    ctx.fillStyle = now >= threshold ? '#ff5a3a' : '#ffd88a';
    ctx.font = 'bold 22px "Courier New", monospace';
    ctx.fillText(`${(now * 100).toFixed(0).padStart(3)} dBn`, 16, h - 12);
    const c = sim.noise.components;
    ctx.font = '13px "Courier New", monospace';
    ctx.fillStyle = '#c8b080';
    const parts = [['VENT', c.ventilation], ['RACK', c.workstation + c.cameras], ['DOOR', c.doors + c.doorMotors], ['FIELD', c.barrier], ['RADIO', c.radio], ['YOU', c.player]];
    parts.forEach(([k, v], i) => ctx.fillText(`${k} ${(v * 100).toFixed(0)}`, 150 + i * 60, h - 14));
    this.acoustic.texture.needsUpdate = true;
  }

  drawGauge(sim) {
    const { ctx, w, h } = this.gauge;
    ctx.fillStyle = '#060404';
    ctx.fillRect(0, 0, w, h);
    const lvl = sim.power.level;
    ctx.fillStyle = sim.power.failed ? '#ff3a2a' : '#ffb84a';
    ctx.font = 'bold 18px "Courier New", monospace';
    ctx.fillText(sim.power.failed ? 'MAIN CELL DEPLETED' : 'MAIN CELL', 12, 26);
    ctx.strokeStyle = '#ffb84a';
    ctx.strokeRect(12, 40, w - 24, 46);
    ctx.fillStyle = lvl < 20 ? '#ff5a3a' : '#ffb84a';
    ctx.fillRect(15, 43, (w - 30) * (lvl / 100), 40);
    ctx.font = '16px "Courier New", monospace';
    ctx.fillStyle = '#ffd8a0';
    ctx.fillText(`${lvl.toFixed(1)}%  ${(sim.power.drainPerSecond * 60).toFixed(1)}%/min`, 12, 112);
    ctx.fillText(`LIGHTING: ${sim.security.stationLights}`, 12, 136);
    this.gauge.texture.needsUpdate = true;
  }
}

function doorText(sec, id) {
  const d = sec.doors[id];
  if (d.damaged) return 'FAULT ';
  if (d.manualHold) return 'MANUAL';
  return sec.isDoorClosed(id) ? 'SHUT  ' : 'OPEN  ';
}

function makeScreen(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
  return { canvas, ctx, texture, material, w, h };
}
