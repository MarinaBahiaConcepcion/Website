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
const sceneRoot = document.getElementById('scene-root');
const hero = document.getElementById('hero'); // tall scroll region
const chrome = document.querySelector('.hero-chrome');
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// #scene-root is position:fixed and sized in CSS (100lvh). Nothing here
// repositions it on scroll: an absolutely-positioned box chasing
// window.scrollY from a scroll handler can never stay in sync with the
// iOS compositor during momentum scrolling, which is what made the
// scene visibly lag and stutter. The compositor owns it now.
function sceneSize() {
  const w = sceneRoot.clientWidth || window.innerWidth;
  const h = sceneRoot.clientHeight || window.innerHeight;
  return { w: Math.max(1, Math.round(w)), h: Math.max(1, Math.round(h)) };
}

{
  const boot = sceneSize();
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  canvas.width = Math.max(1, Math.floor(boot.w * dpr));
  canvas.height = Math.max(1, Math.floor(boot.h * dpr));
}

// Hide the fixed chrome once the first content section reaches the top,
// so it doesn't keep intercepting taps / focus under the opaque page.
// hideAt is cached: reading hero.offsetHeight inside a scroll handler
// forces a synchronous layout on every single scroll event.
let chromeHideAt = 0;
function measureChrome() {
  chromeHideAt = hero.offsetHeight - window.innerHeight;
}
function updateChromeVisibility() {
  chrome.classList.toggle('is-away', window.scrollY >= chromeHideAt);
}
window.addEventListener('scroll', updateChromeVisibility, { passive: true });
window.addEventListener('resize', () => {
  measureChrome();
  updateChromeVisibility();
});
measureChrome();
updateChromeVisibility();

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
const isPhone = window.matchMedia('(max-width: 768px)').matches;

// Optional on-screen readout: append #debug to the URL.
const DEBUG = location.hash.includes('debug');

let renderer;
try {
  const opts = {
    canvas,
    // MSAA is a meaningful cost on a phone GPU for a scene that is
    // mostly water and soft silhouettes, where it buys very little.
    antialias: !isPhone,
    alpha: false,
    // preserveDrawingBuffer forces the driver to copy the framebuffer
    // every frame. It was masking the compositing bug, not fixing it.
    preserveDrawingBuffer: false,
  };
  // A half-float output buffer means three.js renders offscreen and
  // blits to the canvas rather than drawing to the default framebuffer.
  // On iOS that indirect present is the likeliest reason the first frame
  // never reaches the screen until some other event flushes the layer.
  // Phones draw direct; desktop keeps the wider colour precision.
  if (!isPhone) opts.outputBufferType = THREE.HalfFloatType;
  renderer = new THREE.WebGLRenderer(opts);
} catch {
  // No WebGL: #scene-fallback stays in place as the sunset stand-in.
  canvas.remove();
}

if (renderer) {
  init(renderer);
}

// ---------------------------------------------------------------- look
// Tunable from the URL while dialling it in on a phone, e.g.
//   .../#debug&exposure=0.7&sun=30
const LOOK = {
  exposure: Number(new URLSearchParams(location.hash.slice(1)).get('exposure')) || 0.5,
  sunStart: Number(new URLSearchParams(location.hash.slice(1)).get('sun')) || 22,
};

function init(renderer) {
  const isMobile = isPhone;
  // Marker class for styling hooks; the fallback is removed in JS, not CSS.
  document.documentElement.classList.add('has-webgl');
  // Size from #scene-root, which is laid out by CSS and always reports
  // a real height, rather than from the canvas itself.
  const { w: sceneW, h: sceneH } = sceneSize();
  // Cap the pixel ratio: the scene renders three full-screen passes per
  // frame (main + mirror + bloom). 1.5 already starves the rest of the
  // page on desktop; on a 3x iPhone panel it is the single biggest
  // reason scrolling stutters, so phones get 1.25.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.25 : 1.5));
  renderer.setSize(sceneW, sceneH, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  // 0.5 is the value the three.js ocean example uses with these exact
  // sky settings. At 0.1 the scene renders correctly but is so dark it
  // reads as an empty black box until the sun nears the horizon.
  renderer.toneMappingExposure = LOOK.exposure;

  // Bloom at strength 0.06 / radius 0 is very close to a no-op visually,
  // but any effect chain forces the whole scene through an offscreen
  // target that is then blitted out. On mobile that trade is bad twice
  // over: a wasted full-screen pass, and the indirect present path that
  // iOS does not reliably flush on first paint. Desktop keeps it.
  if (!isMobile) {
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
  }

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
  // The mirror is a second full render of the scene every frame. At 1024
  // on a phone that alone can halve the frame rate; 512 is plenty when
  // the reflection is squeezed into a narrow portrait viewport.
  const mirrorRes = isMobile ? 512 : 2048;
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
  // 65 degrees is almost directly overhead and sits outside the camera
  // frustum, so the top of the page had no visible sun at all. A low
  // afternoon sun is in frame and warm from the first pixel.
  const SUN_START = LOOK.sunStart;
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
  let scrollRange = heroHeight - window.innerHeight;
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

  // ------------------------------------------------------------ resize / pin
  let lastW = sceneW;
  let lastH = sceneH;

  function syncRendererSize() {
    const { w, h } = sceneSize();
    heroHeight = hero.offsetHeight;
    scrollRange = Math.max(1, heroHeight - window.innerHeight);
    measureChrome();
    if (w === lastW && h === lastH) return;
    lastW = w;
    lastH = h;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    if (prefersReducedMotion) renderFrame(12, 0);
  }

  // No scroll listeners here at all. On iOS the URL bar collapsing fires
  // visualViewport resize repeatedly mid-scroll, so that is debounced to
  // a single settled measurement rather than resizing render targets
  // (and reallocating the bloom + mirror buffers) during the gesture.
  let resizeTimer;
  function scheduleResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(syncRendererSize, 150);
  }

  window.addEventListener('resize', scheduleResize);
  window.addEventListener('orientationchange', scheduleResize);
  if (window.visualViewport) {
    visualViewport.addEventListener('resize', scheduleResize);
  }

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
    if (heroHeight <= 0) return true;
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

  // The fallback gradient is removed only once a real frame has been
  // drawn, so there is never a moment showing an empty canvas — and
  // because it is a DOM removal behind the canvas rather than a
  // background swap on a composited overlay, iOS has nothing stale
  // left to composite on top of the scene.
  let fallbackCleared = false;
  function clearFallback() {
    if (fallbackCleared) return;
    fallbackCleared = true;
    document.getElementById('scene-fallback')?.remove();
  }

  // iOS can build the canvas's compositing layer and then never present
  // its first frame, which is what a scroll was accidentally fixing.
  // Mutating a compositing-relevant property forces WebKit to rebuild
  // and flush the layer without moving anything on screen.
  let nudges = 0;
  function nudgeCompositor() {
    if (nudges++ > 4) return;
    sceneRoot.style.transform = 'translateZ(0) scale(1.0002)';
    requestAnimationFrame(() => {
      sceneRoot.style.transform = 'translateZ(0)';
    });
  }

  function present() {
    syncRendererSize();
    renderFrame(prefersReducedMotion ? 12 : elapsed, 0);
    const gl = renderer.getContext();
    if (gl.flush) gl.flush();
    clearFallback();
    nudgeCompositor();
  }

  if (prefersReducedMotion) {
    present();
  } else {
    present();
    renderer.setAnimationLoop(animationLoop);
  }

  // Re-present after layout / pageshow. iOS often creates the GL
  // context before the visual viewport has its final size.
  requestAnimationFrame(() => requestAnimationFrame(present));
  window.addEventListener('pageshow', present);
  setTimeout(present, 100);
  setTimeout(present, 400);

  window.__mbcInit = true;

  // ------------------------------------------------------------ #debug
  if (DEBUG) {
    const box = document.createElement('div');
    box.style.cssText =
      'position:fixed;top:4px;left:4px;z-index:99999999;background:rgba(0,0,0,.75);' +
      'color:#4f4;font:11px/1.45 monospace;padding:4px 7px;border-radius:4px;' +
      'pointer-events:none;white-space:pre';
    document.body.appendChild(box);
    setInterval(() => {
      const gl = renderer.getContext();
      box.textContent =
        `frames ${window.__mbcFrames || 0}  scrollY ${Math.round(window.scrollY)}\n` +
        `canvas ${canvas.width}x${canvas.height}  css ${canvas.clientWidth}x${canvas.clientHeight}\n` +
        `effects ${isMobile ? 'off' : 'bloom'}  ctxlost ${gl.isContextLost() ? 'YES' : 'no'}\n` +
        `fallback ${document.getElementById('scene-fallback') ? 'present' : 'removed'}\n` +
        `exposure ${LOOK.exposure}  sun ${parameters.elevation.toFixed(1)}deg`;
    }, 250);
  }
}