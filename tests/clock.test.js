import test from 'node:test';
import assert from 'node:assert/strict';
import { GameClock, formatGameClock, formatDebugTime, formatHour12 } from '../src/core/GameClock.js';
import { Simulation } from '../src/core/Simulation.js';
import { FIXED_TIMESTEP, GAME_CONFIG } from '../src/config/GameConfig.js';
import { Random } from '../src/core/Random.js';

test('advance converts real time into fixed steps', () => {
  const c = new GameClock();
  assert.equal(c.advance(FIXED_TIMESTEP), 1);
  assert.equal(c.advance(0.5), 30);
  assert.equal(c.advance(0), 0);
  assert.equal(c.advance(-1), 0);
  assert.equal(c.advance(NaN), 0);
});

test('partial frames accumulate instead of being lost', () => {
  const c = new GameClock();
  let steps = 0;
  for (let i = 0; i < 600; i++) steps += c.advance(1 / 240); // 2.5 s at 240 fps
  assert.equal(steps, 150);
});

test('backlog safeguard caps a huge frame delay', () => {
  const c = new GameClock({ maxBacklogSeconds: 2, maxStepsPerFrame: 1000 });
  const steps = c.advance(10);
  assert.equal(steps, 120);
  assert.ok(Math.abs(c.droppedSeconds - 8) < 1e-9);
});

test('simulation time is stepCount * timestep (no drift)', () => {
  const c = new GameClock();
  for (let i = 0; i < 39600; i++) c.tick();
  assert.equal(c.time, 39600 * FIXED_TIMESTEP);
  assert.ok(Math.abs(c.time - 660) < 1e-9);
});

test('in-game hours map linearly across the configured night', () => {
  const c = new GameClock({ nightDurationSeconds: 660 });
  const at = (seconds) => {
    c.reset();
    for (let i = 0; i < Math.round(seconds / FIXED_TIMESTEP); i++) c.tick();
    return c;
  };
  assert.equal(at(0).hourIndex, 0);
  assert.equal(at(109.9).hourIndex, 0);
  assert.equal(at(110).hourIndex, 1);
  assert.equal(at(330).hourIndex, 3);
  assert.ok(Math.abs(at(330).gameHours - 3) < 1e-9);
  assert.equal(at(659.99).hourIndex, 5);
  assert.equal(at(660).isNightOver, true);
  assert.equal(at(660).hourIndex, 5);
});

test('night duration is configurable', () => {
  const sim = new Simulation({ seed: 'short', config: { nightDurationSeconds: 60 } });
  sim.runFor(10);
  assert.equal(sim.progression.hourIndex, 1);
  assert.equal(GAME_CONFIG.nightDurationSeconds, 660);
});

test('time formatting', () => {
  assert.equal(formatGameClock(0), '12:00 AM');
  assert.equal(formatGameClock(5.5), '5:30 AM');
  assert.equal(formatGameClock(6), '6:00 AM');
  assert.equal(formatHour12(0), '12 AM');
  assert.equal(formatHour12(3), '3 AM');
  assert.equal(formatDebugTime(3 + 42 / 60 + 18.1 / 3600), '03:42:18.100');
});

/** Drives a simulation with a sequence of frame deltas until `seconds` of real time pass. */
function driveWithFrames(seed, seconds, nextDelta, options = {}) {
  const sim = new Simulation({ seed, ...options });
  let elapsed = 0;
  while (elapsed < seconds) {
    const d = Math.min(nextDelta(), seconds - elapsed);
    elapsed += d;
    sim.advance(d);
  }
  return sim;
}

test('AI outcomes are independent of rendering frame rate', () => {
  const seconds = 300;
  const fps30 = driveWithFrames('fps', seconds, () => 1 / 30);
  const fps144 = driveWithFrames('fps', seconds, () => 1 / 144);
  const jitterRng = new Random('jitter');
  const jitter = driveWithFrames('fps', seconds, () => 0.002 + jitterRng.next() * 0.09);
  const sims = [fps30, fps144, jitter];
  const minStep = Math.min(...sims.map((s) => s.clock.stepCount));
  const maxStep = Math.max(...sims.map((s) => s.clock.stepCount));
  assert.ok(maxStep - minStep <= 1, `step counts ${sims.map((s) => s.clock.stepCount)}`);
  const cutoff = minStep * FIXED_TIMESTEP - 0.001;
  const opportunities = (sim) =>
    JSON.stringify(
      sim.log.buffer
        .filter((r) => r.type === 'OPPORTUNITY' && r.time <= cutoff)
        .map((r) => [r.entityId, r.time.toFixed(4), r.roll, r.outcome, r.to])
    );
  const ref = opportunities(fps30);
  assert.ok(ref.length > 100);
  assert.equal(opportunities(fps144), ref);
  assert.equal(opportunities(jitter), ref);
});

test('long frames never skip movement opportunities', () => {
  // AI 0 everywhere so no breach ends the run early; rolls still happen.
  const schedule = { SUBJECT_01: [0], SUBJECT_02: [0], SUBJECT_03: [0], SUBJECT_04: [0] };
  const steady = driveWithFrames('hitch', 120, () => 1 / 60, { schedule });
  let i = 0;
  const hitchy = driveWithFrames('hitch', 120, () => (++i % 7 === 0 ? 1.5 : 1 / 60), { schedule });
  for (const id of ['SUBJECT_01', 'SUBJECT_02', 'SUBJECT_03', 'SUBJECT_04']) {
    const a = steady.ai.get(id).stats.opportunities;
    const b = hitchy.ai.get(id).stats.opportunities;
    assert.equal(a, b, `${id}: ${a} vs ${b}`);
    assert.equal(a, Math.floor(120 / steady.ai.get(id).movementInterval + 1e-9));
  }
});
