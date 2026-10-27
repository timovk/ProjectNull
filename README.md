# PROJECT NULL

**Version 0.5.0 — Content Complete**

A first-person psychological horror game set in Research Facility N-17, built with HTML, CSS, JavaScript and Three.js. You are a contract technician in a security station from 12 AM to 6 AM, for five nights. Four subjects move through the facility. Their behaviour is driven by a transparent, testable **movement-opportunity simulation**, not by scripts.

There are **no jumpscares**: no sudden faces, no loud stingers, no fast camera moves, no flashing images. Failure is a slow fade.

---

## Quick start

Requirements: Node.js 20 or newer, and a desktop browser with WebGL 2.

```bash
npm install
npm run dev
```

Open http://localhost:5173. Click **Initialize terminal**, then **Practice Night** for a guided first run, or **Start Night 1**. Surviving a night unlocks the next. If you startle easily, tick **No-startle mode** on the first screen.

Stuck? There is a step-by-step guide for every night: [Night 1](docs/GUIDE_N1.md), [Night 2](docs/GUIDE_N2.md), [Night 3](docs/GUIDE_N3.md), [Night 4](docs/GUIDE_N4.md) and [Night 5](docs/GUIDE_N5.md). The Night 2 guide introduces six habits that the later nights depend on.

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload. The AI debugger is enabled. |
| `npm run build` | Production build into `dist/`. It uses relative paths, so it works from any sub-path. |
| `npm run preview` | Serves the production build locally. |
| `npm test` | Runs the automated simulation tests with `node:test`. |
| `npm run balance` | Plays many full nights headlessly with scripted players and prints survival statistics. |
| `npm run voice:script` | Regenerates `docs/VOICE_LINES.md`, the recording script for every spoken line. |
| `npm run voice:manifest` | Rescans `public/voice/` for recordings. `dev` and `build` run it automatically. |

URL parameters:

- `?seed=anything` makes a night reproducible. The same seed and the same actions give the same AI outcomes.
- `?debug=1` enables the AI debugger in a production build, and unlocks every night.
- `?unlock=all` unlocks every night without the debugger.

### Deploying to GitHub Pages

`.github/workflows/deploy.yml` runs the tests, builds, and publishes `dist/` on every push to `main`. To use it, enable Pages once in the repository under **Settings → Pages → Source: GitHub Actions**.

---

## Controls

| Action | Key |
| --- | --- |
| Move | `W` `A` `S` `D` |
| Look | Mouse. Click the view to capture the pointer, or drag if pointer lock is unavailable. |
| Walk slowly | `Shift` |
| Interact | `E` |
| Hold to repair, reset or brace | Hold `E` |
| Leave workstation or document | `E` or `Esc` |
| Switch camera (at the workstation) | `1`–`9`, `0`, `-`, `=`, or click the map |
| Previous / next camera | `[` / `]` |
| Workstation panels | `Tab` |
| Pause | `Esc` |
| AI debugger (dev, or `?debug=1`) | `F3` |
| Debug time scale 1x / 4x / 16x | `F4` |

**What pauses the night:** only the pause menu, and the settings or controls screens opened from it. The night also pauses when the window is hidden or the pointer lock is lost. The surveillance workstation, documents and the AI debugger do **not** pause the night.

---

## How It Works screen

The main menu has a **How It Works** screen for anyone who wants the maths. It covers the d20 roll and what each AI level means, the night's schedule and timed gates, every subject's numbers and counters, the four traits and global rules, power and noise, a strategy guide (the basics plus the six habits from the night guides), and the engine internals. It includes three live calculators: the roll odds and arrival times, route-choice probabilities by aggression, and a station console simulator for noise and power drain. Every number is computed from the game's own config, and `tests/howitworks.test.js` checks the calculators against the simulation.

## The five nights

Night progress is saved in the browser. Each night raises every subject's level hour by hour, and each adds a few terminal messages about cell 05. From Night 2 on, new documents and audio logs appear in the station and the electrical room (`NIGHT_ITEMS` in `src/content/Documents.js`).

**Subject records.** The workstation has a FILES tab. Surviving a campaign night in which a subject left its cell unlocks WARDEN's record for it: its former role, its anchor and one personal detail. Former names stay withheld (`src/content/SubjectFiles.js`).

Night 5 has **two endings**. The default one follows the rules to the end. The other, the canon ending, is explained by R.'s note on the Night 5 work order and lives in `src/content/Endings.js`. Reaching it changes the main menu. The default ending closes on CAM 13, a camera that is not on the workstation's list. The full story is in [`docs/lore/LORE_DRAFT.md`](docs/lore/LORE_DRAFT.md) (spoilers).

| Night | 12 AM levels (W/O/E/P) | 5 AM levels | Expert survives | Distracted survives |
| --- | --- | --- | --- | --- |
| 1 | 3/2/1/0 | 7/6/5/3 | 99% | 100% |
| 2 | 5/4/3/1 | 11/10/9/7 | 90% | 93% |
| 3 | 7/6/5/3 | 13/12/11/9 | 73% | 78% |
| 4 | 8/7/6/4 | 15/14/13/11 | 57% | 71% |
| 5 | 9/8/7/5 | 17/16/15/13 | 35% | 51% |

The survival figures are for scripted players over 200 simulated nights each. "Expert" reacts in 1.5 s, and "distracted" reacts in 5 s and checks the Observer once a minute. Both see every subject at once, so humans should expect lower numbers. The full hourly schedules are in `NIGHT_SCHEDULES` in `src/config/GameConfig.js`, and on the How It Works screen.

### How the curve was tuned

No single subject is hard on its own: a scripted player beats any one of them at AI 20. Difficulty comes from two shared limits:

- **Power.** Every defence draws from one battery. The more often subjects come, the sooner it runs out.
- **The Echo.** The more the others force you to move doors or use the field, the more noise you make while it listens.

With the original economy these limits made a cliff around AI 8: all-8s survived 7% and all-10s 0%. Three changes turned that cliff into a slope:

- The containment field costs half as much, 0.15%/s instead of 0.30%/s.
- The facility base load is lower, 0.018%/s instead of 0.026%/s.
- Moving doors are quieter: +12 dBn instead of +35, so in a fully silent station a door alone no longer lets the Echo in.

Later, the Echo got a give-up rule: half a minute of unbroken silence in the duct sends it away, whatever its rolls. Before that, a low-level Echo needed minutes of lucky rolls to leave, so on Night 1 it stayed a median of 88 s (up to 4½ minutes) while the fan was off and the cameras overheated. Now the median is 38 s on every night. The rule hardly changes survival: over 600 fresh nights each, Night 4 and Night 5 moved by less than one point.

Then one difficulty knob, which scales every subject's opening and 5 AM levels, was swept and each night was placed on the resulting curve.

## Custom Night

**Custom Night** on the main menu lets you set each subject's AI level from 0 to 20. The levels stay fixed from 12 AM to 6 AM. As you move the sliders, the screen plays 24 headless nights with the scripted expert player and shows how often it survives, from COMFORTABLE to IMPOSSIBLE. Measured over 80 nights each:

| Levels | Skilled-player survival |
| --- | --- |
| 5/4/3/1 (Night 1 average) | 99% |
| 3/3/3/3 | 93% |
| 5/5/5/5 | 81% |
| 7/7/7/7 | 73% |
| 8/8/8/8 | 46% |
| 10/10/10/10 | 28% |
| 12/12/12/12 | 21% |
| 15/15/15/15 | 10% |
| 20/20/20/20 | 3% |

20/20/20/20 is meant as a near-impossible challenge.

## Ambience

The atmosphere carries real information:

- **Dread drone.** A very low, slowly beating, slightly dissonant tone swells as the nearest creature gets closer, and is silent while everything is more than about three rooms away. It also rises slightly through the night. Changes take 4 to 6 seconds, so it is never sudden.
- **The station holds its breath.** While an awake creature waits right outside, at a door or in the duct, the station's hum, ventilation, machinery and room tone dip to about 40%. A subtitle marks the moment for players without sound.
- **Camera speaker.** The workstation has a small speaker that plays the room you are watching: its own air and machinery, and anything in it. You hear the Wanderer's shuffling, the Patient's breathing and the Echo's murmuring through the feed, and footsteps when something walks into or out of view. The Observer makes almost no sound. A dead feed is static. From across the station the speaker is faintly audible.

`tests/ambience.test.js` checks when the station hushes, how the drone scales, and what the speaker can hear.

## Voices

R.'s radio briefing, the audio log in the electrical room and the facility's announcements (terminal messages, gate releases and the 6 AM report) are spoken. The text always appears too.

Each line plays, in order of preference:

1. **A recording**, if `public/voice/<id>.ogg` (or `.mp3`, `.wav`) exists. It goes through the game's audio: a radio filter positioned at the desk radio for R., a lo-fi filter at the tape recorder for the audio log, and a hall echo for the facility. Every clip is normalised to the same safe level and faded in.
2. **The browser's built-in voice** (Settings → Audio → *Browser voices*), with a slower, lower setting per speaker. Which voices exist depends on the browser and operating system.
3. **Text only**, if browser voices are off.

Lines play one at a time, in order. They pause with the game and stop on a new night, at the menu and when a night ends. *Voices* in the audio settings sets their volume.

### Recording your own lines

[`docs/VOICE_LINES.md`](docs/VOICE_LINES.md) is the recording script: 55 lines, each with its file name, the exact text, when it plays and direction per speaker. Save a take as `public/voice/<file name>` and run `npm run dev` or `npm run build`; that line now uses your recording, and the rest keep the browser voice. Lines with the same words in several places are recorded once.

All lines live in `src/content/` and are collected by `src/content/VoiceLines.js`. After changing a line, run `npm run voice:script` to update the script.

## Practice night, radio briefing and no-startle mode

**Practice night** is a guided run of the same simulation that cannot be lost.

- A live map in the top-right corner, and dots on the workstation map, show where each creature really is.
- A coach panel shows one lesson at a time, triggered by what is really happening: sit at the desk, switch cameras, close a door, light a corridor, check the Observer, silence the room for the Echo, use the field for the Patient, fix a camera, and survive a blackout.
- Urgent lessons slow time to half speed until you act.
- If something gets in, the night does not end. The breach is logged, the creature is sent back to its cell, and the coach explains what went wrong.
- AI levels are gentler (`PRACTICE_SCHEDULE` in `src/config/GameConfig.js`), but the Patient becomes active from 1 AM so every lesson can happen.

**Radio briefing.** In a real Night 1, R., the previous technician, radios in during the first two and a half minutes. Each message explains one system, and several are timed to the moment a cell actually unlocks. Messages are also written to the workstation's LOG tab. You can turn the briefing off in Settings.

**No-startle mode.** This is an option on the first screen and in Settings. When it is on:

- Every entity and ambient sound swells in over at least 0.22 s at about two-thirds volume, and the radio has no random crackle spikes.
- The Sublevel B knock and the random impact and footstep-like ambient sounds are removed.
- All light changes ease over a few seconds, including the power-failure blackout, and flicker is off.
- Camera disruptions dim the feed smoothly instead of bursting into static.
- In the loss sequence, nothing appears in the doorway. The room just fades.

## The facility and its systems

- **Security station.** It holds the surveillance workstation, the facility terminal and acoustic monitor, the two security doors with their control panels, the containment field console, the ventilation switch, the radio, the emergency power panel, the signal relay panel and the wall clock.
- **Maintenance corridor and electrical room.** Reached through the rear door. They hold the door-motor breakers, the single-use auxiliary power cell, documents and an audio log.
- **Visible but inaccessible areas.** The approach corridors beyond each door window, a flooded pump room behind a grille, and the sealed Sublevel B door.

Every system draws from one power cell:

| System | Drain (%/s) | Notes |
| --- | --- | --- |
| Facility base load | 0.018 | Always on. |
| Station lights | 0.010 normal, 0.003 low | Set on the emergency power panel. |
| Surveillance rack | 0.015 | Plus 0.020 while you watch a feed. |
| Ventilation fan | 0.008 | Keeps the camera rack from overheating. |
| Radio | 0.002 | Its interference rises as entities come closer. |
| Each closed door | 0.110 | |
| Each corridor light | 0.055 | |
| Containment field | 0.150 | About 9% per minute. |

At 0% power everything shuts down and emergency lighting comes on. **This is not an automatic death.** Doors can be braced by hand by holding `E` on their yellow manual release. The auxiliary cell can restore 15% once.

---

## The AI movement system

### The movement opportunity

Each entity has its own timer in simulation time. Whenever the timer elapses, the entity gets a **movement opportunity**:

```text
roll = rng.int(1, 20)
success = roll <= effectiveAI          P(success) = effectiveAI / 20
```

AI 0 never succeeds. AI 20 always succeeds. `effectiveAI` is the AI level plus documented, capped modifiers, clamped to 0–20. An AI-0 entity is dormant and its effective AI is always exactly 0.

Every opportunity runs the same ten steps in `src/ai/MovementOpportunity.js`:

1. Is the entity active?
2. Is movement permitted? For example, the Observer cannot move while it is being watched.
3. Roll the d20.
4. Compare against the effective AI.
5. Decide whether the opportunity succeeded.
6. Choose a destination or action.
7. Apply restrictions: graph edges, doors, gates, light, silence, the field.
8. Update the position.
9. Emit feedback events for audio, cameras and subtitles.
10. Record the result in the event log.

A successful roll is **not** a move. The log keeps these outcomes distinct: `ROLL_FAILED`, `MOVED`, `RETREATED`, `STAYED`, `BLOCKED`, `INVALID_DESTINATION`, `SUPPRESSED`, `STATE_TRANSITION`, `ATTACK_BLOCKED` and `ATTACK_SUCCESS`.

| Entity | Interval | Home | Enters through |
| --- | --- | --- | --- |
| Subject 01, the Wanderer | 5.0 s | Containment A | West or east door |
| Subject 02, the Observer | 6.5 s | Containment B | West or east door |
| Subject 03, the Echo | 4.2 s | Acoustics Lab | The station duct, through the vents |
| Subject 04, the Patient | 8.0 s | Isolation Ward | West or east door |

### AI level schedule (Night 1)

These values live in `AI_SCHEDULE` in `src/config/GameConfig.js`. Nights 2 to 5 are in `NIGHT_SCHEDULES`.

| Entity | 12 AM | 1 AM | 2 AM | 3 AM | 4 AM | 5 AM |
| --- | --- | --- | --- | --- | --- | --- |
| Wanderer | 3 | 3 | 4 | 5 | 6 | 7 |
| Observer | 2 | 2 | 3 | 4 | 5 | 6 |
| Echo | 1 | 1 | 2 | 3 | 4 | 5 |
| Patient | 0 | 0 | 0 | 1 | 2 | 3 |

Containment A opens at 12:30, the Acoustics Lab at 12:54 and Containment B at 1:00. The Isolation bulkhead opens at 2:00. These locked gates keep the first half hour an introduction. Successful rolls before a release are logged as `BLOCKED (GATE_CLOSED)`.

### The four attributes

The AI level is the only input to the roll. Each attribute modifies exactly one other kind of decision. The formulas are in `src/ai/BehaviorModifiers.js`, and each is tested.

| Attribute | Controls | Formula |
| --- | --- | --- |
| **Aggression** | Where it wants to go | Route weight toward the station is multiplied by (1 + 2a). Away from the station, by (1 − 0.5a), which is never zero. Here a = aggression / 20. |
| **Awareness** | What it can sense | Strength of the entity's own stimulus. See the next table. |
| **Patience** | How long it tolerates obstacles | Blocked attempts before its behaviour changes = 1 + floor(patience / 4). |
| **Intelligence** | How well it routes | P(informed decision) = intelligence / 20. An informed decision routes on the live map, where closed doors and gates are missing edges, instead of the static map. |

| Entity | Awareness effect | Patience effect | Counter |
| --- | --- | --- | --- |
| Wanderer | Light deterrence = 0.40 + 0.60 × awareness/20. A lit corridor blocks entry with that chance. It flees a corridor whose light comes on. | Retreats two rooms. | Corridor lighting, then doors. |
| Observer | Detection takes 2.5 − 2.0p seconds of continuous watching. Agitation gains 0.45 × (0.25 + 0.75p) per second, capped at 10. | Retreats two rooms. | Brief, regular checks. Watching freezes it, but each 2.5 agitation adds +1 AI, up to +4. At 8 agitation it stops freezing. After 60 s unwatched, its aggression rises by up to +8. |
| Echo | Hearing: each room hop keeps 0.30 + 0.35p of the noise, out to 2 + floor(awareness/5) hops. It enters only while station noise ≥ 0.50 − 0.30p. | Retreats two rooms after 3 silent attempts, or after 7.5 intervals (31.5 s) of unbroken silence in the duct, whichever comes first. Any noise above the line restarts that wait. | Silence: fan, radio, moving doors and the field are all loud. Diagnostic pings act as lures. Informed decisions discount pings to 35%. |
| Patient | Hears its door open and takes a reactive opportunity after 1 + 5(1 − p) seconds. | Forces a closed door after 5 blocked attempts. Withdraws home after 10 + 0.75 × patience seconds of field exposure. | Containment field, plus repairing forced doors. Resolve adds +1 AI per 20 s waiting, up to +5. |

Here p = awareness / 20.

Global rules:

- **Retreat urgency.** While retreating, effective AI is at least 10.
- **Blackout.** During a power failure, every active entity gains +2 effective AI.
- **Settle time.** An entity at a door or the duct waits 1.5 of its own intervals before its first entry attempt. Its arrival is always audible and visible, so every entity gives a guaranteed reaction window: the Wanderer at least 10 s, the Echo 8.4 s, the Observer 13 s.

### Graph

`src/config/FacilityLayout.js` defines 14 rooms and their edges as data. The graph supports:

- bidirectional and one-way edges
- restricted passages (the vents are Echo-only, and the station doors exclude the Echo)
- security doors
- locked gates on a schedule
- a temporary obstacle (the decontamination cycle)
- weighted edges

Entities can only ever move along an existing, allowed edge. Retreats also walk the graph. Nothing teleports.

### Timing and determinism

- A fixed 1/60 s timestep. Simulation time is `stepCount × dt`, so it never drifts.
- Frames add real time to an accumulator. A safeguard caps the backlog at 2 s. Because opportunities are scheduled in simulation time, long frames never skip them.
- Each entity, and the facility events, draw from their own seeded random stream. Simultaneous opportunities resolve by due time, then in a fixed entity order.
- Player commands are recorded with their step index, so a night can be replayed exactly. The tests do this.

The simulation (`src/core/Simulation.js`) has no Three.js or DOM dependencies. The renderer, audio and UI only read its state and send it commands. Camera feeds are real renders of the rooms, with the entity models placed where the simulation says they are.

---

## AI debugger

Press `F3` in `npm run dev`, or in any build opened with `?debug=1`. The debugger shows, for every entity:

- AI and effective AI, with the success probability
- interval and time until the next opportunity
- room, state and target
- last roll and result
- attributes, live modifiers and running statistics

The event log streams real records from the simulation in this form:

```text
[03:42:18.100] SUBJECT_01 opportunity
[03:42:18.100] AI=6 ROLL=4 SUCCESS
[03:42:18.100] EAST_CORRIDOR -> EAST_APPROACH  MOVED
```

Buttons pause the simulation or run it at 1x, 4x or 16x. You can filter out failed rolls or system events, and copy the log.

---

## Tests and balance

`npm test` runs 121 tests in about 12 seconds:

- **Probability.** Over 100,000 trials, AI 0 succeeds exactly 0% of the time and AI 20 exactly 100%. AI 10 converges to 50%, AI 5 to 25%, and every level 0–20 to AI/20. The d20 is uniform.
- **Pipeline.** Successful rolls and successful moves are counted separately. Blocked and invalid outcomes are distinct.
- **Clock.** Fixed steps and catch-up. Identical AI outcomes at 30 fps, 144 fps and with random frame jitter. Hitches skip no opportunities. The night length is configurable.
- **Graph.** Validation, one-way edges, restricted edges, doors, gates and live distances. Across full simulated nights, every move follows a valid, allowed edge.
- **AI.** Independent timers, the schedule, AI caps, deterministic simultaneous ordering, seed determinism and exact replay. Every attribute formula and every entity countermeasure is checked, including the Echo giving up after half a minute of silence.
- **Power.** Each drain, failure without automatic death, the manual brace, the auxiliary cell and thermal shutdown.
- **Balance.** Scripted players over 40 seeds each, plus the fairness rules.
- **Campaign.** Each night is never easier than the one before, Night 1 stays gentle, and Night 5 stays winnable. Saved progress unlocks nights in order.
- **Practice.** A practice breach is logged and sends the creature home without ending the night. A real night never uses that reset.
- **Failure advice.** A breach records what the station was doing, and the end screen names the cause: the auxiliary cell's bang, the field, a moving door, the fan or radio, a power failure, a forced door, or the Patient arriving while the Echo listened.
- **Story.** Later-night documents and tapes exist and keep the subjects anonymous; the second ending only counts on Night 5, after R.'s note, between 5 and 6 AM, once; progress remembers the note and the endings; subject records cover all four subjects without their former names and unlock for subjects that left their cells; the Night 3 request from Sublevel B is traced to R.
- **Voices.** Every spoken line has a voice line id, ids are unique file names, terminal text becomes natural speech, the manifest matches recordings to lines and the recording script lists every line.

Night 1 results from `npm run balance` over 200 seeds:

| Scripted player | Survival |
| --- | --- |
| Does nothing | 0% |
| Only closes doors | 7% |
| Uses every countermeasure, 1.5 s reactions | 100% |
| Slow (3.5 s reactions, checks the Observer every 40 s) | 99% |
| Distracted (5 s reactions, notices the Echo only when it is directly overhead) | 100% |

The scripted players see every entity at once, which no human can. Expect real first attempts to go worse.

---

## Accessibility and comfort

Settings are saved in the browser:

- **Controls:** mouse sensitivity, invert Y, field of view.
- **Audio:** master, ambient, entity, interface and voice volume; browser voices on or off.
- **Display and comfort:** no-startle mode, brightness, reduced visual distortion, reduced camera motion, disable flickering lights, subtitles and textual sound cues, contextual hints, radio briefing.
- **Graphics:** resolution scale, shadows, post-processing (grain, vignette and a soft bloom on tubes and screens), lighting quality (low drops the bloom, the desk-screen glow and the drifting dust), render distance, frame-rate display.

Every gameplay-relevant sound has a textual cue. Flicker never carries information. All audio is synthesized with soft attacks and passes through a limiter.

---

## Project structure

```text
src/
  main.js                 entry point
  config/                 GameConfig (balance), FacilityLayout (graph data)
  core/                   Simulation, GameClock, Random, EventBus, EventLog, Game, GameState, Progress
  ai/                     Entity, MovementOpportunity, MovementGraph, BehaviorModifiers, AIManager
  ai/entities/            Wanderer, Observer, Echo, Patient
  systems/                Power, Security, Surveillance, Noise, FacilityEvents, NightProgression,
                          AudioSystem, EntitySoundscape, CameraSpeaker, VoiceSystem
  world/                  Facility, RoomBuilder, Doors, Lighting, StationPresenter,
                          StationDressing, StationAtmosphere, EntityModels, EntityPresenter, Environment
  render/                 Textures, Materials, PostFX, CameraFeedRenderer
  player/                 PlayerController, InteractionSystem, Interactions
  ui/                     MainMenu, HowItWorks, CustomNight, SettingsMenu, PauseMenu, HUD, SurveillanceUI, FacilityMap,
                          PracticeCoach, RadioBriefing, DocumentViewer, Subtitles, EndScreen,
                          AIDebugger, Settings
  content/                Documents, TerminalMessages, Hints, PracticeLessons, RadioBriefing, VoiceLines
  styles/main.css
tests/                    *.test.js, tools/balanceReport.js (scripted players: src/ai/ScriptedPlayers.js)
scripts/                  voiceManifest.js, voiceScript.js
public/voice/             recorded voice lines and their generated manifest.json
docs/VOICE_LINES.md       recording script (generated)
```

---

## Known limitations

- Nights 2 to 5 differ from Night 1 in AI levels and story text only. They add no new mechanics yet.
- Art and audio are fully procedural. Entity models are sculpted from lathe profiles and noise, with generated skin, cloth and bandage textures (`src/world/EntityModels.js`); they are not rigged, so movement between rooms is staged rather than animated. Voices use the browser's built-in speech until recordings are added, and browser voices vary in quality between systems.
- The game targets desktop browsers with a mouse and keyboard. There is no touch or gamepad input.
- Balance was tuned against scripted players and a short browser pass, not human playtests.
