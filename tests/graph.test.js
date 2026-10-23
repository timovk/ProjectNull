import test from 'node:test';
import assert from 'node:assert/strict';
import { MovementGraph } from '../src/ai/MovementGraph.js';
import { Simulation } from '../src/core/Simulation.js';
import { ENTITY_IDS, ENTITY_DEFS, ENTITY_ORDER } from '../src/config/GameConfig.js';
import { STATION, ROOMS } from '../src/config/FacilityLayout.js';

const { WANDERER, OBSERVER, ECHO, PATIENT } = ENTITY_IDS;
const homes = Object.fromEntries(ENTITY_ORDER.map((id) => [id, ENTITY_DEFS[id].homeRoom]));

const closedWorld = (doors = [], gates = []) => ({
  isDoorClosed: (id) => doors.includes(id),
  isGateOpen: (id) => !gates.includes(id)
});

test('facility graph is structurally valid and every entity can reach the station', () => {
  const g = new MovementGraph();
  assert.deepEqual(g.validate(ENTITY_ORDER, homes), []);
});

test('malformed graphs are rejected', () => {
  assert.throws(() => new MovementGraph({ A: {} }, [{ a: 'A', b: 'B' }]));
  assert.throws(() => new MovementGraph({ A: {} }, [{ a: 'A', b: 'A' }]));
  assert.throws(() => new MovementGraph({ A: {}, B: {} }, [{ a: 'A', b: 'B' }, { a: 'A', b: 'B' }]));
});

test('bidirectional and one-way connections', () => {
  const g = new MovementGraph();
  assert.ok(g.getEdge('RESEARCH_HALL', 'CENTRAL_JUNCTION'));
  assert.ok(g.getEdge('CENTRAL_JUNCTION', 'RESEARCH_HALL'));
  assert.ok(g.getEdge('ACOUSTICS_LAB', 'VENT_SHAFT'));
  assert.equal(g.getEdge('VENT_SHAFT', 'ACOUSTICS_LAB'), null);
  assert.ok(g.getEdge('VENT_DUCT', STATION));
  assert.equal(g.getEdge(STATION, 'VENT_DUCT'), null);
  assert.equal(g.getEdge('CONTAINMENT_A', 'EAST_APPROACH'), null);
});

test('restricted passages: only the Echo uses the vents, and never the doors', () => {
  const g = new MovementGraph();
  for (const id of [WANDERER, OBSERVER, PATIENT]) {
    assert.ok(!g.neighborsFor('STORAGE', id).includes('VENT_SHAFT'), id);
    assert.ok(g.neighborsFor('EAST_APPROACH', id).includes(STATION), id);
  }
  assert.ok(g.neighborsFor('STORAGE', ECHO).includes('VENT_SHAFT'));
  assert.ok(!g.neighborsFor('EAST_APPROACH', ECHO).includes(STATION));
  assert.equal(g.edgeStatus(g.getEdge('VENT_SHAFT', 'VENT_DUCT'), WANDERER, null).reason, 'RESTRICTED');
});

test('locked doors and temporary obstacles block edges dynamically', () => {
  const g = new MovementGraph();
  const door = g.getEdge('EAST_APPROACH', STATION);
  assert.equal(g.edgeStatus(door, WANDERER, closedWorld()).passable, true);
  assert.equal(g.edgeStatus(door, WANDERER, closedWorld(['EAST_DOOR'])).reason, 'DOOR_CLOSED');
  const decon = g.getEdge('RESEARCH_HALL', 'CENTRAL_JUNCTION');
  assert.equal(g.edgeStatus(decon, WANDERER, closedWorld([], ['DECON_GATE'])).reason, 'GATE_CLOSED');
  const bulkhead = g.getEdge('ISOLATION', 'WEST_CORRIDOR');
  assert.equal(g.edgeStatus(bulkhead, PATIENT, closedWorld([], ['ISOLATION_BULKHEAD'])).reason, 'GATE_CLOSED');
});

test('static and dynamic (informed) distances', () => {
  const g = new MovementGraph();
  assert.equal(g.distancesTo(STATION, WANDERER).get('CONTAINMENT_A'), 5);
  assert.equal(g.distancesTo(STATION, ECHO).get('ACOUSTICS_LAB'), 3);
  assert.equal(g.distancesTo(STATION, WANDERER).get('EAST_APPROACH'), 1);
  const informed = g.distancesTo(STATION, WANDERER, closedWorld(['EAST_DOOR']));
  assert.equal(informed.get('EAST_APPROACH'), 5); // must walk around to the west door
  const sealed = g.distancesTo(STATION, WANDERER, closedWorld(['EAST_DOOR', 'WEST_DOOR']));
  assert.equal(sealed.get('EAST_APPROACH'), Infinity);
});

test('shortest paths follow edges and respect restrictions', () => {
  const g = new MovementGraph();
  const p = g.shortestPath('EAST_APPROACH', 'ISOLATION', PATIENT);
  for (let i = 0; i < p.length - 1; i++) assert.ok(g.getEdge(p[i], p[i + 1]), `${p[i]} -> ${p[i + 1]}`);
  assert.equal(g.shortestPath('CONTAINMENT_A', 'VENT_SHAFT', WANDERER), null);
});

test('sound propagates through every connection, including vents', () => {
  const g = new MovementGraph();
  const d = g.soundDistancesFrom(STATION);
  assert.equal(d.get('VENT_DUCT'), 1);
  assert.equal(d.get('VENT_SHAFT'), 2);
  assert.equal(d.get('EAST_APPROACH'), 1);
});

test('across full simulated nights every move follows a valid, allowed edge', () => {
  for (let i = 0; i < 12; i++) {
    const sim = new Simulation({ seed: `graph-${i}`, schedule: { SUBJECT_01: [12], SUBJECT_02: [12], SUBJECT_03: [12], SUBJECT_04: [12] } });
    // Keep the doors shut so the night lasts and entities roam extensively.
    sim.command({ type: 'DOOR', door: 'EAST_DOOR', closed: true });
    sim.command({ type: 'DOOR', door: 'WEST_DOOR', closed: true });
    sim.command({ type: 'FAN', on: false });
    sim.command({ type: 'RACK', on: false });
    sim.command({ type: 'RADIO', on: false });
    sim.command({ type: 'STATION_LIGHTS', mode: 'LOW' });
    // Breaches are recorded but do not end this run: the entity is sent home
    // (via a direct reset, outside the movement system) so roaming continues.
    sim.onBreach = (entity) => {
      entity.currentRoom = entity.homeRoom;
      entity.state = 'ROAMING';
      entity.retreatPath = null;
    };
    sim.power.level = 1e9;
    sim.runFor(300);
    let moves = 0;
    for (const r of sim.log.buffer) {
      if (r.type !== 'OPPORTUNITY') continue;
      if (r.outcome === 'MOVED' || r.outcome === 'RETREATED' || r.outcome === 'ATTACK_SUCCESS') {
        if (r.outcome !== 'ATTACK_SUCCESS') moves++;
        const edge = sim.graph.getEdge(r.from, r.to);
        assert.ok(edge, `${r.entityId} ${r.from} -> ${r.to} is not connected`);
        assert.ok(sim.graph.allowsEntity(edge, r.entityId), `${r.entityId} may not use ${r.from} -> ${r.to}`);
      }
      assert.notEqual(r.outcome, 'INVALID_DESTINATION');
    }
    assert.ok(moves > 20);
    for (const e of sim.ai.entities) {
      assert.ok(ROOMS[e.currentRoom], `${e.id} in unknown room ${e.currentRoom}`);
      if (e.id !== ECHO) assert.notEqual(ROOMS[e.currentRoom].zone, 'vent');
    }
  }
});
