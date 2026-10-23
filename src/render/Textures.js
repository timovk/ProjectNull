import * as THREE from 'three';

/**
 * Procedural canvas textures. Everything is generated at startup so the game
 * ships without image assets. Textures are cached and shared.
 */

const cache = new Map();

function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function toTexture(canvas, { repeat = [1, 1], srgb = true } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = 4;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function speckle(ctx, w, h, rnd, count, colors, sizeMax = 2) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[Math.floor(rnd() * colors.length)];
    const s = 1 + rnd() * sizeMax;
    ctx.fillRect(rnd() * w, rnd() * h, s, s);
  }
}

function stains(ctx, w, h, rnd, count, color, maxR) {
  for (let i = 0; i < count; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const r = maxR * (0.3 + rnd());
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

function drips(ctx, w, h, rnd, count) {
  for (let i = 0; i < count; i++) {
    const x = rnd() * w;
    const len = h * (0.1 + rnd() * 0.5);
    const g = ctx.createLinearGradient(x, 0, x, len);
    g.addColorStop(0, 'rgba(30,26,20,0.35)');
    g.addColorStop(1, 'rgba(30,26,20,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, 1 + rnd() * 3, len);
  }
}

export function concreteTexture(repeat = [2, 1], tint = [118, 116, 110], seed = 7) {
  const key = `concrete-${tint.join(',')}-${seed}`;
  if (!cache.has(key)) {
    const w = 512;
    const h = 512;
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d');
    const rnd = seeded(seed);
    ctx.fillStyle = `rgb(${tint[0]},${tint[1]},${tint[2]})`;
    ctx.fillRect(0, 0, w, h);
    stains(ctx, w, h, rnd, 40, 'rgba(60,58,52,0.18)', 90);
    stains(ctx, w, h, rnd, 25, 'rgba(160,156,148,0.12)', 70);
    speckle(ctx, w, h, rnd, 9000, ['rgba(70,68,62,0.5)', 'rgba(150,148,140,0.4)', 'rgba(40,40,36,0.35)']);
    drips(ctx, w, h, rnd, 30);
    // Form-work seams.
    ctx.strokeStyle = 'rgba(40,38,34,0.45)';
    ctx.lineWidth = 2;
    for (let y = 0; y <= h; y += 128) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(35,33,30,0.6)';
    for (let x = 64; x < w; x += 128) for (let y = 64; y < h; y += 128) {
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    cache.set(key, c);
  }
  return toTexture(cache.get(key), { repeat });
}

export function floorTileTexture(repeat = [4, 4], seed = 11) {
  const key = `floor-${seed}`;
  if (!cache.has(key)) {
    const w = 512;
    const c = makeCanvas(w, w);
    const ctx = c.getContext('2d');
    const rnd = seeded(seed);
    const n = 4;
    const s = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const v = 70 + Math.floor(rnd() * 14);
      ctx.fillStyle = `rgb(${v},${v + 2},${v - 2})`;
      ctx.fillRect(i * s, j * s, s, s);
    }
    stains(ctx, w, w, rnd, 30, 'rgba(25,22,18,0.25)', 80);
    speckle(ctx, w, w, rnd, 6000, ['rgba(30,30,28,0.5)', 'rgba(120,120,112,0.3)']);
    ctx.strokeStyle = 'rgba(20,20,18,0.85)';
    ctx.lineWidth = 3;
    for (let i = 0; i <= n; i++) {
      ctx.beginPath();
      ctx.moveTo(i * s, 0);
      ctx.lineTo(i * s, w);
      ctx.moveTo(0, i * s);
      ctx.lineTo(w, i * s);
      ctx.stroke();
    }
    cache.set(key, c);
  }
  return toTexture(cache.get(key), { repeat });
}

export function metalPlateTexture(repeat = [1, 1], tint = [92, 98, 100], seed = 21) {
  const key = `metal-${tint.join(',')}-${seed}`;
  if (!cache.has(key)) {
    const w = 256;
    const c = makeCanvas(w, w);
    const ctx = c.getContext('2d');
    const rnd = seeded(seed);
    ctx.fillStyle = `rgb(${tint[0]},${tint[1]},${tint[2]})`;
    ctx.fillRect(0, 0, w, w);
    for (let y = 0; y < w; y += 2) {
      ctx.fillStyle = `rgba(255,255,255,${0.02 + rnd() * 0.03})`;
      ctx.fillRect(0, y, w, 1);
    }
    stains(ctx, w, w, rnd, 14, 'rgba(70,45,25,0.25)', 40);
    speckle(ctx, w, w, rnd, 1500, ['rgba(40,40,40,0.4)', 'rgba(160,160,160,0.25)']);
    ctx.strokeStyle = 'rgba(25,25,25,0.8)';
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, w - 4, w - 4);
    ctx.fillStyle = 'rgba(30,30,30,0.9)';
    for (const [x, y] of [[10, 10], [w - 10, 10], [10, w - 10], [w - 10, w - 10]]) {
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    cache.set(key, c);
  }
  return toTexture(cache.get(key), { repeat });
}

export function hazardStripeTexture(repeat = [4, 1]) {
  const key = 'hazard';
  if (!cache.has(key)) {
    const c = makeCanvas(128, 32);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#c9a227';
    ctx.fillRect(0, 0, 128, 32);
    ctx.fillStyle = '#1b1a17';
    for (let x = -32; x < 160; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 32);
      ctx.lineTo(x + 16, 32);
      ctx.lineTo(x + 32, 0);
      ctx.lineTo(x + 16, 0);
      ctx.fill();
    }
    const rnd = seeded(5);
    speckle(ctx, 128, 32, rnd, 400, ['rgba(0,0,0,0.35)', 'rgba(255,255,255,0.12)']);
    cache.set(key, c);
  }
  return toTexture(cache.get(key), { repeat });
}

export function paddedWallTexture(repeat = [3, 2]) {
  const key = 'padded';
  if (!cache.has(key)) {
    const w = 256;
    const c = makeCanvas(w, w);
    const ctx = c.getContext('2d');
    const rnd = seeded(33);
    ctx.fillStyle = '#b8b3a3';
    ctx.fillRect(0, 0, w, w);
    const s = 64;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const x = i * s + s / 2;
      const y = j * s + s / 2;
      const g = ctx.createRadialGradient(x, y, 2, x, y, s * 0.7);
      g.addColorStop(0, 'rgba(255,255,250,0.25)');
      g.addColorStop(1, 'rgba(60,55,45,0.35)');
      ctx.fillStyle = g;
      ctx.fillRect(i * s, j * s, s, s);
      ctx.fillStyle = 'rgba(40,36,30,0.8)';
      ctx.beginPath();
      ctx.arc(i * s, j * s, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    stains(ctx, w, w, rnd, 10, 'rgba(90,70,40,0.25)', 50);
    cache.set(key, c);
  }
  return toTexture(cache.get(key), { repeat });
}

export function foamTexture(repeat = [4, 3]) {
  const key = 'foam';
  if (!cache.has(key)) {
    const w = 128;
    const c = makeCanvas(w, w);
    const ctx = c.getContext('2d');
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const g = ctx.createLinearGradient(i * 32, j * 32, i * 32 + 32, j * 32 + 32);
      const flip = (i + j) % 2 === 0;
      g.addColorStop(0, flip ? '#3a3b3e' : '#1d1e20');
      g.addColorStop(1, flip ? '#1d1e20' : '#3a3b3e');
      ctx.fillStyle = g;
      ctx.fillRect(i * 32, j * 32, 32, 32);
    }
    cache.set(key, c);
  }
  return toTexture(cache.get(key), { repeat });
}

/** Signage: text on a plate. Not cached (unique text). */
export function signTexture(text, { width = 512, height = 128, bg = '#1c2a2a', fg = '#d8dccf', sub = '', border = '#6f7a6a', font = 'bold 54px "Courier New", monospace' } = {}) {
  const c = makeCanvas(width, height);
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = border;
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, width - 12, height - 12);
  ctx.fillStyle = fg;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, width / 2, sub ? height * 0.4 : height / 2);
  if (sub) {
    ctx.font = `bold ${Math.round(height * 0.16)}px "Courier New", monospace`;
    ctx.fillText(sub, width / 2, height * 0.75);
  }
  const rnd = seeded(text.length * 97 + 3);
  speckle(ctx, width, height, rnd, 900, ['rgba(0,0,0,0.3)', 'rgba(255,255,255,0.08)']);
  stains(ctx, width, height, rnd, 4, 'rgba(60,40,20,0.3)', 40);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function paperTexture(lines = [], { width = 256, height = 340, seed = 3 } = {}) {
  const c = makeCanvas(width, height);
  const ctx = c.getContext('2d');
  const rnd = seeded(seed);
  ctx.fillStyle = '#d9d3c1';
  ctx.fillRect(0, 0, width, height);
  stains(ctx, width, height, rnd, 6, 'rgba(120,90,40,0.18)', 60);
  ctx.fillStyle = 'rgba(30,30,40,0.85)';
  ctx.font = 'bold 16px "Courier New", monospace';
  ctx.fillText(lines[0] ?? '', 16, 30);
  ctx.font = '11px "Courier New", monospace';
  for (let i = 1; i < 22; i++) {
    const len = 30 + rnd() * (width - 60);
    ctx.fillStyle = 'rgba(40,40,50,0.55)';
    ctx.fillRect(16, 44 + i * 13, lines[i] ? 0 : len, 2);
    if (lines[i]) ctx.fillText(lines[i], 16, 50 + i * 13);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Soft radial blob used for light pools, dust and fake shadows. */
export function radialTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)', size = 128) {
  const key = `radial-${inner}-${outer}-${size}`;
  if (!cache.has(key)) {
    const c = makeCanvas(size, size);
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, inner);
    g.addColorStop(1, outer);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    cache.set(key, c);
  }
  const tex = new THREE.CanvasTexture(cache.get(key));
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function grimeTexture(repeat = [1, 1], seed = 9) {
  const key = `grime-${seed}`;
  if (!cache.has(key)) {
    const w = 256;
    const c = makeCanvas(w, w);
    const ctx = c.getContext('2d');
    const rnd = seeded(seed);
    ctx.fillStyle = '#5a5850';
    ctx.fillRect(0, 0, w, w);
    stains(ctx, w, w, rnd, 30, 'rgba(25,22,18,0.4)', 50);
    speckle(ctx, w, w, rnd, 3000, ['rgba(20,20,20,0.5)', 'rgba(120,115,100,0.4)']);
    cache.set(key, c);
  }
  return toTexture(cache.get(key), { repeat });
}
