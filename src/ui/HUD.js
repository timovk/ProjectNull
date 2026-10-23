import { el } from './dom.js';
import { formatGameClock } from '../core/GameClock.js';
import { FacilityMap, markerLegend } from './FacilityMap.js';

/** Minimal in-game HUD: time, power, active systems, prompt, warnings. */
export class HUD {
  constructor(root) {
    this.clock = el('div', { class: 'clock' });
    this.pct = el('span', { class: 'pct' });
    this.usage = el('span', { class: 'usage' }, [0, 1, 2, 3, 4].map(() => el('i')));
    this.systems = el('div', { class: 'systems' });
    this.prompt = el('div', { class: 'prompt' });
    this.crosshair = el('div', { class: 'crosshair' });
    this.warnings = el('div', { class: 'warnings' });
    this.fps = el('div', { class: 'fps' });
    this.hold = el('div', { class: 'hold', html: '<svg viewBox="0 0 46 46"><circle cx="23" cy="23" r="19" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="3"/><circle class="arc" cx="23" cy="23" r="19" fill="none" stroke="#ffb84a" stroke-width="3" stroke-dasharray="119.4" stroke-dashoffset="119.4" transform="rotate(-90 23 23)"/></svg>' });
    this.arc = this.hold.querySelector('.arc');
    // Practice-only live map of where every subject is.
    this.miniMap = new FacilityMap({ compact: true });
    this.miniMap.showEntities(true);
    this.minimap = el('div', { class: 'minimap hidden' }, [el('h4', { text: 'PRACTICE MAP / LIVE' }), this.miniMap.node, markerLegend()]);
    this.node = el('div', { id: 'hud', class: 'hidden' }, [
      this.clock,
      this.minimap,
      el('div', { class: 'power' }, [el('span', { text: 'POWER ', style: { color: 'var(--dim)' } }), this.pct, this.usage, this.systems]),
      this.crosshair,
      this.hold,
      this.prompt,
      this.warnings,
      this.fps
    ]);
    root.append(this.node);
    this.activeWarnings = new Map();
    this.lastPrompt = null;
    this.tagCache = '';
  }

  setVisible(v) {
    this.node.classList.toggle('hidden', !v);
  }

  setNightLabel(text) {
    this.nightLabel = text;
    this.lastClock = null; // redraw
  }

  setPracticeMap(on) {
    this.minimap.classList.toggle('hidden', !on);
    this.practiceMap = on;
  }

  setDimmed(v) {
    this.node.style.opacity = v ? '0' : '1';
  }

  update(sim, interaction, fps, showFps) {
    if (this.practiceMap) this.miniMap.update(sim);
    const clock = formatGameClock(sim.gameHours);
    if (clock !== this.lastClock) {
      this.lastClock = clock;
      this.clock.innerHTML = `${clock}<small>${this.nightLabel ?? 'NIGHT 1'}</small>`;
    }
    const lvl = sim.power.level;
    const pct = `${Math.max(0, lvl).toFixed(0)}%`;
    if (pct !== this.pct.textContent) this.pct.textContent = pct;
    this.pct.classList.toggle('low', lvl < 20);
    const bars = Math.min(5, Math.ceil((sim.power.drainPerSecond / 0.065) * 1.2));
    [...this.usage.children].forEach((b, i) => {
      b.classList.toggle('on', i < bars);
      b.classList.toggle('hot', i < bars && bars >= 4);
    });

    const s = sim.security;
    const tags = [];
    if (sim.power.failed) tags.push(['NO POWER', 'alert']);
    for (const [id, short] of [['WEST_DOOR', 'W DOOR'], ['EAST_DOOR', 'E DOOR']]) {
      const d = s.doors[id];
      if (d.damaged) tags.push([`${short} FAULT`, 'alert']);
      else if (d.manualHold) tags.push([`${short} BRACED`, 'on']);
      else if (s.isDoorClosed(id)) tags.push([`${short} SHUT`, 'on']);
    }
    if (s.isCorridorLit('WEST_CORRIDOR')) tags.push(['W LIGHT', 'on']);
    if (s.isCorridorLit('EAST_CORRIDOR')) tags.push(['E LIGHT', 'on']);
    if (s.barrierActive) tags.push(['FIELD', 'on']);
    if (!s.fan && !sim.power.failed) tags.push(['VENT OFF', '']);
    if (!s.rack && !sim.power.failed) tags.push(['CAMS OFF', '']);
    if (sim.surveillance.thermalShutdown) tags.push(['RACK OVERHEAT', 'alert']);
    if (s.stationLights === 'LOW') tags.push(['LIGHTS LOW', '']);
    const key = tags.map((t) => t.join(':')).join('|');
    if (key !== this.tagCache) {
      this.tagCache = key;
      this.systems.replaceChildren(...tags.map(([t, c]) => el('span', { class: `tag ${c}`, text: t })));
    }

    const prompt = interaction?.prompt ?? null;
    if (prompt !== this.lastPrompt) {
      this.lastPrompt = prompt;
      if (prompt) this.prompt.innerHTML = prompt.replace(/\[(.+?)\]/g, '<kbd>[$1]</kbd>');
      this.prompt.classList.toggle('visible', !!prompt);
    }
    this.crosshair.classList.toggle('active', !!prompt);
    const hp = interaction?.holdProgress ?? 0;
    this.hold.classList.toggle('visible', hp > 0);
    this.arc.setAttribute('stroke-dashoffset', String(119.4 * (1 - hp)));
    this.fps.textContent = showFps ? `${fps.toFixed(0)} FPS` : '';
  }

  /** Persistent warnings keyed by id; set text to null to clear. */
  setWarning(id, text, kind = '') {
    const existing = this.activeWarnings.get(id);
    if (!text) {
      if (existing) {
        existing.remove();
        this.activeWarnings.delete(id);
      }
      return;
    }
    if (existing) {
      if (existing.textContent !== text) existing.textContent = text;
      return;
    }
    const node = el('div', { class: `warning ${kind}`, text });
    this.warnings.append(node);
    this.activeWarnings.set(id, node);
  }

  clearWarnings() {
    for (const n of this.activeWarnings.values()) n.remove();
    this.activeWarnings.clear();
  }
}
