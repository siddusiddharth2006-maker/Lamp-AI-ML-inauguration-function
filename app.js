import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

import { gsap } from 'gsap';
import {
  createLampGeometry,
  createWickGeometry,
  createStageGeometry,
  createBackdropGeometry,
  createRevealPanelGeometry
} from './geometry.js';
import { createBrassMaterial, createSlateMaterial } from './textures.js';
import { FlameShader, HeatDistortionShader } from './shaders.js';
import { CeremonialAudio } from './audio.js';

// ─────────────────────────────────────────────
// CONFIG — all tuneable values in one place
// ─────────────────────────────────────────────
const CONFIG = {
  wickCollisionRadius: 34,    // mm — wick ignition proximity zone
  wickProximityRadius: 110,   // mm — emissive glow begins here
  dwellThreshold: 0.0,        // seconds — instant ignition on contact
  flameMaxHeight: 40,
  flameGrowthDuration: 0.80,
  perWickLightIntensity: 1.55,
  lightFlickerAmount: 0.32,
  bloomBaseStrength: 0.50,
  bloomMilestoneBoost: 0.12,
  particleMilestone: [8, 12, 18, 24, 44],
  celebrationOrbCount: [0, 1, 2, 3, 5],
};

// ─────────────────────────────────────────────
// SCENE GLOBALS
// ─────────────────────────────────────────────
let scene, camera, renderer, composer, bloomPass;
let controls, clock;
let lampMesh, stageMesh, backdropMesh;
let cursorFlameMesh;
let keyLight, fillLight, ambientLight;
let audioController;
let heatPass;

let revealPanelMesh;

let openingTimeline;
let currentPhase = 'opening';
let matchHeld = false;
let dragStart = new THREE.Vector2();

// Wick state — 5 independent objects
const wickMeshes = [];
const wickMaterials = [];   // cotton materials (for emissive glow feedback)
const lampFlames = [];
const flamePointLights = [];

const WICK_COUNT = 5;

// Per-wick state arrays
const wicksLit = new Array(WICK_COUNT).fill(false);
const wickIgnitionProgress = new Array(WICK_COUNT).fill(0.0);
const wickDwellTimer = new Array(WICK_COUNT).fill(0.0);
const wickProximityValue = new Array(WICK_COUNT).fill(0.0);
const wickIsIgniting = new Array(WICK_COUNT).fill(false);

// Wick world positions (centre of each wick tip)
// geometry.js places each wick at: translate(0, 164.5, 52.5) then rotateY(angle)
// So wick tip = (52.5*sin(angle), 164.5, 52.5*cos(angle))
const wickPositions = [];
for (let i = 0; i < WICK_COUNT; i++) {
  const angle = (i * 2 * Math.PI) / WICK_COUNT;
  wickPositions.push(new THREE.Vector3(
    52.5 * Math.sin(angle),
    164.5,
    52.5 * Math.cos(angle)
  ));
}

// Lamp centre in world space — used for cursor hide/show zone (160 world units = ~160mm)
const LAMP_CENTER = new THREE.Vector3(0, 140, 0);
const LAMP_CURSOR_HIDE_RADIUS = 160;  // world units

// Track whether browser cursor is currently hidden
let browserCursorHidden = false;

// Cursor state — flame cursor is ALWAYS visible
let mouse2D = new THREE.Vector2(-999, -999);
let mouse3DTarget = new THREE.Vector3(0, 160, 150);
let lastMouse3DPos = new THREE.Vector3(0, 160, 150);
let cursorVelocity = new THREE.Vector3();

// Environment state
let currentWarming = 0.0;
let celebrationMilestonesFired = new Array(WICK_COUNT).fill(false);
let celebrationTriggered = false;   // grand (9th wick) celebration
let cameraZoomTarget = 1.0;         // multiplier applied to camera Z
let selectedSoundStyle = 'gong';    // default reveal sound style: gong, cyber, shankh, cinematic


// DOM
const preloader = document.getElementById('preloader');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const hudOverlay = document.getElementById('hud-overlay');
const btnAudioToggle = document.getElementById('btn-audio-toggle');
const volumeOnSvg = document.getElementById('svg-volume-on');
const volumeOffSvg = document.getElementById('svg-volume-off');
const interactiveHint = document.getElementById('interactive-hint');
const celebratoryReveal = document.getElementById('celebratory-reveal');
const canvasContainer = document.getElementById('canvas-container');

// ─────────────────────────────────────────────
// PARTICLE SYSTEM
// ─────────────────────────────────────────────
const MAX_PARTICLES = 380;
let particleGeometry, particleMaterial, particlePoints;
const particles = [];

class Particle {
  constructor(pos, vel, color, size, maxLife, type) {
    this.pos = pos.clone();
    this.vel = vel.clone();
    this.color = color.clone();
    this.size = size;
    this.life = maxLife;
    this.maxLife = maxLife;
    this.type = type;
    this.phase = Math.random() * Math.PI * 2; // for orb sine drift
  }

  update(dt) {
    this.life -= dt;
    if (this.life <= 0) return false;

    if (this.type === 'spark') {
      this.vel.y -= 290.0 * dt;
      this.vel.multiplyScalar(0.91);
    } else if (this.type === 'gold_sparkle') {
      this.vel.y += 16.0 * dt;
      this.vel.x += (Math.random() - 0.5) * 10.0 * dt;
      this.vel.z += (Math.random() - 0.5) * 10.0 * dt;
      this.vel.multiplyScalar(0.97);
    } else if (this.type === 'ember') {
      this.vel.y += 10.0 * dt;
      this.vel.x += (Math.random() - 0.5) * 6.0 * dt;
      this.vel.z += (Math.random() - 0.5) * 6.0 * dt;
      this.vel.multiplyScalar(0.98);
    } else if (this.type === 'cursor_ember') {
      this.vel.y += 20.0 * dt;
      this.vel.multiplyScalar(0.93);
    } else if (this.type === 'orb') {
      // Orbs rise slowly with gentle sinusoidal drift
      this.vel.y = 18.0;
      const t = (this.maxLife - this.life) / this.maxLife;
      this.pos.x += Math.sin(this.phase + t * 4.0) * 6.0 * dt;
      this.pos.z += Math.cos(this.phase + t * 3.0) * 4.0 * dt;
    }

    this.pos.addScaledVector(this.vel, dt);
    return true;
  }
}

function initParticles() {
  particleGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(MAX_PARTICLES * 3);
  const colors    = new Float32Array(MAX_PARTICLES * 3);
  const sizes     = new Float32Array(MAX_PARTICLES);

  particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particleGeometry.setAttribute('color',    new THREE.BufferAttribute(colors,    3));
  particleGeometry.setAttribute('size',     new THREE.BufferAttribute(sizes,     1));

  particleMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute float size;
      attribute vec3 color;
      varying vec3 vColor;
      void main() {
        vColor = color;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * (300.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      void main() {
        float dist = length(gl_PointCoord - vec2(0.5));
        if (dist > 0.5) discard;
        float alpha = smoothstep(0.5, 0.08, dist);
        gl_FragColor = vec4(vColor, alpha * 0.95);
      }
    `
  });

  particlePoints = new THREE.Points(particleGeometry, particleMaterial);
  particlePoints.renderOrder = 10;
  scene.add(particlePoints);
}

function spawnParticle(pos, vel, color, size, maxLife, type) {
  if (particles.length >= MAX_PARTICLES) particles.shift();
  particles.push(new Particle(pos, vel, color, size, maxLife, type));
}

function updateParticles(dt) {
  const positions = particleGeometry.attributes.position.array;
  const colors    = particleGeometry.attributes.color.array;
  const sizes     = particleGeometry.attributes.size.array;

  let activeCount = 0;
  let writeIndex = 0;
  for (let readIndex = 0; readIndex < particles.length; readIndex++) {
    const p = particles[readIndex];
    if (!p.update(dt)) continue;

    particles[writeIndex++] = p;
    positions[(writeIndex - 1) * 3]     = p.pos.x;
    positions[(writeIndex - 1) * 3 + 1] = p.pos.y;
    positions[(writeIndex - 1) * 3 + 2] = p.pos.z;

    const ageRatio = p.life / p.maxLife;
    let r = p.color.r * ageRatio;
    let g = p.color.g * ageRatio;
    let b = p.color.b * ageRatio;

    if (p.type === 'gold_sparkle') {
      const twinkle = 0.65 + 0.35 * Math.sin(p.life * 28.0);
      r *= twinkle;
      g *= twinkle;
      b *= twinkle;
    } else if (p.type === 'orb') {
      const pulse = 0.75 + 0.25 * Math.sin(p.life * 5.0);
      r *= pulse;
      g *= pulse;
      b *= pulse;
    }

    colors[(writeIndex - 1) * 3]     = r;
    colors[(writeIndex - 1) * 3 + 1] = g;
    colors[(writeIndex - 1) * 3 + 2] = b;

    const sizeScale = p.type === 'orb' ? (1.0 + (1.0 - ageRatio) * 0.5) : Math.max(0.2, ageRatio);
    sizes[writeIndex - 1] = p.size * sizeScale;
  }

  particles.length = writeIndex;

  particleGeometry.attributes.position.needsUpdate = true;
  particleGeometry.attributes.color.needsUpdate    = true;
  particleGeometry.attributes.size.needsUpdate     = true;
  particleGeometry.setDrawRange(0, activeCount);
}

// ─────────────────────────────────────────────
// ENVIRONMENT PROBE
// ─────────────────────────────────────────────
function generateStudioEnvironment(renderer) {
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color('#030306');

  const mkSphere = (color, pos, scale) => {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(25, 16, 16),
      new THREE.MeshBasicMaterial({ color })
    );
    m.position.set(...pos);
    m.scale.set(...scale);
    envScene.add(m);
  };

  mkSphere(0x335599, [-70, 50, -40], [1, 3, 1]);
  mkSphere(0xcc9944, [60, 70, 50],   [3, 3, 3]);
  mkSphere(0xaaaaaa, [0, 120, 0],    [5, 0.4, 5]);

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const cubeRT = new THREE.WebGLCubeRenderTarget(256, {
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    type: THREE.HalfFloatType,
  });

  const cubeCamera = new THREE.CubeCamera(1, 1000, cubeRT);
  cubeCamera.update(renderer, envScene);

  const envMap = pmrem.fromCubemap(cubeRT.texture).texture;
  pmrem.dispose();
  cubeRT.dispose();
  return envMap;
}

// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────
function init() {
  clock = new THREE.Clock();
  audioController = new CeremonialAudio();

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  canvasContainer.appendChild(renderer.domElement);

  // Scene
  scene = new THREE.Scene();
  // Use a constant white background for the entire experience
  scene.background = new THREE.Color(0xffffff);
  // Keep a very subtle fog so the scene doesn't feel flat; density is very low
  scene.fog = new THREE.FogExp2(0xffffff, 0.00035);
  renderer.setClearColor(scene.background);

  // Camera
  camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 2000);
  camera.position.set(0, 165, 480);

  // Environment
  scene.environment = generateStudioEnvironment(renderer);

  // Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping    = true;
  controls.dampingFactor    = 0.05;
  controls.target.set(0, 110, 0);
  controls.minDistance      = 250;
  controls.maxDistance      = 750;
  controls.maxPolarAngle    = Math.PI / 2 - 0.05;
  controls.autoRotate       = true;
  controls.autoRotateSpeed  = 0.32;
  controls.addEventListener('start', () => {
    controls.autoRotate = false;
    // Background is already set permanently in enterExperience — no change here
  });

  // ── Lighting ──────────────────────────────
  keyLight = new THREE.DirectionalLight(0xfff5dc, 1.75);
  keyLight.position.set(-150, 250, 120);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width  = 2048;
  keyLight.shadow.mapSize.height = 2048;
  keyLight.shadow.bias           = -0.0003;
  keyLight.shadow.normalBias     = 0.015;
  const d = 150;
  Object.assign(keyLight.shadow.camera, { left: -d, right: d, top: d, bottom: -d, near: 50, far: 600 });
  scene.add(keyLight);

  fillLight = new THREE.HemisphereLight(0x3c5a7d, 0x5f412a, 0.78);
  scene.add(fillLight);

  ambientLight = new THREE.AmbientLight(0x324b66, 0.55);
  scene.add(ambientLight);

  const extraFill = new THREE.PointLight(0x9ab8dd, 0.14, 1200);
  extraFill.position.set(0, 280, 220);
  scene.add(extraFill);

  const rimLight = new THREE.DirectionalLight(0xc8d8ff, 0.24);
  rimLight.position.set(120, 220, -220);
  rimLight.target.position.set(0, 140, 0);
  scene.add(rimLight);
  scene.add(rimLight.target);

  // Per-wick point lights (castShadow disabled to eliminate 30 extra render passes per frame for smooth 60fps movement)
  for (let i = 0; i < WICK_COUNT; i++) {
    const light = new THREE.PointLight(0xff8833, 0.0, 420, 1.6);
    light.position.copy(wickPositions[i]);
    light.castShadow = false;
    scene.add(light);
    flamePointLights.push(light);
  }

  // Flanking ambient fills
  [[-200, 100, -100], [200, 100, -100]].forEach(([x, y, z]) => {
    const fillLight = new THREE.PointLight(0xb8860b, 0.05, 500);
    fillLight.position.set(x, y, z);
    scene.add(fillLight);
  });

  // ── Build assets ──────────────────────────
  updateProgress(0.10, 'Forging lamp geometry…');
  setTimeout(() => {
    const lampGeo     = createLampGeometry();
    const wickGeo     = createWickGeometry();
    const stageGeo    = createStageGeometry();
    const backdropGeo = createBackdropGeometry();

    updateProgress(0.30, 'Drawing brass patinas…');

    const brassMaterial = createBrassMaterial((prog, msg) => updateProgress(0.30 + prog * 0.50, msg));
    const slateMaterial = createSlateMaterial();

    const cottonWickMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(240 / 255, 235 / 255, 225 / 255),
      emissive: new THREE.Color(1.0, 0.75, 0.2),
      emissiveIntensity: 0.0,    // animated per proximity
      roughness: 0.85,
      metalness: 0.02,
    });

    const backdropMaterial = new THREE.MeshStandardMaterial({
      color: 0x0a0c10,
      roughness: 0.82,
      metalness: 0.15,
    });

    // Lamp & Stage
    lampMesh   = new THREE.Mesh(lampGeo,     brassMaterial);
    lampMesh.castShadow = lampMesh.receiveShadow = true;
    scene.add(lampMesh);

    stageMesh  = new THREE.Mesh(stageGeo,    slateMaterial);
    stageMesh.receiveShadow = true;
    scene.add(stageMesh);

    backdropMesh = new THREE.Mesh(backdropGeo, backdropMaterial);
    backdropMesh.receiveShadow = true;
    scene.add(backdropMesh);

    // Reveal panel for AI continuation
    revealPanelMesh = new THREE.Mesh(createRevealPanelGeometry(), new THREE.MeshPhysicalMaterial({
      transparent: true,
      opacity: 0.0,
      color: 0x0d1621,
      roughness: 0.1,
      metalness: 0.0,
      transmission: 0.92,
      thickness: 0.8,
      envMapIntensity: 1.0,
      side: THREE.DoubleSide,
    }));
    revealPanelMesh.visible = false;
    scene.add(revealPanelMesh);

    // Cotton wicks (5)
    for (let i = 0; i < WICK_COUNT; i++) {
      const angle   = (i * 2 * Math.PI) / WICK_COUNT;
      const mat     = cottonWickMaterial.clone();
      const wick    = new THREE.Mesh(wickGeo, mat);
      wick.rotation.y = angle;
      wick.castShadow = true;
      scene.add(wick);
      wickMeshes.push(wick);
      wickMaterials.push(mat);
    }

    // ── Flame Shaders ────────────────────────
    const flameGeo = new THREE.ConeGeometry(4.5, 36.0, 32, 16, true);
    flameGeo.translate(0, 18.0, 0);

    // Cursor Flame
    const cursorFlameMat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(FlameShader.uniforms),
      vertexShader:   FlameShader.vertexShader,
      fragmentShader: FlameShader.fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      depthTest: false,
    });

    cursorFlameMesh = new THREE.Mesh(flameGeo, cursorFlameMat);
    cursorFlameMesh.position.copy(mouse3DTarget);
    cursorFlameMesh.renderOrder = 9999;
    scene.add(cursorFlameMesh);

    // 5 Lamp Flames
    for (let i = 0; i < WICK_COUNT; i++) {
      const angle = (i * 2 * Math.PI) / WICK_COUNT;
      const mat   = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.clone(FlameShader.uniforms),
        vertexShader:   FlameShader.vertexShader,
        fragmentShader: FlameShader.fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      mat.uniforms.uProgress.value = 0.0;
      const mesh = new THREE.Mesh(flameGeo, mat);
      mesh.position.copy(wickPositions[i]);
      mesh.rotation.y = angle;
      scene.add(mesh);
      lampFlames.push(mesh);
    }

    initParticles();
    initPostProcessing();

    updateProgress(1.0, 'Experience ready.');
    setTimeout(() => {
      preloader.classList.add('hidden');
      // Auto-enter with audio — no consent screen
      enterExperience(false);
    }, 400);
  }, 100);

  // Events
  window.addEventListener('resize',    onWindowResize);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('touchmove', onTouchMove, { passive: false });
  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointerup',   onPointerUp);
  renderer.domElement.addEventListener('pointermove', onPointerMove);

  btnAudioToggle.addEventListener('click', toggleAudio);

  initSoundStylePicker();

  // Always hide browser cursor on canvas — 3D flame takes over
  renderer.domElement.style.cursor = 'none';
}

function initSoundStylePicker() {
  const styleBtns = document.querySelectorAll('.sound-style-btn');
  styleBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      styleBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedSoundStyle = btn.getAttribute('data-style');
      audioController.playDepartmentRevealSound(selectedSoundStyle);
    });
  });

  const celebrationTitle = document.getElementById('celebration-title');
  if (celebrationTitle) {
    celebrationTitle.style.cursor = 'pointer';
    celebrationTitle.addEventListener('click', () => {
      audioController.playDepartmentRevealSound(selectedSoundStyle);
    });
  }
}

function updateProgress(val, msg) {
  progressBar.style.width  = `${val * 100}%`;
  progressText.textContent = msg;
}

function enterExperience(silent) {
  consentOverlay.classList.add('hidden');
  hudOverlay.classList.remove('hidden');
  audioController.init(silent);

  // Set the dark background once, permanently — never changes again
  const experienceBG = new THREE.Color(0x0f1114);
  scene.background.copy(experienceBG);
  if (scene.fog) scene.fog.color.copy(experienceBG);
  renderer.setClearColor(experienceBG);

  // Load user-provided background audio file (placed in project root)
  try {
    audioController.setBackgroundTrack('bg_music.mp3');
  } catch (e) {
    console.warn('Failed to set background track:', e);
  }
  refreshAudioButton(silent);
  clock.getDelta();
  startOpeningSequence();
  animate();
}

function startOpeningSequence() {
  openingTimeline = gsap.timeline({ defaults: { ease: 'power3.out' } });

  // initial camera and lamp reveal
  camera.position.set(0, 165, 520);
  camera.lookAt(0, 130, 0);
  controls.target.set(0, 110, 0);
  controls.update();

  revealPanelMesh.visible = false;

  openingTimeline
    .to(camera.position, { z: 430, duration: 3.8, ease: 'power2.inOut' }, 0.0)
    .to(camera.position, { x: 12, y: 155, duration: 3.8, ease: 'power2.inOut' }, 0.0)
    .to(camera.rotation, { x: '-=0.04', y: '+=0.03', duration: 3.8, ease: 'sine.inOut' }, 0.0)
    .add(() => {
      interactiveHint.classList.remove('fade-out');
    }, 3.8)
    .add(() => {
      controls.autoRotate = true;
    }, 4.0);
}

function refreshAudioButton(muted) {
  if (muted) {
    btnAudioToggle.classList.remove('active');
    volumeOnSvg.classList.add('hidden');
    volumeOffSvg.classList.remove('hidden');
  } else {
    btnAudioToggle.classList.add('active');
    volumeOnSvg.classList.remove('hidden');
    volumeOffSvg.classList.add('hidden');
  }
}

function toggleAudio() {
  audioController.setMute(!audioController.isMuted);
  refreshAudioButton(audioController.isMuted);
}

// ─────────────────────────────────────────────
// POST PROCESSING
// ─────────────────────────────────────────────
function initPostProcessing() {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    CONFIG.bloomBaseStrength * 0.42, 0.32, 0.48
  );
  composer.addPass(bloomPass);

  heatPass = new ShaderPass(HeatDistortionShader);
  heatPass.uniforms.uAspectRatio.value = window.innerWidth / window.innerHeight;
  heatPass.uniforms.uStrength.value    = 0.0;
  heatPass.enabled = false;
  composer.addPass(heatPass);
}

// ─────────────────────────────────────────────
// MOUSE / TOUCH → 3D PROJECTION
// ─────────────────────────────────────────────
const projectionPlane = new THREE.Plane();
const raycaster = new THREE.Raycaster();

function updateMouse3D(clientX, clientY) {
  mouse2D.x =  (clientX / window.innerWidth)  * 2 - 1;
  mouse2D.y = -(clientY / window.innerHeight) * 2 + 1;

  const camDir = new THREE.Vector3();
  camera.getWorldDirection(camDir);
  projectionPlane.setFromNormalAndCoplanarPoint(
    camDir.negate(),
    new THREE.Vector3(0, 178, 25)
  );

  raycaster.setFromCamera(mouse2D, camera);
  const hit = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(projectionPlane, hit)) {
    hit.x = THREE.MathUtils.clamp(hit.x, -240, 240);
    hit.y = THREE.MathUtils.clamp(hit.y,   40, 340);
    hit.z = THREE.MathUtils.clamp(hit.z, -120, 240);
    mouse3DTarget.copy(hit);
  }
}

function onMouseMove(e)  { updateMouse3D(e.clientX, e.clientY); }
function onTouchMove(e)  {
  if (e.touches.length > 0) { updateMouse3D(e.touches[0].clientX, e.touches[0].clientY); e.preventDefault(); }
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  if (heatPass) heatPass.uniforms.uAspectRatio.value = camera.aspect;
}

function onPointerDown(e) {
  dragStart.set(e.clientX, e.clientY);
  controls.autoRotate = false;
  igniteNearbyWick();
}

function igniteNearbyWick() {
  if (!cursorFlameMesh) return;
  for (let i = 0; i < WICK_COUNT; i++) {
    if (wicksLit[i]) continue;
    const dist = cursorFlameMesh.position.distanceTo(wickPositions[i]);
    if (dist < CONFIG.wickCollisionRadius) {
      triggerWickIgnition(i);
      break;
    }
  }
}

function onPointerUp() {
  // No pointer-hold interaction is required for instant wick ignition.
}

function onPointerMove(e) {
  // Direct cursor flame interaction handles ignition automatically.
}

function worldToScreen(position) {
  const pos = position.clone();
  pos.project(camera);
  return new THREE.Vector2(
    (pos.x + 1) * window.innerWidth * 0.5,
    (1 - pos.y) * window.innerHeight * 0.5
  );
}

// Hide browser cursor within LAMP_CURSOR_HIDE_RADIUS of lamp centre;
// show default cursor when far away so HUD buttons still work.
// ─────────────────────────────────────────────
function updateCursorVisibility() {
  if (!cursorFlameMesh) return;
  const distToLamp = cursorFlameMesh.position.distanceTo(LAMP_CENTER);
  const shouldHide = distToLamp < LAMP_CURSOR_HIDE_RADIUS;
  if (shouldHide !== browserCursorHidden) {
    browserCursorHidden = shouldHide;
    // canvas always none; body cursor toggles for HUD layer
    document.body.style.cursor = shouldHide ? 'none' : 'default';
  }
}

// ─────────────────────────────────────────────
// ANIMATE (main loop)
// ─────────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);
  const dt   = Math.min(clock.getDelta(), 0.033);
  const time = clock.getElapsedTime();

  controls.update();

  // ── 1. Cursor movement & stretch ──────────
  lastMouse3DPos.copy(cursorFlameMesh.position);
  cursorFlameMesh.position.lerp(mouse3DTarget, 0.22);
  cursorVelocity.subVectors(cursorFlameMesh.position, lastMouse3DPos).multiplyScalar(1.0 / Math.max(dt, 0.001));
  const speed = cursorVelocity.length();

  const stretchY  =  1.0 + THREE.MathUtils.clamp(speed * 0.0003, 0.0, 0.16);
  const pinchXZ   =  1.0 - THREE.MathUtils.clamp(speed * 0.00015, 0.0, 0.09);
  cursorFlameMesh.scale.set(pinchXZ, stretchY, pinchXZ);

  cursorFlameMesh.rotation.z = THREE.MathUtils.lerp(cursorFlameMesh.rotation.z, -cursorVelocity.x * 0.0012, 0.15);
  cursorFlameMesh.rotation.x = THREE.MathUtils.lerp(cursorFlameMesh.rotation.x,  cursorVelocity.z * 0.0012, 0.15);
  cursorFlameMesh.material.uniforms.uTime.value = time;
  cursorFlameMesh.material.uniforms.uIntensity.value = 1.4;

  // ── 2. Cursor trail embers (always active) ─
  if (speed > 5) {
    const trailRate = 0.07 + speed * 0.00018;
    if (Math.random() < trailRate) {
      const tipPos = new THREE.Vector3(0, 30, 0).applyMatrix4(cursorFlameMesh.matrixWorld);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 8  - cursorVelocity.x * 0.05,
        Math.random() * 15 + 10,
        (Math.random() - 0.5) * 8  - cursorVelocity.z * 0.05
      );
      const col = new THREE.Color(0xff8822).lerp(new THREE.Color(0xffea88), Math.random());
      spawnParticle(tipPos, vel, col, Math.random() * 2.5 + 1.2, 0.9, 'cursor_ember');
    }
  }

  // ── 3. Per-wick proximity, glow, & dwell ──
  let litCount = 0;
  for (let i = 0; i < WICK_COUNT; i++) { if (wicksLit[i]) litCount++; }
  for (let i = 0; i < WICK_COUNT; i++) {
    if (wicksLit[i]) {
      wickProximityValue[i] = 0.0;
      wickMaterials[i].emissiveIntensity = 0.0; // lit wicks glow from flame light, not emissive
      continue;
    }

    const dist = cursorFlameMesh.position.distanceTo(wickPositions[i]);

    if (dist < CONFIG.wickProximityRadius) {
      // Proximity factor 0→1 as cursor closes in
      wickProximityValue[i] = 1.0 - THREE.MathUtils.clamp(
        (dist - CONFIG.wickCollisionRadius) / (CONFIG.wickProximityRadius - CONFIG.wickCollisionRadius),
        0.0, 1.0
      );

      // Emissive warm glow on cotton wick
      wickMaterials[i].emissiveIntensity = wickProximityValue[i] * 0.80;

      if (dist < CONFIG.wickCollisionRadius) {
        wickDwellTimer[i] += dt;

        if (!wicksLit[i]) {
          triggerWickIgnition(i);
        }

        // Spark contact sizzle
        const density = Math.floor(Math.max(wickDwellTimer[i], 0.05) * 14);
        for (let s = 0; s < density; s++) {
          if (Math.random() < 0.22) {
            const vel = new THREE.Vector3(
              (Math.random() - 0.5) * 55,
              Math.random() * 75 + 38,
              (Math.random() - 0.5) * 55
            );
            const col = new THREE.Color(0xffffff).lerp(new THREE.Color(0xffbf3a), Math.random());
            spawnParticle(wickPositions[i], vel, col, Math.random() * 3.2 + 1.8, 0.28, 'spark');
          }
        }

        // Ignition threshold
        if (wickDwellTimer[i] >= CONFIG.dwellThreshold) {
          triggerWickIgnition(i);
        }
      } else {
        wickDwellTimer[i] = Math.max(0, wickDwellTimer[i] - dt * 2.5);
      }
    } else {
      // Outside proximity — fade glow and reset timer
      wickProximityValue[i] = THREE.MathUtils.lerp(wickProximityValue[i], 0.0, dt * 6.0);
      wickMaterials[i].emissiveIntensity = wickProximityValue[i] * 0.80;
      wickDwellTimer[i]    = Math.max(0, wickDwellTimer[i] - dt * 2.5);
    }
  }

  // Audio — proximity crackle from nearest unlit wick
  let maxProx = 0.0;
  for (let i = 0; i < WICK_COUNT; i++) {
    if (!wicksLit[i]) maxProx = Math.max(maxProx, wickProximityValue[i]);
  }
  const baseCrackle = litCount * 0.10;
  audioController.updateProximity(Math.max(baseCrackle, maxProx));

  // Interactive hint — fade once any wick proximity is detected
  if (maxProx > 0.3) interactiveHint.classList.add('fade-out');

  // ── 4. Animate each burning flame ─────────
  for (let i = 0; i < WICK_COUNT; i++) {
    if (!wicksLit[i]) continue;

    // Smooth ignition growth: progress increases over configured flame growth duration
    wickIgnitionProgress[i] = Math.min(1.0, wickIgnitionProgress[i] + dt / CONFIG.flameGrowthDuration);
    lampFlames[i].material.uniforms.uProgress.value = wickIgnitionProgress[i];
    lampFlames[i].material.uniforms.uTime.value     = time + i * 24.7; // phase offset

    // Independent LFO flicker per light
    const lfo  = CONFIG.lightFlickerAmount * Math.sin(time * 34.0 + i * 8.3);
    const rand = (Math.random() - 0.5) * 0.14;
    flamePointLights[i].intensity = (CONFIG.perWickLightIntensity + lfo + rand) * wickIgnitionProgress[i];
    flamePointLights[i].position.y = wickPositions[i].y + 9.0 + 2.8 * Math.sin(time * 11.5 + i * 14.0);

    // Drone swell
    audioController.updateFlameHissVolume(wickIgnitionProgress[i] * ((i + 1) / WICK_COUNT));

    // Steady smoke embers from each flame
    if (Math.random() < 0.055) {
      const tipPos = wickPositions[i].clone().add(new THREE.Vector3(0, 22, 0));
      const vel    = new THREE.Vector3(
        (Math.random() - 0.5) * 4.0,
        Math.random() * 12.0 + 7.0,
        (Math.random() - 0.5) * 4.0
      );
      const col = new THREE.Color(0xff5511).lerp(new THREE.Color(0xffaa22), Math.random());
      spawnParticle(tipPos, vel, col, Math.random() * 2.0 + 1.0, 1.6, 'ember');
    }
  }

  // ── 5. Progressive environment brightening (BackgroundBrightnessManager) ─
  // Background stays static now.
  // Heat distortion scales non-linearly with lit count
  if (heatPass) {
    const heatTarget = Math.pow(litCount / WICK_COUNT, 0.6) * 0.35;
    heatPass.enabled = heatTarget > 0.015;
    heatPass.uniforms.uStrength.value = THREE.MathUtils.lerp(
      heatPass.uniforms.uStrength.value,
      heatTarget,
      dt * 1.1
    );
  }

  // ── 5b. Cursor zone visibility ─
  updateCursorVisibility();

  // ── 6. Camera gentle dolly zoom on celebration
  if (celebrationTriggered) {
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, 390, dt * 0.9);
    bloomPass.strength = THREE.MathUtils.lerp(bloomPass.strength, 1.30, dt * 1.5);
  }

  // ── 7. Heat distortion centroid ───────────
  if (heatPass) {
    const centroid = new THREE.Vector3();
    let litActive  = 0;
    for (let i = 0; i < WICK_COUNT; i++) {
      if (wicksLit[i]) { centroid.add(wickPositions[i]); litActive++; }
    }
    if (litActive > 0) centroid.divideScalar(litActive);
    else centroid.copy(cursorFlameMesh.position);

    const sp = centroid.clone().project(camera);
    heatPass.uniforms.uFlameScreenPos.value.set(sp.x * 0.5 + 0.5, sp.y * 0.5 + 0.5);
    heatPass.uniforms.uTime.value = time;
  }

  updateParticles(dt);
  composer.render();
}

// ─────────────────────────────────────────────
// WICK IGNITION
// ─────────────────────────────────────────────
function triggerWickIgnition(idx) {
  if (wicksLit[idx]) return;  // guard against double-fire
  wicksLit[idx] = true;
  wickDwellTimer[idx] = 0.0;

  audioController.triggerIgnitionWhoosh();

  // Spark burst at the ignited wick
  for (let i = 0; i < 10; i++) {
    const angle    = Math.random() * Math.PI * 2;
    const spd      = Math.random() * 75 + 45;
    const vel      = new THREE.Vector3(
      Math.cos(angle) * spd,
      Math.random() * 85 + 55,
      Math.sin(angle) * spd
    );
    const col = new THREE.Color(0xffffff).lerp(new THREE.Color(0xffd250), Math.random());
    spawnParticle(wickPositions[idx], vel, col, Math.random() * 3.2 + 1.8, 0.38, 'spark');
  }

  // Count how many are now lit
  let litCount = 0;
  for (let i = 0; i < WICK_COUNT; i++) { if (wicksLit[i]) litCount++; }

  // Fire the milestone for this wick number
  if (!celebrationMilestonesFired[idx]) {
    celebrationMilestonesFired[idx] = true;
    triggerMilestoneCelebration(litCount);
  }

  // Re-enable automatic rotation for the next thread of ignition,
  // with a slightly higher speed for each newly lit wick.
  if (litCount < WICK_COUNT) {
    setTimeout(() => {
      controls.autoRotate = true;
      controls.autoRotateSpeed = Math.min(0.56, 0.22 + litCount * 0.06);
    }, 1200);
  }

  // Grand celebration on 9th (final) wick
  if (litCount === WICK_COUNT && !celebrationTriggered) {
    celebrationTriggered = true;
    // Play full orchestral chime cascade then grand celebration
    audioController.triggerCelebrationChimes();
    setTimeout(() => {
      triggerGrandCelebration();
      revealFinalUI();
    }, 1800);
  }
}

function revealFinalUI() {
  document.getElementById('celebratory-reveal').classList.remove('hidden');
  document.getElementById('nav-panel').classList.add('visible');
  gsap.to(revealPanelMesh.material, { opacity: 0.55, duration: 2.2, ease: 'power2.out' });
  revealPanelMesh.visible = true;
}

// ─────────────────────────────────────────────
// PROGRESSIVE MILESTONE CELEBRATIONS
// ─────────────────────────────────────────────
function triggerMilestoneCelebration(wickNumber) {
  // Play scaled chime (disabled to avoid piano-like sound on wick ignition)
  // audioController.triggerMilestoneChime(wickNumber);

  const particleCount = CONFIG.particleMilestone[wickNumber - 1];
  const orbCount      = CONFIG.celebrationOrbCount[wickNumber - 1];

  // Radial gold burst — larger on each milestone
  for (let i = 0; i < particleCount; i++) {
    const angle     = Math.random() * Math.PI * 2;
    const elevation = Math.random() * Math.PI * 0.6;
    const spd       = Math.random() * 80 + 30;
    const origin    = new THREE.Vector3(0, 148, 0); // lamp crown
    const vel       = new THREE.Vector3(
      Math.cos(angle) * Math.cos(elevation) * spd,
      Math.sin(elevation) * spd + 40,
      Math.sin(angle) * Math.cos(elevation) * spd
    );
    const col = new THREE.Color(0xffd700).lerp(new THREE.Color(0xffea88), Math.random());
    spawnParticle(origin, vel, col, Math.random() * 3.5 + 1.5, Math.random() * 1.5 + 1.0, 'gold_sparkle');
  }

  // Bloom boost per milestone
  if (bloomPass) {
    const target = CONFIG.bloomBaseStrength + wickNumber * CONFIG.bloomMilestoneBoost;
    // Smoothly bump then relax (use timeout to reset after burst)
    bloomPass.strength = target;
    setTimeout(() => {
      if (!celebrationTriggered) bloomPass.strength = target; // keep if not final
    }, 1200);
  }

  // Milestone 6 → gentle camera pull-in (approx halfway)
  if (wickNumber === 6) {
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, camera.position.z * 0.96, 0.6);
  }

  // Milestone 4+ → floating light orbs
  if (orbCount > 0) {
    spawnFloatingOrbs(orbCount);
  }
}

function spawnFloatingOrbs(count) {
  for (let i = 0; i < count; i++) {
    const angle  = (i / count) * Math.PI * 2 + Math.random() * 0.6;
    const radius = 55 + Math.random() * 30;
    const origin = new THREE.Vector3(
      Math.cos(angle) * radius,
      140 + Math.random() * 40,
      Math.sin(angle) * radius
    );
    const vel = new THREE.Vector3(0, 18.0, 0); // rise velocity handled in update
    const col = new THREE.Color(0xffcc44).lerp(new THREE.Color(0xffeeaa), Math.random());
    spawnParticle(origin, vel, col, Math.random() * 10 + 8, Math.random() * 2.5 + 3.0, 'orb');
  }
}

// ─────────────────────────────────────────────
// GRAND CELEBRATION (9th / final wick)
// ─────────────────────────────────────────────
function triggerGrandCelebration() {
  // Grand fountain from all 5 wick tips + centre
  for (let wickIdx = 0; wickIdx < WICK_COUNT; wickIdx++) {
    const emitter = wickPositions[wickIdx].clone().add(new THREE.Vector3(0, 10, 0));

    // 20 gold sparkles per wick
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd   = Math.random() * 38 + 10;
      const vel   = new THREE.Vector3(
        Math.cos(angle) * spd,
        Math.random() * 115 + 60,
        Math.sin(angle) * spd
      );
      const col = new THREE.Color(0xffd700).lerp(new THREE.Color(0xffea88), Math.random());
      spawnParticle(emitter, vel, col, Math.random() * 3.5 + 2.0, Math.random() * 1.8 + 1.5, 'gold_sparkle');
    }

    // 10 embers per wick
    for (let i = 0; i < 10; i++) {
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 14,
        Math.random() * 48 + 22,
        (Math.random() - 0.5) * 14
      );
      const col = new THREE.Color(0xff4400).lerp(new THREE.Color(0xffaa22), Math.random());
      spawnParticle(emitter.clone(), vel, col, Math.random() * 2.8 + 1.5, Math.random() * 2.0 + 2.0, 'ember');
    }
  }

  // 6 graceful floating orbs
  spawnFloatingOrbs(6);

  // Text reveal & Department Name sound effect in selected style
  celebratoryReveal.classList.remove('hidden');
  setTimeout(() => celebratoryReveal.classList.add('visible'), 120);
  audioController.playDepartmentRevealSound(selectedSoundStyle);
}

// ─────────────────────────────────────────────
// BOOT
// ─────────────────────────────────────────────
init();
