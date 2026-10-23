import { el } from './dom.js';
import { RADIO_BRIEFING } from '../content/RadioBriefing.js';

const SHOW_SECONDS = 9;
const TYPE_SECONDS = 1.4;

/**
 * Radio messages panel. Messages are scheduled in simulation time, so they
 * follow pauses and debug time scales. Each one is also written to the
 * facility terminal log so it can be re-read at the workstation.
 */
export class RadioBriefing {
  constructor(root, { onMessage }) {
    this.onMessage = onMessage;
    this.text = el('div');
    this.node = el('div', { id: 'radio', class: 'hidden' }, [el('span', { class: 'label', text: 'RADIO  /  R.' }), this.text]);
    root.append(this.node);
    this.reset();
  }

  reset() {
    this.index = 0;
    this.queue = [];
    this.current = null;
    this.enabled = false;
    this.node.classList.add('hidden');
  }

  start(enabled) {
    this.reset();
    this.enabled = enabled;
  }

  stop() {
    this.enabled = false;
    this.current = null;
    this.queue = [];
    this.node.classList.add('hidden');
  }

  update(sim) {
    if (!this.enabled) return;
    while (this.index < RADIO_BRIEFING.length && sim.time >= RADIO_BRIEFING[this.index].at) {
      this.queue.push(RADIO_BRIEFING[this.index]);
      this.index++;
    }
    const now = performance.now() / 1000;
    if (this.current && now > this.current.until) {
      // Fade out (CSS opacity transition), then leave a short gap.
      this.current = null;
      this.node.classList.add('fading');
      this.gapUntil = now + 1.0;
    }
    if (!this.current && this.queue.length && now >= (this.gapUntil ?? 0)) {
      const msg = this.queue.shift();
      this.current = { msg, start: now, until: now + SHOW_SECONDS };
      this.text.textContent = '';
      this.node.classList.remove('hidden', 'fading');
      this.onMessage?.(msg.text);
    }
    if (this.current) {
      const k = Math.min(1, (now - this.current.start) / TYPE_SECONDS);
      const full = this.current.msg.text;
      const shown = full.slice(0, Math.ceil(full.length * k));
      if (this.text.textContent !== shown) this.text.textContent = shown;
    }
  }
}
