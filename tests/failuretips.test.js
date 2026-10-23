import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/core/Simulation.js';
import { runMovementOpportunity, OUTCOMES } from '../src/ai/MovementOpportunity.js';
import { ENTITY_IDS } from '../src/config/GameConfig.js';
import { failureTip, GENERAL_TIPS } from '../src/content/FailureTips.js';

const { WANDERER, OBSERVER, ECHO, PATIENT } = ENTITY_IDS;

function quietStation(sim) {
  for (const cmd of [{ type: 'FAN', on: false }, { type: 'RADIO', on: false }, { type: 'STATION_LIGHTS', mode: 'LOW' }]) sim.command(cmd);
  sim.noise.pulses.door = 0;
  sim.noise.update(0);
}

/** Puts the Echo in the duct, settled, at AI 20 and lets it try once. */
function echoTries(sim) {
  const e = sim.ai.get(ECHO);
  e.setAILevel(20);
  e.currentRoom = 'VENT_DUCT';
  e.state = 'LISTENING';
  e.roomEnteredAt = -1000;
  return runMovementOpportunity(e, sim);
}

test('every subject has general failure advice', () => {
  for (const id of [WANDERER, OBSERVER, ECHO, PATIENT]) assert.match(GENERAL_TIPS[id], /\w/);
  assert.equal(failureTip({ entityId: WANDERER }), GENERAL_TIPS[WANDERER]);
});

test('a breach records what the station was doing at that moment', () => {
  const sim = new Simulation({ seed: 'tips-context' });
  quietStation(sim);
  sim.command({ type: 'FAN', on: true });
  sim.noise.update(0);
  assert.equal(echoTries(sim).outcome, OUTCOMES.ATTACK_SUCCESS);
  const ctx = sim.breach.context;
  assert.ok(ctx.noise.ventilation > 0);
  assert.equal(ctx.powerFailed, false);
  assert.ok(Math.abs(ctx.stationNoise - sim.noise.stationNoise) < 1e-9);
  assert.match(failureTip(sim.breach), /fan/);
});

test('the auxiliary cell bang is named when it let the Echo in', () => {
  const sim = new Simulation({ seed: 'tips-aux' });
  quietStation(sim);
  assert.equal(echoTries(sim).reason, 'SILENCE');
  sim.command({ type: 'AUX_CELL' });
  sim.noise.update(0);
  assert.equal(echoTries(sim).outcome, OUTCOMES.ATTACK_SUCCESS);
  assert.match(failureTip(sim.breach), /auxiliary cell/);
});

test('door breaches explain power failures, forced doors and the Patient-Echo combo', () => {
  const base = { noise: {}, powerFailed: false, doorDamaged: false, echoInVents: false };
  const tip = (entityId, ctx) => failureTip({ entityId, context: { ...base, ...ctx } });
  assert.match(tip(OBSERVER, { powerFailed: true }), /power had run out/);
  assert.match(tip(WANDERER, { doorDamaged: true }), /forced earlier/);
  assert.match(tip(PATIENT, { echoInVents: true }), /count the groans/);
  assert.equal(tip(PATIENT, {}), GENERAL_TIPS[PATIENT]);
});
