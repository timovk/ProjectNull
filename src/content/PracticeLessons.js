import { ENTITY_IDS } from '../config/GameConfig.js';

const { WANDERER, OBSERVER, ECHO, PATIENT } = ENTITY_IDS;

export const PRACTICE_NAMES = {
  [WANDERER]: 'The Wanderer (W)',
  [OBSERVER]: 'The Observer (O)',
  [ECHO]: 'The Echo (E)',
  [PATIENT]: 'The Patient (P)'
};

const at = (sim, id) => sim.ai.get(id).currentRoom;
const sideOf = (room) => (room.startsWith('WEST') ? 'west' : 'east');
const inVents = (sim) => ['VENT_SHAFT', 'VENT_DUCT'].includes(at(sim, ECHO));
const atApproach = (room) => room === 'WEST_APPROACH' || room === 'EAST_APPROACH';

/** A door-using subject outside an open door. */
function threatAtOpenDoor(sim) {
  for (const id of [WANDERER, OBSERVER]) {
    const room = at(sim, id);
    if (!atApproach(room)) continue;
    const door = room === 'WEST_APPROACH' ? 'WEST_DOOR' : 'EAST_DOOR';
    if (!sim.security.isDoorClosed(door)) return { id, room, door };
  }
  return null;
}

/**
 * Guided practice lessons. Each one appears when its real situation happens
 * in the simulation and stays until the player has done the right thing.
 *
 *   trigger(sim, game)          when the lesson becomes relevant
 *   activate(sim, game) -> ctx  snapshot taken when it appears
 *   complete(sim, game, ctx)    done
 *   urgent                      time runs at half speed until completed
 *   info: seconds               informational: completes after that long
 *   after                       only after this lesson is done
 */
export const LESSONS = [
  {
    id: 'welcome',
    info: 9,
    trigger: () => true,
    text: () => 'This is a practice night. It cannot be lost: if something gets in, it is sent back and you are told what went wrong. When something urgent happens, time slows to half speed until you deal with it.'
  },
  {
    id: 'sit',
    after: 'welcome',
    trigger: () => true,
    text: () => 'Walk to the desk (W A S D) and press E while looking at the middle screen. That is your camera computer.',
    complete: (sim, g) => g.workstationOpen,
    success: 'These are your cameras.'
  },
  {
    id: 'cams',
    after: 'sit',
    trigger: (sim, g) => g.workstationOpen,
    activate: (sim) => ({ start: sim.surveillance.usage.switches }),
    text: () => 'Switch cameras with the number keys (1-9, 0, -, =) or click a room on the map. In practice, the coloured dots show where each creature really is. Press E to stand up.',
    complete: (sim, g, ctx) => sim.surveillance.usage.switches - ctx.start >= 3,
    success: 'Good. Glance through the cameras often.'
  },
  {
    id: 'door',
    urgent: true,
    trigger: (sim) => !!threatAtOpenDoor(sim),
    activate: (sim) => threatAtOpenDoor(sim),
    text: (sim, g, ctx) => `${PRACTICE_NAMES[ctx.id]} is right outside the ${sideOf(ctx.room)} door! Stand up (E), go to the panel beside the ${sideOf(ctx.room)} door and press the TOP button to close it.`,
    complete: (sim, g, ctx) => sim.security.isDoorClosed(ctx.door) || at(sim, ctx.id) !== ctx.room,
    success: 'Door shut. Open it again once it walks away (peek through the door window). Closed doors drain a lot of power.'
  },
  {
    id: 'light',
    trigger: (sim) => {
      const r = at(sim, WANDERER);
      return (r === 'WEST_CORRIDOR' || r === 'EAST_CORRIDOR') && !sim.security.isCorridorLit(r);
    },
    activate: (sim) => ({ room: at(sim, WANDERER) }),
    text: (sim, g, ctx) => `${PRACTICE_NAMES[WANDERER]} is in the ${sideOf(ctx.room)} corridor, heading your way. Press the BOTTOM button on the ${sideOf(ctx.room)} door panel to light that corridor. It hates light and usually turns back.`,
    complete: (sim, g, ctx) => sim.security.isCorridorLit(ctx.room) || at(sim, WANDERER) !== ctx.room,
    success: 'Turn the light off again once it has gone. Lights drain power too.'
  },
  {
    id: 'observer',
    trigger: (sim) => sim.time > 115,
    activate: () => ({ seen: false }),
    text: () => `${PRACTICE_NAMES[OBSERVER]} is out of its cell (it started on CAM 02). Find it on the cameras, look at it for a moment, then switch away. Staring too long makes it agitated; ignoring it makes it bold.`,
    complete: (sim, g, ctx) => {
      const o = sim.ai.get(OBSERVER);
      if (o.watched) ctx.seen = true;
      return ctx.seen && !o.watched;
    },
    success: 'That is how you handle it: a short look every half minute or so.'
  },
  {
    id: 'fan',
    urgent: true,
    trigger: (sim) => inVents(sim) && sim.security.fan && !sim.power.failed,
    text: () => `Scraping in the vents: ${PRACTICE_NAMES[ECHO]}. It only drops in if the room is loud. Switch the FAN off (switch under the fan, top-right of the desk wall), and the radio on the shelf. Don't open or close doors while it's up there.`,
    complete: (sim) => !sim.security.fan || !inVents(sim),
    success: 'Quiet. The right-hand desk screen shows how loud the room is: keep the line under the red line.'
  },
  {
    id: 'fanBack',
    after: 'fan',
    trigger: (sim) => !sim.security.fan && !inVents(sim) && !sim.power.failed,
    text: () => 'The Echo has left the vents. Switch the fan back ON, or the camera computer overheats.',
    complete: (sim) => sim.security.fan || inVents(sim),
    success: 'Fan back on.'
  },
  {
    id: 'field',
    urgent: true,
    trigger: (sim) => atApproach(at(sim, PATIENT)) && !sim.security.barrierActive && !sim.power.failed,
    activate: (sim) => ({ room: at(sim, PATIENT) }),
    text: (sim, g, ctx) => `${PRACTICE_NAMES[PATIENT]} is at the ${sideOf(ctx.room)} door. A closed door only slows it down. Use the lever on the console against the back wall to switch the containment field ON, and keep it on until it leaves (about 20 seconds).`,
    complete: (sim) => sim.security.barrierActive || !atApproach(at(sim, PATIENT)),
    success: 'Field on. Keep it on until you hear it walk away.'
  },
  {
    id: 'fieldOff',
    after: 'field',
    trigger: (sim) => sim.security.barrierActive && !atApproach(at(sim, PATIENT)),
    text: () => 'It is leaving. Switch the field OFF now: it burns power very fast.',
    complete: (sim) => !sim.security.barrier || atApproach(at(sim, PATIENT)),
    success: 'Field off.'
  },
  {
    id: 'relay',
    trigger: (sim) => sim.surveillance.faults.size > 0,
    text: () => 'A camera lost its signal. Hold E on the SIGNAL RELAY box on the back wall to fix it, or wait for it to come back on its own.',
    complete: (sim) => sim.surveillance.faults.size === 0,
    success: 'Cameras restored.'
  },
  {
    id: 'power',
    info: 10,
    trigger: (sim) => sim.power.level < 50,
    text: () => 'Power is under half. Only close doors while something is right outside, and switch lights off when you are done. A one-time battery boost is in the electrical room, through the back door.'
  },
  {
    id: 'blackout',
    urgent: true,
    info: 12,
    trigger: (sim) => sim.power.failed,
    text: () => 'Power is out. Hold E on the yellow lever beside a door to hold that door shut by hand. The battery in the electrical room can bring some power back.'
  }
];

/** What to say when something gets in during practice. */
export function practiceBreachText(b) {
  const who = PRACTICE_NAMES[b.entityId] ?? b.name;
  if (b.via === 'VENT') {
    return `${who} dropped in through the ceiling vent because the room was too loud. In a real night that would end it. When it's in the vents: fan off, radio off, don't move doors. It has been sent back.`;
  }
  const side = b.via === 'WEST_DOOR' ? 'west' : 'east';
  if (b.entityId === PATIENT) {
    return `${who} came in through the ${side} door. In a real night that would end it. When it is at a door, switch the containment field on and keep it on until it leaves. It has been sent back.`;
  }
  return `${who} walked in through the open ${side} door. In a real night that would end it. Close a door while something is right outside it. It has been sent back.`;
}
