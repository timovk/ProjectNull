import { STATION } from '../config/FacilityLayout.js';
import { GAME_CONFIG } from '../config/GameConfig.js';

/**
 * Every distinct result an opportunity can produce. The distinction between
 * a failed roll, a successful roll, an actual move and a blocked move is kept
 * explicit in every record.
 */
export const OUTCOMES = Object.freeze({
  INACTIVE: 'INACTIVE',
  SUPPRESSED: 'SUPPRESSED', // movement not permitted (checked before the roll)
  ROLL_FAILED: 'ROLL_FAILED',
  MOVED: 'MOVED',
  RETREATED: 'RETREATED',
  STAYED: 'STAYED', // roll succeeded, entity chose not to move
  BLOCKED: 'BLOCKED', // roll succeeded, chosen move prevented by a restriction
  INVALID_DESTINATION: 'INVALID_DESTINATION',
  STATE_TRANSITION: 'STATE_TRANSITION',
  ATTACK_BLOCKED: 'ATTACK_BLOCKED',
  ATTACK_SUCCESS: 'ATTACK_SUCCESS'
});

export function successProbability(aiLevel) {
  const ai = Math.max(GAME_CONFIG.aiMin, Math.min(GAME_CONFIG.aiMax, Math.floor(aiLevel)));
  return ai / 20;
}

/**
 * Baseline movement opportunity (spec 4.1): roll a d20, succeed if roll <= AI.
 * AI 0 can never succeed; AI 20 always succeeds.
 */
export function resolveMovementOpportunity(entity, rng) {
  const roll = rng.int(1, 20);
  const success = roll <= entity.aiLevel;
  return { entityId: entity.id, aiLevel: entity.aiLevel, roll, success };
}

/** Same roll against an arbitrary (effective) AI level. */
export function rollAgainst(aiLevel, rng) {
  const roll = rng.int(1, 20);
  return { roll, success: roll <= aiLevel };
}

/**
 * Full opportunity pipeline (spec 4.3):
 *  1. active?  2. movement permitted?  3. roll  4. compare to effective AI
 *  5. success?  6. choose destination  7. apply restrictions  8. update position
 *  9. environmental feedback (events)  10. record
 */
export function runMovementOpportunity(entity, sim, kind = 'SCHEDULED', dueTime = sim.time) {
  const rec = {
    type: 'OPPORTUNITY',
    time: dueTime,
    gameHours: sim.gameHoursAt(dueTime),
    entityId: entity.id,
    kind,
    aiLevel: entity.aiLevel,
    effectiveAI: null,
    roll: null,
    rollSuccess: false,
    outcome: null,
    from: entity.currentRoom,
    to: null,
    decision: null,
    reason: null,
    reaction: null,
    informed: false,
    state: entity.state
  };
  entity.stats.opportunities++;

  // 1. Active?
  if (!entity.active) {
    rec.outcome = OUTCOMES.INACTIVE;
    return finish(entity, sim, rec);
  }

  // 2. Movement permitted?
  const permission = entity.canMove(sim);
  if (!permission.allowed) {
    rec.outcome = OUTCOMES.SUPPRESSED;
    rec.reason = permission.reason;
    return finish(entity, sim, rec);
  }

  // 3-5. Roll against the effective AI level.
  rec.effectiveAI = entity.getEffectiveAI(sim);
  const { roll, success } = rollAgainst(rec.effectiveAI, entity.rng);
  rec.roll = roll;
  rec.rollSuccess = success;
  if (!success) {
    rec.outcome = OUTCOMES.ROLL_FAILED;
    return finish(entity, sim, rec);
  }
  entity.stats.rollSuccesses++;

  // 6. Choose a destination / action.
  const decision = entity.decide(sim);
  rec.decision = decision.type;
  rec.informed = !!decision.informed;
  if (decision.reason) rec.reason = decision.reason;

  switch (decision.type) {
    case 'STAY':
      rec.outcome = OUTCOMES.STAYED;
      break;

    case 'TRANSITION':
      rec.outcome = OUTCOMES.STATE_TRANSITION;
      rec.reaction = decision.transition ?? null;
      break;

    case 'MOVE':
    case 'RETREAT': {
      rec.to = decision.to;
      const edge = sim.graph.getEdge(entity.currentRoom, decision.to);
      // 7. Restrictions: the edge must exist, be allowed, and never be the station
      // (the station can only be entered through an ATTACK decision).
      if (!edge || !sim.graph.allowsEntity(edge, entity.id) || decision.to === STATION) {
        rec.outcome = OUTCOMES.INVALID_DESTINATION;
        rec.reason = edge ? 'RESTRICTED' : 'NOT_CONNECTED';
        break;
      }
      const status = entity.checkMovement(decision, edge, sim);
      if (!status.passable) {
        rec.outcome = OUTCOMES.BLOCKED;
        rec.reason = status.reason;
        entity.stats.blocked++;
        rec.reaction = entity.onMoveBlocked(sim, status.reason, decision) ?? null;
        break;
      }
      // 8. Update position.
      const from = entity.currentRoom;
      entity.moveTo(decision.to, sim);
      entity.stats.moves++;
      rec.outcome = decision.type === 'RETREAT' ? OUTCOMES.RETREATED : OUTCOMES.MOVED;
      // 9. Feedback.
      sim.onEntityMoved(entity, from, decision.to, rec);
      break;
    }

    case 'ATTACK': {
      rec.to = STATION;
      entity.stats.attackAttempts++;
      const entry = entity.checkEntry(decision.edge, sim);
      if (entry.allowed) {
        const from = entity.currentRoom;
        rec.outcome = OUTCOMES.ATTACK_SUCCESS;
        entity.moveTo(STATION, sim);
        sim.onBreach(entity, decision.edge, from);
      } else {
        rec.outcome = OUTCOMES.ATTACK_BLOCKED;
        rec.reason = entry.reason;
        entity.stats.blocked++;
        rec.reaction = entity.onEntryBlocked(sim, entry.reason, decision.edge) ?? null;
        sim.onEntryBlocked(entity, decision.edge, entry.reason, rec);
      }
      break;
    }

    default:
      rec.outcome = OUTCOMES.INVALID_DESTINATION;
      rec.reason = `UNKNOWN_DECISION_${decision.type}`;
  }

  return finish(entity, sim, rec);
}

function finish(entity, sim, rec) {
  rec.stateAfter = entity.state;
  entity.lastRoll = rec.roll;
  entity.lastResult = rec.outcome;
  entity.lastRecord = rec;
  // 10. Record.
  sim.log.push(rec);
  sim.bus.emit('ai:opportunity', rec);
  return rec;
}
