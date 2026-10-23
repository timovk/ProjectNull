/**
 * The facility's movement graph as pure data.
 *
 * Rooms carry presentation metadata (camera label, map coordinates) and
 * environmental properties. Edges describe connections:
 *   oneWay   - traversable only from `a` to `b`
 *   only     - whitelist of entity ids allowed to use the edge (restricted passage)
 *   excludes - entity ids that may never use the edge
 *   door     - the edge is closed while that security door is closed
 *   gate     - the edge is closed while that facility gate is shut (locked doors,
 *              temporary obstacles such as the decontamination cycle)
 *   weight   - base selection weight (default 1)
 */

export const STATION = 'SECURITY_STATION';

export const ROOMS = {
  CONTAINMENT_A: { name: 'Containment A', camera: 'CAM 01', zone: 'facility', map: { x: 86, y: 10 }, kind: 'containment' },
  CONTAINMENT_B: { name: 'Containment B', camera: 'CAM 02', zone: 'facility', map: { x: 14, y: 10 }, kind: 'containment' },
  ISOLATION: { name: 'Isolation Ward', camera: 'CAM 03', zone: 'facility', map: { x: 12, y: 62 }, kind: 'isolation' },
  ACOUSTICS_LAB: { name: 'Acoustics Lab', camera: 'CAM 04', zone: 'facility', map: { x: 84, y: 34 }, kind: 'acoustics' },
  RESEARCH_HALL: { name: 'Research Hall', camera: 'CAM 05', zone: 'facility', map: { x: 50, y: 14 }, kind: 'research' },
  STORAGE: { name: 'Cold Storage', camera: 'CAM 06', zone: 'facility', map: { x: 14, y: 36 }, kind: 'storage' },
  CENTRAL_JUNCTION: { name: 'Central Junction', camera: 'CAM 07', zone: 'facility', map: { x: 50, y: 38 }, kind: 'junction' },
  WEST_CORRIDOR: { name: 'West Corridor', camera: 'CAM 08', zone: 'facility', map: { x: 32, y: 60 }, kind: 'corridor', lightable: true, side: 'WEST' },
  EAST_CORRIDOR: { name: 'East Corridor', camera: 'CAM 09', zone: 'facility', map: { x: 68, y: 60 }, kind: 'corridor', lightable: true, side: 'EAST' },
  WEST_APPROACH: { name: 'West Door', camera: 'CAM 10', zone: 'approach', map: { x: 32, y: 82 }, kind: 'approach', side: 'WEST', door: 'WEST_DOOR' },
  EAST_APPROACH: { name: 'East Door', camera: 'CAM 11', zone: 'approach', map: { x: 68, y: 82 }, kind: 'approach', side: 'EAST', door: 'EAST_DOOR' },
  VENT_SHAFT: { name: 'Ventilation Shaft', camera: 'CAM 12', zone: 'vent', map: { x: 50, y: 62 }, kind: 'vent' },
  VENT_DUCT: { name: 'Station Duct', camera: null, zone: 'vent', map: { x: 50, y: 78 }, kind: 'duct' },
  [STATION]: { name: 'Security Station', camera: null, zone: 'player', map: { x: 50, y: 93 }, kind: 'station' }
};

export const CAMERA_ROOMS = Object.keys(ROOMS).filter((id) => ROOMS[id].camera);

export const DOORS = {
  WEST_DOOR: { name: 'West Door', room: 'WEST_APPROACH', corridor: 'WEST_CORRIDOR' },
  EAST_DOOR: { name: 'East Door', room: 'EAST_APPROACH', corridor: 'EAST_CORRIDOR' }
};

/**
 * Gates are locked doors and temporary obstacles. `releaseAtHour` opens a
 * locked gate at that in-game hour (facility automation, not the player).
 */
export const GATES = {
  CELL_A_LOCK: { name: 'Containment A Lock', initiallyOpen: false, releaseAtHour: 0.5 },
  CELL_B_LOCK: { name: 'Containment B Lock', initiallyOpen: false, releaseAtHour: 1.0 },
  ACOUSTIC_SEAL: { name: 'Acoustics Lab Seal', initiallyOpen: false, releaseAtHour: 0.9 },
  ISOLATION_BULKHEAD: { name: 'Isolation Bulkhead', initiallyOpen: false, releaseAtHour: 2.0 },
  DECON_GATE: { name: 'Decontamination Gate', initiallyOpen: true }
};

const ECHO = 'SUBJECT_03';

export const EDGES = [
  { a: 'CONTAINMENT_A', b: 'RESEARCH_HALL', gate: 'CELL_A_LOCK' },
  { a: 'CONTAINMENT_B', b: 'RESEARCH_HALL', gate: 'CELL_B_LOCK' },
  { a: 'ACOUSTICS_LAB', b: 'RESEARCH_HALL', gate: 'ACOUSTIC_SEAL' },
  { a: 'CONTAINMENT_B', b: 'STORAGE', gate: 'CELL_B_LOCK' },
  { a: 'ISOLATION', b: 'STORAGE' },
  { a: 'ISOLATION', b: 'WEST_CORRIDOR', gate: 'ISOLATION_BULKHEAD' },
  { a: 'RESEARCH_HALL', b: 'CENTRAL_JUNCTION', gate: 'DECON_GATE' },
  { a: 'STORAGE', b: 'WEST_CORRIDOR' },
  { a: 'CENTRAL_JUNCTION', b: 'WEST_CORRIDOR' },
  { a: 'CENTRAL_JUNCTION', b: 'EAST_CORRIDOR' },
  { a: 'WEST_CORRIDOR', b: 'WEST_APPROACH' },
  { a: 'EAST_CORRIDOR', b: 'EAST_APPROACH' },
  { a: 'WEST_APPROACH', b: STATION, door: 'WEST_DOOR', excludes: [ECHO] },
  { a: 'EAST_APPROACH', b: STATION, door: 'EAST_DOOR', excludes: [ECHO] },
  // Ventilation network: restricted passages only Subject 03 can use.
  { a: 'ACOUSTICS_LAB', b: 'VENT_SHAFT', oneWay: true, only: [ECHO], gate: 'ACOUSTIC_SEAL' },
  { a: 'STORAGE', b: 'VENT_SHAFT', only: [ECHO] },
  { a: 'VENT_SHAFT', b: 'VENT_DUCT', only: [ECHO] },
  { a: 'VENT_DUCT', b: STATION, oneWay: true, only: [ECHO], vent: true }
];
