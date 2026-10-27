import test from 'node:test';
import assert from 'node:assert/strict';
import { zoneOf, reverbSpace, soundPath, airCutoff, OCCLUSION_DB } from '../src/systems/Acoustics.js';
import { SOUND_POSITIONS } from '../src/systems/EntitySoundscape.js';
import { STATION } from '../src/config/FacilityLayout.js';

// Walls and doors colour sound but must never hide a cue: these check the
// zones, the door rule and the limits on how much a sound can be dulled.

const DESK = { x: 0, y: 1.6, z: -1.5 };
const MAINTENANCE = { x: 2.5, y: 1.6, z: 9 };
const CLOSED = { westOpen: false, eastOpen: false };
const OPEN = { westOpen: true, eastOpen: true };

test('every soundscape position falls in the zone it belongs to', () => {
  assert.equal(zoneOf(SOUND_POSITIONS[STATION]), 'STATION');
  assert.equal(zoneOf(SOUND_POSITIONS.WEST_APPROACH), 'WEST');
  assert.equal(zoneOf(SOUND_POSITIONS.EAST_APPROACH), 'EAST');
  assert.equal(zoneOf(SOUND_POSITIONS.VENT_DUCT), 'VENT');
  assert.equal(zoneOf(SOUND_POSITIONS.VENT_SHAFT), 'VENT');
  for (const room of ['WEST_CORRIDOR', 'EAST_CORRIDOR', 'CENTRAL_JUNCTION', 'STORAGE', 'ISOLATION', 'RESEARCH_HALL', 'CONTAINMENT_A', 'CONTAINMENT_B', 'ACOUSTICS_LAB']) {
    assert.equal(zoneOf(SOUND_POSITIONS[room]), 'FAR', room);
  }
  assert.equal(zoneOf(MAINTENANCE), 'BACK');
  // The door motors sit in the frames and belong to the station.
  assert.equal(zoneOf({ x: -4.5, y: 1.2, z: -0.5 }), 'STATION');
  assert.equal(zoneOf({ x: 4.6, y: 1.2, z: -0.5 }), 'STATION');
});

test('the office has its own short reverb; everything beyond it the long one', () => {
  assert.equal(reverbSpace({ x: 0, y: 0.1, z: 0 }), 'room');
  assert.equal(reverbSpace(null), 'room');
  assert.equal(reverbSpace(SOUND_POSITIONS.WEST_APPROACH), 'hall');
  assert.equal(reverbSpace(MAINTENANCE), 'hall');
});

test('a closed door dulls what is behind it; an open one barely does', () => {
  const pos = SOUND_POSITIONS.WEST_APPROACH;
  assert.equal(soundPath(DESK, pos, CLOSED).shelfDb, -OCCLUSION_DB.doorClosed);
  assert.equal(soundPath(DESK, pos, OPEN).shelfDb, -OCCLUSION_DB.doorOpen);
  // Only the door on that side matters.
  assert.equal(soundPath(DESK, pos, { westOpen: false, eastOpen: true }).shelfDb, -OCCLUSION_DB.doorClosed);
  assert.equal(soundPath(DESK, SOUND_POSITIONS.EAST_APPROACH, { westOpen: false, eastOpen: true }).shelfDb, -OCCLUSION_DB.doorOpen);
});

test('sounds in the room with you are not occluded', () => {
  assert.equal(soundPath(DESK, { x: -3.5, y: 1.2, z: 2 }, CLOSED).shelfDb, -0);
  assert.equal(soundPath(MAINTENANCE, { x: 6, y: 1, z: 11 }, CLOSED).shelfDb, -0);
});

test('the far facility is duller than the door, and an open door on its side helps', () => {
  const far = soundPath(DESK, SOUND_POSITIONS.WEST_CORRIDOR, CLOSED);
  const door = soundPath(DESK, SOUND_POSITIONS.WEST_APPROACH, CLOSED);
  assert.ok(far.shelfDb <= door.shelfDb, 'the far facility is heard through the same door');
  assert.ok(far.lowpass < door.lowpass, 'and dulled further by distance');
  assert.ok(soundPath(DESK, SOUND_POSITIONS.WEST_CORRIDOR, OPEN).shelfDb > far.shelfDb);
});

test('from the maintenance side the station itself is heard through the opening', () => {
  assert.equal(soundPath(MAINTENANCE, { x: 0, y: 1.2, z: -1 }, CLOSED).shelfDb, -OCCLUSION_DB.back);
  assert.ok(soundPath(MAINTENANCE, SOUND_POSITIONS.EAST_APPROACH, CLOSED).shelfDb < -OCCLUSION_DB.back);
});

test('no path dulls a cue past the limits', () => {
  for (const listener of [DESK, MAINTENANCE]) {
    for (const pos of Object.values(SOUND_POSITIONS)) {
      const p = soundPath(listener, pos, CLOSED);
      assert.ok(p.shelfDb >= -14, 'shelf cut is capped');
      assert.ok(p.lowpass >= 7000, 'air absorption keeps the top end');
    }
  }
  assert.equal(airCutoff(0), 20000);
  assert.equal(airCutoff(500), 7000);
});
