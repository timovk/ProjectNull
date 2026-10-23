import test from 'node:test';
import assert from 'node:assert/strict';
import { rollStats, consoleModel, echoThreshold, routeTimes } from '../src/ui/HowItWorks.js';
import { Simulation } from '../src/core/Simulation.js';
import { ENTITY_IDS } from '../src/config/GameConfig.js';

// The How It Works screen must describe the game truthfully: its calculators
// are checked against the real simulation here.

const ZERO = { SUBJECT_01: [0], SUBJECT_02: [0], SUBJECT_03: [0], SUBJECT_04: [0] };
const close = (a, b) => Math.abs(a - b) < 1e-9;

test('roll statistics match P = AI/20', () => {
  assert.equal(rollStats(0, 5).p, 0);
  assert.equal(rollStats(0, 5).meanWait, Infinity);
  assert.equal(rollStats(20, 5).p, 1);
  assert.equal(rollStats(10, 5).meanWait, 10);
  assert.ok(close(rollStats(10, 5).within(10), 0.75));
});

test('route times: fastest case includes the settle rule', () => {
  const r = routeTimes(ENTITY_IDS.WANDERER, 20);
  assert.equal(r.hops, 5);
  assert.equal(r.fastest, 30);
});

test('console model noise and drain equal the simulation (default station)', () => {
  const sim = new Simulation({ seed: 'hiw', schedule: ZERO });
  sim.step();
  const m = consoleModel({ lights: 'NORMAL', rack: true, viewing: false, fan: true, radio: true, doors: 0, corridorLights: 0, field: false });
  assert.ok(close(m.total, sim.noise.stationNoise), `${m.total} vs ${sim.noise.stationNoise}`);
  assert.ok(close(m.drain, sim.power.drainPerSecond), `${m.drain} vs ${sim.power.drainPerSecond}`);
});

test('console model equals the simulation for a quiet, defended station', () => {
  const sim = new Simulation({ seed: 'hiw2', schedule: ZERO });
  for (const cmd of [
    { type: 'FAN', on: false },
    { type: 'RADIO', on: false },
    { type: 'VIEW', viewing: true },
    { type: 'STATION_LIGHTS', mode: 'LOW' },
    { type: 'DOOR', door: 'EAST_DOOR', closed: true },
    { type: 'LIGHT', room: 'WEST_CORRIDOR', on: true },
    { type: 'BARRIER', on: true }
  ]) sim.command(cmd);
  sim.runFor(30); // let the door-motor pulse fade
  const m = consoleModel({ lights: 'LOW', rack: true, viewing: true, fan: false, radio: false, doors: 1, corridorLights: 1, field: true });
  assert.ok(Math.abs(m.total - sim.noise.stationNoise) < 1e-6, `${m.total} vs ${sim.noise.stationNoise}`);
  assert.ok(close(m.drain, sim.power.drainPerSecond));
});

test('the Echo threshold shown equals the one the Echo uses', () => {
  const sim = new Simulation({ seed: 'hiw3' });
  assert.equal(echoThreshold(), sim.ai.get(ENTITY_IDS.ECHO).listenThreshold());
});
