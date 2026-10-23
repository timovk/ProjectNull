import { STATION } from '../config/FacilityLayout.js';
import { GAME_CONFIG, RETREAT_AI_FLOOR, BLACKOUT_AI_BONUS } from '../config/GameConfig.js';
import * as BM from './BehaviorModifiers.js';

export const ENTITY_STATES = Object.freeze({
  DORMANT: 'DORMANT', // AI level 0
  IDLE: 'IDLE', // active, at home
  ROAMING: 'ROAMING',
  APPROACHING: 'APPROACHING', // within two rooms of the station
  WAITING: 'WAITING', // at a threshold room, trying to get in
  OBSERVING: 'OBSERVING', // Observer: aware it is being watched
  LISTENING: 'LISTENING', // Echo: in the station duct
  RETREATING: 'RETREATING',
  INSIDE: 'INSIDE'
});

const ALLOWED = Object.freeze({ allowed: true, reason: null });

/**
 * Base entity. Subclasses override the hooks (`update`, `canMove`, `aiBonus`,
 * `stimulusFactor`, `checkMovement`, `checkEntry`, `onEntryBlocked`, ...)
 * but never the roll itself, which lives in MovementOpportunity.js.
 */
export class Entity {
  constructor(def, rng) {
    this.def = def;
    this.id = def.id;
    this.designation = def.designation;
    this.name = def.name;
    this.attributes = { ...def.attributes };
    this.movementInterval = def.movementInterval;
    this.homeRoom = def.homeRoom;
    this.tuning = def.tuning ?? {};
    this.rng = rng;
    this.reset();
  }

  reset() {
    this.aiLevel = 0;
    this.currentRoom = this.homeRoom;
    this.previousRoom = null;
    this.scheduledCount = 0;
    this.nextOpportunityAt = this.movementInterval;
    this.bonusOpportunities = [];
    this.active = true;
    this.state = ENTITY_STATES.DORMANT;
    this.target = STATION;
    this.frustration = 0;
    this.retreatPath = null;
    this.roomEnteredAt = 0;
    this.lastRoll = null;
    this.lastResult = null;
    this.lastRecord = null;
    this.lastWeights = null;
    this.stats = { opportunities: 0, rollSuccesses: 0, moves: 0, blocked: 0, attackAttempts: 0, retreats: 0 };
  }

  setAILevel(level) {
    const v = Math.max(GAME_CONFIG.aiMin, Math.min(GAME_CONFIG.aiMax, Math.round(Number(level) || 0)));
    this.aiLevel = v;
    if (v > 0 && this.state === ENTITY_STATES.DORMANT) this.state = ENTITY_STATES.IDLE;
    if (v === 0 && this.state === ENTITY_STATES.IDLE) this.state = ENTITY_STATES.DORMANT;
    return v;
  }

  // ---------------------------------------------------------------- hooks

  /** Continuous per-step logic (agitation, exposure, ...). */
  update(_dt, _sim) {}

  /** Step 2 of the pipeline. */
  canMove(_sim) {
    return ALLOWED;
  }

  /** Entity-specific additive modifier to the AI level (documented per entity). */
  aiBonus(_sim) {
    return 0;
  }

  /** Aggression used for route selection (subclasses may add modifiers). */
  effectiveAggression(_sim) {
    return BM.clampAttribute(this.attributes.aggression);
  }

  /** Entity-specific multiplier on a candidate destination. */
  stimulusFactor(_room, _sim, _info) {
    return 1;
  }

  /**
   * Effective AI = AI level + entity bonus (+ blackout bonus), at least the
   * retreat floor while retreating, clamped to [0, 20]. An entity at AI 0 is
   * dormant and its effective AI is always exactly 0.
   */
  getEffectiveAI(sim) {
    if (this.aiLevel <= 0) return 0;
    let ai = this.aiLevel + this.aiBonus(sim);
    if (sim.power.failed) ai += BLACKOUT_AI_BONUS;
    if (this.state === ENTITY_STATES.RETREATING) ai = Math.max(ai, RETREAT_AI_FLOOR);
    return Math.max(GAME_CONFIG.aiMin, Math.min(GAME_CONFIG.aiMax, Math.floor(ai)));
  }

  /** The edge this entity would use to enter the station from `room`, if any. */
  stationEdgeFrom(room, sim) {
    const edge = sim.graph.getEdge(room, STATION);
    return edge && sim.graph.allowsEntity(edge, this.id) ? edge : null;
  }

  isAtThreshold(sim) {
    return !!this.stationEdgeFrom(this.currentRoom, sim);
  }

  // ------------------------------------------------------------ decisions

  decide(sim) {
    if (this.state === ENTITY_STATES.RETREATING) return this.decideRetreat(sim);
    const edge = this.stationEdgeFrom(this.currentRoom, sim);
    if (edge) return { type: 'ATTACK', to: STATION, edge };
    return this.decideRoute(sim);
  }

  /** Weighted random selection over neighboring rooms. */
  decideRoute(sim, options = {}) {
    const graph = sim.graph;
    const edges = graph.edgesFor(this.currentRoom, this.id).filter((e) => e.to !== STATION);
    if (!edges.length) return { type: 'STAY', reason: 'NO_EXITS' };

    const informed = this.rng.chance(BM.informedChance(this.attributes.intelligence));
    const dist = informed ? graph.distancesTo(STATION, this.id, sim) : graph.distancesTo(STATION, this.id);
    const curD = BM.finiteDistance(dist.get(this.currentRoom));
    const aggression = options.aggression ?? this.effectiveAggression(sim);

    const weights = new Array(edges.length);
    for (let i = 0; i < edges.length; i++) {
      const e = edges[i];
      const delta = BM.finiteDistance(dist.get(e.to)) - curD;
      let w = e.weight * BM.approachFactor(aggression, delta);
      w *= this.stimulusFactor(e.to, sim, { informed, delta });
      if (informed && !graph.edgeStatus(e, this.id, sim).passable) w *= BM.INFORMED_BLOCKED_WEIGHT;
      weights[i] = w;
    }
    this.lastWeights = edges.map((e, i) => ({ room: e.to, weight: weights[i] }));
    const idx = this.rng.weightedIndex(weights);
    if (idx < 0) return { type: 'STAY', reason: 'NO_PREFERENCE', informed };
    return { type: 'MOVE', to: edges[idx].to, informed };
  }

  decideRetreat(sim) {
    if (!this.retreatPath || !this.retreatPath.length) {
      this.retreatPath = this.computeRetreatPath(sim);
      if (!this.retreatPath.length) {
        this.endRetreat(sim, 'NO_RETREAT_PATH');
        return this.decideRoute(sim);
      }
    }
    return { type: 'RETREAT', to: this.retreatPath[0] };
  }

  // ---------------------------------------------------------- restrictions

  /** Step 7 for ordinary moves. Subclasses add entity-specific restrictions. */
  checkMovement(_decision, edge, sim) {
    return sim.graph.edgeStatus(edge, this.id, sim);
  }

  /** Step 7 for station entry. */
  checkEntry(edge, sim) {
    const status = sim.graph.edgeStatus(edge, this.id, sim);
    return status.passable ? { allowed: true, reason: null } : { allowed: false, reason: status.reason };
  }

  /** Default reaction to a blocked entry: lose patience, eventually retreat. */
  onEntryBlocked(sim, reason, _edge) {
    this.frustration++;
    this.state = ENTITY_STATES.WAITING;
    if (this.frustration >= BM.obstacleTolerance(this.attributes.patience)) {
      this.beginRetreat(sim, `PATIENCE_EXHAUSTED:${reason}`);
      return 'RETREAT';
    }
    return 'WAIT';
  }

  /** Reaction to a blocked ordinary move. */
  onMoveBlocked(sim, reason, decision) {
    if (decision.type === 'RETREAT') {
      this.retreatPath = null; // recompute on the next opportunity
      return 'REROUTE';
    }
    this.frustration++;
    if (this.frustration >= BM.obstacleTolerance(this.attributes.patience)) {
      this.beginRetreat(sim, `PATIENCE_EXHAUSTED:${reason}`);
      return 'RETREAT';
    }
    return null;
  }

  // -------------------------------------------------------------- retreat

  beginRetreat(sim, reason) {
    const path = this.computeRetreatPath(sim);
    this.frustration = 0;
    if (!path.length) return false;
    this.retreatPath = path;
    this.state = ENTITY_STATES.RETREATING;
    this.stats.retreats++;
    sim.recordTransition(this, 'RETREAT_BEGIN', `${reason} -> ${path[path.length - 1]}`);
    return true;
  }

  endRetreat(sim, reason) {
    this.retreatPath = null;
    this.state = this.currentRoom === this.homeRoom ? ENTITY_STATES.IDLE : ENTITY_STATES.ROAMING;
    this.updateStateFromRoom(sim);
    sim.recordTransition(this, 'RETREAT_END', reason);
  }

  /**
   * Retreat paths always follow the graph. `retreatSteps > 0` walks that many
   * rooms away from the station (greedy on distance); 0 means "go home".
   */
  computeRetreatPath(sim) {
    const graph = sim.graph;
    const steps = this.def.retreatSteps ?? 2;
    if (steps <= 0) {
      const p = graph.shortestPath(this.currentRoom, this.homeRoom, this.id, sim) ?? graph.shortestPath(this.currentRoom, this.homeRoom, this.id);
      return p ? p.slice(1) : [];
    }
    const dist = graph.distancesTo(STATION, this.id);
    const path = [];
    const visited = new Set([this.currentRoom]);
    let room = this.currentRoom;
    for (let i = 0; i < steps; i++) {
      const candidates = graph
        .edgesFor(room, this.id)
        .filter((e) => e.to !== STATION && !visited.has(e.to) && graph.edgeStatus(e, this.id, sim).passable);
      if (!candidates.length) break;
      let best = -Infinity;
      for (const e of candidates) best = Math.max(best, BM.finiteDistance(dist.get(e.to)));
      const top = candidates.filter((e) => BM.finiteDistance(dist.get(e.to)) === best);
      const next = top.length === 1 ? top[0].to : this.rng.pick(top).to;
      path.push(next);
      visited.add(next);
      room = next;
    }
    return path;
  }

  // ------------------------------------------------------------- position

  moveTo(room, sim) {
    this.previousRoom = this.currentRoom;
    this.currentRoom = room;
    this.roomEnteredAt = sim.time;
    if (room === STATION) {
      this.state = ENTITY_STATES.INSIDE;
      return;
    }
    if (this.state === ENTITY_STATES.RETREATING) {
      if (this.retreatPath && this.retreatPath[0] === room) this.retreatPath.shift();
      if (!this.retreatPath || !this.retreatPath.length) this.endRetreat(sim, 'ARRIVED');
    } else {
      this.frustration = 0;
      this.updateStateFromRoom(sim);
    }
    this.onEnteredRoom(sim);
  }

  onEnteredRoom(_sim) {}

  updateStateFromRoom(sim) {
    if (this.state === ENTITY_STATES.RETREATING || this.state === ENTITY_STATES.INSIDE) return;
    if (this.aiLevel <= 0 && this.currentRoom === this.homeRoom) {
      this.state = ENTITY_STATES.DORMANT;
      return;
    }
    if (this.isAtThreshold(sim)) {
      this.state = ENTITY_STATES.WAITING;
      return;
    }
    const d = sim.graph.distancesTo(STATION, this.id).get(this.currentRoom);
    if (d <= 2) this.state = ENTITY_STATES.APPROACHING;
    else if (this.currentRoom === this.homeRoom) this.state = ENTITY_STATES.IDLE;
    else this.state = ENTITY_STATES.ROAMING;
  }

  /** Values shown by the AI debugger. Subclasses extend. */
  debugModifiers(sim) {
    return {
      frustration: `${this.frustration}/${BM.obstacleTolerance(this.attributes.patience)}`,
      informedChance: BM.informedChance(this.attributes.intelligence).toFixed(2),
      effectiveAI: this.getEffectiveAI(sim)
    };
  }
}
