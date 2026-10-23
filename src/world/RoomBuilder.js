import * as THREE from 'three';
import { Kit } from '../render/Materials.js';
import * as TX from '../render/Textures.js';
import { ROOMS } from '../config/FacilityLayout.js';

/**
 * Remote rooms are only ever seen through surveillance cameras. Each one is a
 * small scene with its own lights, a feed camera, and anchor points where
 * entities stand when the simulation places them there.
 *
 * Anchor order matches ENTITY_ORDER: Wanderer, Observer, Echo, Patient.
 */
export function buildRemoteRooms(materials) {
  const rooms = {};
  const add = (id, builder) => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x010101);
    scene.fog = new THREE.Fog(0x020202, 4, 26);
    const kit = new Kit(materials);
    const desc = builder(scene, kit, materials, id);
    rooms[id] = { id, scene, main: false, ...desc };
  };
  add('CONTAINMENT_A', containment);
  add('CONTAINMENT_B', containment);
  add('ISOLATION', isolation);
  add('ACOUSTICS_LAB', acoustics);
  add('RESEARCH_HALL', research);
  add('STORAGE', storage);
  add('CENTRAL_JUNCTION', junction);
  add('WEST_CORRIDOR', corridor);
  add('EAST_CORRIDOR', corridor);
  add('VENT_SHAFT', ventShaft);
  return rooms;
}

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
/** Remote rooms are only seen through low-light cameras; they are lit a little hotter. */
const REMOTE_LIGHT_GAIN = 2.4;

function cam(pos, target, fov = 72) {
  const c = new THREE.PerspectiveCamera(fov, 4 / 3, 0.05, 50);
  c.position.set(...pos);
  c.lookAt(v3(...target));
  return c;
}

function facingTo(from, to) {
  return Math.atan2(to[0] - from[0], to[2] - from[2]);
}

function anchor(pos, lookAt) {
  return { pos: v3(...pos), facing: facingTo(pos, lookAt) };
}

function sign(kit, parent, text, sub, x, y, z, ry = 0, w = 1.4) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.25), new THREE.MeshBasicMaterial({ map: TX.signTexture(text, { sub }), color: 0x8a8a84 }));
  mesh.position.set(x, y, z);
  mesh.rotation.y = ry;
  parent.add(mesh);
  return mesh;
}

function fixture(kit, scene, m, x, y, z, { intensity = 6, distance = 9, color = 0xdfe6dc, broken = false, length = 1.2 } = {}) {
  kit.box(scene, 0.3, 0.07, length + 0.1, m.metal, x, y + 0.04, z, { tile: false });
  const tube = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, length), broken ? m.tubeOff : m.tube.clone());
  tube.position.set(x, y, z);
  scene.add(tube);
  let light = null;
  const I = intensity * REMOTE_LIGHT_GAIN;
  if (!broken) {
    light = new THREE.PointLight(color, I, distance * 1.3, 2);
    light.position.set(x, y - 0.15, z);
    scene.add(light);
  }
  return { tube, light, base: I };
}

// ---------------------------------------------------------------- rooms

function containment(scene, kit, m, id) {
  const label = id === 'CONTAINMENT_A' ? 'CONTAINMENT A' : 'CONTAINMENT B';
  kit.room(scene, { x0: -4, x1: 4, z0: -3.5, z1: 3.5, h: 3.2, wall: m.concrete, floor: m.floor, collide: false });
  // Glass partition with an open cell door.
  for (const [x0, x1] of [[-4, -1.2], [0.2, 1.4]]) {
    kit.box(scene, x1 - x0, 2.6, 0.04, m.glassDirty, (x0 + x1) / 2, 1.3, -0.8, { tile: false });
    kit.box(scene, x1 - x0, 0.1, 0.12, m.metalDark, (x0 + x1) / 2, 2.65, -0.8, { tile: false });
  }
  kit.box(scene, 1.4, 2.6, 0.08, m.door, -0.5, 1.3, -1.6, { ry: 0.9, tile: 1.2 });
  kit.box(scene, 2.6, 0.1, 0.12, m.metalDark, 2.7, 2.65, -0.8, { tile: false });
  kit.box(scene, 0.1, 3.2, 0.12, m.metalDark, 1.4, 1.6, -0.8, { tile: false });
  // Cell interior: bed frame, restraint chair, scratch marks (dark stripes).
  kit.box(scene, 1.0, 0.1, 2.0, m.metal, -3.2, 0.5, -2.4, { cast: true });
  for (const [x, z] of [[-3.65, -3.3], [-2.75, -3.3], [-3.65, -1.5], [-2.75, -1.5]]) kit.box(scene, 0.06, 0.5, 0.06, m.metalDark, x, 0.25, z);
  chair(kit, scene, m, 0.6, -2.4, 0.4);
  for (let i = 0; i < 6; i++) kit.box(scene, 0.015, 0.5 + i * 0.07, 0.01, m.black, -1.8 + i * 0.06, 1.5, -3.34, { rz: 0.15, tile: false });
  // Observation side: console and a fallen stool.
  kit.box(scene, 2.4, 0.9, 0.6, m.metalPaint, -2.2, 0.45, 2.9, { cast: true });
  kit.box(scene, 0.5, 0.35, 0.05, m.screenOff, -2.6, 1.1, 2.75, { rx: -0.3, tile: false });
  kit.cyl(scene, 0.2, 0.2, 0.05, m.metalDark, 1.2, 0.2, 2.0, { rx: Math.PI / 2 });
  sign(kit, scene, label, 'HELIX R.D. / N-17', 0, 2.55, 3.33, Math.PI, 1.6);
  const cellLight = fixture(kit, scene, m, -2.0, 3.12, -2.2, { intensity: 7, distance: 8 });
  const obsLight = fixture(kit, scene, m, 1.0, 3.12, 2.0, { intensity: 3, distance: 7, color: 0xc8c0a8 });
  scene.add(new THREE.AmbientLight(0x707a78, 0.4));
  return {
    camera: cam([3.6, 2.9, 3.1], [-1.2, 0.8, -1.5]),
    anchors: [
      anchor([-2.2, 0, -2.3], [3.6, 0, 3.1]),
      anchor([0.4, 0, 1.4], [3.6, 0, 3.1]),
      anchor([2.6, 0, -2.6], [0, 0, 0]),
      anchor([-2.0, 0, 1.0], [3.6, 0, 3.1])
    ],
    flicker: [cellLight]
  };
}

function isolation(scene, kit, m) {
  kit.room(scene, { x0: -2.6, x1: 2.6, z0: -2.6, z1: 2.6, h: 3.0, wall: m.padded, floor: m.padded, ceiling: m.ceiling, collide: false });
  chair(kit, scene, m, -0.3, -0.6, 0);
  kit.cyl(scene, 0.12, 0.12, 0.01, m.metalDark, 0.5, 0.005, 0.6, { segments: 16 });
  kit.box(scene, 0.9, 2.2, 0.1, m.door, 0, 1.1, 2.55, { tile: 1.2 });
  kit.box(scene, 0.25, 0.15, 0.02, m.glassDirty, 0, 1.7, 2.49, { tile: false });
  // Hanging bulb.
  const cord = kit.cyl(scene, 0.006, 0.006, 0.8, m.black, 0, 2.6, 0);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), m.tube.clone());
  bulb.position.set(0, 2.15, 0);
  scene.add(bulb);
  const light = new THREE.PointLight(0xd8c090, 9, 8, 2);
  light.position.set(0, 2.05, 0);
  scene.add(light);
  scene.add(new THREE.AmbientLight(0x80786a, 0.31));
  void cord;
  return {
    camera: cam([2.3, 2.75, 2.3], [-0.6, 0.6, -0.6], 80),
    anchors: [
      anchor([1.4, 0, -1.4], [2.3, 0, 2.3]),
      anchor([-1.4, 0, 1.2], [2.3, 0, 2.3]),
      anchor([1.5, 0, 0.6], [0, 0, 0]),
      anchor([-1.0, 0, -1.3], [2.3, 0, 2.3])
    ],
    flicker: [{ tube: bulb, light, base: 9 }]
  };
}

function acoustics(scene, kit, m) {
  kit.room(scene, { x0: -3.5, x1: 3.5, z0: -3, z1: 3, h: 3.2, wall: m.foam, floor: m.grime, collide: false });
  // Anechoic wedges on three walls.
  const wedge = new THREE.ConeGeometry(0.13, 0.4, 4);
  wedge.rotateX(Math.PI / 2);
  const inst = new THREE.InstancedMesh(wedge, m.foam, 420);
  const mtx = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3(1, 1, 1);
  let n = 0;
  const place = (x, y, z, dir) => {
    q.setFromUnitVectors(v3(0, 0, 1), dir);
    mtx.compose(v3(x, y, z), q, s);
    inst.setMatrixAt(n++, mtx);
  };
  for (let y = 0.3; y < 3.0; y += 0.32) {
    for (let x = -3.3; x <= 3.3; x += 0.32) place(x, y, -2.82, v3(0, 0, 1));
    for (let z = -2.8; z <= 2.6; z += 0.32) {
      place(-3.32, y, z, v3(1, 0, 0));
      if (z < 0.6 || y > 1.4) place(3.32, y, z, v3(-1, 0, 0));
    }
  }
  inst.count = n;
  scene.add(inst);
  // Duct opening (the one-way vent into the shaft).
  kit.box(scene, 0.06, 1.1, 1.3, m.void, 3.33, 0.6, 1.6, { tile: false });
  kit.box(scene, 0.1, 0.1, 1.5, m.metalDark, 3.3, 1.2, 1.6, { tile: false });
  // Speaker stand, microphone, cables.
  kit.box(scene, 0.5, 0.8, 0.45, m.plastic, -1.6, 1.3, -1.8, { cast: true });
  kit.cyl(scene, 0.03, 0.03, 0.9, m.metalDark, -1.6, 0.45, -1.8);
  kit.cyl(scene, 0.015, 0.015, 1.5, m.metalDark, 0.8, 0.75, 0.2);
  kit.cyl(scene, 0.04, 0.03, 0.12, m.metal, 0.8, 1.55, 0.2, { rx: 0.6 });
  kit.box(scene, 1.6, 0.8, 0.7, m.metalPaint, 1.6, 0.4, -2.2, { cast: true });
  sign(kit, scene, 'ACOUSTICS', 'ANECHOIC CHAMBER 2', 0, 2.75, 2.85, Math.PI, 1.4);
  const l1 = fixture(kit, scene, m, -0.5, 3.12, -0.5, { intensity: 7, distance: 9, color: 0xb8c8d8 });
  scene.add(new THREE.AmbientLight(0x6a7480, 0.35));
  return {
    camera: cam([-3.1, 2.9, 2.6], [1.0, 0.7, -0.6]),
    anchors: [
      anchor([-0.6, 0, -1.7], [-3.1, 0, 2.6]),
      anchor([1.8, 0, 1.0], [-3.1, 0, 2.6]),
      anchor([0.9, 0, -0.3], [-3.1, 0, 2.6]),
      anchor([-1.4, 0, -0.4], [-3.1, 0, 2.6])
    ],
    flicker: [l1]
  };
}

function research(scene, kit, m) {
  kit.room(scene, { x0: -6, x1: 6, z0: -4, z1: 4, h: 3.5, wall: m.concrete, floor: m.floor, collide: false });
  for (const z of [-1.6, 1.0]) {
    kit.box(scene, 6.5, 0.08, 1.1, m.metal, -0.5, 0.9, z, { cast: true });
    for (const x of [-3.5, 2.5]) for (const dz of [-0.45, 0.45]) kit.box(scene, 0.06, 0.9, 0.06, m.metalDark, x, 0.45, z + dz);
    kit.box(scene, 0.6, 0.4, 0.4, m.plasticLight, -2.4, 1.15, z, { cast: true });
    kit.box(scene, 0.5, 0.35, 0.05, m.screenOff, 0.2, 1.15, z - 0.2, { tile: false });
    kit.cyl(scene, 0.12, 0.1, 0.3, m.glass, 1.6, 1.08, z);
  }
  chair(kit, scene, m, 3.6, 2.6, 1.3, true);
  chair(kit, scene, m, -4.5, -2.9, -0.5);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.2), new THREE.MeshLambertMaterial({ map: whiteboardTexture() }));
  board.position.set(-1, 1.8, -3.84);
  scene.add(board);
  for (let i = 0; i < 9; i++) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.3), m.paper);
    p.rotation.x = -Math.PI / 2;
    p.rotation.z = i * 1.3;
    p.position.set(-4 + i * 0.9, 0.005, 2.5 + Math.sin(i * 3) * 0.8);
    scene.add(p);
  }
  // Decontamination gate (south wall, toward the junction).
  const gate = deconGate(kit, scene, m, 0, 4, Math.PI);
  sign(kit, scene, 'RESEARCH HALL', 'COGNITION DIVISION', 3.6, 2.9, -3.84, 0, 1.6);
  const f1 = fixture(kit, scene, m, -3, 3.42, 0, { intensity: 7, distance: 10 });
  const f2 = fixture(kit, scene, m, 3, 3.42, 0, { intensity: 5, distance: 10 });
  fixture(kit, scene, m, 0, 3.42, 0, { broken: true });
  scene.add(new THREE.AmbientLight(0x6f7876, 0.35));
  return {
    camera: cam([5.6, 3.2, -3.6], [-1.0, 0.6, 1.2], 78),
    anchors: [
      anchor([-2.5, 0, 2.6], [5.6, 0, -3.6]),
      anchor([1.0, 0, -0.3], [5.6, 0, -3.6]),
      anchor([-4.8, 0, -2.0], [0, 0, 0]),
      anchor([0.0, 0, 3.0], [5.6, 0, -3.6])
    ],
    decon: gate,
    flicker: [f1, f2]
  };
}

function storage(scene, kit, m) {
  scene.fog = new THREE.Fog(0x0a0e10, 3, 20);
  kit.room(scene, { x0: -4.5, x1: 4.5, z0: -3.5, z1: 3.5, h: 3.5, wall: m.concreteDark, floor: m.grime, collide: false });
  for (const x of [-3, 0, 3]) {
    for (const lvl of [0.1, 1.0, 1.9, 2.8]) kit.box(scene, 0.9, 0.05, 4.5, m.metalDark, x, lvl, -0.6);
    for (const z of [-2.8, 1.6]) for (const dx of [-0.42, 0.42]) kit.box(scene, 0.05, 2.9, 0.05, m.metalDark, x + dx, 1.45, z);
    for (let i = 0; i < 6; i++) {
      const lvl = [0.1, 1.0, 1.9][i % 3];
      kit.box(scene, 0.7, 0.55, 0.6, i % 2 ? m.wood : m.metalPaint, x, lvl + 0.3, -2.2 + i * 0.75, { cast: true });
    }
  }
  // Frost and the vent grate (Echo uses the ventilation network here).
  for (let i = 0; i < 6; i++) {
    const f = new THREE.Mesh(new THREE.CircleGeometry(0.6 + (i % 3) * 0.3, 16), m.frost);
    f.rotation.x = -Math.PI / 2;
    f.position.set(-3.5 + i * 1.4, 0.004, 2.6 - (i % 2) * 0.6);
    scene.add(f);
  }
  kit.box(scene, 1.0, 0.7, 0.06, m.void, 2.8, 0.45, 3.46, { tile: false });
  for (let i = 0; i < 5; i++) kit.box(scene, 0.95, 0.03, 0.03, m.metalDark, 2.8, 0.18 + i * 0.13, 3.42, { tile: false });
  sign(kit, scene, 'COLD STORAGE', 'KEEP SEALED  -18C', -2.5, 2.9, 3.44, Math.PI, 1.4);
  const l1 = fixture(kit, scene, m, -1.5, 3.42, 1.5, { intensity: 5, distance: 9, color: 0xa8c8e0 });
  scene.add(new THREE.AmbientLight(0x5a7080, 0.4));
  return {
    camera: cam([4.1, 3.1, 3.1], [-1.5, 0.6, -0.8]),
    anchors: [
      anchor([-1.5, 0, 2.3], [4.1, 0, 3.1]),
      anchor([1.5, 0, 2.6], [4.1, 0, 3.1]),
      anchor([2.6, 0, 2.7], [2.8, 0, 3.5]),
      anchor([-3.6, 0, 2.6], [4.1, 0, 3.1])
    ],
    flicker: [l1]
  };
}

function junction(scene, kit, m) {
  kit.room(scene, { x0: -5, x1: 5, z0: -5, z1: 5, h: 4.0, wall: m.concrete, floor: m.floor, collide: false });
  kit.box(scene, 1.0, 4.0, 1.0, m.concreteDark, 0, 2, 0, { cast: true });
  for (const [x, y, z, ry] of [[-0.51, 1.7, 0, -Math.PI / 2], [0.51, 1.7, 0, Math.PI / 2]]) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.22), new THREE.MeshBasicMaterial({ map: TX.signTexture(x < 0 ? '< WEST WING' : 'EAST WING >'), color: 0x9a9a90 }));
    s.position.set(x, y, z);
    s.rotation.y = ry;
    scene.add(s);
  }
  // Openings toward both corridors (dark).
  kit.box(scene, 0.05, 2.6, 2.0, m.void, -4.83, 1.3, 2.5, { tile: false });
  kit.box(scene, 0.05, 2.6, 2.0, m.void, 4.83, 1.3, 2.5, { tile: false });
  const gate = deconGate(kit, scene, m, 0, -5, 0);
  sign(kit, scene, 'CENTRAL JUNCTION', 'LEVEL 2', 0, 3.4, 4.84, Math.PI, 1.8);
  const exit = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.2), new THREE.MeshBasicMaterial({ color: 0x2aff7a }));
  exit.position.set(-4.84, 2.9, 2.5);
  exit.rotation.y = Math.PI / 2;
  scene.add(exit);
  kit.box(scene, 0.7, 0.9, 0.5, m.metalPaint, 3.5, 0.45, 3.8, { cast: true });
  kit.cyl(scene, 0.3, 0.3, 0.9, m.metalDark, -3.6, 0.45, -3.6);
  const l1 = fixture(kit, scene, m, -2.5, 3.92, 2.5, { intensity: 6, distance: 10 });
  const l2 = fixture(kit, scene, m, 2.5, 3.92, -2.5, { intensity: 4, distance: 10 });
  scene.add(new THREE.AmbientLight(0x6f7876, 0.35));
  return {
    camera: cam([4.5, 3.6, 4.5], [-1.0, 0.6, -1.0], 78),
    anchors: [
      anchor([-2.0, 0, 1.5], [4.5, 0, 4.5]),
      anchor([1.8, 0, -1.6], [4.5, 0, 4.5]),
      anchor([-3.2, 0, -2.0], [0, 0, 0]),
      anchor([-1.0, 0, 3.2], [4.5, 0, 4.5])
    ],
    decon: gate,
    flicker: [l1, l2]
  };
}

function corridor(scene, kit, m, id) {
  const west = id === 'WEST_CORRIDOR';
  kit.room(scene, { x0: -1.5, x1: 1.5, z0: -9, z1: 9, h: 2.8, wall: m.concrete, floor: m.grime, collide: false });
  kit.pipe(scene, [1.3, 2.5, -9], [1.3, 2.5, 9], 0.08);
  kit.pipe(scene, [1.15, 2.6, -9], [1.15, 2.6, 9], 0.04, m.pipeRust);
  kit.pipe(scene, [-1.3, 2.55, -9], [-1.3, 2.55, 9], 0.06);
  for (const z of [-5, 1, 6]) {
    kit.box(scene, 0.08, 2.2, 1.1, m.door, -1.47, 1.1, z, { tile: 1.2 });
    kit.box(scene, 0.04, 0.1, 0.3, m.metalDark, -1.42, 1.1, z + 0.35, { tile: false });
  }
  kit.box(scene, 0.06, 2.6, 2.6, m.void, 0, 1.3, -8.95, { tile: false, ry: Math.PI / 2 });
  sign(kit, scene, west ? 'WEST CORRIDOR' : 'EAST CORRIDOR', 'SECURITY  v', 0, 2.25, 8.94, Math.PI, 1.3);
  const lamps = [];
  for (const z of [-6, -1.5, 3, 7.5]) {
    kit.box(scene, 0.32, 0.07, 1.3, m.metal, 0, 2.78, z, { tile: false });
    const tube = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 1.2), m.tubeOff.clone());
    tube.position.set(0, 2.74, z);
    scene.add(tube);
    lamps.push(tube);
  }
  const bright = [-4, 3].map((z) => {
    const l = new THREE.PointLight(0xeef4ea, 0, 12, 2);
    l.position.set(0, 2.5, z);
    scene.add(l);
    return l;
  });
  const emergency = new THREE.PointLight(0x9a5a40, 4, 16, 2);
  emergency.position.set(0, 2.5, -1.0);
  const tail = new THREE.PointLight(0x9a5a40, 2.5, 10, 2);
  tail.position.set(0, 2.4, 6.5);
  scene.add(tail);
  scene.add(emergency);
  scene.add(new THREE.AmbientLight(0x5a6462, 0.26));
  return {
    camera: cam([0.9, 2.55, 8.6], [-0.2, 0.9, -4.0], 70),
    anchors: [
      anchor([0.2, 0, -2.5], [0.9, 0, 8.6]),
      anchor([-0.6, 0, 2.5], [0.9, 0, 8.6]),
      anchor([0.5, 0, -6.0], [0, 0, 0]),
      anchor([0.0, 0, 0.0], [0.9, 0, 8.6])
    ],
    corridorLights: { tubes: lamps, bright, emergency }
  };
}

function ventShaft(scene, kit, m) {
  scene.fog = new THREE.Fog(0x010101, 2, 14);
  const g = new THREE.Group();
  scene.add(g);
  kit.box(g, 1.6, 0.06, 14, m.metalDark, 0, 0, 0, { tile: 1 });
  kit.box(g, 1.6, 0.06, 14, m.metalDark, 0, 1.5, 0, { tile: 1 });
  kit.box(g, 0.06, 1.5, 14, m.metalDark, -0.8, 0.75, 0, { tile: 1 });
  kit.box(g, 0.06, 1.5, 14, m.metalDark, 0.8, 0.75, 0, { tile: 1 });
  for (let z = -6.5; z <= 6.5; z += 1.3) kit.box(g, 1.62, 0.05, 0.06, m.metal, 0, 0.03, z, { tile: false });
  // Slatted grilles letting in light from rooms below.
  const lights = [];
  for (const z of [-3.5, 2.5]) {
    for (let i = -2; i <= 2; i++) kit.box(g, 0.5, 0.04, 0.05, m.tube.clone(), 0, 0.02, z + i * 0.12, { tile: false });
    const l = new THREE.PointLight(0x9aa8a4, 3.5, 5, 2);
    l.position.set(0, 0.25, z);
    scene.add(l);
    lights.push(l);
  }
  // Fan at the far end.
  const fan = new THREE.Group();
  fan.position.set(0, 0.75, -6.9);
  scene.add(fan);
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.6, 0.02), m.metal);
    b.geometry.translate(0, 0.3, 0);
    b.rotation.z = (i / 4) * Math.PI * 2;
    fan.add(b);
  }
  scene.add(new THREE.AmbientLight(0x404848, 0.26));
  return {
    camera: cam([0.5, 1.3, 6.6], [-0.1, 0.4, -3.0], 75),
    anchors: [
      anchor([0, 0.03, -1.5], [0.5, 0, 6.6]),
      anchor([0, 0.03, 0.5], [0.5, 0, 6.6]),
      anchor([0, 0.03, 1.2], [0.5, 0, 6.6]),
      anchor([0, 0.03, -3], [0.5, 0, 6.6])
    ],
    spinner: fan,
    flicker: lights.map((l) => ({ light: l, base: 3.5 }))
  };
}

// ---------------------------------------------------------------- props

function chair(kit, parent, m, x, z, ry, fallen = false) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  if (fallen) {
    g.rotation.z = Math.PI / 2;
    g.position.y = 0.25;
  }
  parent.add(g);
  kit.box(g, 0.5, 0.06, 0.5, m.metalDark, 0, 0.48, 0, { tile: false, cast: true });
  kit.box(g, 0.5, 0.55, 0.05, m.metalDark, 0, 0.78, -0.24, { tile: false, cast: true });
  for (const [dx, dz] of [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]]) kit.box(g, 0.04, 0.48, 0.04, m.metal, dx, 0.24, dz, { tile: false });
  // Restraint straps.
  kit.box(g, 0.52, 0.04, 0.08, m.rubber, 0, 0.53, 0.1, { tile: false });
  return g;
}

function deconGate(kit, scene, m, x, z, ry) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  scene.add(g);
  kit.box(g, 3.0, 0.3, 0.4, m.hazard, 0, 3.0, 0.1, { tile: false });
  kit.box(g, 0.25, 3.0, 0.4, m.metalDark, -1.55, 1.5, 0.1);
  kit.box(g, 0.25, 3.0, 0.4, m.metalDark, 1.55, 1.5, 0.1);
  kit.box(g, 2.86, 2.8, 0.05, m.void, 0, 1.4, -0.02, { tile: false });
  const shutter = kit.box(g, 2.9, 2.8, 0.12, m.door, 0, 4.2, 0.18, { tile: 1.4 });
  const beaconMat = m.ledAmber.clone();
  const beacon = kit.box(g, 0.25, 0.15, 0.15, beaconMat, 1.2, 3.25, 0.25, { tile: false });
  const light = new THREE.PointLight(0xffa020, 0, 7, 2);
  light.position.set(1.2, 3.0, 0.8);
  g.add(light);
  const label = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.3), new THREE.MeshBasicMaterial({ map: TX.signTexture('DECON', { sub: 'CYCLE IN PROGRESS', bg: '#2a2410' }) }));
  label.position.set(0, 2.62, 0.31);
  g.add(label);
  return { shutter, beacon, beaconMat, light, label, closedY: 1.4, openY: 4.2 };
}

function whiteboardTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#cfd2cc';
  ctx.fillRect(0, 0, 512, 256);
  ctx.strokeStyle = 'rgba(40,50,120,0.75)';
  ctx.fillStyle = 'rgba(40,50,120,0.8)';
  ctx.lineWidth = 3;
  ctx.font = '22px "Comic Sans MS", cursive';
  ctx.fillText('P(move) = AI / 20 ?', 30, 50);
  ctx.fillText('it waits. it LEARNS.', 30, 95);
  ctx.fillText('do not watch 02 > 30s', 250, 150);
  ctx.strokeStyle = 'rgba(160,30,30,0.7)';
  ctx.beginPath();
  ctx.arc(380, 80, 50, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(160,30,30,0.8)';
  ctx.fillText('5?', 368, 88);
  ctx.strokeStyle = 'rgba(30,30,30,0.5)';
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(30 + i * 40, 200);
    ctx.lineTo(60 + i * 40, 180 + (i % 2) * 30);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export const REMOTE_ROOM_IDS = Object.keys(ROOMS).filter((id) => ROOMS[id].camera && ROOMS[id].zone !== 'approach');
