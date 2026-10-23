import { el } from './dom.js';
import { LESSONS, practiceBreachText } from '../content/PracticeLessons.js';

const SUCCESS_SECONDS = 4;
const BREACH_SECONDS = 11;

/**
 * Practice-night coach. Shows one lesson at a time, chosen from what is
 * really happening in the simulation. Urgent lessons pre-empt others and
 * slow time to half speed until the player has acted.
 */
export class PracticeCoach {
  constructor(root) {
    this.label = el('span', { class: 'label' });
    this.text = el('div', { class: 'coach-text' });
    this.note = el('div', { class: 'coach-note' });
    this.node = el('div', { id: 'coach', class: 'hidden' }, [this.label, this.text, this.note]);
    root.append(this.node);
    this.reset();
  }

  reset() {
    this.done = new Set();
    this.active = null;
    this.ctx = null;
    this.activatedAt = 0;
    this.successUntil = 0;
    this.successText = '';
    this.breachUntil = 0;
    this.breachText = '';
    this.enabled = false;
    this.render();
  }

  start() {
    this.reset();
    this.enabled = true;
  }

  stop() {
    this.enabled = false;
    this.active = null;
    this.render();
  }

  /** True while an urgent lesson is waiting for the player (half-speed time). */
  get slow() {
    return this.enabled && !!this.active?.urgent && !this.active.info;
  }

  get lessonsDone() {
    return this.done.size;
  }

  onBreach(breach) {
    if (!this.enabled) return;
    this.breachText = practiceBreachText(breach);
    this.breachUntil = performance.now() / 1000 + BREACH_SECONDS;
    this.render();
  }

  eligible(lesson, sim, game) {
    if (this.done.has(lesson.id)) return false;
    if (lesson.after && !this.done.has(lesson.after)) return false;
    try {
      return lesson.trigger(sim, game);
    } catch {
      return false;
    }
  }

  activate(lesson, sim, game) {
    this.active = lesson;
    this.ctx = lesson.activate?.(sim, game) ?? {};
    this.activatedAt = performance.now() / 1000;
  }

  update(sim, game) {
    if (!this.enabled) return;
    const now = performance.now() / 1000;

    if (this.active) {
      const a = this.active;
      const finished = a.info ? now - this.activatedAt >= a.info : a.complete(sim, game, this.ctx);
      if (finished) {
        this.done.add(a.id);
        if (a.success) {
          this.successText = a.success;
          this.successUntil = now + SUCCESS_SECONDS;
        }
        this.active = null;
      } else if (!a.urgent) {
        // An urgent situation pre-empts a calm lesson (which comes back later).
        const urgent = LESSONS.find((l) => l.urgent && this.eligible(l, sim, game));
        if (urgent) this.activate(urgent, sim, game);
      }
    }

    if (!this.active) {
      const urgent = LESSONS.find((l) => l.urgent && this.eligible(l, sim, game));
      const calm = now >= this.successUntil ? LESSONS.find((l) => !l.urgent && this.eligible(l, sim, game)) : null;
      const next = urgent ?? calm;
      if (next) this.activate(next, sim, game);
    }
    this.render(sim, game, now);
  }

  render(sim = null, game = null, now = performance.now() / 1000) {
    const show = (label, text, note, kind) => {
      this.node.className = `coach ${kind}`;
      if (this.label.textContent !== label) this.label.textContent = label;
      if (this.text.textContent !== text) this.text.textContent = text;
      if (this.note.textContent !== note) this.note.textContent = note;
    };
    if (!this.enabled) {
      this.node.className = 'hidden';
      return;
    }
    if (now < this.breachUntil) return show('PRACTICE  /  THIS WOULD END A REAL NIGHT', this.breachText, '', 'breach');
    if (this.active && (this.active.urgent || now >= this.successUntil)) {
      const text = this.active.text(sim, game, this.ctx);
      return show(this.active.urgent ? 'PRACTICE  /  DO THIS NOW' : 'PRACTICE', text, this.slow ? 'Time is running at half speed until you do this.' : '', this.active.urgent ? 'urgent' : '');
    }
    if (now < this.successUntil) return show('PRACTICE  /  DONE', this.successText, '', 'success');
    this.node.className = 'hidden';
  }
}
