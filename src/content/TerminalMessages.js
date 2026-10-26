/**
 * Scheduled facility terminal messages (in-game hours), per night. Gate
 * releases and other system events are pushed live from the simulation.
 * Each night adds a little to the mystery of cell 05 without explaining it.
 */
const NIGHT_MESSAGES = {
  1: [
    { id: 'start', at: 0.0, text: 'DIAGNOSTIC CYCLE INITIATED. OPERATOR: CONTRACTOR-0417' },
    { id: 'feeds', at: 0.03, text: 'SURVEILLANCE RELAY: 12 FEEDS ONLINE' },
    { id: 'inactive', at: 1.6, text: 'NOTE: MOTION IN SECTORS MARKED INACTIVE' },
    { id: 'count', at: 3.0, text: 'OPERATOR COUNT: 2' },
    { id: 'progress', at: 3.8, text: 'DIAGNOSTIC 61%. SUBJECT RESPONSE NOMINAL' },
    { id: 'observe', at: 4.5, text: 'REMINDER: THE OPERATOR IS NOT UNDER OBSERVATION' },
    { id: 'remain', at: 5.2, text: 'DIAGNOSTIC 94%. PLEASE REMAIN AT YOUR STATION' }
  ],
  2: [
    { id: 'start', at: 0.0, text: 'DIAGNOSTIC CYCLE 2 INITIATED. OPERATOR: CONTRACTOR-0417 (RETAINED)' },
    { id: 'seal', at: 1.2, text: 'CELL 05 SEAL INTEGRITY: 98%' },
    { id: 'count', at: 3.0, text: 'OPERATOR COUNT: 2' },
    { id: 'fatigue', at: 4.6, text: 'NOTE: OPERATOR FATIGUE DETECTED. CONTINUE' }
  ],
  3: [
    { id: 'start', at: 0.0, text: 'DIAGNOSTIC CYCLE 3 INITIATED. OPERATOR: CONTRACTOR-0417' },
    { id: 'request', at: 0.8, text: 'REQUEST FROM SUBLEVEL B: OPEN' },
    { id: 'denied', at: 2.4, text: 'REQUEST DENIED. REQUEST REPEATED' },
    { id: 'origin', at: 2.5, text: 'REQUEST ORIGIN: CONTRACTOR-0317. CONTRACT CLOSED IN MARCH' },
    { id: 'seal', at: 4.0, text: 'CELL 05 SEAL INTEGRITY: 71%' }
  ],
  4: [
    { id: 'start', at: 0.0, text: 'DIAGNOSTIC CYCLE 4 INITIATED. OPERATOR: CONTRACTOR-0417' },
    { id: 'baseline', at: 1.0, text: 'SUBJECT RESPONSE ABOVE BASELINE' },
    { id: 'seal', at: 2.5, text: 'CELL 05 SEAL INTEGRITY: 40%' },
    { id: 'count', at: 4.2, text: 'OPERATOR COUNT: 3' }
  ],
  5: [
    { id: 'start', at: 0.0, text: 'FINAL DIAGNOSTIC CYCLE INITIATED. OPERATOR: CONTRACTOR-0417' },
    { id: 'seal', at: 1.5, text: 'CELL 05 SEAL INTEGRITY: 12%' },
    { id: 'accounted', at: 3.0, text: 'ALL SUBJECTS ACCOUNTED FOR EXCEPT ONE' },
    { id: 'almost', at: 5.2, text: 'PLEASE REMAIN AT YOUR STATION. WE ARE ALMOST DONE' }
  ]
};

export function terminalSchedule(night = 1) {
  return NIGHT_MESSAGES[night] ?? NIGHT_MESSAGES[1];
}

/** Night 1 schedule (kept for existing imports). */
export const TERMINAL_SCHEDULE = NIGHT_MESSAGES[1];

export const GATE_MESSAGES = {
  CELL_A_LOCK: 'CONTAINMENT A: CELL LOCK RELEASED. AUTHORIZATION: NONE',
  CELL_B_LOCK: 'CONTAINMENT B: CELL LOCK RELEASED. AUTHORIZATION: NONE',
  ACOUSTIC_SEAL: 'ACOUSTICS LAB: SEAL DISENGAGED',
  ISOLATION_BULKHEAD: 'ISOLATION WARD: BULKHEAD RELEASED BY FACILITY AUTOMATION'
};

/** Morning lines shown at 6 AM. The last night ends differently. */
export function victoryLines(night = 1) {
  if (night >= 5) {
    return [
      'DIAGNOSTIC SERIES COMPLETE.',
      'SUBJECTS ACCOUNTED FOR: 5 / 5',
      'OPERATOR STATUS: CONTAINED',
      'THANK YOU FOR YOUR PARTICIPATION'
    ];
  }
  return [
    `DIAGNOSTIC CYCLE ${night} COMPLETE.`,
    'MONITORING INFRASTRUCTURE: RESTORED',
    'SUBJECTS ACCOUNTED FOR: 4 / 5',
    `OPERATOR STATUS: RETAINED FOR CYCLE ${night + 1}`
  ];
}

/** Night 1 lines (kept for existing imports). */
export const VICTORY_LINES = victoryLines(1);
