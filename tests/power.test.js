import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/core/Simulation.js';
import { POWER_CONFIG } from '../src/config/GameConfig.js';

const D = POWER_CONFIG.drain;
const ZERO = { SUBJECT_01: [0], SUBJECT_02: [0], SUBJECT_03: [0], SUBJECT_04: [0] };
const close = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

test('idle drain is the sum of the default consumers', () => {
  const sim = new Simulation({ seed: 'p1', schedule: ZERO });
  sim.step();
  const expected = D.facilityBase + D.stationLightsNormal + D.workstationRack + D.ventilationFan + D.radio;
  assert.ok(close(sim.power.drainPerSecond, expected), `${sim.power.drainPerSecond}`);
});

test('each security system adds its documented drain', () => {
  const sim = new Simulation({ seed: 'p2', schedule: ZERO });
  sim.step();
  const base = sim.power.drainPerSecond;
  const check = (cmd, delta) => {
    sim.command(cmd);
    sim.step();
    assert.ok(close(sim.power.drainPerSecond - base, delta), `${cmd.type}: ${sim.power.drainPerSecond - base} vs ${delta}`);
  };
  check({ type: 'DOOR', door: 'EAST_DOOR', closed: true }, D.doorClosed);
  check({ type: 'DOOR', door: 'WEST_DOOR', closed: true }, 2 * D.doorClosed);
  sim.command({ type: 'DOOR', door: 'EAST_DOOR', closed: false });
  sim.command({ type: 'DOOR', door: 'WEST_DOOR', closed: false });
  check({ type: 'LIGHT', room: 'EAST_CORRIDOR', on: true }, D.corridorLight);
  sim.command({ type: 'LIGHT', room: 'EAST_CORRIDOR', on: false });
  check({ type: 'BARRIER', on: true }, D.barrier);
  sim.command({ type: 'BARRIER', on: false });
  check({ type: 'VIEW', viewing: true }, D.cameraViewing);
  sim.command({ type: 'VIEW', viewing: false });
  check({ type: 'FAN', on: false }, -D.ventilationFan);
  check({ type: 'STATION_LIGHTS', mode: 'LOW' }, -D.ventilationFan - D.stationLightsNormal + D.stationLightsLow);
});

test('drain integrates over simulation time', () => {
  const sim = new Simulation({ seed: 'p3', schedule: ZERO });
  sim.step();
  const rate = sim.power.drainPerSecond;
  const before = sim.power.level;
  sim.runFor(100);
  assert.ok(close(before - sim.power.level, rate * 100, 1e-6));
});

test('a full night with no defenses used does not run out of power', () => {
  const sim = new Simulation({ seed: 'p4', schedule: ZERO });
  sim.runFor(660);
  assert.equal(sim.phase, 'SURVIVED');
  assert.ok(sim.power.level > 40, `${sim.power.level}`);
});

test('holding both doors closed all night is not sustainable', () => {
  const sim = new Simulation({ seed: 'p5', schedule: ZERO });
  sim.command({ type: 'DOOR', door: 'EAST_DOOR', closed: true });
  sim.command({ type: 'DOOR', door: 'WEST_DOOR', closed: true });
  sim.runFor(660);
  assert.equal(sim.power.failed, true);
});

test('power failure: systems shut down, emergency lighting, no automatic death', () => {
  const sim = new Simulation({ seed: 'p6', schedule: ZERO });
  sim.command({ type: 'DOOR', door: 'EAST_DOOR', closed: true });
  sim.command({ type: 'LIGHT', room: 'WEST_CORRIDOR', on: true });
  sim.command({ type: 'BARRIER', on: true });
  sim.command({ type: 'VIEW', viewing: true });
  sim.power.level = 0.05;
  sim.runFor(2);
  const s = sim.security;
  assert.equal(sim.power.failed, true);
  assert.equal(sim.phase, 'RUNNING');
  assert.equal(s.isDoorClosed('EAST_DOOR'), false);
  assert.equal(s.isCorridorLit('WEST_CORRIDOR'), false);
  assert.equal(s.barrierActive, false);
  assert.equal(s.stationLights, 'EMERGENCY');
  assert.equal(sim.surveillance.operational, false);
  assert.equal(sim.power.drainPerSecond, 0);
  assert.equal(sim.command({ type: 'DOOR', door: 'EAST_DOOR', closed: true }).reason, 'NO_POWER');
  assert.equal(sim.command({ type: 'BARRIER', on: true }).reason, 'NO_POWER');
  sim.runFor(60);
  assert.equal(sim.phase, 'RUNNING');
});

test('manual door hold works only without power', () => {
  const sim = new Simulation({ seed: 'p7', schedule: ZERO });
  assert.equal(sim.command({ type: 'MANUAL_HOLD', door: 'WEST_DOOR', hold: true }).reason, 'POWERED');
  sim.power.fail();
  assert.equal(sim.command({ type: 'MANUAL_HOLD', door: 'WEST_DOOR', hold: true }).ok, true);
  assert.equal(sim.isDoorClosed('WEST_DOOR'), true);
  sim.command({ type: 'MANUAL_HOLD', door: 'WEST_DOOR', hold: false });
  assert.equal(sim.isDoorClosed('WEST_DOOR'), false);
});

test('auxiliary cell adds charge once and can restore failed power', () => {
  const sim = new Simulation({ seed: 'p8', schedule: ZERO });
  sim.power.fail();
  assert.equal(sim.command({ type: 'AUX_CELL' }).ok, true);
  assert.equal(sim.power.failed, false);
  assert.equal(sim.power.level, POWER_CONFIG.auxCellCharge);
  assert.equal(sim.security.stationLights, 'LOW');
  assert.equal(sim.command({ type: 'AUX_CELL' }).reason, 'DEPLETED');
});

test('one-off costs are refused when charge is insufficient', () => {
  const sim = new Simulation({ seed: 'p9', schedule: ZERO });
  sim.power.level = 1;
  assert.equal(sim.command({ type: 'PING', room: 'STORAGE' }).reason, 'NO_POWER');
  sim.power.level = 50;
  assert.equal(sim.command({ type: 'PING', room: 'STORAGE' }).ok, true);
  assert.equal(sim.power.level, 50 - POWER_CONFIG.pingCost);
  assert.equal(sim.command({ type: 'PING', room: 'STORAGE' }).reason, 'COOLDOWN');
});

test('ventilation off overheats the workstation into a temporary shutdown', () => {
  const sim = new Simulation({ seed: 'p10', schedule: ZERO });
  sim.command({ type: 'FAN', on: false });
  sim.command({ type: 'VIEW', viewing: true });
  sim.runFor(82);
  assert.equal(sim.surveillance.thermalShutdown, true);
  assert.equal(sim.surveillance.operational, false);
  assert.equal(sim.surveillance.feedStatus('STORAGE'), 'THERMAL');
  sim.command({ type: 'FAN', on: true });
  sim.runFor(13);
  assert.equal(sim.surveillance.operational, true);
});
