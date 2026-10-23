/**
 * In-world documents. They teach every mechanic diegetically and leave the
 * larger questions (what happened at N-17, the fifth subject) unanswered.
 */
export const DOCUMENTS = {
  shift_assignment: {
    title: 'WORK ORDER 4471-N17',
    kind: 'form',
    body: [
      'HELIX RESEARCH DIRECTORATE / FACILITIES CONTRACTING',
      '',
      'TO: Contract Systems Technician (ref. CONTRACTOR-0417)',
      'SITE: Research Facility N-17, Level 2, Security Station',
      'WINDOW: 00:00 - 06:00',
      '',
      'Your assignment is to supervise the automated Diagnostic Cycle that reactivates the monitoring infrastructure. Remain in or near the Security Station for the full window. The cycle completes on its own at 06:00.',
      '',
      'STATION SYSTEMS',
      '- Surveillance workstation (centre of desk): 12 camera feeds, acoustic diagnostic ping.',
      '- Facility terminal (left screen) and acoustic monitor (right screen).',
      '- Security doors: operated ONLY from the panel beside each door. The lower button on each panel controls that wing\'s corridor lighting.',
      '- Containment field console (south wall).',
      '- Ventilation switch (north-east wall, under the fan).',
      '- Emergency power panel (south-west wall): main cell level, station lighting mode.',
      '- Signal relay panel (south wall): restores dropped camera feeds.',
      '- Electrical room (rear door, maintenance corridor): door motor breakers, auxiliary cell.',
      '',
      'POWER is limited to the main cell. Every active system draws from it. A depleted cell does not reset until morning.',
      '',
      'The facility is unoccupied. Movement on camera should be logged as a sensor artifact.'
    ]
  },
  note_monitor: {
    title: 'Handwritten note, taped above the desk',
    kind: 'note',
    body: [
      'For whoever gets this shift next -',
      '',
      'The tall one wanders. No pattern, don\'t look for one. When it\'s in one of the corridors (cam 08 / 09), hit that side\'s corridor light. It hates being lit. It usually turns back.',
      '',
      'If it\'s already outside a door: shut the door. Watch the little window. Open it again once it wanders off, the doors drink power.',
      '',
      'Lights cost too. Don\'t leave them on for nothing.',
      '',
      '- R.'
    ]
  },
  memo_observer: {
    title: 'INTERNAL MEMO - RE: SUBJECT 02',
    kind: 'memo',
    body: [
      'CLASSIFICATION: OPERATORS ONLY',
      '',
      'Subject 02 demonstrates awareness of active surveillance.',
      '',
      'While it is watched, S-02 holds position. This is not compliance. Prolonged observation correlates with agitation, and an agitated S-02 relocates rapidly once observation ends. Past a certain point it stops holding still at all.',
      '',
      'Operators who stopped checking on S-02 entirely reported finding it "closer than expected".',
      '',
      'Recommended practice: check briefly. Look away. Check again.',
      '',
      'Do not engage in extended visual contact. Do not attempt to interpret its posture.'
    ]
  },
  maintenance_log: {
    title: 'MAINTENANCE LOG - ELECTRICAL',
    kind: 'log',
    body: [
      '03/11  W door motor forced again. Breaker panel on the east wall in here. Hold the reset until the lamp goes green. Door stays open until you do.',
      '',
      '03/14  Aux cell 3 is the last one. Single discharge, about 15%. It can bring the main cell back from empty. Don\'t waste it.',
      '',
      '03/15  Ran the S-03 drill. Vent fan off the whole time. The station got hot enough that the camera rack shut itself down. Fan back on as soon as it\'s gone.',
      '',
      '03/15  Acoustic monitor (right screen on the desk). The red line is roughly where 03 starts coming down through the duct. Doors are LOUD when they move. The field is louder.',
      '',
      '03/16  Diagnostic ping from the workstation pulls 03 toward whatever room you ping. Works less on it every time. I think it knows.',
      '',
      '03/17  Signal relay keeps dropping feeds. South wall panel, hold the reset.'
    ]
  },
  incident_17c: {
    title: 'INCIDENT REPORT 17-C (PARTIAL)',
    kind: 'report',
    body: [
      'SITE: N-17     CLASSIFICATION: CONTAINED (PROVISIONAL)',
      '',
      '03:12 - All five cell locks released simultaneously. No operator input logged.',
      '03:14 - Subjects 01-04 observed outside containment.',
      '03:15 - Subject 05: no visual. Cell 05 found sealed from the inside.',
      '03:40 - Sublevel B access revoked by facility automation.',
      '06:00 - Personnel accounted for: 0 of 11.',
      '',
      'Recommendation: reactivate monitoring via contractor. Do not brief the contractor on this report.',
      '',
      'Addendum: Subject 05 designation retracted. Refer all queries to [REDACTED].'
    ]
  },
  barrier_notice: {
    title: 'CONTAINMENT FIELD - CALIBRATION NOTICE',
    kind: 'notice',
    body: [
      'The Security Station containment field is calibrated to the biometric signature of SUBJECT 04 only. It has no effect on any other subject.',
      '',
      'A closed door will NOT stop S-04. It will press on the door until the motor fails.',
      '',
      'When S-04 is at a door, engage the field and HOLD it until the subject withdraws (approximately 20 seconds). Releasing early resets most of the progress.',
      '',
      'Power draw is heavy (approx. 9% per minute). The field is audible.'
    ]
  },
  sublevel_note: {
    title: 'Scrawled on a strip of tape',
    kind: 'note',
    body: ['DON\'T OPEN IT.', '', 'Whatever you hear down there.', '', 'It isn\'t the fifth one. It isn\'t anyone.']
  }
};

/** Audio log in the electrical room: played as a transcript over tape hiss. */
export const TAPE_TRANSCRIPT = [
  { at: 0.5, text: 'TAPE: "Log... six? Seven. I\'ve stopped counting the nights."' },
  { at: 5.5, text: 'TAPE: "They call it a diagnostic. I think the diagnostic is us."' },
  { at: 11, text: 'TAPE: "They don\'t move when you look away. They move when the numbers say so."' },
  { at: 17, text: 'TAPE: "One in twenty, early on. By five it\'s seven in twenty. I wrote it on the board."' },
  { at: 23, text: 'TAPE: "If you\'re hearing this, you\'re the new contractor. Keep the doors shut and your voice down."' },
  { at: 29.5, text: 'TAPE: "And count them. Every hour. Count them. There should be five."' },
  { at: 35, text: '[The tape runs out]' }
];
