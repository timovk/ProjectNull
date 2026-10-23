import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/core/Simulation.js';
import { idlePolicy, doorsOnlyPolicy, competentPolicy, runNightSync } from './tools/policies.js';

const SEEDS = 40;

function play(factory, label) {
  const results = [];
  for (let i = 0; i < SEEDS; i++) results.push(runNightSync(Simulation, `${label}-${i}`, factory));
  return results;
}

const rate = (results) => results.filter((r) => r.outcome === 'SURVIVED').length / results.length;

test('balance: a player who uses every countermeasure usually survives', () => {
  const results = play(() => competentPolicy(), 'bal-competent');
  const r = rate(results);
  assert.ok(r >= 0.8, `competent survival ${r}`);
  const survivors = results.filter((x) => x.outcome === 'SURVIVED');
  const avgPower = survivors.reduce((s, x) => s + x.powerRemaining, 0) / survivors.length;
  assert.ok(avgPower > 5 && avgPower < 60, `power left ${avgPower}`);
});

test('balance: ignoring the systems is not enough to survive', () => {
  assert.ok(rate(play(() => idlePolicy(), 'bal-idle')) <= 0.1);
  assert.ok(rate(play(() => doorsOnlyPolicy(), 'bal-doors')) <= 0.3);
});

test('balance: no failure is possible during the first half hour', () => {
  for (const result of play(() => idlePolicy(), 'bal-early')) {
    if (result.outcome === 'BREACHED') assert.ok(result.timeSurvived > 55, `breach at ${result.timeSurvived}`);
  }
});

test('balance: every failure names the responsible entity and its route', () => {
  for (const result of play(() => doorsOnlyPolicy(), 'bal-cause')) {
    if (result.outcome !== 'BREACHED') continue;
    assert.match(result.breach.entityId, /^SUBJECT_0[1-4]$/);
    assert.ok(['EAST_DOOR', 'WEST_DOOR', 'VENT'].includes(result.breach.via));
  }
});

test('balance: a slow, inattentive player who knows the rules still has a fair chance', () => {
  const factory = () => competentPolicy({ reaction: 5, observerCheckEvery: 60, echoRooms: ['VENT_DUCT'], lightsEarly: false, repairDelay: 20 });
  const r = rate(play(factory, 'bal-distracted'));
  assert.ok(r >= 0.6, `distracted survival ${r}`);
});
