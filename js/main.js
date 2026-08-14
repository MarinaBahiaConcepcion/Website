// ================================================================
// Marina Bahía Concepción, sunset over the Sea of Cortés.
// Sky, water, bloom and tone mapping replicate the official
// three.js ocean example (webgl_shaders_ocean, r185) one-to-one,
// with silhouetted Baja ridgelines, mooring buoys and a drifting
// sailboat added on top.
// ================================================================

import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

const canvas = document.getElementById('scene');
const hero = document.getElementById('hero'); // tall scroll region
const stage = document.querySelector('.hero-sticky'); // on-screen viewport
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------- reveal-on-scroll
// Runs regardless of WebGL support.
const revealObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    }
  },
  { threshold: 0.15 }
);
document.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));

// ---------------------------------------------------------------- renderer
let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    outputBufferType: THREE.HalfFloatType,
  });
} catch {
  // No WebGL: the CSS gradient behind the canvas stands in for the scene.
  canvas.remove();
}

if (renderer) {
  init(renderer);
}

function init(renderer) {
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  // WebGL is live: drop the hero's fallback gradient so the fixed canvas
  // behind the page shows through.
  stage.classList.add('has-webgl');
  // The canvas is a fixed viewport backdrop sized by CSS; the third
  // argument keeps setSize from overriding that with inline styles.
  const sceneW = canvas.clientWidth;
  const sceneH = canvas.clientHeight;
  // Cap the pixel ratio at 1.5: the scene renders three full-screen passes
  // per frame (main + mirror + bloom), and above 1.5 the GPU cost starts
  // starving the rest of the page (hover transitions, scrolling).
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(sceneW, sceneH, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.1;

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(sceneW, sceneH),
    1.5,
    0.4,
    0.85
  );
  bloomPass.threshold = 0;
  bloomPass.strength = 0.06;
  bloomPass.radius = 0;
  renderer.setEffects([bloomPass]);

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(52, sceneW / sceneH, 1, 25000);
  // roughly the official example's viewpoint: elevated, looking down
  // at the water so the ripple detail reads
  camera.position.set(0, 45, 120);

  const sun = new THREE.Vector3();

  // ------------------------------------------------------------ water
  const waterGeometry = new THREE.PlaneGeometry(24000, 24000);
  // High-res mirror target: at 512 the ridge reflections pixelate when
  // stretched across the full viewport
  const mirrorRes = isMobile ? 1024 : 2048;
  const water = new Water(waterGeometry, {
    textureWidth: mirrorRes,
    textureHeight: mirrorRes,
    waterNormals: new THREE.TextureLoader().load(
      'https://unpkg.com/cesium@1.79.1/Source/Assets/Textures/waterNormals.jpg',
      (texture) => {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        if (prefersReducedMotion) renderFrame(12, 0);
      }
    ),
    sunDirection: new THREE.Vector3(),
    sunColor: 0xffffff,
    waterColor: 0x001e0f,
    distortionScale: 8,
    fog: scene.fog !== undefined,
  });
  water.rotation.x = -Math.PI / 2;
  water.material.uniforms.size.value = 2.5;
  scene.add(water);

  // ------------------------------------------------------------ skybox
  const sky = new Sky();
  sky.scale.setScalar(20000);
  scene.add(sky);

  const skyUniforms = sky.material.uniforms;
  skyUniforms.turbidity.value = 10;
  skyUniforms.rayleigh.value = 2;
  skyUniforms.mieCoefficient.value = 0.005;
  skyUniforms.mieDirectionalG.value = 0.8;
  skyUniforms.cloudCoverage.value = 0.21;
  skyUniforms.cloudDensity.value = 0.26;
  skyUniforms.cloudElevation.value = 0;

  // Scrolling through the hero animates the sun from afternoon to sunset:
  // it descends (35° to 0°) while arcing from off-frame left to dead center
  // between the ridges, like the real sun tracking west.
  const SUN_START = 65;
  const SUN_END = 0;
  const AZ_START = 250;
  const AZ_END = 210;
  const parameters = {
    elevation: prefersReducedMotion ? SUN_END : SUN_START,
    azimuth: prefersReducedMotion ? AZ_END : AZ_START,
  };
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const sceneEnv = new THREE.Scene();
  let renderTarget;
  let envElevation = Infinity; // elevation last baked into the environment map

  // Rebuilding the PMREM environment is the expensive part, so it only
  // refreshes once the sun has moved enough to matter.
  function updateEnvironment() {
    if (renderTarget !== undefined) renderTarget.dispose();
    sceneEnv.add(sky);
    renderTarget = pmremGenerator.fromScene(sceneEnv);
    scene.add(sky);
    scene.environment = renderTarget.texture;
    envElevation = parameters.elevation;
  }

  function updateSun() {
    const phi = THREE.MathUtils.degToRad(90 - parameters.elevation);
    const theta = THREE.MathUtils.degToRad(parameters.azimuth);
    sun.setFromSphericalCoords(1, phi, theta);

    sky.material.uniforms.sunPosition.value.copy(sun);
    water.material.uniforms.sunDirection.value.copy(sun).normalize();

    if (Math.abs(parameters.elevation - envElevation) > 1) updateEnvironment();
  }
  updateSun();

  // 0 at the top of the page, 1 when the hero has been scrolled through.
  // The hero sits at the top of the document, so window.scrollY tracks it
  // without the forced layout a per-frame getBoundingClientRect would cost.
  let heroHeight = hero.offsetHeight;
  let scrollRange = heroHeight - stage.offsetHeight;
  function scrollProgress() {
    if (scrollRange <= 0) return 1;
    return THREE.MathUtils.clamp(window.scrollY / scrollRange, 0, 1);
  }

  // ------------------------------------------------------------ ridgelines
  // Jagged 2D silhouettes standing at the horizon, layered for depth,
  // evoking the Concepción peninsula and the Sierra behind the bay.
  function makeRidge({ seed, width, maxHeight, color }) {
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2, -300);
    const n = 110;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = (t - 0.5) * width;
      const envelope = Math.pow(Math.sin(t * Math.PI), 0.55);
      const jag =
        0.5 +
        0.28 * Math.sin(t * 9.2 + seed) +
        0.16 * Math.sin(t * 21.7 + seed * 2.3) +
        0.06 * Math.sin(t * 47.3 + seed * 4.1);
      shape.lineTo(x, maxHeight * envelope * jag);
    }
    shape.lineTo(width / 2, -300);
    shape.closePath();

    const mesh = new THREE.Mesh(
      new THREE.ShapeGeometry(shape),
      new THREE.MeshBasicMaterial({ color })
    );
    return mesh;
  }

  // Far layer: hazy, almost dissolving into the sky.
  const ridgeFarL = makeRidge({ seed: 3.7, width: 9000, maxHeight: 300, color: 0x6a5a72 });
  ridgeFarL.position.set(-5200, 0, -9500);
  const ridgeFarR = makeRidge({ seed: 8.1, width: 8000, maxHeight: 340, color: 0x6a5a72 });
  ridgeFarR.position.set(5400, 0, -9500);
  scene.add(ridgeFarL, ridgeFarR);

  // Near layer: darker, framing the open water where the sun sets.
  const ridgeNearL = makeRidge({ seed: 12.9, width: 7000, maxHeight: 420, color: 0x3c3048 });
  ridgeNearL.position.set(-5600, 0, -7200);
  const ridgeNearR = makeRidge({ seed: 6.4, width: 6200, maxHeight: 380, color: 0x3c3048 });
  ridgeNearR.position.set(5600, 0, -7200);
  scene.add(ridgeNearL, ridgeNearR);

  // ------------------------------------------------------------ sailboat silhouette
  const boat = new THREE.Group();
  {
    const dark = new THREE.MeshBasicMaterial({ color: 0x241e32 });

    const hullShape = new THREE.Shape();
    hullShape.moveTo(-16, 0);
    hullShape.quadraticCurveTo(0, -7, 16, 0);
    hullShape.lineTo(14, 3);
    hullShape.lineTo(-14, 3);
    hullShape.closePath();
    boat.add(new THREE.Mesh(new THREE.ShapeGeometry(hullShape), dark));

    const mainSail = new THREE.Shape();
    mainSail.moveTo(1, 4);
    mainSail.lineTo(1, 34);
    mainSail.quadraticCurveTo(12, 16, 13, 4);
    mainSail.closePath();
    boat.add(new THREE.Mesh(new THREE.ShapeGeometry(mainSail), dark));

    const jib = new THREE.Shape();
    jib.moveTo(-1.5, 4);
    jib.lineTo(-1.5, 30);
    jib.quadraticCurveTo(-9, 14, -12, 4);
    jib.closePath();
    boat.add(new THREE.Mesh(new THREE.ShapeGeometry(jib), dark));
  }
  boat.position.set(-700, 0, -2600);
  boat.scale.setScalar(3.4);
  scene.add(boat);

  // ------------------------------------------------------------ mooring buoys
  const buoys = [];
  {
    const bodyGeo = new THREE.SphereGeometry(2.1, 20, 16);
    const capGeo = new THREE.CylinderGeometry(0.28, 0.42, 2.8, 10);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.55, metalness: 0.05 });
    const capMat = new THREE.MeshStandardMaterial({ color: 0x8a3030, roughness: 0.6, metalness: 0.1 });

    const spots = [
      [-52, -110], [38, -160], [-20, -250], [72, -320],
    ];
    for (const [x, z] of spots) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.scale.y = 0.85;
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.y = 2.4;
      g.add(body, cap);
      g.position.set(x, 0.4, z);
      g.userData.phase = Math.random() * Math.PI * 2;
      scene.add(g);
      buoys.push(g);
    }
  }

  // ------------------------------------------------------------ pointer parallax
  const pointer = { x: 0, y: 0 };
  if (!prefersReducedMotion) {
    window.addEventListener(
      'pointermove',
      (e) => {
        pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
        pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
      },
      { passive: true }
    );
  }

  // ------------------------------------------------------------ resize
  window.addEventListener('resize', () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    heroHeight = hero.offsetHeight;
    scrollRange = heroHeight - stage.offsetHeight;
    if (prefersReducedMotion) renderFrame(12, 0);
  });

  // ------------------------------------------------------------ animation
  const timer = new THREE.Timer();
  const lookTarget = new THREE.Vector3(0, -950, -6000);

  // The hero sits at the top of the document, so it is on screen exactly
  // while scrollY is above its bottom edge. Computed from scroll position
  // rather than an IntersectionObserver: Safari can deliver a wrong initial
  // observation during page load (WebKit bug 197891) and sends no correction
  // until the next scroll, which left the canvas unpainted behind the
  // fallback gradient on mobile until the user scrolled.
  function heroOnScreen() {
    return window.scrollY < heroHeight;
  }

  function renderFrame(time, delta) {
    water.material.uniforms.time.value += delta;
    sky.material.uniforms.time.value = time;

    for (const buoy of buoys) {
      const p = buoy.userData.phase;
      buoy.position.y = 0.4 + Math.sin(time * 1.4 + p) * 0.45;
      buoy.rotation.z = Math.sin(time * 1.1 + p) * 0.09;
      buoy.rotation.x = Math.cos(time * 0.9 + p) * 0.07;
    }

    boat.position.x = -700 + ((time * 9) % 2400);
    boat.position.y = Math.sin(time * 0.7) * 1.6;
    boat.rotation.z = Math.sin(time * 0.55) * 0.02;

    camera.position.x += (pointer.x * 7 - camera.position.x) * 0.03;
    camera.position.y += (45 + pointer.y * -4 - camera.position.y) * 0.03;
    camera.lookAt(lookTarget);

    renderer.render(scene, camera);
    window.__mbcFrames = (window.__mbcFrames || 0) + 1;
  }

  let elapsed = 0;
  function animationLoop() {
    timer.update();
    if (!heroOnScreen() || document.hidden) return;

    // Clamp so the first frame after a paused tab doesn't jump the scene.
    const delta = Math.min(timer.getDelta(), 0.1);
    elapsed += delta;

    // ease the sun toward the scroll-driven position
    const targetElevation = SUN_START + (SUN_END - SUN_START) * scrollProgress();
    const eased = THREE.MathUtils.lerp(
      parameters.elevation,
      targetElevation,
      Math.min(1, delta * 5)
    );
    if (Math.abs(eased - parameters.elevation) > 0.001) {
      parameters.elevation = eased;
      // azimuth tracks elevation so both land together at sunset
      const frac = (eased - SUN_END) / (SUN_START - SUN_END);
      parameters.azimuth = AZ_END + (AZ_START - AZ_END) * frac;
      updateSun();
    }

    renderFrame(elapsed, delta);
  }

  if (prefersReducedMotion) {
    renderFrame(12, 0);
  } else {
    // Paint immediately: if the very first animation frame is delayed or
    // skipped (mobile browsers throttle rAF during load), the canvas would
    // otherwise sit transparent over the fallback gradient.
    renderFrame(0, 0);
    renderer.setAnimationLoop(animationLoop);
  }

  // ------------------------------------------------------------ watchdog
  // iOS Safari can leave the page's rendering pipeline idle after load:
  // with every hero animation running on the compositor thread, nothing
  // schedules main-thread rendering updates, so rAF callbacks (and the
  // loop above) may never run and the canvas stays blank until the first
  // style change on the page (the Vision section's reveal, two viewports
  // down). Timers keep firing in that state, so nudge from one until
  // frames demonstrably advance: repaint, re-arm the loop, and mutate a
  // style to force WebKit to schedule a real rendering update.
  let watchdogFrames = -1;
  let nudges = 0;
  const watchdog = setInterval(() => {
    if (prefersReducedMotion) {
      nudges++;
      renderFrame(12, 0);
      canvas.style.opacity = nudges % 2 ? '0.999' : '';
      if (nudges >= 6) {
        clearInterval(watchdog);
        canvas.style.opacity = '';
      }
      return;
    }

    const frames = window.__mbcFrames || 0;
    if (frames > watchdogFrames + 2) {
      // the loop is ticking on its own; stand down
      clearInterval(watchdog);
      canvas.style.opacity = '';
      return;
    }
    watchdogFrames = frames;
    nudges++;
    renderer.setAnimationLoop(null);
    renderer.setAnimationLoop(animationLoop);
    renderFrame(0, 0);
    canvas.style.opacity = nudges % 2 ? '0.999' : '';
    if (nudges >= 20) clearInterval(watchdog);
  }, 500);

  window.__mbcInit = true;
}
