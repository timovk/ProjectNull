import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as TX from '../render/Textures.js';

/**
 * Furniture, props and clutter for the security station: a 1970s steel desk,
 * a worn office chair, 1990s desk equipment, cables, a cork board, signs,
 * stains. Purely decorative: nothing here is interactive, and none of it is
 * an occluder for interaction rays. Static pieces are merged per material.
 *
 * Station layout (see Facility.js): x -4.5..4.5, z -3.5..3.5, desk along the
 * north wall (top surface y 0.81, z -3.35..-2.4), chair at (0.1, -1.95).
 */

const DESK_TOP_Y = 0.81;

// ------------------------------------------------------------------ textures

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function tex(c, { srgb = true, repeat = [1, 1] } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function rand(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

function keyboardTexture() {
  const c = canvas(256, 96);
  const x = c.getContext('2d');
  x.fillStyle = '#2e2e2a';
  x.fillRect(0, 0, 256, 96);
  const rows = [[14, 0], [14, 4], [13, 8], [12, 12], [10, 16]];
  rows.forEach(([n, off], r) => {
    for (let i = 0; i < n; i++) {
      const w = r === 4 && i === 4 ? 70 : 14;
      x.fillStyle = '#a9a596';
      x.fillRect(6 + off + i * 17 + (r === 4 && i > 4 ? 56 : 0), 6 + r * 17, w, 13);
      x.fillStyle = 'rgba(40,38,32,0.6)';
      x.fillRect(9 + off + i * 17 + (r === 4 && i > 4 ? 56 : 0), 9 + r * 17, 3, 3);
    }
  });
  x.fillStyle = 'rgba(20,18,14,0.25)';
  x.fillRect(0, 0, 256, 96);
  return tex(c);
}

/** Soft grime or water stain with transparent edges. `drip` adds runs downward. */
function stainTexture(seed, { color = '40,34,24', drip = false, ring = false } = {}) {
  const c = canvas(256);
  const x = c.getContext('2d');
  const r = rand(seed);
  if (ring) {
    x.strokeStyle = `rgba(${color},0.55)`;
    x.lineWidth = 7;
    x.beginPath();
    x.arc(128, 128, 92, 0, Math.PI * 2);
    x.stroke();
    x.strokeStyle = `rgba(${color},0.2)`;
    x.lineWidth = 16;
    x.beginPath();
    x.arc(128, 128, 84, 0.5, 4.2);
    x.stroke();
    return tex(c);
  }
  for (let i = 0; i < 26; i++) {
    const px = 128 + (r() - 0.5) * 140;
    const py = (drip ? 60 : 128) + (r() - 0.5) * (drip ? 60 : 140);
    const rad = 20 + r() * 60;
    const g = x.createRadialGradient(px, py, 0, px, py, rad);
    g.addColorStop(0, `rgba(${color},${0.18 + r() * 0.2})`);
    g.addColorStop(1, `rgba(${color},0)`);
    x.fillStyle = g;
    x.fillRect(px - rad, py - rad, rad * 2, rad * 2);
  }
  if (drip) {
    for (let i = 0; i < 9; i++) {
      const px = 50 + r() * 156;
      const len = 60 + r() * 150;
      const g = x.createLinearGradient(0, 60, 0, 60 + len);
      g.addColorStop(0, `rgba(${color},0.35)`);
      g.addColorStop(1, `rgba(${color},0)`);
      x.fillStyle = g;
      x.fillRect(px, 60, 2 + r() * 4, len);
    }
  }
  return tex(c);
}

function stickyTexture(lines, color) {
  const c = canvas(128);
  const x = c.getContext('2d');
  x.fillStyle = color;
  x.fillRect(0, 0, 128, 128);
  x.fillStyle = 'rgba(0,0,0,0.08)';
  x.fillRect(0, 0, 128, 18);
  x.fillStyle = '#26272e';
  x.font = 'bold 22px "Comic Sans MS", "Segoe Print", cursive';
  lines.forEach((t, i) => x.fillText(t, 10, 46 + i * 30));
  return tex(c);
}

function corkTexture() {
  const c = canvas(256);
  const x = c.getContext('2d');
  const r = rand(77);
  x.fillStyle = '#8a6a44';
  x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 9000; i++) {
    x.fillStyle = r() < 0.5 ? 'rgba(60,40,22,0.5)' : 'rgba(170,140,100,0.45)';
    x.fillRect(r() * 256, r() * 256, 1 + r() * 2, 1 + r() * 2);
  }
  return tex(c);
}

function cardboardTexture(label) {
  const c = canvas(256);
  const x = c.getContext('2d');
  const r = rand(91);
  x.fillStyle = '#7c6446';
  x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 40; i++) {
    x.fillStyle = `rgba(50,36,20,${0.03 + r() * 0.05})`;
    x.fillRect(0, r() * 256, 256, 1 + r() * 3);
  }
  x.fillStyle = 'rgba(190,175,140,0.75)';
  x.fillRect(118, 0, 20, 256);
  if (label) {
    x.fillStyle = '#d8d2bf';
    x.fillRect(40, 150, 176, 56);
    x.fillStyle = '#202020';
    x.font = 'bold 22px "Courier New", monospace';
    x.fillText(label, 52, 186);
  }
  return tex(c);
}

function stencilTexture(text, sub) {
  const c = canvas(512, 160);
  const x = c.getContext('2d');
  x.clearRect(0, 0, 512, 160);
  x.fillStyle = 'rgba(214,206,182,0.62)';
  x.font = 'bold 86px "Arial Black", Impact, sans-serif';
  x.fillText(text, 14, 92);
  x.font = 'bold 30px "Arial Black", Impact, sans-serif';
  x.fillText(sub, 18, 140);
  // Stencil bridges and wear.
  const r = rand(5);
  x.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 900; i++) {
    x.fillStyle = `rgba(0,0,0,${0.3 + r() * 0.7})`;
    x.fillRect(r() * 512, r() * 160, 1 + r() * 4, 1 + r() * 3);
  }
  for (let i = 0; i < 8; i++) x.fillRect(30 + i * 62, 0, 4, 160);
  return tex(c);
}

function decalMaterial(map, opacity = 1) {
  return new THREE.MeshLambertMaterial({ map, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
}

// ------------------------------------------------------------------ helpers

/**
 * Collects meshes into one group and merges the static ones per material
 * when `finish()` is called.
 */
class Builder {
  constructor(parent, kit) {
    this.kit = kit;
    this.group = new THREE.Group();
    this.group.name = 'station-dressing';
    parent.add(this.group);
  }

  add(geo, mat, { pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1], cast = false, parent = this.group } = {}) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(...pos);
    mesh.rotation.set(...rot);
    mesh.scale.set(...scale);
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    mesh.userData.cast = cast;
    parent.add(mesh);
    return mesh;
  }

  box(w, h, d, mat, pos, opts = {}) {
    return this.add(new THREE.BoxGeometry(w, h, d), mat, { pos, ...opts });
  }

  rbox(w, h, d, r, mat, pos, opts = {}) {
    return this.add(new RoundedBoxGeometry(w, h, d, 2, r), mat, { pos, ...opts });
  }

  cyl(rt, rb, h, mat, pos, { seg = 16, open = false, ...opts } = {}) {
    return this.add(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), mat, { pos, ...opts });
  }

  plane(w, h, mat, pos, opts = {}) {
    return this.add(new THREE.PlaneGeometry(w, h), mat, { pos, ...opts });
  }

  cable(points, r, mat, { seg = 40, parent = this.group } = {}) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    return this.add(new THREE.TubeGeometry(curve, seg, r, 6, false), mat, { parent });
  }

  /** Merge each group's direct static children per material (one draw call each). */
  finish(group = this.group) {
    for (const child of [...group.children]) if (!child.isMesh && !child.userData.keep) this.finish(child);
    const byKey = new Map();
    for (const child of group.children) {
      if (!child.isMesh || child.userData.keep) continue;
      const key = `${child.material.uuid}|${child.userData.cast ? 1 : 0}`;
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(child);
    }
    // All geometries here have position, normal and uv. RoundedBoxGeometry is
    // not indexed, so a mixed set is merged without indices.
    for (const meshes of byKey.values()) {
      if (meshes.length < 2) continue;
      let geos = meshes.map((m) => {
        m.updateMatrix();
        return m.geometry.clone().applyMatrix4(m.matrix);
      });
      if (geos.some((g) => !g.index)) geos = geos.map((g) => (g.index ? g.toNonIndexed() : g));
      const merged = mergeGeometries(geos);
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, meshes[0].material);
      mesh.castShadow = meshes[0].castShadow;
      mesh.receiveShadow = true;
      group.add(mesh);
      for (const m of meshes) {
        group.remove(m);
        m.geometry.dispose();
      }
    }
    return group;
  }
}

function materials(m) {
  return {
    lino: new THREE.MeshStandardMaterial({ map: TX.grimeTexture([2, 1], 14), color: 0x4a5650, roughness: 0.55, metalness: 0 }),
    steel: m.metalPaint,
    steelDark: m.metalDark,
    chrome: new THREE.MeshStandardMaterial({ color: 0xb8bcbc, roughness: 0.3, metalness: 0.9 }),
    beige: new THREE.MeshStandardMaterial({ color: 0xb4ae9a, roughness: 0.7, metalness: 0 }),
    beigeDark: new THREE.MeshStandardMaterial({ color: 0x8a8576, roughness: 0.75, metalness: 0 }),
    plastic: m.plastic,
    rubber: new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.85, metalness: 0 }),
    mat: new THREE.MeshLambertMaterial({ map: TX.grimeTexture([2, 2], 47), color: 0x2a2c2a }),
    fabric: new THREE.MeshLambertMaterial({ map: TX.grimeTexture([1, 1], 31), color: 0x3a4650 }),
    foam: new THREE.MeshLambertMaterial({ color: 0xb59a52 }),
    keys: new THREE.MeshLambertMaterial({ map: keyboardTexture() }),
    mug: new THREE.MeshStandardMaterial({ color: 0xd8d4c8, roughness: 0.35, metalness: 0 }),
    coffee: new THREE.MeshStandardMaterial({ color: 0x1e120a, roughness: 0.1, metalness: 0 }),
    red: new THREE.MeshStandardMaterial({ color: 0x8e1a14, roughness: 0.45, metalness: 0.1 }),
    binderRed: new THREE.MeshLambertMaterial({ color: 0x5a2420 }),
    binderBlue: new THREE.MeshLambertMaterial({ color: 0x24324a }),
    binderGrey: new THREE.MeshLambertMaterial({ color: 0x4c4f4c }),
    label: new THREE.MeshLambertMaterial({ color: 0xd8d2bf }),
    floppy: new THREE.MeshStandardMaterial({ color: 0x1f2124, roughness: 0.6 }),
    cork: new THREE.MeshLambertMaterial({ map: corkTexture() }),
    wood: m.wood,
    pin: new THREE.MeshStandardMaterial({ color: 0xb02020, roughness: 0.4 }),
    cardboard: new THREE.MeshLambertMaterial({ map: cardboardTexture('') }),
    cardboardLabel: new THREE.MeshLambertMaterial({ map: cardboardTexture('FORMS 11/97') }),
    stickyYellow: new THREE.MeshLambertMaterial({ map: stickyTexture(['count', 'them'], '#e6d65c'), side: THREE.DoubleSide }),
    stickyPink: new THREE.MeshLambertMaterial({ map: stickyTexture(['ext 4471', 'NO ANS.'], '#e09aa6'), side: THREE.DoubleSide }),
    stickyBlue: new THREE.MeshLambertMaterial({ map: stickyTexture(['relay', '= S wall'], '#9ec4dc'), side: THREE.DoubleSide }),
    paper: m.paper,
    stainWall: decalMaterial(stainTexture(3, { drip: true }), 0.9),
    stainRust: decalMaterial(stainTexture(8, { drip: true, color: '90,46,20' }), 0.75),
    stainFloor: decalMaterial(stainTexture(12, { color: '22,20,14' }), 0.85),
    ring: decalMaterial(stainTexture(4, { ring: true, color: '60,36,16' }), 0.8),
    stencil: decalMaterial(stencilTexture('L2 / 05', 'SECURITY STATION'), 1)
  };
}

// --------------------------------------------------------------------- desk

function desk(b, M) {
  const top = DESK_TOP_Y;
  // Linoleum top on a steel frame with a rubber front edge.
  b.box(4.2, 0.035, 0.95, M.lino, [0, top - 0.0175, -2.88], { cast: true });
  b.box(4.22, 0.05, 0.035, M.rubber, [0, top - 0.02, -2.395]);
  b.box(4.1, 0.07, 0.9, M.steelDark, [0, top - 0.07, -2.88]);
  // Pedestals with drawers.
  for (const [x, drawers] of [[-1.75, [0.2, 0.2, 0.25]], [1.75, [0.2, 0.47]]]) {
    b.box(0.6, 0.7, 0.85, M.steel, [x, 0.38, -2.9], { cast: true });
    b.box(0.56, 0.05, 0.8, M.rubber, [x, 0.025, -2.92]);
    let y = 0.7;
    for (const h of drawers) {
      const cy = y - h / 2 - 0.005;
      b.box(0.55, h - 0.012, 0.02, M.steel, [x, cy, -2.465]);
      b.box(0.16, 0.022, 0.03, M.chrome, [x, cy + h * 0.22, -2.448]);
      b.box(0.08, 0.035, 0.004, M.label, [x, cy + h * 0.22 + 0.045, -2.454]);
      y -= h;
    }
  }
  // Modesty panel and the cable grommet behind the monitors.
  b.box(2.9, 0.55, 0.025, M.steelDark, [0, 0.47, -3.31]);
  b.cyl(0.035, 0.035, 0.005, M.rubber, [0.35, top + 0.002, -3.2]);
}

function chair(b, M, parent) {
  const g = new THREE.Group();
  g.position.set(0.1, 0, -1.95);
  g.rotation.y = 0.25;
  parent.add(g);
  const opts = { parent: g, cast: true };
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    b.box(0.3, 0.035, 0.05, M.steelDark, [Math.cos(a) * 0.15, 0.075, Math.sin(a) * 0.15], { ...opts, rot: [0, -a, 0] });
    b.cyl(0.024, 0.024, 0.03, M.rubber, [Math.cos(a) * 0.29, 0.025, Math.sin(a) * 0.29], { ...opts, rot: [Math.PI / 2, 0, -a + Math.PI / 2], seg: 10 });
    b.box(0.015, 0.05, 0.03, M.steelDark, [Math.cos(a) * 0.29, 0.06, Math.sin(a) * 0.29], { ...opts, rot: [0, -a, 0] });
  }
  b.cyl(0.04, 0.05, 0.05, M.steelDark, [0, 0.085, 0], opts);
  b.cyl(0.036, 0.036, 0.17, M.plastic, [0, 0.19, 0], opts);
  b.cyl(0.022, 0.022, 0.2, M.chrome, [0, 0.33, 0], opts);
  b.box(0.22, 0.04, 0.22, M.steelDark, [0, 0.42, 0], opts);
  b.rbox(0.5, 0.09, 0.48, 0.035, M.fabric, [0, 0.475, 0], opts);
  // A split in the seat cushion, foam showing.
  b.box(0.13, 0.004, 0.05, M.foam, [-0.1, 0.521, -0.17], { parent: g, rot: [0, 0.4, 0] });
  b.box(0.05, 0.32, 0.03, M.steelDark, [0, 0.62, 0.25], { ...opts, rot: [-0.1, 0, 0] });
  b.rbox(0.46, 0.5, 0.075, 0.035, M.fabric, [0, 0.89, 0.27], { ...opts, rot: [-0.12, 0, 0] });
  for (const s of [-1, 1]) {
    b.box(0.03, 0.2, 0.03, M.steelDark, [s * 0.27, 0.56, 0.02], opts);
    b.box(0.03, 0.02, 0.2, M.steelDark, [s * 0.27, 0.47, 0.06], opts);
    b.rbox(0.06, 0.035, 0.26, 0.012, M.rubber, [s * 0.27, 0.67, 0.0], opts);
  }
  return g;
}

function deskClutter(b, M) {
  const top = DESK_TOP_Y;
  // Keyboard (replaces the old block) with its cable over the back edge.
  b.box(0.55, 0.025, 0.18, M.beigeDark, [0, top + 0.012, -2.62], { rot: [0.05, 0, 0] });
  b.plane(0.52, 0.16, M.keys, [0, top + 0.027, -2.62], { rot: [-Math.PI / 2 + 0.05, 0, 0] });
  b.cable([[0, top + 0.01, -2.72], [0.04, top + 0.01, -2.9], [0.2, top + 0.01, -3.05], [0.35, top + 0.003, -3.2], [0.35, 0.5, -3.3], [0.5, 0.03, -3.28]], 0.005, M.rubber);
  // Mouse on a worn pad, cable to the grommet.
  b.box(0.24, 0.004, 0.2, M.binderBlue, [0.42, top + 0.002, -2.62]);
  b.rbox(0.065, 0.032, 0.11, 0.014, M.beige, [0.42, top + 0.02, -2.62]);
  b.cable([[0.42, top + 0.012, -2.68], [0.43, top + 0.006, -2.85], [0.38, top + 0.006, -3.1], [0.35, top + 0.004, -3.19]], 0.003, M.beigeDark);
  // Floppy disks.
  for (let i = 0; i < 3; i++) {
    b.box(0.09, 0.003, 0.094, M.floppy, [0.69 + i * 0.012, top + 0.002 + i * 0.003, -2.45 - i * 0.008], { rot: [0, 0.3 + i * 0.25, 0] });
  }
  b.box(0.05, 0.001, 0.03, M.chrome, [0.69, top + 0.0045, -2.42], { rot: [0, 0.3, 0] });
  // A mug with a handle, cold coffee in it, and the rings it has left.
  b.cyl(0.045, 0.04, 0.1, M.mug, [-0.55, top + 0.05, -2.55], { open: true, seg: 20 });
  b.cyl(0.04, 0.04, 0.004, M.mug, [-0.55, top + 0.002, -2.55], { seg: 20 });
  b.cyl(0.043, 0.043, 0.002, M.coffee, [-0.55, top + 0.075, -2.55], { seg: 20 });
  b.add(new THREE.TorusGeometry(0.028, 0.008, 6, 14, Math.PI), M.mug, { pos: [-0.505, top + 0.05, -2.55], rot: [0, 0, -Math.PI / 2] });
  for (const [x, z, s] of [[-0.38, -2.78, 0.09], [-0.62, -2.98, 0.085], [1.22, -3.0, 0.09]]) {
    b.plane(s, s, M.ring, [x, top + 0.0012, z], { rot: [-Math.PI / 2, 0, x * 3] });
  }
  // Pen cup.
  b.cyl(0.04, 0.036, 0.1, M.plastic, [-0.75, top + 0.05, -3.18], { open: true, seg: 14 });
  for (const [dx, dz, rx, rz, mat] of [[0.01, 0, 0.15, 0.1, M.red], [-0.012, 0.008, -0.1, -0.12, M.binderBlue], [0, -0.01, 0.2, -0.05, M.plastic]]) {
    b.cyl(0.004, 0.004, 0.15, mat, [-0.75 + dx, top + 0.1, -3.18 + dz], { rot: [rx, 0, rz], seg: 6 });
  }
  // Binders standing against the wall.
  [[M.binderRed, 0.63, -0.04], [M.binderGrey, 0.69, -0.02], [M.binderBlue, 0.75, 0.0], [M.binderGrey, 0.82, 0.14]].forEach(([mat, x, rz]) => {
    b.box(0.05, 0.29, 0.24, mat, [x, top + 0.145, -3.2], { rot: [0, 0, rz], cast: true });
    b.box(0.002, 0.08, 0.05, M.label, [x - 0.026, top + 0.18, -3.1], { rot: [0, 0, rz] });
  });
  // Desk phone with a coiled cord.
  const phone = new THREE.Group();
  phone.position.set(-1.92, top, -3.02);
  phone.rotation.y = 0.35;
  b.group.add(phone);
  b.rbox(0.2, 0.07, 0.22, 0.02, M.beige, [0, 0.035, 0], { parent: phone, rot: [0.12, 0, 0], cast: true });
  b.box(0.12, 0.004, 0.1, M.beigeDark, [0, 0.07, 0.035], { parent: phone, rot: [0.12, 0, 0] });
  b.rbox(0.22, 0.045, 0.055, 0.018, M.beige, [0, 0.09, -0.06], { parent: phone, cast: true });
  const coil = [];
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    coil.push([-0.11 - t * 0.05 + Math.cos(t * 50) * 0.008, 0.07 - t * 0.065 + Math.sin(t * 50) * 0.008, -0.06 + t * 0.12]);
  }
  b.cable(coil, 0.003, M.beigeDark, { seg: 120, parent: phone });
  // Desk lamp, switched off.
  const lamp = new THREE.Group();
  lamp.position.set(1.95, top, -3.12);
  lamp.rotation.y = -0.6;
  b.group.add(lamp);
  b.cyl(0.07, 0.075, 0.025, M.steelDark, [0, 0.012, 0], { parent: lamp, cast: true });
  b.cyl(0.008, 0.008, 0.36, M.steelDark, [0, 0.19, 0.04], { parent: lamp, rot: [0.25, 0, 0], cast: true });
  b.cyl(0.008, 0.008, 0.3, M.steelDark, [0, 0.38, 0.17], { parent: lamp, rot: [1.2, 0, 0], cast: true });
  b.cyl(0.03, 0.085, 0.12, M.steelDark, [0, 0.36, 0.3], { parent: lamp, rot: [0.5, 0, 0], open: true, cast: true });
  // Thermos.
  b.cyl(0.04, 0.04, 0.24, M.chrome, [1.98, top + 0.12, -2.72], { seg: 18, cast: true });
  b.cyl(0.044, 0.044, 0.06, M.red, [1.98, top + 0.27, -2.72], { seg: 18 });
}

/** Details on the monitors: CRT backs, power LEDs, sticky notes. */
function monitorDetails(b, M) {
  // Main monitor: group at (0, 1.27, -3.08), tilted -0.06; bezel 1.02 x 0.72, front at z +0.02.
  const mon = new THREE.Group();
  mon.position.set(0, 1.27, -3.08);
  mon.rotation.x = -0.06;
  b.group.add(mon);
  // The CRT's tapered back: a square frustum, narrow end towards the wall.
  const crt = new THREE.CylinderGeometry(0.44, 0.64, 0.15, 4, 1).rotateY(Math.PI / 4).rotateX(-Math.PI / 2).scale(1, 0.72, 1);
  b.add(crt, M.plastic, { pos: [0, 0, -0.17], parent: mon, cast: true });
  b.box(0.012, 0.012, 0.004, M.label, [0.44, -0.33, 0.024], { parent: mon });
  b.plane(0.08, 0.08, M.stickyYellow, [-0.45, -0.29, 0.026], { parent: mon, rot: [0, 0, 0.12] });
  b.plane(0.075, 0.075, M.stickyBlue, [0.455, 0.3, 0.026], { parent: mon, rot: [0, 0, -0.18] });
  // Left terminal: sticky note on the bezel.
  const term = new THREE.Group();
  term.position.set(-1.3, 1.13, -2.98);
  term.rotation.set(-0.05, 0.38, 0);
  b.group.add(term);
  b.plane(0.07, 0.07, M.stickyPink, [0.27, -0.2, 0.034], { parent: term, rot: [0, 0, 0.2] });
  // Cables from the monitors down behind the desk.
  for (const x of [-1.25, -0.2, 0.2, 1.25]) {
    b.cable([[x, 1.05, -3.25], [x + 0.05, 0.85, -3.3], [x * 0.7, 0.4, -3.32], [x * 0.5 + 0.3, 0.03, -3.28]], 0.006, M.rubber);
  }
  b.box(0.42, 0.04, 0.07, M.beige, [0.5, 0.02, -3.25]);
}

// --------------------------------------------------------------------- room

function room(b, M, kit) {
  // Rubber mat under the chair.
  b.box(1.3, 0.006, 1.05, M.mat, [0.15, 0.003, -1.85], { rot: [0, 0.08, 0] });
  // Floor cables from the rack to the desk under a hazard-striped cover.
  b.box(1.5, 0.02, 0.12, kit.m.hazard, [-2.7, 0.01, -2.45], { rot: [0, 0.12, 0] });
  b.cable([[-3.4, 0.6, -2.6], [-3.38, 0.05, -2.5], [-3.2, 0.01, -2.46], [-2.1, 0.01, -2.6], [-2.05, 0.15, -2.75]], 0.012, M.rubber);
  // Cable tray under the ceiling: rack to the desk, with a bundle dropping down.
  b.box(3.0, 0.015, 0.22, M.steelDark, [-2.05, 2.2, -3.15]);
  for (const s of [-1, 1]) b.box(3.0, 0.06, 0.01, M.steelDark, [-2.05, 2.23, -3.15 + s * 0.11]);
  for (let i = 0; i < 4; i++) b.cable([[-3.5, 2.21 + i * 0.008, -3.18 + i * 0.02], [-1.0, 2.21 + i * 0.008, -3.15 + i * 0.02], [-0.6, 2.0, -3.2], [-0.62, 1.45, -3.3 + i * 0.01], [-0.5, 1.15, -3.28]], 0.009, M.rubber);
  b.cable([[-3.75, 2.0, -3.0], [-3.7, 2.2, -3.12], [-3.4, 2.22, -3.15]], 0.02, M.rubber);
  // Conduit from the door panels and the power panel up into the ceiling.
  for (const s of [-1, 1]) {
    b.cyl(0.018, 0.018, 1.05, M.steelDark, [s * 4.31, 2.1, -1.95], { seg: 8 });
    b.box(0.12, 0.12, 0.06, M.steelDark, [s * 4.3, 2.68, -1.95], { rot: [0, Math.PI / 2, 0] });
  }
  b.cyl(0.02, 0.02, 0.85, M.steelDark, [-3.15, 2.3, 3.31], { seg: 8 });
  b.cyl(0.016, 0.016, 0.6, M.steelDark, [3.62, 1.8, -3.31], { seg: 8 });
  // Cork board on the north wall.
  b.box(0.92, 0.62, 0.03, M.wood, [-2.5, 1.78, -3.33]);
  b.plane(0.86, 0.56, M.cork, [-2.5, 1.78, -3.313]);
  const sheets = [
    [-2.78, 1.86, 0.08, ['SHIFT ROTA', '', 'NIGHTS: CONTRACT', 'DAYS: -']],
    [-2.42, 1.9, -0.05, ['FIRE ASSEMBLY', 'POINT B', '', 'LEVEL 1 YARD']],
    [-2.18, 1.66, 0.12, ['DO NOT USE', 'LIFT 2']],
    [-2.66, 1.6, -0.1, ['ACOUSTICS', 'QUIET HOURS', '00:00-06:00']]
  ];
  sheets.forEach(([x, y, rz, lines], i) => {
    const mat = new THREE.MeshLambertMaterial({ map: TX.paperTexture(lines, { width: 128, height: 160, seed: 40 + i }) });
    b.plane(0.17, 0.21, mat, [x, y, -3.31], { rot: [0, 0, rz] });
    b.add(new THREE.SphereGeometry(0.008, 6, 4), M.pin, { pos: [x, y + 0.09, -3.3] });
  });
  // Stencilled wall marking: the station's number.
  b.plane(1.1, 0.34, M.stencil, [2.35, 2.05, -3.343]);
  // Signs.
  const sign = (text, sub, w, h, pos, ry) => b.plane(w, h, new THREE.MeshLambertMaterial({ map: TX.signTexture(text, { sub, width: 512, height: 160, font: 'bold 52px "Courier New", monospace' }) }), pos, { rot: [0, ry, 0] });
  sign('AUTHORIZED', 'PERSONNEL ONLY', 0.5, 0.16, [3.75, 1.95, 3.34], Math.PI);
  sign('NO SMOKING', 'HELIX RESEARCH DIRECTORATE', 0.42, 0.13, [-4.34, 2.0, 0.85], Math.PI / 2);
  // Fire extinguisher beside the rear doorway.
  b.box(0.12, 0.06, 0.05, M.steelDark, [1.55, 0.92, 3.32]);
  b.cyl(0.075, 0.075, 0.46, M.red, [1.55, 0.6, 3.24], { seg: 18, cast: true });
  b.add(new THREE.SphereGeometry(0.075, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.red, { pos: [1.55, 0.83, 3.24] });
  b.cyl(0.018, 0.018, 0.06, M.steelDark, [1.55, 0.9, 3.24], { seg: 8 });
  b.box(0.12, 0.012, 0.03, M.steelDark, [1.55, 0.94, 3.24]);
  b.cable([[1.55, 0.9, 3.21], [1.48, 0.86, 3.17], [1.47, 0.5, 3.17], [1.5, 0.42, 3.18]], 0.01, M.rubber);
  b.plane(0.18, 0.18, new THREE.MeshLambertMaterial({ map: TX.signTexture('FIRE', { bg: '#8e1a14', fg: '#f0e8d8', width: 256, height: 256, border: '#f0e8d8', font: 'bold 72px "Arial Black", Impact, sans-serif' }) }), [1.55, 1.15, 3.343], { rot: [0, Math.PI, 0] });
  kit.addCollider(1.45, 1.65, 3.12, 3.35);
  // Cardboard boxes in the south-east corner.
  b.box(0.5, 0.4, 0.42, M.cardboardLabel, [3.85, 0.2, 2.95], { rot: [0, 0.1, 0], cast: true });
  b.box(0.42, 0.32, 0.38, M.cardboard, [3.8, 0.56, 2.98], { rot: [0, -0.15, 0], cast: true });
  b.box(0.36, 0.3, 0.32, M.cardboard, [3.95, 0.15, 2.35], { rot: [0, 0.35, 0], cast: true });
  kit.addCollider(3.55, 4.3, 2.15, 3.3);
  // Crumpled paper around the bin.
  for (const [x, y, z, r] of [[-3.5, 0.37, -1.9, 0.035], [-3.44, 0.35, -1.95, 0.03], [-3.28, 0.024, -1.72, 0.03], [-3.62, 0.022, -1.55, 0.028]]) {
    b.add(new THREE.SphereGeometry(r, 5, 4), M.paper, { pos: [x, y, z], rot: [x * 7, z * 5, 0], scale: [1, 0.8, 1.1] });
  }
  // Stains: water from the pipes, rust under the joints, scuffed floor at the doors.
  b.plane(1.2, 1.4, M.stainWall, [-1.2, 2.3, -3.343]);
  b.plane(0.9, 1.2, M.stainRust, [3.0, 2.2, -3.343]);
  b.plane(1.0, 1.3, M.stainWall, [4.343, 2.2, 2.6], { rot: [0, -Math.PI / 2, 0] });
  b.plane(0.8, 1.0, M.stainRust, [-4.343, 2.3, 1.6], { rot: [0, Math.PI / 2, 0] });
  for (const [x, z, s] of [[-3.6, -0.5, 1.4], [3.6, -0.5, 1.4], [2.5, 2.9, 1.2], [-0.8, 0.6, 1.6], [1.3, -1.0, 1.0]]) {
    b.plane(s, s, M.stainFloor, [x, 0.004, z], { rot: [-Math.PI / 2, 0, x] });
  }
}

/**
 * Dresses the station. Returns the chair group (the desk chair is part of
 * the CAM 13 shot, so it is kept as its own object).
 */
export function dressStation(parent, kit, m) {
  const M = materials(m);
  const b = new Builder(parent, kit);
  desk(b, M);
  const seat = chair(b, M, b.group);
  deskClutter(b, M);
  monitorDetails(b, M);
  room(b, M, kit);
  b.finish();
  return seat;
}
