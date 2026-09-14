// ==================================================================
// ROUND GALLERY
// ------------------------------------------------------------------

// Writes a self-contained index.html into a round folder to compare its
// variants: a grid of thumbnails, then two variants side by side, with a
// swipe slider, or blinking in place, over the overview or any detail crop.
// Images load by relative path, so the page works from file:// directly.

import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// ------------------------------------------------------------------

const escapeHtml = text => String(text).replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]);

// ------------------------------------------------------------------

// round: { round, variants: [{ name, description, crops: [cropName, ...] }] }
export async function writeGallery(roundDir, round) {
  const data = JSON.stringify(round).replace(/<\//g, '<\\/');
  const html = PAGE
    .replaceAll('__ROUND_TITLE__', escapeHtml(round.round))
    .replace('__ROUND_DATA__', data);
  await writeFile(join(roundDir, 'index.html'), html);
}

// ------------------------------------------------------------------

const PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Round __ROUND_TITLE__</title>
<style>
:root {
  --bg: #0b1016; --panel: #141c26; --line: #243244;
  --text: #e8e4da; --muted: #8b97a6; --accent: #e0b35a;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font: 14px/1.4 system-ui, sans-serif; }
header {
  position: sticky; top: 0; z-index: 5; display: flex; flex-wrap: wrap; gap: 10px;
  align-items: center; padding: 10px 16px; background: var(--bg); border-bottom: 1px solid var(--line);
}
h1 { margin: 0 8px 0 0; font-size: 16px; font-weight: 600; }
button, select {
  padding: 6px 10px; font: inherit; color: var(--text); background: var(--panel);
  border: 1px solid var(--line); border-radius: 6px; cursor: pointer;
}
button.active { color: var(--accent); border-color: var(--accent); }
label { color: var(--muted); }
.hint { margin-left: auto; color: var(--muted); font-size: 12px; }
#grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 16px; padding: 16px; }
.card { overflow: hidden; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; cursor: pointer; }
.card:hover { border-color: var(--accent); }
.card img { display: block; width: 100%; }
.card div { padding: 8px 10px; }
.card b { display: block; }
.card span { color: var(--muted); font-size: 12px; }
#stage { padding: 12px 16px 24px; }
#stage img { display: block; width: 100%; height: auto; }
.pair { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.pair figure { margin: 0; }
.labels { display: flex; justify-content: space-between; padding: 4px 0 6px; color: var(--muted); }
.labels .on { color: var(--accent); }
.swipe { position: relative; cursor: ew-resize; user-select: none; touch-action: none; }
.swipe img:last-of-type { position: absolute; inset: 0; }
.swipe .bar { position: absolute; top: 0; bottom: 0; width: 2px; background: var(--accent); pointer-events: none; }
.blink { position: relative; }
.blink img:last-of-type { position: absolute; inset: 0; }
[hidden] { display: none !important; }
</style>
</head>
<body>
<header>
  <h1>Round __ROUND_TITLE__</h1>
  <button id="grid-button">Grid</button>
  <label>A <select id="select-a"></select></label>
  <label>B <select id="select-b"></select></label>
  <label>View <select id="select-image"></select></label>
  <button data-mode="side">1 Side by side</button>
  <button data-mode="swipe">2 Swipe</button>
  <button data-mode="blink">3 Blink</button>
  <span class="hint">Left/Right: previous/next A &middot; Up/Down: view &middot; Space: swap A and B &middot; Esc: grid</span>
</header>
<main>
  <div id="grid"></div>
  <div id="stage" hidden></div>
</main>
<script>
const ROUND = __ROUND_DATA__;
const VARIANTS = ROUND.variants;
const IMAGES = ['overview'].concat(VARIANTS[0].crops);
const MODE_KEYS = { '1': 'side', '2': 'swipe', '3': 'blink' };
const BLINK_INTERVAL_MS = 900;

const state = { view: 'grid', mode: 'side', a: 0, b: Math.min(1, VARIANTS.length - 1), image: 'overview' };
let blinkTimer = null;

const byId = id => document.getElementById(id);

function imagePath(variantIdx) {
  const name = VARIANTS[variantIdx].name;
  return state.image === 'overview' ? name + '/overview.png' : name + '/crops/' + state.image + '.png';
}

function fillSelect(select, options) {
  options.forEach(([value, text]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    select.appendChild(option);
  });
}

function show(view) {
  state.view = view;
  byId('grid').hidden = view !== 'grid';
  byId('stage').hidden = view !== 'compare';
  byId('grid-button').classList.toggle('active', view === 'grid');
  if (view === 'compare') renderCompare();
  else stopBlink();
}

function stopBlink() {
  clearInterval(blinkTimer);
  blinkTimer = null;
}

function renderGrid() {
  VARIANTS.forEach((variant, idx) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = '<img loading="lazy" alt=""><div><b></b><span></span></div>';
    card.querySelector('img').src = variant.name + '/thumb.jpg';
    card.querySelector('b').textContent = variant.name;
    card.querySelector('span').textContent = variant.description;
    card.onclick = () => {
      state.a = idx;
      if (state.b === idx) state.b = (idx + 1) % VARIANTS.length;
      show('compare');
    };
    byId('grid').appendChild(card);
  });
}

function makeLabels(stage) {
  const labels = document.createElement('div');
  labels.className = 'labels';
  labels.innerHTML = '<span></span><span></span>';
  labels.children[0].textContent = 'A: ' + VARIANTS[state.a].name;
  labels.children[1].textContent = 'B: ' + VARIANTS[state.b].name;
  stage.appendChild(labels);
  return labels;
}

function renderCompare() {

  stopBlink();
  byId('select-a').value = state.a;
  byId('select-b').value = state.b;
  byId('select-image').value = state.image;
  document.querySelectorAll('[data-mode]').forEach(button => {
    button.classList.toggle('active', button.dataset.mode === state.mode);
  });

  const stage = byId('stage');
  stage.innerHTML = '';

  if (state.mode === 'side') {
    const pair = document.createElement('div');
    pair.className = 'pair';
    [state.a, state.b].forEach((variantIdx, idx) => {
      const figure = document.createElement('figure');
      figure.innerHTML = '<div class="labels"><span></span></div><img alt="">';
      figure.querySelector('span').textContent = (idx ? 'B: ' : 'A: ') + VARIANTS[variantIdx].name;
      figure.querySelector('img').src = imagePath(variantIdx);
      pair.appendChild(figure);
    });
    stage.appendChild(pair);
  }

  else if (state.mode === 'swipe') {
    makeLabels(stage);
    const swipe = document.createElement('div');
    swipe.className = 'swipe';
    swipe.innerHTML = '<img alt=""><img alt=""><div class="bar"></div>';
    const [imageA, imageB] = swipe.querySelectorAll('img');
    const bar = swipe.querySelector('.bar');
    imageA.src = imagePath(state.a);
    imageB.src = imagePath(state.b);
    const setPosition = ratio => {
      imageB.style.clipPath = 'inset(0 0 0 ' + (ratio * 100) + '%)';
      bar.style.left = (ratio * 100) + '%';
    };
    setPosition(0.5);
    swipe.onpointermove = event => {
      const rect = swipe.getBoundingClientRect();
      setPosition(Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)));
    };
    stage.appendChild(swipe);
  }

  else {
    const labels = makeLabels(stage);
    const blink = document.createElement('div');
    blink.className = 'blink';
    blink.innerHTML = '<img alt=""><img alt="">';
    const [imageA, imageB] = blink.querySelectorAll('img');
    imageA.src = imagePath(state.a);
    imageB.src = imagePath(state.b);
    let isShowingB = false;
    const update = () => {
      imageB.style.visibility = isShowingB ? 'visible' : 'hidden';
      labels.children[0].classList.toggle('on', !isShowingB);
      labels.children[1].classList.toggle('on', isShowingB);
    };
    update();
    blinkTimer = setInterval(() => { isShowingB = !isShowingB; update(); }, BLINK_INTERVAL_MS);
    stage.appendChild(blink);
  }
}

fillSelect(byId('select-a'), VARIANTS.map((variant, idx) => [idx, variant.name]));
fillSelect(byId('select-b'), VARIANTS.map((variant, idx) => [idx, variant.name]));
fillSelect(byId('select-image'), IMAGES.map(image => [image, image]));

byId('select-a').onchange = event => { state.a = Number(event.target.value); show('compare'); };
byId('select-b').onchange = event => { state.b = Number(event.target.value); show('compare'); };
byId('select-image').onchange = event => { state.image = event.target.value; show('compare'); };
byId('grid-button').onclick = () => show('grid');
document.querySelectorAll('[data-mode]').forEach(button => {
  button.onclick = () => { state.mode = button.dataset.mode; show('compare'); };
});

document.addEventListener('keydown', event => {
  if (event.target.tagName === 'SELECT') return;
  const count = VARIANTS.length;
  if (event.key === 'Escape') {
    show('grid');
  }
  else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
    state.a = (state.a + (event.key === 'ArrowRight' ? 1 : count - 1)) % count;
    show('compare');
  }
  else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    event.preventDefault();
    const imageIdx = IMAGES.indexOf(state.image);
    state.image = IMAGES[(imageIdx + (event.key === 'ArrowDown' ? 1 : IMAGES.length - 1)) % IMAGES.length];
    show('compare');
  }
  else if (event.key === ' ') {
    event.preventDefault();
    [state.a, state.b] = [state.b, state.a];
    show('compare');
  }
  else if (MODE_KEYS[event.key]) {
    state.mode = MODE_KEYS[event.key];
    show('compare');
  }
});

renderGrid();
show('grid');
</script>
</body>
</html>
`;
