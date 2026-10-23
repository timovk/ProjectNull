/**
 * Central, data-only configuration for PROJECT NULL.
 *
 * Everything that affects balance lives here so it can be tuned without
 * touching simulation code. Nothing in this file may import Three.js or the
 * DOM: the simulation (and therefore the automated tests) depends on it.
 */

export const GAME_CONFIG = {
  nightDurationSeconds: 660,
  startHour: 0,
  endHour: 6,
  aiMin: 0,
  aiMax: 20,
  initialNight: 1
};

/** Fixed simulation timestep in seconds. The AI never runs at render rate. */
export const FIXED_TIMESTEP = 1 / 60;

/**
 * Frame-to-simulation catch-up safeguards.
 * - maxStepsPerFrame: upper bound of fixed steps processed in a single frame.
 * - maxBacklogSeconds: real time beyond this is not queued. Simulation events
 *   are scheduled in simulation time, so a clamped backlog only slows the
 *   simulation relative to the wall clock; it never skips an opportunity.
 */
export const CLOCK_CONFIG = {
  maxStepsPerFrame: 240,
  maxBacklogSeconds: 2.0
};

export const ENTITY_IDS = Object.freeze({
  WANDERER: 'SUBJECT_01',
  OBSERVER: 'SUBJECT_02',
  ECHO: 'SUBJECT_03',
  PATIENT: 'SUBJECT_04'
});

/** Deterministic processing order for simultaneous opportunities. */
export const ENTITY_ORDER = Object.freeze([
  ENTITY_IDS.WANDERER,
  ENTITY_IDS.OBSERVER,
  ENTITY_IDS.ECHO,
  ENTITY_IDS.PATIENT
]);

/**
 * AI level per in-game hour (index 0 = 12 AM ... index 5 = 5 AM).
 * Values are clamped to [aiMin, aiMax] when applied.
 */
export const AI_SCHEDULE = {
  [ENTITY_IDS.WANDERER]: [3, 3, 4, 5, 6, 7],
  [ENTITY_IDS.OBSERVER]: [2, 2, 3, 4, 5, 6],
  [ENTITY_IDS.ECHO]: [1, 1, 2, 3, 4, 5],
  [ENTITY_IDS.PATIENT]: [0, 0, 0, 1, 2, 3]
};

/**
 * Guided practice night: gentler levels, but every subject (including the
 * Patient, from 1 AM) shows up so each lesson can trigger.
 */
export const PRACTICE_SCHEDULE = {
  [ENTITY_IDS.WANDERER]: [3, 3, 3, 4, 4, 5],
  [ENTITY_IDS.OBSERVER]: [2, 2, 2, 3, 3, 4],
  [ENTITY_IDS.ECHO]: [1, 2, 2, 2, 3, 3],
  [ENTITY_IDS.PATIENT]: [0, 2, 2, 3, 3, 3]
};

/**
 * Entity definitions. `attributes` are all on the 0..20 scale. Their exact
 * mechanical effects are documented in src/ai/BehaviorModifiers.js and in the
 * README ("AI attributes").
 */
export const ENTITY_DEFS = {
  [ENTITY_IDS.WANDERER]: {
    id: ENTITY_IDS.WANDERER,
    designation: 'SUBJECT 01',
    name: 'THE WANDERER',
    movementInterval: 5.0,
    homeRoom: 'CONTAINMENT_A',
    attributes: { aggression: 10, awareness: 10, patience: 6, intelligence: 5 },
    retreatSteps: 2
  },
  [ENTITY_IDS.OBSERVER]: {
    id: ENTITY_IDS.OBSERVER,
    designation: 'SUBJECT 02',
    name: 'THE OBSERVER',
    movementInterval: 6.5,
    homeRoom: 'CONTAINMENT_B',
    attributes: { aggression: 6, awareness: 12, patience: 10, intelligence: 10 },
    retreatSteps: 2,
    tuning: {
      agitationCap: 10,
      agitationGainPerSecond: 0.45, // multiplied by (0.25 + 0.75 * perception)
      agitationDecayPerSecond: 0.12,
      freezeAgitationLimit: 8, // at or above this, being watched no longer freezes it
      agitationPerAIBonus: 2.5, // +1 effective AI per 2.5 agitation (max +4)
      detectBaseSeconds: 2.5, // continuous watching needed to notice = base - span * perception
      detectSpanSeconds: 2.0,
      neglectGraceSeconds: 60,
      neglectSecondsPerAggression: 10,
      neglectAggressionCap: 8
    }
  },
  [ENTITY_IDS.ECHO]: {
    id: ENTITY_IDS.ECHO,
    designation: 'SUBJECT 03',
    name: 'THE ECHO',
    movementInterval: 4.2,
    homeRoom: 'ACOUSTICS_LAB',
    attributes: { aggression: 4, awareness: 14, patience: 8, intelligence: 6 },
    retreatSteps: 2,
    tuning: {
      noiseWeightScale: 4.0,
      noiseWeightFloor: 0.3,
      decoyDiscountWhenInformed: 0.35,
      falloffBase: 0.30, // per-hop noise retention = base + span * perception
      falloffSpan: 0.35,
      listenThresholdBase: 0.50, // station noise needed to enter = base - span * perception
      listenThresholdSpan: 0.30
    }
  },
  [ENTITY_IDS.PATIENT]: {
    id: ENTITY_IDS.PATIENT,
    designation: 'SUBJECT 04',
    name: 'THE PATIENT',
    movementInterval: 8.0,
    homeRoom: 'ISOLATION',
    attributes: { aggression: 16, awareness: 10, patience: 16, intelligence: 6 },
    retreatSteps: 0, // full retreat to its home room
    tuning: {
      awayPreference: 0.25, // extra multiplier on routes leading away
      resolveSecondsPerAI: 20, // +1 effective AI per 20 s waiting at a threshold
      barrierBaseSeconds: 10, // exposure needed = base + perPatience * patience
      barrierSecondsPerPatience: 0.75,
      barrierExposureDecay: 0.5, // exposure lost per second while the barrier is off
      reactionBaseSeconds: 1.0, // door-open reaction delay = base + span * (1 - perception)
      reactionSpanSeconds: 5.0
    }
  }
};

/** While retreating, an entity's effective AI is at least this value. */
export const RETREAT_AI_FLOOR = 10;
/** During a power failure, every entity gains this much effective AI. */
export const BLACKOUT_AI_BONUS = 2;

/** Power drain in percent per second. Starting charge is 100. */
export const POWER_CONFIG = {
  initial: 100,
  drain: {
    facilityBase: 0.026,
    stationLightsNormal: 0.010,
    stationLightsLow: 0.003,
    workstationRack: 0.015,
    cameraViewing: 0.020,
    ventilationFan: 0.008,
    radio: 0.002,
    doorClosed: 0.110,
    corridorLight: 0.055,
    barrier: 0.300
  },
  pingCost: 1.5,
  relayResetCost: 0.5,
  auxCellCharge: 15
};

/** Acoustic model. Station noise is a unitless 0..~1.5 signal. */
export const NOISE_CONFIG = {
  station: {
    base: 0.04,
    stationLightsNormal: 0.03,
    stationLightsLow: 0.01,
    workstationRack: 0.10,
    cameraViewing: 0.02,
    ventilationFan: 0.18,
    radio: 0.06,
    doorClosedHum: 0.03,
    barrier: 0.28,
    playerWalking: 0.05,
    playerWorking: 0.20,
    doorPulse: 0.35,
    doorPulseTau: 1.5,
    auxCellPulse: 0.30,
    auxCellPulseTau: 4.0
  },
  remote: {
    corridorLight: 0.15,
    ping: 0.6,
    pingDuration: 18,
    deconCycle: 0.2
  }
};

export const SURVEILLANCE_CONFIG = {
  defaultCamera: 'CENTRAL_JUNCTION',
  thermalRiseViewing: 1 / 80, // per second, fan off, cameras in use
  thermalRiseIdle: 1 / 140, // per second, fan off, rack on but not viewing
  thermalCool: 1 / 25, // per second, fan on
  thermalCoolRackOff: 1 / 15,
  thermalShutdownSeconds: 12,
  thermalAfterShutdown: 0.55,
  disruptionSeconds: 1.6,
  pingCooldown: 25
};

export const FACILITY_EVENT_CONFIG = {
  deconIntervalMin: 75,
  deconIntervalMax: 110,
  deconClosedSeconds: 12,
  cameraFaultStart: 55, // simulation seconds before the first fault may occur
  cameraFaultIntervalMin: 55,
  cameraFaultIntervalMax: 95,
  cameraFaultDurationMin: 18,
  cameraFaultDurationMax: 32
};

export const DEFAULT_SEED = 'N-17';
