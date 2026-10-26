import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Procedural entity models. Each faces +Z in local space and stands on y = 0.
 * Everything is generated: tapered, sculpted limbs (lathe profiles displaced
 * by noise), and canvas skin, cloth and bandage textures with bump maps.
 *   Wanderer  2.4 m, starved, hunched, arms past the knees, the remains of a
 *             guard's uniform; one hand still grips a torch that isn't there
 *   Observer  pale and very thin, leaning in as if toward a screen, a dark
 *             glossy band across the eyes, an analyst's ID badge
 *   Echo      a low, segmented crawler with too many limbs, an ear-horn for
 *             a face and ribbed acoustic fins
 *   Patient   huge and draped in a hospital blanket, head bowed in a hood,
 *             bandaged forearms, a wristband and a trailing IV line
 */

const UP = new THREE.Vector3(0, 1, 0);

// ------------------------------------------------------------------ noise

function hash(x, y, z, seed) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1440662683) ^ Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

function vnoise(x, y, z, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const s = (t) => t * t * (3 - 2 * t);
  const fx = s(x - xi);
  const fy = s(y - yi);
  const fz = s(z - zi);
  const l = (a, b, t) => a + (b - a) * t;
  const h = (dx, dy, dz) => hash(xi + dx, yi + dy, zi + dz, seed);
  return l(
    l(l(h(0, 0, 0), h(1, 0, 0), fx), l(h(0, 1, 0), h(1, 1, 0), fx), fy),
    l(l(h(0, 0, 1), h(1, 0, 1), fx), l(h(0, 1, 1), h(1, 1, 1), fx), fy),
    fz
  );
}

/** Fractal noise in [-1, 1]. */
function fbm(x, y, z, seed = 1, octaves = 3) {
  let sum = 0;
  let amp = 0.5;
  let f = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * (vnoise(x * f, y * f, z * f, seed + i * 17) * 2 - 1);
    amp *= 0.5;
    f *= 2.03;
  }
  return sum;
}

function seededRandom(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

// --------------------------------------------------------------- textures

const texCache = new Map();

function canvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

function tex(c, srgb) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function blotches(ctx, size, rnd, count, color, maxR) {
  for (let i = 0; i < count; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const r = maxR * (0.25 + rnd());
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

function veins(ctx, size, rnd, count, color) {
  ctx.strokeStyle = color;
  for (let i = 0; i < count; i++) {
    let x = rnd() * size;
    let y = rnd() * size;
    let a = rnd() * Math.PI * 2;
    ctx.lineWidth = 0.6 + rnd() * 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let j = 0; j < 14; j++) {
      a += (rnd() - 0.5) * 0.9;
      x += Math.cos(a) * 7;
      y += Math.sin(a) * 7;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function speckle(ctx, size, rnd, count, colors, max = 1.6) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[Math.floor(rnd() * colors.length)];
    const s = 0.6 + rnd() * max;
    ctx.fillRect(rnd() * size, rnd() * size, s, s);
  }
}

/** Mottled skin: colour map and bump map (pores, creases, blotches). */
function skinTextures(key, { base, dark, light, vein, seed, size = 256 }) {
  if (texCache.has(key)) return texCache.get(key);
  const rnd = seededRandom(seed);
  const c = canvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  blotches(ctx, size, rnd, 90, dark, size * 0.12);
  blotches(ctx, size, rnd, 50, light, size * 0.09);
  veins(ctx, size, rnd, 16, vein);
  speckle(ctx, size, rnd, 2600, [dark, light]);
  const b = canvas(size);
  const bx = b.getContext('2d');
  bx.fillStyle = '#808080';
  bx.fillRect(0, 0, size, size);
  blotches(bx, size, rnd, 70, 'rgba(40,40,40,0.35)', size * 0.08);
  blotches(bx, size, rnd, 40, 'rgba(220,220,220,0.3)', size * 0.06);
  bx.strokeStyle = 'rgba(30,30,30,0.35)';
  for (let i = 0; i < 70; i++) {
    const y = rnd() * size;
    const x = rnd() * size;
    bx.lineWidth = 0.5 + rnd();
    bx.beginPath();
    bx.moveTo(x, y);
    bx.quadraticCurveTo(x + 10, y + (rnd() - 0.5) * 6, x + 18 + rnd() * 20, y + (rnd() - 0.5) * 4);
    bx.stroke();
  }
  speckle(bx, size, rnd, 5000, ['#5a5a5a', '#a8a8a8', '#3c3c3c'], 1.2);
  const out = { map: tex(c, true), bump: tex(b, false) };
  texCache.set(key, out);
  return out;
}

/** Woven cloth with grime, stains and a bump map. `stripes` draws bandage wraps. */
function clothTextures(key, { base, grime, stain, seed, stripes = false, size = 256 }) {
  if (texCache.has(key)) return texCache.get(key);
  const rnd = seededRandom(seed);
  const c = canvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y += 2) {
    ctx.fillStyle = `rgba(0,0,0,${0.03 + rnd() * 0.05})`;
    ctx.fillRect(0, y, size, 1);
  }
  for (let x = 0; x < size; x += 2) {
    ctx.fillStyle = `rgba(255,255,255,${0.015 + rnd() * 0.03})`;
    ctx.fillRect(x, 0, 1, size);
  }
  blotches(ctx, size, rnd, 60, grime, size * 0.15);
  blotches(ctx, size, rnd, 10, stain, size * 0.1);
  const b = canvas(size);
  const bx = b.getContext('2d');
  bx.fillStyle = '#808080';
  bx.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y += 2) {
    bx.fillStyle = 'rgba(0,0,0,0.25)';
    bx.fillRect(0, y, size, 1);
  }
  if (stripes) {
    // Overlapping bandage wraps: diagonal bands with a dark edge.
    for (let i = -size; i < size * 2; i += 22 + rnd() * 10) {
      for (const [cx, col, w] of [[ctx, 'rgba(60,45,30,0.35)', 2.5], [bx, 'rgba(20,20,20,0.7)', 3]]) {
        cx.strokeStyle = col;
        cx.lineWidth = w;
        cx.beginPath();
        cx.moveTo(i, 0);
        cx.lineTo(i + size * 0.35, size);
        cx.stroke();
      }
    }
    blotches(ctx, size, rnd, 8, 'rgba(110,70,40,0.35)', size * 0.08);
  }
  blotches(bx, size, rnd, 30, 'rgba(50,50,50,0.4)', size * 0.1);
  const out = { map: tex(c, true), bump: tex(b, false) };
  texCache.set(key, out);
  return out;
}

function skinMaterial(key, opts, { roughness = 0.85, bumpScale = 1.2, color = 0xffffff, physical = null } = {}) {
  const t = skinTextures(key, opts);
  const params = { map: t.map, bumpMap: t.bump, bumpScale, roughness, color, metalness: 0 };
  return physical ? new THREE.MeshPhysicalMaterial({ ...params, ...physical }) : new THREE.MeshStandardMaterial(params);
}

function clothMaterial(key, opts, { roughness = 0.95, bumpScale = 0.3, side = THREE.DoubleSide } = {}) {
  const t = clothTextures(key, opts);
  return new THREE.MeshStandardMaterial({ map: t.map, bumpMap: t.bump, bumpScale, roughness, metalness: 0, side });
}

// ------------------------------------------------------------------ geometry

/** Smoothly sample an array of values at t in [0, 1]. */
function sample(arr, t) {
  const x = Math.max(0, Math.min(1, t)) * (arr.length - 1);
  const i = Math.min(arr.length - 2, Math.floor(x));
  const f = x - i;
  const k = f * f * (3 - 2 * f);
  return arr[i] + (arr[i + 1] - arr[i]) * k;
}

/**
 * A tapered tube along +Y from 0 to `len`, radii sampled base to tip.
 * Round ends unless `open` (then the ends are left open, for cloth shells).
 */
function tubeGeo(len, radii, { segments = 12, steps = 16, open = false } = {}) {
  const r0 = radii[0];
  const r1 = radii[radii.length - 1];
  const pts = [];
  if (!open) pts.push(new THREE.Vector2(0.0001, -r0 * 0.85), new THREE.Vector2(r0 * 0.72, -r0 * 0.55));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push(new THREE.Vector2(sample(radii, t), t * len));
  }
  if (!open) pts.push(new THREE.Vector2(r1 * 0.72, len + r1 * 0.55), new THREE.Vector2(0.0001, len + r1 * 0.85));
  return lathe(pts, segments);
}

/** LatheGeometry; a bottom-to-top profile winds the faces outward. */
function lathe(pts, segments) {
  return new THREE.LatheGeometry(pts, segments);
}

/** Reverse the winding of an indexed geometry (after a mirroring transform). */
function flipWinding(geo) {
  const idx = geo.index;
  for (let i = 0; i < idx.count; i += 3) {
    const b = idx.getX(i + 1);
    idx.setX(i + 1, idx.getX(i + 2));
    idx.setX(i + 2, b);
  }
  return geo;
}

/** Push vertices away from the local Y axis by fn(x, y, z). */
function sculptAxial(geo, fn) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 1e-4) continue;
    const d = fn(x, y, z);
    p.setX(i, x + (x / r) * d);
    p.setZ(i, z + (z / r) * d);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Push vertices away from the local origin by fn(x, y, z). */
function sculptRadial(geo, fn) {
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const len = v.length();
    if (len < 1e-4) continue;
    const d = fn(v.x, v.y, v.z);
    v.multiplyScalar((len + d) / len);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

function mesh(geo, mat, parent) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}

const V = (a) => (a.isVector3 ? a : new THREE.Vector3(...a));

/** A sculpted limb segment from a to b. */
function seg(parent, mat, a, b, radii, { flat = 1, rough = 0.004, seed = 1, segments = 12, freq = 14 } = {}) {
  const A = V(a);
  const B = V(b);
  const geo = tubeGeo(A.distanceTo(B), radii, { segments });
  if (flat !== 1) geo.scale(1, 1, flat);
  if (rough) sculptAxial(geo, (x, y, z) => fbm(x * freq, y * freq, z * freq, seed) * rough);
  const m = mesh(geo, mat, parent);
  m.position.copy(A);
  m.quaternion.setFromUnitVectors(UP, B.clone().sub(A).normalize());
  return m;
}

/** A chain of segments through the points, with one radius list per segment. */
function chain(parent, mat, points, radii, opts = {}) {
  for (let i = 0; i < points.length - 1; i++) seg(parent, mat, points[i], points[i + 1], radii[Math.min(i, radii.length - 1)], { ...opts, seed: (opts.seed ?? 1) + i * 7 });
}

/** A sculpted ellipsoid. */
function blob(parent, mat, r, pos, scale = [1, 1, 1], { rough = 0.08, freq = 6, seed = 3, w = 20, h = 14 } = {}) {
  const geo = new THREE.SphereGeometry(r, w, h);
  if (rough) sculptRadial(geo, (x, y, z) => fbm(x * freq / r, y * freq / r, z * freq / r, seed) * rough * r);
  const m = mesh(geo, mat, parent);
  m.position.set(...pos);
  m.scale.set(...scale);
  return m;
}

/** Fingers: each is a list of points from knuckle to tip. */
function fingers(parent, mat, list, radius, seed = 5) {
  list.forEach((pts, i) => chain(parent, mat, pts, [[radius, radius * 0.95, radius * 0.85], [radius * 0.85, radius * 0.78], [radius * 0.78, radius * 0.6]], { rough: radius * 0.12, seed: seed + i * 3, segments: 7 }));
}

/** A cloth shell around a lathe profile, open at both ends, with a ragged hem. */
function shell(parent, mat, len, radii, { flat = 1, rag = 0.05, seed = 9, folds = 0.008, segments = 20, hemAtEnd = false } = {}) {
  const geo = tubeGeo(len, radii, { segments, open: true });
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const a = Math.atan2(z, x);
    const fold = folds * Math.sin(a * 11 + y * 3) + folds * 0.6 * fbm(x * 8, y * 8, z * 8, seed);
    const r = Math.hypot(x, z);
    if (r > 1e-4) {
      p.setX(i, x + (x / r) * fold);
      p.setZ(i, z + (z / r) * fold);
    }
    const tear = Math.max(0, fbm(Math.cos(a) * 3, Math.sin(a) * 3, 0, seed + 5)) * rag * 2 - rag * 0.3 * Math.sin(a * 7);
    if (!hemAtEnd && y < 0.02) p.setY(i, y - tear);
    if (hemAtEnd && y > len - 0.02) p.setY(i, y + tear);
  }
  if (flat !== 1) geo.scale(1, 1, flat);
  geo.computeVertexNormals();
  return mesh(geo, mat, parent);
}

/**
 * Merge every group's direct mesh children that share a material into one
 * mesh (one draw call, one shadow call). Animated parts are their own groups,
 * so they keep moving independently.
 */
function mergeByMaterial(group) {
  for (const child of [...group.children]) if (!child.isMesh) mergeByMaterial(child);
  const byMat = new Map();
  for (const child of group.children) {
    if (!child.isMesh) continue;
    if (!byMat.has(child.material)) byMat.set(child.material, []);
    byMat.get(child.material).push(child);
  }
  for (const [mat, meshes] of byMat) {
    if (meshes.length < 2) continue;
    const merged = mergeGeometries(meshes.map((m) => {
      m.updateMatrix();
      return m.geometry.clone().applyMatrix4(m.matrix);
    }));
    if (!merged) continue;
    for (const m of meshes) {
      group.remove(m);
      m.geometry.dispose();
    }
    mesh(merged, mat, group);
  }
  return group;
}

// ---------------------------------------------------------------- Wanderer

export function createWanderer() {
  const root = new THREE.Group();
  const skin = skinMaterial('wanderer-skin', {
    base: '#2a2725', dark: 'rgba(10,8,8,0.45)', light: 'rgba(80,76,72,0.18)', vein: 'rgba(30,30,44,0.45)', seed: 101
  }, { roughness: 0.94, bumpScale: 0.45 });
  const bone = skinMaterial('wanderer-bone', {
    base: '#3e3a36', dark: 'rgba(16,14,12,0.4)', light: 'rgba(96,90,82,0.22)', vein: 'rgba(40,38,52,0.2)', seed: 102
  }, { roughness: 0.88, bumpScale: 0.4 });
  const uniform = clothMaterial('wanderer-uniform', { base: '#1d2430', grime: 'rgba(10,10,8,0.45)', stain: 'rgba(60,50,30,0.4)', seed: 103 });
  const leather = new THREE.MeshStandardMaterial({ color: 0x17130f, roughness: 0.6, metalness: 0.05 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x6b6450, roughness: 0.45, metalness: 0.7 });
  const hollow = new THREE.MeshStandardMaterial({ color: 0x050404, roughness: 1 });
  const body = new THREE.Group();
  root.add(body);

  // Legs: long, bent, bony knees, long feet.
  for (const s of [-1, 1]) {
    chain(body, skin, [[s * 0.1, 1.16, 0], [s * 0.13, 0.64, 0.12], [s * 0.12, 0.1, -0.03]], [[0.058, 0.05, 0.04, 0.034], [0.034, 0.038, 0.028, 0.022]], { seed: 10 + s });
    blob(body, bone, 0.04, [s * 0.13, 0.64, 0.13], [1, 1.15, 0.9], { seed: 12 + s });
    // What is left of the uniform trousers, torn off above the knee.
    const trousers = shell(body, uniform, 0.4, [0.075, 0.07, 0.064, 0.06], { rag: 0.06, seed: 13 + s, folds: 0.006, hemAtEnd: true });
    trousers.position.set(s * 0.1, 1.17, 0);
    trousers.quaternion.setFromUnitVectors(UP, new THREE.Vector3(-s * 0.03, -0.52, -0.12).normalize());
    seg(body, skin, [s * 0.12, 0.07, -0.05], [s * 0.135, 0.025, 0.2], [0.034, 0.04, 0.032, 0.02], { flat: 0.55, seed: 14 + s });
    fingers(body, skin, [-1, 0, 1].map((f) => [[s * (0.135 + f * 0.018), 0.025, 0.19], [s * (0.14 + f * 0.024), 0.012, 0.27], [s * (0.14 + f * 0.026), 0.008, 0.31]]), 0.011, 16 + s);
  }
  blob(body, skin, 0.14, [0, 1.15, 0], [1.1, 0.7, 0.75], { seed: 18 });
  shell(body, uniform, 0.16, [0.145, 0.15, 0.15], { rag: 0.02, seed: 19, flat: 0.75 }).position.y = 1.08;
  // An empty holster on what is left of the belt.
  const holster = mesh(new THREE.BoxGeometry(0.045, 0.15, 0.075), leather, body);
  holster.position.set(0.155, 1.08, -0.01);
  holster.rotation.z = 0.12;

  // Hunched torso: waist pinched, ribs showing, vertebrae down the back.
  const torso = new THREE.Group();
  torso.position.set(0, 1.15, 0);
  torso.rotation.x = 0.34;
  body.add(torso);
  const profile = [0.13, 0.1, 0.085, 0.11, 0.155, 0.17, 0.16, 0.12];
  const flat = 0.62;
  const chestGeo = tubeGeo(0.9, profile, { segments: 20, steps: 24 });
  sculptAxial(chestGeo, (x, y, z) => {
    const band = Math.max(0, 1 - Math.abs(y - 0.55) / 0.2);
    const ribs = Math.pow(Math.max(0, Math.sin(y * 104)), 2) * band * (z > -0.03 ? 0.009 : 0.004);
    return ribs - band * 0.004 + fbm(x * 12, y * 12, z * 12, 21) * 0.006;
  });
  chestGeo.scale(1, 1, flat);
  mesh(chestGeo, skin, torso);
  for (let y = 0.08; y < 0.86; y += 0.065) blob(torso, bone, 0.022, [0, y, -sample(profile, y / 0.9) * flat + 0.004], [1, 0.8, 0.8], { rough: 0.05, w: 8, h: 6 });
  // The rest of a security guard's shirt: torn hem, one badge.
  shell(torso, uniform, 0.5, profile.slice(3).map((r) => r + 0.014), { flat: 0.66, rag: 0.06, seed: 22 }).position.y = 0.38;
  const badge = mesh(new THREE.BoxGeometry(0.035, 0.045, 0.006), metal, torso);
  badge.position.set(0.075, 0.68, sample(profile, 0.68 / 0.9) * 0.66 + 0.01);
  badge.rotation.x = -0.25;

  // Arms past the knees. The right hand is curled around a torch that isn't there.
  const arms = [];
  for (const s of [-1, 1]) {
    blob(torso, bone, 0.042, [s * 0.19, 0.8, 0.0], [1.1, 0.9, 1], { seed: 30 + s });
    const arm = new THREE.Group();
    arm.position.set(s * 0.21, 0.79, 0.02);
    arm.rotation.x = -0.34 + 0.08; // hang plumb against the hunch, a little forward
    torso.add(arm);
    seg(arm, skin, [0, 0, 0], [s * 0.04, -0.6, 0.04], [0.048, 0.045, 0.034, 0.03], { seed: 32 + s });
    shell(arm, uniform, 0.2, [0.058, 0.056, 0.054], { rag: 0.03, seed: 34 + s, hemAtEnd: true }).rotation.x = Math.PI;
    blob(arm, bone, 0.034, [s * 0.04, -0.6, 0.04], [1, 1, 1], { seed: 36 + s });
    seg(arm, skin, [s * 0.04, -0.6, 0.04], [s * 0.03, -1.2, 0.12], [0.034, 0.038, 0.028, 0.024], { seed: 38 + s });
    seg(arm, skin, [s * 0.03, -1.2, 0.12], [s * 0.025, -1.32, 0.14], [0.03, 0.034, 0.03], { flat: 0.5, seed: 40 + s });
    const knuckles = [0, 1, 2, 3].map((f) => [s * 0.025, -1.33, 0.11 + f * 0.018]);
    if (s === 1) {
      // A hollow fist: each finger hooks inward around the empty grip.
      fingers(arm, skin, knuckles.map(([x, y, z]) => [[x, y, z], [x, y - 0.06, z + 0.01], [x - 0.045, y - 0.085, z + 0.005], [x - 0.06, y - 0.05, z]]), 0.012, 42);
      chain(arm, skin, [[0.0, -1.27, 0.15], [-0.03, -1.32, 0.18], [-0.05, -1.36, 0.17]], [[0.014, 0.013, 0.011]], { seed: 44 });
    } else {
      fingers(arm, skin, knuckles.map(([x, y, z], f) => [[x, y, z], [x - 0.005, y - 0.09 - f * 0.005, z + 0.02], [x - 0.01, y - 0.17 - f * 0.008, z + 0.03], [x - 0.02, y - 0.22 - f * 0.008, z + 0.015]]), 0.0105, 46);
      chain(arm, skin, [[-0.005, -1.27, 0.15], [0.015, -1.34, 0.19], [0.02, -1.4, 0.2]], [[0.013, 0.012, 0.01]], { seed: 48 });
    }
    arms.push(arm);
  }

  // A long neck reaching forward, the head hanging to one side.
  const neck = new THREE.Group();
  neck.position.set(0, 0.84, 0.03);
  torso.add(neck);
  seg(neck, skin, [0, 0, 0], [0, 0.22, 0.13], [0.05, 0.036, 0.033], { seed: 50 });
  const head = new THREE.Group();
  head.position.set(0, 0.25, 0.16);
  head.rotation.set(-0.05, 0, 0.36);
  neck.add(head);
  blob(head, skin, 0.1, [0, 0.03, 0], [0.8, 1.32, 0.98], { rough: 0.12, freq: 4, seed: 52 });
  blob(head, bone, 0.06, [0, 0.075, 0.04], [1.1, 0.55, 0.8], { rough: 0.08, seed: 53 });
  for (const s of [-1, 1]) blob(head, hollow, 0.026, [s * 0.034, 0.04, 0.07], [1, 0.8, 0.7], { rough: 0 });
  blob(head, skin, 0.042, [0, -0.085, 0.025], [0.85, 0.6, 0.9], { seed: 54 });
  blob(head, hollow, 0.026, [0, -0.06, 0.07], [0.75, 0.5, 0.45], { rough: 0 });

  mergeByMaterial(root);
  root.userData = { kind: 'WANDERER', body, torso, arms, neck, head, materials: [skin, bone, uniform, leather, metal, hollow] };
  return root;
}

// ---------------------------------------------------------------- Observer

export function createObserver() {
  const root = new THREE.Group();
  const skin = skinMaterial('observer-skin', {
    base: '#8a8780', dark: 'rgba(70,72,84,0.35)', light: 'rgba(190,186,176,0.3)', vein: 'rgba(70,80,115,0.4)', seed: 201
  }, { roughness: 0.62, bumpScale: 0.25, physical: { sheen: 0.25, sheenColor: new THREE.Color(0xc8c4bc), sheenRoughness: 0.7 } });
  const shirt = clothMaterial('observer-shirt', { base: '#3a3f3c', grime: 'rgba(15,15,12,0.4)', stain: 'rgba(80,70,50,0.3)', seed: 202 });
  const visor = new THREE.MeshPhysicalMaterial({ color: 0x030405, roughness: 0.06, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05 });
  const card = new THREE.MeshStandardMaterial({ color: 0xd9d6c8, roughness: 0.7 });
  const cord = new THREE.MeshStandardMaterial({ color: 0x5a1f1a, roughness: 0.8 });
  const hollow = new THREE.MeshStandardMaterial({ color: 0x1a1414, roughness: 1 });
  const body = new THREE.Group();
  root.add(body);

  // Thin straight legs, feet together.
  for (const s of [-1, 1]) {
    chain(body, skin, [[s * 0.075, 0.98, 0], [s * 0.07, 0.52, 0.025], [s * 0.065, 0.075, -0.01]], [[0.06, 0.055, 0.042, 0.036], [0.036, 0.04, 0.03, 0.024]], { rough: 0.002, seed: 60 + s });
    seg(body, skin, [s * 0.065, 0.055, -0.03], [s * 0.07, 0.02, 0.14], [0.03, 0.034, 0.026, 0.016], { flat: 0.5, rough: 0.002, seed: 62 + s });
  }
  blob(body, skin, 0.12, [0, 0.98, 0], [1.05, 0.6, 0.7], { rough: 0.03 });

  // Leaning in, shoulders rounded, as if toward a screen.
  const torso = new THREE.Group();
  torso.position.set(0, 0.98, 0);
  torso.rotation.x = 0.24;
  body.add(torso);
  const profile = [0.11, 0.085, 0.08, 0.1, 0.125, 0.13, 0.095];
  mesh(sculptAxial(tubeGeo(0.62, profile, { segments: 18 }), (x, y, z) => fbm(x * 10, y * 10, z * 10, 64) * 0.003).scale(1, 1, 0.6), skin, torso);
  shell(torso, shirt, 0.68, [0.15, 0.13, 0.1, 0.095, 0.115, 0.14, 0.145, 0.11], { flat: 0.64, rag: 0.025, seed: 65, folds: 0.005 }).position.y = -0.08;
  for (const s of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(s * 0.16, 0.56, 0.035);
    arm.rotation.x = -0.24 + 0.05;
    torso.add(arm);
    blob(arm, skin, 0.04, [0, 0, 0], [1, 0.9, 1], { rough: 0.03 });
    seg(arm, skin, [0, 0, 0], [s * 0.025, -0.3, 0.05], [0.036, 0.034, 0.026, 0.024], { rough: 0.002, seed: 66 + s });
    seg(arm, skin, [s * 0.025, -0.3, 0.05], [s * 0.0, -0.5, 0.22], [0.025, 0.027, 0.02, 0.018], { rough: 0.002, seed: 68 + s });
    seg(arm, skin, [s * 0.0, -0.5, 0.22], [s * -0.005, -0.58, 0.27], [0.02, 0.025, 0.02], { flat: 0.45, rough: 0.001, seed: 69 + s });
    fingers(arm, skin, [0, 1, 2, 3].map((f) => {
      const x = s * (-0.012 + f * 0.009) - s * 0.01;
      return [[x, -0.585, 0.27], [x, -0.65, 0.29], [x, -0.71, 0.285], [x, -0.75, 0.27]];
    }), 0.0075, 70 + s * 4);
  }
  // ID badge on a lanyard.
  for (const s of [-1, 1]) seg(torso, cord, [s * 0.045, 0.6, 0.07], [0, 0.36, 0.098], [0.004, 0.004], { rough: 0, segments: 5 });
  const badge = mesh(new THREE.BoxGeometry(0.052, 0.072, 0.004), card, torso);
  badge.position.set(0, 0.32, 0.098);
  badge.rotation.x = 0.06;

  // A long neck craned forward. The presenter turns the head toward the watching camera.
  seg(torso, skin, [0, 0.58, 0.02], [0, 0.78, 0.16], [0.042, 0.032, 0.03], { rough: 0.002, seed: 74 });
  const head = new THREE.Group();
  head.position.set(0, 1.78, 0);
  body.add(head);
  // Place the head where the neck ends (torso lean included) but keep its own rotation free.
  torso.updateMatrix();
  head.position.copy(new THREE.Vector3(0, 0.84, 0.19).applyMatrix4(torso.matrix));
  blob(head, skin, 0.1, [0, 0.0, 0], [0.82, 1.2, 1.0], { rough: 0.07, freq: 4, seed: 75 });
  // Wide, glossy black eyes in deep sockets: too large, and never blinking.
  for (const s of [-1, 1]) {
    blob(head, hollow, 0.032, [s * 0.035, 0.014, 0.07], [1.1, 0.85, 0.6], { rough: 0 });
    blob(head, visor, 0.022, [s * 0.035, 0.013, 0.077], [1.05, 0.82, 0.55], { rough: 0 });
  }
  blob(head, hollow, 0.02, [0, -0.07, 0.083], [1.2, 0.2, 0.4], { rough: 0 });
  for (const s of [-1, 1]) blob(head, skin, 0.022, [s * 0.084, 0.0, -0.005], [0.4, 1.1, 0.8], { rough: 0.03 });

  mergeByMaterial(root);
  root.userData = { kind: 'OBSERVER', body, head, materials: [skin, shirt, visor, card, cord, hollow] };
  return root;
}

// -------------------------------------------------------------------- Echo

export function createEcho() {
  const root = new THREE.Group();
  const hide = skinMaterial('echo-hide', {
    base: '#1c1f20', dark: 'rgba(5,6,6,0.5)', light: 'rgba(70,72,70,0.2)', vein: 'rgba(60,30,30,0.3)', seed: 301
  }, { roughness: 0.6, bumpScale: 0.6, physical: { clearcoat: 0.35, clearcoatRoughness: 0.45 } });
  const membrane = new THREE.MeshStandardMaterial({ color: 0x4a3530, roughness: 0.55, side: THREE.DoubleSide, transparent: true, opacity: 0.82 });
  const inner = new THREE.MeshStandardMaterial({ color: 0x0a0505, roughness: 0.9, side: THREE.DoubleSide });
  const body = new THREE.Group();
  root.add(body);

  // A long segmented body, arched, built along Y then laid along Z.
  const L = 1.45;
  const radii = [0.04, 0.08, 0.12, 0.15, 0.165, 0.16, 0.14, 0.11];
  const bodyGeo = tubeGeo(L, radii, { segments: 16, steps: 30 });
  const pos = bodyGeo.attributes.position;
  const arch = (u) => 0.34 + 0.24 * Math.sin(Math.PI * Math.min(1, u / L) * 0.95);
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    const y = pos.getY(i);
    let z = pos.getZ(i);
    const r = Math.hypot(x, z);
    if (r > 1e-4) {
      const groove = -0.016 * Math.pow(1 - Math.abs(Math.sin((y / L) * Math.PI * 8)), 3);
      const d = groove + fbm(x * 9, y * 9, z * 9, 302) * 0.012;
      x += (x / r) * d;
      z += (z / r) * d;
    }
    pos.setXYZ(i, x * 1.15, arch(y) + z * 0.72, y - L * 0.62);
  }
  flipWinding(bodyGeo).computeVertexNormals();
  mesh(bodyGeo, hide, body);

  // Ribbed acoustic fins along the spine.
  const fins = [];
  const fanShape = (r, a0, a1) => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    for (let i = 0; i <= 12; i++) {
      const a = a0 + (a1 - a0) * (i / 12);
      const rr = r * (0.85 + 0.15 * Math.sin(i * 1.7));
      s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    s.lineTo(0, 0);
    return s;
  };
  for (let k = 0; k < 4; k++) {
    const u = L * (0.35 + k * 0.14);
    const fin = new THREE.Group();
    fin.position.set(0, arch(u) + 0.1, u - L * 0.62);
    fin.rotation.y = Math.PI / 2;
    body.add(fin);
    const r = 0.16 + k * 0.02;
    mesh(new THREE.ShapeGeometry(fanShape(r, 0.25, 1.75)), membrane, fin);
    for (let i = 0; i < 5; i++) {
      const a = 0.25 + (1.5 * i) / 4;
      seg(fin, hide, [0, 0, 0], [Math.cos(a) * r, Math.sin(a) * r, 0], [0.008, 0.005, 0.002], { rough: 0, segments: 5 });
    }
    fins.push(fin);
  }

  // Too many limbs: six legs and two reaching arms, each ending in long splayed fingers.
  const limbs = [];
  const legs = [
    [0.78, 0.18, 0.5, 0.32], [0.55, 0.0, 0.56, 0.05], [0.3, -0.12, 0.5, -0.3], [0.95, 0.26, 0.36, 0.62]
  ];
  legs.forEach(([uf, fo, reach, toe], li) => {
    for (const s of [-1, 1]) {
      const u = L * uf;
      const g = new THREE.Group();
      const hipY = arch(u) - 0.02;
      const hipZ = u - L * 0.62;
      g.position.set(s * 0.13, hipY, hipZ);
      body.add(g);
      const arm = li === 3;
      const knee = [s * reach * 0.5, (arm ? 0.1 : 0.22), fo * 0.5];
      const wrist = [s * reach, 0.07 - hipY, fo + (arm ? 0.18 : 0)];
      chain(g, hide, [[0, 0, 0], knee, wrist], [[0.042, 0.046, 0.032, 0.026], [0.027, 0.024, 0.019, 0.015]], { seed: 310 + li * 4 + s, rough: 0.006 });
      blob(g, hide, 0.034, knee, [1, 0.85, 1], { seed: 320 + li * 4 + s, rough: 0.15 });
      blob(g, hide, 0.022, wrist, [1, 0.8, 1], { seed: 321 + li * 4 + s, rough: 0.15 });
      const [wx, wy, wz] = wrist;
      fingers(g, hide, [-1, 0, 1].map((f) => {
        const a = Math.atan2(toe, s * 0.6) + f * 0.45;
        const dx = Math.cos(a);
        const dz = Math.sin(a);
        return [[wx, wy, wz], [wx + dx * 0.08, wy - 0.035, wz + dz * 0.08], [wx + dx * 0.15, -hipY + 0.012, wz + dz * 0.15], [wx + dx * 0.2, -hipY + 0.006, wz + dz * 0.2]];
      }), 0.014, 330 + li * 5 + s);
      limbs.push(g);
    }
  });

  // No face: a skull that opens into an ear-horn, with two ribbed ear-fins.
  const head = new THREE.Group();
  head.position.set(0, arch(L) - 0.02, L * 0.38 + 0.02);
  body.add(head);
  blob(head, hide, 0.11, [0, 0.0, 0.0], [0.85, 0.7, 1.35], { rough: 0.12, freq: 4, seed: 340 });
  const hornPts = [[0.035, 0], [0.04, 0.06], [0.07, 0.13], [0.115, 0.18], [0.13, 0.195], [0.12, 0.2]].map(([r, y]) => new THREE.Vector2(r, y));
  const hornMat = hide.clone();
  hornMat.side = THREE.DoubleSide;
  const horn = mesh(lathe(hornPts, 20), hornMat, head);
  horn.rotation.x = Math.PI / 2;
  horn.position.set(0, 0, 0.06);
  horn.scale.set(1, 1, 0.8);
  const throat = mesh(new THREE.CircleGeometry(0.036, 12), inner, head);
  throat.position.set(0, 0, 0.065);
  for (const s of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(s * 0.07, 0.04, -0.04);
    ear.rotation.set(-0.3, s * 1.0, s * 0.3);
    head.add(ear);
    mesh(new THREE.ShapeGeometry(fanShape(0.24, 0.35, 1.95)), membrane, ear);
    for (let i = 0; i < 5; i++) {
      const a = 0.35 + (1.6 * i) / 4;
      seg(ear, hide, [0, 0, 0], [Math.cos(a) * 0.23, Math.sin(a) * 0.23, 0], [0.007, 0.004, 0.002], { rough: 0, segments: 5 });
    }
    fins.push(ear);
  }

  mergeByMaterial(root);
  root.userData = { kind: 'ECHO', body, limbs, head, fins, materials: [hide, hornMat, membrane, inner] };
  return root;
}

// ----------------------------------------------------------------- Patient

export function createPatient() {
  const root = new THREE.Group();
  const cloth = clothMaterial('patient-blanket', { base: '#565a4d', grime: 'rgba(25,24,18,0.45)', stain: 'rgba(90,70,40,0.4)', seed: 401 });
  const skin = skinMaterial('patient-skin', {
    base: '#867868', dark: 'rgba(60,40,40,0.3)', light: 'rgba(170,150,130,0.25)', vein: 'rgba(70,60,90,0.35)', seed: 402
  }, { roughness: 0.92, bumpScale: 0.4 });
  const bandage = clothMaterial('patient-bandage', { base: '#a59d86', grime: 'rgba(60,55,40,0.35)', stain: 'rgba(120,90,50,0.35)', seed: 403, stripes: true }, { roughness: 0.9, bumpScale: 0.4, side: THREE.FrontSide });
  const band = new THREE.MeshStandardMaterial({ color: 0xd8d8cc, roughness: 0.5 });
  const tube = new THREE.MeshPhysicalMaterial({ color: 0xc8d0c8, roughness: 0.25, transmission: 0, transparent: true, opacity: 0.7 });
  const shadowMat = new THREE.MeshStandardMaterial({ color: 0x090807, roughness: 1 });
  const body = new THREE.Group();
  root.add(body);

  // One blanket from the ragged hem over a hunched back and up into the hood.
  // Above the shoulders the cloth is sheared forward and down: the head is bowed.
  const profile = [
    [0.45, 0.0], [0.47, 0.1], [0.45, 0.5], [0.46, 0.85], [0.5, 1.12], [0.51, 1.24], [0.47, 1.35], [0.4, 1.44], [0.3, 1.51], [0.22, 1.56],
    [0.18, 1.6], [0.185, 1.68], [0.18, 1.77], [0.15, 1.85], [0.1, 1.9], [0.04, 1.925], [0.0, 1.93]
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const cloakGeo = lathe(profile, 56);
  const p = cloakGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i);
    let y = p.getY(i);
    let z = p.getZ(i);
    const a = Math.atan2(z, x);
    const low = 1 - Math.min(1, y / 1.5);
    const fold = 1 + 0.08 * Math.sin(a * 9 + fbm(x * 2, y * 2, z * 2, 404) * 2) * (0.35 + low) + 0.03 * Math.sin(a * 23) * low + 0.03 * fbm(x * 5, y * 5, z * 5, 405);
    const hood = Math.min(1, Math.max(0, (y - 1.5) / 0.1));
    x *= fold * (1.2 - hood * 0.2);
    z *= fold * (0.76 + hood * 0.2);
    // Hump: the upper back bulges back and up.
    if (z < 0.1 && y > 1.0 && y < 1.6) {
      const h = Math.min(1, (y - 1.0) / 0.35) * Math.min(1, (0.1 - z) / 0.35) * (1 - hood);
      z -= h * 0.12;
      y += h * 0.1;
    }
    if (y > 1.45) {
      // Move the hood forward and down as a whole, so it stays round.
      const k = Math.min(1, (y - 1.45) / 0.22);
      const kk = k * k * (3 - 2 * k);
      z += kk * 0.24 + Math.max(0, y - 1.7) * 0.25;
      y -= kk * 0.08;
    }
    if (y < 0.05) y -= Math.max(0, fbm(Math.cos(a) * 3, Math.sin(a) * 3, 0, 406)) * 0.07;
    p.setXYZ(i, x, y, z);
  }
  cloakGeo.computeVertexNormals();
  const cloak = mesh(cloakGeo, cloth, body);
  const hem = mesh(new THREE.CircleGeometry(0.5, 24), shadowMat, body);
  hem.rotation.x = -Math.PI / 2;
  hem.position.y = 0.03;
  hem.scale.set(1.1, 0.8, 1);
  // Bare feet at the hem.
  for (const s of [-1, 1]) {
    seg(body, skin, [s * 0.17, 0.05, 0.28], [s * 0.19, 0.04, 0.5], [0.055, 0.065, 0.055, 0.032], { flat: 0.55, seed: 410 + s });
    fingers(body, skin, [-1.5, -0.5, 0.5, 1.5].map((f) => [[s * 0.19 + f * 0.02, 0.035, 0.48], [s * 0.19 + f * 0.022, 0.02, 0.54]]), 0.015, 412 + s);
  }

  // Bowed head under the hood: only the jaw and the bridge of the nose catch the light.
  const head = new THREE.Group();
  head.position.set(0, 1.62, 0.3);
  head.rotation.x = 0.6;
  body.add(head);
  blob(head, shadowMat, 0.125, [0, 0, 0.07], [0.85, 1.05, 0.8], { rough: 0 });
  blob(head, skin, 0.06, [0, -0.08, 0.12], [1.05, 0.7, 0.85], { rough: 0.1, seed: 421 });
  blob(head, skin, 0.018, [0, -0.01, 0.165], [0.7, 1.5, 0.9], { rough: 0.05 });

  // Heavy bandaged forearms out of the folds, huge hands, a wristband, an IV line.
  for (const s of [-1, 1]) {
    seg(body, bandage, [s * 0.36, 1.08, 0.14], [s * 0.45, 0.74, 0.28], [0.095, 0.095, 0.08, 0.07], { rough: 0.006, seed: 430 + s });
    seg(body, skin, [s * 0.45, 0.76, 0.28], [s * 0.48, 0.6, 0.32], [0.065, 0.08, 0.07, 0.056], { flat: 0.6, rough: 0.006, seed: 432 + s });
    fingers(body, skin, [0, 1, 2, 3].map((f) => {
      const z = 0.27 + f * 0.025;
      return [[s * 0.48, 0.6, z], [s * 0.485, 0.5, z + 0.02], [s * 0.47, 0.43, z + 0.03], [s * 0.45, 0.4, z + 0.015]];
    }), 0.02, 434 + s * 5);
    chain(body, skin, [[s * 0.45, 0.66, 0.36], [s * 0.42, 0.6, 0.41], [s * 0.4, 0.55, 0.42]], [[0.023, 0.021, 0.018]], { seed: 440 + s });
  }
  const wrist = mesh(new THREE.TorusGeometry(0.078, 0.011, 6, 20), band, body);
  wrist.position.set(-0.45, 0.78, 0.27);
  wrist.rotation.set(Math.PI / 2 - 0.4, 0, 0.2);
  const line = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.44, 0.86, 0.26), new THREE.Vector3(0.56, 0.6, 0.34), new THREE.Vector3(0.58, 0.2, 0.26),
    new THREE.Vector3(0.52, 0.012, 0.02), new THREE.Vector3(0.4, 0.01, -0.45), new THREE.Vector3(0.26, 0.01, -0.85)
  ]);
  mesh(new THREE.TubeGeometry(line, 48, 0.006, 5, false), tube, body);

  mergeByMaterial(root);
  root.userData = { kind: 'PATIENT', body, head, cloak, materials: [cloth, skin, bandage, band, tube, shadowMat] };
  return root;
}

/** Per-frame idle animation. `t` is seconds, `calm` 0..1 scales jitter. */
export function animateModel(model, t, { reducedMotion = false, reducedDistortion = false, agitation = 0 } = {}) {
  const u = model.userData;
  const amp = reducedMotion ? 0.4 : 1;
  switch (u.kind) {
    case 'WANDERER': {
      u.body.rotation.y = Math.sin(t * 0.35) * 0.04 * amp;
      u.torso.rotation.x = 0.34 + Math.sin(t * 0.6) * 0.025 * amp;
      u.neck.rotation.z = Math.sin(t * 0.21) * 0.12 * amp;
      u.arms[0].rotation.x = -0.26 + Math.sin(t * 0.5) * 0.05 * amp;
      u.arms[1].rotation.x = -0.26 + Math.sin(t * 0.5 + 1.3) * 0.05 * amp;
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
        f.scale.y = 1 + Math.sin(t * 3 + i) * 0.15 * amp;
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
