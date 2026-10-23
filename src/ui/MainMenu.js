import { el, showScreen } from './dom.js';

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
  constructor(root, { onBegin, onStart, onSettings }) {
    this.onBegin = onBegin;
    this.onStart = onStart;
    this.onSettings = onSettings;

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
        el('div', { class: 'menu-list' }, [el('button', { class: 'menu-btn primary', text: 'INITIALIZE TERMINAL', onclick: () => this.onBegin() })])
      ])
    ]);

    this.main = el('div', { class: 'screen interactive hidden' }, [
      el('div', { class: 'menu-card' }, [
        el('h1', { class: 'title', text: 'PROJECT NULL' }),
        el('div', { class: 'subtitle', text: 'NIGHT 1  /  THE FIRST NIGHT' }),
        el('div', { class: 'menu-list' }, [
          el('button', { class: 'menu-btn primary', text: 'START NIGHT 1', onclick: () => this.onStart() }),
          el('button', { class: 'menu-btn', text: 'SETTINGS', onclick: () => this.onSettings() }),
          el('button', { class: 'menu-btn', text: 'CONTROLS', onclick: () => this.show('controls') }),
          el('button', { class: 'menu-btn', text: 'CREDITS', onclick: () => this.show('credits') })
        ]),
        el('div', { class: 'menu-footer', text: 'v0.1.0  /  HELIX RESEARCH DIRECTORATE  /  CONTRACT 4471' })
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
    this.backTarget = 'main';
  }

  show(which, backTarget = 'main') {
    this.backTarget = backTarget;
    for (const [k, n] of Object.entries({ splash: this.splash, main: this.main, controls: this.controls, credits: this.credits })) {
      showScreen(n, k === which);
    }
  }

  back() {
    if (this.backTarget === 'pause') {
      this.hideAll();
      this.onBackToPause?.();
    } else this.show('main');
  }

  hideAll() {
    for (const n of [this.splash, this.main, this.controls, this.credits]) showScreen(n, false);
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
<p><strong>PROJECT NULL</strong> v0.1.0 "The First Night"</p>
<p>Design, programming, procedural art and procedural audio built for this vertical slice with Three.js and the Web Audio API.</p>
<p>No external art or audio assets are used. Every texture, model and sound is generated at runtime.</p>
<p>Built with <strong>Three.js</strong> (MIT) and <strong>Vite</strong> (MIT).</p>
<p>Research Facility N-17 and the Helix Research Directorate are fictional.</p>`;
