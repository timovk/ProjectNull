import { RADIO_BRIEFING } from './RadioBriefing.js';
import { TAPES } from './Documents.js';
import { DEVIATION_LINES, DEVIATION_LOGGED, DEVIATION_RADIO } from './Endings.js';
import { terminalSchedule, GATE_MESSAGES, victoryLines } from './TerminalMessages.js';
import { NIGHT_COUNT } from '../config/GameConfig.js';

/*
 * Every spoken line in the game, built from the same content the game shows
 * as text. This is the single source for:
 *   - the voice system (which line to say, in which voice)
 *   - the recording script (docs/VOICE_LINES.md, `npm run voice:script`)
 * A recorded clip for a line goes in public/voice/<id>.ogg (or .mp3/.wav).
 */

export const SPEAKERS = {
  R: {
    name: 'R., the previous technician (radio)',
    direction: 'Tired, kind, a little scared. Speaks quietly, as if someone might overhear. Plain, natural delivery; never theatrical. The game adds the radio filter and crackle, so record clean and close to the mic.'
  },
  TAPE: {
    name: 'R., recorded (audio logs)',
    direction: 'The same person as R. on the radio, more exhausted. "Log six" is weeks before the game; "Log nine" is recorded far below, later still. Slower, sometimes close to a whisper, with pauses where the text has "...". The game adds tape hiss and a lo-fi filter.'
  },
  VARGA: {
    name: 'Dr. Ines Varga (cassette)',
    direction: 'A scientist in her early forties recording a private log the night before she refuses. Calm, precise and quiet, with resolve underneath. No crying, no drama: the weight is in how plainly she says it. The game adds tape hiss and a lo-fi filter.'
  },
  FACILITY: {
    name: 'Facility announcer (automated)',
    direction: 'A calm, polite, automated voice with no emotion. Even pace, a short pause at every full stop. It should feel slightly too calm for what it says. The game adds a hall echo.'
  }
};

const pad = (n) => String(n).padStart(2, '0');

export const radioLineId = (index) => `radio_${pad(index + 1)}`;
const TAPE_PREFIX = { log_six: 'tape', log_nine: 'tape_r9', cycle_four: 'tape_iv' };
export const tapeLineId = (index, tapeId = 'log_six') => `${TAPE_PREFIX[tapeId] ?? `tape_${tapeId}`}_${pad(index + 1)}`;
export const terminalLineId = (night, msgId) => `facility_n${night}_${msgId}`;
export const gateLineId = (gate) => `facility_gate_${gate.toLowerCase()}`;
export const morningLineId = (night, index) => `facility_morning_n${night}_${index + 1}`;
export const deviationLineId = (index) => `facility_deviation_${index + 1}`;
export const DEVIATION_LOGGED_ID = 'facility_deviation_logged';
export const DEVIATION_RADIO_ID = 'radio_deviation';

/** Terminal text (ALL CAPS, codes) into something a voice can say naturally. */
export function speakable(text) {
  let t = text
    .replace(/CONTRACTOR-0417/g, 'contractor zero four one seven')
    .replace(/CELL 05/g, 'cell zero five')
    .replace(/(\d+)\s*\/\s*(\d+)/g, '$1 of $2')
    .replace(/(\d+)%/g, '$1 percent')
    .replace(/\s*\(RETAINED\)/g, ', retained')
    .replace(/:\s+/g, '. ')
    .toLowerCase();
  t = t.replace(/(^|[.!?]\s+)([a-z])/g, (m, p, c) => p + c.toUpperCase());
  t = t.replace(/\bsublevel b\b/gi, 'Sublevel B').replace(/\bcontainment ([ab])\b/gi, (m, l) => `Containment ${l.toUpperCase()}`);
  if (!/[.!?]$/.test(t)) t += '.';
  return t;
}

function buildLines() {
  const lines = [];
  RADIO_BRIEFING.forEach((m, i) => lines.push({
    id: radioLineId(i), speaker: 'R', text: m.text,
    context: `Night 1 radio briefing, ${m.at} s into the night`
  }));
  lines.push({ id: DEVIATION_RADIO_ID, speaker: 'R', text: DEVIATION_RADIO, context: 'Night 5, after the 6 AM report in the deviation ending' });
  const where = { log_six: 'Audio log in the electrical room', log_nine: 'Telemetry recorder in the electrical room (from Night 4)', cycle_four: 'Cassette at the Sublevel B door (Night 5)' };
  for (const [tapeId, tape] of Object.entries(TAPES)) {
    tape.lines.forEach((m, i) => {
      const quoted = /"(.+)"/.exec(m.text);
      if (!quoted) return; // stage directions such as "[The tape runs out]" are not spoken
      lines.push({ id: tapeLineId(i, tapeId), speaker: tape.speaker, text: quoted[1], context: `${where[tapeId]}, line ${i + 1}` });
    });
  }
  for (let n = 1; n <= NIGHT_COUNT; n++) {
    for (const m of terminalSchedule(n)) {
      lines.push({ id: terminalLineId(n, m.id), speaker: 'FACILITY', text: speakable(m.text), display: m.text, context: `Night ${n} terminal message at ${m.at.toFixed(2)} h` });
    }
  }
  for (const [gate, text] of Object.entries(GATE_MESSAGES)) {
    lines.push({ id: gateLineId(gate), speaker: 'FACILITY', text: speakable(text), display: text, context: 'When this gate opens (every night)' });
  }
  lines.push({ id: DEVIATION_LOGGED_ID, speaker: 'FACILITY', text: speakable(DEVIATION_LOGGED), display: DEVIATION_LOGGED, context: 'Night 5, when the operator touches the Sublevel B door after 5 AM' });
  DEVIATION_LINES.forEach((text, i) => lines.push({
    id: deviationLineId(i), speaker: 'FACILITY', text: speakable(text), display: text, context: `Night 5 deviation ending, 6 AM line ${i + 1}`
  }));
  for (let n = 1; n <= NIGHT_COUNT; n++) {
    victoryLines(n).forEach((text, i) => lines.push({
      id: morningLineId(n, i), speaker: 'FACILITY', text: speakable(text), display: text, context: `Night ${n} at 6 AM, morning line ${i + 1}`
    }));
  }
  return lines;
}

/**
 * Lines with the same speaker and the same words are recorded once: the
 * first id is the canonical one, later ids become aliases of it.
 */
function dedupe(all) {
  const canonical = [];
  const index = new Map();
  const byKey = new Map();
  for (const line of all) {
    const key = `${line.speaker}|${line.text}`;
    const first = byKey.get(key);
    if (first) {
      first.aliases.push(line.id);
      first.contexts.push(line.context);
      index.set(line.id, first);
      continue;
    }
    const entry = { ...line, aliases: [], contexts: [line.context] };
    byKey.set(key, entry);
    canonical.push(entry);
    index.set(line.id, entry);
  }
  return { canonical, index };
}

const built = dedupe(buildLines());
/** One entry per line to record. */
export const VOICE_LINES = built.canonical;
/** Every id the game uses (including aliases) -> the line to play. */
export const VOICE_LINE_INDEX = built.index;
