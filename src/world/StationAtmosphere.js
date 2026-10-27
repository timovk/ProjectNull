import * as THREE from 'three';

/**
 * Presentation-only light dressing for the security station: haze under the
 * two ceiling fixtures, dust drifting through it, the worn tube in the east
 * fixture, and soft contact shadows where walls and furniture meet the floor.
 * LightingController drives the haze, dust and worn tube every frame.
 */

const FIXTURE_Y = 2.88;
const BEAM_TOP = 0.22; // haze radius at the fixture
const BEAM_FLOOR = 1.55; // haze radius at the floor
const BEAM_STRETCH = 1.6; // fixtures are long: the haze is stretched along z

const HAZE_VERT = /* glsl */ `
  varying float vH;
  varying vec3 vN;
  varying vec3 vView;
  varying vec3 vWorld;
  void main() {
    vH = clamp(position.y / ${FIXTURE_Y.toFixed(2)}, 0.0, 1.0); // 1 at the fixture, 0 at the floor
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    vView = cameraPosition - wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const HAZE_FRAG = /* glsl */ `
  varying float vH;
  varying vec3 vN;
  varying vec3 vView;
  varying vec3 vWorld;
  uniform vec3 uColor;
  uniform float uStrength, uTime;
  void main() {
    // Soft silhouette: faces seen edge-on fade out, so the cone has no outline.
    float facing = abs(dot(normalize(vN), normalize(vView)));
    float body = pow(facing, 2.2) * pow(vH, 1.7) * (1.0 - smoothstep(0.88, 1.0, vH));
    // Fade out close to the camera: from up near a fixture (a CCTV camera)
    // the cone would otherwise read as a hard-edged wedge.
    body *= smoothstep(0.6, 2.4, length(vView));
    // Slow drift so the haze is never perfectly still.
    float drift = 0.82 + 0.18 * sin(vWorld.y * 2.7 + vWorld.x * 1.9 + uTime * 0.23) * sin(vWorld.z * 2.1 - uTime * 0.17);
    gl_FragColor = vec4(uColor * uStrength * body * drift, 1.0);
  }
`;

const MOTE_VERT = /* glsl */ `
  attribute vec3 seed;
  uniform float uTime, uSize;
  uniform vec3 uBeamA, uBeamB; // x, z, strength
  varying float vLight;
  float beam(vec3 b, vec3 p) {
    float r = mix(${BEAM_FLOOR.toFixed(2)}, ${BEAM_TOP.toFixed(2)}, clamp(p.y / ${FIXTURE_Y.toFixed(2)}, 0.0, 1.0));
    vec2 d = (p.xz - b.xy) / vec2(r, r * ${BEAM_STRETCH.toFixed(2)});
    return b.z * (1.0 - smoothstep(0.25, 1.0, length(d)));
  }
  void main() {
    vec3 p = position;
    float t = uTime * (0.6 + seed.z * 0.8);
    p.x += sin(t * 0.07 + seed.x * 6.283) * 0.35;
    p.z += cos(t * 0.05 + seed.y * 6.283) * 0.35;
    p.y = 0.15 + mod(position.y - t * 0.012, 2.7);
    vLight = beam(uBeamA, p) + beam(uBeamB, p);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = uSize * (0.5 + seed.z) / max(0.3, -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const MOTE_FRAG = /* glsl */ `
  uniform vec3 uColor;
  varying float vLight;
  void main() {
    float r = length(gl_PointCoord - 0.5);
    gl_FragColor = vec4(uColor * max(vLight, 0.0) * (1.0 - smoothstep(0.0, 0.5, r)), 1.0);
  }
`;

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Worn fluorescent tube: blackened ends, a faint grey band near one end. */
function wornTubeTexture() {
  const c = canvas(4, 128);
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, '#2a2a28');
  g.addColorStop(0.07, '#5a5a56');
  g.addColorStop(0.14, '#ffffff');
  g.addColorStop(0.8, '#ffffff');
  g.addColorStop(0.84, '#c8c8c4');
  g.addColorStop(0.9, '#ffffff');
  g.addColorStop(0.95, '#6a6a66');
  g.addColorStop(1, '#262624');
  x.fillStyle = g;
  x.fillRect(0, 0, 4, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Black, fading from full at the top edge (v = 1) to nothing at the bottom. */
function edgeShadeTexture() {
  const c = canvas(4, 64);
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(0.35, 'rgba(0,0,0,0.45)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 4, 64);
  return new THREE.CanvasTexture(c);
}

/** Soft-edged black rectangle for the shade under furniture. */
function blobTexture() {
  const c = canvas(128, 128);
  const x = c.getContext('2d');
  x.filter = 'blur(14px)';
  x.fillStyle = '#000';
  x.fillRect(24, 24, 80, 80);
  return new THREE.CanvasTexture(c);
}

function shadeMaterial(map, opacity) {
  return new THREE.MeshBasicMaterial({ map, color: 0x000000, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, fog: false });
}

/** Floor shade along the walls and under the heavy furniture. */
function contactShadows(group) {
  const edge = shadeMaterial(edgeShadeTexture(), 0.55);
  const blob = shadeMaterial(blobTexture(), 0.62);
  const W = 0.75;
  // [x0, z0, x1, z1, ry]: ry turns the dark edge toward the wall.
  const strips = [
    [-4.5, -3.5, 4.5, -3.5, 0],
    [-4.5, 3.5, 1.9, 3.5, Math.PI],
    [3.1, 3.5, 4.5, 3.5, Math.PI],
    [-4.5, -3.5, -4.5, -1.3, Math.PI / 2],
    [-4.5, 0.3, -4.5, 3.5, Math.PI / 2],
    [4.5, -3.5, 4.5, -1.3, -Math.PI / 2],
    [4.5, 0.3, 4.5, 3.5, -Math.PI / 2]
  ];
  for (const [x0, z0, x1, z1, ry] of strips) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, W), edge);
    m.rotation.set(-Math.PI / 2, ry, 0, 'YXZ');
    const inward = new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry)).multiplyScalar(W / 2);
    m.position.set((x0 + x1) / 2 + inward.x, 0.004, (z0 + z1) / 2 + inward.z);
    m.renderOrder = 1;
    group.add(m);
  }
  // [x, z, width, depth]: desk, rack, cabinet, locker, barrier console, boxes.
  for (const [x, z, w, d] of [[0, -2.9, 5.0, 1.3], [-3.75, -2.85, 1.35, 1.45], [-4.05, 2.55, 1.0, 1.1], [-4.05, 1.6, 1.0, 1.05], [-1.7, 3.12, 1.4, 0.95], [3.9, 2.7, 1.1, 1.2]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), blob);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.005, z);
    m.renderOrder = 1;
    group.add(m);
  }
}

function hazeCone(x, z) {
  const geo = new THREE.CylinderGeometry(BEAM_TOP, BEAM_FLOOR, FIXTURE_Y - 0.05, 28, 1, true);
  geo.translate(0, (FIXTURE_Y - 0.05) / 2 - 0.03, 0); // bottom rim just under the floor
  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(0xc8d8cc) }, uStrength: { value: 0 }, uTime: { value: 0 } },
    vertexShader: HAZE_VERT,
    fragmentShader: HAZE_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, 0, z);
  mesh.scale.z = BEAM_STRETCH;
  mesh.renderOrder = 2;
  return mesh;
}

function dustMotes(count) {
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos.set([-3.6 + Math.random() * 7.2, Math.random() * 2.7, -2.6 + Math.random() * 5.6], i * 3);
    seed.set([Math.random(), Math.random(), Math.random()], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seed, 3));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSize: { value: 9 },
      uColor: { value: new THREE.Color(0xd8dccc).multiplyScalar(0.55) },
      uBeamA: { value: new THREE.Vector3() },
      uBeamB: { value: new THREE.Vector3() }
    },
    vertexShader: MOTE_VERT,
    fragmentShader: MOTE_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 3;
  return points;
}

/**
 * @param fixtures  [{ group, tubes }] west then east, from buildStationLights
 * @returns refs for LightingController
 */
export function buildStationAtmosphere(parent, fixtures) {
  const group = new THREE.Group();
  group.name = 'station-atmosphere';
  parent.add(group);
  contactShadows(group);
  const hazes = fixtures.map(({ group: g }) => {
    const h = hazeCone(g.position.x, g.position.z);
    group.add(h);
    return h;
  });
  const motes = dustMotes(260);
  group.add(motes);
  // The east fixture's second tube is near the end of its life.
  const worn = fixtures[1].tubes[1];
  worn.material.map = wornTubeTexture();
  worn.material.needsUpdate = true;
  return { hazes, motes, worn };
}
