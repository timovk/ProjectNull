import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  VOICE_LINES, VOICE_LINE_INDEX, SPEAKERS, speakable,
  radioLineId, tapeLineId, terminalLineId, gateLineId, morningLineId,
  deviationLineId, DEVIATION_LOGGED_ID, DEVIATION_RADIO_ID
} from '../src/content/VoiceLines.js';
import { DEVIATION_LINES } from '../src/content/Endings.js';
import { RADIO_BRIEFING } from '../src/content/RadioBriefing.js';
import { TAPES } from '../src/content/Documents.js';
import { terminalSchedule, GATE_MESSAGES, victoryLines } from '../src/content/TerminalMessages.js';
import { NIGHT_COUNT } from '../src/config/GameConfig.js';
import { buildManifest } from '../scripts/voiceManifest.js';
import { renderVoiceScript } from '../scripts/voiceScript.js';

test('every line the game speaks resolves to a recordable voice line', () => {
  const ids = [];
  RADIO_BRIEFING.forEach((_, i) => ids.push(radioLineId(i)));
  for (const [tapeId, tape] of Object.entries(TAPES)) {
    tape.lines.forEach((m, i) => {
      if (m.text.includes('"')) ids.push(tapeLineId(i, tapeId));
    });
  }
  ids.push(DEVIATION_LOGGED_ID, DEVIATION_RADIO_ID);
  DEVIATION_LINES.forEach((_, i) => ids.push(deviationLineId(i)));
  for (let n = 1; n <= NIGHT_COUNT; n++) {
    for (const m of terminalSchedule(n)) ids.push(terminalLineId(n, m.id));
    victoryLines(n).forEach((_, i) => ids.push(morningLineId(n, i)));
  }
  for (const gate of Object.keys(GATE_MESSAGES)) ids.push(gateLineId(gate));
  for (const id of ids) assert.ok(VOICE_LINE_INDEX.has(id), `missing voice line ${id}`);
  assert.equal(VOICE_LINE_INDEX.size, ids.length);
  assert.equal(VOICE_LINE_INDEX.has(tapeLineId(TAPES.log_six.lines.length - 1)), false, 'stage directions are not spoken');
  assert.equal(VOICE_LINE_INDEX.get(tapeLineId(0, 'cycle_four')).speaker, 'VARGA');
});

test('canonical voice lines are unique, non-empty and have a known speaker', () => {
  const ids = new Set();
  const texts = new Set();
  for (const line of VOICE_LINES) {
    assert.ok(!ids.has(line.id), `duplicate id ${line.id}`);
    ids.add(line.id);
    const key = `${line.speaker}|${line.text}`;
    assert.ok(!texts.has(key), `duplicate line ${key}`);
    texts.add(key);
    assert.ok(SPEAKERS[line.speaker], `unknown speaker ${line.speaker}`);
    assert.match(line.text, /\w/);
    assert.ok(/^[a-z0-9_]+$/.test(line.id), `id ${line.id} must be a safe file name`);
    for (const alias of line.aliases) assert.equal(VOICE_LINE_INDEX.get(alias), line);
  }
});

test('terminal text is turned into natural speech', () => {
  assert.equal(speakable('CONTRACTOR-0417 REPORT TO CELL 05.'), 'Contractor zero four one seven report to cell zero five.');
  assert.equal(speakable('NIGHT 4 / 5 COMPLETE. POWER 12%'), 'Night 4 of 5 complete. Power 12 percent.');
  assert.equal(speakable('LOG: CONTAINMENT A RELEASED'), 'Log. Containment A released.');
  assert.equal(speakable('SUBJECT 03 (RETAINED)'), 'Subject 03, retained.');
});

test('manifest maps recordings to lines, prefers ogg and ignores unknown files', () => {
  const alias = VOICE_LINES.find((l) => l.aliases.length);
  const { files, unknown } = buildManifest(['radio_01.wav', 'radio_01.ogg', `${alias.aliases[0]}.mp3`, 'notes.txt', 'oops.ogg']);
  assert.deepEqual(files, [
    { id: alias.id, file: `${alias.aliases[0]}.mp3` },
    { id: 'radio_01', file: 'radio_01.ogg' }
  ].sort((a, b) => a.id.localeCompare(b.id)));
  assert.deepEqual(unknown, ['oops.ogg']);
});

test('the recording script lists every line once with its file name', () => {
  const doc = renderVoiceScript();
  for (const line of VOICE_LINES) {
    assert.ok(doc.includes(`\`${line.id}.ogg\``), `script is missing ${line.id}`);
    assert.ok(doc.includes(line.text.replace(/\|/g, '/')), `script is missing the text of ${line.id}`);
  }
  for (const sp of Object.values(SPEAKERS)) assert.ok(doc.includes(sp.direction));
});
