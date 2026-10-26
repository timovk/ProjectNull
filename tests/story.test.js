import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/core/Simulation.js';
import { Progress } from '../src/core/Progress.js';
import { DOCUMENTS, TAPES, NIGHT_ITEMS } from '../src/content/Documents.js';
import { DEVIATION_NOTE_DOC, DEVIATION_WINDOW, deviationAvailable } from '../src/content/Endings.js';
import { NIGHT_COUNT } from '../src/config/GameConfig.js';

function memoryStorage() {
  const data = new Map();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)) };
}

test('later-night documents and tapes exist and appear on Nights 2 to 5', () => {
  for (const [id, night] of Object.entries(NIGHT_ITEMS)) {
    assert.ok(DOCUMENTS[id] || TAPES[id], `unknown item ${id}`);
    assert.ok(night >= 2 && night <= NIGHT_COUNT, `${id} on night ${night}`);
  }
  assert.equal(NIGHT_ITEMS[DEVIATION_NOTE_DOC], NIGHT_COUNT, "R.'s note arrives on the last night");
  assert.match(DOCUMENTS[DEVIATION_NOTE_DOC].body.join(' '), /B door/);
});

test('the roster keeps the subjects anonymous', () => {
  const text = DOCUMENTS.staff_roster.body.join('\n');
  assert.equal((text.match(/\[NAME WITHHELD\]/g) ?? []).length, 4);
  for (const tape of Object.values(TAPES)) assert.ok(tape.prompt && tape.lines.length > 2);
});

test('the deviation is only possible on the last night, after the note, between 5 and 6 AM, once', () => {
  const base = { mode: 'NIGHT', night: NIGHT_COUNT, noteRead: true, hours: 5.5, done: false };
  assert.equal(deviationAvailable(base), true);
  assert.equal(deviationAvailable({ ...base, noteRead: false }), false);
  assert.equal(deviationAvailable({ ...base, night: NIGHT_COUNT - 1 }), false);
  assert.equal(deviationAvailable({ ...base, mode: 'CUSTOM' }), false);
  assert.equal(deviationAvailable({ ...base, hours: DEVIATION_WINDOW.from - 0.01 }), false);
  assert.equal(deviationAvailable({ ...base, hours: DEVIATION_WINDOW.to }), false);
  assert.equal(deviationAvailable({ ...base, done: true }), false);
});

test('the simulation logs the deviation once, never before 5 AM, and reports it', () => {
  // Everyone asleep, so the night reaches 5 AM with nobody at the desk.
  const asleep = { SUBJECT_01: [0], SUBJECT_02: [0], SUBJECT_03: [0], SUBJECT_04: [0] };
  const sim = new Simulation({ seed: 'deviation', schedule: asleep });
  assert.equal(sim.command({ type: 'DEVIATION' }).reason, 'TOO_EARLY');
  sim.runFor((5.2 / 6) * sim.config.nightDurationSeconds);
  assert.equal(sim.command({ type: 'DEVIATION' }).ok, true);
  assert.equal(sim.command({ type: 'DEVIATION' }).reason, 'ALREADY_LOGGED');
  assert.ok(sim.getSummary().deviation.gameHours >= 5);
});

test('progress remembers the note and the endings', () => {
  const storage = memoryStorage();
  const p = new Progress({ storage });
  assert.equal(p.deviationNoteRead, false);
  assert.equal(p.hasEnding('deviation'), false);
  p.markDeviationNoteRead();
  p.recordEnding('deviation');
  p.recordEnding('nonsense');
  const again = new Progress({ storage });
  assert.equal(again.deviationNoteRead, true);
  assert.equal(again.hasEnding('deviation'), true);
  assert.equal(again.hasEnding('contained'), false);
});
