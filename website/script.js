/* ---------- always start the intro from the top of the page ----------
   the .pin section is position:sticky, so a browser-restored mid-scroll
   position on reload leaves it already "scrolled" before any of the intro
   timeline runs, skipping the turtle draw-in. Re-assert top-of-page here
   (in addition to the head-script's early call) and again once everything
   has settled, since some browsers (Safari in particular) re-apply their
   own scroll restoration after `load`/`pageshow`. */
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);
window.addEventListener('load', () => window.scrollTo(0, 0));
window.addEventListener('pageshow', () => window.scrollTo(0, 0));

/* ---------- your real logo, verbatim ---------- */
const RAW_SVG = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="700" height="700" viewBox="1162 509 700 700"><defs><linearGradient x1="1305.68524" y1="876.98193" x2="1487.71226" y2="776.75546" gradientUnits="userSpaceOnUse" id="color-1"><stop offset="0" stop-color="#2a3b53"/><stop offset="1" stop-color="#886d52"/></linearGradient><linearGradient x1="1489.88609" y1="827.15719" x2="1667.9961" y2="788.65854" gradientUnits="userSpaceOnUse" id="color-2"><stop offset="0" stop-color="#b07f50"/><stop offset="1" stop-color="#eb9c4f"/></linearGradient><linearGradient x1="1552.70801" y1="896.50196" x2="1708.7998" y2="933.1836" gradientUnits="userSpaceOnUse" id="color-3"><stop offset="0" stop-color="#af7f51"/><stop offset="1" stop-color="#e89a4f"/></linearGradient><linearGradient x1="1384.74425" y1="947.39551" x2="1539.09765" y2="907.313" gradientUnits="userSpaceOnUse" id="color-4"><stop offset="0" stop-color="#2d3d54"/><stop offset="1" stop-color="#927254"/></linearGradient></defs><g id="document" fill="#ffffff" fill-rule="nonzero" font-family="none" font-weight="none" font-size="none"><rect x="1162" y="363.57143" transform="scale(1,1.4)" width="700" height="500" id="Shape-1-1"/></g><g fill="none" fill-rule="nonzero" stroke="none" stroke-width="1" stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="10" font-family="none" font-weight="none" font-size="none"><g><g id="stage"><g id="layer1-1"><g id="Group-1"><g id="Group-1-1"><g id="Group-1-2"><path d="M1162,509h700v700h-700z" id="Path-1" fill="#232628"/><path d="M1494.26552,738.46329c4.59237,-2.89023 9.4934,-4.79337 14.56943,-6.62711c19.70117,-7.11895 39.76464,-8.46802 60.27588,-3.84008c48.22412,10.88043 81.20068,52.44566 103.09962,94.13017c5.91649,11.25707 10.90332,22.17031 7.92286,35.15108c-4.31006,19.21241 -22.65772,25.28612 -39.42969,29.74316c-32.03321,8.51417 -65.19091,8.84571 -97.76417,3.5752c-5.97462,-0.96388 -12.96778,-1.95167 -18.80909,-3.35302c-2.0542,-0.12304 -9.28662,-2.10546 -11.60059,-2.71728c-23.47529,-6.22071 -46.388,-14.50927 -68.39765,-24.78028c-6.51329,-3.03858 -12.51796,-7.87841 -19.19531,-10.59774c-1.62421,0.38145 -3.31168,3.15 -4.26153,4.56846c-11.34527,16.95654 -28.30112,31.5581 -47.93906,37.73439c-11.58759,3.73926 -23.18955,3.67089 -35.09877,3.24023c-15.75992,-0.57421 -29.50801,-5.80029 -34.12535,-22.25781c-3.65825,-13.03955 -0.12544,-28.03451 6.12432,-39.79064c7.12579,-13.40458 20.5348,-23.98321 35.18149,-27.91388c21.28677,-5.88096 41.95865,1.16177 60.40883,11.80839c4.213,2.43119 7.71059,5.19428 12.04492,7.66138c1.62421,-1.87031 7.72154,-12.75141 9.54399,-15.7353c7.33565,-12.00971 19.55795,-31.00167 29.67652,-40.49439c6.83867,-8.61191 27.68451,-25.42626 37.77333,-29.50493z" id="Path-1-1" fill="#232628"/><path d="M1456.49219,767.96822l0.53559,0.12339c2.52726,-2.15434 11.75575,-12.08457 13.57036,-12.83721l0.37564,0.21432c3.50308,1.96397 6.63495,1.85255 7.96693,6.15748c0.73794,2.38539 0.3189,4.60059 1.90108,6.55464c1.57638,1.94654 -1.95851,2.22339 -2.53374,4.61461l-0.20337,0.2331c-4.49566,5.08286 -10.95323,10.48735 -15.29096,15.98175c-2.88272,3.65108 -8.34941,10.81479 -10.75601,14.50792c-2.34439,3.59844 -18.07626,28.50038 -18.20341,30.59903c-1.07186,2.32799 -8.82896,14.55748 -8.91749,15.03017c-1.62421,0.38145 -3.31168,3.15 -4.26153,4.56846c-11.34527,16.95654 -28.30112,31.5581 -47.93906,37.73439c-11.58759,3.73926 -23.18955,3.67089 -35.09877,3.24023c-15.75992,-0.57421 -29.50801,-5.80029 -34.12535,-22.25781c-3.65825,-13.03955 -0.12544,-28.03451 6.12432,-39.79064c7.12579,-13.40458 20.5348,-23.98321 35.18149,-27.91388c21.28677,-5.88096 41.95865,1.16177 60.40883,11.80839c4.213,2.43119 7.71059,5.19428 12.04492,7.66138c1.62421,-1.87031 7.72154,-12.75141 9.54399,-15.7353c7.33565,-12.00971 19.55795,-31.00167 29.67652,-40.49439z" id="Path-1-2" fill="url(#color-1)"/><path d="M1357.08022,821.52436c12.92779,-2.77744 39.51787,11.01508 51.00053,17.58031c-0.85346,2.02309 -4.41329,6.62711 -5.81772,8.4311c-9.10821,11.70006 -19.16388,20.38853 -33.39219,25.30015c-2.25449,0.65284 -7.67198,2.21825 -10.06318,2.48486c-8.01855,0.95361 -27.64965,2.26611 -34.0652,-2.90869c-8.8792,-7.16065 -1.21851,-29.29985 5.04765,-36.43145c8.40957,-9.57066 15.31626,-12.91822 27.29008,-14.45631z" id="Path-1-3" fill="#232628"/><path d="M1494.26552,738.46329c4.59237,-2.89023 9.4934,-4.79337 14.56943,-6.62711c19.70117,-7.11895 39.76464,-8.46802 60.27588,-3.84008c48.22412,10.88043 81.20068,52.44566 103.09962,94.13017c5.91649,11.25707 10.90332,22.17031 7.92286,35.15108c-4.31006,19.21241 -22.65772,25.28612 -39.42969,29.74316c-32.03321,8.51417 -65.19091,8.84571 -97.76417,3.5752c-5.97462,-0.96388 -12.96778,-1.95167 -18.80909,-3.35302c2.91552,-0.73145 21.32471,4.43653 21.76221,2.56347c0.78955,-3.38037 -0.53321,-10.85546 -2.1294,-14.27685c-2.2627,-4.85693 -6.5044,-4.47071 -11.0537,-5.37987c-4.85693,-1.03906 -10.42823,-1.76708 -15.16212,-3.37013l0.04786,-0.36573c43.42189,10.59912 90.52832,13.26855 133.19824,-2.53612c12.28418,-4.8877 13.76074,-13.63325 8.71925,-24.53043c-26.22949,-56.70821 -79.90528,-115.80214 -148.76367,-87.86573c-3.94434,1.59994 -7.7417,4.09234 -11.70211,5.84337c-3.14146,2.26508 -6.55772,4.21402 -9.72958,6.52559c-3.87735,2.82529 -7.37597,5.8191 -11.00927,8.94516c0.57524,-2.3912 4.1101,-2.66807 2.53374,-4.61461c-1.58219,-1.95405 -1.16314,-4.16925 -1.90108,-6.55464c-1.33198,-4.30493 -4.46388,-4.19351 -7.96693,-6.15748l-0.37564,-0.21432c-1.81461,0.75264 -11.04311,10.68286 -13.57036,12.83721l-0.53559,-0.12339c6.83867,-8.61191 27.68451,-25.42626 37.77333,-29.50493z" id="Path-1-4" fill="url(#color-2)"/><path d="M1456.49219,767.96822c6.83867,-8.61191 27.68451,-25.42626 37.77333,-29.50493c-1.79956,2.32899 -19.38193,11.69457 -20.2436,14.28574c1.87066,1.17133 3.42274,1.70966 5.34571,2.65986c2.18031,5.42022 1.94789,6.95182 3.13222,12.37374l-0.01573,0.02632c2.32388,-0.67265 10.55742,-8.92876 16.56279,-10.48427c-3.14146,2.26508 -6.55772,4.21402 -9.72958,6.52559c-3.87735,2.82529 -7.37597,5.8191 -11.00927,8.94516c0.57524,-2.3912 4.1101,-2.66807 2.53374,-4.61461c-1.58219,-1.95405 -1.16314,-4.16925 -1.90108,-6.55464c-1.33198,-4.30493 -4.46388,-4.19351 -7.96693,-6.15748l-0.37564,-0.21432c-1.81461,0.75264 -11.04311,10.68286 -13.57036,12.83721z" id="Path-1-5" fill="#83674e"/><path d="M1433.85429,834.11719c3.68389,1.17714 6.73272,3.4976 10.06455,4.91059c12.14712,5.15191 23.4647,11.03935 35.94677,15.53228c6.99111,2.51564 13.60249,4.8877 20.72588,7.03759c3.60185,1.08351 14.2044,3.48633 17.0037,4.81591l-0.04786,0.36573c4.73389,1.60302 10.30517,2.33105 15.16212,3.37013c4.54932,0.90918 8.79102,0.52295 11.0537,5.37987c1.59619,3.42139 2.91895,10.89648 2.1294,14.27685c-0.4375,1.87304 -18.84668,-3.29492 -21.76221,-2.56347c-2.0542,-0.12304 -9.28662,-2.10546 -11.60059,-2.71728c-23.47529,-6.22071 -46.388,-14.50927 -68.39765,-24.78028c-6.51329,-3.03858 -12.51796,-7.87841 -19.19531,-10.59774c0.08853,-0.47271 7.8456,-12.7022 8.91749,-15.03017z" id="Path-1-6" fill="#83674e"/><path d="M1554.7998,929.39648c7.92626,-0.97412 15.0083,-1.89014 22.71241,-4.19384c7.29736,-2.18409 14.25634,-5.19531 21.76564,-6.21728c21.84425,-2.98046 37.97362,15.55517 45.30517,34.05663c2.12597,5.36279 2.65918,13.15235 6.79492,17.43506c5.10645,4.40235 18.72705,3.21972 25.29296,3.06591c1.62696,-0.03759 3.42139,-0.71778 4.2998,-2.04052c2.8745,-4.33057 -0.3042,-21.27685 -1.35009,-26.37987c-1.33301,-6.34034 -3.21288,-12.55079 -5.62256,-18.563c-3.75977,-9.40284 -12.08935,-20.43603 -5.01417,-30.60792c7.45458,-10.01464 21.76221,-10.62647 29.95167,-20.4292c3.62647,-4.34425 6.45314,-11.72705 12.24659,-12.22608c13.02929,-1.1245 12.34228,11.60059 6.30273,19.14064c-8.65772,10.80763 -19.4995,19.15088 -32.37841,23.40625c3.37013,6.97265 6.28222,12.83788 8.83204,20.27881c4.50487,13.12841 9.89161,37.57714 5.33204,50.53125c-2.04395,5.89941 -6.41212,10.70167 -12.09278,13.28906c-8.94483,4.16649 -30.18409,3.41455 -39.11866,0.28369c-13.57274,-4.76124 -17.81446,-17.59228 -21.10596,-30.05763c-2.08154,-7.875 -10.57861,-18.7373 -18.28272,-21.89551c-7.01024,-2.72071 -20.64454,3.77001 -28.40675,5.8755c-5.22949,1.36719 -10.53759,2.40284 -15.89698,3.10009c-6.91455,1.11426 -24.39061,1.29199 -31.28809,0.20167c1.96534,-0.78955 3.84179,0.15381 6.29932,-0.17773c1.78075,-1.99267 8.70214,-8.60986 6.85645,-11.80226c-0.87841,-1.52441 -5.3833,-3.58888 -6.63087,-5.32861c-0.1162,-0.16406 -3.14454,-0.31103 -3.77001,-0.44774l0.35889,-0.38624c6.50097,0.21534 12.12353,0.19483 18.60742,0.08888z" id="Path-1-7" fill="url(#color-3)"/><path d="M1536.19237,929.30763c6.50097,0.21534 12.12353,0.19483 18.60742,0.08888c-3.78028,1.89698 -7.38281,0.00341 -9.80273,1.02881c0.03075,2.68994 4.69287,2.09522 4.76807,6.81543c0.06837,4.15966 -5.64991,7.54346 -4.26221,9.64208c4.39208,1.74316 15.77392,-0.6255 18.86376,0.36573c-6.91455,1.11426 -24.39061,1.29199 -31.28809,0.20167c1.96534,-0.78955 3.84179,0.15381 6.29932,-0.17773c1.78075,-1.99267 8.70214,-8.60986 6.85645,-11.80226c-0.87841,-1.52441 -5.3833,-3.58888 -6.63087,-5.32861c-0.1162,-0.16406 -3.14454,-0.31103 -3.77001,-0.44774z" id="Path-1-8" fill="#83674e"/><path d="M1533.07861,947.4502c-1.28858,0.09571 -6.02929,-0.48193 -7.43066,-0.67676c-6.64795,-0.92969 -13.21045,-2.38917 -19.62597,-4.36476c-5.08184,-1.57568 -10.16881,-3.33251 -15.29404,-4.58351c-12.6875,-3.09668 -22.68539,12.07568 -26.53506,22.08351c-2.02344,5.26024 -2.92374,11.24513 -5.75587,16.60108c-2.23568,4.29639 -5.51796,7.96045 -9.54331,10.65038c-8.66899,5.77978 -18.0127,5.84472 -27.92139,5.46875c-10.88624,-0.41358 -20.03339,-1.30566 -26.44619,-11.21778c-7.26112,-11.22462 -3.97885,-29.2373 -1.21781,-41.51124c4.26186,-18.6211 12.59487,-36.0664 24.4002,-51.08495c3.89956,-4.98339 9.38574,-12.7627 16.69645,-10.84522c4.93554,1.25781 7.8162,8.00147 5.51763,12.46534c-2.07538,4.02978 -5.81943,7.65284 -8.64575,11.25196c-7.65966,9.83008 -13.4726,20.96925 -17.15684,32.87403c-2.19469,7.23926 -7.39786,28.46825 -4.31039,35.96728c0.4939,1.19971 2.83248,2.80616 4.37568,2.96679c6.60763,0.66992 14.08477,0.65625 20.6941,-0.09228c7.85381,-0.88524 8.57535,-11.54932 10.81206,-17.63671c4.79815,-13.05663 11.7537,-23.72755 23.44111,-31.39745c16.38061,-10.7461 30.54707,-3.40088 47.14677,1.46288c6.75733,1.9414 13.89404,2.09179 19.91309,3.47608l-0.35889,0.38624c0.6255,0.13671 3.65381,0.28369 3.77001,0.44774c1.24756,1.73976 5.75244,3.8042 6.63087,5.32861c1.84571,3.19237 -5.07568,9.80957 -6.85645,11.80226c-2.45751,0.33154 -4.33398,-0.61182 -6.29932,0.17773z" id="Path-1-9" fill="url(#color-4)"/></g></g></g></g></g></g></g></svg>`;

/* solid-color approximations for the gradient-filled shapes, used only in the 3D model */
const COLOR_MAP = {
  'Path-1-2': 0x595453,
  'Path-1-4': 0xCD8D50,
  'Path-1-5': 0x83674E,
  'Path-1-6': 0x83674E,
  'Path-1-7': 0xCB8C50,
  'Path-1-8': 0x83674E,
  'Path-1-9': 0x5F5754
};
const TURTLE_IDS = ['Path-1-1','Path-1-2','Path-1-3','Path-1-4','Path-1-5','Path-1-6','Path-1-7','Path-1-8','Path-1-9'];

/* ---------- inject the real filled artwork ---------- */
const filledContainer = document.getElementById('filled-container');
filledContainer.innerHTML = RAW_SVG;
const filledSvgEl = filledContainer.querySelector('svg');

/* strip the export tool's background rects — only the turtle silhouette should render */
filledSvgEl.querySelector('#document')?.remove();
filledSvgEl.querySelector('#Path-1')?.remove();

/* ---------- build the outline-sketch copy from the same paths ---------- */
const outlineSvg = document.getElementById('outline-svg');
const turtlePaths = TURTLE_IDS
  .map(id => filledSvgEl.querySelector('#' + id))
  .filter(Boolean);

turtlePaths.forEach((srcPath, i) => {
  const clone = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  clone.setAttribute('d', srcPath.getAttribute('d'));
  outlineSvg.appendChild(clone);
  const len = clone.getTotalLength();
  clone.style.strokeDasharray = len;
  clone.style.strokeDashoffset = len;
  clone.style.transition = 'none';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      clone.style.transition = `stroke-dashoffset 1.5s cubic-bezier(.65,0,.35,1) ${i * 0.09}s`;
      clone.style.strokeDashoffset = '0';
    });
  });
});

const drawDuration = 1500 + (turtlePaths.length - 1) * 90 + 300;

const stage = document.getElementById('intro-stage');
const webglAlign = document.getElementById('webgl-align');
const webglWrap = document.getElementById('webgl-wrap');
const heroCopy = document.querySelector('.hero-copy');
const logoFrame = document.querySelector('.logo-frame');

/* crossfade timeline: outline -> flat color fill -> (pause to let it register) -> 3D grows out of it */
const filledShowAt = drawDuration;
const modelCrossfadeAt = drawDuration + 650;
const modelCrossfadeDuration = 1300;

setTimeout(() => {
  outlineSvg.classList.add('fade');
  filledContainer.classList.add('show');
}, filledShowAt);

setTimeout(() => {
  stage.classList.add('hide');
  webglWrap.classList.add('show');
}, modelCrossfadeAt);

/* the glass hero card waits until the 3D turtle has fully settled behind it (opacity/blur/scale done
   resolving) — showing it earlier means the backdrop it's blurring is still changing under it, which
   reads as the glass drifting from clear to "matte" mid-appearance */
const heroGlass = document.querySelector('.hero-glass');
const heroCopyShowAt = modelCrossfadeAt + modelCrossfadeDuration + 200;

/* intro lock: nothing but the pinned logo is visible/scrollable until the 3D hand-off is done —
   release it here, in step with the rest of the page appearing */
setTimeout(() => {
  document.documentElement.classList.remove('intro-lock');
}, heroCopyShowAt);

setTimeout(() => {
  heroCopy.classList.add('show');
}, heroCopyShowAt);

/* card appears crisp/transparent first, then the blur ramps in a beat later. Driven frame-by-frame in JS
   rather than a CSS transition on backdrop-filter, since browsers don't reliably interpolate that property
   smoothly — some just snap straight to the end value, which is what read as "abrupt". */
function animateBlur(el, fromPx, toPx, duration) {
  const start = performance.now();
  function step(now) {
    const t = Math.min((now - start) / duration, 1);
    const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const px = fromPx + (toPx - fromPx) * eased;
    el.style.backdropFilter = `blur(${px}px)`;
    el.style.webkitBackdropFilter = `blur(${px}px)`;
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

setTimeout(() => {
  heroGlass.classList.add('blur-in');
  animateBlur(heroGlass, 0, 10, 1600);
}, heroCopyShowAt + 450);

/* ---------- shared shape vocabulary, reused by the FAQ flow and the button/card icons ---------- */
const SHAPE_GEOMETRY = {
  cuboid: () => new THREE.BoxGeometry(1.15, 1.3, 1.15),
  sphere: () => new THREE.SphereGeometry(0.78, 28, 20),
  cylinder: () => new THREE.CylinderGeometry(0.62, 0.62, 1.3, 28),
  cone: () => new THREE.ConeGeometry(0.78, 1.35, 28),
  pyramid: () => new THREE.ConeGeometry(0.85, 1.3, 4),
  prism: () => new THREE.CylinderGeometry(0.8, 0.8, 1.3, 3),
  octahedron: () => new THREE.OctahedronGeometry(0.88),
  torus: () => new THREE.TorusGeometry(0.6, 0.26, 16, 32)
};
const SHAPE_COLOR = {
  cuboid: 0x4C8077,
  sphere: 0x63BAAB,
  cylinder: 0x4C8077,
  cone: 0xC4601A,
  pyramid: 0xDF974F,
  prism: 0x63BAAB,
  octahedron: 0xC4601A,
  torus: 0x4C8077
};
const SHAPE_NAMES = Object.keys(SHAPE_GEOMETRY);

/* ---------- 3D: extrude the same SVG shapes ---------- */
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(0, 0, 22);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
webglWrap.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const key = new THREE.DirectionalLight(0xffffff, 0.9);
key.position.set(5, 8, 10);
scene.add(key);
const rim = new THREE.DirectionalLight(0xCD8D50, 0.4);
rim.position.set(-6, -3, -6);
scene.add(rim);

const group = new THREE.Group();
scene.add(group);

const loader = new THREE.SVGLoader();
const svgData = loader.parse(RAW_SVG);

function shapesFromPath(path) {
  if (typeof path.toShapes === 'function') return path.toShapes(true);
  if (THREE.SVGLoader.createShapes) return THREE.SVGLoader.createShapes(path);
  return [];
}

svgData.paths.forEach(path => {
  const node = path.userData && path.userData.node;
  const id = node ? node.id : null;
  if (!id || !(id in COLOR_MAP)) return;
  const shapes = shapesFromPath(path);
  shapes.forEach(shape => {
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 26, bevelEnabled: false, curveSegments: 12 });
    const mat = new THREE.MeshStandardMaterial({
      color: COLOR_MAP[id], side: THREE.DoubleSide, roughness: 0.4, metalness: 0.25
    });
    group.add(new THREE.Mesh(geo, mat));
  });
});

/* center + scale + flip Y (SVG is y-down, three.js is y-up) */
group.scale.set(1 / 34, -1 / 34, 1 / 34);
group.position.set(-1512 / 34, 859 / 34, -0.4);

function resize() {
  const w = webglWrap.clientWidth, h = webglWrap.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

/* ---------- scroll-linked rotation, pinned like the Noomo hero ---------- */
const pinWrap = document.querySelector('.pin-wrap');
let scrollProgress = 0;
function updateScroll() {
  const rect = pinWrap.getBoundingClientRect();
  const total = rect.height - window.innerHeight;
  const passed = -rect.top;
  scrollProgress = Math.min(Math.max(passed / total, 0), 1);
}
window.addEventListener('scroll', updateScroll, { passive: true });
updateScroll();

const outer = new THREE.Group();
outer.add(group);
scene.remove(group);
scene.add(outer);

/* ---------- fit + align the 3D canvas so the model matches the drawn logo's exact size and spot ----------
   Measures the model's real on-screen size from the camera/geometry (not a guessed constant), scales it to
   match .logo-frame's actual pixel width, and shifts the canvas so both centers land on the same spot. */
function fitAndAlignModel() {
  const frameRect = logoFrame.getBoundingClientRect();
  const dx = (frameRect.left + frameRect.width / 2) - window.innerWidth / 2;
  const dy = (frameRect.top + frameRect.height / 2) - window.innerHeight / 2;
  webglAlign.style.transform = `translate(${dx}px, ${dy}px)`;

  outer.scale.setScalar(1);
  const box = new THREE.Box3().setFromObject(outer);
  const modelWorldWidth = box.max.x - box.min.x;

  const canvasHeight = webglWrap.clientHeight || window.innerHeight;
  const fovRad = (camera.fov * Math.PI) / 180;
  const worldHeightVisible = 2 * Math.tan(fovRad / 2) * camera.position.z;
  const pxPerWorldUnit = canvasHeight / worldHeightVisible;

  const desiredWorldWidth = frameRect.width / pxPerWorldUnit;
  const fitScale = desiredWorldWidth / modelWorldWidth;

  outer.scale.setScalar(fitScale);
}
window.addEventListener('resize', fitAndAlignModel);
fitAndAlignModel();

/* smoothed scroll value: eases toward the real scroll position instead of tracking it 1:1,
   so the tumble follows gently rather than snapping with every scroll tick */
let smoothProgress = 0;

function animate(now) {
  const t = now * 0.00012;
  smoothProgress += (scrollProgress - smoothProgress) * 0.028;
  const s = smoothProgress;

  /* main turtle: constant idle spin (untouched) + a straight vertical tumble tied to scroll —
     scrolling down rotates it forward, scrolling up rotates it back the same way, no lateral drift */
  outer.rotation.y = t;
  outer.rotation.x = s * Math.PI * 1.15;
  outer.rotation.z = 0;
  outer.position.x = 0;
  outer.position.y = 0;

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

/* ---------- decorative "child" turtles, floating in the Features section ---------- */
const featuresTurtlesEl = document.getElementById('features-turtles');
if (featuresTurtlesEl) {
  const fScene = new THREE.Scene();
  const fCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  fCamera.position.set(0, 0, 22);

  const fRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  fRenderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  featuresTurtlesEl.appendChild(fRenderer.domElement);

  fScene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const fKey = new THREE.DirectionalLight(0xffffff, 0.8);
  fKey.position.set(5, 8, 10);
  fScene.add(fKey);

  const FEATURE_TURTLE_COUNT = 5;
  const featureTurtles = [];
  for (let i = 0; i < FEATURE_TURTLE_COUNT; i++) {
    const holder = new THREE.Group();
    holder.add(group.clone(true));
    const scale = THREE.MathUtils.lerp(0.24, 0.12, i / (FEATURE_TURTLE_COUNT - 1));
    holder.scale.setScalar(scale);
    holder.userData = {
      phase: (i / FEATURE_TURTLE_COUNT) * Math.PI * 2,
      speed: 0.45 + i * 0.13,
      baseX: THREE.MathUtils.lerp(-10, 10, i / (FEATURE_TURTLE_COUNT - 1)),
      baseY: i % 2 === 0 ? 4 : -4
    };
    fScene.add(holder);
    featureTurtles.push(holder);
  }

  function fResize() {
    const w = featuresTurtlesEl.clientWidth, h = featuresTurtlesEl.clientHeight;
    if (!w || !h) return;
    fRenderer.setSize(w, h);
    fCamera.aspect = w / h;
    fCamera.updateProjectionMatrix();
  }
  window.addEventListener('resize', fResize);
  fResize();

  let featuresVisible = false;
  const featuresObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => { featuresVisible = entry.isIntersecting; });
  }, { threshold: 0.05 });
  featuresObserver.observe(document.getElementById('features'));

  function animateFeatureTurtles(now) {
    if (featuresVisible) {
      const t = now * 0.00013;
      featureTurtles.forEach(holder => {
        const { phase, speed, baseX, baseY } = holder.userData;
        holder.position.x = baseX + Math.sin(t * speed + phase) * 1.8;
        holder.position.y = baseY + Math.cos(t * speed * 1.3 + phase) * 1.3;
        holder.rotation.y = t * speed * 2 + phase;
        holder.rotation.x = Math.sin(t * speed + phase) * 0.6;
        holder.rotation.z = Math.cos(t * speed * 0.7 + phase) * 0.4;
      });
      fRenderer.render(fScene, fCamera);
    }
    requestAnimationFrame(animateFeatureTurtles);
  }
  requestAnimationFrame(animateFeatureTurtles);
}

/* ---------- FAQ: a stream of small 3D shapes pouring diagonally through the section, like grain
   from a jar. Uses an orthographic camera mapped 1:1 to CSS pixels so mouse-relative physics need
   no projection math — a particle's Three.js x/y *is* its on-screen pixel position. Each particle
   tracks two things: a `flow` position that always advances along its own constant diagonal path
   (this is the part that guarantees it "keeps going" no matter what), and a decaying `offset` layered
   on top for the cursor-repulsion/neighbor-jostle effect — once nothing is pushing on it, offset
   relaxes back to zero and the shape is back on its undisturbed line. ---------- */
const faqShapesEl = document.getElementById('faq-shapes');
if (faqShapesEl && window.THREE) {
  const qScene = new THREE.Scene();
  const qCamera = new THREE.OrthographicCamera(0, 1, 0, 1, -500, 500);
  qCamera.position.z = 100;

  const qRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  qRenderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  faqShapesEl.appendChild(qRenderer.domElement);

  qScene.add(new THREE.AmbientLight(0xffffff, 0.8));
  const qKey = new THREE.DirectionalLight(0xffffff, 0.7);
  qKey.position.set(4, 6, 8);
  qScene.add(qKey);

  const PARTICLE_COUNT = 55;
  const FLOW_ANGLE = (48 * Math.PI) / 180; /* down-right heading, degrees from horizontal */
  const REPEL_RADIUS = 90;
  const NEIGHBOR_RADIUS = 34;

  let qWidth = 0, qHeight = 0;
  const particles = [];

  function spawnParticle(p, randomizeAlongPath) {
    /* seed anywhere along the diagonal for the initial fill, otherwise always re-enter top-left */
    const along = randomizeAlongPath ? Math.random() : 0;
    const spread = (Math.random() - 0.5) * 260;
    p.flowX = -80 + along * (qWidth + 160) + spread * 0.3;
    p.flowY = -80 + along * (qHeight + 160) * 0.4 + spread;
    p.offsetX = 0;
    p.offsetY = 0;
  }

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const shapeName = SHAPE_NAMES[i % SHAPE_NAMES.length];
    const size = 0.55 + Math.random() * 0.9;
    const geo = SHAPE_GEOMETRY[shapeName]();
    /* bias toward the teal tones — they read clearly against the FAQ section's terracotta/brown
       background, unlike the terracotta shapes which would nearly disappear into it */
    const useTeal = Math.random() < 0.72;
    const color = useTeal ? (Math.random() < 0.5 ? 0x4C8077 : 0x63BAAB) : SHAPE_COLOR[shapeName];
    const mat = new THREE.MeshStandardMaterial({
      color, transparent: true, opacity: 0.16 + Math.random() * 0.1,
      roughness: 0.45, metalness: 0.2, depthWrite: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.scale.setScalar(size * 13);
    qScene.add(mesh);

    const speed = 0.35 + Math.random() * 0.35;
    const angleJitter = (Math.random() - 0.5) * 0.35;
    const p = {
      mesh,
      vx: Math.cos(FLOW_ANGLE + angleJitter) * speed,
      vy: Math.sin(FLOW_ANGLE + angleJitter) * speed,
      rotSpeed: (Math.random() - 0.5) * 0.02,
      rotAxisSeed: Math.random() * 10,
      flowX: 0, flowY: 0, offsetX: 0, offsetY: 0
    };
    spawnParticle(p, true);
    particles.push(p);
  }

  let qMouseX = -9999, qMouseY = -9999;
  let qMouseActive = false;
  const qFaqSection = document.getElementById('faq');
  qFaqSection.addEventListener('mousemove', (e) => {
    const rect = qFaqSection.getBoundingClientRect();
    qMouseX = e.clientX - rect.left;
    qMouseY = e.clientY - rect.top;
    qMouseActive = true;
  });
  qFaqSection.addEventListener('mouseleave', () => { qMouseActive = false; });

  function qResize() {
    qWidth = faqShapesEl.clientWidth;
    qHeight = faqShapesEl.clientHeight;
    if (!qWidth || !qHeight) return;
    qCamera.left = 0; qCamera.right = qWidth;
    qCamera.top = qHeight; qCamera.bottom = 0;
    qCamera.updateProjectionMatrix();
    qRenderer.setSize(qWidth, qHeight);
  }
  window.addEventListener('resize', qResize);
  qResize();

  let qVisible = false;
  const qObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => { qVisible = entry.isIntersecting; });
  }, { threshold: 0.05 });
  qObserver.observe(qFaqSection);

  function animateFaqShapes() {
    if (qVisible && qWidth && qHeight) {
      /* neighbor separation: light O(n^2) pass, trivial at this particle count — only nudges
         shapes that are already close, so it's invisible until the cursor crowds a cluster together */
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        const ax = a.flowX + a.offsetX, ay = a.flowY + a.offsetY;
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const bx = b.flowX + b.offsetX, by = b.flowY + b.offsetY;
          const dx = ax - bx, dy = ay - by;
          const dist = Math.hypot(dx, dy) || 0.001;
          if (dist < NEIGHBOR_RADIUS) {
            const push = ((NEIGHBOR_RADIUS - dist) / NEIGHBOR_RADIUS) * 0.6;
            const nx = dx / dist, ny = dy / dist;
            a.offsetX += nx * push; a.offsetY += ny * push;
            b.offsetX -= nx * push; b.offsetY -= ny * push;
          }
        }
      }

      particles.forEach(p => {
        /* the undisturbed path always advances, regardless of any interaction below */
        p.flowX += p.vx;
        p.flowY += p.vy;

        if (qMouseActive) {
          const dx = (p.flowX + p.offsetX) - qMouseX;
          const dy = (p.flowY + p.offsetY) - qMouseY;
          const dist = Math.hypot(dx, dy) || 0.001;
          if (dist < REPEL_RADIUS) {
            const push = ((REPEL_RADIUS - dist) / REPEL_RADIUS) * 5.5;
            p.offsetX += (dx / dist) * push;
            p.offsetY += (dy / dist) * push;
          }
        }

        /* relax back toward the undisturbed path once nothing is pushing */
        p.offsetX *= 0.9;
        p.offsetY *= 0.9;

        if (p.flowX - p.offsetX > qWidth + 120 || p.flowY - p.offsetY > qHeight + 120) {
          spawnParticle(p, false);
        }

        const renderX = p.flowX + p.offsetX;
        const renderY = p.flowY + p.offsetY;
        p.mesh.position.set(renderX, qHeight - renderY, 0);
        p.mesh.rotation.x += p.rotSpeed;
        p.mesh.rotation.y += p.rotSpeed * 1.3;
      });

      qRenderer.render(qScene, qCamera);
    }
    requestAnimationFrame(animateFaqShapes);
  }
  requestAnimationFrame(animateFaqShapes);
}

/* ---------- theme toggle: sun sets below the button, moon rises on the left (and vice versa) ---------- */
const themeToggle = document.getElementById('theme-toggle');

function syncThemeToggleLabel() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  themeToggle.setAttribute('aria-pressed', String(isLight));
  themeToggle.setAttribute('aria-label', isLight ? 'Switch to dark theme' : 'Switch to light theme');
}
syncThemeToggleLabel();

themeToggle.addEventListener('click', () => {
  const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('chelone-theme', next);
  syncThemeToggleLabel();
});

/* ---------- nav: scroll shadow + mobile toggle ---------- */
const siteNav = document.getElementById('site-nav');
function updateNavShadow() {
  siteNav.classList.toggle('scrolled', window.scrollY > 40);
}
window.addEventListener('scroll', updateNavShadow, { passive: true });
updateNavShadow();

const navToggle = document.getElementById('nav-toggle');
const navLinks = document.getElementById('nav-links');
navToggle.addEventListener('click', () => {
  const isOpen = navLinks.classList.toggle('open');
  navToggle.classList.toggle('open', isOpen);
  navToggle.setAttribute('aria-expanded', String(isOpen));
});
navLinks.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('open');
    navToggle.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
  });
});

/* ---------- FAQ accordion ---------- */
document.querySelectorAll('.faq-question').forEach(btn => {
  const answer = btn.nextElementSibling;
  btn.addEventListener('click', () => {
    const isOpen = btn.getAttribute('aria-expanded') === 'true';
    document.querySelectorAll('.faq-question').forEach(other => {
      other.setAttribute('aria-expanded', 'false');
      other.nextElementSibling.style.maxHeight = null;
    });
    if (!isOpen) {
      btn.setAttribute('aria-expanded', 'true');
      answer.style.maxHeight = answer.scrollHeight + 'px';
    }
  });
});

/* ---------- scroll reveal: fades in AND out both scroll directions ---------- */
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    entry.target.classList.toggle('reveal-visible', entry.isIntersecting);
  });
}, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
document.querySelectorAll('[data-reveal]').forEach(el => revealObserver.observe(el));

/* ---------- lens hover: cursor-tracked tilt + spotlight on buttons/cards ---------- */
document.querySelectorAll('.lens').forEach(el => {
  el.addEventListener('mousemove', (e) => {
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    el.style.setProperty('--rx', ((0.5 - py) * 14).toFixed(2) + 'deg');
    el.style.setProperty('--ry', ((px - 0.5) * 14).toFixed(2) + 'deg');
    el.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
    el.style.setProperty('--my', (py * 100).toFixed(1) + '%');
  });
  el.addEventListener('mouseleave', () => {
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  });
});

/* ---------- scroll color-wash: shifts through Chelone's terracotta/teal palette ---------- */
const colorLayer = document.getElementById('color-layer');
function updateColorLayer() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const p = max > 0 ? window.scrollY / max : 0;
  colorLayer.style.setProperty('--wash-y', (10 + p * 70) + '%');
  colorLayer.style.setProperty('--wash-y2', (80 - p * 55) + '%');
  colorLayer.style.setProperty('--wash-y3', (30 + p * 60) + '%');
  colorLayer.style.opacity = (0.12 + p * 0.1).toFixed(3);
}
window.addEventListener('scroll', updateColorLayer, { passive: true });
updateColorLayer();

/* ---------- 3D button/card icons: real Three.js meshes, one small canvas per icon ----------
   Each canvas is a normal DOM child of its `.shape3d` span, so it scrolls with the page exactly
   like any other element — no JS position-tracking, so no lag/inertia versus native scrolling.
   Rendering is paused (not disposed) for icons currently off-screen, via IntersectionObserver. */
const iconEls = Array.from(document.querySelectorAll('.shape3d[data-shape]'));
if (iconEls.length && window.THREE) {
  const iconObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.target._iconRec) entry.target._iconRec.visible = entry.isIntersecting;
    });
  }, { threshold: 0.01 });

  iconEls.forEach((el) => {
    const shape = el.dataset.shape;
    const canvas = document.createElement('canvas');
    el.appendChild(canvas);

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 10);
    camera.position.set(0, 0, 3.2);

    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const key = new THREE.DirectionalLight(0xffffff, 0.95);
    key.position.set(2, 3, 4);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xffffff, 0.3);
    rim.position.set(-3, -2, -2);
    scene.add(rim);

    const buildGeometry = SHAPE_GEOMETRY[shape] || SHAPE_GEOMETRY.cuboid;
    const mesh = new THREE.Mesh(
      buildGeometry(),
      new THREE.MeshStandardMaterial({ color: SHAPE_COLOR[shape] || 0xCD8D50, roughness: 0.35, metalness: 0.25 })
    );
    if (shape === 'pyramid') mesh.rotation.y = Math.PI / 4;
    scene.add(mesh);

    function resize() {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener('resize', resize);

    const rec = { visible: true, t: Math.random() * 10, spinSpeed: 0.006 + Math.random() * 0.004 };
    el._iconRec = rec;
    iconObserver.observe(el);

    (function loop() {
      if (rec.visible) {
        rec.t += 0.012;
        mesh.rotation.y += rec.spinSpeed;
        mesh.rotation.x = Math.sin(rec.t) * 0.22 + 0.12;
        renderer.render(scene, camera);
      }
      requestAnimationFrame(loop);
    })();
  });
}
