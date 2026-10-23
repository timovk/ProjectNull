import { GAME_CONFIG, AI_SCHEDULE, DEFAULT_SEED, POWER_CONFIG } from '../config/GameConfig.js';
import { STATION, ROOMS } from '../config/FacilityLayout.js';
import { Random } from './Random.js';
import { EventBus } from './EventBus.js';
import { EventLog } from './EventLog.js';
import { GameClock } from './GameClock.js';
import { MovementGraph } from '../ai/MovementGraph.js';
import { AIManager } from '../ai/AIManager.js';
import { OUTCOMES } from '../ai/MovementOpportunity.js';
import { PowerSystem } from '../systems/PowerSystem.js';
import { SecuritySystem } from '../systems/SecuritySystem.js';
import { SurveillanceSystem } from '../systems/SurveillanceSystem.js';
import { NoiseSystem } from '../systems/NoiseSystem.js';
import { FacilityEvents } from '../systems/FacilityEvents.js';
import { NightProgression } from '../systems/NightProgression.js';

export const SIM_PHASE = Object.freeze({ RUNNING: 'RUNNING', BREACHED: 'BREACHED', SURVIVED: 'SURVIVED' });

/**
 * The complete, headless night simulation. No Three.js, no DOM.
 *
 * The renderer, audio and UI only read this object and send it commands.
 * Every fixed step runs the systems in a fixed order:
 *   commands -> progression -> facility events -> security -> surveillance
 *   -> noise -> power -> AI
 * Given the same seed and the same commands at the same steps, the outcome is
 * identical (see tests/ai.test.js "determinism").
 */
export class Simulation {
  constructor(options = {}) {
    this.config = { ...GAME_CONFIG, ...(options.config ?? {}) };
    this.seed = options.seed ?? DEFAULT_SEED;
    this.schedule = options.schedule ?? AI_SCHEDULE;
    this.rng = new Random(this.seed);
    this.bus = options.bus ?? new EventBus();
    this.log = new EventLog(options.logCapacity ?? 4000);
    this.clock = new GameClock({
      nightDurationSeconds: this.config.nightDurationSeconds,
      startHour: this.config.startHour,
      endHour: this.config.endHour,
      fixedTimestep: options.fixedTimestep
    });
    this.graph = options.graph ?? new MovementGraph();
    this.phase = SIM_PHASE.RUNNING;
    this.breach = null;
    this.player = { walking: false, working: false, zone: 'STATION' };
    this.auxCellUsed = false;
    this.commandHistory = [];
    this.stats = {
      encounters: 0,
      blockedEntries: 0,
      barrierRepels: 0,
      lightDeterrals: 0,
      doorsForced: 0,
      thresholdArrivals: {}
    };

    this.facility = new FacilityEvents(this);
    this.power = new PowerSystem(this, options.powerConfig ?? POWER_CONFIG);
    this.security = new SecuritySystem(this);
    this.surveillance = new SurveillanceSystem(this);
    this.noise = new NoiseSystem(this);
    this.ai = new AIManager(this);
    this.progression = new NightProgression(this, this.schedule);

    this.progression.update();
    this.noise.update(0);
    this.power.drainPerSecond = this.power.computeDrain();
  }

  // -------------------------------------------------------------- time

  get time() {
    return this.clock.time;
  }

  get gameHours() {
    return this.clock.gameHours;
  }

  gameHoursAt(simTime) {
    const c = this.config;
    return c.startHour + Math.min(1, simTime / c.nightDurationSeconds) * (c.endHour - c.startHour);
  }

  // ------------------------------------------------- world interface

  isDoorClosed(id) {
    return this.security.isDoorClosed(id);
  }

  isGateOpen(id) {
    return this.facility.isGateOpen(id);
  }

  // ------------------------------------------------------------ stepping

  step() {
    if (this.phase !== SIM_PHASE.RUNNING) return false;
    const dt = this.clock.fixedTimestep;
    this.clock.tick();
    this.progression.update();
    this.facility.update(dt);
    this.security.update(dt);
    this.surveillance.update(dt);
    this.noise.update(dt);
    this.power.update(dt);
    this.ai.step(dt);
    if (this.phase === SIM_PHASE.RUNNING && this.clock.isNightOver) this.survive();
    return true;
  }

  /** Frame entry point: converts real elapsed time into fixed steps. */
  advance(realDelta) {
    const steps = this.clock.advance(realDelta);
    let ran = 0;
    for (let i = 0; i < steps; i++) {
      if (!this.step()) break;
      ran++;
    }
    return ran;
  }

  /** Runs `seconds` of simulation time (tests, tools). Optional per-step hook. */
  runFor(seconds, onStep = null) {
    const steps = Math.round(seconds / this.clock.fixedTimestep);
    for (let i = 0; i < steps; i++) {
      if (onStep) onStep(this);
      if (!this.step()) break;
    }
  }

  // ------------------------------------------------------------ commands

  /**
   * Applies a player command immediately (between fixed steps) and records it
   * with the current step index so a session can be replayed exactly.
   */
  command(cmd) {
    if (this.phase !== SIM_PHASE.RUNNING) return { ok: false, reason: 'NOT_RUNNING' };
    this.commandHistory.push({ step: this.clock.stepCount, cmd: { ...cmd } });
    const result = this.applyCommand(cmd) ?? { ok: true };
    this.bus.emit('command:result', { cmd, result });
    return result;
  }

  applyCommand(cmd) {
    const s = this.security;
    const sv = this.surveillance;
    switch (cmd.type) {
      case 'DOOR':
        return cmd.closed === undefined ? s.toggleDoor(cmd.door) : s.setDoor(cmd.door, !!cmd.closed);
      case 'LIGHT':
        return cmd.on === undefined ? s.toggleCorridorLight(cmd.room) : s.setCorridorLight(cmd.room, !!cmd.on);
      case 'BARRIER':
        return s.setBarrier(cmd.on ?? !s.barrier);
      case 'FAN':
        return s.setFan(cmd.on ?? !s.fan);
      case 'RACK':
        return s.setRack(cmd.on ?? !s.rack);
      case 'RADIO':
        return s.setRadio(cmd.on ?? !s.radio);
      case 'STATION_LIGHTS':
        return s.setStationLights(cmd.mode ?? (s.stationLights === 'NORMAL' ? 'LOW' : 'NORMAL'));
      case 'MANUAL_HOLD':
        return s.setManualHold(cmd.door, !!cmd.hold);
      case 'REPAIR_DOOR':
        return s.repairDoor(cmd.door);
      case 'VIEW':
        return sv.setViewing(!!cmd.viewing);
      case 'CAMERA':
        return sv.selectCamera(cmd.room);
      case 'PING':
        return sv.ping(cmd.room);
      case 'RELAY_RESET':
        return sv.relayReset();
      case 'AUX_CELL':
        return this.useAuxCell();
      case 'PLAYER':
        if ('walking' in cmd) this.player.walking = !!cmd.walking;
        if ('working' in cmd) this.player.working = !!cmd.working;
        if ('zone' in cmd) this.player.zone = cmd.zone;
        return { ok: true };
      default:
        return { ok: false, reason: 'UNKNOWN_COMMAND' };
    }
  }

  useAuxCell() {
    if (this.auxCellUsed) return { ok: false, reason: 'DEPLETED' };
    this.auxCellUsed = true;
    this.power.charge(POWER_CONFIG.auxCellCharge);
    this.noise.pulse('aux');
    this.recordSystem('AUX_CELL', `Auxiliary cell discharged (+${POWER_CONFIG.auxCellCharge}%)`, {});
    this.bus.emit('power:aux', {});
    return { ok: true };
  }

  // ------------------------------------------------------------ recording

  recordTransition(entity, transition, detail = '') {
    const rec = {
      type: 'TRANSITION',
      outcome: OUTCOMES.STATE_TRANSITION,
      time: this.time,
      gameHours: this.gameHours,
      entityId: entity.id,
      transition,
      detail,
      room: entity.currentRoom,
      state: entity.state
    };
    this.log.push(rec);
    this.bus.emit('ai:transition', rec);
    return rec;
  }

  recordSystem(kind, message, data = {}) {
    const rec = { type: 'SYSTEM', kind, message, time: this.time, gameHours: this.gameHours, ...data };
    this.log.push(rec);
    return rec;
  }

  // ------------------------------------------------------------ callbacks

  onEntityMoved(entity, from, to, rec) {
    this.surveillance.disrupt(from);
    this.surveillance.disrupt(to);
    if (entity.isAtThreshold(this)) {
      this.stats.encounters++;
      this.stats.thresholdArrivals[entity.id] = (this.stats.thresholdArrivals[entity.id] ?? 0) + 1;
    }
    this.bus.emit('entity:moved', { entityId: entity.id, from, to, retreat: rec.outcome === OUTCOMES.RETREATED, record: rec });
  }

  onEntryBlocked(entity, edge, reason, rec) {
    this.stats.blockedEntries++;
    this.bus.emit('entity:entryBlocked', { entityId: entity.id, room: entity.currentRoom, door: edge.door, vent: edge.vent, reason, record: rec });
  }

  onBreach(entity, edge, from) {
    this.phase = SIM_PHASE.BREACHED;
    this.breach = {
      entityId: entity.id,
      name: entity.name,
      designation: entity.designation,
      from,
      via: edge.door ?? (edge.vent ? 'VENT' : 'UNKNOWN'),
      time: this.time,
      gameHours: this.gameHours
    };
    this.recordSystem('BREACH', `${entity.id} entered ${STATION} from ${from}`, { entityId: entity.id });
    this.bus.emit('sim:breach', this.breach);
  }

  survive() {
    this.phase = SIM_PHASE.SURVIVED;
    this.recordSystem('SURVIVED', 'Night complete', {});
    this.bus.emit('sim:survived', {});
  }

  onPowerFailure() {
    this.security.onPowerFailure();
    this.recordSystem('POWER_FAILURE', 'Main power depleted. Emergency lighting engaged.', {});
    this.bus.emit('power:failed', {});
  }

  onPowerRestored() {
    this.security.onPowerRestored();
    this.recordSystem('POWER_RESTORED', 'Power restored from auxiliary cell', {});
    this.bus.emit('power:restored', {});
  }

  // ------------------------------------------------------------ reporting

  getSummary() {
    const s = this.security.usage;
    const sv = this.surveillance.usage;
    return {
      outcome: this.phase,
      seed: String(this.seed),
      timeSurvived: this.time,
      gameHours: this.gameHours,
      powerRemaining: this.power.level,
      powerFailed: this.power.failed,
      breach: this.breach,
      encounters: this.stats.encounters,
      blockedEntries: this.stats.blockedEntries,
      barrierRepels: this.stats.barrierRepels,
      lightDeterrals: this.stats.lightDeterrals,
      doorsForced: this.stats.doorsForced,
      doorCloses: s.doorCloses,
      doorSeconds: s.doorSeconds,
      lightSeconds: s.lightSeconds,
      barrierSeconds: s.barrierSeconds,
      fanOffSeconds: s.fanOffSeconds,
      repairs: s.repairs,
      cameraSeconds: sv.viewSeconds,
      cameraSwitches: sv.switches,
      pings: sv.pings,
      relayResets: sv.relayResets,
      thermalShutdowns: sv.thermalShutdowns,
      auxCellUsed: this.auxCellUsed,
      opportunities: this.ai.entities.reduce((n, e) => n + e.stats.opportunities, 0),
      peakNoise: this.noise.peak
    };
  }

  roomName(id) {
    return ROOMS[id]?.name ?? id;
  }
}
