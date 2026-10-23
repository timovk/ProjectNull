import { Entity, ENTITY_STATES } from '../Entity.js';
import { STATION } from '../../config/FacilityLayout.js';
import * as BM from '../BehaviorModifiers.js';

/**
 * SUBJECT 01 - THE WANDERER
 *
 * Randomized weighted movement over the graph. Countered by corridor lighting.
 *
 *  Aggression   standard approach bias (x(1+2a) toward, x(1-0.5a) away).
 *  Awareness    light perception: deterrence = 0.40 + 0.60 * awareness/20.
 *               - Choosing to enter a lit corridor: blocked with that probability
 *                 (outcome BLOCKED, reason LIGHT_DETERRED).
 *               - Standing in a corridor when its light comes on: on the next
 *                 successful roll it flees to a room farther from the station
 *                 with that probability.
 *  Patience     blocked attempts (door or light) before it retreats 2 rooms.
 *  Intelligence informed decisions weight lit corridors x0.1 and use the
 *               live (door-aware) distance map.
 */
export class Wanderer extends Entity {
  deterrence() {
    return BM.lightDeterrence(this.attributes.awareness);
  }

  stimulusFactor(room, sim, info) {
    return info.informed && sim.security.isCorridorLit(room) ? 0.1 : 1;
  }

  decide(sim) {
    if (this.state !== ENTITY_STATES.RETREATING && sim.security.isCorridorLit(this.currentRoom)) {
      if (this.rng.chance(this.deterrence())) {
        const dist = sim.graph.distancesTo(STATION, this.id);
        const cur = BM.finiteDistance(dist.get(this.currentRoom));
        const away = sim.graph
          .edgesFor(this.currentRoom, this.id)
          .filter((e) => e.to !== STATION && BM.finiteDistance(dist.get(e.to)) > cur && !sim.security.isCorridorLit(e.to));
        if (away.length) {
          const to = away.length === 1 ? away[0].to : this.rng.pick(away).to;
          return { type: 'MOVE', to, reason: 'FLEEING_LIGHT' };
        }
      }
    }
    return super.decide(sim);
  }

  checkMovement(decision, edge, sim) {
    const status = super.checkMovement(decision, edge, sim);
    if (!status.passable) return status;
    if (decision.type === 'MOVE' && decision.reason !== 'FLEEING_LIGHT' && sim.security.isCorridorLit(decision.to)) {
      if (this.rng.chance(this.deterrence())) {
        sim.stats.lightDeterrals++;
        return { passable: false, reason: 'LIGHT_DETERRED' };
      }
    }
    return status;
  }

  debugModifiers(sim) {
    return {
      ...super.debugModifiers(sim),
      lightDeterrence: this.deterrence().toFixed(2),
      inLitCorridor: sim.security.isCorridorLit(this.currentRoom)
    };
  }
}
