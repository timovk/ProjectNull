import { Entity, ENTITY_STATES } from '../Entity.js';
import * as BM from '../BehaviorModifiers.js';

/**
 * SUBJECT 02 - THE OBSERVER
 *
 * Reacts to surveillance. "Watched" means: the workstation is open, the
 * selected camera shows the Observer's room and that feed has signal.
 *
 *  Awareness    detection of surveillance:
 *               - detect delay = 2.5 - 2.0 * p seconds of continuous watching
 *               - agitation gain = 0.45 * (0.25 + 0.75 * p) per watched second
 *               (p = awareness / 20)
 *  Agitation    capped modifier, 0..10. Decays 0.12/s when not watched.
 *               Effective AI bonus = floor(agitation / 2.5)  (max +4).
 *  Freeze       while detected AND agitation < 8 it cannot move (SUPPRESSED).
 *               At agitation >= 8 it stops respecting the camera.
 *  Neglect      seconds since last watched. After 60 s its route aggression
 *               rises by +1 per 10 s (max +8), so ignoring it is also unsafe.
 *  Patience     blocked door attempts before it retreats two rooms.
 *  Intelligence informed routing toward the open door.
 */
export class Observer extends Entity {
  reset() {
    super.reset();
    this.agitation = 0;
    this.watchedFor = 0;
    this.secondsSinceSeen = 0;
    this.detected = false;
    this.watched = false;
    this.facingCamera = false;
  }

  perceptionStrength() {
    return BM.perception(this.attributes.awareness);
  }

  detectDelay() {
    const t = this.tuning;
    return t.detectBaseSeconds - t.detectSpanSeconds * this.perceptionStrength();
  }

  update(dt, sim) {
    if (this.state === ENTITY_STATES.INSIDE) return;
    const t = this.tuning;
    const p = this.perceptionStrength();
    this.watched = sim.surveillance.isWatching(this.currentRoom);
    if (this.watched) {
      this.watchedFor += dt;
      this.secondsSinceSeen = 0;
      this.agitation = Math.min(t.agitationCap, this.agitation + dt * t.agitationGainPerSecond * (0.25 + 0.75 * p));
    } else {
      this.watchedFor = 0;
      this.secondsSinceSeen += dt;
      this.agitation = Math.max(0, this.agitation - dt * t.agitationDecayPerSecond);
    }
    const wasDetected = this.detected;
    this.detected = this.watched && this.aiLevel > 0 && this.watchedFor >= this.detectDelay();
    if (this.detected && !wasDetected) {
      sim.recordTransition(this, 'SURVEILLANCE_DETECTED', `agitation ${this.agitation.toFixed(2)}`);
    }
    this.facingCamera = this.detected && this.agitation >= 4;
    if (this.state !== ENTITY_STATES.RETREATING) {
      if (this.detected) this.state = ENTITY_STATES.OBSERVING;
      else if (this.state === ENTITY_STATES.OBSERVING) this.updateStateFromRoom(sim);
    }
  }

  canMove(_sim) {
    if (this.detected && this.agitation < this.tuning.freezeAgitationLimit) {
      return { allowed: false, reason: 'UNDER_OBSERVATION' };
    }
    return { allowed: true, reason: null };
  }

  aiBonus(_sim) {
    return Math.floor(this.agitation / this.tuning.agitationPerAIBonus);
  }

  neglectAggressionBonus() {
    const t = this.tuning;
    const over = this.secondsSinceSeen - t.neglectGraceSeconds;
    if (over <= 0) return 0;
    return Math.min(t.neglectAggressionCap, over / t.neglectSecondsPerAggression);
  }

  effectiveAggression(_sim) {
    return BM.clampAttribute(this.attributes.aggression + this.neglectAggressionBonus());
  }

  updateStateFromRoom(sim) {
    super.updateStateFromRoom(sim);
    if (this.detected && this.state !== ENTITY_STATES.RETREATING && this.state !== ENTITY_STATES.INSIDE) {
      this.state = ENTITY_STATES.OBSERVING;
    }
  }

  debugModifiers(sim) {
    return {
      ...super.debugModifiers(sim),
      agitation: `${this.agitation.toFixed(2)} (+${this.aiBonus(sim)} AI)`,
      watched: this.watched,
      detected: this.detected,
      neglect: `${this.secondsSinceSeen.toFixed(1)}s (+${this.neglectAggressionBonus().toFixed(1)} AGG)`
    };
  }
}
