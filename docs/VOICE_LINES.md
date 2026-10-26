# Voice lines: recording script

This file is generated from the game's content by `npm run voice:script`. Do not edit it by hand; edit the lines in `src/content/` and regenerate.

There are **73 lines** to record: 10 for R., the previous technician (radio), 12 for R., recorded (audio logs), 6 for Dr. Ines Varga (cassette), 45 for Facility announcer (automated). Lines that appear in several places are listed once.

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

## R., the previous technician (radio) (10 lines)

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
| 10 | `radio_deviation.ogg` | You found it. Good. Now come down. | Night 5, after the 6 AM report in the deviation ending |

## R., recorded (audio logs) (12 lines)

**Direction:** The same person as R. on the radio, more exhausted. "Log six" is weeks before the game; "Log nine" is recorded far below, later still. Slower, sometimes close to a whisper, with pauses where the text has "...". The game adds tape hiss and a lo-fi filter.

| # | File name | Line | When it plays |
| --- | --- | --- | --- |
| 1 | `tape_01.ogg` | Log... six? Seven. I've stopped counting the nights. | Audio log in the electrical room, line 1 |
| 2 | `tape_02.ogg` | They call it a diagnostic. I think the diagnostic is us. | Audio log in the electrical room, line 2 |
| 3 | `tape_03.ogg` | They don't move when you look away. They move when the numbers say so. | Audio log in the electrical room, line 3 |
| 4 | `tape_04.ogg` | One in twenty, early on. By five it's seven in twenty. I wrote it on the board. | Audio log in the electrical room, line 4 |
| 5 | `tape_05.ogg` | If you're hearing this, you're the new contractor. Keep the doors shut and your voice down. | Audio log in the electrical room, line 5 |
| 6 | `tape_06.ogg` | And count them. Every hour. Count them. There should be five. | Audio log in the electrical room, line 6 |
| 7 | `tape_r9_02.ogg` | Log nine. If that's what this is. I'm below. The machine room still has power. | Telemetry recorder in the electrical room (from Night 4), line 2 |
| 8 | `tape_r9_03.ogg` | I found her. Varga. She's been down here since March. She's... mostly still her. | Telemetry recorder in the electrical room (from Night 4), line 3 |
| 9 | `tape_r9_04.ogg` | She wrote it. WARDEN. Every rule you're following up there, she wrote. | Telemetry recorder in the electrical room (from Night 4), line 4 |
| 10 | `tape_r9_05.ogg` | Five perfect nights and you're the fifth. That's what it's for. That's what the seal is counting. | Telemetry recorder in the electrical room (from Night 4), line 5 |
| 11 | `tape_r9_06.ogg` | That request on your terminal last night, from Sublevel B? That was me, asking the door to open. It said no. | Telemetry recorder in the electrical room (from Night 4), line 6 |
| 12 | `tape_r9_07.ogg` | I'll tell you how to break it. Not on the radio. It listens to the radio. | Telemetry recorder in the electrical room (from Night 4), line 7 |

## Dr. Ines Varga (cassette) (6 lines)

**Direction:** A scientist in her early forties recording a private log the night before she refuses. Calm, precise and quiet, with resolve underneath. No crying, no drama: the weight is in how plainly she says it. The game adds tape hiss and a lo-fi filter.

| # | File name | Line | When it plays |
| --- | --- | --- | --- |
| 1 | `tape_iv_01.ogg` | Cycle four. Ines Varga, operator candidate. | Cassette at the Sublevel B door (Night 5), line 1 |
| 2 | `tape_iv_02.ogg` | Four nights without a mistake. WARDEN is very pleased with me. | Cassette at the Sublevel B door (Night 5), line 2 |
| 3 | `tape_iv_03.ogg` | I wrote every rule in this station. Tomorrow I become them. | Cassette at the Sublevel B door (Night 5), line 3 |
| 4 | `tape_iv_04.ogg` | The guard still walks his rounds. The analyst still watches. They are still in there, somewhere. | Cassette at the Sublevel B door (Night 5), line 4 |
| 5 | `tape_iv_05.ogg` | If I finish tomorrow, nobody will ever have to do this again. That is what they told me. | Cassette at the Sublevel B door (Night 5), line 5 |
| 6 | `tape_iv_06.ogg` | I don't think I will. | Cassette at the Sublevel B door (Night 5), line 6 |

## Facility announcer (automated) (45 lines)

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
| 14 | `facility_n3_origin.ogg` | Request origin. Contractor zero three one seven. Contract closed in March. | Night 3 terminal message at 2.50 h |
| 15 | `facility_n3_seal.ogg` | Cell zero five seal integrity. 71 percent. | Night 3 terminal message at 4.00 h |
| 16 | `facility_n4_start.ogg` | Diagnostic cycle 4 initiated. Operator. Contractor zero four one seven. | Night 4 terminal message at 0.00 h |
| 17 | `facility_n4_baseline.ogg` | Subject response above baseline. | Night 4 terminal message at 1.00 h |
| 18 | `facility_n4_seal.ogg` | Cell zero five seal integrity. 40 percent. | Night 4 terminal message at 2.50 h |
| 19 | `facility_n4_count.ogg` | Operator count. 3. | Night 4 terminal message at 4.20 h |
| 20 | `facility_n5_start.ogg` | Final diagnostic cycle initiated. Operator. Contractor zero four one seven. | Night 5 terminal message at 0.00 h |
| 21 | `facility_n5_seal.ogg` | Cell zero five seal integrity. 12 percent. | Night 5 terminal message at 1.50 h |
| 22 | `facility_n5_accounted.ogg` | All subjects accounted for except one. | Night 5 terminal message at 3.00 h |
| 23 | `facility_n5_almost.ogg` | Please remain at your station. We are almost done. | Night 5 terminal message at 5.20 h |
| 24 | `facility_gate_cell_a_lock.ogg` | Containment A. Cell lock released. Authorization. None. | When this gate opens (every night) |
| 25 | `facility_gate_cell_b_lock.ogg` | Containment B. Cell lock released. Authorization. None. | When this gate opens (every night) |
| 26 | `facility_gate_acoustic_seal.ogg` | Acoustics lab. Seal disengaged. | When this gate opens (every night) |
| 27 | `facility_gate_isolation_bulkhead.ogg` | Isolation ward. Bulkhead released by facility automation. | When this gate opens (every night) |
| 28 | `facility_deviation_logged.ogg` | Operator absent from station. Deviation logged. | Night 5, when the operator touches the Sublevel B door after 5 AM |
| 29 | `facility_deviation_1.ogg` | Diagnostic cycle 5 complete. | Night 5 deviation ending, 6 AM line 1 |
| 30 | `facility_deviation_2.ogg` | Operator deviation logged. Sublevel B access point. | Night 5 deviation ending, 6 AM line 2 |
| 31 | `facility_deviation_3.ogg` | Subjects accounted for. 4 of 5. | Night 5 deviation ending, 6 AM line 3 (and 4 more) |
| 32 | `facility_deviation_4.ogg` | Operator status. Retained. Series restarted. | Night 5 deviation ending, 6 AM line 4 |
| 33 | `facility_morning_n1_1.ogg` | Diagnostic cycle 1 complete. | Night 1 at 6 AM, morning line 1 |
| 34 | `facility_morning_n1_2.ogg` | Monitoring infrastructure. Restored. | Night 1 at 6 AM, morning line 2 (and 3 more) |
| 35 | `facility_morning_n1_4.ogg` | Operator status. Retained for cycle 2. | Night 1 at 6 AM, morning line 4 |
| 36 | `facility_morning_n2_1.ogg` | Diagnostic cycle 2 complete. | Night 2 at 6 AM, morning line 1 |
| 37 | `facility_morning_n2_4.ogg` | Operator status. Retained for cycle 3. | Night 2 at 6 AM, morning line 4 |
| 38 | `facility_morning_n3_1.ogg` | Diagnostic cycle 3 complete. | Night 3 at 6 AM, morning line 1 |
| 39 | `facility_morning_n3_4.ogg` | Operator status. Retained for cycle 4. | Night 3 at 6 AM, morning line 4 |
| 40 | `facility_morning_n4_1.ogg` | Diagnostic cycle 4 complete. | Night 4 at 6 AM, morning line 1 |
| 41 | `facility_morning_n4_4.ogg` | Operator status. Retained for cycle 5. | Night 4 at 6 AM, morning line 4 |
| 42 | `facility_morning_n5_1.ogg` | Diagnostic series complete. | Night 5 at 6 AM, morning line 1 |
| 43 | `facility_morning_n5_2.ogg` | Subjects accounted for. 5 of 5. | Night 5 at 6 AM, morning line 2 |
| 44 | `facility_morning_n5_3.ogg` | Operator status. Contained. | Night 5 at 6 AM, morning line 3 |
| 45 | `facility_morning_n5_4.ogg` | Thank you for your participation. | Night 5 at 6 AM, morning line 4 |

