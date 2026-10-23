import { TERMINAL_SCHEDULE } from '../content/TerminalMessages.js';

/**
 * Presentation-only environmental events: distant sounds, light stutters,
 * scheduled terminal messages and a few unexplained changes. None of these
 * carry false information about entity positions and none are loud.
 */
export class Environment {
  constructor(game) {
    this.game = game;
    this.reset();
  }

  reset() {
    this.nextAmbient = 10 + Math.random() * 10;
    this.sentMessages = new Set();
    this.doorAjarDone = false;
    this.knockDone = false;
  }

  update(dt, sim) {
    const g = this.game;
    const t = sim.time;
    const hours = sim.gameHours;

    for (const msg of TERMINAL_SCHEDULE) {
      if (!this.sentMessages.has(msg.id) && hours >= msg.at) {
        this.sentMessages.add(msg.id);
        g.pushMessage(msg.text, msg.kind ?? 'facility');
      }
    }

    if (t >= this.nextAmbient) {
      this.nextAmbient = t + 14 + Math.random() * 22;
      this.ambientEvent();
    }

    // A door the player left closed is found open (2:30 AM, only when not watched).
    if (!this.doorAjarDone && hours >= 2.5) {
      const ed = g.facility.refs.electricalDoor;
      if (g.player.zone === 'STATION' && ed.target < 0.5) {
        ed.target = 0.35;
        this.doorAjarDone = true;
      } else if (ed.target >= 0.5) this.doorAjarDone = true;
    }

    // Three soft knocks from Sublevel B, only heard from the maintenance corridor.
    if (!this.knockDone && hours >= 3.4 && g.player.zone === 'MAINTENANCE') {
      this.knockDone = true;
      g.audio.knock({ x: 2.5, y: 1.2, z: 16.3 }, 0.8);
      g.subtitles.show('[Three soft knocks from behind the Sublevel B door]', 'ambient');
    }
  }

  ambientEvent() {
    const g = this.game;
    const a = g.audio;
    const r = Math.random();
    const far = (x, z) => ({ x, y: 2.5, z });
    if (r < 0.22) {
      a.creak(far(-12 + Math.random() * 24, -25), 0.6);
      g.subtitles.show('[Distant metallic creaking]', 'ambient');
    } else if (r < 0.4) {
      a.drip({ x: -1.4, y: -1.4, z: 8 + Math.random() * 3 });
      a.drip({ x: -1.4, y: -1.4, z: 8 + Math.random() * 3 });
    } else if (r < 0.55) {
      a.thud(far(Math.random() < 0.5 ? -20 : 20, -30), 0.5);
      g.subtitles.show('[A dull impact somewhere far below]', 'ambient');
    } else if (r < 0.7) {
      g.lighting.triggerFlicker(Math.random() < 0.5 ? 'stationA' : 'maintenance', 0.5 + Math.random() * 0.6);
    } else if (r < 0.82) {
      a.burst({ pos: far(0, 6), bus: 'ambient', buffer: 'pink', type: 'lowpass', freq: 180, attack: 1.5, hold: 1.0, release: 2.5, peak: 0.08 });
      g.subtitles.show('[Air moves through the pipes, like a long exhale]', 'ambient');
    } else {
      a.footstep({ x: 2.5, y: 0.2, z: 22 }, { weight: 1, gain: 0.25 });
      a.footstep({ x: 2.5, y: 0.2, z: 22 }, { weight: 1, gain: 0.2, delay: 0.8 });
      g.subtitles.show('[Faint steps, somewhere beneath the floor]', 'ambient');
    }
  }
}
