import * as THREE from 'three';
import * as TX from './Textures.js';

/**
 * Shared materials and a small construction kit for procedural architecture.
 * Materials are created once and reused across every scene.
 */
export function createMaterials() {
  const m = {};
  m.concrete = new THREE.MeshLambertMaterial({ map: TX.concreteTexture([1, 1]), color: 0xb8b4aa });
  m.concreteDark = new THREE.MeshLambertMaterial({ map: TX.concreteTexture([1, 1], [96, 94, 90], 12), color: 0x9a968e });
  m.concreteGreen = new THREE.MeshLambertMaterial({ map: TX.concreteTexture([1, 1], [92, 108, 100], 17), color: 0xa8b0a8 });
  m.ceiling = new THREE.MeshLambertMaterial({ map: TX.concreteTexture([1, 1], [70, 70, 68], 23), color: 0x8a8a86 });
  m.floor = new THREE.MeshLambertMaterial({ map: TX.floorTileTexture([1, 1]), color: 0xa8a8a0 });
  m.grime = new THREE.MeshLambertMaterial({ map: TX.grimeTexture(), color: 0x9a968a });
  m.metal = new THREE.MeshStandardMaterial({ map: TX.metalPlateTexture(), color: 0xaab0b2, metalness: 0.55, roughness: 0.55 });
  m.metalDark = new THREE.MeshStandardMaterial({ map: TX.metalPlateTexture([1, 1], [60, 64, 66], 31), color: 0x8a9092, metalness: 0.6, roughness: 0.6 });
  m.metalPaint = new THREE.MeshStandardMaterial({ map: TX.metalPlateTexture([1, 1], [70, 88, 84], 41), color: 0xb0c0b8, metalness: 0.3, roughness: 0.7 });
  m.door = new THREE.MeshStandardMaterial({ map: TX.metalPlateTexture([1, 1], [84, 84, 76], 51), color: 0xc0bca8, metalness: 0.45, roughness: 0.6 });
  m.pipe = new THREE.MeshStandardMaterial({ color: 0x5f6a66, metalness: 0.6, roughness: 0.5 });
  m.pipeRust = new THREE.MeshStandardMaterial({ color: 0x6b4f3a, metalness: 0.4, roughness: 0.8 });
  m.hazard = new THREE.MeshLambertMaterial({ map: TX.hazardStripeTexture([2, 1]) });
  m.rubber = new THREE.MeshLambertMaterial({ color: 0x1d1d1d });
  m.plastic = new THREE.MeshStandardMaterial({ color: 0x3a3c3a, roughness: 0.8, metalness: 0.0 });
  m.plasticLight = new THREE.MeshStandardMaterial({ color: 0x9c9a90, roughness: 0.75, metalness: 0.0 });
  m.wood = new THREE.MeshLambertMaterial({ color: 0x4e3b2a });
  m.fabric = new THREE.MeshLambertMaterial({ color: 0x2c3438 });
  m.padded = new THREE.MeshLambertMaterial({ map: TX.paddedWallTexture([1, 1]) });
  m.foam = new THREE.MeshLambertMaterial({ map: TX.foamTexture([1, 1]), color: 0x8a8a8a });
  m.glass = new THREE.MeshStandardMaterial({ color: 0x9fb8b8, transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0.2, depthWrite: false });
  m.glassDirty = new THREE.MeshStandardMaterial({ color: 0x8aa0a0, transparent: true, opacity: 0.32, roughness: 0.3, metalness: 0.1, depthWrite: false });
  m.windowGlass = new THREE.MeshBasicMaterial({ color: 0x2a3434, transparent: true, opacity: 0.16, depthWrite: false });
  m.screenOff = new THREE.MeshStandardMaterial({ color: 0x0b0e0d, roughness: 0.25, metalness: 0.4 });
  m.tube = new THREE.MeshBasicMaterial({ color: 0xe8f0e6 });
  m.tubeOff = new THREE.MeshLambertMaterial({ color: 0x55585a });
  m.ledRed = new THREE.MeshBasicMaterial({ color: 0xff3a2a });
  m.ledGreen = new THREE.MeshBasicMaterial({ color: 0x45ff6a });
  m.ledAmber = new THREE.MeshBasicMaterial({ color: 0xffb030 });
  m.ledOff = new THREE.MeshLambertMaterial({ color: 0x222222 });
  m.black = new THREE.MeshBasicMaterial({ color: 0x000000 });
  m.void = new THREE.MeshBasicMaterial({ color: 0x020202 });
  m.water = new THREE.MeshStandardMaterial({ color: 0x0c1412, roughness: 0.08, metalness: 0.6 });
  m.paper = new THREE.MeshLambertMaterial({ color: 0xd9d3c1 });
  m.chain = new THREE.MeshStandardMaterial({ color: 0x777b7c, metalness: 0.7, roughness: 0.4, transparent: true, opacity: 0.85, alphaTest: 0.5 });
  m.frost = new THREE.MeshLambertMaterial({ color: 0x8a9aa0, transparent: true, opacity: 0.35, depthWrite: false });
  return m;
}

/**
 * Rescales a BoxGeometry's UVs so textures keep a constant world density.
 * Face order in BoxGeometry: +x, -x, +y, -y, +z, -z (4 vertices each).
 */
export function worldUVBox(geometry, w, h, d, tile = 2) {
  const uv = geometry.attributes.uv;
  const dims = [
    [d, h], [d, h], // +x, -x
    [w, d], [w, d], // +y, -y
    [w, h], [w, h] // +z, -z
  ];
  for (let face = 0; face < 6; face++) {
    const [su, sv] = dims[face];
    for (let i = 0; i < 4; i++) {
      const idx = face * 4 + i;
      uv.setXY(idx, uv.getX(idx) * (su / tile), uv.getY(idx) * (sv / tile));
    }
  }
  uv.needsUpdate = true;
  return geometry;
}

/**
 * Construction kit: creates meshes, registers collision boxes and
 * interactables, and builds rooms with openings.
 */
export class Kit {
  constructor(materials) {
    this.m = materials;
    this.colliders = [];
  }

  box(parent, w, h, d, mat, x, y, z, opts = {}) {
    const geo = new THREE.BoxGeometry(w, h, d);
    if (opts.tile !== false) worldUVBox(geo, w, h, d, opts.tile ?? 2);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    if (opts.rx) mesh.rotation.x = opts.rx;
    if (opts.ry) mesh.rotation.y = opts.ry;
    if (opts.rz) mesh.rotation.z = opts.rz;
    mesh.castShadow = !!opts.cast;
    mesh.receiveShadow = opts.receive !== false;
    if (opts.name) mesh.name = opts.name;
    parent.add(mesh);
    if (opts.collide) this.addCollider(x - w / 2, x + w / 2, z - d / 2, z + d / 2, opts.colliderTag);
    return mesh;
  }

  cyl(parent, rTop, rBottom, h, mat, x, y, z, opts = {}) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, opts.segments ?? 12, 1, !!opts.open), mat);
    mesh.position.set(x, y, z);
    if (opts.rx) mesh.rotation.x = opts.rx;
    if (opts.ry) mesh.rotation.y = opts.ry;
    if (opts.rz) mesh.rotation.z = opts.rz;
    mesh.castShadow = !!opts.cast;
    mesh.receiveShadow = opts.receive !== false;
    parent.add(mesh);
    if (opts.collide) this.addCollider(x - rBottom, x + rBottom, z - rBottom, z + rBottom);
    return mesh;
  }

  plane(parent, w, h, mat, x, y, z, opts = {}) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.position.set(x, y, z);
    if (opts.rx) mesh.rotation.x = opts.rx;
    if (opts.ry) mesh.rotation.y = opts.ry;
    if (opts.rz) mesh.rotation.z = opts.rz;
    mesh.receiveShadow = opts.receive !== false;
    parent.add(mesh);
    return mesh;
  }

  /** A straight pipe between two points. */
  pipe(parent, a, b, r, mat = this.m.pipe) {
    const start = new THREE.Vector3(...a);
    const end = new THREE.Vector3(...b);
    const len = start.distanceTo(end);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), mat);
    mesh.position.copy(start).add(end).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(start).normalize());
    parent.add(mesh);
    return mesh;
  }

  addCollider(minX, maxX, minZ, maxZ, tag = null) {
    const c = { minX, maxX, minZ, maxZ, enabled: true, tag };
    this.colliders.push(c);
    return c;
  }

  /**
   * Builds a rectangular room shell. `openings` cut gaps into walls:
   *   { wall: 'N'|'S'|'E'|'W', from, to, top }  (from/to along the wall's axis)
   * N wall is at z0, S at z1, W at x0, E at x1.
   */
  room(parent, { x0, x1, z0, z1, h = 3, t = 0.3, wall, floor, ceiling, openings = [], collide = true, noCeiling = false, noFloor = false, skip = [] }) {
    const g = new THREE.Group();
    parent.add(g);
    const w = x1 - x0;
    const d = z1 - z0;
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    if (!noFloor) this.box(g, w + t * 2, 0.1, d + t * 2, floor ?? this.m.floor, cx, -0.05, cz);
    if (!noCeiling) this.box(g, w + t * 2, 0.1, d + t * 2, ceiling ?? this.m.ceiling, cx, h + 0.05, cz);
    const walls = {
      N: { along: 'x', fixed: z0, min: x0 - t, max: x1 + t },
      S: { along: 'x', fixed: z1, min: x0 - t, max: x1 + t },
      W: { along: 'z', fixed: x0, min: z0, max: z1 },
      E: { along: 'z', fixed: x1, min: z0, max: z1 }
    };
    for (const [key, spec] of Object.entries(walls)) {
      if (skip.includes(key)) continue;
      const ops = openings.filter((o) => o.wall === key).sort((a, b) => a.from - b.from);
      let cursor = spec.min;
      const segs = [];
      for (const o of ops) {
        if (o.from > cursor) segs.push([cursor, o.from, 0, h]);
        if ((o.bottom ?? 0) > 0) segs.push([o.from, o.to, 0, o.bottom]); // window sill
        if ((o.top ?? h) < h) segs.push([o.from, o.to, o.top, h]);
        cursor = o.to;
      }
      if (cursor < spec.max) segs.push([cursor, spec.max, 0, h]);
      for (const [a, b, y0, y1] of segs) {
        const len = b - a;
        const hh = y1 - y0;
        if (len <= 0.001 || hh <= 0.001) continue;
        const mid = (a + b) / 2;
        const full = y0 === 0;
        if (spec.along === 'x') this.box(g, len, hh, t, wall ?? this.m.concrete, mid, y0 + hh / 2, spec.fixed, { collide: collide && full });
        else this.box(g, t, hh, len, wall ?? this.m.concrete, spec.fixed, y0 + hh / 2, mid, { collide: collide && full });
      }
    }
    return g;
  }
}
