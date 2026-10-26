import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/core/Simulation.js';
import { Progress } from '../src/core/Progress.js';
import { DOCUMENTS, TAPES, NIGHT_ITEMS } from '../src/content/Documents.js';
import { DEVIATION_NOTE_DOC, DEVIATION_WINDOW, deviationAvailable } from '../src/content/Endings.js';
import { NIGHT_COUNT, NIGHT_SCHEDULES } from '../src/config/GameConfig.js';
import { SUBJECT_FILES, SUBJECT_ORDER, subjectsActive } from '../src/content/SubjectFiles.js';
import { terminalSchedule } from '../src/content/TerminalMessages.js';

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

test('subject records cover all four subjects and keep their former names out', () => {
  const formerNames = /Brandt|Osei|Aranda|Pell|Tomas|Mira|Felix|Jonah/;
  assert.equal(SUBJECT_ORDER.length, 4);
  for (const id of SUBJECT_ORDER) {
    const f = SUBJECT_FILES[id];
    assert.ok(f.designation.endsWith(id.slice(-2)), `${id} designation`);
    assert.ok(f.fields.some(([k]) => k === 'Former role') && f.fields.some(([k]) => k === 'Anchor'), `${id} fields`);
    assert.doesNotMatch([f.callSign, f.detail, f.observed, ...f.fields.flat()].join(' '), formerNames);
  }
});

test('a record unlocks for each subject that left its cell during a survived night', () => {
  const sim = new Simulation({ seed: 'files', schedule: NIGHT_SCHEDULES[1] });
  assert.deepEqual(subjectsActive(sim), [], 'nobody has moved at midnight');
  sim.runFor(sim.config.nightDurationSeconds / 2);
  const active = subjectsActive(sim);
  assert.ok(active.includes('SUBJECT_01'), 'the Wanderer is out by 3 AM on Night 1');
  for (const id of active) assert.ok(sim.ai.get(id).stats.moves > 0);
});

test('progress stores subject records once, in order, and migrates older saves', () => {
  const storage = memoryStorage();
  const p = new Progress({ storage });
  assert.deepEqual(p.files, []);
  assert.deepEqual(p.unlockFiles(['SUBJECT_03', 'SUBJECT_01']), ['SUBJECT_01', 'SUBJECT_03']);
  assert.deepEqual(p.unlockFiles(['SUBJECT_01', 'SUBJECT_02']), ['SUBJECT_02']);
  assert.deepEqual(p.unlockFiles(['SUBJECT_02']), []);
  assert.deepEqual(new Progress({ storage }).files, ['SUBJECT_01', 'SUBJECT_02', 'SUBJECT_03']);

  const old = memoryStorage();
  old.setItem('project-null.progress.v1', JSON.stringify({ unlocked: 3, completed: [1, 2] }));
  assert.deepEqual(new Progress({ storage: old }).files, SUBJECT_ORDER);
  const fresh = memoryStorage();
  fresh.setItem('project-null.progress.v1', JSON.stringify({ unlocked: 1, completed: [] }));
  assert.deepEqual(new Progress({ storage: fresh }).files, []);
});

test('the Night 3 request from Sublevel B is traced to R., and R. confirms it on Night 4', () => {
  const n3 = terminalSchedule(3).map((m) => m.text).join('\n');
  assert.match(n3, /REQUEST FROM SUBLEVEL B/);
  assert.match(n3, /CONTRACTOR-0317/);
  assert.ok(TAPES.log_nine.lines.some((l) => /request on your terminal/.test(l.text) && /That was me/.test(l.text)));
  assert.equal(NIGHT_ITEMS.log_nine, 4);
});
