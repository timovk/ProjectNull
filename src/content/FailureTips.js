import { ENTITY_IDS, NOISE_CONFIG } from '../config/GameConfig.js';

const { WANDERER, OBSERVER, ECHO, PATIENT } = ENTITY_IDS;
const N = NOISE_CONFIG.station;

/** General advice per subject, used when nothing more specific applies. */
export const GENERAL_TIPS = {
  [WANDERER]: 'Light a corridor while Subject 01 stands in it: it usually turns back. If it is already at a door, close that door until it leaves. You have several seconds after it arrives.',
  [OBSERVER]: 'Subject 02 freezes while watched, but agitation builds the longer you stare, and neglect makes it bold. Look for two or three seconds every 20 to 30 seconds. Close the door it approaches.',
  [ECHO]: 'When Subject 03 is in the ventilation, keep station noise under the red line on the acoustic monitor: switch off the fan and radio, and leave the doors as they are. After about half a minute of silence it gives up.',
  [PATIENT]: 'A closed door only delays Subject 04: it forces the motor on its fifth push. Hold the containment field until it withdraws; the door can stay open while the field is on.'
};

/**
 * The loud things that can let the Echo in, in the order they are checked.
 * `min` is the contribution (station noise units) that counts as "on".
 */
const ECHO_CAUSES = [
  { key: 'auxCell', min: 0.02, tip: 'The auxiliary cell had just been discharged. Its discharge is the loudest sound in the station, and it fades over several seconds. Only use the cell while Subject 03 is out of the vents: CAM 12 empty and no scraping.' },
  { key: 'barrier', min: 0.01, tip: 'The containment field was on. It is too loud while Subject 03 listens in the duct. If Subject 04 is at a door at the same time, shut that door instead, stay silent until the vents are quiet, then use the field.' },
  { key: 'doorMotors', min: 0.02, tip: 'A door had just opened or closed. While Subject 03 is overhead, leave the doors as they are: opening one is as loud as closing it.' },
  { key: 'player', min: 0.01, tip: 'You were walking or working with your hands (a repair, a reset or a brace), and that noise carried. Wait until Subject 03 has left the vents.' },
  { key: 'ventilation', min: 0.01, tip: 'The ventilation fan was running. When you hear scraping in the vents, switch the fan off first. Turn it back on once the vents are quiet.' },
  { key: 'radio', min: 0.01, tip: 'The radio was on. Switch it off with the fan when Subject 03 is in the vents.' }
];

/**
 * Advice for the failure screen, based on what was happening when the
 * subject got in (`breach.context`, recorded by the simulation).
 */
export function failureTip(breach) {
  const general = GENERAL_TIPS[breach?.entityId] ?? '';
  const ctx = breach?.context;
  if (!ctx) return general;

  if (breach.entityId === ECHO) {
    const loud = ECHO_CAUSES.find((c) => (ctx.noise?.[c.key] ?? 0) >= c.min);
    if (loud) return loud.tip;
    if ((ctx.noise?.stationLights ?? 0) >= N.stationLightsNormal) {
      return `${general} Setting the station lights to low on the emergency power panel also keeps the station a little quieter.`;
    }
    return general;
  }

  if (ctx.powerFailed) {
    return 'The power had run out. Station lights on low, corridor lights only while Subject 01 is in that corridor, and the field without a closed door all save power. Use the auxiliary cell before 0%, while the vents are quiet. In a blackout, hold E on a door\'s manual release to brace it.';
  }
  if (ctx.doorDamaged) {
    return 'That door\'s motor had been forced earlier, so it could not close. Once the doorway and the vents are clear, repair forced doors at the breakers in the electrical room.';
  }
  if (breach.entityId === PATIENT && ctx.echoInVents) {
    return 'Subject 04 arrived while Subject 03 was in the vents, when the field is too loud to use. Shut the door first and count the groans: the fifth push breaks the motor. Stay silent until the vents are quiet, then use the field.';
  }
  return general;
}
