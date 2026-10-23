import test from 'node:test';
import assert from 'node:assert/strict';
import { Random } from '../src/core/Random.js';
import { Simulation } from '../src/core/Simulation.js';
import {
  resolveMovementOpportunity,
  runMovementOpportunity,
  successProbability,
  OUTCOMES
} from '../src/ai/MovementOpportunity.js';
import { ENTITY_IDS } from '../src/config/GameConfig.js';

const TRIALS = 100000;

function successRate(aiLevel, seed = 'rate') {
  const rng = new Random(`${seed}-${aiLevel}`);
  const entity = { id: 'TEST', aiLevel };
  let successes = 0;
  for (let i = 0; i < TRIALS; i++) if (resolveMovementOpportunity(entity, rng).success) successes++;
  return successes / TRIALS;
}

test('AI level 0 succeeds exactly 0% of the time', () => {
  assert.equal(successRate(0), 0);
});

test('AI level 20 succeeds exactly 100% of the time', () => {
  assert.equal(successRate(20), 1);
});

test('AI level 10 converges to 50%', () => {
  const rate = successRate(10);
  // sigma = sqrt(0.25 / 1e5) ~= 0.0016; tolerance is ~6 sigma.
  assert.ok(Math.abs(rate - 0.5) < 0.01, `rate ${rate}`);
});

test('AI level 5 converges to 25%', () => {
  const rate = successRate(5);
  assert.ok(Math.abs(rate - 0.25) < 0.01, `rate ${rate}`);
});

test('every AI level converges to AI/20', () => {
  for (let ai = 0; ai <= 20; ai++) {
    const rate = successRate(ai, 'sweep');
    assert.ok(Math.abs(rate - ai / 20) < 0.01, `AI ${ai}: rate ${rate}`);
    assert.equal(successProbability(ai), ai / 20);
  }
});

test('roll is uniform over 1..20', () => {
  const rng = new Random('uniform');
  const counts = new Array(21).fill(0);
  for (let i = 0; i < TRIALS * 2; i++) counts[resolveMovementOpportunity({ id: 'T', aiLevel: 10 }, rng).roll]++;
  assert.equal(counts[0], 0);
  for (let r = 1; r <= 20; r++) {
    const p = counts[r] / (TRIALS * 2);
    assert.ok(Math.abs(p - 0.05) < 0.003, `roll ${r}: ${p}`);
  }
});

test('opportunity record exposes the baseline fields', () => {
  const rec = resolveMovementOpportunity({ id: 'SUBJECT_01', aiLevel: 6 }, new Random(1));
  assert.deepEqual(Object.keys(rec).sort(), ['aiLevel', 'entityId', 'roll', 'success']);
  assert.ok(rec.roll >= 1 && rec.roll <= 20);
  assert.equal(rec.success, rec.roll <= 6);
});

test('pipeline separates roll success from actual movement', () => {
  const sim = new Simulation({ seed: 'pipeline' });
  sim.command({ type: 'LIGHT', room: 'EAST_CORRIDOR', on: true });
  sim.command({ type: 'LIGHT', room: 'WEST_CORRIDOR', on: true });
  const w = sim.ai.get(ENTITY_IDS.WANDERER);
  w.setAILevel(10);
  const counts = {};
  let rollSuccesses = 0;
  const n = 20000;
  for (let i = 0; i < n; i++) {
    w.currentRoom = 'CENTRAL_JUNCTION';
    w.state = 'ROAMING';
    w.frustration = 0;
    w.retreatPath = null;
    const rec = runMovementOpportunity(w, sim);
    counts[rec.outcome] = (counts[rec.outcome] ?? 0) + 1;
    if (rec.rollSuccess) rollSuccesses++;
    if (!rec.rollSuccess) assert.equal(rec.outcome, OUTCOMES.ROLL_FAILED);
  }
  const rate = rollSuccesses / n;
  assert.ok(Math.abs(rate - 0.5) < 0.02, `roll success rate ${rate}`);
  // Lit corridors deter some successful rolls: moved < roll successes.
  assert.ok(counts.BLOCKED > 0, 'some successful rolls must be blocked');
  assert.ok(counts.MOVED > 0, 'some successful rolls must move');
  assert.ok(counts.MOVED < rollSuccesses);
  assert.equal((counts.MOVED ?? 0) + (counts.BLOCKED ?? 0) + (counts.STAYED ?? 0) + (counts.RETREATED ?? 0), rollSuccesses);
  assert.equal(counts.ROLL_FAILED, n - rollSuccesses);
});

test('effective AI of a dormant (AI 0) entity is always 0, even with bonuses', () => {
  const sim = new Simulation({ seed: 'dormant' });
  const o = sim.ai.get(ENTITY_IDS.OBSERVER);
  o.setAILevel(0);
  o.agitation = 10;
  sim.power.fail();
  assert.equal(o.getEffectiveAI(sim), 0);
  for (let i = 0; i < 500; i++) {
    const rec = runMovementOpportunity(o, sim);
    assert.equal(rec.rollSuccess, false);
  }
});

test('blocked, invalid and failed outcomes are recorded distinctly in the log', () => {
  const sim = new Simulation({ seed: 'distinct' });
  const w = sim.ai.get(ENTITY_IDS.WANDERER);
  w.setAILevel(20);
  w.currentRoom = 'EAST_APPROACH';
  w.state = 'WAITING';
  w.roomEnteredAt = -1000; // long settled at the door
  sim.command({ type: 'DOOR', door: 'EAST_DOOR', closed: true });
  const rec = runMovementOpportunity(w, sim);
  assert.equal(rec.rollSuccess, true);
  assert.equal(rec.outcome, OUTCOMES.ATTACK_BLOCKED);
  assert.equal(rec.reason, 'DOOR_CLOSED');
  assert.equal(sim.log.recent(1)[0], rec);

  // An entity whose decide() names a non-adjacent room is rejected, not teleported.
  w.currentRoom = 'CONTAINMENT_A';
  w.state = 'ROAMING';
  const original = w.decide;
  w.decide = () => ({ type: 'MOVE', to: 'EAST_APPROACH' });
  const bad = runMovementOpportunity(w, sim);
  w.decide = original;
  assert.equal(bad.outcome, OUTCOMES.INVALID_DESTINATION);
  assert.equal(w.currentRoom, 'CONTAINMENT_A');
});
