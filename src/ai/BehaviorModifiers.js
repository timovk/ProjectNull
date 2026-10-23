/**
 * Behavioral attribute formulas.
 *
 * The AI level is the ONLY input to the movement-opportunity roll
 * (P = effectiveAI / 20). The four attributes never replace that roll; each
 * one modifies exactly one kind of decision made around it:
 *
 *  AGGRESSION   WHERE it wants to go.   Multiplies route weights toward/away
 *                                       from the security station.
 *  AWARENESS    WHAT it can sense.      Strength of the entity's own stimulus
 *                                       (light, surveillance, noise, doors).
 *  PATIENCE     HOW LONG it tolerates   Blocked attempts before its behavior
 *               obstacles.              changes (retreat, or force a door).
 *  INTELLIGENCE HOW WELL it routes.     Chance that a route decision uses the
 *                                       live, defended map instead of the
 *                                       static one.
 *
 * Every function is pure and covered by tests/ai.test.js.
 */

export const ATTRIBUTE_MIN = 0;
export const ATTRIBUTE_MAX = 20;

export function clampAttribute(value) {
  if (!Number.isFinite(value)) return ATTRIBUTE_MIN;
  return Math.max(ATTRIBUTE_MIN, Math.min(ATTRIBUTE_MAX, value));
}

export function normalized(value) {
  return clampAttribute(value) / ATTRIBUTE_MAX;
}

/**
 * AGGRESSION. `deltaDistance` = (neighbor distance to station) - (current distance).
 *   closer  (delta < 0): weight x (1 + 2a)    -> up to x3.0
 *   farther (delta > 0): weight x (1 - 0.5a)  -> down to x0.5, never zero,
 *                                                so retreat moves stay possible
 *   level   (delta = 0): weight x 1
 * where a = aggression / 20.
 */
export function approachFactor(aggression, deltaDistance) {
  const a = normalized(aggression);
  if (deltaDistance < 0) return 1 + 2 * a;
  if (deltaDistance > 0) return 1 - 0.5 * a;
  return 1;
}

/** AWARENESS as a 0..1 perception strength. */
export function perception(awareness) {
  return normalized(awareness);
}

/** Wanderer: probability that an illuminated corridor deters it. 0.40 .. 1.00 */
export function lightDeterrence(awareness) {
  return 0.4 + 0.6 * perception(awareness);
}

/** Echo: how many rooms away a noise can be heard. 2 .. 6 hops */
export function hearingRange(awareness) {
  return 2 + Math.floor(clampAttribute(awareness) / 5);
}

/** PATIENCE: blocked attempts tolerated before the behavior changes. 1 .. 6 */
export function obstacleTolerance(patience) {
  return 1 + Math.floor(clampAttribute(patience) / 4);
}

/** INTELLIGENCE: chance a route decision is "informed" (defense-aware). 0 .. 1 */
export function informedChance(intelligence) {
  return normalized(intelligence);
}

/** Weight multiplier an informed entity applies to a currently impassable edge. */
export const INFORMED_BLOCKED_WEIGHT = 0.05;

/** Converts an Infinity hop distance into a large finite number for arithmetic. */
export function finiteDistance(d) {
  return d === Infinity || d === undefined ? 99 : d;
}

export const ATTRIBUTE_EFFECTS = Object.freeze({
  aggression: 'Route weight toward the station x(1+2a); away x(1-0.5a)',
  awareness: 'Perception of its stimulus (light / surveillance / noise / doors)',
  patience: 'Blocked attempts tolerated = 1 + floor(patience/4)',
  intelligence: 'P(informed routing) = intelligence/20'
});
