# Voice lines: recording script

This file is generated from the game's content by `npm run voice:script`. Do not edit it by hand; edit the lines in `src/content/` and regenerate.

There are **55 lines** to record: 9 for R., the previous technician (radio), 6 for R., an older recording (audio log), 40 for Facility announcer (automated). Lines that appear in several places are listed once.

## How to add a recording

1. Record the line and save it as `public/voice/<file name>`, using the file name from the tables below. `.ogg`, `.mp3` and `.wav` all work.
2. Run `npm run dev` or `npm run build`. Both rescan the folder automatically; `npm run voice:manifest` does it on its own.
3. That line now plays your recording. Lines without a recording keep using the browser voice (Settings → Audio → Browser voices), or stay text-only if that is off.

## Recording tips

- Mono, 44.1 or 48 kHz. One line per file, one clean take.
- Record dry: a quiet room, no music, no effects, no reverb. The game adds the radio filter, the tape hiss and the hall echo itself.
- About 20 to 30 cm from the microphone. Aim for peaks around −6 dBFS; the game evens out loudness, but avoid clipping.
- Leave about 0.3 s of silence at the start and the end.
- The game never plays voices suddenly or loudly. It fades every clip in and caps its level, so do not shout to compensate.
- Say the line exactly as written. Text in the game stays the same even if the delivery varies a little.

## R., the previous technician (radio) (9 lines)

**Direction:** Tired, kind, a little scared. Speaks quietly, as if someone might overhear. Plain, natural delivery; never theatrical. The game adds the radio filter and crackle, so record clean and close to the mic.

| # | File name | Line | When it plays |
| --- | --- | --- | --- |
| 1 | `radio_01.ogg` | Hey. You're the new one. Nothing's loose yet, so breathe. I'll walk you through it. | Night 1 radio briefing, 5 s into the night |
| 2 | `radio_02.ogg` | Middle screen on the desk is your cameras. Sit down with E, flip through them with the number keys. | Night 1 radio briefing, 16 s into the night |
| 3 | `radio_03.ogg` | Every door has a panel next to it. Top button shuts the door. Bottom button lights the corridor behind it. | Night 1 radio briefing, 29 s into the night |
| 4 | `radio_04.ogg` | Everything runs off one battery. Doors eat it fastest. Don't leave things on for nothing. | Night 1 radio briefing, 42 s into the night |
| 5 | `radio_05.ogg` | Hear that? Containment A just unlocked. The tall one's out. In a corridor: light that corridor. At your door: shut it. | Night 1 radio briefing, 57 s into the night |
| 6 | `radio_06.ogg` | Something in Acoustics woke up. If you hear scraping in the vents, go quiet. Fan off, radio off, hands off the doors. | Night 1 radio briefing, 101 s into the night |
| 7 | `radio_07.ogg` | And B's open. The pale one. Look at it now and then. Never stare at it. Never forget about it. | Night 1 radio briefing, 114 s into the night |
| 8 | `radio_08.ogg` | The big one sleeps till late. When it's at a door, a door won't hold it. Lever on the back wall. Hold the field till it leaves. | Night 1 radio briefing, 133 s into the night |
| 9 | `radio_09.ogg` | That's everything I know. Six o'clock comes. It always does. ...I have to go. | Night 1 radio briefing, 152 s into the night |

## R., an older recording (audio log) (6 lines)

**Direction:** The same person as R., weeks earlier and more exhausted. Slower, sometimes close to a whisper, with pauses where the text has "...". The game adds tape hiss and a lo-fi filter.

| # | File name | Line | When it plays |
| --- | --- | --- | --- |
| 1 | `tape_01.ogg` | Log... six? Seven. I've stopped counting the nights. | Audio log in the electrical room, line 1 |
| 2 | `tape_02.ogg` | They call it a diagnostic. I think the diagnostic is us. | Audio log in the electrical room, line 2 |
| 3 | `tape_03.ogg` | They don't move when you look away. They move when the numbers say so. | Audio log in the electrical room, line 3 |
| 4 | `tape_04.ogg` | One in twenty, early on. By five it's seven in twenty. I wrote it on the board. | Audio log in the electrical room, line 4 |
| 5 | `tape_05.ogg` | If you're hearing this, you're the new contractor. Keep the doors shut and your voice down. | Audio log in the electrical room, line 5 |
| 6 | `tape_06.ogg` | And count them. Every hour. Count them. There should be five. | Audio log in the electrical room, line 6 |

## Facility announcer (automated) (40 lines)

**Direction:** A calm, polite, automated voice with no emotion. Even pace, a short pause at every full stop. It should feel slightly too calm for what it says. The game adds a hall echo.

| # | File name | Line | When it plays |
| --- | --- | --- | --- |
| 1 | `facility_n1_start.ogg` | Diagnostic cycle initiated. Operator. Contractor zero four one seven. | Night 1 terminal message at 0.00 h |
| 2 | `facility_n1_feeds.ogg` | Surveillance relay. 12 feeds online. | Night 1 terminal message at 0.03 h |
| 3 | `facility_n1_inactive.ogg` | Note. Motion in sectors marked inactive. | Night 1 terminal message at 1.60 h |
| 4 | `facility_n1_count.ogg` | Operator count. 2. | Night 1 terminal message at 3.00 h (and 1 more) |
| 5 | `facility_n1_progress.ogg` | Diagnostic 61 percent. Subject response nominal. | Night 1 terminal message at 3.80 h |
| 6 | `facility_n1_observe.ogg` | Reminder. The operator is not under observation. | Night 1 terminal message at 4.50 h |
| 7 | `facility_n1_remain.ogg` | Diagnostic 94 percent. Please remain at your station. | Night 1 terminal message at 5.20 h |
| 8 | `facility_n2_start.ogg` | Diagnostic cycle 2 initiated. Operator. Contractor zero four one seven, retained. | Night 2 terminal message at 0.00 h |
| 9 | `facility_n2_seal.ogg` | Cell zero five seal integrity. 98 percent. | Night 2 terminal message at 1.20 h |
| 10 | `facility_n2_fatigue.ogg` | Note. Operator fatigue detected. Continue. | Night 2 terminal message at 4.60 h |
| 11 | `facility_n3_start.ogg` | Diagnostic cycle 3 initiated. Operator. Contractor zero four one seven. | Night 3 terminal message at 0.00 h |
| 12 | `facility_n3_request.ogg` | Request from Sublevel B. Open. | Night 3 terminal message at 0.80 h |
| 13 | `facility_n3_denied.ogg` | Request denied. Request repeated. | Night 3 terminal message at 2.40 h |
| 14 | `facility_n3_seal.ogg` | Cell zero five seal integrity. 71 percent. | Night 3 terminal message at 4.00 h |
| 15 | `facility_n4_start.ogg` | Diagnostic cycle 4 initiated. Operator. Contractor zero four one seven. | Night 4 terminal message at 0.00 h |
| 16 | `facility_n4_baseline.ogg` | Subject response above baseline. | Night 4 terminal message at 1.00 h |
| 17 | `facility_n4_seal.ogg` | Cell zero five seal integrity. 40 percent. | Night 4 terminal message at 2.50 h |
| 18 | `facility_n4_count.ogg` | Operator count. 3. | Night 4 terminal message at 4.20 h |
| 19 | `facility_n5_start.ogg` | Final diagnostic cycle initiated. Operator. Contractor zero four one seven. | Night 5 terminal message at 0.00 h |
| 20 | `facility_n5_seal.ogg` | Cell zero five seal integrity. 12 percent. | Night 5 terminal message at 1.50 h |
| 21 | `facility_n5_accounted.ogg` | All subjects accounted for except one. | Night 5 terminal message at 3.00 h |
| 22 | `facility_n5_almost.ogg` | Please remain at your station. We are almost done. | Night 5 terminal message at 5.20 h |
| 23 | `facility_gate_cell_a_lock.ogg` | Containment A. Cell lock released. Authorization. None. | When this gate opens (every night) |
| 24 | `facility_gate_cell_b_lock.ogg` | Containment B. Cell lock released. Authorization. None. | When this gate opens (every night) |
| 25 | `facility_gate_acoustic_seal.ogg` | Acoustics lab. Seal disengaged. | When this gate opens (every night) |
| 26 | `facility_gate_isolation_bulkhead.ogg` | Isolation ward. Bulkhead released by facility automation. | When this gate opens (every night) |
| 27 | `facility_morning_n1_1.ogg` | Diagnostic cycle 1 complete. | Night 1 at 6 AM, morning line 1 |
| 28 | `facility_morning_n1_2.ogg` | Monitoring infrastructure. Restored. | Night 1 at 6 AM, morning line 2 (and 3 more) |
| 29 | `facility_morning_n1_3.ogg` | Subjects accounted for. 4 of 5. | Night 1 at 6 AM, morning line 3 (and 3 more) |
| 30 | `facility_morning_n1_4.ogg` | Operator status. Retained for cycle 2. | Night 1 at 6 AM, morning line 4 |
| 31 | `facility_morning_n2_1.ogg` | Diagnostic cycle 2 complete. | Night 2 at 6 AM, morning line 1 |
| 32 | `facility_morning_n2_4.ogg` | Operator status. Retained for cycle 3. | Night 2 at 6 AM, morning line 4 |
| 33 | `facility_morning_n3_1.ogg` | Diagnostic cycle 3 complete. | Night 3 at 6 AM, morning line 1 |
| 34 | `facility_morning_n3_4.ogg` | Operator status. Retained for cycle 4. | Night 3 at 6 AM, morning line 4 |
| 35 | `facility_morning_n4_1.ogg` | Diagnostic cycle 4 complete. | Night 4 at 6 AM, morning line 1 |
| 36 | `facility_morning_n4_4.ogg` | Operator status. Retained for cycle 5. | Night 4 at 6 AM, morning line 4 |
| 37 | `facility_morning_n5_1.ogg` | Diagnostic series complete. | Night 5 at 6 AM, morning line 1 |
| 38 | `facility_morning_n5_2.ogg` | Subjects accounted for. 5 of 5. | Night 5 at 6 AM, morning line 2 |
| 39 | `facility_morning_n5_3.ogg` | Operator status. Contained. | Night 5 at 6 AM, morning line 3 |
| 40 | `facility_morning_n5_4.ogg` | Thank you for your participation. | Night 5 at 6 AM, morning line 4 |

