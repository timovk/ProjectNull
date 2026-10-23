import { ROOMS, EDGES, STATION } from '../config/FacilityLayout.js';

export const BLOCK_REASONS = Object.freeze({
  RESTRICTED: 'RESTRICTED',
  GATE_CLOSED: 'GATE_CLOSED',
  DOOR_CLOSED: 'DOOR_CLOSED',
  NO_EDGE: 'NO_EDGE'
});

/**
 * Explicit, directed room graph.
 *
 * Bidirectional connections are stored as two directed edges; one-way edges
 * as one. Restrictions (`only`/`excludes`) are static per entity. Doors and
 * gates are dynamic obstacles evaluated against a `world` object exposing
 * `isDoorClosed(doorId)` and `isGateOpen(gateId)`.
 */
export class MovementGraph {
  constructor(rooms = ROOMS, edges = EDGES) {
    this.rooms = new Map();
    this.out = new Map();
    this.in = new Map();
    this.undirected = new Map();
    this.edgeList = [];
    for (const [id, data] of Object.entries(rooms)) {
      this.rooms.set(id, Object.freeze({ id, ...data }));
      this.out.set(id, []);
      this.in.set(id, []);
      this.undirected.set(id, new Set());
    }
    for (const def of edges) {
      if (!this.rooms.has(def.a) || !this.rooms.has(def.b)) {
        throw new Error(`MovementGraph: edge references unknown room ${def.a} -> ${def.b}`);
      }
      if (def.a === def.b) throw new Error(`MovementGraph: self-loop on ${def.a}`);
      this._add(def.a, def.b, def);
      if (!def.oneWay) this._add(def.b, def.a, def);
      this.undirected.get(def.a).add(def.b);
      this.undirected.get(def.b).add(def.a);
    }
    this._staticDistances = new Map();
    this._soundDistances = new Map();
  }

  _add(from, to, def) {
    if (this.out.get(from).some((e) => e.to === to)) {
      throw new Error(`MovementGraph: duplicate edge ${from} -> ${to}`);
    }
    const edge = Object.freeze({
      from,
      to,
      door: def.door ?? null,
      gate: def.gate ?? null,
      only: def.only ? Object.freeze([...def.only]) : null,
      excludes: def.excludes ? Object.freeze([...def.excludes]) : null,
      oneWay: !!def.oneWay,
      vent: !!def.vent,
      weight: def.weight ?? 1
    });
    this.out.get(from).push(edge);
    this.in.get(to).push(edge);
    this.edgeList.push(edge);
  }

  hasRoom(id) {
    return this.rooms.has(id);
  }

  getRoom(id) {
    return this.rooms.get(id);
  }

  get roomIds() {
    return [...this.rooms.keys()];
  }

  getEdge(from, to) {
    const list = this.out.get(from);
    if (!list) return null;
    for (const e of list) if (e.to === to) return e;
    return null;
  }

  allowsEntity(edge, entityId) {
    if (edge.only && !edge.only.includes(entityId)) return false;
    if (edge.excludes && edge.excludes.includes(entityId)) return false;
    return true;
  }

  /** Outgoing edges the entity may ever use from `from` (static restrictions only). */
  edgesFor(from, entityId) {
    const list = this.out.get(from) ?? [];
    return list.filter((e) => this.allowsEntity(e, entityId));
  }

  neighborsFor(from, entityId) {
    return this.edgesFor(from, entityId).map((e) => e.to);
  }

  /** Static + dynamic passability of one directed edge. */
  edgeStatus(edge, entityId, world) {
    if (!edge) return { passable: false, reason: BLOCK_REASONS.NO_EDGE };
    if (!this.allowsEntity(edge, entityId)) return { passable: false, reason: BLOCK_REASONS.RESTRICTED };
    if (world) {
      if (edge.gate && !world.isGateOpen(edge.gate)) return { passable: false, reason: BLOCK_REASONS.GATE_CLOSED };
      if (edge.door && world.isDoorClosed(edge.door)) return { passable: false, reason: BLOCK_REASONS.DOOR_CLOSED };
    }
    return { passable: true, reason: null };
  }

  /**
   * Hop distance from every room to `target` for this entity.
   * Without `world` the result is static (cached); with `world`, closed doors
   * and gates are treated as missing edges ("informed" view).
   */
  distancesTo(target, entityId, world = null) {
    const key = `${target}|${entityId}`;
    if (!world && this._staticDistances.has(key)) return this._staticDistances.get(key);
    const dist = new Map();
    for (const id of this.rooms.keys()) dist.set(id, Infinity);
    dist.set(target, 0);
    const queue = [target];
    for (let qi = 0; qi < queue.length; qi++) {
      const cur = queue[qi];
      for (const edge of this.in.get(cur)) {
        if (!this.allowsEntity(edge, entityId)) continue;
        if (world && !this.edgeStatus(edge, entityId, world).passable) continue;
        if (dist.get(edge.from) === Infinity) {
          dist.set(edge.from, dist.get(cur) + 1);
          queue.push(edge.from);
        }
      }
    }
    if (!world) this._staticDistances.set(key, dist);
    return dist;
  }

  /** Undirected hop distances used for sound propagation (sound ignores restrictions). */
  soundDistancesFrom(source) {
    if (this._soundDistances.has(source)) return this._soundDistances.get(source);
    const dist = new Map([[source, 0]]);
    const queue = [source];
    for (let qi = 0; qi < queue.length; qi++) {
      const cur = queue[qi];
      for (const n of this.undirected.get(cur)) {
        if (!dist.has(n)) {
          dist.set(n, dist.get(cur) + 1);
          queue.push(n);
        }
      }
    }
    this._soundDistances.set(source, dist);
    return dist;
  }

  /** Shortest directed path (inclusive of both ends) or null. */
  shortestPath(from, to, entityId, world = null) {
    if (from === to) return [from];
    const prev = new Map([[from, null]]);
    const queue = [from];
    for (let qi = 0; qi < queue.length; qi++) {
      const cur = queue[qi];
      for (const edge of this.out.get(cur)) {
        if (prev.has(edge.to)) continue;
        if (world ? !this.edgeStatus(edge, entityId, world).passable : !this.allowsEntity(edge, entityId)) continue;
        prev.set(edge.to, cur);
        if (edge.to === to) {
          const path = [to];
          let p = cur;
          while (p !== null) {
            path.unshift(p);
            p = prev.get(p);
          }
          return path;
        }
        queue.push(edge.to);
      }
    }
    return null;
  }

  /** Structural validation. Returns a list of human-readable problems. */
  validate(entityIds = [], homes = {}) {
    const problems = [];
    if (!this.rooms.has(STATION)) problems.push(`Missing ${STATION}`);
    for (const id of this.rooms.keys()) {
      if (id !== STATION && this.out.get(id).length === 0) problems.push(`${id} has no exits`);
    }
    for (const entityId of entityIds) {
      const home = homes[entityId];
      if (home && !this.rooms.has(home)) problems.push(`${entityId} home ${home} missing`);
      if (home && this.distancesTo(STATION, entityId).get(home) === Infinity) {
        problems.push(`${entityId} cannot reach ${STATION} from ${home}`);
      }
    }
    return problems;
  }
}
