import { ENTITY_IDS } from '../config/GameConfig.js';

const sideOf = (room) => (room?.startsWith('WEST') ? 'west' : 'east');
const at = (sim, id) => sim.ai.get(id).currentRoom;

/**
 * Contextual hints shown once each, the first time their condition holds.
 * They teach mechanics as they become relevant instead of front-loading them.
 */
export const HINTS = [
  {
    id: 'start',
    when: (sim) => sim.time > 3,
    text: () => 'Read the work order on the desk, then sit at the surveillance workstation [E]. Doors and corridor lights are on the panels beside each door.'
  },
  {
    id: 'corridor',
    when: (sim) => ['WEST_CORRIDOR', 'EAST_CORRIDOR'].includes(at(sim, ENTITY_IDS.WANDERER)),
    text: (sim) => `Movement in the ${sideOf(at(sim, ENTITY_IDS.WANDERER))} corridor. That door panel's lower button lights the corridor, which discourages Subject 01. Lighting draws power.`
  },
  {
    id: 'approach',
    when: (sim) => sim.ai.entities.some((e) => e.id !== ENTITY_IDS.ECHO && e.currentRoom.endsWith('APPROACH')),
    text: (sim) => {
      const e = sim.ai.entities.find((x) => x.id !== ENTITY_IDS.ECHO && x.currentRoom.endsWith('APPROACH'));
      return `Something is outside the ${sideOf(e.currentRoom)} door. Close it from the panel beside the door, and check the door window before opening it again.`;
    }
  },
  {
    id: 'observer',
    when: (sim) => sim.ai.get(ENTITY_IDS.OBSERVER).detected,
    text: () => 'Subject 02 has noticed the camera. It holds still while watched, but its agitation builds. Look away before it stops caring, and do not forget it entirely.'
  },
  {
    id: 'echo',
    when: (sim) => ['VENT_SHAFT', 'VENT_DUCT'].includes(at(sim, ENTITY_IDS.ECHO)),
    text: () => 'Scraping in the vents. Subject 03 follows sound and enters through the duct only if the station is loud. Watch the acoustic monitor (right screen): ventilation, radio, moving doors and the field all add noise.'
  },
  {
    id: 'patient',
    when: (sim) => at(sim, ENTITY_IDS.PATIENT).endsWith('APPROACH'),
    text: (sim) => `Subject 04 is at the ${sideOf(at(sim, ENTITY_IDS.PATIENT))} door. A door only delays it. Engage the containment field (south wall) and hold it until it withdraws.`
  },
  {
    id: 'power',
    when: (sim) => sim.power.level < 35,
    text: () => 'Main power below 35%. The emergency power panel can set station lighting to LOW. An auxiliary cell is in the electrical room.'
  },
  {
    id: 'forced',
    when: (sim) => Object.values(sim.security.doors).some((d) => d.damaged),
    text: () => 'A door motor has been forced. Repair it at the breaker panel in the electrical room, through the rear door.'
  },
  {
    id: 'fault',
    when: (sim) => sim.surveillance.faults.size > 0,
    text: () => 'A camera feed dropped. Hold [E] on the signal relay panel (south wall), or wait for it to recover.'
  },
  {
    id: 'thermal',
    when: (sim) => sim.surveillance.thermal > 0.55,
    text: () => 'The camera rack is overheating. The ventilation fan keeps it cool.'
  },
  {
    id: 'blackout',
    when: (sim) => sim.power.failed,
    text: () => 'Main power lost. Hold [E] on a door\'s yellow manual release to brace it shut. The auxiliary cell can restore some power.'
  }
];
