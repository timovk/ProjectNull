import { el } from './dom.js';
import { ROOMS, EDGES, CAMERA_ROOMS, STATION } from '../config/FacilityLayout.js';
import { POWER_CONFIG, ENTITY_IDS } from '../config/GameConfig.js';
import { formatGameClock } from '../core/GameClock.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs = {}) => {
  const n = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};

/** Camera ordering for hotkeys 1..9, 0, -, = */
export const CAMERA_ORDER = [...CAMERA_ROOMS].sort((a, b) => ROOMS[a].camera.localeCompare(ROOMS[b].camera));

const STATUS_TEXT = {
  NO_SIGNAL: ['NO SIGNAL', 'RESET THE SIGNAL RELAY (SOUTH WALL)'],
  THERMAL: ['THERMAL SHUTDOWN', 'RACK COOLING - VENTILATION REQUIRED'],
  OFFLINE: ['RACK OFFLINE', 'SURVEILLANCE RACK IS POWERED DOWN'],
  NO_POWER: ['NO POWER', '']
};

/**
 * The surveillance workstation overlay. The feed itself is drawn by WebGL
 * behind this overlay; this module draws labels, the facility map,
 * diagnostics and the message log. Opening it does NOT pause the night.
 */
export class SurveillanceUI {
  constructor(root, { onSelect, onPing, onClose }) {
    this.onSelect = onSelect;
    this.onPing = onPing;
    this.onClose = onClose;
    this.tab = 'cameras';

    this.cam = el('div', { class: 'cam' });
    this.room = el('div', { class: 'room' });
    this.status = el('div', { class: 'status-big' });
    this.timestamp = el('div', { class: 'timestamp' });
    this.tabs = {};
    const tabBar = el('div', { class: 'ws-tabs' }, ['cameras', 'systems', 'log'].map((t) => {
      const b = el('button', { class: 'ws-tab', text: t.toUpperCase(), onclick: () => this.setTab(t) });
      this.tabs[t] = b;
      return b;
    }));
    this.mapPanel = this.buildMap();
    this.pingBtn = el('button', { class: 'ws-btn', onclick: () => this.onPing() });
    this.camerasView = el('div', { class: 'ws-panel ws-scroll' }, [el('h3', { text: 'FACILITY N-17 / LEVEL 2' }), this.mapPanel, this.pingBtn, el('div', { class: 'log-line', text: 'An acoustic ping makes noise in the selected room.' })]);
    this.systemsBody = el('div');
    this.systemsView = el('div', { class: 'ws-panel ws-scroll hidden' }, [el('h3', { text: 'DIAGNOSTICS' }), this.systemsBody]);
    this.logBody = el('div');
    this.logView = el('div', { class: 'ws-panel ws-scroll hidden' }, [el('h3', { text: 'FACILITY TERMINAL' }), this.logBody]);

    this.node = el('div', { id: 'workstation', class: 'interactive hidden' }, [
      el('div', { class: 'feed-label' }, [this.cam, this.room, el('div', { class: 'rec', html: '<i></i>REC' })]),
      this.status,
      el('div', { class: 'help', html: '[1-0 - =] or click map: switch camera &nbsp; [ [ ] ] cycle &nbsp; [Tab] panels<br>[E] / [Esc] stand up. The night does not pause.' }),
      this.timestamp,
      el('div', { class: 'side' }, [tabBar, this.camerasView, this.systemsView, this.logView])
    ]);
    root.append(this.node);
    this.setTab('cameras');
    this.open = false;
    this.lastLogCount = -1;
  }

  buildMap() {
    const s = svg('svg', { viewBox: '0 0 100 100' });
    for (const e of EDGES) {
      const a = ROOMS[e.a].map;
      const b = ROOMS[e.b].map;
      s.append(svg('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: `edge ${e.only ? 'vent' : ''}` }));
    }
    this.roomNodes = {};
    for (const [id, r] of Object.entries(ROOMS)) {
      const g = svg('g', { class: `room ${r.camera ? '' : 'nocam'} ${id === STATION ? 'station' : ''}` });
      const w = id === STATION ? 20 : 17;
      g.append(svg('rect', { x: r.map.x - w / 2, y: r.map.y - 4, width: w, height: 8, rx: 0.8 }));
      const t1 = svg('text', { x: r.map.x, y: r.map.y - 0.3, 'text-anchor': 'middle' });
      t1.textContent = r.camera ?? (id === STATION ? 'YOU' : 'DUCT');
      const t2 = svg('text', { x: r.map.x, y: r.map.y + 3, 'text-anchor': 'middle' });
      t2.textContent = r.name.toUpperCase().slice(0, 15);
      t2.setAttribute('style', 'font-size:2.4px');
      g.append(t1, t2);
      if (r.camera) g.addEventListener('click', () => this.onSelect(id));
      s.append(g);
      this.roomNodes[id] = g;
    }
    return el('div', { class: 'ws-map' }, [s]);
  }

  setTab(tab) {
    this.tab = tab;
    for (const [k, b] of Object.entries(this.tabs)) b.classList.toggle('active', k === tab);
    this.camerasView.classList.toggle('hidden', tab !== 'cameras');
    this.systemsView.classList.toggle('hidden', tab !== 'systems');
    this.logView.classList.toggle('hidden', tab !== 'log');
    this.lastLogCount = -1;
  }

  cycleTab() {
    const order = ['cameras', 'systems', 'log'];
    this.setTab(order[(order.indexOf(this.tab) + 1) % order.length]);
  }

  show(visible) {
    this.open = visible;
    if (visible) {
      this.node.classList.remove('hidden');
      requestAnimationFrame(() => this.node.classList.add('visible'));
    } else {
      this.node.classList.remove('visible');
      this.node.classList.add('hidden');
    }
  }

  update(sim, messages) {
    const sv = sim.surveillance;
    const room = sv.selected;
    const info = ROOMS[room];
    this.cam.textContent = `${info.camera}`;
    this.room.textContent = info.name.toUpperCase();
    const st = sv.feedStatus(room);
    const big = STATUS_TEXT[st];
    if (big) this.status.innerHTML = `${big[0]}<small>${big[1]}</small>`;
    else this.status.textContent = '';
    this.timestamp.textContent = `N-17 ${formatGameClock(sim.gameHours)}  ${new Date(Date.UTC(1998, 9, 23)).toISOString().slice(0, 10)}`;
    for (const [id, g] of Object.entries(this.roomNodes)) {
      g.classList.toggle('selected', id === room);
      g.classList.toggle('fault', sv.faults.has(id));
    }

    if (this.tab === 'cameras') {
      const cd = sv.pingCooldownRemaining;
      this.pingBtn.disabled = cd > 0 || !sv.operational;
      this.pingBtn.textContent = cd > 0 ? `ACOUSTIC PING  (recharging ${cd.toFixed(0)}s)` : `ACOUSTIC PING -> ${info.camera}  (-${POWER_CONFIG.pingCost}% power)`;
    } else if (this.tab === 'systems') {
      this.renderSystems(sim);
    } else if (this.tab === 'log') {
      if (messages.length !== this.lastLogCount) {
        this.lastLogCount = messages.length;
        this.logBody.replaceChildren(...messages.slice(-60).reverse().map((m) => el('div', { class: `log-line ${m.kind}` }, [el('span', { class: 't', text: m.clock }), m.text])));
      }
    }
  }

  renderSystems(sim) {
    const s = sim.security;
    const p = sim.power;
    const n = sim.noise;
    const echo = sim.ai.get(ENTITY_IDS.ECHO);
    const threshold = echo.listenThreshold();
    const row = (k, v, cls = '') => el('div', { class: 'diag-row' }, [el('span', { text: k }), el('span', { class: cls, text: v })]);
    const meter = (value, max, mark = null) => {
      const m = el('div', { class: 'meter' }, [el('i', { style: { width: `${Math.min(100, (value / max) * 100)}%` } })]);
      if (mark !== null) m.append(el('b', { style: { left: `${Math.min(100, (mark / max) * 100)}%` } }));
      return m;
    };
    const b = p.breakdown;
    const door = (id) => (s.doors[id].damaged ? ['MOTOR FAULT', 'bad'] : s.doors[id].manualHold ? ['MANUAL', 'warn'] : s.isDoorClosed(id) ? ['SHUT', 'warn'] : ['OPEN', 'ok']);
    const [wd, wdc] = door('WEST_DOOR');
    const [ed, edc] = door('EAST_DOOR');
    this.systemsBody.replaceChildren(
      row('Main power', `${p.level.toFixed(1)}%`, p.level < 20 ? 'bad' : ''),
      meter(p.level, 100),
      row('Drain', `${(p.drainPerSecond * 60).toFixed(2)} %/min`),
      row('  base / lights', `${((b.facilityBase + b.stationLights) * 60).toFixed(2)}`),
      row('  surveillance', `${((b.workstation + b.cameras) * 60).toFixed(2)}`),
      row('  doors', `${(b.doors * 60).toFixed(2)}`),
      row('  corridor lights', `${(b.corridorLights * 60).toFixed(2)}`),
      row('  containment field', `${(b.barrier * 60).toFixed(2)}`),
      row('  ventilation / radio', `${((b.ventilation + b.radio) * 60).toFixed(2)}`),
      row('Est. time remaining', Number.isFinite(p.secondsRemaining) ? `${Math.floor(p.secondsRemaining / 60)}m ${Math.floor(p.secondsRemaining % 60)}s` : '-'),
      row('Station acoustic level', `${(n.stationNoise * 100).toFixed(0)} dBn`, n.stationNoise >= threshold ? 'bad' : 'ok'),
      meter(n.stationNoise, 0.9, threshold),
      row('West door', wd, wdc),
      row('East door', ed, edc),
      row('Corridor lights W / E', `${s.isCorridorLit('WEST_CORRIDOR') ? 'ON' : 'OFF'} / ${s.isCorridorLit('EAST_CORRIDOR') ? 'ON' : 'OFF'}`),
      row('Containment field', s.barrierActive ? 'ENGAGED' : 'STANDBY', s.barrierActive ? 'warn' : ''),
      row('Ventilation', s.fan ? 'ON' : 'OFF', s.fan ? '' : 'warn'),
      row('Rack temperature', `${(40 + sim.surveillance.thermal * 45).toFixed(0)} C`, sim.surveillance.thermal > 0.7 ? 'bad' : ''),
      row('Camera faults', `${sim.surveillance.faults.size}`, sim.surveillance.faults.size ? 'bad' : 'ok'),
      row('Decontamination gate', sim.facility.deconActive ? 'CYCLING (SEALED)' : 'OPEN'),
      row('Auxiliary cell', sim.auxCellUsed ? 'DISCHARGED' : 'CHARGED', sim.auxCellUsed ? '' : 'ok')
    );
  }
}
