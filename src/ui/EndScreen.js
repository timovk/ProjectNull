import { el, showScreen } from './dom.js';
import { formatDuration, formatGameClock } from '../core/GameClock.js';
import { VICTORY_LINES } from '../content/TerminalMessages.js';
import { NIGHT_COUNT } from '../config/GameConfig.js';

const CAUSES = {
  SUBJECT_01: {
    WEST_DOOR: 'Subject 01 walked in through the open west door.',
    EAST_DOOR: 'Subject 01 walked in through the open east door.',
    tip: 'Corridor lighting turns Subject 01 back before it reaches a door. If it is already at a door, close that door until it leaves.'
  },
  SUBJECT_02: {
    WEST_DOOR: 'Subject 02 entered through the open west door.',
    EAST_DOOR: 'Subject 02 entered through the open east door.',
    tip: 'Subject 02 freezes while watched, but agitation builds the longer you stare, and neglect makes it bold. Check it briefly and often. Close the door it approaches.'
  },
  SUBJECT_03: {
    VENT: 'Subject 03 came down through the station duct. The station was loud enough for it to follow.',
    tip: 'When Subject 03 is in the ventilation, keep station noise under the red line on the acoustic monitor: switch off the fan and radio, and avoid moving doors.'
  },
  SUBJECT_04: {
    WEST_DOOR: 'Subject 04 came through the west door.',
    EAST_DOOR: 'Subject 04 came through the east door.',
    tip: 'A closed door only delays Subject 04: it forces the motor eventually. Hold the containment field until it withdraws, and repair forced doors in the electrical room.'
  }
};

export class EndScreen {
  constructor(root, { onRetry, onNight, onMenu }) {
    this.body = el('div');
    this.node = el('div', { class: 'screen opaque interactive hidden' }, [
      el('div', { class: 'menu-card' }, [
        this.body,
        el('div', { class: 'row-buttons' }, [
          (this.nightBtn = el('button', { class: 'small-btn hidden', text: 'START NIGHT 1', onclick: onNight })),
          (this.retryBtn = el('button', { class: 'small-btn', text: 'RETRY NIGHT 1', onclick: onRetry })),
          el('button', { class: 'small-btn', text: 'RETURN TO MENU', onclick: onMenu })
        ])
      ])
    ]);
    root.append(this.node);
  }

  /** Which night this was: label for stats, and the retry button text. */
  setRun({ label = 'Night 1', retry = 'RETRY NIGHT 1', again = 'PLAY NIGHT 1 AGAIN' } = {}) {
    this.run = { label, retry, again };
  }

  showFailure(summary) {
    const run = this.run ?? { label: 'Night 1', retry: 'RETRY NIGHT 1' };
    const b = summary.breach;
    const cause = CAUSES[b.entityId] ?? {};
    this.retryBtn.textContent = run.retry;
    this.nightBtn.classList.add('hidden');
    this.body.replaceChildren(
      el('h1', { class: 'end-title lost', text: 'CONNECTION LOST' }),
      el('div', { class: 'end-sub', text: `OPERATOR SIGNAL TERMINATED AT ${formatGameClock(b.gameHours)}` }),
      el('div', { class: 'stats' }, statRows([
        ['Time survived', `${formatDuration(summary.timeSurvived)} (${formatGameClock(b.gameHours)})`],
        ['Night', run.label],
        ['Entity responsible', `${b.designation} / ${b.name}`],
        ['Cause of failure', cause[b.via] ?? `${b.designation} entered the station.`],
        ['Power remaining', `${summary.powerRemaining.toFixed(1)}%${summary.powerFailed ? ' (main cell depleted)' : ''}`],
        ['Entity encounters', summary.encounters],
        ['Seed', summary.seed]
      ])),
      el('div', { class: 'end-note', text: cause.tip ?? '' })
    );
    showScreen(this.node, true);
  }

  showPracticeComplete(summary, lessonsDone) {
    this.retryBtn.textContent = 'PRACTICE AGAIN';
    this.nightBtn.textContent = 'START NIGHT 1';
    this.nightBtn.classList.remove('hidden');
    this.body.replaceChildren(
      el('h1', { class: 'end-title won', text: 'PRACTICE COMPLETE' }),
      el('div', { class: 'end-sub', text: 'YOU MADE IT TO 6:00 AM' }),
      el('div', { class: 'stats' }, statRows([
        ['Lessons completed', lessonsDone],
        ['Times something got in (sent back)', summary.practiceBreaches],
        ['Entries you blocked', summary.blockedEntries],
        ['Power remaining', `${summary.powerRemaining.toFixed(1)}%`],
        ['Door closures', `${summary.doorCloses} (${summary.doorSeconds.toFixed(0)} s shut)`],
        ['Containment field', `${summary.barrierSeconds.toFixed(0)} s, ${summary.barrierRepels} repelled`]
      ])),
      el('div', { class: 'end-note', text: summary.practiceBreaches === 0
        ? 'Nothing got in. You are ready for the real night: no map, no slowed time, and a breach ends it.'
        : 'In a real night, any of those breaches would have ended it. The real night has no live map and no slowed time, but you get a radio briefing at the start.' })
    );
    showScreen(this.node, true);
  }

  showVictory(summary, { lines: victory = VICTORY_LINES, next = null, final = false } = {}) {
    const run = this.run ?? { label: 'Night 1', again: 'PLAY NIGHT 1 AGAIN' };
    this.retryBtn.textContent = run.again;
    this.nightBtn.classList.toggle('hidden', !next);
    if (next) this.nightBtn.textContent = `CONTINUE TO NIGHT ${next}`;
    const lines = el('div', { class: 'terminal-lines' }, victory.map((t, i) => el('div', { text: `> ${t}`, style: { animationDelay: `${0.6 + i * 1.1}s` } })));
    this.body.replaceChildren(
      el('h1', { class: 'end-title won', text: final ? 'THE LAST NIGHT IS OVER' : 'SHIFT COMPLETE' }),
      el('div', { class: 'end-sub', text: `${run.label.toUpperCase()} / 6:00 AM` }),
      lines,
      el('div', { class: 'stats' }, statRows([
        ['Night completed', run.label],
        ['Survival time', formatDuration(summary.timeSurvived)],
        ['Power remaining', `${summary.powerRemaining.toFixed(1)}%`],
        ['Entity encounters', summary.encounters],
        ['Entries blocked', summary.blockedEntries],
        ['Door closures', `${summary.doorCloses} (${summary.doorSeconds.toFixed(0)} s shut)`],
        ['Corridor lighting', `${summary.lightSeconds.toFixed(0)} s`],
        ['Containment field', `${summary.barrierSeconds.toFixed(0)} s, ${summary.barrierRepels} repelled`],
        ['Camera time', `${summary.cameraSeconds.toFixed(0)} s, ${summary.cameraSwitches} switches`],
        ['Ventilation off', `${summary.fanOffSeconds.toFixed(0)} s`],
        ['Repairs / relay resets', `${summary.repairs} / ${summary.relayResets}`],
        ['Movement opportunities simulated', summary.opportunities],
        ['Seed', summary.seed]
      ])),
      final
        ? el('div', { class: 'end-note', text: `You survived all ${NIGHT_COUNT} nights. The facility has stopped asking for a contractor. Somewhere below Level 2, a fifth door is standing open.` })
        : next
          ? el('div', { class: 'end-note', text: `Night ${next} is now unlocked. The subjects will be more active.` })
          : ''
    );
    showScreen(this.node, true);
  }

  hide() {
    showScreen(this.node, false);
  }
}

function statRows(rows) {
  return rows.flatMap(([k, v]) => [el('span', { text: k }), el('span', { text: String(v) })]);
}
