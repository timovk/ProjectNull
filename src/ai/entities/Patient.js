import { Entity, ENTITY_STATES } from '../Entity.js';
import * as BM from '../BehaviorModifiers.js';

/**
 * SUBJECT 04 - THE PATIENT
 *
 * Slow (8 s interval), relentless, strongly prefers routes toward the player.
 * Countered by the containment barrier.
 *
 *  Aggression   standard approach bias, plus an extra x0.25 on any route that
 *               leads away from the station.
 *  Awareness    hears the door it waits at open: schedules one reactive
 *               opportunity after 1.0 + 5.0 * (1 - p) seconds.
 *  Patience     - closed door: each blocked entry adds pressure; at
 *                 1 + floor(patience/4) pressure the door motor is forced
 *                 (door opens and stays damaged until repaired).
 *               - barrier: it retreats home after 10 + 0.75 * patience seconds
 *                 of barrier exposure while at the door (exposure decays at
 *                 0.5/s while the barrier is off).
 *  Resolve      +1 effective AI per 20 s waiting at a door, max floor(patience/3).
 *  Intelligence informed routing toward the open door.
 */
export class Patient extends Entity {
  reset() {
    super.reset();
    this.waitTime = 0;
    this.exposure = 0;
    this.pressure = 0;
    this.doorWasClosed = false;
  }

  stimulusFactor(_room, _sim, info) {
    return info.delta > 0 ? this.tuning.awayPreference : 1;
  }

  barrierRetreatSeconds() {
    return this.tuning.barrierBaseSeconds + this.tuning.barrierSecondsPerPatience * BM.clampAttribute(this.attributes.patience);
  }

  reactionDelay() {
    return this.tuning.reactionBaseSeconds + this.tuning.reactionSpanSeconds * (1 - BM.perception(this.attributes.awareness));
  }

  maxResolve() {
    return Math.floor(BM.clampAttribute(this.attributes.patience) / 3);
  }

  resolve() {
    if (this.state === ENTITY_STATES.RETREATING || this.state === ENTITY_STATES.INSIDE) return 0;
    return Math.min(this.maxResolve(), Math.floor(this.waitTime / this.tuning.resolveSecondsPerAI));
  }

  aiBonus(_sim) {
    return this.resolve();
  }

  onEnteredRoom(sim) {
    this.waitTime = 0;
    this.pressure = 0;
    const edge = this.stationEdgeFrom(this.currentRoom, sim);
    this.doorWasClosed = edge?.door ? sim.security.isDoorClosed(edge.door) : false;
  }

  update(dt, sim) {
    if (this.state === ENTITY_STATES.INSIDE) return;
    const edge = this.stationEdgeFrom(this.currentRoom, sim);
    const waiting = edge && this.state !== ENTITY_STATES.RETREATING && this.aiLevel > 0;
    if (!waiting) {
      this.waitTime = 0;
      this.exposure = Math.max(0, this.exposure - this.tuning.barrierExposureDecay * dt);
      return;
    }
    this.waitTime += dt;

    if (sim.security.barrierActive) {
      this.exposure += dt;
      if (this.exposure >= this.barrierRetreatSeconds()) {
        this.exposure = 0;
        this.pressure = 0;
        sim.stats.barrierRepels++;
        this.beginRetreat(sim, 'BARRIER_REPELLED');
        return;
      }
    } else {
      this.exposure = Math.max(0, this.exposure - this.tuning.barrierExposureDecay * dt);
    }

    if (edge.door) {
      const closed = sim.security.isDoorClosed(edge.door);
      if (this.doorWasClosed && !closed) {
        const at = sim.time + this.reactionDelay();
        this.bonusOpportunities.push(at);
        sim.recordTransition(this, 'HEARD_DOOR_OPEN', `reactive opportunity at +${this.reactionDelay().toFixed(1)}s`);
      }
      this.doorWasClosed = closed;
    }
  }

  checkEntry(edge, sim) {
    if (sim.security.barrierActive) return { allowed: false, reason: 'BARRIER' };
    return super.checkEntry(edge, sim);
  }

  onEntryBlocked(sim, reason, edge) {
    this.state = ENTITY_STATES.WAITING;
    if (reason === 'BARRIER') return 'HELD_BY_BARRIER';
    if (reason === 'DOOR_CLOSED' && edge.door) {
      this.pressure++;
      if (this.pressure >= BM.obstacleTolerance(this.attributes.patience)) {
        this.pressure = 0;
        sim.security.forceDoor(edge.door, this.id);
        sim.recordTransition(this, 'DOOR_FORCED', edge.door);
        return 'DOOR_FORCED';
      }
      return `PRESSURE ${this.pressure}/${BM.obstacleTolerance(this.attributes.patience)}`;
    }
    return super.onEntryBlocked(sim, reason, edge);
  }

  debugModifiers(sim) {
    return {
      ...super.debugModifiers(sim),
      waitTime: `${this.waitTime.toFixed(1)}s (resolve +${this.resolve()})`,
      barrierExposure: `${this.exposure.toFixed(1)}/${this.barrierRetreatSeconds().toFixed(1)}s`,
      doorPressure: `${this.pressure}/${BM.obstacleTolerance(this.attributes.patience)}`
    };
  }
}
