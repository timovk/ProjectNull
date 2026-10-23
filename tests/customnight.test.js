import test from 'node:test';
import assert from 'node:assert/strict';
import { customSchedule, customLabel, difficultyLabel, estimateSurvival } from '../src/ui/CustomNight.js';
import { Simulation } from '../src/core/Simulation.js';
import { ENTITY_ORDER } from '../src/config/GameConfig.js';

test('custom levels map to subjects in order and are clamped to 0..20', () => {
  const s = customSchedule([25, -3, 7.4, 12]);
  assert.deepEqual(ENTITY_ORDER.map((id) => s[id]), [[20], [0], [7], [12]]);
  assert.equal(customLabel([5, 4, 3, 1]), 'CUSTOM 5/4/3/1');
});

test('custom levels stay fixed for the whole night', () => {
  const sim = new Simulation({ seed: 'custom', schedule: customSchedule([6, 5, 4, 3]) });
  sim.facility.nextFault = Infinity;
  // Keep everyone home so nothing ends the run; we only care about levels.
  for (let hour = 0; hour < 6; hour++) {
    for (const e of sim.ai.entities) {
      e.currentRoom = e.homeRoom;
      e.state = 'IDLE';
    }
    assert.deepEqual(sim.ai.entities.map((e) => e.aiLevel), [6, 5, 4, 3], `hour ${hour}`);
    sim.runFor(110);
  }
});

test('difficulty labels follow the estimated survival rate', () => {
  assert.equal(difficultyLabel(0.95), 'COMFORTABLE');
  assert.equal(difficultyLabel(0.7), 'TENSE');
  assert.equal(difficultyLabel(0.4), 'HARD');
  assert.equal(difficultyLabel(0.1), 'BRUTAL');
  assert.equal(difficultyLabel(0), 'IMPOSSIBLE');
});

test('estimate: all asleep is always survived, 20/20/20/20 never is', async () => {
  const asleep = await estimateSurvival([0, 0, 0, 0], { nights: 3 });
  assert.equal(asleep.rate, 1);
  const max = await estimateSurvival([20, 20, 20, 20], { nights: 4 });
  assert.equal(max.rate, 0);
  assert.ok(max.medianDeath > 0);
});

test('estimate can be cancelled', async () => {
  let n = 0;
  const r = await estimateSurvival([5, 5, 5, 5], { nights: 10, isCancelled: () => ++n > 2 });
  assert.equal(r, null);
});
