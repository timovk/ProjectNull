import { el, showScreen } from './dom.js';
import { SETTING_LIMITS } from './Settings.js';

const SECTIONS = [
  ['CONTROLS', [
    ['mouseSensitivity', 'Mouse sensitivity', 'range', (v) => v.toFixed(2)],
    ['invertY', 'Invert vertical look', 'check'],
    ['fov', 'Field of view', 'range', (v) => `${v}`]
  ]],
  ['AUDIO', [
    ['masterVolume', 'Master volume', 'range', pct],
    ['ambientVolume', 'Ambient', 'range', pct],
    ['entityVolume', 'Entity sounds', 'range', pct],
    ['interfaceVolume', 'Interface', 'range', pct],
    ['voiceVolume', 'Voices', 'range', pct],
    ['synthVoices', 'Browser voices (used for lines without a recording)', 'check']
  ]],
  ['DISPLAY & COMFORT', [
    ['noStartle', 'No-startle mode (softer sounds, no sudden light or camera changes)', 'check'],
    ['brightness', 'Brightness', 'range', (v) => v.toFixed(2)],
    ['reducedDistortion', 'Reduced visual distortion', 'check'],
    ['reducedMotion', 'Reduced camera motion', 'check'],
    ['disableFlicker', 'Disable flickering lights', 'check'],
    ['subtitles', 'Subtitles / sound cues', 'check'],
    ['hints', 'Contextual hints', 'check'],
    ['radioBriefing', 'Radio briefing at the start of Night 1', 'check']
  ]],
  ['GRAPHICS', [
    ['resolutionScale', 'Resolution scale', 'range', pct],
    ['shadows', 'Shadows', 'check'],
    ['postProcessing', 'Post-processing', 'check'],
    ['lightingQuality', 'Lighting quality', 'select', null, [['high', 'High'], ['low', 'Low']]],
    ['renderDistance', 'Render distance', 'range', (v) => `${v} m`],
    ['showFps', 'Show frame rate', 'check']
  ]]
];

function pct(v) {
  return `${Math.round(v * 100)}%`;
}

export class SettingsMenu {
  constructor(root, settings, { onBack }) {
    this.settings = settings;
    this.onBack = onBack;
    this.inputs = new Map();
    const card = el('div', { class: 'menu-card wide' }, [el('h1', { class: 'title', style: { fontSize: '26px' }, text: 'SETTINGS' })]);
    for (const [title, rows] of SECTIONS) {
      card.append(el('h2', { class: 'section-title', text: title }));
      for (const [key, label, type, fmt, options] of rows) card.append(this.row(key, label, type, fmt, options));
    }
    card.append(
      el('div', { class: 'row-buttons' }, [
        el('button', { class: 'small-btn', text: 'BACK', onclick: () => this.onBack() }),
        el('button', { class: 'small-btn', text: 'RESET TO DEFAULTS', onclick: () => { settings.reset(); this.refresh(); } })
      ])
    );
    this.node = el('div', { class: 'screen interactive hidden' }, [card]);
    root.append(this.node);
  }

  row(key, label, type, fmt, options) {
    const s = this.settings;
    const id = `set-${key}`;
    let input;
    const value = el('span', { class: 'value' });
    if (type === 'range') {
      const [min, max, step] = SETTING_LIMITS[key];
      input = el('input', { type: 'range', id, min, max, step });
      input.addEventListener('input', () => {
        s.set(key, Number(input.value));
        value.textContent = fmt(s.get(key));
      });
    } else if (type === 'check') {
      input = el('input', { type: 'checkbox', id });
      input.addEventListener('change', () => s.set(key, input.checked));
    } else {
      input = el('select', { id }, options.map(([v, t]) => el('option', { value: v, text: t })));
      input.addEventListener('change', () => s.set(key, input.value));
    }
    this.inputs.set(key, { input, value, type, fmt });
    return el('div', { class: 'setting-row' }, [el('label', { for: id, text: label }), el('div', {}, [input]), value]);
  }

  refresh() {
    for (const [key, { input, value, type, fmt }] of this.inputs) {
      const v = this.settings.get(key);
      if (type === 'range') {
        input.value = v;
        value.textContent = fmt(v);
      } else if (type === 'check') input.checked = !!v;
      else input.value = v;
    }
  }

  show(visible) {
    if (visible) this.refresh();
    showScreen(this.node, visible);
  }
}
