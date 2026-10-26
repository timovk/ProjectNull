import { DOCUMENTS, TAPES } from '../content/Documents.js';
import { DEVIATION_HOLD_SECONDS } from '../content/Endings.js';
import { POWER_CONFIG } from '../config/GameConfig.js';

const sideName = (side) => side.toLowerCase();
const doorId = (side) => `${side}_DOOR`;

/**
 * Handlers for every interactable in the facility, keyed by interactId.
 * All world changes go through simulation commands.
 */
export function createInteractionHandlers(game) {
  const cmd = (c) => game.command(c);
  const working = (on) => cmd({ type: 'PLAYER', working: on });

  const door = (side) => ({
    prompt: (_d, g) => {
      const s = g.sim.security;
      const d = s.doors[doorId(side)];
      if (!s.powered) return `${side} door controls are dead. Use the yellow manual release.`;
      if (d.damaged) return `${side} door motor forced. Repair it in the electrical room.`;
      return `[E] ${d.closed ? 'Open' : 'Close'} ${sideName(side)} door`;
    },
    press: (_d, g) => {
      const s = g.sim.security;
      if (!s.powered || s.doors[doorId(side)].damaged) return g.audio.uiDeny();
      g.audio.buttonClunk(g.facility.refs.panels[side].doorBtn.getWorldPosition(g.tmpVec));
      cmd({ type: 'DOOR', door: doorId(side) });
    }
  });

  const light = (side) => ({
    prompt: (_d, g) => {
      const s = g.sim.security;
      if (!s.powered) return 'Corridor lighting: no power';
      return `[E] ${s.corridorLights[`${side}_CORRIDOR`] ? 'Turn off' : 'Turn on'} ${sideName(side)} corridor light`;
    },
    press: (_d, g) => {
      if (!g.sim.security.powered) return g.audio.uiDeny();
      g.audio.buttonClunk(g.facility.refs.panels[side].lightBtn.getWorldPosition(g.tmpVec));
      cmd({ type: 'LIGHT', room: `${side}_CORRIDOR` });
    }
  });

  const manual = (side) => ({
    continuous: true,
    prompt: (_d, g) => (g.sim.security.powered ? `Manual ${sideName(side)} door release (for power failures)` : `[Hold E] Brace ${sideName(side)} door shut`),
    holdStart: (_d, g) => {
      if (!g.sim.security.powered) {
        cmd({ type: 'MANUAL_HOLD', door: doorId(side), hold: true });
        working(true);
      }
    },
    holdEnd: (_d, g) => {
      if (g.sim.security.doors[doorId(side)].manualHold) cmd({ type: 'MANUAL_HOLD', door: doorId(side), hold: false });
      working(false);
    }
  });

  const breaker = (id) => ({
    hold: 5,
    canHold: (_d, g) => g.sim.security.doors[id].damaged,
    prompt: (_d, g) => {
      const d = g.sim.security.doors[id];
      const name = id === 'WEST_DOOR' ? 'west' : 'east';
      return d.damaged ? `[Hold E] Repair ${name} door motor` : `${name.toUpperCase()} DOOR MOTOR: OK`;
    },
    holdStart: () => working(true),
    holdEnd: () => working(false),
    complete: (_d, g) => {
      cmd({ type: 'REPAIR_DOOR', door: id });
      g.audio.doorMotor({ x: 8.1, y: 1.4, z: 8.6 }, 0.5);
      g.flashInfo(`${id === 'WEST_DOOR' ? 'WEST' : 'EAST'} DOOR MOTOR RESTORED`);
    }
  });

  return {
    WORKSTATION: {
      prompt: (_d, g) => (g.sim.power.failed ? 'Workstation: no power' : '[E] Use surveillance workstation'),
      press: (_d, g) => (g.sim.power.failed ? g.audio.uiDeny() : g.openWorkstation('cameras'))
    },
    TERMINAL: {
      prompt: (_d, g) => (g.sim.power.failed ? 'Terminal: no power' : '[E] Read facility terminal'),
      press: (_d, g) => (g.sim.power.failed ? g.audio.uiDeny() : g.openWorkstation('log'))
    },
    ACOUSTIC: {
      prompt: (_d, g) => (g.sim.power.failed ? 'Acoustic monitor: no power' : '[E] Open station diagnostics'),
      press: (_d, g) => (g.sim.power.failed ? g.audio.uiDeny() : g.openWorkstation('systems'))
    },
    DOOR_WEST: door('WEST'),
    DOOR_EAST: door('EAST'),
    LIGHT_WEST: light('WEST'),
    LIGHT_EAST: light('EAST'),
    MANUAL_WEST: manual('WEST'),
    MANUAL_EAST: manual('EAST'),
    BARRIER: {
      prompt: (_d, g) => (!g.sim.security.powered ? 'Containment field: no power' : `[E] ${g.sim.security.barrier ? 'Release' : 'Engage'} containment field`),
      press: (_d, g) => {
        if (!g.sim.security.powered) return g.audio.uiDeny();
        g.audio.buttonClunk({ x: -1.7, y: 1.1, z: 3.0 });
        cmd({ type: 'BARRIER' });
      }
    },
    FAN: {
      prompt: (_d, g) => (!g.sim.security.powered ? 'Ventilation: no power' : `[E] Switch ventilation ${g.sim.security.fan ? 'off' : 'on'}`),
      press: (_d, g) => {
        if (!g.sim.security.powered) return g.audio.uiDeny();
        g.audio.buttonClunk({ x: 3.45, y: 1.35, z: -3.2 });
        cmd({ type: 'FAN' });
      }
    },
    RACK: {
      prompt: (_d, g) => (!g.sim.security.powered ? 'Surveillance rack: no power' : `[E] ${g.sim.security.rack ? 'Power down' : 'Power up'} surveillance rack`),
      press: (_d, g) => {
        if (!g.sim.security.powered) return g.audio.uiDeny();
        g.audio.buttonClunk({ x: -3.5, y: 1.9, z: -2.4 });
        cmd({ type: 'RACK' });
      }
    },
    RADIO: {
      prompt: (_d, g) => (!g.sim.security.powered ? 'Radio: no power' : `[E] Turn radio ${g.sim.security.radio ? 'off' : 'on'}`),
      press: (_d, g) => {
        if (!g.sim.security.powered) return g.audio.uiDeny();
        g.audio.buttonClunk({ x: 4.1, y: 1.2, z: 2.0 });
        cmd({ type: 'RADIO' });
      }
    },
    STATION_LIGHTS: {
      prompt: (_d, g) => (!g.sim.security.powered ? 'Emergency lighting active' : `[E] Set station lighting to ${g.sim.security.stationLights === 'NORMAL' ? 'LOW' : 'NORMAL'}`),
      press: (_d, g) => {
        if (!g.sim.security.powered) return g.audio.uiDeny();
        g.audio.buttonClunk({ x: -3.3, y: 1.25, z: 3.2 });
        cmd({ type: 'STATION_LIGHTS' });
      }
    },
    POWER_PANEL: {
      prompt: (_d, g) => `Main cell ${g.sim.power.level.toFixed(1)}%  (${(g.sim.power.drainPerSecond * 60).toFixed(1)}%/min)`
    },
    RELAY: {
      hold: 3,
      canHold: (_d, g) => g.sim.surveillance.faults.size > 0 && g.sim.security.powered,
      prompt: (_d, g) => {
        const n = g.sim.surveillance.faults.size;
        if (!g.sim.security.powered) return 'Signal relay: no power';
        return n ? `[Hold E] Reset signal relay (${n} feed${n > 1 ? 's' : ''} down, -${POWER_CONFIG.relayResetCost}%)` : 'Signal relay: all feeds nominal';
      },
      holdStart: () => working(true),
      holdEnd: () => working(false),
      complete: (_d, g) => {
        const r = cmd({ type: 'RELAY_RESET' });
        if (r.ok) g.flashInfo('SIGNAL RELAY RESET');
      }
    },
    BREAKER_WEST_DOOR: breaker('WEST_DOOR'),
    BREAKER_EAST_DOOR: breaker('EAST_DOOR'),
    AUX_CELL: {
      hold: 6,
      canHold: (_d, g) => !g.sim.auxCellUsed,
      prompt: (_d, g) => (g.sim.auxCellUsed ? 'Auxiliary cell 3: discharged' : `[Hold E] Discharge auxiliary cell (+${POWER_CONFIG.auxCellCharge}% power, once)`),
      holdStart: () => working(true),
      holdEnd: () => working(false),
      complete: (_d, g) => {
        const r = cmd({ type: 'AUX_CELL' });
        if (r.ok) {
          g.audio.thud({ x: 6.2, y: 1, z: 11.4 }, 0.8);
          g.flashInfo(`AUXILIARY CELL DISCHARGED (+${POWER_CONFIG.auxCellCharge}%)`);
        }
      }
    },
    DOCUMENT: {
      prompt: (d) => `[E] Read: ${DOCUMENTS[d.docId]?.title ?? 'document'}`,
      press: (d, g) => g.openDocument(d.docId)
    },
    TAPE: {
      prompt: (d, g) => (g.tapePlaying ? 'Playing...' : TAPES[d.tapeId ?? 'log_six'].prompt),
      press: (d, g) => g.playTape(d.tapeId ?? 'log_six')
    },
    ELECTRICAL_DOOR: {
      prompt: (_d, g) => `[E] ${g.facility.refs.electricalDoor.target > 0.5 ? 'Close' : 'Open'} door`,
      press: (_d, g) => {
        const ed = g.facility.refs.electricalDoor;
        ed.target = ed.target > 0.5 ? 0 : 1;
        g.audio.creak({ x: 3.4, y: 1.2, z: 8.9 }, 0.35);
      }
    },
    RESTRICTED: {
      // The deviation ending: on the last night, after R.'s note, hold a hand on the door.
      hold: DEVIATION_HOLD_SECONDS,
      canHold: (_d, g) => g.canDeviate(),
      prompt: (_d, g) => (g.canDeviate() ? '[Hold E] Put your hand on the door' : 'SUBLEVEL B - ACCESS REVOKED'),
      holdStart: () => working(true),
      holdEnd: () => working(false),
      complete: (_d, g) => g.logDeviation()
    }
  };
}
