import * as THREE from 'three';

/**
 * Procedural entity models. Each faces +Z in local space and stands on y = 0.
 * They are built from simple primitives but with distinct proportions:
 *   Wanderer  very tall, thin, hunched, arms reaching the knees
 *   Observer  rigid pale mannequin with a black reflective faceplate
 *   Echo      low crawling form with too many limbs and acoustic fins
 *   Patient   huge, wide, draped, head bowed
 */

function limb(parent, mat, from, to, radius) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const len = a.distanceTo(b);
  const geo = new THREE.CapsuleGeometry(radius, Math.max(0.01, len - radius * 2), 4, 8);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function blob(parent, mat, r, pos, scale = [1, 1, 1]) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat);
  m.position.set(...pos);
  m.scale.set(...scale);
  m.castShadow = true;
  parent.add(m);
  return m;
}

export function createWanderer() {
  const root = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0x2b2724, roughness: 0.92, metalness: 0.0 });
  const pale = new THREE.MeshStandardMaterial({ color: 0x4a4440, roughness: 0.85 });
  const body = new THREE.Group();
  root.add(body);
  // Legs (slightly bent).
  for (const s of [-1, 1]) {
    limb(body, skin, [s * 0.1, 1.08, -0.02], [s * 0.12, 0.56, 0.08], 0.055);
    limb(body, skin, [s * 0.12, 0.56, 0.08], [s * 0.11, 0.05, -0.02], 0.045);
    blob(body, skin, 0.06, [s * 0.11, 0.04, 0.06], [1, 0.5, 1.8]);
  }
  blob(body, skin, 0.15, [0, 1.12, 0], [1.2, 0.8, 0.9]);
  // Hunched torso.
  const torso = new THREE.Group();
  torso.position.set(0, 1.15, 0);
  torso.rotation.x = 0.32;
  body.add(torso);
  const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.7, 4, 10), skin);
  chest.position.y = 0.45;
  chest.scale.set(1.25, 1, 0.8);
  chest.castShadow = true;
  torso.add(chest);
  for (let i = 0; i < 5; i++) blob(torso, pale, 0.025, [0, 0.2 + i * 0.13, -0.13], [1, 0.6, 1]);
  // Arms reaching below the knees.
  const arms = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(s * 0.24, 0.85, 0.02);
    torso.add(arm);
    limb(arm, skin, [0, 0, 0], [s * 0.06, -0.55, 0.05], 0.04);
    limb(arm, skin, [s * 0.06, -0.55, 0.05], [s * 0.05, -1.12, 0.18], 0.033);
    for (let f = 0; f < 4; f++) limb(arm, pale, [s * 0.05, -1.12, 0.18], [s * (0.03 + f * 0.015), -1.33 - (f % 2) * 0.04, 0.22 + f * 0.012], 0.009);
    arms.push(arm);
  }
  // Long neck, small tilted head.
  const neck = new THREE.Group();
  neck.position.set(0, 0.95, 0.05);
  torso.add(neck);
  limb(neck, skin, [0, 0, 0], [0, 0.22, 0.12], 0.035);
  const head = blob(neck, pale, 0.11, [0, 0.3, 0.17], [0.8, 1.35, 0.95]);
  head.rotation.z = 0.55;
  root.userData = { kind: 'WANDERER', body, torso, arms, neck, head, materials: [skin, pale] };
  return root;
}

export function createObserver() {
  const root = new THREE.Group();
  const shell = new THREE.MeshStandardMaterial({ color: 0xb9b5aa, roughness: 0.55, metalness: 0.05 });
  const joint = new THREE.MeshStandardMaterial({ color: 0x6d6a62, roughness: 0.7 });
  const visor = new THREE.MeshStandardMaterial({ color: 0x050607, roughness: 0.08, metalness: 0.95 });
  const body = new THREE.Group();
  root.add(body);
  for (const s of [-1, 1]) {
    limb(body, shell, [s * 0.1, 0.95, 0], [s * 0.1, 0.5, 0], 0.07);
    blob(body, joint, 0.06, [s * 0.1, 0.5, 0]);
    limb(body, shell, [s * 0.1, 0.5, 0], [s * 0.1, 0.06, 0], 0.06);
    blob(body, shell, 0.06, [s * 0.1, 0.04, 0.05], [1, 0.5, 1.7]);
  }
  blob(body, shell, 0.16, [0, 0.98, 0], [1.1, 0.7, 0.75]);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.42, 4, 12), shell);
  torso.position.y = 1.28;
  torso.scale.set(1.15, 1, 0.7);
  torso.castShadow = true;
  body.add(torso);
  for (const s of [-1, 1]) {
    blob(body, joint, 0.06, [s * 0.25, 1.52, 0]);
    limb(body, shell, [s * 0.26, 1.5, 0], [s * 0.27, 1.12, 0], 0.048);
    blob(body, joint, 0.045, [s * 0.27, 1.12, 0]);
    limb(body, shell, [s * 0.27, 1.12, 0], [s * 0.27, 0.78, 0.02], 0.042);
    blob(body, shell, 0.05, [s * 0.27, 0.72, 0.02], [0.7, 1.3, 0.6]);
  }
  limb(body, joint, [0, 1.55, 0], [0, 1.66, 0], 0.045);
  const head = new THREE.Group();
  head.position.set(0, 1.78, 0);
  body.add(head);
  blob(head, shell, 0.12, [0, 0, 0], [0.9, 1.22, 1.0]);
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.11, 18, 12, -Math.PI / 2, Math.PI, 0.35, 1.9), visor);
  face.scale.set(0.92, 1.2, 1.02);
  face.position.z = 0.012;
  head.add(face);
  root.userData = { kind: 'OBSERVER', body, head, materials: [shell, joint, visor] };
  return root;
}

export function createEcho() {
  const root = new THREE.Group();
  const hide = new THREE.MeshStandardMaterial({ color: 0x1a1d1e, roughness: 0.42, metalness: 0.15 });
  const membrane = new THREE.MeshStandardMaterial({ color: 0x3a3230, roughness: 0.6, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
  const body = new THREE.Group();
  root.add(body);
  const spine = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.85, 4, 10), hide);
  spine.rotation.x = Math.PI / 2 - 0.25;
  spine.position.set(0, 0.72, -0.05);
  spine.castShadow = true;
  body.add(spine);
  const limbs = [];
  const legDefs = [
    [0.18, 0.95, 0.35, 0.55, 0.6], [-0.18, 0.95, 0.35, -0.55, 0.6],
    [0.2, 0.7, 0.0, 0.62, 0.05], [-0.2, 0.7, 0.0, -0.62, 0.05],
    [0.17, 0.55, -0.4, 0.5, -0.65], [-0.17, 0.55, -0.4, -0.5, -0.65]
  ];
  for (const [x, y, z, fx, fz] of legDefs) {
    const g = new THREE.Group();
    body.add(g);
    const knee = [x * 2.2, y + 0.28, (z + fz) / 2];
    limb(g, hide, [x, y, z], knee, 0.03);
    limb(g, hide, knee, [fx, 0.02, fz], 0.022);
    limbs.push(g);
  }
  const head = new THREE.Group();
  head.position.set(0, 0.55, 0.62);
  body.add(head);
  blob(head, hide, 0.13, [0, 0, 0.08], [0.75, 0.6, 1.7]);
  const fins = [];
  for (let i = 0; i < 4; i++) {
    const fin = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.42), membrane);
    fin.position.set((i < 2 ? -1 : 1) * 0.1, 0.1 + (i % 2) * 0.05, -0.05);
    fin.rotation.set(-0.4, (i < 2 ? -1 : 1) * (0.9 + (i % 2) * 0.4), 0);
    head.add(fin);
    fins.push(fin);
  }
  root.userData = { kind: 'ECHO', body, limbs, head, fins, materials: [hide, membrane] };
  return root;
}

export function createPatient() {
  const root = new THREE.Group();
  const cloth = new THREE.MeshStandardMaterial({ color: 0x4f5446, roughness: 0.97, side: THREE.DoubleSide });
  const skin = new THREE.MeshStandardMaterial({ color: 0x8a8576, roughness: 0.8 });
  const body = new THREE.Group();
  root.add(body);
  // Draped cloak via a lathe profile with folds.
  const profile = [
    [0.58, 0.0], [0.6, 0.15], [0.57, 0.6], [0.55, 1.0], [0.56, 1.35], [0.5, 1.55], [0.32, 1.7], [0.18, 1.78], [0.0, 1.8]
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const lathe = new THREE.LatheGeometry(profile, 40);
  const pos = lathe.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = pos.getY(i);
    const a = Math.atan2(z, x);
    const fold = 1 + 0.06 * Math.sin(a * 9) * (1 - y / 1.9) + 0.03 * Math.sin(a * 23);
    pos.setX(i, x * fold * 1.1);
    pos.setZ(i, z * fold * 0.85);
  }
  lathe.computeVertexNormals();
  const cloak = new THREE.Mesh(lathe, cloth);
  cloak.castShadow = true;
  body.add(cloak);
  // Bowed, hooded head.
  const head = new THREE.Group();
  head.position.set(0, 1.78, 0.14);
  head.rotation.x = 0.6;
  body.add(head);
  blob(head, cloth, 0.24, [0, 0.05, 0], [1, 1.1, 1.15]);
  blob(head, skin, 0.13, [0, -0.04, 0.12], [0.9, 1.1, 0.8]);
  // Heavy hands emerging from the folds.
  for (const s of [-1, 1]) {
    blob(body, skin, 0.09, [s * 0.5, 0.82, 0.22], [1, 1.3, 0.8]);
    for (let f = 0; f < 4; f++) limb(body, skin, [s * 0.5, 0.75, 0.25], [s * (0.47 + f * 0.02), 0.6, 0.27 + f * 0.015], 0.018);
  }
  root.userData = { kind: 'PATIENT', body, head, cloak, materials: [cloth, skin] };
  return root;
}

/** Per-frame idle animation. `t` is seconds, `calm` 0..1 scales jitter. */
export function animateModel(model, t, { reducedMotion = false, reducedDistortion = false, agitation = 0 } = {}) {
  const u = model.userData;
  const amp = reducedMotion ? 0.4 : 1;
  switch (u.kind) {
    case 'WANDERER': {
      u.body.rotation.y = Math.sin(t * 0.35) * 0.04 * amp;
      u.torso.rotation.x = 0.32 + Math.sin(t * 0.6) * 0.025 * amp;
      u.neck.rotation.z = Math.sin(t * 0.21) * 0.12 * amp;
      u.arms[0].rotation.x = Math.sin(t * 0.5) * 0.05 * amp;
      u.arms[1].rotation.x = Math.sin(t * 0.5 + 1.3) * 0.05 * amp;
      break;
    }
    case 'OBSERVER':
      // Motionless by design. Only the head turns (driven by the presenter).
      break;
    case 'ECHO': {
      const j = reducedDistortion ? 0.15 : 1;
      const glitch = Math.sin(t * 13.7) * Math.sin(t * 7.3) > 0.85 ? 1 : 0;
      u.body.position.x = (Math.sin(t * 31) * 0.01 + glitch * 0.04 * Math.sin(t * 90)) * j;
      u.body.position.y = Math.sin(t * 1.4) * 0.03;
      u.limbs.forEach((l, i) => {
        l.rotation.z = Math.sin(t * (2.3 + i * 0.4)) * 0.05 * amp + glitch * 0.15 * j * Math.sin(i * 7 + t * 50);
      });
      u.head.rotation.y = Math.sin(t * 0.8) * 0.4 * amp;
      u.fins.forEach((f, i) => {
        f.scale.y = 1 + Math.sin(t * 3 + i) * 0.15;
      });
      break;
    }
    case 'PATIENT': {
      const breathe = Math.sin(t * 0.5) * 0.5 + 0.5;
      u.body.scale.set(1 + breathe * 0.02, 1 + breathe * 0.012, 1 + breathe * 0.02);
      u.head.rotation.x = 0.6 + Math.sin(t * 0.15) * 0.04 * amp;
      break;
    }
  }
}

export function setModelOpacity(model, opacity) {
  for (const mat of model.userData.materials) {
    const wantTransparent = opacity < 0.999 || mat.userData.alwaysTransparent;
    if (mat.userData.baseOpacity === undefined) {
      mat.userData.baseOpacity = mat.opacity;
      mat.userData.alwaysTransparent = mat.transparent;
    }
    if (mat.transparent !== wantTransparent) {
      mat.transparent = wantTransparent;
      mat.needsUpdate = true;
    }
    mat.opacity = mat.userData.baseOpacity * opacity;
    mat.depthWrite = opacity > 0.5;
  }
}
