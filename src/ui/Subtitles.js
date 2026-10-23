import { el } from './dom.js';

/** Textual sound cues. Duplicates within a short window are merged. */
export class Subtitles {
  constructor(root, settings) {
    this.settings = settings;
    this.node = el('div', { id: 'subtitles' });
    root.append(this.node);
    this.lines = [];
    this.recent = new Map();
  }

  show(text, category = 'entity', duration = 4.5) {
    if (!this.settings.get('subtitles')) return;
    const now = performance.now() / 1000;
    if ((this.recent.get(text) ?? -99) > now - 6) return;
    this.recent.set(text, now);
    const node = el('div', { class: `subtitle-line ${category}`, text });
    this.node.append(node);
    this.lines.push({ node, until: now + duration });
    while (this.lines.length > 3) this.lines.shift().node.remove();
  }

  update() {
    const now = performance.now() / 1000;
    for (let i = this.lines.length - 1; i >= 0; i--) {
      const l = this.lines[i];
      if (now > l.until) {
        l.node.style.opacity = '0';
        if (now > l.until + 0.9) {
          l.node.remove();
          this.lines.splice(i, 1);
        }
      }
    }
  }

  clear() {
    for (const l of this.lines) l.node.remove();
    this.lines = [];
    this.recent.clear();
  }
}

/** One-time contextual hints. */
export class HintsUI {
  constructor(root, settings) {
    this.settings = settings;
    this.node = el('div', { id: 'hints' });
    root.append(this.node);
    this.shown = new Set();
    this.items = [];
  }

  reset() {
    this.shown.clear();
    for (const i of this.items) i.node.remove();
    this.items = [];
  }

  check(hints, sim) {
    if (!this.settings.get('hints')) return;
    for (const h of hints) {
      if (this.shown.has(h.id)) continue;
      let ok = false;
      try {
        ok = h.when(sim);
      } catch {
        ok = false;
      }
      if (!ok) continue;
      this.shown.add(h.id);
      this.push(h.text(sim));
      break; // one at a time
    }
  }

  push(text, label = 'NOTE') {
    const node = el('div', { class: 'hint' }, [el('span', { class: 'label', text: label }), text]);
    this.node.append(node);
    this.items.push({ node, until: performance.now() / 1000 + 11 });
    while (this.items.length > 2) this.items.shift().node.remove();
  }

  update() {
    const now = performance.now() / 1000;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      if (now > it.until) {
        it.node.style.opacity = '0';
        if (now > it.until + 0.9) {
          it.node.remove();
          this.items.splice(i, 1);
        }
      }
    }
  }
}
