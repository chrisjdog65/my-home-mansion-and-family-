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
    vignette: { value: 0.36 },
    contrast: { value: 1.13 },
    saturation: { value: 1.12 },
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

    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);

    this.smaa = new SMAAPass(1, 1);
    this.composer.addPass(this.smaa);

    this.output = new OutputPass();
    this.composer.addPass(this.output);

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
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2) * s);
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    const dpr = this.renderer.getPixelRatio();
    this.grade.uniforms.resolution.value.set(w * dpr, h * dpr);
    this.bloom.setSize(w * dpr * 0.5, h * dpr * 0.5);
  }

  applySettings() {
    const s = this.settings;
    this.camera.fov = s.fov;
    this.camera.updateProjectionMatrix();
    this.bloom.enabled = !!s.bloom;
    this.smaa.enabled = s.quality > 0;
    this.renderer.shadowMap.enabled = s.shadows > 0;
    this.renderer.shadowMap.needsUpdate = true;
    this.grade.uniforms.sharpness.value = s.quality === 0 ? 0.18 : 0.35;
    this.resize();
  }

  setUnderwater(v) { this.grade.uniforms.underwater.value = v; }

  render(dt) {
    this.renderer.info.reset();
    this.grade.uniforms.time.value += dt;
    this.composer.render(dt);
  }

  screenshot(name = 'home.png') {
    this.renderer.domElement.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    });
  }
}
