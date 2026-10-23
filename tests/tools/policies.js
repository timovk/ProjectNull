/**
 * Scripted player policies used for automated balance testing.
 *
 * Policies only act on information a real player can obtain: what is visible
 * on cameras or through the door windows, what is audible in the vents, and
 * the station's own instruments. They send the same commands the in-game UI
 * sends. `reaction` models human reaction time.
 */
import { ENTITY_IDS } from '../../src/config/GameConfig.js';

const { WANDERER, OBSERVER, ECHO, PATIENT } = ENTITY_IDS;
const APPROACHES = [
  ['EAST_DOOR', 'EAST_APPROACH', 'EAST_CORRIDOR'],
  ['WEST_DOOR', 'WEST_APPROACH', 'WEST_CORRIDOR']
];

/** Does nothing at all. */
export function idlePolicy() {
  return () => {};
}

/** Closes doors when something is at them; ignores every other system. */
export function doorsOnlyPolicy({ reaction = 1.5 } = {}) {
  const since = new Map();
  return (sim) => {
    const held = makeHeld(sim, since, reaction);
    for (const [door, room] of APPROACHES) {
      const threat = [WANDERER, OBSERVER, PATIENT].some((id) => sim.ai.get(id).currentRoom === room);
      const d = sim.security.doors[door];
      if (held(`door:${door}`, threat) && !d.closed && !d.damaged) sim.command({ type: 'DOOR', door, closed: true });
      if (!threat && d.closed) sim.command({ type: 'DOOR', door, closed: false });
    }
    if (sim.power.level < 15 && !sim.auxCellUsed) sim.command({ type: 'AUX_CELL' });
  };
}

/** Uses every countermeasure the way the in-game documents describe. */
export function competentPolicy({ reaction = 1.5, observerCheckEvery = 22, observerCheckFor = 3, repairDelay = 8, echoRooms = ['VENT_SHAFT', 'VENT_DUCT'], lightsEarly = true } = {}) {
  const since = new Map();
  let nextObserverCheck = observerCheckEvery;
  let checkEnds = -1;
  const repairDue = {};
  return (sim) => {
    const t = sim.time;
    const held = makeHeld(sim, since, reaction);
    const at = (id) => sim.ai.get(id).currentRoom;
    const sec = sim.security;

    // Doors.
    for (const [door, room] of APPROACHES) {
      const threat = [WANDERER, OBSERVER, PATIENT].some((id) => at(id) === room);
      const d = sec.doors[door];
      if (held(`door:${door}`, threat) && !d.closed && !d.damaged) sim.command({ type: 'DOOR', door, closed: true });
      if (!threat && d.closed) sim.command({ type: 'DOOR', door, closed: false });
      // Repair a forced door once the approach is clear (models walking to the electrical room).
      if (d.damaged && !threat) {
        repairDue[door] ??= t + repairDelay;
        if (t >= repairDue[door]) {
          sim.command({ type: 'REPAIR_DOOR', door });
          delete repairDue[door];
        }
      } else if (!d.damaged) delete repairDue[door];
    }

    // Corridor lights while the Wanderer is in or next to a corridor.
    for (const [, , corridor] of APPROACHES) {
      const w = at(WANDERER);
      const want = held(`light:${corridor}`, w === corridor || (lightsEarly && w === 'CENTRAL_JUNCTION'));
      const lit = sec.corridorLights[corridor];
      if (want && !lit) sim.command({ type: 'LIGHT', room: corridor, on: true });
      if (!want && lit && !(w === corridor || w === 'CENTRAL_JUNCTION')) sim.command({ type: 'LIGHT', room: corridor, on: false });
    }

    // Echo in the vents: go quiet (fan + radio off). Keep the rack cool otherwise.
    const echoNear = echoRooms.includes(at(ECHO));
    const quiet = held('echo', echoNear) || (echoNear && since.has('echo'));
    if (quiet) {
      if (sec.fan) sim.command({ type: 'FAN', on: false });
      if (sec.radio) sim.command({ type: 'RADIO', on: false });
    } else if (!echoNear) {
      if (!sec.fan && !sim.power.failed) sim.command({ type: 'FAN', on: true });
    }

    // Patient at a door: barrier, unless the Echo is listening in the duct.
    const patientAtDoor = at(PATIENT) === 'EAST_APPROACH' || at(PATIENT) === 'WEST_APPROACH';
    const echoInDuct = at(ECHO) === 'VENT_DUCT';
    const wantBarrier = held('patient', patientAtDoor) && !echoInDuct;
    if (wantBarrier && !sec.barrier) sim.command({ type: 'BARRIER', on: true });
    if (!wantBarrier && sec.barrier) sim.command({ type: 'BARRIER', on: false });

    // Glance at the Observer periodically so it never builds neglect.
    if (t >= nextObserverCheck && checkEnds < 0 && sim.surveillance.operational) {
      sim.command({ type: 'CAMERA', room: at(OBSERVER) === 'SECURITY_STATION' ? 'CENTRAL_JUNCTION' : cameraFor(at(OBSERVER)) });
      sim.command({ type: 'VIEW', viewing: true });
      checkEnds = t + observerCheckFor;
    }
    if (checkEnds >= 0 && t >= checkEnds) {
      sim.command({ type: 'VIEW', viewing: false });
      checkEnds = -1;
      nextObserverCheck = t + observerCheckEvery;
    }

    if (sim.surveillance.faults.size >= 2) sim.command({ type: 'RELAY_RESET' });
    if (sim.power.level < 12 && !sim.auxCellUsed) sim.command({ type: 'AUX_CELL' });
  };
}

function cameraFor(room) {
  // The Observer cannot be in a camera-less room except the duct/station, which it cannot use.
  return room;
}

function makeHeld(sim, since, reaction) {
  return (key, condition) => {
    if (!condition) {
      since.delete(key);
      return false;
    }
    if (!since.has(key)) since.set(key, sim.time);
    return sim.time - since.get(key) >= reaction;
  };
}

/** Runs one full night with a policy. Returns the simulation summary. */
export async function runNight(Simulation, seed, policyFactory, options = {}) {
  const sim = new Simulation({ seed, ...options });
  const policy = policyFactory();
  while (sim.phase === 'RUNNING') {
    policy(sim);
    sim.step();
  }
  return sim.getSummary();
}

export function runNightSync(Simulation, seed, policyFactory, options = {}) {
  const sim = new Simulation({ seed, ...options });
  const policy = policyFactory();
  while (sim.phase === 'RUNNING') {
    policy(sim);
    sim.step();
  }
  return sim.getSummary();
}
