// ================================================================
// TEMPORARY diagnostics for the iPhone blank-canvas bug.
// Remove this file and its <script> tag once the bug is resolved.
//
// Runs entirely off setInterval so it stays alive and readable even
// if the browser stalls rAF / rendering updates (the main suspect).
// ================================================================

const overlay = document.createElement('div');
overlay.style.cssText = [
  'position:fixed',
  'top:4px',
  'left:4px',
  'z-index:99999',
  'background:rgba(0,0,0,0.75)',
  'color:#4f4',
  'font:11px/1.5 monospace',
  'padding:4px 7px',
  'border-radius:4px',
  'pointer-events:none',
  'white-space:pre',
].join(';');
document.body.appendChild(overlay);

// rAF counter independent of the three.js loop: distinguishes "rAF is
// dead" from "rAF runs but the scene loop bails out".
let rafTicks = 0;
(function tick() {
  rafTicks++;
  requestAnimationFrame(tick);
})();

let lastError = '';
window.addEventListener('error', (e) => {
  lastError = String(e.message || e.error || 'error').slice(0, 70);
});
window.addEventListener('unhandledrejection', (e) => {
  lastError = String(e.reason).slice(0, 70);
});

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const t0 = Date.now();

setInterval(() => {
  const canvas = document.getElementById('scene');
  overlay.textContent =
    `t ${Math.floor((Date.now() - t0) / 1000)}s  raf ${rafTicks}\n` +
    `frames ${window.__mbcFrames || 0}  init ${window.__mbcInit ? 'y' : 'n'}  rm ${reducedMotion ? 'y' : 'n'}\n` +
    `canvas ${canvas ? canvas.width + 'x' + canvas.height : 'REMOVED'}  scrollY ${Math.round(window.scrollY)}` +
    (lastError ? `\nerr ${lastError}` : '');
}, 250);
