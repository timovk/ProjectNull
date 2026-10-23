import { el } from './dom.js';
import { formatDebugTime } from '../core/GameClock.js';

/**
 * Internal AI debugger. Reads ONLY real simulation state and the simulation's
 * event log; it never synthesizes data. Hidden during normal play; available
 * in dev builds or with ?debug=1, toggled with F3.
 */
export class AIDebugger {
  constructor(root, game) {
    this.game = game;
    this.visible = false;
    this.lastSeq = 0;
    this.lines = [];
    this.nextRefresh = 0;
    this.showFailed = true;
    this.showSystem = true;
    this.scaleButtons = {};
    const controls = el('div', { class: 'dbg-controls' });
    for (const s of [0, 1, 4, 16]) {
      const b = el('button', { text: s === 0 ? 'PAUSE' : `${s}x`, onclick: () => game.setTimeScale(s) });
      this.scaleButtons[s] = b;
      controls.append(b);
    }
    this.header = el('div');
    this.entities = el('div', { class: 'dbg-entities' });
    this.log = el('div', { class: 'dbg-log' });
    const failedBox = el('input', { type: 'checkbox', checked: true, onchange: (e) => { this.showFailed = e.target.checked; this.rebuild(); } });
    const sysBox = el('input', { type: 'checkbox', checked: true, onchange: (e) => { this.showSystem = e.target.checked; this.rebuild(); } });
    this.node = el('div', { id: 'debugger', class: 'interactive hidden' }, [
      el('header', {}, [el('b', { text: 'PROJECT NULL - AI DEBUGGER' }), controls, this.header]),
      this.entities,
      el('div', { class: 'dbg-filter' }, [el('label', {}, [failedBox, ' failed rolls']), el('label', {}, [sysBox, ' system events']), el('button', { class: 'small-btn', text: 'COPY LOG', style: { padding: '1px 6px', fontSize: '10px' }, onclick: () => this.copy() })]),
      this.log
    ]);
    root.append(this.node);
  }

  toggle() {
    this.visible = !this.visible;
    this.node.classList.toggle('hidden', !this.visible);
    if (this.visible) this.rebuild();
  }

  resetLog() {
    this.lastSeq = 0;
    this.lines = [];
    this.log.replaceChildren();
  }

  formatRecord(r) {
    const t = `[${formatDebugTime(r.gameHours)}]`;
    if (r.type === 'OPPORTUNITY') {
      if (!this.showFailed && r.outcome === 'ROLL_FAILED') return null;
      const head = `${t} ${r.entityId} opportunity${r.kind === 'REACTIVE' ? ' (reactive)' : ''}`;
      if (r.outcome === 'INACTIVE' || r.outcome === 'SUPPRESSED') return [[head, 'fail'], [`${t} ${r.outcome}${r.reason ? ` (${r.reason})` : ''}`, 'fail']];
      const roll = `${t} AI=${r.aiLevel}${r.effectiveAI !== r.aiLevel ? ` (eff ${r.effectiveAI})` : ''} ROLL=${r.roll} ${r.rollSuccess ? 'SUCCESS' : 'FAILED'}`;
      if (!r.rollSuccess) return [[head, 'fail'], [roll, 'fail']];
      const cls = r.outcome === 'ATTACK_SUCCESS' ? 'attack' : r.outcome.includes('BLOCK') ? 'block' : 'succ';
      const move = `${t} ${r.from} -> ${r.to ?? r.from}  ${r.outcome}${r.reason ? ` (${r.reason})` : ''}${r.reaction ? ` [${r.reaction}]` : ''}${r.informed ? ' {informed}' : ''}`;
      return [[head, 'succ'], [roll, 'succ'], [move, cls]];
    }
    if (r.type === 'TRANSITION') return [[`${t} ${r.entityId} ${r.transition} ${r.detail ?? ''} @ ${r.room}`, 'block']];
    if (r.type === 'SYSTEM') return this.showSystem ? [[`${t} SYSTEM ${r.message}`, 'sys']] : null;
    return null;
  }

  rebuild() {
    const sim = this.game.sim;
    if (!sim) return;
    this.lines = [];
    for (const r of sim.log.recent(300)) {
      const f = this.formatRecord(r);
      if (f) this.lines.push(...f);
    }
    this.lastSeq = sim.log.sequence;
    this.renderLog();
  }

  renderLog() {
    if (this.lines.length > 600) this.lines.splice(0, this.lines.length - 600);
    const atBottom = this.log.scrollTop + this.log.clientHeight >= this.log.scrollHeight - 30;
    this.log.replaceChildren(...this.lines.map(([text, cls]) => el('div', { class: cls, text })));
    if (atBottom) this.log.scrollTop = this.log.scrollHeight;
  }

  copy() {
    const text = this.lines.map(([t]) => t).join('\n');
    navigator.clipboard?.writeText(text).catch(() => {});
  }

  update() {
    if (!this.visible) return;
    const now = performance.now();
    if (now < this.nextRefresh) return;
    this.nextRefresh = now + 100;
    const sim = this.game.sim;
    if (!sim) return;
    for (const [s, b] of Object.entries(this.scaleButtons)) b.classList.toggle('on', Number(s) === this.game.timeScale);
    this.header.textContent = `SIMULATION TIME: ${formatDebugTime(sim.gameHours)}  (${sim.time.toFixed(2)}s, step ${sim.clock.stepCount})  SEED: ${sim.seed}  PHASE: ${sim.phase}`;

    const blocks = [];
    for (const e of sim.ai.entities) {
      const mods = e.debugModifiers(sim);
      const next = Math.max(0, e.nextOpportunityAt - sim.time);
      const target = e.state === 'RETREATING' && e.retreatPath?.length ? e.retreatPath[e.retreatPath.length - 1] : e.target;
      blocks.push(
        `${e.designation} - ${e.name.replace('THE ', '')}\n` +
          `AI LEVEL: ${e.aiLevel}   EFFECTIVE: ${mods.effectiveAI}   P=${(mods.effectiveAI / 20).toFixed(2)}\n` +
          `MOVEMENT INTERVAL: ${e.movementInterval.toFixed(2)}s   NEXT OPPORTUNITY: ${next.toFixed(2)}s${e.bonusOpportunities.length ? ` (+${e.bonusOpportunities.length} reactive)` : ''}\n` +
          `CURRENT ROOM: ${e.currentRoom}   STATE: ${e.state}   TARGET: ${target}\n` +
          `LAST ROLL: ${e.lastRoll ?? '-'}   RESULT: ${e.lastResult ?? '-'}\n` +
          `ATTR  AGG ${e.attributes.aggression}  AWR ${e.attributes.awareness}  PAT ${e.attributes.patience}  INT ${e.attributes.intelligence}\n` +
          `MODS  ${Object.entries(mods).filter(([k]) => k !== 'effectiveAI').map(([k, v]) => `${k}=${v}`).join('  ')}\n` +
          `STATS opp ${e.stats.opportunities}  success ${e.stats.rollSuccesses}  moves ${e.stats.moves}  blocked ${e.stats.blocked}  attacks ${e.stats.attackAttempts}`
      );
    }
    const sec = sim.security;
    blocks.push(
      `WORLD  power ${sim.power.level.toFixed(2)}% (${(sim.power.drainPerSecond * 60).toFixed(2)}/min)  noise ${sim.noise.stationNoise.toFixed(3)}  ` +
        `doors W:${sec.isDoorClosed('WEST_DOOR') ? 'SHUT' : 'open'} E:${sec.isDoorClosed('EAST_DOOR') ? 'SHUT' : 'open'}  ` +
        `field ${sec.barrierActive ? 'ON' : 'off'}  decon ${sim.facility.deconActive ? 'SEALED' : 'open'}  viewing ${sim.surveillance.viewing ? sim.surveillance.selected : '-'}`
    );
    this.entities.textContent = blocks.join('\n\n');

    if (sim.log.sequence !== this.lastSeq) {
      for (const r of sim.log.since(this.lastSeq)) {
        const f = this.formatRecord(r);
        if (f) this.lines.push(...f);
      }
      this.lastSeq = sim.log.sequence;
      this.renderLog();
    }
  }
}
