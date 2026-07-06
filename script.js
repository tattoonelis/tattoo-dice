import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

let wordCount = 3;
let deck = [];
let secretSequence = "";
let hiddenActive = false;
let rollInProgress = false;
let currentRoll = [];
let lastRollWasKeepDrawing = false;

const rollButton = document.getElementById("rollButton");
const diceOptions = document.querySelectorAll(".dice-option");
const counterEl = document.getElementById("counter");
const sceneWrap = document.getElementById("sceneWrap");
const diceStageEl = document.getElementById("diceStage3d");
const hiddenMessageEl = document.getElementById("hiddenMessage");
const screenFade = document.getElementById("screenFade");

const SECRET_CODE = "332211";
const KEEP_DRAWING_CHANCE = 0.01;
const SUPABASE_URL = "https://gkcsiqgsovbbavunibmv.supabase.co";
const SUPABASE_KEY = "sb_publishable_la1MqfOB-NqB0pMK1_ruJg_0UUZKrAV";

let scene, camera, renderer, floor;
let diceMeshes = [];

const layouts = {
  1: [
    [0.00, -0.24, 0.34, -0.82, 0.10, 0.00, 2.42]
  ],
  2: [
    // Two dice centered as a pair around the middle.
    [-0.92, -0.30, 0.38, -0.82, 0.20, -0.06, 1.92],
    [ 0.92, -0.08, -0.52, -0.78,-0.28,  0.10, 1.72]
  ],
  3: [
    [0.00, -0.34, 0.56, -0.82, 0.10, 0.00, 2.06],
    [-2.06, -0.04, -0.66, -0.78, 0.36, -0.13, 1.66],
    [ 2.06, -0.04, -0.66, -0.78,-0.36,  0.13, 1.66]
  ]
};

// RoundedBoxGeometry / BoxGeometry material order:
// +x, -x, +y, -y, +z, -z
const FACE_NORMALS = [
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(-1, 0, 0),
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0, -1, 0),
  new THREE.Vector3(0, 0, 1),
  new THREE.Vector3(0, 0, -1)
];

init();

async function init() {
  lockInterface();
  setupThree();

  await loadDeck();
  validateDeckScores();
  currentRoll = makeRoll(wordCount);
  renderDice(currentRoll, false);

  await loadCounter();

  diceOptions.forEach(button => {
    button.addEventListener("click", () => {
      if (rollInProgress) return;

      wordCount = Number(button.dataset.count);
      diceOptions.forEach(b => b.classList.remove("active"));
      button.classList.add("active");

      registerSecretInput(String(wordCount));

      // Changing dice count only changes the mode.
      // No automatic roll here; user must press ROLL again.
    });
  });

  rollButton.addEventListener("click", () => {
    hiddenActive = false;
    hiddenMessageEl.classList.remove("show");
    
    roll({ countIt: true });
  });

  window.addEventListener("resize", resizeRenderer);
}

function lockInterface() {
  document.addEventListener("touchmove", event => event.preventDefault(), { passive: false });
  document.addEventListener("selectstart", event => event.preventDefault());
  document.addEventListener("contextmenu", event => event.preventDefault());
}

function setupThree() {
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(29, 1, 0.1, 100);
  camera.position.set(0, 6.8, 7.1);
  camera.lookAt(0, -0.55, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  sceneWrap.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 1.35));

  const key = new THREE.DirectionalLight(0xfff4dd, 2.15);
  key.position.set(-2.8, 8.8, 7.2);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xe6efff, 0.28);
  fill.position.set(4.5, 4.6, 2.4);
  scene.add(fill);

  floor = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 12),
    new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.32 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.58;
  floor.receiveShadow = true;
  scene.add(floor);

  resizeRenderer();
  animate();
}

function renderDice(words, animateIn = false) {
  diceMeshes.forEach(mesh => {
    scene.remove(mesh);
    if (Array.isArray(mesh.material)) mesh.material.forEach(mat => {
      if (mat.map) mat.map.dispose();
      mat.dispose();
    });
    if (mesh.geometry) mesh.geometry.dispose();
  });

  diceMeshes = [];

  const layout = layouts[words.length] || layouts[3];

  words.forEach((word, index) => {
    const p = layout[index];
    const mesh = createTextDie(word, p, index);
    // Keep normal 3D depth behavior. The main die is already physically in front.
    // No depthTest hack, because that caused rear dice to show through.
    mesh.renderOrder = index === 0 ? 2 : 1;

    mesh.position.set(p[0], p[1], p[2]);
    mesh.rotation.set(p[3], p[4], p[5]);
    mesh.userData.base = mesh.position.clone();
    mesh.userData.layout = p;
    mesh.userData.startRot = new THREE.Euler();
    mesh.userData.endRot = new THREE.Euler();
    mesh.userData.startTime = 0;
    mesh.userData.duration = 1;
    mesh.userData.delay = index * 0.06;
    mesh.userData.rolling = false;

    // Shadow layering:
    // main/front die casts shadow; rear/side dice do not cast onto the main die.
    mesh.castShadow = index === 0;
    mesh.receiveShadow = true;

    scene.add(mesh);
    diceMeshes.push(mesh);
  });

  if (animateIn) startDiceAnimation();
}

function createTextDie(finalWord, layout, index) {
  const size = layout[6];
  const visibleFaceIndex = getLandingFaceIndex(layout);
  const allFaces = makeFaceWords(finalWord, visibleFaceIndex);

  const materials = allFaces.map((faceWord) => new THREE.MeshPhysicalMaterial({
    map: makeTextTexture(faceWord),
    roughness: 0.36,
    metalness: 0,
    clearcoat: 0.22,
    clearcoatRoughness: 0.42,
    transparent: false,
    opacity: 1,
    depthTest: true,
    depthWrite: true
  }));

  const geometry = new RoundedBoxGeometry(size, size, size, 28, size * 0.11);
  geometry.computeVertexNormals();

  const mesh = new THREE.Mesh(geometry, materials);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.visibleFaceIndex = visibleFaceIndex;
  return mesh;
}

function getLandingFaceIndex(layout) {
  const position = new THREE.Vector3(layout[0], layout[1], layout[2]);
  const euler = new THREE.Euler(layout[3], layout[4], layout[5]);
  const toCamera = camera.position.clone().sub(position).normalize();

  let bestIndex = 4;
  let bestDot = -Infinity;

  FACE_NORMALS.forEach((normal, index) => {
    const worldNormal = normal.clone().applyEuler(euler).normalize();
    const dot = worldNormal.dot(toCamera);
    if (dot > bestDot) {
      bestDot = dot;
      bestIndex = index;
    }
  });

  return bestIndex;
}

function makeFaceWords(finalWord, visibleFaceIndex) {
  const words = [];
  const used = new Set([finalWord]);

  for (let i = 0; i < 6; i++) {
    if (i === visibleFaceIndex) {
      words.push(finalWord);
    } else {
      words.push(randomDeckWord(used));
    }
  }

  return words;
}

function randomDeckWord(used = new Set()) {
  if (!deck.length) return "Tattoo";

  for (let attempts = 0; attempts < 50; attempts++) {
    const word = deck[Math.floor(Math.random() * deck.length)].word || "Tattoo";
    if (!used.has(word)) {
      used.add(word);
      return word;
    }
  }

  return "Tattoo";
}

function makeTextTexture(text) {
  const c = document.createElement("canvas");
  c.width = c.height = 1024;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const bg = ctx.createLinearGradient(0, 0, 1024, 1024);
  bg.addColorStop(0, "#fff9eb");
  bg.addColorStop(0.62, "#eadfcc");
  bg.addColorStop(1, "#c7bda8");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1024, 1024);

  const shine = ctx.createRadialGradient(330, 245, 70, 512, 512, 790);
  shine.addColorStop(0, "rgba(255,255,255,.20)");
  shine.addColorStop(0.55, "rgba(255,255,255,.04)");
  shine.addColorStop(1, "rgba(0,0,0,.075)");
  ctx.fillStyle = shine;
  ctx.fillRect(0, 0, 1024, 1024);

  // Very subtle printed-plastic face depth.
  ctx.strokeStyle = "rgba(255,255,255,.16)";
  ctx.lineWidth = 18;
  ctx.strokeRect(42, 42, 940, 940);

  // Draw upright text for the current final landing/render pose.
  ctx.save();
  ctx.translate(512, 512);
  drawDiceText(ctx, text);
  ctx.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function drawDiceText(ctx, text) {
  const raw = String(text || "Roll").trim();
  const lines = buildTextLines(raw);
  const maxWidth = 720;
  const maxHeight = 620;

  let fontSize = estimateFontSize(lines);
  fontSize = fitFontSize(ctx, lines, fontSize, maxWidth, maxHeight);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#111";
  ctx.strokeStyle = "rgba(255,255,255,.16)";
  ctx.lineWidth = Math.max(2, fontSize * 0.018);
  ctx.font = `900 ${fontSize}px "Arial Rounded MT Bold", "Arial Rounded MT", Arial, sans-serif`;

  const lineHeight = fontSize * 0.94;
  const totalHeight = (lines.length - 1) * lineHeight;
  const startY = -totalHeight / 2;

  lines.forEach((line, index) => {
    const y = startY + index * lineHeight;
    ctx.strokeText(line, 0, y);
    ctx.fillText(line, 0, y);
  });
}

function buildTextLines(text) {
  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts.length ? parts : ["Roll"];

  // Multi-word subjects: each word on its own line, as requested.
  return parts;
}

function estimateFontSize(lines) {
  const longest = lines.reduce((a, b) => a.length >= b.length ? a : b, "");
  let fontSize = 218;

  if (longest.length >= 16) fontSize = 72;
  else if (longest.length >= 14) fontSize = 84;
  else if (longest.length >= 12) fontSize = 98;
  else if (longest.length >= 10) fontSize = 116;
  else if (longest.length >= 8) fontSize = 140;
  else if (longest.length >= 6) fontSize = 170;
  else if (longest.length >= 5) fontSize = 194;

  if (lines.length >= 2) fontSize = Math.min(fontSize, 154);
  if (lines.length >= 3) fontSize = Math.min(fontSize, 116);
  if (lines.length >= 4) fontSize = Math.min(fontSize, 86);

  return fontSize;
}

function fitFontSize(ctx, lines, startSize, maxWidth, maxHeight) {
  let size = startSize;

  while (size > 42) {
    ctx.font = `900 ${size}px "Arial Rounded MT Bold", "Arial Rounded MT", Arial, sans-serif`;

    const widest = Math.max(...lines.map(line => ctx.measureText(line).width));
    const height = lines.length * size * 0.94;

    if (widest <= maxWidth && height <= maxHeight) return size;
    size -= 4;
  }

  return size;
}


function validateDeckScores() {
  const missing = deck.filter(item => !Object.prototype.hasOwnProperty.call(item, "score"));
  const invalid = deck.filter(item => ![0, 1, 2, 3].includes(Number(item.score)));

  if (missing.length || invalid.length) {
    console.warn("Deck score check failed", {
      missing: missing.map(item => item.word),
      invalid: invalid.map(item => ({ word: item.word, score: item.score }))
    });
  } else {
    console.info("Deck score check OK: every subject has score 0-3.");
  }
}

async function loadDeck() {
  try {
    const response = await fetch("/decks/classic.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Deck request failed");
    deck = await response.json();
  } catch (error) {
    console.error("Could not load deck:", error);
    deck = [];
  }
}

async function roll(options = { countIt: true }) {
  if (!deck.length || rollInProgress) return;

  rollInProgress = true;
  hiddenActive = false;
  rollButton.classList.add("rolling");

  // Reset Keep Drawing overlay on the next roll.
  // The fade layer transitions out via CSS so brightness returns smoothly.
  hiddenMessageEl.classList.remove("show");
  if (screenFade) screenFade.classList.remove("show");
  hiddenMessageEl.classList.remove("show");
  

  currentRoll = makeRoll(wordCount);
  renderDice(currentRoll, true);

  const randomKeepDrawing = !lastRollWasKeepDrawing && Math.random() < KEEP_DRAWING_CHANCE;
  if (randomKeepDrawing) {
    setTimeout(() => {
      hiddenActive = true;
      lastRollWasKeepDrawing = true;
      showHiddenMessage();
    }, 760);
  }

  if (!randomKeepDrawing) lastRollWasKeepDrawing = false;

  setTimeout(() => {
    rollButton.classList.remove("rolling");
    rollInProgress = false;

    if (options.countIt) incrementCounter();
  }, 1280);
}

function startDiceAnimation() {
  const now = performance.now() / 1000;

  diceMeshes.forEach((die, index) => {
    const p = die.userData.layout;

    die.userData.startTime = now;
    die.userData.duration = 1.0 + index * 0.08;
    die.userData.delay = index * 0.055;
    die.userData.rolling = true;
    die.userData.startRot.copy(die.rotation);
    die.userData.endRot.set(
      p[3] + 4 * Math.PI * 2,
      p[4] + 4 * Math.PI * 2,
      p[5] + 2 * Math.PI * 2
    );
  });
}

function animate() {
  requestAnimationFrame(animate);
  const t = performance.now() / 1000;

  diceMeshes.forEach(die => {
    const u = die.userData;
    if (!u.rolling) return;

    const p = Math.min(Math.max((t - u.startTime - u.delay) / u.duration, 0), 1);
    if (p <= 0) return;

    const e = easeInOutCubic(p);

    die.rotation.x = lerp(u.startRot.x, u.endRot.x, e);
    die.rotation.y = lerp(u.startRot.y, u.endRot.y, e);
    die.rotation.z = lerp(u.startRot.z, u.endRot.z, e);

    const lift = Math.sin(p * Math.PI) * 0.24 + Math.sin(p * Math.PI * 2) * (1 - p) * 0.04;
    die.position.y = u.base.y + Math.max(0, lift);
    die.position.x = u.base.x + Math.sin(p * Math.PI * 2.5) * (1 - p) * 0.04;

    if (p >= 1) {
      u.rolling = false;
      const l = u.layout;
      die.rotation.set(l[3], l[4], l[5]);
      die.position.copy(u.base);
    }
  });

  renderer.render(scene, camera);
}

function resizeRenderer() {
  if (!renderer || !sceneWrap) return;

  const width = sceneWrap.clientWidth || window.innerWidth;
  const height = sceneWrap.clientHeight || 300;
  const isLandscape = width > height;

  renderer.setSize(width, height, false);
  camera.aspect = width / height;

  if (isLandscape && height < 620) {
    camera.position.z = 7.75;
    camera.position.y = 7.35;
    camera.lookAt(0, -0.60, 0);
  } else if (width >= 900) {
    camera.position.z = 7.55;
    camera.position.y = 7.25;
    camera.lookAt(0, -0.62, 0);
  } else {
    camera.position.z = 6.85;
    camera.position.y = 6.75;
    camera.lookAt(0, -0.62, 0);
  }

  camera.updateProjectionMatrix();
}

function makeRoll(count) {
  const plan = count === 1 ? ["main"] : count === 2 ? ["main", "detail"] : ["main", "detail", "effect"];
  const chosen = [];
  const chosenWords = new Set();
  const usedFamilies = new Set();

  for (const slot of plan) {
    let picked = pickForSlot(slot, usedFamilies, chosenWords);
    if (!picked && slot === "effect") picked = pickForSlot("detail", usedFamilies, chosenWords);
    if (!picked && slot === "detail") picked = pickForSlot("main", usedFamilies, chosenWords);
    if (!picked) continue;

    chosen.push(picked.word);
    chosenWords.add(picked.word);
    usedFamilies.add(getFamily(picked));
  }

  return chosen.length ? chosen : ["Roll again"];
}

function requirementsMet(item, chosenWords) {
  if (!Array.isArray(item.requires) || item.requires.length === 0) return true;
  return item.requires.every(requiredWord => chosenWords.has(requiredWord));
}

function pickForSlot(slot, usedFamilies, chosenWords = new Set()) {
  const options = deck.filter(item => item.slot === slot && !usedFamilies.has(getFamily(item)) && requirementsMet(item, chosenWords));
  if (!options.length) return null;
  return weightedPick(options);
}

function getFamily(item) {
  return item.family || item.word.toLowerCase().replace(/\s+/g, "-");
}

function weightedPick(items) {
  const total = items.reduce((sum, item) => sum + Number(item.weight || 1), 0);
  let roll = Math.random() * total;

  for (const item of items) {
    roll -= Number(item.weight || 1);
    if (roll <= 0) return item;
  }

  return items[items.length - 1];
}

function registerSecretInput(value) {
  secretSequence = (secretSequence + value).slice(-SECRET_CODE.length);

  if (secretSequence === SECRET_CODE) {
    secretSequence = "";
    hiddenActive = true;
    showHiddenMessage();
  }
}

function showHiddenMessage() {
  rollButton.classList.remove("rolling");
  hiddenMessageEl.textContent = "Keep Drawing!";
  lastRollWasKeepDrawing = true;
  if (screenFade) screenFade.classList.add("show");
  hiddenMessageEl.classList.add("show");
}

async function loadCounter() {
  if (!counterEl) return;

  try {
    const total = await getCounterTotal();
    renderCounter(total);
  } catch (error) {
    console.warn("Counter unavailable:", error);
    renderCounter(0);
  }
}

async function incrementCounter() {
  if (!counterEl) return;

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_roll_counter`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_KEY,
        "authorization": `Bearer ${SUPABASE_KEY}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({})
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || "Counter increment failed");
    }

    const total = await response.json();
    renderCounter(Number(total || 0));
  } catch (error) {
    console.warn("Counter increment unavailable:", error);
    const total = await getCounterTotal().catch(() => null);
    if (total !== null) renderCounter(total);
  }
}

async function getCounterTotal() {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/roll_counter?id=eq.1&select=total`, {
    method: "GET",
    headers: {
      "apikey": SUPABASE_KEY,
      "authorization": `Bearer ${SUPABASE_KEY}`
    }
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Counter request failed");
  }

  const data = await response.json();
  return Number(Array.isArray(data) && data[0] ? data[0].total : 0);
}

function renderCounter(count) {
  counterEl.textContent = `${formatNumber(count)} tattoo ideas rolled`;
}

function formatNumber(number) {
  return new Intl.NumberFormat("en-US").format(Number(number || 0));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function easeInOutCubic(x) {
  return x < 0.5
    ? 4 * x * x * x
    : 1 - Math.pow(-2 * x + 2, 3) / 2;
}
