import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/core/Simulation.js';
import { runMovementOpportunity, OUTCOMES } from '../src/ai/MovementOpportunity.js';
import * as BM from '../src/ai/BehaviorModifiers.js';
import { ENTITY_IDS, ENTITY_ORDER, AI_SCHEDULE, ENTITY_DEFS } from '../src/config/GameConfig.js';
import { STATION } from '../src/config/FacilityLayout.js';

const { WANDERER, OBSERVER, ECHO, PATIENT } = ENTITY_IDS;
const ZERO = { SUBJECT_01: [0], SUBJECT_02: [0], SUBJECT_03: [0], SUBJECT_04: [0] };

/** Test placement: the entity counts as having arrived long ago (settled). */
function place(entity, room, state = 'ROAMING') {
  entity.currentRoom = room;
  entity.state = state;
  entity.frustration = 0;
  entity.retreatPath = null;
  entity.roomEnteredAt = -1000;
}

function quietStation(sim, { keepRack = false } = {}) {
  sim.command({ type: 'FAN', on: false });
  if (!keepRack) sim.command({ type: 'RACK', on: false });
  sim.command({ type: 'RADIO', on: false });
  sim.command({ type: 'STATION_LIGHTS', mode: 'LOW' });
  sim.noise.pulses.door = 0;
  sim.noise.update(0);
}

// ------------------------------------------------------------ timers

test('each entity has an independent movement timer', () => {
  const sim = new Simulation({ seed: 'timers', schedule: ZERO });
  sim.runFor(120);
  for (const e of sim.ai.entities) {
    assert.equal(e.stats.opportunities, Math.floor(120 / e.movementInterval + 1e-9), e.id);
  }
  assert.equal(sim.ai.get(WANDERER).stats.opportunities, 24);
  assert.equal(sim.ai.get(OBSERVER).stats.opportunities, 18);
  assert.equal(sim.ai.get(ECHO).stats.opportunities, 28);
  assert.equal(sim.ai.get(PATIENT).stats.opportunities, 15);
});

test('opportunities are scheduled on exact multiples of the interval', () => {
  const sim = new Simulation({ seed: 'exact', schedule: ZERO });
  sim.runFor(60);
  const times = sim.log.buffer.filter((r) => r.type === 'OPPORTUNITY' && r.entityId === ECHO).map((r) => r.time);
  times.forEach((t, i) => assert.ok(Math.abs(t - 4.2 * (i + 1)) < 1e-9, `${t}`));
});

test('simultaneous opportunities resolve in a deterministic order', () => {
  const sim = new Simulation({ seed: 'simul', schedule: ZERO });
  for (const e of sim.ai.entities) {
    e.movementInterval = 5;
    e.nextOpportunityAt = 5;
  }
  sim.runFor(20);
  const recs = sim.log.buffer.filter((r) => r.type === 'OPPORTUNITY');
  assert.equal(recs.length, 16);
  for (let k = 0; k < 4; k++) {
    assert.deepEqual(recs.slice(k * 4, k * 4 + 4).map((r) => r.entityId), [...ENTITY_ORDER]);
  }
});

// ------------------------------------------------------------ AI levels

test('AI levels follow the configured schedule at each hour', () => {
  const sim = new Simulation({ seed: 'schedule' });
  const seen = {};
  const secondsPerHour = sim.clock.secondsPerHour;
  for (let h = 0; h < 6; h++) {
    if (h > 0) sim.runFor(secondsPerHour);
    // Keep the player alive: AI levels are what we are checking here.
    for (const e of sim.ai.entities) place(e, e.homeRoom, e.aiLevel > 0 ? 'IDLE' : 'DORMANT');
    if (sim.phase !== 'RUNNING') break;
    for (const id of ENTITY_ORDER) (seen[id] ??= []).push(sim.ai.get(id).aiLevel);
  }
  if (sim.phase === 'RUNNING') {
    for (const id of ENTITY_ORDER) assert.deepEqual(seen[id], AI_SCHEDULE[id], id);
  }
});

test('AI levels are capped to 0..20', () => {
  const sim = new Simulation({
    seed: 'cap',
    schedule: { SUBJECT_01: [35], SUBJECT_02: [-4], SUBJECT_03: [20], SUBJECT_04: [7.6] }
  });
  assert.equal(sim.ai.get(WANDERER).aiLevel, 20);
  assert.equal(sim.ai.get(OBSERVER).aiLevel, 0);
  assert.equal(sim.ai.get(ECHO).aiLevel, 20);
  assert.equal(sim.ai.get(PATIENT).aiLevel, 8);
  const o = sim.ai.get(OBSERVER);
  o.setAILevel(19);
  o.agitation = 10; // +4
  sim.power.fail(); // +2
  assert.equal(o.getEffectiveAI(sim), 20);
});

// ------------------------------------------------------------ determinism

function scriptedNight(seed) {
  const sim = new Simulation({ seed });
  const script = new Map([
    [600, { type: 'LIGHT', room: 'EAST_CORRIDOR', on: true }],
    [900, { type: 'VIEW', viewing: true }],
    [901, { type: 'CAMERA', room: 'CONTAINMENT_B' }],
    [2400, { type: 'DOOR', door: 'WEST_DOOR', closed: true }],
    [4000, { type: 'FAN', on: false }],
    [6000, { type: 'PING', room: 'RESEARCH_HALL' }],
    [8000, { type: 'DOOR', door: 'WEST_DOOR', closed: false }]
  ]);
  for (let step = 0; step < 14000 && sim.phase === 'RUNNING'; step++) {
    const cmd = script.get(step);
    if (cmd) sim.command(cmd);
    sim.step();
  }
  return sim;
}

test('same seed + same commands => identical AI outcomes', () => {
  const a = scriptedNight('determinism');
  const b = scriptedNight('determinism');
  const strip = (sim) => JSON.stringify(sim.log.buffer.map(({ seq, ...r }) => r));
  assert.equal(strip(a), strip(b));
  assert.equal(a.phase, b.phase);
});

test('replaying the recorded command history reproduces the night', () => {
  const original = scriptedNight('replay');
  const replay = new Simulation({ seed: 'replay' });
  const byStep = new Map();
  for (const { step, cmd } of original.commandHistory) {
    if (!byStep.has(step)) byStep.set(step, []);
    byStep.get(step).push(cmd);
  }
  while (replay.phase === 'RUNNING' && replay.clock.stepCount < original.clock.stepCount) {
    for (const cmd of byStep.get(replay.clock.stepCount) ?? []) replay.command(cmd);
    replay.step();
  }
  const strip = (sim) => JSON.stringify(sim.log.buffer.map(({ seq, ...r }) => r));
  assert.equal(strip(replay), strip(original));
});

test('different seeds diverge', () => {
  const a = scriptedNight('seed-a');
  const b = scriptedNight('seed-b');
  const rolls = (sim) => sim.log.buffer.filter((r) => r.type === 'OPPORTUNITY').map((r) => r.roll).join(',');
  assert.notEqual(rolls(a), rolls(b));
});

// ------------------------------------------------------------ attribute formulas

test('attribute formulas match their documentation', () => {
  assert.equal(BM.approachFactor(0, -1), 1);
  assert.equal(BM.approachFactor(20, -1), 3);
  assert.equal(BM.approachFactor(20, 1), 0.5);
  assert.equal(BM.approachFactor(10, 0), 1);
  assert.ok(BM.approachFactor(20, 1) > 0, 'moving away must stay possible');
  assert.equal(BM.lightDeterrence(0), 0.4);
  assert.equal(BM.lightDeterrence(20), 1);
  assert.equal(BM.hearingRange(14), 4);
  assert.equal(BM.obstacleTolerance(0), 1);
  assert.equal(BM.obstacleTolerance(16), 5);
  assert.equal(BM.obstacleTolerance(20), 6);
  assert.equal(BM.informedChance(10), 0.5);
  assert.equal(BM.clampAttribute(99), 20);
  assert.equal(BM.clampAttribute(-5), 0);
});

test('aggression biases route selection toward the station', () => {
  const pickRate = (aggression) => {
    const sim = new Simulation({ seed: `aggr-${aggression}` });
    const w = sim.ai.get(WANDERER);
    w.attributes.aggression = aggression;
    w.attributes.intelligence = 0;
    let closer = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) {
      place(w, 'CENTRAL_JUNCTION');
      const d = w.decideRoute(sim);
      if (d.to === 'EAST_CORRIDOR' || d.to === 'WEST_CORRIDOR') closer++;
    }
    return closer / n;
  };
  // From the junction: two closer corridors and one farther room.
  const low = pickRate(0); // weights 1,1,1 -> 2/3
  const high = pickRate(20); // weights 3,3,0.5 -> 6/6.5
  assert.ok(Math.abs(low - 2 / 3) < 0.015, `low ${low}`);
  assert.ok(Math.abs(high - 6 / 6.5) < 0.015, `high ${high}`);
});

test('intelligence: informed entities route around a closed door', () => {
  const rate = (intelligence) => {
    const sim = new Simulation({ seed: `int-${intelligence}` });
    sim.command({ type: 'DOOR', door: 'EAST_DOOR', closed: true });
    const w = sim.ai.get(WANDERER);
    w.attributes.intelligence = intelligence;
    let toApproach = 0;
    const n = 10000;
    for (let i = 0; i < n; i++) {
      place(w, 'EAST_CORRIDOR');
      if (w.decideRoute(sim).to === 'EAST_APPROACH') toApproach++;
    }
    return toApproach / n;
  };
  const naive = rate(0);
  const smart = rate(20);
  assert.ok(naive > 0.6, `naive ${naive}`);
  // Informed: the approach is now "farther" (x0.75) and the junction closer (x2.0).
  assert.ok(Math.abs(smart - 0.75 / 2.75) < 0.02, `smart ${smart}`);
});

test('patience: blocked attempts before retreat = 1 + floor(patience/4)', () => {
  const sim = new Simulation({ seed: 'patience' });
  const w = sim.ai.get(WANDERER);
  w.setAILevel(20);
  place(w, 'EAST_APPROACH', 'WAITING');
  sim.command({ type: 'DOOR', door: 'EAST_DOOR', closed: true });
  const tolerance = BM.obstacleTolerance(w.attributes.patience);
  for (let i = 1; i < tolerance; i++) {
    const rec = runMovementOpportunity(w, sim);
    assert.equal(rec.outcome, OUTCOMES.ATTACK_BLOCKED);
    assert.equal(rec.reaction, 'WAIT');
  }
  const last = runMovementOpportunity(w, sim);
  assert.equal(last.reaction, 'RETREAT');
  assert.equal(w.state, 'RETREATING');
  const next = runMovementOpportunity(w, sim);
  assert.equal(next.outcome, OUTCOMES.RETREATED);
  assert.equal(next.to, 'EAST_CORRIDOR');
});

// ------------------------------------------------------------ countermeasures

test('fairness: an entity settles at a threshold for 1.5 intervals before its first entry attempt', () => {
  const sim = new Simulation({ seed: 'settle' });
  const w = sim.ai.get(WANDERER);
  w.setAILevel(20);
  place(w, 'EAST_APPROACH', 'WAITING');
  w.roomEnteredAt = sim.time; // just arrived
  const first = runMovementOpportunity(w, sim);
  assert.equal(first.rollSuccess, true);
  assert.equal(first.outcome, OUTCOMES.STAYED);
  assert.equal(first.reason, 'SETTLING');
  assert.equal(sim.phase, 'RUNNING');
  // Simulate the passage of 1.5 intervals: now it may enter.
  w.roomEnteredAt = sim.time - w.movementInterval * 1.5;
  assert.equal(runMovementOpportunity(w, sim).outcome, OUTCOMES.ATTACK_SUCCESS);
});

test('fairness: from arrival at a door to a breach takes at least two Wanderer intervals', () => {
  for (let i = 0; i < 20; i++) {
    const sim = new Simulation({ seed: `window-${i}`, schedule: { SUBJECT_01: [20], SUBJECT_02: [0], SUBJECT_03: [0], SUBJECT_04: [0] } });
    sim.facility.gates.CELL_A_LOCK.open = true;
    let arrivedAt = null;
    sim.bus.on('entity:moved', ({ entityId, to }) => {
      if (entityId === WANDERER && to.endsWith('APPROACH')) arrivedAt = sim.time;
    });
    sim.runFor(200);
    if (sim.phase === 'BREACHED') assert.ok(sim.breach.time - arrivedAt >= 2 * 5 - 1e-6, `window ${sim.breach.time - arrivedAt}`);
  }
});

test('closed security doors stop the Wanderer and the Observer', () => {
  for (const id of [WANDERER, OBSERVER]) {
    const sim = new Simulation({ seed: `door-${id}` });
    const e = sim.ai.get(id);
    e.setAILevel(20);
    sim.command({ type: 'DOOR', door: 'WEST_DOOR', closed: true });
    for (let i = 0; i < 200; i++) {
      place(e, 'WEST_APPROACH', 'WAITING');
      if (id === OBSERVER) e.detected = false;
      const rec = runMovementOpportunity(e, sim);
      assert.equal(rec.outcome, OUTCOMES.ATTACK_BLOCKED);
    }
    assert.equal(sim.phase, 'RUNNING');
    sim.command({ type: 'DOOR', door: 'WEST_DOOR', closed: false });
    place(e, 'WEST_APPROACH', 'WAITING');
    const rec = runMovementOpportunity(e, sim);
    assert.equal(rec.outcome, OUTCOMES.ATTACK_SUCCESS);
    assert.equal(sim.phase, 'BREACHED');
    assert.equal(sim.breach.entityId, id);
  }
});

test('Wanderer: corridor lighting deters entry with p = 0.4 + 0.6 * awareness/20', () => {
  const sim = new Simulation({ seed: 'light' });
  sim.command({ type: 'LIGHT', room: 'EAST_CORRIDOR', on: true });
  const w = sim.ai.get(WANDERER);
  const edge = sim.graph.getEdge('CENTRAL_JUNCTION', 'EAST_CORRIDOR');
  let blocked = 0;
  const n = 20000;
  for (let i = 0; i < n; i++) {
    const s = w.checkMovement({ type: 'MOVE', to: 'EAST_CORRIDOR' }, edge, sim);
    if (!s.passable) {
      blocked++;
      assert.equal(s.reason, 'LIGHT_DETERRED');
    }
  }
  const expected = BM.lightDeterrence(w.attributes.awareness);
  assert.ok(Math.abs(blocked / n - expected) < 0.015, `${blocked / n} vs ${expected}`);
  // Unlit corridor: never deterred.
  sim.command({ type: 'LIGHT', room: 'EAST_CORRIDOR', on: false });
  assert.equal(w.checkMovement({ type: 'MOVE', to: 'EAST_CORRIDOR' }, edge, sim).passable, true);
});

test('Wanderer flees a corridor when its light comes on', () => {
  const sim = new Simulation({ seed: 'flee' });
  const w = sim.ai.get(WANDERER);
  w.setAILevel(20);
  sim.command({ type: 'LIGHT', room: 'EAST_CORRIDOR', on: true });
  let fled = 0;
  for (let i = 0; i < 2000; i++) {
    place(w, 'EAST_CORRIDOR');
    const rec = runMovementOpportunity(w, sim);
    if (rec.reason === 'FLEEING_LIGHT') {
      fled++;
      assert.equal(rec.to, 'CENTRAL_JUNCTION');
    }
  }
  assert.ok(Math.abs(fled / 2000 - BM.lightDeterrence(w.attributes.awareness)) < 0.04);
});

test('Observer: watching freezes it, raises capped agitation, and agitation raises effective AI', () => {
  const sim = new Simulation({ seed: 'observer', schedule: { ...ZERO, SUBJECT_02: [5] } });
  sim.facility.nextFault = Infinity; // no random signal loss during this test
  const o = sim.ai.get(OBSERVER);
  o.setAILevel(5);
  o.nextOpportunityAt = Infinity; // hold it in view: this test is about agitation, not movement
  place(o, 'CENTRAL_JUNCTION');
  sim.command({ type: 'CAMERA', room: 'CENTRAL_JUNCTION' });
  sim.command({ type: 'VIEW', viewing: true });
  sim.runFor(0.5);
  assert.equal(o.detected, false, 'detection takes time');
  sim.runFor(2.5);
  assert.equal(o.detected, true);
  assert.equal(o.canMove(sim).allowed, false);
  assert.equal(o.canMove(sim).reason, 'UNDER_OBSERVATION');
  sim.runFor(120);
  assert.equal(o.agitation, ENTITY_DEFS[OBSERVER].tuning.agitationCap);
  assert.equal(o.aiBonus(sim), 4);
  assert.equal(o.getEffectiveAI(sim), 9);
  // At high agitation it stops respecting the camera.
  assert.equal(o.canMove(sim).allowed, true);
  // Looking away: agitation decays.
  sim.command({ type: 'VIEW', viewing: false });
  sim.runFor(20);
  assert.ok(o.agitation < 10 && o.agitation > 6);
  assert.equal(o.detected, false);
});

test('Observer: neglect raises route aggression after the grace period', () => {
  const sim = new Simulation({ seed: 'neglect', schedule: ZERO });
  const o = sim.ai.get(OBSERVER);
  assert.equal(o.effectiveAggression(sim), o.attributes.aggression);
  sim.runFor(100);
  assert.ok(Math.abs(o.neglectAggressionBonus() - 4) < 0.05);
  sim.runFor(100);
  assert.equal(o.neglectAggressionBonus(), 8);
  assert.equal(o.effectiveAggression(sim), o.attributes.aggression + 8);
});

test('Observer: suppressed opportunities do not roll', () => {
  const sim = new Simulation({ seed: 'suppressed' });
  const o = sim.ai.get(OBSERVER);
  o.setAILevel(20);
  place(o, 'RESEARCH_HALL');
  o.detected = true;
  o.agitation = 0;
  const rec = runMovementOpportunity(o, sim);
  assert.equal(rec.outcome, OUTCOMES.SUPPRESSED);
  assert.equal(rec.roll, null);
  assert.equal(o.currentRoom, 'RESEARCH_HALL');
});

test('Echo: drawn toward noise, including decoy pings', () => {
  const towardHall = (ping) => {
    const sim = new Simulation({ seed: 'echo-ping', schedule: ZERO });
    sim.runFor(100); // past the acoustic seal release
    quietStation(sim, { keepRack: true });
    sim.facility.gates.DECON_GATE.open = true;
    if (ping) assert.equal(sim.command({ type: 'PING', room: 'RESEARCH_HALL' }).ok, true);
    sim.noise.update(0);
    const e = sim.ai.get(ECHO);
    e.attributes.intelligence = 0;
    let hall = 0;
    for (let i = 0; i < 5000; i++) {
      place(e, 'ACOUSTICS_LAB');
      if (e.decideRoute(sim).to === 'RESEARCH_HALL') hall++;
    }
    return hall / 5000;
  };
  const withoutPing = towardHall(false);
  const withPing = towardHall(true);
  assert.ok(withPing > withoutPing + 0.2, `${withoutPing} -> ${withPing}`);
});

test('Echo: can only drop into a noisy station', () => {
  const sim = new Simulation({ seed: 'echo-entry' });
  const e = sim.ai.get(ECHO);
  e.setAILevel(20);
  quietStation(sim);
  assert.ok(sim.noise.stationNoise < e.listenThreshold(), `quiet ${sim.noise.stationNoise}`);
  place(e, 'VENT_DUCT', 'LISTENING');
  const blocked = runMovementOpportunity(e, sim);
  assert.equal(blocked.outcome, OUTCOMES.ATTACK_BLOCKED);
  assert.equal(blocked.reason, 'SILENCE');
  // In a fully quiet station, a moving door alone stays under the line...
  sim.command({ type: 'DOOR', door: 'EAST_DOOR', closed: true });
  sim.noise.update(0);
  assert.ok(sim.noise.stationNoise < e.listenThreshold(), `door in a quiet station ${sim.noise.stationNoise}`);
  place(e, 'VENT_DUCT', 'LISTENING');
  assert.equal(runMovementOpportunity(e, sim).reason, 'SILENCE');
  // ...but the ventilation fan is loud enough to let it in.
  sim.command({ type: 'RACK', on: true });
  sim.command({ type: 'FAN', on: true });
  sim.noise.update(0);
  assert.ok(sim.noise.stationNoise >= e.listenThreshold());
  place(e, 'VENT_DUCT', 'LISTENING');
  const entered = runMovementOpportunity(e, sim);
  assert.equal(entered.outcome, OUTCOMES.ATTACK_SUCCESS);
  assert.equal(sim.breach.via, 'VENT');
});

test('Echo: security doors do not stop it, it never uses them', () => {
  const sim = new Simulation({ seed: 'echo-door' });
  const e = sim.ai.get(ECHO);
  e.setAILevel(20);
  place(e, 'EAST_APPROACH');
  for (let i = 0; i < 50; i++) {
    const rec = runMovementOpportunity(e, sim);
    assert.notEqual(rec.to, STATION);
    place(e, 'EAST_APPROACH');
  }
});

test('Patient: the containment barrier makes it retreat home after sustained exposure', () => {
  const sim = new Simulation({ seed: 'barrier' });
  const p = sim.ai.get(PATIENT);
  p.setAILevel(3);
  place(p, 'WEST_APPROACH', 'WAITING');
  sim.command({ type: 'BARRIER', on: true });
  const needed = p.barrierRetreatSeconds();
  assert.equal(needed, 10 + 0.75 * 16);
  sim.runFor(needed - 1);
  assert.equal(p.state, 'WAITING');
  sim.runFor(1.1);
  assert.equal(p.state, 'RETREATING');
  assert.equal(p.retreatPath[p.retreatPath.length - 1], 'ISOLATION');
  assert.equal(sim.stats.barrierRepels, 1);
  // While retreating its effective AI is at least the retreat floor.
  assert.ok(p.getEffectiveAI(sim) >= 10);
});

test('Patient: the barrier blocks entry even through an open door', () => {
  const sim = new Simulation({ seed: 'barrier-entry' });
  const p = sim.ai.get(PATIENT);
  p.setAILevel(20);
  sim.command({ type: 'BARRIER', on: true });
  place(p, 'EAST_APPROACH', 'WAITING');
  const rec = runMovementOpportunity(p, sim);
  assert.equal(rec.outcome, OUTCOMES.ATTACK_BLOCKED);
  assert.equal(rec.reason, 'BARRIER');
});

test('Patient: forces a closed door after enough pressure, and the door stays damaged until repaired', () => {
  const sim = new Simulation({ seed: 'force' });
  const p = sim.ai.get(PATIENT);
  p.setAILevel(20);
  place(p, 'EAST_APPROACH', 'WAITING');
  sim.command({ type: 'DOOR', door: 'EAST_DOOR', closed: true });
  const tolerance = BM.obstacleTolerance(p.attributes.patience);
  for (let i = 1; i < tolerance; i++) {
    assert.equal(runMovementOpportunity(p, sim).reaction, `PRESSURE ${i}/${tolerance}`);
  }
  assert.equal(runMovementOpportunity(p, sim).reaction, 'DOOR_FORCED');
  assert.equal(sim.security.doors.EAST_DOOR.damaged, true);
  assert.equal(sim.security.isDoorClosed('EAST_DOOR'), false);
  assert.equal(sim.command({ type: 'DOOR', door: 'EAST_DOOR', closed: true }).reason, 'MOTOR_DAMAGED');
  assert.equal(sim.command({ type: 'REPAIR_DOOR', door: 'EAST_DOOR' }).ok, true);
  assert.equal(sim.command({ type: 'DOOR', door: 'EAST_DOOR', closed: true }).ok, true);
});

test('Patient: hears its door open and reacts with an extra opportunity', () => {
  const sim = new Simulation({ seed: 'react' });
  const p = sim.ai.get(PATIENT);
  p.setAILevel(1);
  sim.command({ type: 'DOOR', door: 'WEST_DOOR', closed: true });
  place(p, 'WEST_APPROACH', 'WAITING');
  p.onEnteredRoom(sim);
  sim.runFor(1);
  sim.command({ type: 'DOOR', door: 'WEST_DOOR', closed: false });
  sim.runFor(1 / 30);
  assert.equal(p.bonusOpportunities.length, 1);
  sim.runFor(p.reactionDelay() + 0.1);
  const reactive = sim.log.buffer.filter((r) => r.type === 'OPPORTUNITY' && r.entityId === PATIENT && r.kind === 'REACTIVE');
  assert.equal(reactive.length, 1);
});

test('Patient: resolve raises effective AI the longer it waits', () => {
  const sim = new Simulation({ seed: 'resolve' });
  const p = sim.ai.get(PATIENT);
  p.setAILevel(2);
  sim.command({ type: 'BARRIER', on: false });
  place(p, 'EAST_APPROACH', 'WAITING');
  p.waitTime = 0;
  assert.equal(p.getEffectiveAI(sim), 2);
  p.waitTime = 45;
  assert.equal(p.getEffectiveAI(sim), 4);
  p.waitTime = 1000;
  assert.equal(p.getEffectiveAI(sim), 2 + p.maxResolve());
});

test('power failure removes powered protection but is not an instant death', () => {
  const sim = new Simulation({ seed: 'blackout' });
  sim.command({ type: 'DOOR', door: 'EAST_DOOR', closed: true });
  sim.power.level = 0.01;
  sim.runFor(1);
  assert.equal(sim.power.failed, true);
  assert.equal(sim.phase, 'RUNNING');
  assert.equal(sim.isDoorClosed('EAST_DOOR'), false);
  const w = sim.ai.get(WANDERER);
  assert.equal(w.getEffectiveAI(sim), Math.min(20, w.aiLevel + 2));
});

test('practice mode: a breach is logged and the entity goes home; the night continues', () => {
  const sim = new Simulation({ seed: 'practice', practice: true });
  const w = sim.ai.get(WANDERER);
  w.setAILevel(20);
  place(w, 'EAST_APPROACH', 'WAITING');
  let event = null;
  sim.bus.on('sim:practiceBreach', (b) => (event = b));
  const rec = runMovementOpportunity(w, sim);
  assert.equal(rec.outcome, OUTCOMES.ATTACK_SUCCESS);
  assert.equal(sim.phase, 'RUNNING');
  assert.equal(sim.breach, null);
  assert.equal(w.currentRoom, w.homeRoom);
  assert.equal(event.entityId, WANDERER);
  assert.equal(event.via, 'EAST_DOOR');
  assert.equal(sim.stats.practiceBreaches, 1);
  assert.ok(sim.log.buffer.some((r) => r.type === 'SYSTEM' && r.kind === 'PRACTICE_BREACH'));
  sim.runFor(30);
  assert.equal(sim.phase, 'RUNNING');
});

test('a real night never uses the practice reset', () => {
  const sim = new Simulation({ seed: 'real' });
  const w = sim.ai.get(WANDERER);
  w.setAILevel(20);
  place(w, 'EAST_APPROACH', 'WAITING');
  runMovementOpportunity(w, sim);
  assert.equal(sim.phase, 'BREACHED');
  assert.equal(sim.stats.practiceBreaches, 0);
});
