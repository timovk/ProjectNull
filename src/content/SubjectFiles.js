import { ENTITY_IDS } from '../config/GameConfig.js';

/**
 * WARDEN's subject records, read on the workstation's FILES tab. A record
 * unlocks after a campaign night survived in which that subject left its
 * cell. The records give the former role, the anchor and one personal
 * detail; former names stay withheld (they belong to later games).
 */
export const SUBJECT_FILES = {
  [ENTITY_IDS.WANDERER]: {
    designation: 'SUBJECT 01',
    callSign: 'THE WANDERER',
    fields: [
      ['Former role', 'Night security, Level 1. Twelve years on site.'],
      ['Anchor', 'Being seen off post.'],
      ['Response', 'Light. A lit corridor turns it back.']
    ],
    detail: 'Walked every corridor once an hour, "to make sure". In 1986 he fell asleep at the desk while a pump flooded, and never sat down on shift again. Assigned 41 nights of rounds on Level 2 with every light off. His rounds stopped having a route, then a purpose.',
    observed: 'Still carries the shape of a torch in one hand. There is no torch.'
  },
  [ENTITY_IDS.OBSERVER]: {
    designation: 'SUBJECT 02',
    callSign: 'THE OBSERVER',
    fields: [
      ['Former role', 'Surveillance analysis. She watched these feeds.'],
      ['Anchor', 'Watching.'],
      ['Response', 'Holds still while watched. Watched too long, it stops holding still.']
    ],
    detail: 'The first to notice that the subjects move in steady, countable rhythms. Her shifts were doubled, then tripled. The last one ran 70 hours without sleep. Her final report was blank.',
    observed: 'Posture consistent with someone leaning in toward a screen.'
  },
  [ENTITY_IDS.ECHO]: {
    designation: 'SUBJECT 03',
    callSign: 'THE ECHO',
    fields: [
      ['Former role', 'Head of Acoustics.'],
      ['Anchor', 'Sound.'],
      ['Response', 'Follows noise. Gives up in silence.']
    ],
    detail: 'Believed the Deep makes a sound below the range of human hearing. Spent 30 hours alone in Anechoic Chamber 2, listening to a line wired to Sublevel B. Came out repeating things people had said to him days earlier.',
    observed: 'Behaves as if the sound it is looking for comes from the Security Station.'
  },
  [ENTITY_IDS.PATIENT]: {
    designation: 'SUBJECT 04',
    callSign: 'THE PATIENT',
    fields: [
      ['Former role', 'Volunteer resident, Isolation Ward.'],
      ['Anchor', 'Endurance.'],
      ['Response', 'Doors only delay it. The containment field, tuned to his medical records, reaches it.']
    ],
    detail: 'Signed up in 1995 for eighteen months of exposure tolerance trials, to pay off his family\'s debts. Stayed three years. Never once asked to stop.',
    observed: 'Waits at doors as if someone promised to open them.'
  }
};

export const SUBJECT_ORDER = [ENTITY_IDS.WANDERER, ENTITY_IDS.OBSERVER, ENTITY_IDS.ECHO, ENTITY_IDS.PATIENT];

/** Subjects that left their cell during this night (they earn their record when the night is survived). */
export function subjectsActive(sim) {
  return SUBJECT_ORDER.filter((id) => (sim.ai.get(id)?.stats.moves ?? 0) > 0);
}
