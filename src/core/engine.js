// ───────────────────────────────────────────────────────────────────────────
// Renderer, camera and the post-processing stack.
// ───────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// A tiny grade/vignette/sharpen pass — this is what gives the image its final
// "look": slight contrast S-curve, warm highlights, unsharp mask, vignette,
// plus an underwater tint when the camera is submerged.
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: new THREE.Vector2(1, 1) },
    sharpness: { value: 0.35 },
    vignette: { value: 0.32 },
    contrast: { value: 1.07 },
    saturation: { value: 1.09 },
    lift: { value: new THREE.Vector3(0.0, 0.0, 0.002) },
    underwater: { value: 0.0 },
    time: { value: 0 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float sharpness, vignette, contrast, saturation, underwater, time;
    uniform vec3 lift;
    varying vec2 vUv;

    void main(){
      vec2 uv = vUv;
      if (underwater > 0.001){
        uv += vec2(sin(uv.y*24.0 + time*1.7), cos(uv.x*21.0 + time*1.3)) * 0.0022 * underwater;
      }
      vec2 texel = 1.0 / resolution;
      vec3 c = texture2D(tDiffuse, uv).rgb;

      // unsharp mask for crisp edges
      vec3 blur = (
        texture2D(tDiffuse, uv + vec2( texel.x, 0.0)).rgb +
        texture2D(tDiffuse, uv + vec2(-texel.x, 0.0)).rgb +
        texture2D(tDiffuse, uv + vec2(0.0,  texel.y)).rgb +
        texture2D(tDiffuse, uv + vec2(0.0, -texel.y)).rgb) * 0.25;
      c = clamp(c + (c - blur) * sharpness, 0.0, 4.0);

      // grade
      c = (c - 0.5) * contrast + 0.5 + lift;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, saturation);

      if (underwater > 0.001) c = mix(c, c * vec3(0.42, 0.78, 0.95) + vec3(0.0,0.03,0.06), underwater);

      // vignette
      vec2 d = vUv - 0.5;
      c *= 1.0 - vignette * dot(d, d) * 1.6;

      // Ordered dither before the 8-bit blit. The sky is one long smooth ramp
      // and the grade stretches it — 1.07 contrast, then corners multiplied by
      // 0.744 — so it arrives with about fifty levels to spend on it and bands
      // every twenty pixels. Keyed off gl_FragCoord so the pattern is pinned to
      // the screen: a hash of uv would crawl and shimmer as the camera turns.
      float b = fract(dot(floor(gl_FragCoord.xy), vec2(0.0625, 0.140625)) * 4.0);
      c += (b - 0.5) / 255.0;

      gl_FragColor = vec4(max(c, 0.0), 1.0);
    }`,
};

export class Engine {
  constructor(canvas, settings) {
    this.settings = settings;
    this.canvas = canvas;

    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: false, powerPreference: 'high-performance',
      stencil: false, depth: true, alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this._shadowsWereEnabled = true;
    this.renderer.info.autoReset = false;   // reset once per frame, not per pass

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(settings.fov, 1, 0.08, 2600);
    this.camera.rotation.order = 'YXZ';

    // ── post ────────────────────────────────────────────────────────────
    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);

    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.22, 0.5, 1.05);
    this.composer.addPass(this.bloom);

    // Tone-map before grading: contrast and sharpening are display-referred
    // operations — run in linear HDR they crush every shadow to black.
    this.output = new OutputPass();
    this.composer.addPass(this.output);

    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);

    this.smaa = new SMAAPass(1, 1);
    this.composer.addPass(this.smaa);

    this.clock = new THREE.Clock();
    addEventListener('resize', () => this.resize());
    this.resize();
    this.applySettings();
    settings.onChange(() => this.applySettings());
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    const s = this.settings.renderScale;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const pr = Math.min(devicePixelRatio, 2) * s;
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    // the composer keeps its own pixel ratio — without this, renderScale only
    // shrinks the final blit and the expensive passes still run full-size
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    this.grade.uniforms.resolution.value.set(w * pr, h * pr);
    this.bloom.setSize(w * pr * 0.5, h * pr * 0.5);
  }

  applySettings() {
    const s = this.settings;
    this.camera.fov = s.fov;
    this.camera.updateProjectionMatrix();
    this.bloom.enabled = !!s.bloom;
    this.smaa.enabled = s.quality > 0;
    // shadowMap.enabled belongs to Game.applyShadowQuality — one owner for the
    // flag, or the two paths set it out of step. What has to happen here is the
    // recompile: the flag is baked into every program and three marks nothing
    // dirty when it flips (shadowMap.needsUpdate only re-renders the maps), so
    // Off → Soft used to leave USE_SHADOWMAP compiled out and the shadows never
    // came back, while On → Off left the last map bound and froze them in place.
    // Game.applyShadowQuality now guards the same flip for its own filter-type
    // recompile; both are idempotent (needsUpdate only bumps a version counter
    // that the next render reads), so whichever listener runs first is fine.
    const shadows = s.shadows > 0;
    if (shadows !== this._shadowsWereEnabled) {
      this._shadowsWereEnabled = shadows;
      this.scene.traverse((o) => {
        if (!o.isMesh) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) m.needsUpdate = true;
      });
    }
    this.renderer.shadowMap.needsUpdate = true;
    this.grade.uniforms.sharpness.value = s.sharpness ?? 0.35;
    this.resize();
  }

  setUnderwater(v) { this.grade.uniforms.underwater.value = v; }

  render(dt) {
    this.renderer.info.reset();
    this.grade.uniforms.time.value += dt;
    this.composer.render(dt);
    // The drawing buffer is thrown away once this task yields, so a screenshot
    // has to be taken here rather than whenever the key was pressed.
    if (this._pendingShot) {
      const { name, done } = this._pendingShot;
      this._pendingShot = null;
      this.renderer.domElement.toBlob((blob) => {
        if (!blob) { done?.(false); return; }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        done?.(true);
      });
    }
  }

  /**
   * Saves the frame. Embedded viewers sandbox downloads, so say so rather than
   * having the key quietly do nothing.
   * @returns {boolean} whether the save was actually attempted
   */
  screenshot(name = 'home.png', done = null) {
    const framed = (() => { try { return window.self !== window.top; } catch (_) { return true; } })();
    if (framed) return false;                    // embedded viewers sandbox downloads
    this._pendingShot = { name, done };
    return true;
  }
}
