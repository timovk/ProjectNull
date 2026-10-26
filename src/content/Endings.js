import { NIGHT_COUNT } from '../config/GameConfig.js';

/*
 * The deviation ending (docs/lore/LORE_DRAFT.md, section 16): on the last
 * night, after reading R.'s note on the second work order, the operator
 * leaves the station between 5:00 and 6:00, holds a hand on the Sublevel B
 * door, and survives until 6 AM. WARDEN logs the deviation and does not get
 * its fifth subject.
 */

/** The document whose margin note explains the deviation. */
export const DEVIATION_NOTE_DOC = 'work_order_05';
/** In-game hours during which the door counts. */
export const DEVIATION_WINDOW = { from: 5, to: 6 };
/** Seconds the player holds E on the door. */
export const DEVIATION_HOLD_SECONDS = 3;

/** Logged on the terminal the moment the door is touched. */
export const DEVIATION_LOGGED = 'OPERATOR ABSENT FROM STATION. DEVIATION LOGGED';

/** The 6 AM report after a deviation, instead of "contained". */
export const DEVIATION_LINES = [
  'DIAGNOSTIC CYCLE 5 COMPLETE.',
  'OPERATOR DEVIATION LOGGED: SUBLEVEL B ACCESS POINT',
  'SUBJECTS ACCOUNTED FOR: 4 / 5',
  'OPERATOR STATUS: RETAINED. SERIES RESTARTED'
];

/** R. on the radio, after the deviation report. */
export const DEVIATION_RADIO = 'You found it. Good. Now come down.';

/** Shown on the main menu once the deviation ending has been reached. */
export const DEVIATION_MENU_LINE = 'R.: "The door\'s open. Come down when you\'re ready."';

/** Whether holding a hand on the Sublevel B door counts right now. */
export function deviationAvailable({ mode, night, noteRead, hours, done }) {
  return mode === 'NIGHT' && night === NIGHT_COUNT && !!noteRead && !done && hours >= DEVIATION_WINDOW.from && hours < DEVIATION_WINDOW.to;
}
