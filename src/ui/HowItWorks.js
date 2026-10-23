import { el, showScreen } from './dom.js';
import {
  GAME_CONFIG, PRACTICE_SCHEDULE, ENTITY_DEFS, ENTITY_ORDER, ENTITY_IDS, NIGHT_SCHEDULES, NIGHT_MEASURED_SURVIVAL,
  RETREAT_AI_FLOOR, BLACKOUT_AI_BONUS, POWER_CONFIG, NOISE_CONFIG, SURVEILLANCE_CONFIG,
  FACILITY_EVENT_CONFIG, FIXED_TIMESTEP, CLOCK_CONFIG
} from '../config/GameConfig.js';
import { ROOMS, GATES, STATION } from '../config/FacilityLayout.js';
import * as BM from '../ai/BehaviorModifiers.js';
import { THRESHOLD_SETTLE_INTERVALS } from '../ai/Entity.js';
import { MovementGraph } from '../ai/MovementGraph.js';
import { formatGameClock } from '../core/GameClock.js';

/*
 * "How It Works": the science behind the night.
 *
 * Every number on this screen is computed from the same config and formulas
 * the simulation uses (GameConfig, BehaviorModifiers, the movement graph), so
 * it cannot drift out of date when the game is rebalanced.
 */

const { WANDERER, OBSERVER, ECHO, PATIENT } = ENTITY_IDS;
const HOUR = GAME_CONFIG.nightDurationSeconds / (GAME_CONFIG.endHour - GAME_CONFIG.startHour);
const graph = new MovementGraph();
const D = POWER_CONFIG.drain;
const N = NOISE_CONFIG.station;

const pct = (p, digits = 0) => `${(p * 100).toFixed(digits)}%`;
const sec = (s) => (Number.isFinite(s) ? (s >= 120 ? `${(s / 60).toFixed(1)} min` : `${s.toFixed(1)} s`) : 'never');
const n2 = (v) => (Math.round(v * 100) / 100).toString();
const short = (id) => ENTITY_DEFS[id].name.replace('THE ', '').toLowerCase().replace(/^./, (c) => c.toUpperCase());
const hops = (id) => graph.distancesTo(STATION, id).get(ENTITY_DEFS[id].homeRoom);
const releaseClock = (gate) => formatGameClock(GATES[gate].releaseAtHour);

/** Statistics of the d20 roll for one subject at one effective AI level. */
export function rollStats(ai, interval) {
  const p = Math.max(0, Math.min(20, ai)) / 20;
  const within = (t) => 1 - Math.pow(1 - p, Math.floor(t / interval + 1e-9));
  return {
    p,
    opportunitiesPerHour: HOUR / interval,
    successesPerHour: (p * HOUR) / interval,
    meanWait: p > 0 ? interval / p : Infinity,
    within
  };
}

/** Fastest and typical time from "free to move" to "inside", if it heads straight for you. */
export function routeTimes(id, ai) {
  const def = ENTITY_DEFS[id];
  const i = def.movementInterval;
  const h = hops(id);
  const p = Math.max(0, Math.min(20, ai)) / 20;
  const fastest = (h + 1) * i; // every roll succeeds; settle skips one opportunity
  const typical = p > 0 ? ((h - 1) * i) / p + i + i / p : Infinity;
  return { hops: h, fastest, typical };
}

/** Station noise and power drain for a console configuration. */
export function consoleModel(c) {
  const powered = c.lights !== 'EMERGENCY';
  const noise = {
    base: N.base,
    lights: c.lights === 'NORMAL' ? N.stationLightsNormal : c.lights === 'LOW' ? N.stationLightsLow : 0,
    rack: powered && c.rack ? N.workstationRack : 0,
    cameras: powered && c.rack && c.viewing ? N.cameraViewing : 0,
    fan: powered && c.fan ? N.ventilationFan : 0,
    radio: powered && c.radio ? N.radio : 0,
    doorsShut: powered ? N.doorClosedHum * c.doors : 0,
    field: powered && c.field ? N.barrier : 0,
    you: (c.walking ? N.playerWalking : 0) + (c.working ? N.playerWorking : 0),
    doorMoving: c.doorMoving ? N.doorPulse : 0
  };
  const drain = powered
    ? D.facilityBase
      + (c.lights === 'NORMAL' ? D.stationLightsNormal : D.stationLightsLow)
      + (c.rack ? D.workstationRack : 0)
      + (c.rack && c.viewing ? D.cameraViewing : 0)
      + (c.fan ? D.ventilationFan : 0)
      + (c.radio ? D.radio : 0)
      + D.doorClosed * c.doors
      + D.corridorLight * c.corridorLights
      + (c.field ? D.barrier : 0)
    : 0;
  const total = Object.values(noise).reduce((a, b) => a + b, 0);
  return { noise, total, drain };
}

export function echoThreshold() {
  const t = ENTITY_DEFS[ECHO].tuning;
  return t.listenThresholdBase - t.listenThresholdSpan * BM.perception(ENTITY_DEFS[ECHO].attributes.awareness);
}

// ------------------------------------------------------------------ helpers

function table(head, rows, cls = '') {
  return el('table', { class: `hiw-table ${cls}` }, [
    el('thead', {}, [el('tr', {}, head.map((h) => el('th', { html: h })))]),
    el('tbody', {}, rows.map((r) => el('tr', {}, r.map((c) => el('td', { html: String(c) })))))
  ]);
}

function prose(html) {
  return el('div', { class: 'hiw-prose', html });
}

function h(text) {
  return el('h3', { class: 'hiw-h', text });
}

function slider(label, min, max, step, value, onInput) {
  const out = el('span', { class: 'hiw-val' });
  const input = el('input', { type: 'range', min, max, step, value });
  const update = () => {
    out.textContent = input.value;
    onInput(Number(input.value));
  };
  input.addEventListener('input', update);
  return { node: el('label', { class: 'hiw-control' }, [el('span', { text: label }), input, out]), update, input };
}

function checkbox(label, checked, onChange) {
  const input = el('input', { type: 'checkbox' });
  input.checked = checked;
  input.addEventListener('change', () => onChange(input.checked));
  return el('label', { class: 'hiw-check' }, [input, el('span', { text: label })]);
}

function select(label, options, value, onChange) {
  const input = el('select', {}, options.map(([v, t]) => el('option', { value: v, text: t })));
  input.value = value;
  input.addEventListener('change', () => onChange(input.value));
  return el('label', { class: 'hiw-control' }, [el('span', { text: label }), input]);
}

// ------------------------------------------------------------------ sections

function sectionRoll() {
  const levels = [0, 1, 2, 3, 5, 7, 10, 15, 20];
  const node = el('div');
  node.append(
    h('ONE ROLL DECIDES EVERYTHING'),
    prose(`
      <p>Every subject has its own clock. Each time it ticks, the subject gets a <b>movement opportunity</b>: the game rolls a twenty-sided die.</p>
      <pre class="hiw-code">roll    = random whole number from 1 to 20
success = roll &lt;= effective AI level
P(success) = effective AI / 20</pre>
      <p>So the AI level is literally "how many faces of the die mean yes". AI 0 never moves (no roll can be 0 or lower). AI 20 always does. Nothing else touches this roll: personality traits only shape <i>where</i> a subject goes and <i>how it reacts</i> once the roll has succeeded.</p>
      <p>A successful roll is not a guaranteed move. After the roll the subject picks a destination, and a lit corridor, a shut door, a sealed gate or a quiet room can still stop it. The AI debugger shows both: "AI=4 ROLL=3 SUCCESS" followed by "BLOCKED (LIGHT_DETERRED)".</p>
      <p><b>Effective AI</b> is the level from the night's schedule plus a few documented, capped modifiers (the Observer's agitation, the Patient's resolve, +${BLACKOUT_AI_BONUS} for everyone during a power failure, and a floor of ${RETREAT_AI_FLOOR} while a subject is retreating). It is always clamped to 0 to 20, and a subject at AI 0 stays exactly at 0.</p>
    `),
    h('WHAT AN AI LEVEL MEANS'),
    table(
      ['AI', 'P(success)', 'about 1 in', 'Wanderer: mean wait', 'Patient: mean wait'],
      levels.map((ai) => {
        const p = ai / 20;
        return [ai, pct(p), p > 0 ? (1 / p).toFixed(1) : '-', sec(rollStats(ai, ENTITY_DEFS[WANDERER].movementInterval).meanWait), sec(rollStats(ai, ENTITY_DEFS[PATIENT].movementInterval).meanWait)];
      })
    ),
    prose(`<p>"Mean wait" is the average time until the next successful roll: <code>interval / P</code>. Rolls are independent, so a subject that just failed is no more "due" than one that just succeeded.</p>`),
    h('ROLL CALCULATOR'),
    rollCalculator()
  );
  return node;
}

function rollCalculator() {
  const state = { id: WANDERER, ai: 5, bonus: 0 };
  const out = el('div', { class: 'hiw-results' });
  const render = () => {
    const def = ENTITY_DEFS[state.id];
    const eff = Math.max(0, Math.min(20, state.ai + state.bonus));
    const ai = state.ai === 0 ? 0 : eff;
    const s = rollStats(ai, def.movementInterval);
    const r = routeTimes(state.id, ai);
    out.replaceChildren(
      table(['', ''], [
        ['Effective AI', `${ai}${state.ai === 0 && state.bonus ? ' (AI 0 is dormant: bonuses do not apply)' : ''}`],
        ['P(success) per opportunity', pct(s.p)],
        ['Opportunity every', `${def.movementInterval.toFixed(1)} s (${s.opportunitiesPerHour.toFixed(1)} per in-game hour)`],
        ['Successful rolls per in-game hour', s.successesPerHour.toFixed(1)],
        ['Mean wait for the next success', sec(s.meanWait)],
        ['Chance of at least one success in 10 s / 30 s / 60 s', `${pct(s.within(10))} / ${pct(s.within(30))} / ${pct(s.within(60))}`],
        ['Rooms between its home and you', `${r.hops} (${r.hops - 1} moves to your door, then 1 to get in)`],
        ['Fastest possible arrival inside', `${sec(r.fastest)} after it is free to move (every roll succeeds, every choice heads your way)`],
        ['Typical arrival if it heads straight for you', sec(r.typical)]
      ], 'kv')
    );
  };
  const who = select('Subject', ENTITY_ORDER.map((id) => [id, `${ENTITY_DEFS[id].designation} ${short(id)} (every ${ENTITY_DEFS[id].movementInterval} s)`]), state.id, (v) => {
    state.id = v;
    render();
  });
  const ai = slider('AI level', 0, 20, 1, state.ai, (v) => {
    state.ai = v;
    render();
  });
  const bonus = slider('Modifiers (+)', 0, 6, 1, state.bonus, (v) => {
    state.bonus = v;
    render();
  });
  ai.update();
  bonus.update();
  render();
  return el('div', { class: 'hiw-calc' }, [
    el('div', { class: 'hiw-controls' }, [who, ai.node, bonus.node]),
    out,
    prose(`<p>"Typical" assumes it always heads toward you, which real subjects do not, so treat it as a pessimistic estimate. The fastest case includes the settle rule: after arriving at a door it skips one opportunity before it may try to enter.</p>`)
  ]);
}

function sectionNight() {
  const node = el('div');
  const gateRows = Object.entries(GATES)
    .filter(([, g]) => g.releaseAtHour !== undefined)
    .sort((a, b) => a[1].releaseAtHour - b[1].releaseAtHour)
    .map(([id, g]) => [releaseClock(id), `${(g.releaseAtHour * HOUR).toFixed(0)} s`, g.name, {
      CELL_A_LOCK: 'Wanderer can leave its cell',
      ACOUSTIC_SEAL: 'Echo can leave the lab',
      CELL_B_LOCK: 'Observer can leave its cell',
      ISOLATION_BULKHEAD: 'Shortcut for the Patient opens'
    }[id] ?? '']);
  const hoursHead = ['', '12 AM', '1 AM', '2 AM', '3 AM', '4 AM', '5 AM'];
  node.append(
    h('THE CLOCK'),
    prose(`
      <p>A night lasts <b>${GAME_CONFIG.nightDurationSeconds} real seconds</b> (${(GAME_CONFIG.nightDurationSeconds / 60).toFixed(0)} minutes), so one in-game hour is <b>${HOUR.toFixed(0)} seconds</b>. AI levels change exactly on the hour.</p>
      <p>The game time only advances while you are playing. Pausing, or the window losing focus, stops it. The desk computer and documents do <i>not</i> pause it.</p>
    `),
    h('THE FIVE NIGHTS'),
    prose(`<p>Each night raises every subject's level hour by hour. Nights 2 to 5 were tuned by simulating 200 nights each, so that survival falls steadily. "Expert" is the scripted player that reacts in 1.5 s; "distracted" reacts in 5 s and checks the Observer only once a minute. Both see every subject at once, which no human can, so expect lower numbers yourself.</p>`),
    table(['Night', 'Expert survives', 'Distracted survives', 'Highest level (5 AM)'], Object.keys(NIGHT_SCHEDULES).map((n) => [
      n,
      `${NIGHT_MEASURED_SURVIVAL[n].expert}%`,
      `${NIGHT_MEASURED_SURVIVAL[n].distracted}%`,
      ENTITY_ORDER.map((id) => NIGHT_SCHEDULES[n][id][5]).join(' / ')
    ])),
    ...Object.keys(NIGHT_SCHEDULES).flatMap((n) => [
      h(`AI SCHEDULE, NIGHT ${n}`),
      table(hoursHead, ENTITY_ORDER.map((id) => [`${ENTITY_DEFS[id].designation} ${short(id)}`, ...NIGHT_SCHEDULES[n][id]]))
    ]),
    h('AI SCHEDULE, PRACTICE NIGHT'),
    table(hoursHead, ENTITY_ORDER.map((id) => [`${ENTITY_DEFS[id].designation} ${short(id)}`, ...PRACTICE_SCHEDULE[id]])),
    h('LOCKED DOORS THAT OPEN ON THEIR OWN'),
    prose(`<p>Nothing can reach you in the first half hour: the cells are sealed. Rolls still happen while a cell is locked, and successes show up in the debugger as <code>BLOCKED (GATE_CLOSED)</code>.</p>`),
    table(['Time', 'Sim time', 'Gate', 'Effect'], gateRows),
    h('BACKGROUND EVENTS'),
    prose(`
      <p><b>Decontamination cycle:</b> every ${FACILITY_EVENT_CONFIG.deconIntervalMin} to ${FACILITY_EVENT_CONFIG.deconIntervalMax} s, the gate between the Research Hall and the Central Junction seals for ${FACILITY_EVENT_CONFIG.deconClosedSeconds} s. Subjects trying to pass are blocked.</p>
      <p><b>Camera faults:</b> from about ${FACILITY_EVENT_CONFIG.cameraFaultStart} s in, a random camera loses signal every ${FACILITY_EVENT_CONFIG.cameraFaultIntervalMin} to ${FACILITY_EVENT_CONFIG.cameraFaultIntervalMax} s for ${FACILITY_EVENT_CONFIG.cameraFaultDurationMin} to ${FACILITY_EVENT_CONFIG.cameraFaultDurationMax} s, unless you reset the signal relay.</p>
      <p>Both run on their own random stream, so they never change a subject's dice.</p>
    `)
  );
  return node;
}

function sectionSubjects() {
  const node = el('div');
  const w = ENTITY_DEFS[WANDERER];
  const o = ENTITY_DEFS[OBSERVER];
  const e = ENTITY_DEFS[ECHO];
  const p = ENTITY_DEFS[PATIENT];
  const ot = o.tuning;
  const op = BM.perception(o.attributes.awareness);
  const gain = ot.agitationGainPerSecond * (0.25 + 0.75 * op);
  const detect = ot.detectBaseSeconds - ot.detectSpanSeconds * op;
  const et = e.tuning;
  const falloff = et.falloffBase + et.falloffSpan * BM.perception(e.attributes.awareness);
  const pt = p.tuning;
  const barrierSecs = pt.barrierBaseSeconds + pt.barrierSecondsPerPatience * p.attributes.patience;
  const reaction = pt.reactionBaseSeconds + pt.reactionSpanSeconds * (1 - BM.perception(p.attributes.awareness));
  const card = (id, rows, behaviour, beat) => el('div', { class: 'hiw-subject' }, [
    el('h4', { text: `${ENTITY_DEFS[id].designation} / ${ENTITY_DEFS[id].name}` }),
    table(['', ''], rows, 'kv'),
    prose(behaviour),
    el('div', { class: 'hiw-beat', html: `<b>How to beat it.</b> ${beat}` })
  ]);
  const basics = (id) => {
    const d = ENTITY_DEFS[id];
    const a = d.attributes;
    return [
      ['Opportunity every', `${d.movementInterval} s`],
      ['Home', `${ROOMS[d.homeRoom].name} (${ROOMS[d.homeRoom].camera})`],
      ['Rooms to you', hops(id)],
      ['Aggression / Awareness / Patience / Intelligence', `${a.aggression} / ${a.awareness} / ${a.patience} / ${a.intelligence}`]
    ];
  };
  node.append(
    card(WANDERER, [
      ...basics(WANDERER),
      ['Chance a lit corridor turns it back', pct(BM.lightDeterrence(w.attributes.awareness))],
      ['Blocked attempts before it gives up', `${BM.obstacleTolerance(w.attributes.patience)}, then retreats ${w.retreatSteps} rooms`]
    ], `
      <p>Roams by weighted random choice. Every time a roll succeeds it picks a neighbouring room, leaning toward you because of its aggression. It does not plan a route.</p>
      <p>Light is its weakness. If it chooses to step into a lit corridor, there is a ${pct(BM.lightDeterrence(w.attributes.awareness))} chance it flinches and stays put (<code>0.40 + 0.60 x awareness/20</code>). If it is already in a corridor when you switch the light on, its next successful roll makes it flee back the way it came, with the same probability.</p>
    `, `Watch CAM 08 and CAM 09. When it is in a corridor, light that corridor. If it reaches your door anyway, close the door. Two blocked attempts and it retreats two rooms, then the door can open again.`),
    card(OBSERVER, [
      ...basics(OBSERVER),
      ['Time to notice the camera', sec(detect)],
      ['Agitation gained per second watched', `${n2(gain)} (cap ${ot.agitationCap})`],
      ['Frozen until agitation reaches', `${ot.freezeAgitationLimit} (about ${sec(ot.freezeAgitationLimit / gain)} of watching)`],
      ['Agitation lost per second unwatched', `${ot.agitationDecayPerSecond} (cap to 0 in ${sec(ot.agitationCap / ot.agitationDecayPerSecond)})`],
      ['AI bonus', `+1 per ${ot.agitationPerAIBonus} agitation, up to +${Math.floor(ot.agitationCap / ot.agitationPerAIBonus)}`],
      ['Neglect', `after ${ot.neglectGraceSeconds} s unwatched, +1 aggression per ${ot.neglectSecondsPerAggression} s, up to +${ot.neglectAggressionCap}`]
    ], `
      <p>It knows when it is on camera. After ${sec(detect)} of continuous watching it notices, and from then on it cannot move: its opportunities are <code>SUPPRESSED</code> before the roll.</p>
      <p>The catch is agitation. Every second you stare adds ${n2(gain)}, and every 2.5 points add +1 to its effective AI. At ${ot.freezeAgitationLimit} it stops respecting the camera altogether, and when you finally look away it is both fast and angry. Ignoring it is no better: after ${ot.neglectGraceSeconds} s unwatched its aggression climbs, so its route choices lean harder toward you.</p>
    `, `Short, regular glances. Find it, look for a couple of seconds, switch away. About every 30 seconds is enough to keep neglect at zero while agitation stays near zero. Close the door it arrives at, like the Wanderer.`),
    card(ECHO, [
      ...basics(ECHO),
      ['Hearing range', `${BM.hearingRange(e.attributes.awareness)} rooms`],
      ['Sound kept per room it travels', pct(falloff)],
      ['Enters only if station noise is at least', `${(echoThreshold() * 100).toFixed(0)} dBn`],
      ['Decoy pings, when it sees through them', `count for ${pct(et.decoyDiscountWhenInformed)}`],
      ['Blocked attempts before it gives up', `${BM.obstacleTolerance(e.attributes.patience)}, then retreats ${e.retreatSteps} rooms`]
    ], `
      <p>Follows sound. When choosing a room, each candidate is weighted by how loud it seems from there: every noise source counts for <code>level x ${n2(falloff)}^rooms</code>, out to ${BM.hearingRange(e.attributes.awareness)} rooms away, and the weight is <code>${et.noiseWeightFloor} + ${et.noiseWeightScale} x heard noise</code>. Noise sources are your station, any lit corridor, a diagnostic ping and the decontamination cycle.</p>
      <p>It travels the ventilation, which nothing else can use, and enters through the ceiling duct. Doors do not matter to it. From the duct it can only drop in if the station is at least ${(echoThreshold() * 100).toFixed(0)} dBn loud. If it is quieter, the attempt fails with reason <code>SILENCE</code>.</p>
    `, `When CAM 12 shows it in the shaft, or you hear scraping above, go quiet: fan off, radio off, and do not open or close doors (a moving door is +${(N.doorPulse * 100).toFixed(0)} dBn). Use the noise calculator under POWER &amp; NOISE to see what is safe. A diagnostic ping in a distant room can lure it away.`),
    card(PATIENT, [
      ...basics(PATIENT),
      ['Extra weight on routes away from you', `x${pt.awayPreference}`],
      ['Blocked attempts before it forces a door', BM.obstacleTolerance(p.attributes.patience)],
      ['Field time needed to send it home', sec(barrierSecs)],
      ['Field progress lost per second off', `${pt.barrierExposureDecay} s`],
      ['Hears its door open, reacts after', sec(reaction)],
      ['Resolve', `+1 AI per ${pt.resolveSecondsPerAI} s waiting at a door, up to +${Math.floor(p.attributes.patience / 3)}`]
    ], `
      <p>Slow (one opportunity every ${p.movementInterval} s) and single-minded: routes leading away from you get an extra x${pt.awayPreference} weight. It only becomes active late in a real night.</p>
      <p>A closed door does not stop it, it only delays it. Each blocked attempt adds pressure, and at ${BM.obstacleTolerance(p.attributes.patience)} it forces the door motor, which stays broken until you repair it in the electrical room. The longer it waits, the higher its effective AI climbs. Opening the door while it waits gives it an extra opportunity ${sec(reaction)} later.</p>
      <p>The containment field is tuned to it alone. While the field is on and it is at a door, it cannot enter at all, and after ${sec(barrierSecs)} of exposure it walks all the way home.</p>
    `, `Field on, and keep it on for about ${Math.ceil(barrierSecs)} seconds. Do not toggle it: progress drains while it is off. The field costs ${(D.barrier * 60).toFixed(0)}% power per minute, so one full repel is about ${(D.barrier * barrierSecs).toFixed(0)}%.`)
  );
  return node;
}

function sectionAttributes() {
  const node = el('div');
  node.append(
    prose(`<p>Each subject has four traits on a 0 to 20 scale. None of them change the roll. Each one changes exactly one kind of decision, so they never overlap.</p>`),
    table(['Trait', 'Controls', 'Formula'], [
      ['Aggression', 'Where it wants to go', 'Toward you: weight x (1 + 2a). Away: x (1 - 0.5a), never zero. a = aggression/20'],
      ['Awareness', 'What it can sense', 'The strength of its own stimulus: light (Wanderer), being watched (Observer), noise (Echo), its door opening (Patient)'],
      ['Patience', 'How long obstacles hold it', 'Blocked attempts before it changes behaviour = 1 + floor(patience/4)'],
      ['Intelligence', 'How well it routes', 'Chance of an informed decision = intelligence/20. Informed decisions use the live map, where shut doors and sealed gates are missing.']
    ]),
    h('ROUTE CHOICE PLAYGROUND'),
    prose(`<p>A successful roll at the Central Junction. Three exits: the West and East corridors lead toward you, the Research Hall leads away. Drag aggression to see how the odds change. The right-hand columns show an <b>informed</b> decision with the east door shut: the live map now says the east corridor is a dead end, so it counts as "away".</p>`),
    routePlayground(),
    h('GLOBAL RULES'),
    table(['Rule', 'Effect', 'Why'], [
      ['Settle time', `After arriving at a door or the duct, a subject waits ${THRESHOLD_SETTLE_INTERVALS} of its own intervals before its first entry attempt`, `Its arrival is always audible, so you always get a reaction window: Wanderer at least ${sec(2 * ENTITY_DEFS[WANDERER].movementInterval)}, Echo ${sec(2 * ENTITY_DEFS[ECHO].movementInterval)}, Observer ${sec(2 * ENTITY_DEFS[OBSERVER].movementInterval)}.`],
      ['Retreat urgency', `While retreating, effective AI is at least ${RETREAT_AI_FLOOR}`, 'A turned-back subject actually leaves instead of lingering.'],
      ['Blackout', `During a power failure, active subjects get +${BLACKOUT_AI_BONUS} effective AI`, 'Darkness makes them bolder. Power failure itself never kills you.'],
      ['Dormant', 'AI 0 means effective AI 0, whatever the modifiers', 'A sleeping subject stays asleep.']
    ])
  );
  return node;
}

function routePlayground() {
  const from = 'CENTRAL_JUNCTION';
  const id = WANDERER;
  const exits = graph.edgesFor(from, id).map((e) => e.to);
  const staticDist = graph.distancesTo(STATION, id);
  const live = graph.distancesTo(STATION, id, { isDoorClosed: (d) => d === 'EAST_DOOR', isGateOpen: () => true });
  const out = el('div', { class: 'hiw-results' });
  const odds = (dist, aggression) => {
    const cur = BM.finiteDistance(dist.get(from));
    const weights = exits.map((r) => BM.approachFactor(aggression, BM.finiteDistance(dist.get(r)) - cur));
    const total = weights.reduce((a, b) => a + b, 0);
    return exits.map((r, i) => ({ r, w: weights[i], p: weights[i] / total, delta: BM.finiteDistance(dist.get(r)) - cur }));
  };
  const dir = (d) => (d < 0 ? 'toward you' : d > 0 ? 'away' : 'level');
  const render = (aggression) => {
    const a = odds(staticDist, aggression);
    const b = odds(live, aggression);
    out.replaceChildren(table(['Exit', 'Direction', 'Weight', 'Chance', 'Informed, east door shut', 'Chance'], exits.map((r, i) => [
      ROOMS[r].name, dir(a[i].delta), n2(a[i].w), pct(a[i].p), `${dir(b[i].delta)}, weight ${n2(b[i].w)}`, pct(b[i].p)
    ])));
  };
  const s = slider('Aggression', 0, 20, 1, ENTITY_DEFS[id].attributes.aggression, render);
  s.update();
  return el('div', { class: 'hiw-calc' }, [el('div', { class: 'hiw-controls' }, [s.node]), out]);
}

function sectionPower() {
  const node = el('div');
  const idle = consoleModel({ lights: 'NORMAL', rack: true, viewing: false, fan: true, radio: true, doors: 0, corridorLights: 0, field: false });
  node.append(
    h('POWER'),
    prose(`<p>You start at ${POWER_CONFIG.initial}%. Every powered system drains continuously, in percent per second. Doing nothing at all costs about <b>${(idle.drain * 60).toFixed(1)}% per minute</b>, ${(idle.drain * GAME_CONFIG.nightDurationSeconds).toFixed(0)}% over a whole night. The rest of the battery is your defence budget.</p>`),
    table(['System', '% per second', '% per minute', 'Over a whole night'], [
      ['Facility base load', D.facilityBase, D.facilityBase * 60, D.facilityBase * GAME_CONFIG.nightDurationSeconds],
      ['Station lights (normal / low)', `${D.stationLightsNormal.toFixed(3)} / ${D.stationLightsLow.toFixed(3)}`, `${(D.stationLightsNormal * 60).toFixed(2)} / ${(D.stationLightsLow * 60).toFixed(2)}`, '-'],
      ['Camera rack (on)', D.workstationRack, D.workstationRack * 60, D.workstationRack * GAME_CONFIG.nightDurationSeconds],
      ['Watching a camera (extra)', D.cameraViewing, D.cameraViewing * 60, '-'],
      ['Ventilation fan', D.ventilationFan, D.ventilationFan * 60, D.ventilationFan * GAME_CONFIG.nightDurationSeconds],
      ['Radio', D.radio, D.radio * 60, '-'],
      ['Each closed door', D.doorClosed, D.doorClosed * 60, '-'],
      ['Each lit corridor', D.corridorLight, D.corridorLight * 60, '-'],
      ['Containment field', D.barrier, D.barrier * 60, '-']
    ].map(([name, perSec, perMin, night]) => [
      name,
      typeof perSec === 'number' ? perSec.toFixed(3) : perSec,
      typeof perMin === 'number' ? perMin.toFixed(2) : perMin,
      typeof night === 'number' ? `${night.toFixed(1)}%` : night
    ])),
    prose(`<p>One-off costs: a diagnostic ping is ${POWER_CONFIG.pingCost}% (then ${SURVEILLANCE_CONFIG.pingCooldown} s cooldown), a signal relay reset ${POWER_CONFIG.relayResetCost}%. The auxiliary cell adds ${POWER_CONFIG.auxCellCharge}% once, and can bring the battery back from zero.</p>
      <p>At 0% everything shuts off and emergency lighting comes on. You do not lose. Doors can be held shut by hand with the yellow levers, but you can only hold one, and subjects get +${BLACKOUT_AI_BONUS} AI in the dark.</p>`),
    h('NOISE'),
    prose(`<p>The station has an acoustic level, measured in made-up "dBn" (noise x 100) on the right-hand desk screen. It only matters for the Echo, which can drop through the duct only at <b>${(echoThreshold() * 100).toFixed(0)} dBn or more</b>. A moving door spikes it by ${(N.doorPulse * 100).toFixed(0)} dBn and fades over a few seconds (time constant ${N.doorPulseTau} s).</p>`),
    h('STATION CONSOLE SIMULATOR'),
    consoleSimulator()
  );
  return node;
}

function consoleSimulator() {
  const c = { lights: 'NORMAL', rack: true, viewing: false, fan: true, radio: true, doors: 0, corridorLights: 0, field: false, walking: false, working: false, doorMoving: false };
  const out = el('div', { class: 'hiw-results' });
  const threshold = echoThreshold();
  const render = () => {
    const m = consoleModel(c);
    const loud = m.total >= threshold;
    const bar = el('div', { class: 'hiw-meter' }, [
      el('i', { style: { width: `${Math.min(100, (m.total / 0.9) * 100)}%`, background: loud ? 'var(--red)' : 'var(--green)' } }),
      el('b', { style: { left: `${(threshold / 0.9) * 100}%` } })
    ]);
    const minutes = m.drain > 0 ? 100 / m.drain / 60 : Infinity;
    out.replaceChildren(
      el('div', { class: `hiw-verdict ${loud ? 'bad' : 'good'}`, text: loud ? `${(m.total * 100).toFixed(0)} dBn: the Echo CAN drop in from the duct` : `${(m.total * 100).toFixed(0)} dBn: too quiet for the Echo` }),
      bar,
      table(['Noise source', 'dBn'], Object.entries(m.noise).filter(([, v]) => v > 0).map(([k, v]) => [k, (v * 100).toFixed(0)])),
      table(['Power', ''], [
        ['Drain', `${n2(m.drain)} %/s = ${n2(m.drain * 60)} %/min`],
        ['A full battery lasts', Number.isFinite(minutes) ? `${minutes.toFixed(1)} min (${pct(Math.min(1, (minutes * 60) / GAME_CONFIG.nightDurationSeconds))} of a night)` : '-']
      ], 'kv')
    );
  };
  const set = (k) => (v) => {
    c[k] = v;
    render();
  };
  const controls = el('div', { class: 'hiw-controls grid' }, [
    select('Station lights', [['NORMAL', 'Normal'], ['LOW', 'Low'], ['EMERGENCY', 'Power failure']], c.lights, set('lights')),
    select('Doors shut', [['0', '0'], ['1', '1'], ['2', '2']], '0', (v) => set('doors')(Number(v))),
    select('Corridor lights on', [['0', '0'], ['1', '1'], ['2', '2']], '0', (v) => set('corridorLights')(Number(v))),
    checkbox('Camera rack on', c.rack, set('rack')),
    checkbox('Watching cameras', c.viewing, set('viewing')),
    checkbox('Ventilation fan', c.fan, set('fan')),
    checkbox('Radio', c.radio, set('radio')),
    checkbox('Containment field', c.field, set('field')),
    checkbox('A door is moving', c.doorMoving, set('doorMoving')),
    checkbox('You are walking', c.walking, set('walking')),
    checkbox('You are repairing', c.working, set('working'))
  ]);
  render();
  return el('div', { class: 'hiw-calc' }, [controls, out]);
}

function sectionStrategy() {
  const p = ENTITY_DEFS[PATIENT];
  const barrierSecs = p.tuning.barrierBaseSeconds + p.tuning.barrierSecondsPerPatience * p.attributes.patience;
  const quiet = consoleModel({ lights: 'NORMAL', rack: true, viewing: true, fan: false, radio: false, doors: 0, corridorLights: 0, field: false });
  const node = el('div');
  node.append(prose(`
    <ol class="hiw-list">
      <li><b>Watch the last two rooms, not the whole map.</b> Everything that can hurt you passes through a corridor (CAM 08, 09) and a door camera (CAM 10, 11), or the vent shaft (CAM 12). Cycle those, and glance at the rest now and then.</li>
      <li><b>Arrivals are never instant.</b> The settle rule gives you at least ${sec(2 * ENTITY_DEFS[WANDERER].movementInterval)} after the Wanderer reaches a door, and every arrival makes a sound with a subtitle. If you hear footsteps "close", go to that door.</li>
      <li><b>Light first, door second.</b> A lit corridor turns the Wanderer back ${pct(BM.lightDeterrence(ENTITY_DEFS[WANDERER].attributes.awareness))} of the time for ${(D.corridorLight * 60).toFixed(1)}%/min. A door is certain but costs ${(D.doorClosed * 60).toFixed(1)}%/min, twice as much.</li>
      <li><b>Open doors again.</b> A door left shut for the whole night would cost ${(D.doorClosed * GAME_CONFIG.nightDurationSeconds).toFixed(0)}%. Once the window or CAM 10/11 shows the approach empty, open it.</li>
      <li><b>Observer: a two-second look every half minute.</b> That keeps neglect at zero and agitation near zero. Never stare for ${(ENTITY_DEFS[OBSERVER].tuning.freezeAgitationLimit / (ENTITY_DEFS[OBSERVER].tuning.agitationGainPerSecond * (0.25 + 0.75 * BM.perception(ENTITY_DEFS[OBSERVER].attributes.awareness)))).toFixed(0)} seconds or more.</li>
      <li><b>Echo: silence beats everything.</b> Fan off and radio off while you keep watching the cameras is ${(quiet.total * 100).toFixed(0)} dBn, safely under ${(echoThreshold() * 100).toFixed(0)}. Then do not move doors. Turn the fan back on once it leaves, or the rack overheats (about ${(1 / SURVEILLANCE_CONFIG.thermalRiseViewing).toFixed(0)} s of watching with the fan off).</li>
      <li><b>Patient: commit to the field.</b> About ${Math.ceil(barrierSecs)} uninterrupted seconds sends it all the way home, for roughly ${(D.barrier * barrierSecs).toFixed(0)}% power. Toggling wastes power, because progress drains while the field is off.</li>
      <li><b>The nasty combo: Patient at a door while the Echo is in the duct.</b> The field adds ${(N.barrier * 100).toFixed(0)} dBn, which lets the Echo in. Shut the Patient's door instead: it needs ${BM.obstacleTolerance(p.attributes.patience)} successful attempts to force it. Once the Echo leaves, switch to the field.</li>
      <li><b>Lure with pings.</b> A ping in a far room (the Research Hall, say) costs ${POWER_CONFIG.pingCost}% and pulls the Echo toward it. Informed decisions (${pct(BM.informedChance(ENTITY_DEFS[ECHO].attributes.intelligence))} of them) see through it.</li>
      <li><b>Save the auxiliary cell.</b> It works even at 0%, so keeping it for a late power failure buys you the last stretch.</li>
    </ol>
    <p>With these habits, a scripted player that sees everything survives Night 1 ${NIGHT_MEASURED_SURVIVAL[1].expert}% of the time and Night 5 ${NIGHT_MEASURED_SURVIVAL[5].expert}%. A player that does nothing survives none.</p>
    <p><b>Why higher levels get hard.</b> No subject is hard on its own: a scripted player beats any single one at AI 20. Difficulty comes from two shared limits. Power is one: every defence draws from one battery, so the more often subjects come, the sooner it runs out. The Echo is the other: the more the others force you to move doors or use the field, the more noise you make while it listens.</p>
  `));
  return node;
}

function sectionHood() {
  const node = el('div');
  node.append(prose(`
    <p><b>Fixed timestep.</b> The simulation advances in steps of exactly ${(FIXED_TIMESTEP * 1000).toFixed(2)} ms, independent of your frame rate. Simulation time is <code>step count x step length</code>, so it never drifts. Each frame adds the real elapsed time to an accumulator and runs as many whole steps as fit, up to ${CLOCK_CONFIG.maxStepsPerFrame} per frame with a ${CLOCK_CONFIG.maxBacklogSeconds} s backlog cap. Opportunities are scheduled in simulation time, so a stutter never skips one. Tests check that 30 fps, 144 fps and random jitter give identical results.</p>
    <p><b>Random numbers.</b> A seeded sfc32 generator. Each subject has its own stream, and so do background events, so one subject's dice never affect another's. The d20 uses rejection sampling, so all 20 faces are exactly equally likely. Add <code>?seed=anything</code> to the address to replay the same dice.</p>
    <p><b>Determinism.</b> Every action you take is recorded with the step it happened on. Same seed plus same actions gives the same night, and the tests replay recorded nights to prove it. When two subjects get an opportunity in the same step, they resolve in a fixed order.</p>
    <p><b>The ten steps of an opportunity:</b> is it active, is it allowed to move, roll, compare, succeed or fail, choose a destination, check restrictions, move, make sounds and camera static, write the log. The outcome is always one of: ROLL_FAILED, MOVED, RETREATED, STAYED, BLOCKED, INVALID_DESTINATION, SUPPRESSED, STATE_TRANSITION, ATTACK_BLOCKED or ATTACK_SUCCESS.</p>
    <p><b>The map is a graph.</b> ${Object.keys(ROOMS).length} rooms connected by edges that can be one-way, restricted to one subject (the vents), blocked by your doors, or sealed by gates. A subject can only ever move along an edge it is allowed to use. Nothing teleports. The only exception is practice mode, which sends a subject home after a breach, and logs it.</p>
    <p><b>Cameras are real.</b> Each feed is a live render of that room, with the subject models placed where the simulation says they are.</p>
    <p><b>See it yourself.</b> Open the game with <code>?debug=1</code> and press F3 during a night. The AI debugger shows every subject's AI, next opportunity, last roll and modifiers, plus the live event log, with buttons for 1x, 4x and 16x speed.</p>
  `));
  return node;
}

// ------------------------------------------------------------------ screen

const TABS = [
  ['roll', 'THE ROLL', sectionRoll],
  ['night', 'THE NIGHT', sectionNight],
  ['subjects', 'THE SUBJECTS', sectionSubjects],
  ['attributes', 'TRAITS & RULES', sectionAttributes],
  ['power', 'POWER & NOISE', sectionPower],
  ['strategy', 'HOW TO WIN', sectionStrategy],
  ['hood', 'UNDER THE HOOD', sectionHood]
];

export class HowItWorks {
  constructor(root, { onBack }) {
    this.tabs = {};
    this.panels = {};
    const bar = el('div', { class: 'hiw-tabs' });
    const body = el('div', { class: 'hiw-body' });
    for (const [id, label, build] of TABS) {
      this.tabs[id] = el('button', { class: 'ws-tab', text: label, onclick: () => this.select(id) });
      bar.append(this.tabs[id]);
      this.panels[id] = { build, node: null };
    }
    this.body = body;
    this.node = el('div', { class: 'screen interactive hidden' }, [
      el('div', { class: 'menu-card hiw-card' }, [
        el('h1', { class: 'title', style: { fontSize: '26px' }, text: 'HOW IT WORKS' }),
        el('div', { class: 'subtitle', text: 'THE SCIENCE BEHIND THE NIGHT  /  EVERY NUMBER HERE COMES FROM THE GAME ITSELF' }),
        bar,
        body,
        el('div', { class: 'row-buttons' }, [el('button', { class: 'small-btn', text: 'BACK', onclick: onBack })])
      ])
    ]);
    root.append(this.node);
    this.select('roll');
  }

  select(id) {
    for (const [k, b] of Object.entries(this.tabs)) b.classList.toggle('active', k === id);
    const panel = this.panels[id];
    panel.node ??= panel.build(); // built on first open
    this.body.replaceChildren(panel.node);
    this.body.scrollTop = 0;
  }

  show(visible) {
    showScreen(this.node, visible);
  }
}
