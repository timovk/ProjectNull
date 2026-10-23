import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/core/Simulation.js';
import { Progress } from '../src/core/Progress.js';
import { NIGHT_SCHEDULES, NIGHT_COUNT, ENTITY_ORDER, AI_SCHEDULE } from '../src/config/GameConfig.js';
import { competentPolicy, runNightSync } from '../src/ai/ScriptedPlayers.js';

const SEEDS = 30;
const rate = (night) => {
  let ok = 0;
  for (let i = 0; i < SEEDS; i++) {
    if (runNightSync(Simulation, `campaign-${night}-${i}`, () => competentPolicy(), { schedule: NIGHT_SCHEDULES[night] }).outcome === 'SURVIVED') ok++;
  }
  return ok / SEEDS;
};

test('campaign: five nights, six hours each, valid levels, never easier than the night before', () => {
  assert.equal(Object.keys(NIGHT_SCHEDULES).length, NIGHT_COUNT);
  assert.equal(NIGHT_SCHEDULES[1], AI_SCHEDULE);
  for (let n = 1; n <= NIGHT_COUNT; n++) {
    for (const id of ENTITY_ORDER) {
      const lv = NIGHT_SCHEDULES[n][id];
      assert.equal(lv.length, 6, `night ${n} ${id}`);
      for (const v of lv) assert.ok(Number.isInteger(v) && v >= 0 && v <= 20);
      for (let h = 1; h < 6; h++) assert.ok(lv[h] >= lv[h - 1], `night ${n} ${id} rises through the night`);
      if (n > 1) for (let h = 0; h < 6; h++) assert.ok(lv[h] >= NIGHT_SCHEDULES[n - 1][id][h], `night ${n} ${id} hour ${h}`);
    }
  }
});

test('campaign: difficulty falls night by night but Night 5 stays winnable', () => {
  const first = rate(1);
  const last = rate(5);
  assert.ok(first >= 0.85, `night 1 ${first}`);
  assert.ok(last >= 0.15 && last <= 0.75, `night 5 ${last}`);
  assert.ok(first - last >= 0.25, `${first} -> ${last}`);
});

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
}

test('progress: only Night 1 starts unlocked; surviving a night unlocks the next and persists', () => {
  const storage = memoryStorage();
  const p = new Progress({ storage });
  assert.equal(p.isUnlocked(1), true);
  assert.equal(p.isUnlocked(2), false);
  assert.equal(p.current, 1);
  assert.equal(p.complete(1), 2);
  assert.equal(p.isUnlocked(2), true);
  assert.equal(p.current, 2);
  const reloaded = new Progress({ storage });
  assert.equal(reloaded.isUnlocked(2), true);
  assert.equal(reloaded.isCompleted(1), true);
  for (let n = 2; n <= NIGHT_COUNT; n++) reloaded.complete(n);
  assert.equal(reloaded.allComplete, true);
  assert.equal(reloaded.complete(NIGHT_COUNT), null);
});

test('progress: unlockAll opens every night; corrupt storage starts fresh', () => {
  assert.equal(new Progress({ storage: memoryStorage(), unlockAll: true }).isUnlocked(NIGHT_COUNT), true);
  const bad = { getItem: () => '{not json', setItem: () => {} };
  assert.equal(new Progress({ storage: bad }).current, 1);
});
