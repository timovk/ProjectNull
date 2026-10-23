import * as THREE from 'three';

const QUAD_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const COMMON = /* glsl */ `
  float rand(vec2 co) { return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }
`;

/**
 * Lightweight post-processing without extra dependencies.
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

    this.mainMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
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
        uniform sampler2D tDiffuse;
        uniform float uTime, uGrain, uVignette, uChroma, uDistort, uDesat;
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
    const u = this.mainMaterial.uniforms;
    u.tDiffuse.value = this.sceneRT.texture;
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
    this.mainMaterial.dispose();
    this.feedMaterial.dispose();
  }
}
