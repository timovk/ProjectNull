import { FIXED_TIMESTEP, CLOCK_CONFIG, GAME_CONFIG } from '../config/GameConfig.js';

/**
 * Fixed-step simulation clock.
 *
 * `advance(realDelta)` accumulates real elapsed time and reports how many fixed
 * steps to run. `tick()` advances simulation time by exactly one step.
 * Simulation time is computed as stepCount * fixedTimestep, so it never drifts
 * and is completely independent of the rendering frame rate.
 */
export class GameClock {
  constructor(options = {}) {
    this.fixedTimestep = options.fixedTimestep ?? FIXED_TIMESTEP;
    this.maxStepsPerFrame = options.maxStepsPerFrame ?? CLOCK_CONFIG.maxStepsPerFrame;
    this.maxBacklogSeconds = options.maxBacklogSeconds ?? CLOCK_CONFIG.maxBacklogSeconds;
    this.nightDurationSeconds = options.nightDurationSeconds ?? GAME_CONFIG.nightDurationSeconds;
    this.startHour = options.startHour ?? GAME_CONFIG.startHour;
    this.endHour = options.endHour ?? GAME_CONFIG.endHour;
    this.reset();
  }

  reset() {
    this.stepCount = 0;
    this.accumulator = 0;
    this.droppedSeconds = 0;
  }

  get time() {
    return this.stepCount * this.fixedTimestep;
  }

  /** Returns the number of fixed steps the caller should run now. */
  advance(realDelta) {
    if (!(realDelta > 0) || !Number.isFinite(realDelta)) return 0;
    this.accumulator += realDelta;
    if (this.accumulator > this.maxBacklogSeconds) {
      this.droppedSeconds += this.accumulator - this.maxBacklogSeconds;
      this.accumulator = this.maxBacklogSeconds;
    }
    const eps = 1e-9;
    let steps = Math.floor((this.accumulator + eps) / this.fixedTimestep);
    if (steps > this.maxStepsPerFrame) steps = this.maxStepsPerFrame;
    this.accumulator = Math.max(0, this.accumulator - steps * this.fixedTimestep);
    return steps;
  }

  /** Interpolation factor between the last two steps (for rendering). */
  get alpha() {
    return this.accumulator / this.fixedTimestep;
  }

  tick() {
    this.stepCount++;
  }

  get progress() {
    return Math.min(1, this.time / this.nightDurationSeconds);
  }

  get secondsPerHour() {
    return this.nightDurationSeconds / (this.endHour - this.startHour);
  }

  /** Continuous in-game hours since the start hour. */
  get gameHours() {
    return this.startHour + this.progress * (this.endHour - this.startHour);
  }

  /** Whole hour index since the start (0 = 12 AM). */
  get hourIndex() {
    const span = this.endHour - this.startHour;
    return Math.min(span - 1, Math.floor(this.time / this.secondsPerHour + 1e-9));
  }

  get isNightOver() {
    return this.time >= this.nightDurationSeconds - 1e-9;
  }
}

export function formatHour12(hour) {
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display} ${h < 12 ? 'AM' : 'PM'}`;
}

/** "12:43 AM" style for wall clocks. */
export function formatGameClock(gameHours) {
  const totalMinutes = Math.floor(gameHours * 60 + 1e-3);
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** "03:42:18.100" facility clock time (hours:minutes:seconds.ms). */
export function formatDebugTime(gameHours) {
  const totalMs = Math.max(0, Math.round(gameHours * 3600 * 1000));
  const h = Math.floor(totalMs / 3600000);
  const m = Math.floor((totalMs % 3600000) / 60000);
  const s = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

/** "07:21" minutes:seconds. */
export function formatDuration(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
