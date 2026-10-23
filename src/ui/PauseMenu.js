import { el, showScreen } from './dom.js';

/** Esc menu. While visible, the simulation is paused. */
export class PauseMenu {
  constructor(root, { onResume, onSettings, onControls, onRestart, onExit }) {
    this.node = el('div', { class: 'screen interactive hidden' }, [
      el('div', { class: 'menu-card' }, [
        el('h1', { class: 'title', style: { fontSize: '28px' }, text: 'PAUSED' }),
        el('div', { class: 'subtitle', text: 'THE FACILITY WAITS' }),
        el('div', { class: 'menu-list' }, [
          el('button', { class: 'menu-btn primary', text: 'RESUME', onclick: onResume }),
          el('button', { class: 'menu-btn', text: 'SETTINGS', onclick: onSettings }),
          el('button', { class: 'menu-btn', text: 'CONTROLS', onclick: onControls }),
          el('button', { class: 'menu-btn', text: 'RESTART NIGHT', onclick: onRestart }),
          el('button', { class: 'menu-btn', text: 'EXIT TO MENU', onclick: onExit })
        ])
      ])
    ]);
    root.append(this.node);
  }

  show(visible) {
    showScreen(this.node, visible);
  }
}
