import { el, showScreen } from './dom.js';
import { HowItWorks } from './HowItWorks.js';
import { CustomNight } from './CustomNight.js';
import { NIGHT_COUNT } from '../config/GameConfig.js';
import { DEVIATION_MENU_LINE } from '../content/Endings.js';
import { version } from '../../package.json';

export const CONTROLS = [
  ['Move', ['W', 'A', 'S', 'D']],
  ['Look', ['Mouse']],
  ['Walk slowly (quieter)', ['Shift']],
  ['Interact / use', ['E']],
  ['Hold to repair / brace', ['Hold E']],
  ['Leave workstation / document', ['E', 'Esc']],
  ['Switch camera', ['1-9', '0', '-', '=']],
  ['Previous / next camera', ['[', ']']],
  ['Workstation tabs', ['Tab']],
  ['Pause', ['Esc']],
  ['AI debugger (dev builds, or ?debug=1)', ['F3']],
  ['Debug time scale', ['F4']]
];

/**
 * Splash (audio-unlock gesture + content advisory), main menu, controls and
 * credits screens.
 */
export class MainMenu {
  constructor(root, { onBegin, onStart, onPractice, onCustom, onSettings, settings, progress }) {
    this.onBegin = onBegin;
    this.progress = progress;
    this.onCustom = onCustom;
    this.onStart = onStart;
    this.onPractice = onPractice;
    this.onSettings = onSettings;
    this.settings = settings;
    const noStartle = el('input', { type: 'checkbox' });
    noStartle.checked = !!settings?.get('noStartle');
    noStartle.addEventListener('change', () => settings?.set('noStartle', noStartle.checked));
    settings?.onChange((k) => {
      if (k === 'noStartle' || k === '*') noStartle.checked = !!settings.get('noStartle');
    });

    this.splash = el('div', { class: 'screen opaque interactive hidden' }, [
      el('div', { class: 'menu-card' }, [
        el('h1', { class: 'title', text: 'PROJECT NULL' }),
        el('div', { class: 'subtitle', text: 'RESEARCH FACILITY N-17' }),
        el('div', { class: 'advisory' }, [
          'A slow psychological horror experience. ',
          el('br'),
          'It contains no jumpscares, no sudden loud sounds and no flashing imagery. Headphones recommended.',
          el('br'),
          el('br'),
          'Comfort and accessibility options are in Settings.'
        ]),
        el('label', { class: 'splash-option' }, [
          noStartle,
          el('span', {}, ['No-startle mode', el('small', { text: 'Softer sound onsets, no sudden light or camera changes, no surprise noises. You can change this later in Settings.' })])
        ]),
        el('div', { class: 'menu-list' }, [el('button', { class: 'menu-btn primary', text: 'INITIALIZE TERMINAL', onclick: () => this.onBegin() })])
      ])
    ]);

    this.main = el('div', { class: 'screen interactive hidden' }, [
      el('div', { class: 'menu-card' }, [
        el('h1', { class: 'title', text: 'PROJECT NULL' }),
        el('div', { class: 'subtitle', text: 'FIVE NIGHTS  /  RESEARCH FACILITY N-17' }),
        (this.rLine = el('div', { class: 'menu-r-line hidden', text: DEVIATION_MENU_LINE })),
        el('div', { class: 'menu-list' }, [
          el('button', { class: 'menu-btn primary', onclick: () => this.onPractice() }, ['PRACTICE NIGHT', el('small', { text: 'Guided. Cannot be lost. Recommended for your first time.' })]),
          (this.continueBtn = el('button', { class: 'menu-btn', onclick: () => this.onStart(this.progress?.current ?? 1) })),
          (this.nightRow = el('div', { class: 'night-select' })),
          el('button', { class: 'menu-btn', onclick: () => this.show('custom') }, ['CUSTOM NIGHT', el('small', { text: 'Set every subject\'s AI level from 0 to 20.' })]),
          el('button', { class: 'menu-btn', text: 'SETTINGS', onclick: () => this.onSettings() }),
          el('button', { class: 'menu-btn', text: 'CONTROLS', onclick: () => this.show('controls') }),
          el('button', { class: 'menu-btn', onclick: () => this.show('howItWorks') }, ['HOW IT WORKS', el('small', { text: 'The maths and behaviour behind the AI, with live calculators.' })]),
          el('button', { class: 'menu-btn', text: 'CREDITS', onclick: () => this.show('credits') })
        ]),
        (this.footer = el('div', { class: 'menu-footer', text: `v${version}  /  HELIX RESEARCH DIRECTORATE  /  CONTRACT 4471` }))
      ])
    ]);

    this.controls = el('div', { class: 'screen interactive hidden' }, [
      el('div', { class: 'menu-card wide' }, [
        el('h2', { class: 'section-title', text: 'CONTROLS' }),
        controlsGrid(),
        el('h2', { class: 'section-title', text: 'HOW THE NIGHT WORKS' }),
        el('div', { class: 'prose', html: HOW_TO }),
        el('div', { class: 'row-buttons' }, [el('button', { class: 'small-btn', text: 'BACK', onclick: () => this.back() })])
      ])
    ]);

    this.credits = el('div', { class: 'screen interactive hidden' }, [
      el('div', { class: 'menu-card' }, [
        el('h2', { class: 'section-title', text: 'CREDITS' }),
        el('div', { class: 'prose', html: CREDITS }),
        el('div', { class: 'row-buttons' }, [el('button', { class: 'small-btn', text: 'BACK', onclick: () => this.back() })])
      ])
    ]);

    for (const n of [this.splash, this.main, this.controls, this.credits]) root.append(n);
    this.howItWorks = new HowItWorks(root, { onBack: () => this.back() });
    this.customNight = new CustomNight(root, { onBack: () => this.back(), onStart: (levels) => this.onCustom?.(levels) });
    this.backTarget = 'main';
  }

  get screens() {
    return { splash: this.splash, main: this.main, controls: this.controls, credits: this.credits, howItWorks: this.howItWorks.node, custom: this.customNight.node };
  }

  /** Continue button and the night-select row, from saved progress. */
  refreshNights() {
    const p = this.progress;
    if (!p) return;
    // After the deviation ending, R. is waiting below, and the contract is not over.
    const deviated = p.hasEnding?.('deviation') ?? false;
    this.rLine.classList.toggle('hidden', !deviated);
    this.footer.textContent = `v${version}  /  HELIX RESEARCH DIRECTORATE  /  CONTRACT 4471${deviated ? '  /  SERIES RESTARTED' : ''}`;
    const done = [...Array(NIGHT_COUNT)].filter((_, i) => p.isCompleted(i + 1)).length;
    const n = p.current;
    this.continueBtn.replaceChildren(
      done === 0 ? 'START NIGHT 1' : p.allComplete ? `REPLAY NIGHT ${n}` : `CONTINUE: NIGHT ${n}`,
      el('small', { text: `${done} of ${NIGHT_COUNT} nights survived` })
    );
    this.nightRow.replaceChildren(
      ...[...Array(NIGHT_COUNT)].map((_, i) => {
        const night = i + 1;
        const unlocked = p.isUnlocked(night);
        return el('button', {
          class: `night-btn ${p.isCompleted(night) ? 'done' : ''}`,
          disabled: !unlocked,
          title: unlocked ? `Play Night ${night}` : 'Survive the previous night to unlock',
          onclick: () => this.onStart(night)
        }, [el('b', { text: String(night) }), el('small', { text: p.isCompleted(night) ? 'SURVIVED' : unlocked ? 'OPEN' : 'LOCKED' })]);
      })
    );
  }

  show(which, backTarget = 'main') {
    this.backTarget = backTarget;
    if (which === 'main') this.refreshNights();
    for (const [k, n] of Object.entries(this.screens)) {
      if (k === 'custom') this.customNight.show(k === which); // starts or stops its estimate
      else showScreen(n, k === which);
    }
  }

  back() {
    if (this.backTarget === 'pause') {
      this.hideAll();
      this.onBackToPause?.();
    } else this.show('main');
  }

  hideAll() {
    for (const [k, n] of Object.entries(this.screens)) {
      if (k === 'custom') this.customNight.show(false);
      else showScreen(n, false);
    }
  }
}

export function controlsGrid() {
  const grid = el('div', { class: 'keys' });
  for (const [label, keys] of CONTROLS) {
    grid.append(el('div', {}, keys.map((k) => el('kbd', { text: k }))), el('div', { text: label }));
  }
  return grid;
}

const HOW_TO = `
<p>You are a contract technician in the Security Station of Research Facility N-17, from <strong>12 AM to 6 AM</strong>. Survive until the diagnostic cycle completes.</p>
<p>Four subjects move through the facility. Each one gets a <strong>movement opportunity</strong> on its own timer and rolls against its AI level: the higher the level, the more often it moves. Levels rise through the night.</p>
<p><strong>Cameras</strong> at the desk show where they are. <strong>Doors</strong> and <strong>corridor lights</strong> are operated from the panels beside each door. Every system draws from a limited <strong>power</strong> supply.</p>
<p>Each subject behaves differently and is countered differently. The documents in the station and the maintenance area explain what the previous technician learned.</p>`;

const CREDITS = `
<p><strong>PROJECT NULL</strong> v${version} "Five Nights"</p>
<p>Design, programming, procedural art and procedural audio built for this vertical slice with Three.js and the Web Audio API.</p>
<p>No external art or audio assets are used. Every texture, model and sound is generated at runtime.</p>
<p>Built with <strong>Three.js</strong> (MIT) and <strong>Vite</strong> (MIT).</p>
<p>Research Facility N-17 and the Helix Research Directorate are fictional.</p>`;
