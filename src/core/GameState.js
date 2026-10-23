/**
 * Presentation-level game states.
 *
 * Which states pause the simulation:
 *   SPLASH, MENU   no simulation is running
 *   PLAYING        simulation runs (including while the workstation, a
 *                  document or the AI debugger is open: those do NOT pause)
 *   PAUSED         paused (Esc menu, settings or controls opened from it,
 *                  window hidden, or pointer lock lost)
 *   FAILING        simulation stopped (breach); failure sequence plays
 *   VICTORY        simulation finished (6 AM); morning sequence plays
 *   ENDED          end screen
 */
export const STATES = Object.freeze({
  SPLASH: 'SPLASH',
  MENU: 'MENU',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  FAILING: 'FAILING',
  VICTORY: 'VICTORY',
  ENDED: 'ENDED'
});

const ALLOWED = {
  SPLASH: ['MENU'],
  MENU: ['PLAYING'],
  PLAYING: ['PAUSED', 'FAILING', 'VICTORY', 'MENU'],
  PAUSED: ['PLAYING', 'MENU'],
  FAILING: ['ENDED', 'MENU'],
  VICTORY: ['ENDED', 'MENU'],
  ENDED: ['PLAYING', 'MENU']
};

export class GameStateMachine {
  constructor(initial = STATES.SPLASH) {
    this.state = initial;
    this.listeners = new Set();
  }

  can(next) {
    return ALLOWED[this.state]?.includes(next) ?? false;
  }

  set(next) {
    if (next === this.state) return true;
    if (!this.can(next)) {
      console.warn(`[GameState] blocked transition ${this.state} -> ${next}`);
      return false;
    }
    const prev = this.state;
    this.state = next;
    for (const fn of this.listeners) fn(next, prev);
    return true;
  }

  onChange(fn) {
    this.listeners.add(fn);
  }

  get simulationRunning() {
    return this.state === STATES.PLAYING;
  }
}
