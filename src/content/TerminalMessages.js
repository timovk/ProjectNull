/**
 * Scheduled facility terminal messages (in-game hours). Gate releases and
 * other system events are pushed live from the simulation instead.
 */
export const TERMINAL_SCHEDULE = [
  { id: 'start', at: 0.0, text: 'DIAGNOSTIC CYCLE INITIATED. OPERATOR: CONTRACTOR-0417' },
  { id: 'feeds', at: 0.03, text: 'SURVEILLANCE RELAY: 12 FEEDS ONLINE' },
  { id: 'inactive', at: 1.6, text: 'NOTE: MOTION IN SECTORS MARKED INACTIVE' },
  { id: 'count', at: 3.0, text: 'OPERATOR COUNT: 2' },
  { id: 'progress', at: 3.8, text: 'DIAGNOSTIC 61%. SUBJECT RESPONSE NOMINAL' },
  { id: 'observe', at: 4.5, text: 'REMINDER: THE OPERATOR IS NOT UNDER OBSERVATION' },
  { id: 'remain', at: 5.2, text: 'DIAGNOSTIC 94%. PLEASE REMAIN AT YOUR STATION' }
];

export const GATE_MESSAGES = {
  CELL_A_LOCK: 'CONTAINMENT A: CELL LOCK RELEASED. AUTHORIZATION: NONE',
  CELL_B_LOCK: 'CONTAINMENT B: CELL LOCK RELEASED. AUTHORIZATION: NONE',
  ACOUSTIC_SEAL: 'ACOUSTICS LAB: SEAL DISENGAGED',
  ISOLATION_BULKHEAD: 'ISOLATION WARD: BULKHEAD RELEASED BY FACILITY AUTOMATION'
};

export const VICTORY_LINES = [
  'DIAGNOSTIC CYCLE COMPLETE.',
  'MONITORING INFRASTRUCTURE: RESTORED',
  'SUBJECTS ACCOUNTED FOR: 4 / 5',
  'OPERATOR STATUS: RETAINED FOR CYCLE 2'
];
