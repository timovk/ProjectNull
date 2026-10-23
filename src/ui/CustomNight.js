import { el, showScreen } from './dom.js';
import { ENTITY_DEFS, ENTITY_ORDER, GAME_CONFIG } from '../config/GameConfig.js';
import { Simulation } from '../core/Simulation.js';
import { competentPolicy, runNightSync } from '../ai/ScriptedPlayers.js';

const STORAGE_KEY = 'project-null.custom.v1';
const ESTIMATE_NIGHTS = 24;

/**
 * Presets, named after measured skilled-player survival (40 simulated nights
 * each): Night 1 average ~95%, Gentle ~88%, Hard ~45%, Nightmare ~20%,
 * No Patient 10s ~80%, 20/20/20/20 0%. A Patient awake all night (field
 * power) is what makes high levels unwinnable.
 */
export const CUSTOM_PRESETS = [
  ['Night 1 average', [5, 4, 3, 1]],
  ['Gentle', [3, 3, 3, 3]],
  ['Hard', [5, 5, 5, 5]],
  ['Nightmare', [7, 7, 7, 7]],
  ['10s, no Patient', [10, 10, 10, 0]],
  ['20/20/20/20', [20, 20, 20, 20]]
];

/** Fixed levels for the whole night, in ENTITY_ORDER (Wanderer, Observer, Echo, Patient). */
export function customSchedule(levels) {
  const schedule = {};
  ENTITY_ORDER.forEach((id, i) => {
    schedule[id] = [Math.max(0, Math.min(20, Math.round(levels[i] ?? 0)))];
  });
  return schedule;
}

export function customLabel(levels) {
  return `CUSTOM ${levels.join('/')}`;
}

export function difficultyLabel(rate) {
  if (rate >= 0.9) return 'COMFORTABLE';
  if (rate >= 0.6) return 'TENSE';
  if (rate >= 0.3) return 'HARD';
  if (rate >= 0.05) return 'BRUTAL';
  return 'IMPOSSIBLE';
}

/**
 * Survival estimate: plays `nights` headless nights with the scripted expert
 * (the one that wins about 9 in 10 normal nights). One night per tick so the
 * menu stays responsive; `isCancelled()` stops an outdated run.
 */
export async function estimateSurvival(levels, { nights = ESTIMATE_NIGHTS, onProgress, isCancelled = () => false } = {}) {
  const schedule = customSchedule(levels);
  let survived = 0;
  const deaths = [];
  for (let i = 0; i < nights; i++) {
    if (isCancelled()) return null;
    const s = runNightSync(Simulation, `custom-est-${levels.join('-')}-${i}`, () => competentPolicy(), { schedule });
    if (s.outcome === 'SURVIVED') survived++;
    else deaths.push(s.timeSurvived);
    onProgress?.(i + 1, nights);
    await new Promise((r) => setTimeout(r, 0));
  }
  deaths.sort((a, b) => a - b);
  return { survived, nights, rate: survived / nights, medianDeath: deaths.length ? deaths[Math.floor(deaths.length / 2)] : null };
}

function loadLevels() {
  try {
    const v = JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY) ?? 'null');
    if (Array.isArray(v) && v.length === 4 && v.every((n) => Number.isInteger(n) && n >= 0 && n <= 20)) return v;
  } catch {
    /* storage unavailable */
  }
  return [5, 4, 3, 1];
}

function saveLevels(levels) {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(levels));
  } catch {
    /* storage unavailable */
  }
}

/** Custom Night setup screen: one AI slider per subject, presets, live estimate. */
export class CustomNight {
  constructor(root, { onBack, onStart }) {
    this.levels = loadLevels();
    this.runId = 0;
    this.sliders = [];
    const rows = el('div', { class: 'custom-rows' });
    ENTITY_ORDER.forEach((id, i) => {
      const def = ENTITY_DEFS[id];
      const value = el('span', { class: 'custom-value' });
      const odds = el('small', { class: 'custom-odds' });
      const input = el('input', { type: 'range', min: 0, max: 20, step: 1, value: this.levels[i] });
      const sync = () => {
        const v = Number(input.value);
        value.textContent = String(v);
        odds.textContent = v === 0 ? 'asleep all night' : `${(v * 5).toFixed(0)}% per roll, a roll every ${def.movementInterval} s`;
      };
      input.addEventListener('input', () => {
        this.levels[i] = Number(input.value);
        sync();
        this.changed();
      });
      sync();
      this.sliders.push({ input, sync });
      rows.append(el('label', { class: 'custom-row' }, [
        el('span', { class: 'custom-name' }, [el('b', { text: def.designation }), ` ${def.name.replace('THE ', '')}`]),
        input,
        value,
        odds
      ]));
    });
    const presets = el('div', { class: 'custom-presets' }, CUSTOM_PRESETS.map(([name, lv]) =>
      el('button', { class: 'small-btn', text: name, onclick: () => this.setLevels(lv) })));
    this.estimate = el('div', { class: 'custom-estimate' });
    this.node = el('div', { class: 'screen interactive hidden' }, [
      el('div', { class: 'menu-card wide' }, [
        el('h1', { class: 'title', style: { fontSize: '26px' }, text: 'CUSTOM NIGHT' }),
        el('div', { class: 'subtitle', text: 'SET EACH SUBJECT\'S AI LEVEL. IT STAYS FIXED FROM 12 AM TO 6 AM.' }),
        rows,
        presets,
        this.estimate,
        el('div', { class: 'row-buttons' }, [
          el('button', { class: 'small-btn custom-start', text: 'START CUSTOM NIGHT', onclick: () => onStart([...this.levels]) }),
          el('button', { class: 'small-btn', text: 'BACK', onclick: onBack })
        ])
      ])
    ]);
    root.append(this.node);
  }

  setLevels(levels) {
    this.levels = [...levels];
    this.sliders.forEach((s, i) => {
      s.input.value = this.levels[i];
      s.sync();
    });
    this.changed();
  }

  changed() {
    saveLevels(this.levels);
    clearTimeout(this.debounce);
    this.estimate.textContent = 'Estimating...';
    this.debounce = setTimeout(() => this.runEstimate(), 450);
  }

  async runEstimate() {
    const id = ++this.runId;
    const levels = [...this.levels];
    const result = await estimateSurvival(levels, {
      isCancelled: () => id !== this.runId,
      onProgress: (n, total) => {
        if (id === this.runId) this.estimate.textContent = `Simulating nights with a skilled scripted player... ${n}/${total}`;
      }
    });
    if (!result || id !== this.runId) return;
    const label = difficultyLabel(result.rate);
    const death = result.medianDeath !== null ? ` When it loses, it typically lasts ${(result.medianDeath / (GAME_CONFIG.nightDurationSeconds / (GAME_CONFIG.endHour - GAME_CONFIG.startHour))).toFixed(1)} in-game hours.` : '';
    this.estimate.replaceChildren(
      el('div', { class: `custom-verdict ${label.toLowerCase()}`, text: `${label}: survived ${result.survived} of ${result.nights} simulated nights (${Math.round(result.rate * 100)}%)` }),
      el('small', { text: `The scripted player sees every subject at once and reacts in 1.5 s, so a human will usually do worse.${death}` })
    );
  }

  show(visible) {
    showScreen(this.node, visible);
    if (visible) this.changed();
    else this.runId++; // stop any estimate in progress
  }
}
