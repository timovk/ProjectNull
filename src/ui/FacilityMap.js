import { el } from './dom.js';
import { ROOMS, EDGES, STATION } from '../config/FacilityLayout.js';
import { ENTITY_ORDER } from '../config/GameConfig.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs = {}) => {
  const n = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};

/** Practice-map markers: letter, colour, offset from the room centre. */
export const ENTITY_MARKERS = {
  SUBJECT_01: { letter: 'W', name: 'Wanderer', color: '#ffb84a', dx: -6.2, dy: -5.2 },
  SUBJECT_02: { letter: 'O', name: 'Observer', color: '#eeeee4', dx: 6.2, dy: -5.2 },
  SUBJECT_03: { letter: 'E', name: 'Echo', color: '#7cc8ff', dx: -6.2, dy: 5.2 },
  SUBJECT_04: { letter: 'P', name: 'Patient', color: '#ff7a5a', dx: 6.2, dy: 5.2 }
};

/**
 * SVG map of the facility graph. Used by the workstation (clickable cameras)
 * and, in practice mode only, by the HUD. `showEntities` draws a marker for
 * each subject at its real simulation room.
 */
export class FacilityMap {
  constructor({ onSelect = null, compact = false } = {}) {
    this.onSelect = onSelect;
    this.svg = svg('svg', { viewBox: '-2 0 104 100' });
    for (const e of EDGES) {
      const a = ROOMS[e.a].map;
      const b = ROOMS[e.b].map;
      this.svg.append(svg('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: `edge ${e.only ? 'vent' : ''}` }));
    }
    this.roomNodes = {};
    for (const [id, r] of Object.entries(ROOMS)) {
      const g = svg('g', { class: `room ${r.camera ? '' : 'nocam'} ${id === STATION ? 'station' : ''}` });
      const w = id === STATION ? 20 : 17;
      g.append(svg('rect', { x: r.map.x - w / 2, y: r.map.y - 4, width: w, height: 8, rx: 0.8 }));
      const t1 = svg('text', { x: r.map.x, y: compact ? r.map.y + 1.2 : r.map.y - 0.3, 'text-anchor': 'middle' });
      t1.textContent = r.camera ?? (id === STATION ? 'YOU' : 'DUCT');
      g.append(t1);
      if (!compact) {
        const t2 = svg('text', { x: r.map.x, y: r.map.y + 3, 'text-anchor': 'middle' });
        t2.textContent = r.name.toUpperCase().slice(0, 15);
        t2.setAttribute('style', 'font-size:2.4px');
        g.append(t2);
      }
      if (r.camera && onSelect) g.addEventListener('click', () => onSelect(id));
      this.svg.append(g);
      this.roomNodes[id] = g;
    }
    this.markerLayer = svg('g', { class: 'markers' });
    this.svg.append(this.markerLayer);
    this.markers = {};
    for (const id of ENTITY_ORDER) {
      const m = ENTITY_MARKERS[id];
      const g = svg('g', { class: 'marker' });
      g.append(svg('circle', { r: 2.6, fill: m.color, stroke: '#050606', 'stroke-width': 0.6 }));
      const t = svg('text', { 'text-anchor': 'middle', y: 1.05 });
      t.textContent = m.letter;
      g.append(t);
      this.markerLayer.append(g);
      this.markers[id] = { g, room: null };
    }
    this.showEntities(false);
    this.node = el('div', { class: `ws-map ${compact ? 'compact' : ''}` }, [this.svg]);
  }

  showEntities(visible) {
    this.entitiesVisible = visible;
    this.markerLayer.style.display = visible ? '' : 'none';
  }

  update(sim, { selected = null } = {}) {
    if (sim) {
      for (const [id, g] of Object.entries(this.roomNodes)) {
        g.classList.toggle('selected', id === selected);
        g.classList.toggle('fault', sim.surveillance.faults.has(id));
      }
    }
    if (!this.entitiesVisible || !sim) return;
    for (const e of sim.ai.entities) {
      const mk = this.markers[e.id];
      if (mk.room === e.currentRoom) continue;
      mk.room = e.currentRoom;
      const r = ROOMS[e.currentRoom].map;
      const o = ENTITY_MARKERS[e.id];
      mk.g.style.transform = `translate(${r.x + o.dx}px, ${r.y + o.dy}px)`;
      mk.g.classList.toggle('dormant', e.aiLevel <= 0);
    }
  }
}

export function markerLegend() {
  return el('div', { class: 'map-legend' }, ENTITY_ORDER.map((id) => {
    const m = ENTITY_MARKERS[id];
    return el('span', {}, [el('i', { style: { background: m.color }, text: m.letter }), m.name]);
  }));
}
