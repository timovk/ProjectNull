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
  },

  // ---- Found from Night 2 onward (see NIGHT_ITEMS).
  r_whiteboard: {
    title: 'Photo of a whiteboard, pinned to the wall',
    kind: 'note',
    body: [
      'MIDNIGHT  1/20   (tall one 3/20)',
      '5 AM      7/20',
      '',
      'THEY DON\'T HUNT. THEY\'RE PULLED.',
      '',
      'PULLED TO WHAT?',
      '',
      'count = 5.  we are the 5th place?',
      '',
      '- R.'
    ]
  },
  staff_roster: {
    title: 'N-17 STAFF ROSTER (REV. 11/97)',
    kind: 'form',
    body: [
      'HELIX RESEARCH DIRECTORATE / N-17 LEVEL 1 PERSONNEL',
      '',
      '[NAME WITHHELD]  -  Security (Night)  -  REASSIGNED: S-01',
      '[NAME WITHHELD]  -  Surveillance Analysis  -  REASSIGNED: S-02',
      '[NAME WITHHELD]  -  Acoustics  -  REASSIGNED: S-03',
      '[NAME WITHHELD]  -  Resident (Isolation)  -  TRIAL COMPLETE: S-04',
      'VARGA, I.  -  Systems / Project Lead  -  CANDIDATE',
      '',
      'Ten further entries, each stamped 03/03/98: UNACCOUNTED.',
      '',
      'Handwritten across the bottom: "They didn\'t bring the subjects here. They made them here. - R."'
    ]
  },
  vell_memo: {
    title: 'MEMO - OPERATOR CONDITIONING, N-17',
    kind: 'memo',
    body: [
      'FROM: OFFICE OF THE DIRECTOR',
      'CLASSIFICATION: PROJECT NULL',
      '',
      'The fifth anchor cannot be selected. It must be trained.',
      '',
      'WARDEN will present the candidate with a sequence of cycles in which survival requires correct procedure and nothing else. By the fifth cycle, procedure will be all that remains.',
      '',
      'The candidate is not to be informed. Informed candidates deviate.',
      '',
      '- M. Vell'
    ]
  },
  work_order_05: {
    title: 'WORK ORDER 4471-N17 (SECOND COPY)',
    kind: 'form',
    body: [
      'HELIX RESEARCH DIRECTORATE / FACILITIES CONTRACTING',
      '',
      'TO: Contract Systems Technician (ref. CONTRACTOR-0417)',
      'SITE: Research Facility N-17, Level 2, Security Station',
      'WINDOW: 00:00 - 06:00',
      '',
      'Remain in or near the Security Station for the full window. The cycle completes on its own at 06:00.',
      '',
      'CANDIDATE DESIGNATION: 05',
      '',
      'Handwritten in the margin, in R.\'s writing:',
      '"It only wants perfect. Don\'t give it perfect. After five, go to the B door and put your hand on it. Then get back to the desk and live till six."'
    ]
  }
};

/**
 * Where and from which night the newer documents and tapes appear. Only real
 * campaign nights show them; practice and Custom Night keep the original set.
 */
export const NIGHT_ITEMS = {
  r_whiteboard: 2,
  staff_roster: 3,
  vell_memo: 4,
  log_nine: 4,
  work_order_05: 5,
  cycle_four: 5
};

/**
 * Audio logs, played as a transcript over tape hiss. Lines in quotes are
 * spoken (see VoiceLines.js); bracketed lines are stage directions.
 */
export const TAPES = {
  log_six: {
    prompt: '[E] Play audio log',
    speaker: 'TAPE',
    lines: [
      { at: 0.5, text: 'TAPE: "Log... six? Seven. I\'ve stopped counting the nights."' },
      { at: 5.5, text: 'TAPE: "They call it a diagnostic. I think the diagnostic is us."' },
      { at: 11, text: 'TAPE: "They don\'t move when you look away. They move when the numbers say so."' },
      { at: 17, text: 'TAPE: "One in twenty, early on. By five it\'s seven in twenty. I wrote it on the board."' },
      { at: 23, text: 'TAPE: "If you\'re hearing this, you\'re the new contractor. Keep the doors shut and your voice down."' },
      { at: 29.5, text: 'TAPE: "And count them. Every hour. Count them. There should be five."' },
      { at: 35, text: '[The tape runs out]' }
    ]
  },
  log_nine: {
    prompt: '[E] Play new recording (telemetry recorder)',
    speaker: 'TAPE',
    lines: [
      { at: 0.5, text: '[A line from Sublevel B, recorded onto the old pump-telemetry reel]' },
      { at: 4, text: 'TAPE: "Log nine. If that\'s what this is. I\'m below. The machine room still has power."' },
      { at: 10.5, text: 'TAPE: "I found her. Varga. She\'s been down here since March. She\'s... mostly still her."' },
      { at: 17.5, text: 'TAPE: "She wrote it. WARDEN. Every rule you\'re following up there, she wrote."' },
      { at: 24, text: 'TAPE: "Five perfect nights and you\'re the fifth. That\'s what it\'s for. That\'s what the seal is counting."' },
      { at: 31.5, text: 'TAPE: "That request on your terminal last night, from Sublevel B? That was me, asking the door to open. It said no."' },
      { at: 38.5, text: 'TAPE: "I\'ll tell you how to break it. Not on the radio. It listens to the radio."' },
      { at: 44.5, text: '[The reel runs out]' }
    ]
  },
  cycle_four: {
    prompt: '[E] Play cassette marked "I.V. - CYCLE 4"',
    speaker: 'VARGA',
    lines: [
      { at: 0.5, text: 'VARGA: "Cycle four. Ines Varga, operator candidate."' },
      { at: 5, text: 'VARGA: "Four nights without a mistake. WARDEN is very pleased with me."' },
      { at: 10.5, text: 'VARGA: "I wrote every rule in this station. Tomorrow I become them."' },
      { at: 16.5, text: 'VARGA: "The guard still walks his rounds. The analyst still watches. They are still in there, somewhere."' },
      { at: 24, text: 'VARGA: "If I finish tomorrow, nobody will ever have to do this again. That is what they told me."' },
      { at: 31, text: 'VARGA: "I don\'t think I will."' },
      { at: 35, text: '[The cassette clicks off]' }
    ]
  }
};

/** The original audio log, kept under its old name. */
export const TAPE_TRANSCRIPT = TAPES.log_six.lines;
