import * as THREE from 'three';

const QUAD_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const COMMON = /* glsl */ `
  float rand(vec2 co) { return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }
`;

// Bloom: bright parts of the HDR frame, downsampled to quarter size...
const BRIGHT_FRAG = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D tSrc;
  uniform vec2 uTexel;
  uniform float uThreshold, uKnee;
  void main() {
    vec3 c = texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb
           + texture2D(tSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb
           + texture2D(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb
           + texture2D(tSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb;
    c *= 0.25;
    // One bad pixel must never be blurred across the whole frame.
    // (min/max also drop NaN on the D3D backend, where isnan can be optimised out.)
    if (any(isnan(c)) || any(isinf(c))) c = vec3(0.0);
    c = min(max(c, vec3(0.0)), vec3(24.0));
    float l = max(c.r, max(c.g, c.b));
    gl_FragColor = vec4(c * smoothstep(uThreshold - uKnee, uThreshold + uKnee, l), 1.0);
  }
`;

// ...then blurred with a separable 9-tap Gaussian.
const BLUR_FRAG = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D tSrc;
  uniform vec2 uStep;
  void main() {
    vec3 c = texture2D(tSrc, vUv).rgb * 0.2270;
    c += (texture2D(tSrc, vUv + uStep).rgb + texture2D(tSrc, vUv - uStep).rgb) * 0.1946;
    c += (texture2D(tSrc, vUv + uStep * 2.0).rgb + texture2D(tSrc, vUv - uStep * 2.0).rgb) * 0.1216;
    c += (texture2D(tSrc, vUv + uStep * 3.0).rgb + texture2D(tSrc, vUv - uStep * 3.0).rgb) * 0.0541;
    c += (texture2D(tSrc, vUv + uStep * 4.0).rgb + texture2D(tSrc, vUv - uStep * 4.0).rgb) * 0.0162;
    gl_FragColor = vec4(c, 1.0);
  }
`;

/**
 * Lightweight post-processing without extra dependencies.
 *  - bloom: a soft glow around tubes, screens and lamps (quarter size).
 *  - main pass: film grain, vignette, subtle chromatic aberration, slow
 *    distortion (failure sequences only), desaturation and tint.
 *  - feed pass: CCTV look (monochrome, scanlines, noise, signal loss).
 * The main pass applies tone mapping and output color conversion itself.
 */
export class PostFX {
  constructor(renderer) {
    this.renderer = renderer;
    this.size = new THREE.Vector2(1, 1);
    this.sceneRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.quadScene = new THREE.Scene();
    this.quadScene.add(this.quad);
    const bloomRT = () => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
    this.bloomA = bloomRT();
    this.bloomB = bloomRT();
    this.brightMaterial = new THREE.ShaderMaterial({
      uniforms: { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: 1.1 }, uKnee: { value: 0.5 } },
      vertexShader: QUAD_VERT,
      fragmentShader: BRIGHT_FRAG
    });
    this.blurMaterial = new THREE.ShaderMaterial({
      uniforms: { tSrc: { value: null }, uStep: { value: new THREE.Vector2() } },
      vertexShader: QUAD_VERT,
      fragmentShader: BLUR_FRAG
    });

    this.mainMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        tBloom: { value: null },
        uBloom: { value: 0 },
        uTime: { value: 0 },
        uRes: { value: new THREE.Vector2(1, 1) },
        uGrain: { value: 0.5 },
        uVignette: { value: 1.0 },
        uChroma: { value: 0.004 },
        uDistort: { value: 0 },
        uDesat: { value: 0.15 },
        uTint: { value: new THREE.Color(1, 1, 1) }
      },
      vertexShader: QUAD_VERT,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        uniform sampler2D tDiffuse, tBloom;
        uniform float uTime, uGrain, uVignette, uChroma, uDistort, uDesat, uBloom;
        uniform vec2 uRes;
        uniform vec3 uTint;
        ${COMMON}
        void main() {
          vec2 uv = vUv;
          if (uDistort > 0.0) {
            uv.x += sin(uv.y * 9.0 + uTime * 0.7) * 0.006 * uDistort;
            uv.y += sin(uv.x * 7.0 + uTime * 0.5) * 0.004 * uDistort;
          }
          vec2 dir = uv - 0.5;
          float d = length(dir);
          float ca = uChroma * (0.3 + d * 2.0) + uDistort * 0.004;
          vec3 col;
          col.r = texture2D(tDiffuse, uv + dir * ca).r;
          col.g = texture2D(tDiffuse, uv).g;
          col.b = texture2D(tDiffuse, uv - dir * ca).b;
          col += texture2D(tBloom, uv).rgb * uBloom;
          float lum = dot(col, vec3(0.299, 0.587, 0.114));
          col = mix(col, vec3(lum), uDesat);
          col *= uTint;
          gl_FragColor = vec4(max(col, 0.0), 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          float vig = smoothstep(0.95, 0.25, d * uVignette);
          gl_FragColor.rgb *= mix(0.55, 1.0, vig);
          float n = rand(vUv * uRes + fract(uTime * 7.13) * 100.0) - 0.5;
          gl_FragColor.rgb += n * uGrain * 0.045;
        }
      `
    });

    this.feedMaterial = new THREE.ShaderMaterial({
      toneMapped: false,
      uniforms: {
        tFeed: { value: null },
        uTime: { value: 0 },
        uRes: { value: new THREE.Vector2(1, 1) },
        uStatic: { value: 0 },
        uNoSignal: { value: 0 },
        uDistort: { value: 0 },
        uBright: { value: 1.6 },
        uAspect: { value: 1 },
        uTint: { value: new THREE.Color(0.78, 0.95, 0.86) },
        uDim: { value: 1 },
        uAlpha: { value: 1 }
      },
      vertexShader: QUAD_VERT,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        uniform sampler2D tFeed;
        uniform float uTime, uStatic, uNoSignal, uDistort, uBright, uAspect, uDim, uAlpha;
        uniform vec2 uRes;
        uniform vec3 uTint;
        ${COMMON}
        void main() {
          // Letterbox a 4:3 feed into the target.
          vec2 uv = vUv;
          uv.x = (uv.x - 0.5) * uAspect + 0.5;
          vec2 c = uv - 0.5;
          uv = 0.5 + c * (1.0 + 0.07 * dot(c, c));
          float line = floor(uv.y * 220.0);
          float t20 = floor(uTime * 18.0);
          uv.x += (rand(vec2(line, t20)) - 0.5) * 0.03 * uStatic;
          uv.x += sin(uv.y * 26.0 + uTime * 5.0) * 0.004 * uDistort;
          if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, uAlpha); return; }
          vec3 col = texture2D(tFeed, uv).rgb;
          float l = dot(col, vec3(0.3, 0.59, 0.11));
          l = pow(clamp(l * uBright, 0.0, 4.0) / (1.0 + l * uBright), 0.62) * 1.25;
          vec3 outc = vec3(l) * uTint;
          outc *= 0.86 + 0.14 * sin(uv.y * 720.0);
          float n = rand(uv * uRes + fract(uTime * 3.7) * 61.0);
          outc += (n - 0.5) * 0.07;
          float roll = smoothstep(0.0, 0.02, fract(uv.y - uTime * 0.07)) * 0.04;
          outc += roll;
          float s = clamp(max(uStatic * 0.75, uNoSignal), 0.0, 1.0);
          outc = mix(outc, vec3(n * 0.75), s);
          outc *= smoothstep(0.85, 0.3, length(c));
          gl_FragColor = vec4(outc * uDim, uAlpha);
        }
      `
    });
  }

  setSize(width, height) {
    this.size.set(width, height);
    this.sceneRT.setSize(width, height);
    const bw = Math.max(1, Math.round(width / 4));
    const bh = Math.max(1, Math.round(height / 4));
    this.bloomA.setSize(bw, bh);
    this.bloomB.setSize(bw, bh);
    this.mainMaterial.uniforms.uRes.value.set(width, height);
  }

  renderScene(scene, camera, params) {
    const r = this.renderer;
    if (!params.enabled) {
      r.setRenderTarget(null);
      r.render(scene, camera);
      return;
    }
    r.setRenderTarget(this.sceneRT);
    r.render(scene, camera);
    const bloom = params.bloom ?? 0;
    if (bloom > 0) this.renderBloom();
    const u = this.mainMaterial.uniforms;
    u.tDiffuse.value = this.sceneRT.texture;
    u.tBloom.value = this.bloomA.texture;
    u.uBloom.value = bloom;
    u.uTime.value = params.time;
    u.uGrain.value = params.grain;
    u.uVignette.value = params.vignette;
    u.uChroma.value = params.chroma;
    u.uDistort.value = params.distort;
    u.uDesat.value = params.desat;
    u.uTint.value.copy(params.tint);
    this.quad.material = this.mainMaterial;
    r.setRenderTarget(null);
    r.render(this.quadScene, this.quadCam);
  }

  /** Bright pass into bloomA, then two widening blur rounds (A -> B -> A). */
  renderBloom() {
    const r = this.renderer;
    const { width, height } = this.bloomA;
    const b = this.brightMaterial.uniforms;
    b.tSrc.value = this.sceneRT.texture;
    b.uTexel.value.set(1 / this.size.x, 1 / this.size.y);
    this.quad.material = this.brightMaterial;
    r.setRenderTarget(this.bloomA);
    r.render(this.quadScene, this.quadCam);
    const u = this.blurMaterial.uniforms;
    this.quad.material = this.blurMaterial;
    for (const spread of [1, 2]) {
      u.tSrc.value = this.bloomA.texture;
      u.uStep.value.set(spread / width, 0);
      r.setRenderTarget(this.bloomB);
      r.render(this.quadScene, this.quadCam);
      u.tSrc.value = this.bloomB.texture;
      u.uStep.value.set(0, spread / height);
      r.setRenderTarget(this.bloomA);
      r.render(this.quadScene, this.quadCam);
    }
  }

  /** Draws a feed texture with the CCTV shader into `target` (null = screen). */
  renderFeed(texture, target, params) {
    const r = this.renderer;
    const u = this.feedMaterial.uniforms;
    u.tFeed.value = texture;
    u.uTime.value = params.time;
    u.uStatic.value = params.staticAmount;
    u.uNoSignal.value = params.noSignal;
    u.uDistort.value = params.distort;
    u.uBright.value = params.bright ?? 1.6;
    u.uAspect.value = params.aspect ?? 1;
    u.uDim.value = params.dim ?? 1;
    const alpha = params.alpha ?? 1;
    u.uAlpha.value = alpha;
    const blend = alpha < 0.999;
    if (this.feedMaterial.transparent !== blend) {
      this.feedMaterial.transparent = blend;
      this.feedMaterial.needsUpdate = true;
    }
    if (target) u.uRes.value.set(target.width, target.height);
    else u.uRes.value.copy(this.size);
    this.quad.material = this.feedMaterial;
    r.setRenderTarget(target);
    const autoClear = r.autoClear;
    if (blend) r.autoClear = false; // draw over the frame already on screen (crossfade)
    r.render(this.quadScene, this.quadCam);
    r.autoClear = autoClear;
    r.setRenderTarget(null);
  }

  dispose() {
    this.sceneRT.dispose();
    this.bloomA.dispose();
    this.bloomB.dispose();
    this.brightMaterial.dispose();
    this.blurMaterial.dispose();
    this.mainMaterial.dispose();
    this.feedMaterial.dispose();
  }
}
