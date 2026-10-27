/**
 * How sound travels between the security station and the spaces around it.
 * Pure functions (no Web Audio) so the rules can be tested.
 *
 * Zones:
 *   STATION  the security office
 *   WEST     beyond the west door (the approach)
 *   EAST     beyond the east door
 *   VENT     the duct and shaft above the ceiling
 *   BACK     the maintenance corridor, electrical room and pump room
 *   FAR      the facility north of the station, reached through the corridors
 *
 * Walls and closed doors take the highs off a sound (a high-shelf cut, in dB)
 * rather than its level, so every cue stays audible: an open door is heard as
 * a brighter, closer sound, never as the difference between hearing a subject
 * and not hearing it.
 */

const CEILING = 3.2;
const NORTH_WALL = -3.6;
const SOUTH_WALL = 3.5;
const SIDE_WALL = 4.7; // the door frames sit at x ±4.5 and belong to the station

export function zoneOf({ x, y, z }) {
  if (y > CEILING) return 'VENT';
  if (z > SOUTH_WALL) return 'BACK';
  if (z < NORTH_WALL) return 'FAR';
  if (x < -SIDE_WALL) return 'WEST';
  if (x > SIDE_WALL) return 'EAST';
  return 'STATION';
}

/** Which reverb a sound at `pos` excites: the small office, or the concrete beyond it. */
export function reverbSpace(pos) {
  return !pos || zoneOf(pos) === 'STATION' ? 'room' : 'hall';
}

// Tuned against the cues themselves: the Echo's whisper is nearly all highs,
// so these cuts are also roughly its level loss. With its slightly raised
// peak (AudioSystem.whisper) it stays within ~2.5 dB of its old, unoccluded level.
// The far facility is heard through the same doors, so it is cut as much as a
// closed door and then dulled further by distance (airCutoff).
export const OCCLUSION_DB = Object.freeze({
  doorClosed: 6,
  doorOpen: 2,
  vent: 4,
  back: 3, // the maintenance corridor opens straight onto the station
  far: 6,
  farDoorOpen: 4
});

/** High-shelf loss (dB, positive) between the station and a sound in `zone`. */
function lossFromStation(zone, pos, doors) {
  switch (zone) {
    case 'STATION':
      return 0;
    case 'WEST':
      return doors.westOpen ? OCCLUSION_DB.doorOpen : OCCLUSION_DB.doorClosed;
    case 'EAST':
      return doors.eastOpen ? OCCLUSION_DB.doorOpen : OCCLUSION_DB.doorClosed;
    case 'VENT':
      return OCCLUSION_DB.vent;
    case 'BACK':
      return OCCLUSION_DB.back;
    default: {
      const open = pos.x < -1 ? doors.westOpen : pos.x > 1 ? doors.eastOpen : doors.westOpen || doors.eastOpen;
      return open ? OCCLUSION_DB.farDoorOpen : OCCLUSION_DB.far;
    }
  }
}

/**
 * The filtering a sound at `pos` gets on its way to the listener.
 * @param doors { westOpen, eastOpen }
 * @returns { shelfDb, lowpass } shelfDb <= 0, lowpass in Hz (air absorption)
 */
export function soundPath(listener, pos, doors) {
  const from = zoneOf(listener);
  const to = zoneOf(pos);
  let loss = 0;
  if (from === to) loss = 0;
  else if (from === 'STATION') loss = lossFromStation(to, pos, doors);
  else if (from === 'BACK') loss = OCCLUSION_DB.back + lossFromStation(to, pos, doors);
  const d = Math.hypot(pos.x - listener.x, pos.y - listener.y, pos.z - listener.z);
  return { shelfDb: -Math.min(14, loss), lowpass: airCutoff(d) };
}

/** Distant sounds lose their top end; never below 7 kHz, so nothing goes dull. */
export function airCutoff(distance) {
  return Math.max(7000, 20000 * Math.exp(-distance / 25));
}
