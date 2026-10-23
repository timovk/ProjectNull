import { Entity, ENTITY_STATES, THRESHOLD_SETTLE_INTERVALS } from '../Entity.js';
import * as BM from '../BehaviorModifiers.js';

/**
 * SUBJECT 03 - THE ECHO
 *
 * Follows sound. Uses the ventilation network (restricted passages) and can
 * only enter the station through the duct above it.
 *
 *  Awareness    hearing:
 *               - per-hop retention f = 0.30 + 0.35 * p
 *               - range = 2 + floor(awareness / 5) hops
 *               - perceived(room) = sum over sources of level * f^hops
 *               - route weight x (0.3 + 4.0 * perceived(destination))
 *               - entry threshold: it can only drop into the station while
 *                 station noise >= 0.50 - 0.30 * p. Otherwise entry is
 *                 blocked with reason SILENCE.
 *  Aggression   standard approach bias.
 *  Patience     silent (blocked) attempts before it retreats two rooms.
 *  Give-up      it also retreats after listening to a silent station for
 *               (1.5 + 6) intervals (31.5 s), whatever its rolls do. Any
 *               moment above the threshold restarts that wait. Without this,
 *               a low-AI Echo needed minutes of lucky rolls to leave.
 *  Intelligence informed decisions discount decoy noise (diagnostic pings)
 *               to 35 % and use the live distance map.
 */
export class Echo extends Entity {
  reset() {
    super.reset();
    this.lastPerceived = 0;
    this.silentFor = 0;
  }

  /** Seconds of continuous silence in the duct after which it gives up. */
  giveUpSeconds() {
    return this.movementInterval * (THRESHOLD_SETTLE_INTERVALS + this.tuning.giveUpIntervals);
  }

  update(dt, sim) {
    const listening = this.isAtThreshold(sim) && this.state !== ENTITY_STATES.RETREATING && this.aiLevel > 0;
    if (!listening || sim.noise.stationNoise >= this.listenThreshold()) {
      this.silentFor = 0;
      return;
    }
    this.silentFor += dt;
    if (this.silentFor >= this.giveUpSeconds()) {
      this.silentFor = 0;
      this.beginRetreat(sim, 'SILENCE_GAVE_UP');
    }
  }

  perceptionStrength() {
    return BM.perception(this.attributes.awareness);
  }

  falloff() {
    return this.tuning.falloffBase + this.tuning.falloffSpan * this.perceptionStrength();
  }

  listenThreshold() {
    return this.tuning.listenThresholdBase - this.tuning.listenThresholdSpan * this.perceptionStrength();
  }

  perceivedNoise(room, sim, informed = false) {
    const range = BM.hearingRange(this.attributes.awareness);
    const f = this.falloff();
    let total = 0;
    for (const src of sim.noise.sources) {
      const d = sim.graph.soundDistancesFrom(src.room).get(room);
      if (d === undefined || d > range) continue;
      let level = src.level * Math.pow(f, d);
      if (informed && src.decoy) level *= this.tuning.decoyDiscountWhenInformed;
      total += level;
    }
    return total;
  }

  stimulusFactor(room, sim, info) {
    return this.tuning.noiseWeightFloor + this.tuning.noiseWeightScale * this.perceivedNoise(room, sim, info.informed);
  }

  checkEntry(edge, sim) {
    if (edge.vent) {
      if (sim.noise.stationNoise < this.listenThreshold()) return { allowed: false, reason: 'SILENCE' };
      return { allowed: true, reason: null };
    }
    return super.checkEntry(edge, sim);
  }

  updateStateFromRoom(sim) {
    super.updateStateFromRoom(sim);
    if (this.state === ENTITY_STATES.WAITING) this.state = ENTITY_STATES.LISTENING;
  }

  onEntryBlocked(sim, reason, edge) {
    const r = super.onEntryBlocked(sim, reason, edge);
    if (this.state === ENTITY_STATES.WAITING) this.state = ENTITY_STATES.LISTENING;
    return r;
  }

  debugModifiers(sim) {
    return {
      ...super.debugModifiers(sim),
      hearing: `${this.perceivedNoise(this.currentRoom, sim).toFixed(3)} here`,
      stationNoise: sim.noise.stationNoise.toFixed(3),
      threshold: this.listenThreshold().toFixed(3),
      silence: `${this.silentFor.toFixed(1)}/${this.giveUpSeconds().toFixed(1)}s`,
      range: `${BM.hearingRange(this.attributes.awareness)} hops`
    };
  }
}
