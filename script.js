import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

let wordCount = 3;
let deck = [];
let secretSequence = "";
let hiddenActive = false;
let rollInProgress = false;
let currentRoll = [];
let lastRollWasKeepDrawing = false;
let activeTheme = localStorage.getItem("tattooDiceActiveTheme") || "classic";
let fantasyUnlocked = false;
if (activeTheme === "fantasy" && !fantasyUnlocked) activeTheme = "classic";
let selectedMain = "Random";
let mainSelectionAtOpen = selectedMain;
let themeSelectionAtOpen = activeTheme;
let themeSelectionChanged = false;
let pinInput = "";
let mainSelectionChanged = false;
let mainDropActive = false;
let mainDropStartTime = 0;
let mainDropDuration = 1.25;
let introIsStartup = true;
let themeModalWasOpen = false;
let mainGlowLight = null;

const rollButton = document.getElementById("rollButton");
const diceOptions = document.querySelectorAll(".dice-option");
const counterEl = document.getElementById("counter");
const sceneWrap = document.getElementById("sceneWrap");
const diceStageEl = document.getElementById("diceStage3d");
const hiddenMessageEl = document.getElementById("hiddenMessage");
const screenFade = document.getElementById("screenFade");
const themeButton = document.getElementById("themeButton");
const themeModal = document.getElementById("themeModal");
const classicThemeChoice = document.getElementById("classicThemeChoice");
const fantasyThemeChoice = document.getElementById("fantasyThemeChoice");
const fantasyThemeLabel = document.getElementById("fantasyThemeLabel");
const pinModal = document.getElementById("pinModal");
const pinDisplay = document.getElementById("pinDisplay");
const pinKeypad = document.getElementById("pinKeypad");
const mainButton = document.getElementById("mainButton");
const mainModal = document.getElementById("mainModal");
const mainChoiceList = document.getElementById("mainChoiceList");
const introGateEl = document.getElementById("introGate");

const SECRET_CODE = "332211";
const FANTASY_UNLOCK_CODE = "2311";
const KEEP_DRAWING_CHANCE = 0.01;
const HIDDEN_MESSAGES = ["Keep drawing.", "Not feeling it? Roll again.", "Wrong vibe? Switch themes.", "Different theme. Different magic.", "Don’t force it. Switch themes."];
const SUPABASE_URL = "https://gkcsiqgsovbbavunibmv.supabase.co";
const SUPABASE_KEY = "sb_publishable_la1MqfOB-NqB0pMK1_ruJg_0UUZKrAV";

let scene, camera, renderer, floor;
let introStarted = false;
let introActive = false;
let introStartTime = 0;
let introDuration = 1.78;
let introResolve = null;
let introTargetRect = null;
let introStartTop = 0;
let introAirDice = [];
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


function setThemeModalState(open) {
  if (!themeModal) return;
  const wasOpen = themeModal.classList.contains("open");

  if (open) {
    themeSelectionAtOpen = activeTheme;
    themeSelectionChanged = false;
    updateThemeMenu();
  }

  themeModal.classList.toggle("open", open);
  themeModal.setAttribute("aria-hidden", String(!open));
  document.body.classList.toggle("theme-modal-open", open);

  if (!open && wasOpen && themeSelectionChanged && !introActive && !rollInProgress) {
    playTopDrop(false);
  }
}

function setPinModalState(open) {
  if (!pinModal) return;
  pinInput = "";
  updatePinDisplay();
  pinModal.classList.toggle("open", open);
  pinModal.setAttribute("aria-hidden", String(!open));
  document.body.classList.toggle("pin-modal-open", open);
}

function updatePinDisplay() {
  if (!pinDisplay) return;
  [...pinDisplay.children].forEach((dot, index) => {
    dot.classList.toggle("filled", index < pinInput.length);
  });
}

function updateActionButtonLabels() {
  const themeLabel = themeButton?.querySelector("span");
  const mainLabel = mainButton?.querySelector("span");

  if (themeLabel) {
    themeLabel.textContent = activeTheme === "fantasy" ? "Fantasy" : "Classic";
  }

  if (mainLabel) {
    mainLabel.textContent = selectedMain || "Random";
  }
}

function updateThemeMenu() {
  if (!classicThemeChoice || !fantasyThemeChoice) return;

  classicThemeChoice.classList.toggle("active", activeTheme === "classic");
  classicThemeChoice.setAttribute("aria-pressed", String(activeTheme === "classic"));

  fantasyThemeChoice.classList.toggle("active", activeTheme === "fantasy");
  fantasyThemeChoice.classList.toggle("locked", !fantasyUnlocked);
  fantasyThemeChoice.setAttribute("aria-pressed", String(activeTheme === "fantasy"));
  fantasyThemeLabel.textContent = fantasyUnlocked ? "Fantasy" : "Fantasy 🔒";
  updateActionButtonLabels();
  bindGlobalHiddenMessageDismiss();
}

function mainStorageKey(theme = activeTheme) {
  return `tattooDiceSelectedMain_${theme}`;
}

function loadStoredMain() {
  const fallback = activeTheme === "classic"
    ? localStorage.getItem("tattooDiceSelectedMain")
    : null;
  selectedMain = localStorage.getItem(mainStorageKey()) || fallback || "Random";
  updateActionButtonLabels();
}

async function selectTheme(themeName) {
  if (themeName === "fantasy" && !fantasyUnlocked) {
    setPinModalState(true);
    return;
  }
  if (themeName === activeTheme) {
    updateThemeMenu();
    return;
  }

  activeTheme = themeName;
  if (activeTheme === "classic") fantasyUnlocked = false;

  selectedMain = "Random";
  localStorage.setItem("tattooDiceSelectedMain", selectedMain);
  localStorage.setItem(mainStorageKey(activeTheme), selectedMain);
  updateActionButtonLabels();

  localStorage.setItem("tattooDiceActiveTheme", activeTheme);
  themeSelectionChanged = activeTheme !== themeSelectionAtOpen;

  loadStoredMain();
  await loadDeck();
  validateDeckScores();
  buildMainMenu();

  currentRoll = makeRoll(wordCount);
  renderDice(currentRoll, false);
  updateThemeMenu();
  updateMainSelectionGlow();
  updateActionButtonLabels();
}


function setMainModalState(open) {
  if (!mainModal) return;

  if (open) {
    mainSelectionAtOpen = selectedMain;
    mainSelectionChanged = false;
  }

  mainModal.classList.toggle("open", open);
  mainModal.setAttribute("aria-hidden", String(!open));
  document.body.classList.toggle("main-modal-open", open);

  if (!open && mainSelectionChanged && selectedMain !== mainSelectionAtOpen) {
    applyMainSelectionDrop();
  }
}

function updateMainSelectionGlow() {
  const active = selectedMain !== "Random";
  diceStageEl?.classList.toggle("main-selected", active);

  if (mainGlowLight) {
    mainGlowLight.intensity = active ? 1.05 : 0;
  }

  diceMeshes.forEach((mesh, index) => {
    if (!Array.isArray(mesh.material)) return;

    mesh.material.forEach(material => {
      if (!material || !("emissive" in material)) return;

      if (active && index === 0) {
        material.emissive.setHex(0x32c878);
        material.emissiveIntensity = 0.34;
      } else {
        material.emissive.setHex(0x000000);
        material.emissiveIntensity = 0;
      }
      material.needsUpdate = true;
    });
  });
}

function buildMainMenu() {
  if (!mainChoiceList) return;

  const mainWords = [...new Set(
    deck
      .filter(item => item.slot === "main" && Number(item.score || 0) >= 3)
      .map(item => item.word)
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));

  if (selectedMain !== "Random" && !mainWords.includes(selectedMain)) {
    selectedMain = "Random";
    localStorage.setItem("tattooDiceSelectedMain", selectedMain);
    updateActionButtonLabels();
  }

  mainChoiceList.innerHTML = "";

  ["Random", ...mainWords].forEach(word => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "main-choice";
    button.textContent = word;
    button.dataset.main = word;
    button.classList.toggle("active", word === selectedMain);
    button.setAttribute("aria-pressed", String(word === selectedMain));

    button.addEventListener("click", () => {
      selectedMain = word;
      mainSelectionChanged = selectedMain !== mainSelectionAtOpen;
      localStorage.setItem(mainStorageKey(), selectedMain);
      if (activeTheme === "classic") {
        localStorage.setItem("tattooDiceSelectedMain", selectedMain);
      }
      updateMainSelectionGlow();
      updateActionButtonLabels();

      mainChoiceList.querySelectorAll(".main-choice").forEach(choice => {
        const active = choice.dataset.main === selectedMain;
        choice.classList.toggle("active", active);
        choice.setAttribute("aria-pressed", String(active));
      });

      mainSelectionChanged = true;
      setMainModalState(false);

    });

    mainChoiceList.appendChild(button);
  });
}

function applyMainSelectionDrop() {
  if (!deck.length || rollInProgress || introActive) return;

  hiddenActive = false;
  hiddenMessageEl.classList.remove("show");
  if (screenFade) screenFade.classList.remove("show");

  currentRoll = makeRoll(wordCount);
  renderDice(currentRoll, false);
  playTopDrop(false);
}

function replayCurrentDiceFromTop() {
  if (!deck.length || rollInProgress || introActive) return;
  renderDice(currentRoll, false);
  playTopDrop(false);
}

function startMainDropAnimation() {
  const now = performance.now() / 1000;
  mainDropStartTime = now;
  mainDropActive = true;

  diceMeshes.forEach((die, index) => {
    const layout = die.userData.layout;
    die.userData.dropTargetPosition = new THREE.Vector3(layout[0], layout[1], layout[2]);
    die.userData.dropTargetRotation = new THREE.Euler(layout[3], layout[4], layout[5]);
    die.userData.dropStartY = layout[1] + 6.2 + index * 0.55;
    die.userData.dropImpact = 0.54 + index * 0.035;
    die.userData.dropStrength = index === 0 ? 0.68 : 0.50;

    die.position.set(layout[0], die.userData.dropStartY, layout[2]);
    die.rotation.set(
      layout[3] - Math.PI * 4,
      layout[4] - Math.PI * 2,
      layout[5] - Math.PI * 2
    );
    die.scale.set(1, 1, 1);
    die.userData.rolling = false;
  });
}


function closeHiddenMessage(){if(!hiddenMessageEl)return;hiddenActive=false;hiddenMessageEl.classList.remove("show");}
function bindGlobalHiddenMessageDismiss(){const dismiss=e=>{if(!hiddenActive)return;e.preventDefault();closeHiddenMessage();};document.addEventListener("pointerup",dismiss,{passive:false});document.addEventListener("click",dismiss);}

function disablePageZoom(){
document.addEventListener("gesturestart",e=>e.preventDefault(),{passive:false});
document.addEventListener("gesturechange",e=>e.preventDefault(),{passive:false});
document.addEventListener("gestureend",e=>e.preventDefault(),{passive:false});
let lastTouchEnd=0;
document.addEventListener("touchend",e=>{const now=Date.now();if(now-lastTouchEnd<=300)e.preventDefault();lastTouchEnd=now;},{passive:false});
}

async function requestPortraitLock() {
  try {
    if (screen.orientation?.lock) {
      await screen.orientation.lock("portrait-primary");
    }
  } catch (error) {
    // Browsers such as iOS Safari may ignore orientation locking.
    // The CSS portrait-lock overlay remains the fallback.
  }
}

async function init() {
  lockInterface();
  disablePageZoom();
  requestPortraitLock();
  setupThree();
  loadStoredMain();
  updateThemeMenu();
  updateActionButtonLabels();

  await loadDeck();
  validateDeckScores();
  buildMainMenu();
  updateMainSelectionGlow();

  // Preload the exact first result and all materials while the intro text is visible.
  wordCount = 3;
  currentRoll = makeRoll(3);
  renderDice(currentRoll, false);
  renderer.compile(scene, camera);
  renderer.render(scene, camera);

  await loadCounter();
  await waitForIntroTap();
  await playIntroRoll();
  await incrementCounter();

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
    closeHiddenMessage();

    roll({ countIt: true });
  });

  if (themeButton && themeModal) {
    themeButton.addEventListener("pointerup", event => {
      event.preventDefault();
      event.stopPropagation();
      setThemeModalState(true);
    }, { passive: false });

    themeModal.querySelectorAll("[data-close-theme]").forEach(element => {
      element.addEventListener("pointerup", event => {
        event.preventDefault();
        setThemeModalState(false);
      }, { passive: false });
    });

    classicThemeChoice?.addEventListener("pointerup", event => {
      event.preventDefault();
      selectTheme("classic");
    }, { passive: false });

    fantasyThemeChoice?.addEventListener("pointerup", event => {
      event.preventDefault();
      selectTheme("fantasy");
    }, { passive: false });

    pinModal?.querySelectorAll("[data-close-pin]").forEach(element => {
      element.addEventListener("pointerup", event => {
        event.preventDefault();
        setPinModalState(false);
      }, { passive: false });
    });

    pinKeypad?.addEventListener("pointerup", async event => {
      const digitButton = event.target.closest("[data-pin-digit]");
      const clearButton = event.target.closest("[data-pin-clear]");
      const backspaceButton = event.target.closest("[data-pin-backspace]");
      if (!digitButton && !clearButton && !backspaceButton) return;

      event.preventDefault();

      if (clearButton) {
        pinInput = "";
      } else if (backspaceButton) {
        pinInput = pinInput.slice(0, -1);
      } else if (pinInput.length < 4) {
        pinInput += digitButton.dataset.pinDigit;
      }

      updatePinDisplay();

      if (pinInput.length === 4) {
        if (pinInput === FANTASY_UNLOCK_CODE) {
          fantasyUnlocked = true;
          await selectTheme("fantasy");
          setPinModalState(false);
          setThemeModalState(false);
          updateActionButtonLabels();
        } else {
          pinInput = "";
          updatePinDisplay();
        }
      }
    }, { passive: false });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        setThemeModalState(false);
        setMainModalState(false);
        setPinModalState(false);
      }
    });
  }

  if (mainButton && mainModal) {
    mainButton.addEventListener("pointerup", event => {
      event.preventDefault();
      event.stopPropagation();
      setMainModalState(true);
    }, { passive: false });

    mainModal.querySelectorAll("[data-close-main]").forEach(element => {
      element.addEventListener("pointerup", event => {
        event.preventDefault();
        setMainModalState(false);
      }, { passive: false });
    });
  }

  window.addEventListener("resize", resizeRenderer);
}

function waitForIntroTap() {
  if (!introGateEl) return Promise.resolve();

  return new Promise(resolve => {
    const begin = event => {
      if (introStarted) return;
      if (event.type === "keydown" && event.key !== "Enter" && event.key !== " ") return;

      event.preventDefault();
      introStarted = true;
      introGateEl.removeEventListener("pointerup", begin);
      introGateEl.removeEventListener("click", begin);
      introGateEl.removeEventListener("keydown", begin);
      resolve();
    };

    introGateEl.addEventListener("pointerup", begin, { passive: false });
    introGateEl.addEventListener("click", begin, { passive: false });
    introGateEl.addEventListener("keydown", begin);
  });
}

function playIntroRoll() {
  return playTopDrop(true);
}

function playTopDrop(isStartup = false) {
  if (!diceMeshes.length || (isStartup && !introGateEl)) {
    sceneWrap.classList.remove("intro-hidden");
    if (isStartup) introGateEl?.remove();
    return Promise.resolve();
  }

  introIsStartup = isStartup;
  introTargetRect = sceneWrap.getBoundingClientRect();
  introStartTop = -introTargetRect.height - 26;
  document.body.classList.add("intro-running");

  sceneWrap.classList.add("intro-moving");
  sceneWrap.style.left = `${introTargetRect.left}px`;
  sceneWrap.style.top = `${introStartTop}px`;
  sceneWrap.style.width = `${introTargetRect.width}px`;
  sceneWrap.style.height = `${introTargetRect.height}px`;
  sceneWrap.classList.remove("intro-hidden");

  introAirDice = [];

  diceMeshes.forEach((die, index) => {
    const layout = die.userData.layout;
    const targetPosition = new THREE.Vector3(layout[0], layout[1], layout[2]);
    const targetRotation = new THREE.Euler(layout[3], layout[4], layout[5]);

    die.userData.introTargetPosition = targetPosition.clone();
    die.userData.introTargetRotation = targetRotation.clone();
    die.userData.introPhysicsStrength =
      (index === 0 ? 0.76 : 0.58) * (0.95 + Math.random() * 0.10);
    die.userData.introImpactDelay = index * (0.028 + Math.random() * 0.015);
    die.userData.introLanded = false;

    die.position.copy(targetPosition);
    die.rotation.copy(targetRotation);
    die.scale.set(1, 1, 1);
    die.visible = false;
    die.userData.rolling = false;

    const airDie = die.clone();
    airDie.geometry = die.geometry;
    airDie.material = die.material;
    airDie.visible = true;
    airDie.position.copy(targetPosition);
    airDie.scale.set(1, 1, 1);
    airDie.renderOrder = die.renderOrder;
    airDie.castShadow = die.castShadow;
    airDie.receiveShadow = die.receiveShadow;

    const turnsX = index === 0 ? 4 : 3 + index;
    const turnsY = index === 0 ? 2 : 1 + index;
    const turnsZ = index === 0 ? 1 : index;

    airDie.userData.startRotation = new THREE.Euler(
      targetRotation.x - turnsX * Math.PI * 2,
      targetRotation.y - turnsY * Math.PI * 2,
      targetRotation.z - turnsZ * Math.PI * 2
    );
    airDie.userData.targetRotation = targetRotation.clone();
    airDie.userData.impactStart = 0.60 + die.userData.introImpactDelay;
    airDie.rotation.copy(airDie.userData.startRotation);

    scene.add(airDie);
    introAirDice.push(airDie);
  });

  if (isStartup) introGateEl.classList.add("starting");
  introStartTime = performance.now() / 1000;
  introActive = true;

  return new Promise(resolve => {
    introResolve = resolve;
  });
}

function finishIntroRoll() {
  introActive = false;

  introAirDice.forEach(airDie => {
    scene.remove(airDie);
  });
  introAirDice = [];

  diceMeshes.forEach(die => {
    die.visible = true;
    die.position.copy(die.userData.introTargetPosition);
    die.rotation.copy(die.userData.introTargetRotation);
    die.scale.set(1, 1, 1);
    die.userData.base.copy(die.userData.introTargetPosition);
    die.userData.introLanded = true;
  });

  sceneWrap.style.left = "";
  sceneWrap.style.top = "";
  sceneWrap.style.width = "";
  sceneWrap.style.height = "";
  sceneWrap.classList.remove("intro-moving", "intro-hidden");
  document.body.classList.remove("intro-running");
  resizeRenderer();

  if (introIsStartup && introGateEl) {
    introGateEl.classList.add("finished");
    setTimeout(() => introGateEl.remove(), 170);
  }
  introIsStartup = false;
  updateMainSelectionGlow();

  const resolve = introResolve;
  introResolve = null;
  resolve?.();
}

function lockInterface() {
  document.addEventListener("touchmove", event => {
    if (event.target.closest(".main-choice-list, .pin-keypad, .theme-modal-card")) return;
    event.preventDefault();
  }, { passive: false });
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

  mainGlowLight = new THREE.PointLight(0x38d879, 0, 5.2, 2);
  mainGlowLight.position.set(0, 0.25, 2.35);
  scene.add(mainGlowLight);

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

  updateMainSelectionGlow();

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
    const response = await fetch(`/decks/${activeTheme}.json`, { cache: "no-store" });
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
    const strengthVariation = 0.94 + Math.random() * 0.12;
    const timingVariation = (Math.random() - 0.5) * 0.06;

    die.userData.startTime = now;
    die.userData.duration = 1.34 + index * 0.07 + timingVariation;
    die.userData.delay = index * (0.045 + Math.random() * 0.018);
    die.userData.rolling = true;
    die.userData.startRot.copy(die.rotation);
    die.userData.endRot.set(
      p[3] + 4 * Math.PI * 2,
      p[4] + 4 * Math.PI * 2,
      p[5] + 2 * Math.PI * 2
    );

    die.userData.physicsStrength =
      (index === 0 ? 0.72 : 0.54) * strengthVariation;
    die.userData.wobbleAmplitude =
      (index === 0 ? 0.085 : 0.065) * (0.9 + Math.random() * 0.2);
    die.userData.wobbleFrequency = 10.5 + Math.random() * 2.2;
    die.userData.wobblePhase = Math.random() * Math.PI * 2;
  });
}

function landingBounce(progress, strength = 0.54) {
  // Three distinct impacts with diminishing energy.
  if (progress < 0.58) {
    const air = progress / 0.58;
    return Math.sin(air * Math.PI) * strength * 0.86;
  }

  if (progress < 0.77) {
    const bounce1 = (progress - 0.58) / 0.19;
    return Math.sin(bounce1 * Math.PI) * strength * 0.72;
  }

  if (progress < 0.91) {
    const bounce2 = (progress - 0.77) / 0.14;
    return Math.sin(bounce2 * Math.PI) * strength * 0.36;
  }

  const bounce3 = Math.min((progress - 0.91) / 0.09, 1);
  return Math.sin(bounce3 * Math.PI) * strength * 0.14;
}

function landingSquash(progress, index = 0) {
  const impact1 = Math.exp(-Math.pow((progress - 0.58) / 0.020, 2));
  const impact2 = Math.exp(-Math.pow((progress - 0.77) / 0.017, 2));
  const impact3 = Math.exp(-Math.pow((progress - 0.91) / 0.013, 2));

  const amount = (
    impact1 * 0.075 +
    impact2 * 0.034 +
    impact3 * 0.014
  ) * (index === 0 ? 1 : 0.84);

  return {
    y: 1 - amount,
    xz: 1 + amount * 0.64
  };
}

function dampedWobble(progress, amplitude, frequency, phase) {
  // Only start after the main travel phase, then quickly lose energy.
  const start = 0.66;
  if (progress <= start) return 0;
  const local = (progress - start) / (1 - start);
  const damping = Math.exp(-4.8 * local);
  return Math.sin(local * frequency + phase) * amplitude * damping;
}


function animate() {
  requestAnimationFrame(animate);
  const t = performance.now() / 1000;

  if (introActive) {
    const progress = Math.min(
      Math.max((t - introStartTime) / introDuration, 0),
      1
    );

    // Shared canvas falls into the exact final stage rectangle.
    const fallPhase = Math.min(progress / 0.60, 1);
    const gravityDrop = fallPhase * fallPhase;
    const currentTop = lerp(
      introStartTop,
      introTargetRect.top,
      gravityDrop
    );
    sceneWrap.style.top = `${currentTop}px`;
    sceneWrap.style.left = `${introTargetRect.left}px`;

    // ANIMATION A: temporary airborne dice spin only while falling.
    introAirDice.forEach((airDie, index) => {
      const impactStart = airDie.userData.impactStart;
      const targetRotation = airDie.userData.targetRotation;

      if (progress < impactStart) {
        const airProgress = Math.min(progress / impactStart, 1);
        const spinEase = easeInOutCubic(airProgress);

        airDie.rotation.x = lerp(
          airDie.userData.startRotation.x,
          targetRotation.x,
          spinEase
        );
        airDie.rotation.y = lerp(
          airDie.userData.startRotation.y,
          targetRotation.y,
          spinEase
        );
        airDie.rotation.z = lerp(
          airDie.userData.startRotation.z,
          targetRotation.z,
          spinEase
        );
      } else if (airDie.visible) {
        // Exact handoff at contact.
        airDie.rotation.copy(targetRotation);
        airDie.visible = false;

        const landingDie = diceMeshes[index];
        landingDie.visible = true;
        landingDie.position.copy(landingDie.userData.introTargetPosition);
        landingDie.rotation.copy(landingDie.userData.introTargetRotation);
        landingDie.scale.set(1, 1, 1);
        landingDie.userData.introLanded = true;
      }
    });

    // ANIMATION B: real stable dice bounce with rotation fully locked.
    diceMeshes.forEach((die, index) => {
      if (!die.userData.introLanded) return;

      const impactStart = introAirDice[index].userData.impactStart;
      const localImpact = Math.min(
        Math.max((progress - impactStart) / (1 - impactStart), 0),
        1
      );

      let bounce;
      if (localImpact < 0.64) {
        const firstBounce = localImpact / 0.64;
        bounce = Math.sin(firstBounce * Math.PI) *
          die.userData.introPhysicsStrength * 0.74;
      } else {
        const secondBounce = (localImpact - 0.64) / 0.36;
        bounce = Math.sin(secondBounce * Math.PI) *
          die.userData.introPhysicsStrength * 0.27;
      }

      const impactOne = Math.exp(
        -Math.pow((localImpact - 0.015) / 0.026, 2)
      );
      const impactTwo = Math.exp(
        -Math.pow((localImpact - 0.65) / 0.022, 2)
      );
      const amount = (
        impactOne * 0.076 +
        impactTwo * 0.026
      ) * (index === 0 ? 1 : 0.86);

      const squashY = 1 - amount;
      const squashXZ = 1 + amount * 0.62;

      die.position.x = die.userData.introTargetPosition.x;
      die.position.y = die.userData.introTargetPosition.y + bounce;
      die.position.z = die.userData.introTargetPosition.z;

      // Hard lock: no spin, wobble or interpolation after contact.
      die.rotation.copy(die.userData.introTargetRotation);
      die.scale.set(squashXZ, squashY, squashXZ);
    });

    if (progress >= 1) {
      finishIntroRoll();
    }
  } else if (mainDropActive) {
    const progress = Math.min(
      Math.max((t - mainDropStartTime) / mainDropDuration, 0),
      1
    );

    diceMeshes.forEach((die, index) => {
      const impact = die.userData.dropImpact;
      const target = die.userData.dropTargetPosition;
      const targetRotation = die.userData.dropTargetRotation;

      if (progress < impact) {
        const air = progress / impact;
        const gravity = air * air;

        die.position.y = lerp(die.userData.dropStartY, target.y, gravity);
        die.rotation.x = lerp(
          targetRotation.x - Math.PI * 4,
          targetRotation.x,
          easeInOutCubic(air)
        );
        die.rotation.y = lerp(
          targetRotation.y - Math.PI * 2,
          targetRotation.y,
          easeInOutCubic(air)
        );
        die.rotation.z = lerp(
          targetRotation.z - Math.PI * 2,
          targetRotation.z,
          easeInOutCubic(air)
        );
      } else {
        const landed = (progress - impact) / (1 - impact);
        let bounce;

        if (landed < 0.66) {
          bounce = Math.sin((landed / 0.66) * Math.PI) *
            die.userData.dropStrength * 0.72;
        } else {
          bounce = Math.sin(((landed - 0.66) / 0.34) * Math.PI) *
            die.userData.dropStrength * 0.24;
        }

        die.position.set(target.x, target.y + bounce, target.z);
        die.rotation.copy(targetRotation);
      }
    });

    if (progress >= 1) {
      mainDropActive = false;
      diceMeshes.forEach(die => {
        die.position.copy(die.userData.dropTargetPosition);
        die.rotation.copy(die.userData.dropTargetRotation);
        die.scale.set(1, 1, 1);
        die.userData.base.copy(die.userData.dropTargetPosition);
      });
    }
  } else {
    // Existing normal ROLL animation remains unchanged.
    diceMeshes.forEach(die => {
      const u = die.userData;
      if (!u.rolling) return;

      const p = Math.min(
        Math.max((t - u.startTime - u.delay) / u.duration, 0),
        1
      );
      if (p <= 0) return;

      const e = easeInOutCubic(p);

      die.rotation.x = lerp(u.startRot.x, u.endRot.x, e);
      die.rotation.y = lerp(u.startRot.y, u.endRot.y, e);
      die.rotation.z = lerp(u.startRot.z, u.endRot.z, e);

      const index = diceMeshes.indexOf(die);
      const bounce = landingBounce(p, u.physicsStrength);
      const squash = landingSquash(p, index);
      const wobble = dampedWobble(
        p,
        u.wobbleAmplitude,
        u.wobbleFrequency,
        u.wobblePhase
      );

      die.position.y = u.base.y + bounce;
      die.position.x = u.base.x +
        Math.sin(p * Math.PI * 2.7 + index * 0.55) *
        (1 - p) * 0.048;

      die.rotation.x += wobble;
      die.rotation.z -= wobble * 0.72;
      die.scale.set(squash.xz, squash.y, squash.xz);

      if (p >= 1) {
        u.rolling = false;
        const l = u.layout;
        die.rotation.set(l[3], l[4], l[5]);
        die.position.copy(u.base);
        die.scale.set(1, 1, 1);
      }
    });
  }

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
    camera.position.z = 6.55;
    camera.position.y = 6.65;
    camera.lookAt(0, -0.58, 0);
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
  const plan = count === 1
    ? ["main"]
    : count === 2
      ? ["main", "detail"]
      : ["main", "detail", "effect"];

  const chosen = [];
  const chosenWords = new Set();
  const usedFamilies = new Set();

  if (selectedMain !== "Random") {
    const forcedMain = deck.find(
      item => item.slot === "main" && item.word === selectedMain
    );

    if (forcedMain) {
      chosen.push(forcedMain.word);
      chosenWords.add(forcedMain.word);
      usedFamilies.add(getFamily(forcedMain));
    }
  }

  for (let index = chosen.length; index < plan.length; index++) {
    const slot = plan[index];
    let picked = pickForSlot(slot, usedFamilies, chosenWords);
    if (!picked && slot === "effect") {
      picked = pickForSlot("detail", usedFamilies, chosenWords);
    }
    if (!picked && slot === "detail") {
      picked = pickForSlot("main", usedFamilies, chosenWords);
    }
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

function compatibilityMet(item, chosenWords) {
  if (chosenWords.has(item.word)) return false;
  if (!Array.isArray(item.blockedWith) || item.blockedWith.length === 0) return true;
  return !item.blockedWith.some(blockedWord => chosenWords.has(blockedWord));
}

function pickForSlot(slot, usedFamilies, chosenWords = new Set()) {
  const options = deck.filter(item =>
    item.slot === slot &&
    !chosenWords.has(item.word) &&
    !usedFamilies.has(getFamily(item)) &&
    requirementsMet(item, chosenWords) &&
    compatibilityMet(item, chosenWords)
  );
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

function easeOutQuart(x) {
  return 1 - Math.pow(1 - x, 4);
}

function smoothStep(x) {
  return x * x * (3 - 2 * x);
}

function easeInOutCubic(x) {
  return x < 0.5
    ? 4 * x * x * x
    : 1 - Math.pow(-2 * x + 2, 3) / 2;
}
