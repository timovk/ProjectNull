import { ENTITY_DEFS, ENTITY_ORDER, ENTITY_IDS, AI_SCHEDULE } from '../config/GameConfig.js';
import { runMovementOpportunity } from './MovementOpportunity.js';
import { Wanderer } from './entities/Wanderer.js';
import { Observer } from './entities/Observer.js';
import { Echo } from './entities/Echo.js';
import { Patient } from './entities/Patient.js';

const CLASSES = {
  [ENTITY_IDS.WANDERER]: Wanderer,
  [ENTITY_IDS.OBSERVER]: Observer,
  [ENTITY_IDS.ECHO]: Echo,
  [ENTITY_IDS.PATIENT]: Patient
};

export function createEntity(def, rng) {
  const Cls = CLASSES[def.id];
  if (!Cls) throw new Error(`Unknown entity ${def.id}`);
  return new Cls(def, rng);
}

/**
 * Owns all entities and schedules their movement opportunities.
 *
 * Each entity has an independent timer in simulation time. Opportunities that
 * fall due within the same fixed step are resolved in a deterministic order:
 * by due time, then by ENTITY_ORDER, then scheduled before reactive.
 */
export class AIManager {
  constructor(sim, defs = ENTITY_DEFS, order = ENTITY_ORDER) {
    this.sim = sim;
    this.entities = order.map((id) => createEntity(defs[id], sim.rng.fork(`entity:${id}`)));
    this.byId = new Map(this.entities.map((e) => [e.id, e]));
    this._due = [];
  }

  get(id) {
    return this.byId.get(id);
  }

  applySchedule(hourIndex, schedule = AI_SCHEDULE) {
    for (const e of this.entities) {
      const levels = schedule[e.id];
      if (!levels || !levels.length) continue;
      const level = levels[Math.min(hourIndex, levels.length - 1)];
      const prev = e.aiLevel;
      const now = e.setAILevel(level);
      if (now !== prev) this.sim.recordSystem('AI_LEVEL', `${e.id} AI ${prev} -> ${now}`, { entityId: e.id, from: prev, to: now });
    }
  }

  setLevel(id, level) {
    const e = this.byId.get(id);
    if (!e) return;
    const prev = e.aiLevel;
    const now = e.setAILevel(level);
    if (now !== prev) this.sim.recordSystem('AI_LEVEL', `${e.id} AI ${prev} -> ${now} (override)`, { entityId: e.id, from: prev, to: now });
  }

  step(dt) {
    const sim = this.sim;
    const now = sim.time;
    const entities = this.entities;

    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      if (e.active) e.update(dt, sim);
    }

    const due = this._due;
    due.length = 0;
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      while (e.nextOpportunityAt <= now + 1e-9) {
        due.push({ time: e.nextOpportunityAt, order: i, kind: 'SCHEDULED', entity: e });
        // Multiply instead of accumulating so the schedule never drifts.
        e.scheduledCount++;
        e.nextOpportunityAt = e.movementInterval * (e.scheduledCount + 1);
      }
      if (e.bonusOpportunities.length) {
        const remaining = [];
        for (const t of e.bonusOpportunities) {
          if (t <= now + 1e-9) due.push({ time: t, order: i, kind: 'REACTIVE', entity: e });
          else remaining.push(t);
        }
        e.bonusOpportunities = remaining;
      }
    }
    if (due.length > 1) {
      due.sort((a, b) => a.time - b.time || a.order - b.order || (a.kind === b.kind ? 0 : a.kind === 'SCHEDULED' ? -1 : 1));
    }
    for (let i = 0; i < due.length; i++) {
      if (sim.phase !== 'RUNNING') break;
      const d = due[i];
      runMovementOpportunity(d.entity, sim, d.kind, d.time);
    }
  }
}
