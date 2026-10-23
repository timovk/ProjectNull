import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/core/Simulation.js';
import { hushActive, dreadLevel, THREAT_BY_HOPS } from '../src/systems/EntitySoundscape.js';
import { ROOM_SOUND_PROFILES, speakerOccupants, feedHasAudio } from '../src/systems/CameraSpeaker.js';
import { CAMERA_ROOMS } from '../src/config/FacilityLayout.js';
import { ENTITY_IDS } from '../src/config/GameConfig.js';

// Ambience must carry real information: these check the logic that decides
// when the station hushes, how strong the dread drone is, and what the
// camera speaker can hear.

const { WANDERER, ECHO, PATIENT } = ENTITY_IDS;

test('the station hushes only while an awake subject waits right outside', () => {
  const sim = new Simulation({ seed: 'hush' });
  assert.equal(hushActive(sim), false);
  const w = sim.ai.get(WANDERER);
  w.currentRoom = 'EAST_APPROACH';
  assert.equal(hushActive(sim), true);
  w.state = 'RETREATING';
  assert.equal(hushActive(sim), false, 'a retreating subject does not hush the station');
  w.state = 'WAITING';
  w.setAILevel(0);
  assert.equal(hushActive(sim), false, 'a dormant subject does not hush the station');
  const e = sim.ai.get(ECHO);
  e.setAILevel(3);
  e.currentRoom = 'VENT_DUCT';
  assert.equal(hushActive(sim), true, 'the duct counts as right outside');
});

test('dread grows with proximity and is silent when everything is far away', () => {
  assert.equal(dreadLevel(THREAT_BY_HOPS[4], 0), 0);
  assert.equal(dreadLevel(0, 0), 0);
  const byHops = [3, 2, 1, 0].map((h) => dreadLevel(THREAT_BY_HOPS[h], 0));
  for (let i = 1; i < byHops.length; i++) assert.ok(byHops[i] > byHops[i - 1], `hops ${byHops}`);
  assert.ok(dreadLevel(1, 0) <= 1);
  assert.ok(dreadLevel(1, 5) <= 1);
  // Later hours feel heavier, but only slightly.
  assert.ok(dreadLevel(0, 5) > dreadLevel(0, 0));
  assert.ok(dreadLevel(0, 5) <= 0.15 + 1e-9);
});

test('every camera room has a sound profile', () => {
  for (const room of CAMERA_ROOMS) assert.ok(ROOM_SOUND_PROFILES[room], room);
});

test('the camera speaker only hears awake subjects in the watched room', () => {
  const sim = new Simulation({ seed: 'speaker' });
  sim.ai.get(PATIENT).currentRoom = 'STORAGE'; // AI 0 at the start of the night
  sim.ai.get(WANDERER).currentRoom = 'STORAGE';
  assert.deepEqual(speakerOccupants(sim, 'STORAGE'), [WANDERER]);
  assert.deepEqual(speakerOccupants(sim, 'RESEARCH_HALL'), []);
});

test('dead feeds carry no room audio', () => {
  assert.equal(feedHasAudio('OK'), true);
  assert.equal(feedHasAudio('DISRUPTED'), true);
  for (const s of ['NO_SIGNAL', 'THERMAL', 'OFFLINE', 'NO_POWER']) assert.equal(feedHasAudio(s), false);
});
