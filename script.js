import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

let wordCount = 3;
let deck = [];
let secretSequence = "";
let hiddenActive = false;
let mainHintShownAt = 0;
let mainHintDismissBound = false;
let displayedCounterValue = null;
let counterAnimationToken = 0;
let rollInProgress = false;

let currentRoll = [];

// Input layer: user taps are never silently discarded while an animation owns
// the scene. Latest requested count wins; Roll queues at most once.
let pendingDiceCount = null;
let pendingRollRequest = false;
let inputQueueFlushing = false;

// Shake to Roll is an input layer on top of the existing result/landing
// lifecycle. It never generates repeated button Rolls while the device moves.
const SHAKE_STORAGE_KEY = "tattooDiceShakeEnabled";
const SHAKE_START_THRESHOLD = 7.2;
const SHAKE_KEEP_THRESHOLD = 2.8;
const SHAKE_STOP_DELAY_MS = 260;
const SHAKE_START_WINDOW_MS = 190;
const SHAKE_COOLDOWN_MS = 620;
const SHAKE_SUPPORT_TIMEOUT_MS = 2400;
let shakeEnabled = false;
let shakeListenerAttached = false;
let shakeMotionEventSeen = false;
let shakeSupportTimer = null;
let shakeRolling = false;
let shakeFinishing = false;
let shakeIntensity = 0;
let shakeCandidateAt = 0;
let shakeCooldownUntil = 0;
let shakeStopTimer = null;
let shakeGravity = { x: 0, y: 0, z: 0 };

function diceInteractionBusy() {
  return rollInProgress || introActive || snapshotDropActive;
}

function syncDiceCountButtons(targetCount = wordCount) {
  diceOptions.forEach(button => {
    const active = Number(button.dataset.count) === targetCount;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

async function flushPendingDiceInput() {
  if (inputQueueFlushing || diceInteractionBusy()) return;
  inputQueueFlushing = true;

  try {
    if (Number.isInteger(pendingDiceCount) && pendingDiceCount !== wordCount) {
      const nextCount = pendingDiceCount;
      pendingDiceCount = null;
      await transitionDiceCount(nextCount);
    } else {
      pendingDiceCount = null;
    }

    if (!diceInteractionBusy() && pendingRollRequest) {
      pendingRollRequest = false;
      await roll({ countIt: true });
    }
  } finally {
    inputQueueFlushing = false;
    syncDiceCountButtons();

    if (!diceInteractionBusy() && (pendingDiceCount !== null || pendingRollRequest)) {
      queueMicrotask(flushPendingDiceInput);
    }
  }
}

function requestDiceCount(requestedCount) {
  if (![1, 2, 3].includes(requestedCount)) return;

  if (requestedCount === 1 && selectedMain !== "Random") {
    pendingDiceCount = null;
    syncDiceCountButtons();
    showDiceCountNotice("Select 2 or 3 dice.");
    return;
  }

  if (diceInteractionBusy()) {
    pendingDiceCount = requestedCount;
    syncDiceCountButtons(requestedCount);
    return;
  }

  if (requestedCount === wordCount) {
    syncDiceCountButtons();
    registerSecretInput(String(requestedCount));
    return;
  }

  pendingDiceCount = requestedCount;
  flushPendingDiceInput();
}

function requestRoll() {
  closeMainHint();

  if (diceInteractionBusy()) {
    pendingRollRequest = true;
    return;
  }

  pendingRollRequest = true;
  flushPendingDiceInput();
}

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
let introIsStartup = true;
let mainGlowLight = null;
const mainGlowWorldPosition = new THREE.Vector3();
const liveMotionProjected = new THREE.Vector3();
let mainTintProgress = 0;
let mainPlasmaOverlayMesh = null;
let mainPlasmaClock = 0;
let mainPlasmaLastFrameTime = null;
let mainPlasmaPaused = false;
let liveMainAuraTransition = null;

const rollButton = document.getElementById("rollButton");
const diceOptions = document.querySelectorAll(".dice-option");
const counterEl = document.getElementById("counter");
const sceneWrap = document.getElementById("sceneWrap");
const diceStageEl = document.getElementById("diceStage3d");
const mainHintOverlay = document.getElementById("mainHintOverlay");
const mainHintButtonStage = document.getElementById("mainHintButtonStage");
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
const splashProgressBar = document.getElementById("splashProgressBar");
const shakeControl = document.getElementById("shakeControl");
const shakeToggle = document.getElementById("shakeToggle");
const shakeToggleLabel = document.getElementById("shakeToggleLabel");
const shakeStatus = document.getElementById("shakeStatus");

const SECRET_CODE = "332211";
const FANTASY_UNLOCK_CODE = "2311";
const SUPABASE_URL = "https://gkcsiqgsovbbavunibmv.supabase.co";
const SUPABASE_KEY = "sb_publishable_la1MqfOB-NqB0pMK1_ruJg_0UUZKrAV";

let scene, camera, renderer, floor, floorGlow;
let introActive = false;
let introStartTime = 0;
let introResolve = null;
let diceMeshes = [];
let diceShadowMeshes = [];
let groundShadowCanvas = null;
let groundShadowContext = null;
let shadowDieBottomTexture = null;
let floorGlowTexture = null;
const shadowProjectedXAxis = new THREE.Vector3();
const shadowScreenProjection = new THREE.Vector3();
const shadowContactEuler = new THREE.Euler();
const shadowContactQuaternion = new THREE.Quaternion();
const shadowContactAxisX = new THREE.Vector3();
const shadowContactAxisY = new THREE.Vector3();
const shadowContactAxisZ = new THREE.Vector3();
const shadowProjectionVector = new THREE.Vector3();
const SHADOW_CUBE_CORNERS = [
  [-0.5, -0.5, -0.5], [-0.5, -0.5,  0.5],
  [-0.5,  0.5, -0.5], [-0.5,  0.5,  0.5],
  [ 0.5, -0.5, -0.5], [ 0.5, -0.5,  0.5],
  [ 0.5,  0.5, -0.5], [ 0.5,  0.5,  0.5]
];
const GROUNDED_DICE_SCALE = 1.15;
const GROUND_SHADOW_OVERFLOW = 96;
let snapshotDropActive = false;
const diceTextureCache = new Map();
let textureWarmupToken = 0;
let textureWarmupPromise = Promise.resolve();
let diceSlotsInitialized = false;

const DICE_COMPOSITES = {
  1: [
    [0.00, -0.24, 0.34, -0.82, 0.10, 0.00, 2.42]
  ],
  2: [
    // Two dice centered as a pair with enough horizontal clearance for both labels.
    [-1.18, -0.30, 0.38, -0.82, 0.20, -0.06, 1.92],
    [ 1.18, -0.08, -0.52, -0.78,-0.28,  0.10, 1.72]
  ],
  3: [
    // Main pose restored literally from v2.6. Effects stay on the v2.7 system.
    [0.00, -0.34, 0.78, -0.68, 0.00, 0.00, 2.06],
    [-1.84, -0.04, -0.52, -0.66,-0.04, -0.01, 1.66],
    [ 1.84, -0.04, -0.52, -0.66, 0.04,  0.01, 1.66]
  ]
};

// Single source of truth for idle, Roll, Drop, Fall and count transitions.
// No animation is allowed to invent its own final position / rotation / size.
function getDiceComposite(count = wordCount) {
  return DICE_COMPOSITES[count] || DICE_COMPOSITES[3];
}

function getDicePose(index, count = wordCount) {
  return getDiceComposite(count)[index] || null;
}

function getCanonicalDiceSize(die, index = diceMeshes.indexOf(die), count = wordCount) {
  const pose = die?.userData?.layout || getDicePose(index, count);
  return pose?.[6] || 1;
}

function applyCanonicalDicePose(index, count = wordCount) {
  const die = diceMeshes[index];
  const pose = getDicePose(index, count);
  if (!die || !pose) return false;

  die.userData.layout = pose;
  die.userData.diceSize = pose[6];
  die.userData.base.set(pose[0], pose[1], pose[2]);
  die.position.copy(die.userData.base);
  die.rotation.set(pose[3], pose[4], pose[5]);
  die.scale.setScalar(pose[6]);
  return true;
}

function motionSensorsSupported() {
  return window.isSecureContext && typeof window.DeviceMotionEvent !== "undefined";
}

function setShakeInterface(state, message = "") {
  if (!shakeControl || !shakeToggle || !shakeToggleLabel) return;

  // Keep the control visible after startup on every device. If the current
  // browser/context cannot expose motion sensors, tapping it explains why
  // instead of silently removing the feature from the interface.
  shakeControl.hidden = false;
  shakeToggle.classList.toggle("enabled", state === "enabled" || state === "rolling");
  shakeToggle.classList.toggle("detecting", state === "rolling");
  shakeToggle.setAttribute("aria-pressed", String(state === "enabled" || state === "rolling"));
  shakeToggle.disabled = state === "requesting";

  const labels = {
    disabled: "ENABLE SHAKE TO ROLL",
    requesting: "REQUESTING MOTION ACCESS…",
    enabled: "SHAKE TO ROLL: ON",
    rolling: "SHAKING…"
  };
  shakeToggleLabel.textContent = "TOGGLE SHAKE";
  const shakeIsOn = state === "enabled" || state === "rolling";
  shakeToggle.setAttribute("aria-label", `Toggle Shake: ${shakeIsOn ? "on" : "off"}`);
  if (shakeStatus) shakeStatus.textContent = message;
}

function attachShakeListener() {
  if (shakeListenerAttached) return;
  window.addEventListener("devicemotion", handleDeviceMotion, { passive: true });
  shakeListenerAttached = true;
}

function detachShakeListener() {
  clearTimeout(shakeSupportTimer);
  shakeSupportTimer = null;
  if (!shakeListenerAttached) return;
  window.removeEventListener("devicemotion", handleDeviceMotion);
  shakeListenerAttached = false;
}

function verifyShakeSensorStream() {
  clearTimeout(shakeSupportTimer);
  shakeMotionEventSeen = false;
  shakeSupportTimer = setTimeout(() => {
    if (!shakeEnabled || shakeMotionEventSeen) return;

    shakeEnabled = false;
    localStorage.setItem(SHAKE_STORAGE_KEY, "false");
    detachShakeListener();
    const reason = "Shake to Roll isn’t supported on this device.";
    setShakeInterface("disabled", reason);
    showDiceCountNotice(reason);
  }, SHAKE_SUPPORT_TIMEOUT_MS);
}

function getMotionMagnitude(event) {
  const direct = event.acceleration;
  if (
    direct &&
    Number.isFinite(direct.x) &&
    Number.isFinite(direct.y) &&
    Number.isFinite(direct.z)
  ) {
    return Math.hypot(direct.x, direct.y, direct.z);
  }

  const includingGravity = event.accelerationIncludingGravity;
  if (!includingGravity) return 0;

  const x = Number(includingGravity.x) || 0;
  const y = Number(includingGravity.y) || 0;
  const z = Number(includingGravity.z) || 0;
  // High-pass filter for browsers that expose only acceleration including gravity.
  const gravityBlend = 0.82;
  shakeGravity.x = gravityBlend * shakeGravity.x + (1 - gravityBlend) * x;
  shakeGravity.y = gravityBlend * shakeGravity.y + (1 - gravityBlend) * y;
  shakeGravity.z = gravityBlend * shakeGravity.z + (1 - gravityBlend) * z;
  return Math.hypot(x - shakeGravity.x, y - shakeGravity.y, z - shakeGravity.z);
}

function scheduleShakeStop() {
  clearTimeout(shakeStopTimer);
  shakeStopTimer = setTimeout(() => {
    if (shakeRolling) finishShakeRoll();
  }, SHAKE_STOP_DELAY_MS);
}

function handleDeviceMotion(event) {
  shakeMotionEventSeen = true;
  clearTimeout(shakeSupportTimer);
  shakeSupportTimer = null;
  if (!shakeEnabled || document.hidden || shakeFinishing) return;

  const now = performance.now();
  const magnitude = getMotionMagnitude(event);
  shakeIntensity = THREE.MathUtils.lerp(
    shakeIntensity,
    THREE.MathUtils.clamp((magnitude - 1.2) / 13.5, 0, 1),
    magnitude >= SHAKE_KEEP_THRESHOLD ? 0.38 : 0.12
  );

  if (shakeRolling) {
    if (magnitude >= SHAKE_KEEP_THRESHOLD) scheduleShakeStop();
    return;
  }

  if (now < shakeCooldownUntil || magnitude < SHAKE_START_THRESHOLD) return;

  // Two deliberate motion peaks close together prevent a bump or table tap from
  // starting a Roll.
  if (shakeCandidateAt && now - shakeCandidateAt <= SHAKE_START_WINDOW_MS) {
    shakeCandidateAt = 0;
    beginShakeRoll();
  } else {
    shakeCandidateAt = now;
  }
}

function beginShakeRoll() {
  const menuOpen =
    mainModal?.classList.contains("open") ||
    themeModal?.classList.contains("open") ||
    pinModal?.classList.contains("open");
  if (
    !shakeEnabled ||
    shakeRolling ||
    shakeFinishing ||
    diceInteractionBusy() ||
    menuOpen ||
    !deck.length
  ) {
    return;
  }

  shakeRolling = true;
  rollInProgress = true;
  closeMainHint();
  setRollRenderPerformanceMode(true);
  setShakeInterface("rolling", "Keep shaking. Stop to land the dice.");

  const now = performance.now() / 1000;
  const fixedMain = selectedMain !== "Random";
  diceMeshes.forEach((die, index) => {
    const layout = die.userData.layout;
    const keepMainStill = fixedMain && index === 0;
    if (!die.visible || !layout || keepMainStill) {
      die.userData.shakeRolling = false;
      return;
    }

    applyCanonicalDicePose(index, wordCount);
    die.userData.rolling = false;
    die.userData.shakeSettling = false;
    die.userData.shakeRolling = true;
    die.userData.shakeLastTime = now;
    die.userData.shakePhase = Math.random() * Math.PI * 2;
    die.userData.shakeAxisBias = 0.82 + Math.random() * 0.34;
    setDiceShadowState(index, 0.36, true);
  });

  scheduleShakeStop();
}

function startShakeSettleAnimation() {
  const now = performance.now() / 1000;
  const fixedMain = selectedMain !== "Random";
  let maxEndSeconds = 0;

  diceMeshes.forEach((die, index) => {
    const pose = die.userData.layout;
    const keepMainStill = fixedMain && index === 0;
    die.userData.shakeRolling = false;

    if (!die.visible || !pose || keepMainStill) {
      die.userData.shakeSettling = false;
      if (keepMainStill) syncDiceShadow(index, 1, true);
      return;
    }

    const targetQuaternion = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(pose[3], pose[4], pose[5])
    );
    const startQuaternion = die.quaternion.clone().normalize();

    // Quaternions q and -q describe the same pose. Keeping their dot positive
    // guarantees the shortest physical roll into the valid landing face.
    if (startQuaternion.dot(targetQuaternion) < 0) {
      targetQuaternion.set(
        -targetQuaternion.x,
        -targetQuaternion.y,
        -targetQuaternion.z,
        -targetQuaternion.w
      );
    }

    const angle = 2 * Math.acos(
      THREE.MathUtils.clamp(startQuaternion.dot(targetQuaternion), -1, 1)
    );
    const duration = 0.46 + (angle / Math.PI) * 0.24 + index * 0.035;

    // Commit the predetermined result while the die is still visibly moving.
    // Waiting until late in the settle made the face word appear to jump at
    // the very end, even though the roll result itself was already known.
    commitPendingDiceMaterials(die);

    die.userData.shakeSettling = true;
    die.userData.shakeSettleStartQuaternion = startQuaternion;
    die.userData.shakeSettleEndQuaternion = targetQuaternion;
    die.userData.shakeSettleAngle = angle;
    die.userData.shakeSettleAxis = new THREE.Vector3(1.16, 0.91, 0.72).normalize();
    die.userData.shakeSettleOffsetQuaternion = new THREE.Quaternion();
    die.userData.shakeSettleForwardAngle =
      0.34 + Math.min(angle, Math.PI) * 0.04;
    die.userData.startPosition.copy(die.position);
    die.userData.startTime = now;
    die.userData.delay = index * 0.025;
    die.userData.duration = duration;
    die.userData.rolling = false;
    maxEndSeconds = Math.max(maxEndSeconds, die.userData.delay + duration);
  });

  return Math.ceil(maxEndSeconds * 1000);
}

async function finishShakeRoll() {
  if (!shakeRolling || shakeFinishing) return;
  shakeFinishing = true;
  shakeRolling = false;
  clearTimeout(shakeStopTimer);

  try {
    const nextRoll = makeRoll(wordCount);
    currentRoll = nextRoll;
    prepareDiceResult(nextRoll);

    const settleDurationMs = startShakeSettleAnimation();
    await wait(settleDurationMs + 45);
    incrementCounter();
  } catch (error) {
    console.error("Recovered from Shake to Roll error:", error);
    diceMeshes.forEach((die, index) => {
      die.userData.shakeRolling = false;
      die.userData.shakeSettling = false;
      if (die.visible && die.userData.layout) applyCanonicalDicePose(index, wordCount);
    });
  } finally {
    shakeIntensity = 0;
    shakeFinishing = false;
    rollInProgress = false;
    shakeCooldownUntil = performance.now() + SHAKE_COOLDOWN_MS;
    setRollRenderPerformanceMode(false);
    setShakeInterface(shakeEnabled ? "enabled" : "disabled");
    syncDiceCountButtons();
    queueMicrotask(flushPendingDiceInput);
  }
}

async function toggleShakeToRoll() {
  if (!motionSensorsSupported()) {
    const reason = window.isSecureContext
      ? "Shake to Roll isn’t supported on this device."
      : "Shake to Roll requires HTTPS on this device.";
    setShakeInterface("disabled", reason);
    showDiceCountNotice(reason);
    return;
  }

  if (shakeEnabled) {
    shakeEnabled = false;
    localStorage.setItem(SHAKE_STORAGE_KEY, "false");
    detachShakeListener();
    if (shakeRolling) await finishShakeRoll();
    setShakeInterface("disabled", "Shake to Roll is off.");
    return;
  }

  setShakeInterface("requesting");
  try {
    if (typeof DeviceMotionEvent.requestPermission === "function") {
      const permission = await DeviceMotionEvent.requestPermission();
      if (permission !== "granted") throw new Error("Motion permission was not granted");
    }

    shakeEnabled = true;
    localStorage.setItem(SHAKE_STORAGE_KEY, "true");
    attachShakeListener();
    verifyShakeSensorStream();
    setShakeInterface("enabled", "Shake to Roll is ready.");
  } catch (error) {
    console.warn("Shake to Roll unavailable:", error);
    shakeEnabled = false;
    localStorage.setItem(SHAKE_STORAGE_KEY, "false");
    const reason = "Allow Motion & Orientation Access to use Shake to Roll.";
    setShakeInterface("disabled", reason);
    showDiceCountNotice(reason);
  }
}

function initialiseShakeToRoll() {
  // The control must remain interactive even without sensor support so a tap
  // can explain why the feature is unavailable on the current device/context.
  shakeToggle?.addEventListener("click", toggleShakeToRoll);

  if (!motionSensorsSupported()) {
    setShakeInterface("disabled");
    return;
  }

  const previouslyEnabled = localStorage.getItem(SHAKE_STORAGE_KEY) === "true";
  // iOS requires requestPermission() to be called from a fresh user gesture.
  if (previouslyEnabled && typeof DeviceMotionEvent.requestPermission !== "function") {
    shakeEnabled = true;
    attachShakeListener();
    verifyShakeSensorStream();
    setShakeInterface("enabled");
  } else {
    setShakeInterface("disabled");
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && shakeRolling) finishShakeRoll();
  });
}

const layouts = DICE_COMPOSITES; // compatibility alias; do not define poses elsewhere.


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

function updateDiceCountAvailability() {
  diceOptions.forEach(button => {
    const blocksSingleDie = selectedMain !== "Random" && button.dataset.count === "1";
    button.classList.toggle("main-disabled", blocksSingleDie);
    if (blocksSingleDie) {
      button.setAttribute("aria-disabled", "true");
      button.title = "Select 2 or 3 dice";
    } else {
      button.removeAttribute("aria-disabled");
      button.title = `${button.dataset.count} ${button.dataset.count === "1" ? "word" : "words"}`;
    }
  });
  if (selectedMain !== "Random" && pendingDiceCount === 1) pendingDiceCount = null;
  syncDiceCountButtons();
}

function showDiceCountNotice(message) {
  const notice = document.getElementById("diceCountNotice");
  if (!notice) return;

  notice.textContent = message;
  notice.classList.remove("show");
  void notice.offsetWidth;
  notice.classList.add("show");
  clearTimeout(notice._hideTimer);
  notice._hideTimer = setTimeout(() => notice.classList.remove("show"), 1500);
}

function updateActionButtonLabels() {
  const themeLabel = themeButton?.querySelector("span");
  const mainLabel = mainButton?.querySelector("span");

  if (themeLabel) {
    themeLabel.textContent = activeTheme === "fantasy" ? "FANTASY" : "CLASSIC";
  }

  if (mainLabel) {
    mainLabel.textContent = String(selectedMain || "RANDOM").toUpperCase();
  }

  // CLASSIC / FANTASY and RANDOM use the same letter height as ROLL. Longer
  // selected Main names keep the former compact size so they never clip.
  themeButton?.classList.toggle("compact-label", (themeLabel?.textContent.length || 0) > 7);
  mainButton?.classList.toggle("compact-label", (mainLabel?.textContent.length || 0) > 7);

  updateDiceCountAvailability();
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
  bindMainHintDismiss();
}

function mainStorageKey(theme = activeTheme) {
  return `tattooDiceSelectedMain_${theme}`;
}

function loadStoredMain() {
  // Every fresh app launch starts in Random, regardless of a previous session.
  selectedMain = "Random";
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
  warmDiceTextures();
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

const MAIN_VFX_CONFIG = {
  colorHex: 0x35ff83,
  glowLightHex: 0x38d879,
  glowIntensity: 1.15,
  orbBaseRadius: 0.8096
};

const MAIN_PLASMA_COLOR = new THREE.Color(MAIN_VFX_CONFIG.colorHex);
const MAIN_PLASMA_GLOW_INTENSITY = MAIN_VFX_CONFIG.glowIntensity;
const MAIN_ORB_BASE_RADIUS = MAIN_VFX_CONFIG.orbBaseRadius;

function mainVfxRgba(alpha) {
  const hex = MAIN_VFX_CONFIG.colorHex;
  const r = (hex >> 16) & 255;
  const g = (hex >> 8) & 255;
  const b = hex & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

const MAIN_PLASMA_VERTEX_SHADER = `
  uniform float uShellOffset;
  varying vec2 vUv;
  varying vec3 vObjectPosition;
  varying vec3 vObjectNormal;
  varying vec2 vOrbPlanePosition;

  void main() {
    vUv = uv;
    vObjectNormal = normalize(normal);
    // Object-space position is shared by every face of the same cube. Using it
    // as the plasma coordinate makes a vein reach the exact same point on both
    // sides of an edge instead of restarting in each face's separate UV map.
    vObjectPosition = position;

    // Keep the procedural energy almost flush with the body. The small offset
    // only prevents z-fighting; the fragment shading below makes it read as
    // energy trapped beneath a clear resin skin rather than floating outside.
    vec3 shellPosition = position + normal * uShellOffset;
    vec4 viewShellPosition = modelViewMatrix * vec4(shellPosition, 1.0);
    vec3 viewCubeCentre = (modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    float viewObjectScale = max(
      length((modelViewMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz),
      0.0001
    );
    // Camera-facing coordinates around the actual 3D centre of the cube.
    // Dividing out the parent scale keeps the orb identical in 1/2/3 layouts.
    vOrbPlanePosition = (viewShellPosition.xy - viewCubeCentre.xy) / viewObjectScale;
    gl_Position = projectionMatrix * viewShellPosition;
  }
`;

const MAIN_PLASMA_FRAGMENT_SHADER = `
  precision highp float;

  uniform sampler2D baseMap;
  uniform float uTime;
  uniform float uProgress;
  uniform vec3 uColor;
  uniform float uLayer;
  uniform float uBreath;
  uniform float uCoordinateScale;
  varying vec2 vUv;
  varying vec3 vObjectPosition;
  varying vec3 vObjectNormal;
  varying vec2 vOrbPlanePosition;

  float hash31(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }

  float valueNoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float n000 = hash31(i + vec3(0.0, 0.0, 0.0));
    float n100 = hash31(i + vec3(1.0, 0.0, 0.0));
    float n010 = hash31(i + vec3(0.0, 1.0, 0.0));
    float n110 = hash31(i + vec3(1.0, 1.0, 0.0));
    float n001 = hash31(i + vec3(0.0, 0.0, 1.0));
    float n101 = hash31(i + vec3(1.0, 0.0, 1.0));
    float n011 = hash31(i + vec3(0.0, 1.0, 1.0));
    float n111 = hash31(i + vec3(1.0, 1.0, 1.0));

    float nx00 = mix(n000, n100, f.x);
    float nx10 = mix(n010, n110, f.x);
    float nx01 = mix(n001, n101, f.x);
    float nx11 = mix(n011, n111, f.x);
    float nxy0 = mix(nx00, nx10, f.y);
    float nxy1 = mix(nx01, nx11, f.y);
    return mix(nxy0, nxy1, f.z);
  }

  float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.54;
    for (int octave = 0; octave < 4; octave++) {
      value += amplitude * valueNoise(p);
      p = p * 2.03 + vec3(7.1, 3.7, 5.9);
      amplitude *= 0.50;
    }
    return value;
  }

  void main() {
    vec4 face = texture2D(baseMap, vUv);
    float luminance = dot(face.rgb, vec3(0.299, 0.587, 0.114));

    // Protect the printed subject. Plasma is visible only on the pale body of
    // the die, including its softly shaded portions.
    // Keep the black print genuinely black. A deliberately tighter mask also
    // excludes the antialiased grey edge pixels around every letter.
    // Rounded bevel is pale resin too, just shaded darker.
    // Include it while keeping black/near-black lettering excluded.
    float surfaceMask = smoothstep(0.44, 0.80, luminance);

    float time = uTime * (uLayer < 0.5 ? 0.29 : 0.22);
    // Circular flow driver: cos/sin form one continuous orbit instead of a
    // value travelling left and then visibly reversing direction. All plasma
    // offsets below derive from this loop, so the motion has no turn-around
    // point and reads as a continuous circulation through the resin.
    float flowAngle = time * 0.72 + uLayer * 1.91;
    vec3 flowLoop = vec3(
      cos(flowAngle),
      sin(flowAngle),
      sin(flowAngle + 1.5707963)
    );
    vec3 layerOffset = uLayer < 0.5
      ? vec3(0.0, 0.0, 0.0)
      : vec3(4.71, -2.93, 6.18);
    vec3 normalizedObjectPosition = vObjectPosition * uCoordinateScale;
    vec3 p = normalizedObjectPosition * (uLayer < 0.5 ? 1.78 : 1.52) + layerOffset;

    // Two slowly moving three-dimensional noise fields bend the coordinate
    // space itself. This produces rounded, fluid turns rather than straight,
    // graphic cellular borders. Because p is object-space, the warping remains
    // seamless where the front, side and top faces meet.
    vec3 warp = vec3(
      fbm(p * 0.72 + flowLoop * 1.18 + vec3(0.0, 0.0, 1.7)),
      fbm(p * 0.72 + flowLoop.yzx * 1.06 + vec3(-2.3, 0.0, 0.0)),
      fbm(p * 0.72 + flowLoop.zxy * 0.94 + vec3(0.0, 3.1, 0.0))
    ) - 0.5;
    vec3 flowed = p + warp * (uLayer < 0.5 ? 1.34 : 1.58);

    float broadField = fbm(flowed * 0.92 + flowLoop.yzx * 0.44);
    float detailField = fbm(flowed * 1.78 + flowLoop.zxy * 0.31);
    float field = broadField * 0.78 + detailField * 0.22;

    // Contour bands through the warped volume become continuous plasma veins.
    // A second offset contour adds occasional forks without turning the result
    // back into a rigid grid.
    float phase = field * (uLayer < 0.5 ? 6.7 : 5.8)
      + dot(flowLoop, vec3(0.44, 0.31, 0.25)) * (uLayer < 0.5 ? 1.15 : 0.92);
    float distanceToVein = abs(sin(phase));
    // Narrower thresholds create more white space and remove the cellular blob look.
    float mainVein = 1.0 - smoothstep(0.018, uLayer < 0.5 ? 0.135 : 0.105, distanceToVein);

    float branchPhase = (field + detailField * 0.31) * (uLayer < 0.5 ? 9.8 : 8.1)
      + dot(flowLoop.yzx, vec3(0.36, 0.28, 0.22)) * (uLayer < 0.5 ? 1.0 : 0.84)
      + (uLayer < 0.5 ? 1.9 : 4.2);
    float branchDistance = abs(sin(branchPhase));
    float branchVein = 1.0 - smoothstep(0.016, uLayer < 0.5 ? 0.082 : 0.064, branchDistance);
    branchVein *= smoothstep(0.48, 0.76, broadField);

    // Sparse primary currents cross most or all of the die instead of every
    // line closing into a small cell. The low-frequency bend keeps them
    // organic, while object-space coordinates keep them continuous at edges.
    vec3 streamDirection = normalize(uLayer < 0.5
      ? vec3(0.82, 0.31, -0.48)
      : vec3(-0.37, 0.88, 0.29));
    float streamBend = fbm(flowed * 0.43 + flowLoop * 0.23 + vec3(0.0, 0.0, 2.6 + uLayer * 3.1)) - 0.5;
    float streamCoordinate = dot(flowed, streamDirection) + streamBend * 1.34;
    float streamDistance = abs(sin(streamCoordinate * (uLayer < 0.5 ? 2.15 : 1.86) + uLayer * 2.7));
    float longStream = 1.0 - smoothstep(0.018, uLayer < 0.5 ? 0.105 : 0.078, streamDistance);
    float streamGate = smoothstep(0.42, 0.59, fbm(flowed * 0.27 + flowLoop.zxy * 0.16 + vec3(-3.4, 1.8, 0.0)));
    longStream *= mix(0.54, 1.0, streamGate);

    // A second broad current crosses the first one at another angle. Its very
    // low spatial frequency creates large open regions across the whole face
    // instead of allowing many small cells to pile up on one side.
    vec3 crossDirection = normalize(uLayer < 0.5
      ? vec3(-0.26, 0.71, 0.65)
      : vec3(0.74, 0.18, -0.65));
    float crossBend = fbm(flowed * 0.31 + flowLoop.yzx * 0.19 + vec3(0.0, 4.2, 0.0)) - 0.5;
    float crossCoordinate = dot(flowed, crossDirection) + crossBend * 1.10;
    float crossDistance = abs(sin(crossCoordinate * (uLayer < 0.5 ? 1.56 : 1.38) + 1.4 + uLayer));
    float crossStream = 1.0 - smoothstep(0.014, uLayer < 0.5 ? 0.080 : 0.058, crossDistance);
    float crossGate = smoothstep(0.36, 0.57, fbm(flowed * 0.24 + flowLoop * 0.14 + vec3(2.8, -1.6, 0.0)));
    crossStream *= mix(0.42, 0.92, crossGate);

    float veins = clamp(
      mainVein
      + branchVein * (uLayer < 0.5 ? 0.44 : 0.32)
      + longStream * (uLayer < 0.5 ? 0.82 : 0.42)
      + crossStream * (uLayer < 0.5 ? 0.58 : 0.31),
      0.0,
      1.0
    );
    float softHalo = max(
      1.0 - smoothstep(0.11, uLayer < 0.5 ? 0.43 : 0.34, distanceToVein),
      max(longStream * (uLayer < 0.5 ? 0.67 : 0.34), crossStream * (uLayer < 0.5 ? 0.45 : 0.25))
    );
    // One shared irregular breath drives the core, plasma brightness and speed.
    // It is calculated on the CPU from several incommensurate rhythms so the
    // motion never reads as a perfect looping LED pulse.
    float pulse = mix(0.88, 1.12, uBreath);
    veins *= pulse;

    // Internal energy orb. One shared camera-facing plane is centred on the
    // actual object origin, rather than creating a separate projection on each
    // visible face. The orb therefore stays visually suspended in the middle
    // of the complete cube instead of slipping towards its bottom bevel.
    float orbAngle = uTime * 0.34;
    vec2 orbCentre = vec2(
      cos(orbAngle) * 0.040,
      sin(orbAngle) * 0.040
    );
    float orbDistance = length(vOrbPlanePosition - orbCentre);
    float orbRadius = ${MAIN_ORB_BASE_RADIUS.toFixed(3)} * mix(0.92, 1.08, uBreath);
    float orbBody = 1.0 - smoothstep(orbRadius * 0.42, orbRadius, orbDistance);
    float orbCore = 1.0 - smoothstep(0.0, orbRadius * 0.34, orbDistance);
    float orbHalo = 1.0 - smoothstep(orbRadius * 0.58, orbRadius * 1.72, orbDistance);
    orbHalo *= 0.50 + uBreath * 0.24;

    // Energy profile across every vein: green outer glow -> white-hot core ->
    // green outer glow. The narrow white core makes the flow feel luminous,
    // while the green shoulders preserve the Tattoo Dice accent colour.
    float greenShoulder = smoothstep(0.14, 0.55, veins);
    float whiteCore = smoothstep(0.70, 0.965, veins);
    float haloStrength = softHalo * (1.0 - whiteCore) * (uLayer < 0.5 ? 0.30 : 0.18);

    vec3 deepGreen = uColor * 0.36;
    vec3 brightGreen = uColor * 1.28;
    vec3 hotWhite = vec3(1.0, 1.0, 1.0);
    vec3 colour = mix(deepGreen, brightGreen, clamp(greenShoulder + haloStrength, 0.0, 1.0));
    colour = mix(colour, hotWhite, whiteCore);

    // The orb is the source and the plasma is its reaction. The white centre is
    // small and soft; the surrounding green falls away gradually through the
    // resin instead of forming a hard neon circle.
    // Restore enough energy for the core to read through the resin while the
    // plasma brightness remains completely untouched.
    float orbEnergy = 0.86 * clamp(orbBody * 0.88 + orbHalo * 0.48, 0.0, 1.0);
    // Keep the approved size, motion and intensity, but shift the complete orb
    // towards a cleaner white instead of limiting white to its smallest core.
    float orbWhiteMix = clamp(0.72 + orbCore * 0.26, 0.0, 0.98);
    vec3 orbColour = mix(uColor * 0.78, hotWhite * 1.02, orbWhiteMix);
    colour = mix(colour, orbColour, orbEnergy);

    // Keep the white die itself untouched: only the vein and its restrained
    // green halo are drawn by this transparent overlay.
    float layerStrength = uLayer < 0.5 ? 1.0 : 0.42;
    float plasmaAlpha = 0.50 * clamp(haloStrength * 0.42 + greenShoulder * 0.72 + whiteCore * 0.20, 0.0, 0.96);
    float orbAlpha = 0.78 * clamp(orbHalo * 0.38 + orbBody * 0.56 + orbCore * 0.38, 0.0, 0.90);
    float alpha = surfaceMask * uProgress * layerStrength * max(plasmaAlpha, orbAlpha);

    gl_FragColor = vec4(colour, alpha);
  }
`;

function disposeMainPlasmaOverlay() {
  if (!mainPlasmaOverlayMesh) return;
  mainPlasmaOverlayMesh.parent?.remove(mainPlasmaOverlayMesh);
  const disposedTextures = new Set();
  mainPlasmaOverlayMesh.traverse?.(child => {
    if (!child.isMesh && !child.isSprite) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach(material => {
      const map = material?.map;
      if (map && child.isSprite && !disposedTextures.has(map)) {
        map.dispose();
        disposedTextures.add(map);
      }
      material?.dispose();
    });
  });
  mainPlasmaOverlayMesh = null;
}

function createMainPlasmaLayer(mainDie, layerIndex, shellOffset, renderOrder) {
  const plasmaMaterials = mainDie.material.map(sourceMaterial => new THREE.ShaderMaterial({
    uniforms: {
      baseMap: { value: sourceMaterial.map || null },
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uColor: { value: MAIN_PLASMA_COLOR.clone() },
      uLayer: { value: layerIndex },
      uBreath: { value: 0.5 },
      // Slot geometry is unit-sized in v2.10. Parent scale handles 1/2/3
      // layout size, so the internal orb/plasma coordinates are identical in
      // every mode without a mode-specific correction.
      uCoordinateScale: { value: 1.0 },
      uShellOffset: { value: shellOffset }
    },
    vertexShader: MAIN_PLASMA_VERTEX_SHADER,
    fragmentShader: MAIN_PLASMA_FRAGMENT_SHADER,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    polygonOffset: true,
    polygonOffsetFactor: -1 - layerIndex,
    polygonOffsetUnits: -1 - layerIndex,
    toneMapped: false
  }));

  const mesh = new THREE.Mesh(mainDie.geometry, plasmaMaterials);
  mesh.name = layerIndex === 0 ? "main-dice-plasma-primary" : "main-dice-plasma-depth";

  mesh.renderOrder = renderOrder;
  mesh.frustumCulled = false;
  return mesh;
}

function createExternalAuraTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(128, 128, 38, 128, 128, 128);
  // Transparent centre + broad green body + fully feathered perimeter.
  // Because the sprite sits through the cube centre with depth testing enabled,
  // the solid die occludes the middle and only the glow OUTSIDE its silhouette
  // remains visible on screen.
  gradient.addColorStop(0.00, mainVfxRgba(0.00));
  gradient.addColorStop(0.30, mainVfxRgba(0.08));
  gradient.addColorStop(0.52, mainVfxRgba(0.42));
  gradient.addColorStop(0.70, mainVfxRgba(0.28));
  gradient.addColorStop(0.86, mainVfxRgba(0.10));
  gradient.addColorStop(1.00, mainVfxRgba(0.00));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

function ensureMainPlasmaOverlay() {
  // v2.10: build the Main VFX once and keep the resources attached to slot 0.
  // Random mode only hides them; no shader/material construction is allowed
  // to happen on the first Main selection.
  const mainDie = diceMeshes[0];
  if (!mainDie || !Array.isArray(mainDie.material)) return null;

  if (mainPlasmaOverlayMesh?.parent === mainDie) return mainPlasmaOverlayMesh;
  disposeMainPlasmaOverlay();

  const group = new THREE.Group();
  group.name = "main-dice-plasma";

  // Internal plasma/orb remains almost flush with the resin.
  group.add(createMainPlasmaLayer(mainDie, 0, 0.0075, 4));

  // v2.7: the aura is no longer another copy of the cube geometry.
  // It is a soft camera-facing light field centred THROUGH the die. Depth testing
  // lets the opaque cube mask the centre, leaving only a genuine external halo
  // visible beyond the silhouette. This avoids the previous "aura inside resin"
  // look and works consistently for every cube rotation.
  const auraTexture = createExternalAuraTexture();
  const auraLayers = [
    { scale: 1.62, opacity: 0.42, phase: 0.0, orbit: 0.020 },
    { scale: 1.86, opacity: 0.24, phase: 2.1, orbit: 0.030 },
    { scale: 2.12, opacity: 0.12, phase: 4.2, orbit: 0.040 }
  ];

  auraLayers.forEach((layer, index) => {
    const material = new THREE.SpriteMaterial({
      map: auraTexture,
      color: MAIN_VFX_CONFIG.colorHex,
      transparent: true,
      opacity: 0,
      depthTest: true,
      depthWrite: false,

      // Same visible RGB behavior as AdditiveBlending while preserving ordinary
      // framebuffer alpha. Drop/Fall no longer capture these sprites: the same
      // live aura remains active and follows the Main throughout each phase.
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.SrcAlphaFactor,
      blendDst: THREE.OneFactor,
      blendEquationAlpha: THREE.AddEquation,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneMinusSrcAlphaFactor,

      toneMapped: false
    });
    const aura = new THREE.Sprite(material);
    aura.name = `main-dice-external-aura-${index + 1}`;
    const baseSize = layer.scale;
    aura.scale.set(baseSize, baseSize, 1);
    aura.position.set(0, 0, 0);
    aura.userData.auraBaseSize = baseSize;
    aura.userData.auraBaseOpacity = layer.opacity;
    aura.userData.auraPulsePhase = layer.phase;
    aura.userData.auraOrbit = layer.orbit;
    aura.userData.auraTexture = auraTexture;
    aura.renderOrder = 3 + index * 0.01;
    aura.frustumCulled = false;
    group.add(aura);
  });

  mainDie.add(group);
  mainPlasmaOverlayMesh = group;
  return mainPlasmaOverlayMesh;
}

function forEachMainPlasmaMaterial(callback) {
  if (!mainPlasmaOverlayMesh) return;
  mainPlasmaOverlayMesh.traverse(child => {
    if (!child.isMesh) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach(callback);
  });
}

function setMainTintProgress(progress) {
  const active = selectedMain !== "Random";
  mainTintProgress = active ? THREE.MathUtils.clamp(progress, 0, 1) : 0;
  diceStageEl?.classList.toggle("main-selected", active);

  if (mainGlowLight) {
    mainGlowLight.intensity = active
      ? MAIN_PLASMA_GLOW_INTENSITY * mainTintProgress * 0.82
      : 0;
  }

  const plasmaOverlay = ensureMainPlasmaOverlay();
  if (plasmaOverlay) {
    plasmaOverlay.visible = active && mainTintProgress > 0;
    forEachMainPlasmaMaterial(material => {
      material.uniforms.uProgress.value = mainTintProgress;
    });

    // Aura opacity intentionally lives in updateMainPlasmaTime() only.
    // Do not write sprite opacity here: doing so drops the active breath factor
    // during Drop/Idle/Fall handoffs and creates a visible brightness jump.
  }

  // The real die materials remain unchanged. This is important for a seamless
  // drop -> idle -> fall handoff: all three states show the same shader overlay
  // instead of using a separate colour/emissive treatment for the resting die.
  diceMeshes.forEach(mesh => {
    if (!Array.isArray(mesh.material)) return;
    mesh.material.forEach(material => {
      if (!material || !("emissive" in material)) return;
      if (material.userData.mainTintBaseColor) {
        material.color.copy(material.userData.mainTintBaseColor);
      }
      material.emissive.setHex(0x000000);
      material.emissiveIntensity = 0;
      material.needsUpdate = true;
    });
  });
}

function updateMainPlasmaTime(timeSeconds) {
  if (selectedMain === "Random") {
    if (mainPlasmaOverlayMesh) mainPlasmaOverlayMesh.visible = false;
    if (mainGlowLight) mainGlowLight.intensity = 0;
    mainPlasmaLastFrameTime = timeSeconds;
    return;
  }

  if (mainPlasmaLastFrameTime === null) mainPlasmaLastFrameTime = timeSeconds;
  const delta = THREE.MathUtils.clamp(timeSeconds - mainPlasmaLastFrameTime, 0, 0.08);
  mainPlasmaLastFrameTime = timeSeconds;
  if (!mainPlasmaPaused) mainPlasmaClock += delta;

  // Three non-matching rhythms create a slow, organic breath without random
  // jumps. The result remains deterministic, snapshot-safe and cheap.
  const breathRaw =
    Math.sin(mainPlasmaClock * 1.37) * 0.52 +
    Math.sin(mainPlasmaClock * 0.73 + 1.8) * 0.31 +
    Math.sin(mainPlasmaClock * 0.29 + 4.1) * 0.17;
  const breath = THREE.MathUtils.clamp(0.5 + breathRaw * 0.42, 0, 1);

  if (mainPlasmaOverlayMesh) {
    forEachMainPlasmaMaterial(material => {
      // Keep the flow clock monotonic and constant-speed. Modulating the clock
      // by breath made the pattern subtly accelerate/decelerate and could read
      // as a back-and-forth motion. Breath now affects only energy/intensity.
      material.uniforms.uTime.value = mainPlasmaClock;
      material.uniforms.uBreath.value = breath;
    });

    // External aura: continuous circular drift + breathing. No ping-pong.
    // The glow itself stays outside because the solid cube masks the sprite centre.
    mainPlasmaOverlayMesh.children.forEach(child => {
      if (!child.isSprite || !child.userData?.auraBaseSize) return;
      const baseSize = child.userData.auraBaseSize;
      const phase = child.userData.auraPulsePhase || 0;
      const orbit = child.userData.auraOrbit || 0;
      const angle = mainPlasmaClock * 0.42 + phase;
      const wave = 1.0 + Math.sin(mainPlasmaClock * 0.68 + phase) * 0.025 + (breath - 0.5) * 0.055;
      child.scale.set(baseSize * wave, baseSize * (2.0 - wave), 1);
      child.position.set(Math.cos(angle) * orbit, Math.sin(angle) * orbit * 0.72, 0);
      child.material.opacity =
        (child.userData.auraBaseOpacity || 0) *
        mainTintProgress *
        THREE.MathUtils.lerp(0.82, 1.12, breath);
    });
  }

  const active = selectedMain !== "Random" && mainTintProgress > 0;
  if (mainGlowLight) {
    const die = diceMeshes[0];
    if (die) {
      die.getWorldPosition(mainGlowWorldPosition);
      mainGlowLight.position.set(mainGlowWorldPosition.x, mainGlowWorldPosition.y + 0.12, mainGlowWorldPosition.z + 1.45);
    }
    mainGlowLight.intensity = active
      ? MAIN_PLASMA_GLOW_INTENSITY * mainTintProgress * THREE.MathUtils.lerp(0.72, 1.08, breath)
      : 0;
  }
}

function getMainAuraSprites() {
  if (!mainPlasmaOverlayMesh) return [];
  return mainPlasmaOverlayMesh.children.filter(
    child => child.isSprite && child.userData?.auraBaseSize
  );
}

function setMainAuraVisibility(visible) {
  getMainAuraSprites().forEach(aura => {
    aura.visible = visible;
  });
}

function beginLiveMainAuraTransition({ zIndex, transformOrigin = "center center" }) {
  if (liveMainAuraTransition || selectedMain === "Random") return liveMainAuraTransition;

  const canvas = renderer?.domElement;
  const mainDie = diceMeshes[0];
  if (!canvas || !mainDie || !mainPlasmaOverlayMesh || !getMainAuraSprites().length) return null;

  const canvasRect = canvas.getBoundingClientRect();
  if (!canvasRect.width || !canvasRect.height) return null;

  const sourceMaterials = Array.isArray(mainDie.material) ? mainDie.material : [mainDie.material];
  const plasmaMeshes = mainPlasmaOverlayMesh.children.filter(child => child.isMesh);
  const state = {
    canvas,
    canvasParent: canvas.parentNode,
    canvasNextSibling: canvas.nextSibling,
    canvasStyle: canvas.getAttribute("style"),
    diceVisibility: diceMeshes.map(die => die.visible),
    shadowVisibility: diceShadowMeshes.map(shadow => shadow.visible),
    floorVisible: floor?.visible,
    sourceColorWrite: sourceMaterials.map(material => material.colorWrite),
    plasmaVisibility: plasmaMeshes.map(mesh => mesh.visible),
    overlayVisible: mainPlasmaOverlayMesh.visible,
    sourceMaterials,
    plasmaMeshes,
    canvasRect: {
      width: canvasRect.width,
      height: canvasRect.height
    },
    dieTransforms: diceMeshes.map(die => ({
      position: die.position.clone(),
      rotation: die.rotation.clone(),
      scale: die.scale.clone()
    }))
  };

  // Keep the complete resting WebGL composition alive. The support dice now
  // remain in the same framebuffer as the additive Main aura, so the aura sees
  // exactly the same white dice behind it during Drop/Fall as it does in Idle.
  // Only the Main resin colour and its internal plasma/orb are suppressed; the
  // existing DOM Main snapshot supplies those pixels during the transition.
  if (floor) floor.visible = false;
  sourceMaterials.forEach(material => {
    material.colorWrite = false;
  });
  plasmaMeshes.forEach(mesh => {
    mesh.visible = false;
  });
  mainPlasmaOverlayMesh.visible = true;
  setMainAuraVisibility(true);

  renderSceneWithDiceLayers();

  // Keep the canvas fixed at its normal viewport rectangle. Individual live
  // dice transforms are driven from the already-existing DOM animation clocks,
  // so support dice stay in this framebuffer while every motion/timing remains
  // identical to the approved snapshot animation.
  document.body.appendChild(canvas);
  Object.assign(canvas.style, {
    position: "fixed",
    left: `${canvasRect.left}px`,
    top: `${canvasRect.top}px`,
    width: `${canvasRect.width}px`,
    height: `${canvasRect.height}px`,
    margin: "0",
    transform: "none",
    transformOrigin,
    zIndex: String(zIndex),
    pointerEvents: "none"
  });

  liveMainAuraTransition = state;
  return state;
}

function interpolateMotionFrame(frames, progress) {
  const clamped = THREE.MathUtils.clamp(progress ?? 0, 0, 1);
  let from = frames[0];
  let to = frames[frames.length - 1];

  for (let index = 1; index < frames.length; index += 1) {
    if (clamped <= frames[index].offset) {
      from = frames[index - 1];
      to = frames[index];
      break;
    }
  }

  const span = Math.max(0.000001, to.offset - from.offset);
  const local = THREE.MathUtils.clamp((clamped - from.offset) / span, 0, 1);
  return {
    x: THREE.MathUtils.lerp(from.x, to.x, local),
    y: THREE.MathUtils.lerp(from.y, to.y, local),
    rotation: THREE.MathUtils.lerp(from.rotation || 0, to.rotation || 0, local)
  };
}

function cubicBezierProgress(progress, x1, y1, x2, y2) {
  const targetX = THREE.MathUtils.clamp(progress, 0, 1);
  let low = 0;
  let high = 1;
  let t = targetX;

  const sample = (value, control1, control2) => {
    const inverse = 1 - value;
    return 3 * inverse * inverse * value * control1
      + 3 * inverse * value * value * control2
      + value * value * value;
  };

  for (let iteration = 0; iteration < 12; iteration += 1) {
    const sampledX = sample(t, x1, x2);
    if (Math.abs(sampledX - targetX) < 0.0001) break;
    if (sampledX < targetX) low = t;
    else high = t;
    t = (low + high) * 0.5;
  }

  return sample(t, y1, y2);
}

function applyLiveDiceMotion(state, index, motion) {
  const die = diceMeshes[index];
  const base = state?.dieTransforms?.[index];
  const rect = state?.canvasRect;
  if (!die || !base || !rect?.width || !rect?.height || !camera) return;

  liveMotionProjected.copy(base.position).project(camera);
  liveMotionProjected.x += (motion.x / rect.width) * 2;
  liveMotionProjected.y -= (motion.y / rect.height) * 2;
  die.position.copy(liveMotionProjected.unproject(camera));
  die.rotation.copy(base.rotation);
  die.rotation.z += THREE.MathUtils.degToRad(motion.rotation || 0);
  die.scale.copy(base.scale);
}

function runSynchronizedDiceMotions(state, tracks) {
  if (!state || !tracks?.length) return Promise.resolve();

  tracks.forEach(track => {
    track.animation.pause();
    track.animation.currentTime = 0;
  });

  return new Promise(resolve => {
    const startedAt = performance.now();

    const tick = now => {
      const elapsed = now - startedAt;
      let complete = true;

      tracks.forEach(track => {
        const delay = track.delay || 0;
        const duration = Math.max(1, track.duration || 1);
        const raw = THREE.MathUtils.clamp((elapsed - delay) / duration, 0, 1);
        const eased = cubicBezierProgress(raw, ...track.bezier);
        const motion = interpolateMotionFrame(track.frames, eased);

        track.animation.currentTime = Math.min(elapsed, delay + duration);
        applyLiveDiceMotion(state, track.index, motion);
        if (elapsed < delay + duration) complete = false;
      });

      renderSceneWithDiceLayers();

      if (complete) {
        tracks.forEach(track => {
          track.animation.currentTime = (track.delay || 0) + Math.max(1, track.duration || 1);
        });
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  });
}

function endLiveMainAuraTransition({ renderAfterRestore = true } = {}) {
  const state = liveMainAuraTransition;
  if (!state) return;

  const {
    canvas,
    canvasParent,
    canvasNextSibling,
    canvasStyle,
    diceVisibility,
    shadowVisibility,
    floorVisible,
    sourceColorWrite,
    plasmaVisibility,
    overlayVisible,
    sourceMaterials,
    plasmaMeshes,
    dieTransforms
  } = state;

  if (canvasParent) {
    if (canvasNextSibling?.parentNode === canvasParent) {
      canvasParent.insertBefore(canvas, canvasNextSibling);
    } else {
      canvasParent.appendChild(canvas);
    }
  }

  if (canvasStyle === null) canvas.removeAttribute("style");
  else canvas.setAttribute("style", canvasStyle);

  sourceMaterials.forEach((material, index) => {
    material.colorWrite = sourceColorWrite[index];
  });
  plasmaMeshes.forEach((mesh, index) => {
    mesh.visible = plasmaVisibility[index];
  });
  mainPlasmaOverlayMesh.visible = overlayVisible;
  diceMeshes.forEach((die, index) => {
    die.visible = diceVisibility[index];
    const transform = dieTransforms[index];
    if (transform) {
      die.position.copy(transform.position);
      die.rotation.copy(transform.rotation);
      die.scale.copy(transform.scale);
    }
  });
  diceShadowMeshes.forEach((shadow, index) => {
    shadow.visible = shadowVisibility[index];
  });
  if (floor) floor.visible = floorVisible;

  liveMainAuraTransition = null;
  if (renderAfterRestore) renderSceneWithDiceLayers();
}

function pauseMainPlasmaAnimation() {
  mainPlasmaPaused = true;
  updateMainPlasmaTime(performance.now() / 1000);
}

function resumeMainPlasmaAnimation() {
  mainPlasmaPaused = false;
  mainPlasmaLastFrameTime = performance.now() / 1000;
}

function updateMainSelectionGlow() {
  // Selection only toggles VFX/lock state. It never changes the Main's physical
  // material, composite, position, rotation or size.
  const mainDie = diceMeshes[0];
  if (mainDie && Array.isArray(mainDie.material)) {
    mainDie.material.forEach(material => {
      material.transparent = false;
      material.opacity = 1;
      material.depthTest = true;
      material.depthWrite = true;
    });
  }
  setMainTintProgress(selectedMain !== "Random" ? 1 : 0);
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
  if (!deck.length) return;
  if (rollInProgress || introActive || snapshotDropActive) return;

  closeMainHint();

  // A fixed Main already determines the first subject, so a one-die result has
  // no random outcome left. Preserve the former UX by moving an existing
  // one-die composition directly to the minimum valid two-dice composition.
  if (selectedMain !== "Random" && wordCount === 1) {
    // The current one-die Random result must fall out as the unchanged normal
    // die. The newly selected VFX becomes active only for the incoming Main.
    setMainTintProgress(0);
    requestDiceCount(2);
    return;
  }

  const nextRoll = makeRoll(wordCount);

  // Universal slot system: Main selection changes ONLY slot 0.
  // Rear slots, their transforms, materials and textures remain untouched.
  if (typeof nextRoll[0] === "string" && diceMeshes[0]?.userData.layout) {
    currentRoll[0] = nextRoll[0];
    updateSlotFaceTextures(diceMeshes[0], nextRoll[0], diceMeshes[0].userData.layout);
  }

  updateMainSelectionGlow();
  playTopDrop(false);
}




function positionMainHint() {
  if (!hiddenActive || !mainHintOverlay || !mainHintButtonStage || !mainButton) return;

  const rect = mainButton.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  mainHintOverlay.style.setProperty("--main-hint-button-left", `${rect.left}px`);
  mainHintOverlay.style.setProperty("--main-hint-button-width", `${rect.width}px`);
  mainHintOverlay.style.setProperty("--main-hint-button-height", `${rect.height}px`);
  mainHintOverlay.style.setProperty("--main-hint-center-x", `${rect.left + rect.width * 0.5}px`);
  mainHintOverlay.style.setProperty("--main-hint-button-top", `${rect.top}px`);
}

function showMainHint() {
  if (!mainHintOverlay || !mainHintButtonStage || !mainButton) return;

  const clone = mainButton.cloneNode(true);
  clone.removeAttribute("id");
  clone.removeAttribute("aria-haspopup");
  clone.disabled = true;
  clone.tabIndex = -1;
  mainHintButtonStage.replaceChildren(clone);

  hiddenActive = true;
  mainHintShownAt = performance.now();
  mainHintOverlay.classList.add("show");
  mainHintOverlay.setAttribute("aria-hidden", "false");
  positionMainHint();
  requestAnimationFrame(positionMainHint);
}

function closeMainHint() {
  if (!mainHintOverlay) return;
  hiddenActive = false;
  mainHintOverlay.classList.remove("show");
  mainHintOverlay.setAttribute("aria-hidden", "true");
}

function bindMainHintDismiss() {
  if (mainHintDismissBound || !mainHintOverlay) return;
  mainHintDismissBound = true;

  mainHintOverlay.addEventListener("pointerup", event => {
    if (!hiddenActive || performance.now() - mainHintShownAt < 180) return;
    event.preventDefault();
    closeMainHint();
  }, { passive: false });
  window.addEventListener("resize", positionMainHint, { passive: true });
  window.addEventListener("orientationchange", positionMainHint, { passive: true });
}

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

  // Requested startup state: Random every time.
  selectedMain = "Random";
  updateThemeMenu();
  updateActionButtonLabels();

  const splashStarted = performance.now();
  setSplashProgress(8);

  await loadDeck();
  setSplashProgress(24);

  // Move first-use texture work behind the splash.
  await warmDiceTextures({ awaitCompletion: true });
  setSplashProgress(48);

  validateDeckScores();
  buildMainMenu();

  wordCount = 3;
  currentRoll = makeRoll(3);

  // renderDice creates the three permanent slots + hidden Main VFX exactly once.
  renderDice(currentRoll, false);
  diceMeshes.forEach(die => { die.visible = false; });
  diceShadowMeshes.forEach((_, index) => setDiceShadowState(index, 0, false));

  // One deliberate startup compile, never in a Roll/count/Main interaction.
  renderer.compile(scene, camera);
  renderSceneWithDiceLayers();
  setSplashProgress(78);

  // Counter is deliberately non-blocking; the splash cannot get stuck on a network call.
  loadCounter().catch(error => console.warn("Counter load skipped:", error));
  await wait(Math.max(0, 1650 - (performance.now() - splashStarted)));
  setSplashProgress(100);
  await wait(260);

  await animateSplashLogoToHeader();
  await wait(40);

  diceMeshes.forEach((die, index) => {
    die.visible = index < wordCount && Boolean(die.userData.layout);
  });
  await playTopDrop(true);
  setTimeout(() => introGateEl?.remove(), 520);
  incrementCounter().catch(error => console.warn("Counter increment skipped:", error));

  diceOptions.forEach(button => {
    button.addEventListener("click", () => {
      requestDiceCount(Number(button.dataset.count));
    });
  });

  rollButton.addEventListener("click", () => {
    requestRoll();
  });
  initialiseShakeToRoll();

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

    classicThemeChoice?.addEventListener("pointerup", async event => {
      event.preventDefault();
      await selectTheme("classic");
      setThemeModalState(false);
    }, { passive: false });

    fantasyThemeChoice?.addEventListener("pointerup", async event => {
      event.preventDefault();
      if (!fantasyUnlocked) {
        await selectTheme("fantasy");
        return;
      }
      await selectTheme("fantasy");
      setThemeModalState(false);
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
      if (clearButton) pinInput = "";
      else if (backspaceButton) pinInput = pinInput.slice(0, -1);
      else if (pinInput.length < 4) pinInput += digitButton.dataset.pinDigit;
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

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function setSplashProgress(percent) {
  if (splashProgressBar) splashProgressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
}


async function animateSplashLogoToHeader() {
  const splashLogo = document.getElementById("splashLogo");
  const headerLogo = document.querySelector(".app-header h1");
  if (!introGateEl || !splashLogo || !headerLogo) return;

  if (document.fonts?.ready) await document.fonts.ready.catch(() => {});
  await nextPaint(2);

  const from = splashLogo.getBoundingClientRect();
  const to = headerLogo.getBoundingClientRect();
  if (!from.width || !from.height || !to.width || !to.height) return;

  const headerStyle = getComputedStyle(headerLogo);
  const flyer = document.createElement("div");
  flyer.className = "exact-header-logo-flight";
  flyer.innerHTML = headerLogo.innerHTML;
  flyer.setAttribute("aria-hidden", "true");
  Object.assign(flyer.style, {
    position: "fixed",
    left: `${to.left}px`,
    top: `${to.top}px`,
    width: `${to.width}px`,
    height: `${to.height}px`,
    margin: "0",
    padding: "0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
    font: headerStyle.font,
    fontFamily: headerStyle.fontFamily,
    fontSize: headerStyle.fontSize,
    fontWeight: headerStyle.fontWeight,
    lineHeight: headerStyle.lineHeight,
    letterSpacing: headerStyle.letterSpacing,
    color: headerStyle.color,
    textShadow: headerStyle.textShadow,
    WebkitTextStroke: headerStyle.webkitTextStroke,
    whiteSpace: "nowrap",
    zIndex: "700",
    pointerEvents: "none",
    transformOrigin: "center center",
    willChange: "transform"
  });
  document.body.appendChild(flyer);

  const sourceCenterX = from.left + from.width / 2;
  const sourceCenterY = from.top + from.height / 2;
  const targetCenterX = to.left + to.width / 2;
  const targetCenterY = to.top + to.height / 2;
  const dx = sourceCenterX - targetCenterX;
  const dy = sourceCenterY - targetCenterY;
  const sx = from.width / to.width;
  const sy = from.height / to.height;
  const startTransform = `translate3d(${dx}px, ${dy}px, 0) scale(${sx}, ${sy})`;

  flyer.style.transform = startTransform;
  headerLogo.style.opacity = "0";
  splashLogo.style.opacity = "0";
  introGateEl.classList.add("logo-flight");
  await nextPaint(2);

  const logoFlight = flyer.animate([
    { transform: startTransform },
    { transform: "translate3d(0,0,0) scale(1,1)" }
  ], {
    duration: 780,
    easing: "cubic-bezier(.22,.78,.22,1)",
    fill: "forwards"
  });

  await logoFlight.finished.catch(() => {});

  // Atomic handoff: the black splash disappears in the same paint in which
  // the real header becomes visible. The clone remains above both for two
  // complete frames, so there can be no empty or black bridge frame.
  flyer.style.transform = "translate3d(0,0,0) scale(1,1)";
  headerLogo.style.opacity = "1";
  introGateEl.classList.add("finished");
  await nextPaint(2);
  flyer.remove();
}

function nextPaint(frameCount = 1) {
  return new Promise(resolve => {
    const step = () => {
      frameCount -= 1;
      if (frameCount <= 0) resolve();
      else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}


function exitDropOverlay() {
  document.querySelectorAll(".dice-drop-snapshot,.dice-drop-shadow").forEach(node => node.remove());
  document.body.classList.remove("dice-drop-overlay");
}

function captureDieSnapshot(index, { excludeMainAura = false } = {}) {
  if (!renderer || !sceneWrap || !diceMeshes[index]) return null;
  const canvas = renderer.domElement;
  // Size the snapshot against the renderer canvas itself. Using the outer
  // scene wrapper can stretch the captured WebGL frame by a few percent,
  // which caused the visible "popcorn" size jump at handoff.
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;

  const dieVisibility = diceMeshes.map(die => die.visible);
  const shadowVisibility = diceShadowMeshes.map(shadow => shadow.visible);
  const floorVisible = floor?.visible;
  const auraVisibility = excludeMainAura && index === 0
    ? getMainAuraSprites().map(aura => aura.visible)
    : null;

  let dataUrl = null;
  try {
    if (auraVisibility) setMainAuraVisibility(false);
    diceMeshes.forEach((die, dieIndex) => { die.visible = dieIndex === index; });
    diceShadowMeshes.forEach(shadow => { shadow.visible = false; });
    if (floor) floor.visible = false;
    renderSceneWithDiceLayers();
    dataUrl = canvas.toDataURL("image/png");
  } catch (error) {
    console.warn("Die snapshot failed", error);
  } finally {
    if (auraVisibility) {
      getMainAuraSprites().forEach((aura, auraIndex) => {
        aura.visible = auraVisibility[auraIndex];
      });
    }
    diceMeshes.forEach((die, dieIndex) => { die.visible = dieVisibility[dieIndex]; });
    diceShadowMeshes.forEach((shadow, shadowIndex) => { shadow.visible = shadowVisibility[shadowIndex]; });
    if (floor) floor.visible = floorVisible;
    renderSceneWithDiceLayers();
  }

  return dataUrl ? { dataUrl, rect } : null;
}

function captureMainPlasmaSnapshot(index) {
  const die = diceMeshes[index];
  if (!renderer || !sceneWrap || !die || index !== 0 || !mainPlasmaOverlayMesh) return null;

  const sourceMaterials = Array.isArray(die.material) ? die.material : [die.material];
  const previousColorWrite = sourceMaterials.map(material => material.colorWrite);
  const previousPlasmaVisible = mainPlasmaOverlayMesh.visible;

  // Render only the plasma child onto the transparent WebGL canvas. The solid
  // die is deliberately kept out of this capture, so fading the effect can
  // never make the die itself transparent or darken its lettering.
  sourceMaterials.forEach(material => { material.colorWrite = false; });
  mainPlasmaOverlayMesh.visible = true;
  const snapshot = captureDieSnapshot(index, { excludeMainAura: true });
  sourceMaterials.forEach((material, materialIndex) => {
    material.colorWrite = previousColorWrite[materialIndex];
  });
  mainPlasmaOverlayMesh.visible = previousPlasmaVisible;
  renderSceneWithDiceLayers();
  return snapshot;
}










function projectedDieCenter(index) {
  const die = diceMeshes[index];
  const rect = sceneWrap.getBoundingClientRect();
  const point = die.position.clone().project(camera);
  return {
    x: rect.left + (point.x + 1) * 0.5 * rect.width,
    y: rect.top + (1 - point.y) * 0.5 * rect.height
  };
}

function applyDropLandingPose(index) {
  const die = diceMeshes[index];
  const pose = getDicePose(index, wordCount);
  if (!die || !pose) return;

  applyCanonicalDicePose(index, wordCount);
  die.userData.rolling = false;
}

async function animateSingleDieDrop(index, duration = 784) {
  const die = diceMeshes[index];
  const shadowMesh = diceShadowMeshes[index];
  if (!die) return;

  // Keep the proven full-canvas drop animation. Only its final pose is
  // corrected: capture the die at the exact resting transform already used by
  // the normal, stationary scene.
  applyDropLandingPose(index);
  die.visible = true;

  const isSelectedMain = index === 0 && selectedMain !== "Random";
  if (isSelectedMain) {
    setMainTintProgress(1);
    pauseMainPlasmaAnimation();
    updateMainPlasmaTime(performance.now() / 1000);
    renderSceneWithDiceLayers();
    }
  // Aura is deliberately excluded from the DOM snapshot. The one existing live
  // Three.js aura remains attached to the Main and follows these same frames.
  const snapshot = captureDieSnapshot(index, { excludeMainAura: isSelectedMain });
  if (!snapshot) {
    if (isSelectedMain) resumeMainPlasmaAnimation();
    return;
  }
  const image = document.createElement("img");
  image.className = "dice-drop-snapshot";
  image.alt = "";
  image.src = snapshot.dataUrl;

  // Put the snapshot at its first Drop frame before it enters the DOM. Safari
  // can otherwise composite the newly appended image once at its idle position
  // before Web Animations applies the first keyframe.
  const startY = -(snapshot.rect.top + snapshot.rect.height + 220);
  Object.assign(image.style, {
    left: `${snapshot.rect.left}px`,
    top: `${snapshot.rect.top}px`,
    width: `${snapshot.rect.width}px`,
    height: `${snapshot.rect.height}px`,
    zIndex: isSelectedMain ? "652" : "650",
    transform: `translate3d(0,${startY}px,0)`
  });

  document.body.append(image);


  document.body.classList.add("dice-drop-overlay");
  const liveAura = isSelectedMain
    ? beginLiveMainAuraTransition({ zIndex: 651 })
    : null;
  if (!liveAura) die.visible = false;

  // The permanent ground-contact slot fades in beneath the moving snapshot.
  // It is not baked into the snapshot, so the same shadow becomes Idle state
  // without a visual handoff.
  if (shadowMesh) startDiceShadowDrop(index, duration);
  renderSceneWithDiceLayers();

  // Move the complete transparent canvas far enough upward that the die itself
  // starts outside the physical screen. No scale keyframes means no morphing.
  const horizontalWobble = index === 1 ? -8 : index === 2 ? 8 : 5;
  const dropFrames = [
    { transform: `translate3d(0,${startY}px,0)`, offset: 0 },
    { transform: `translate3d(${horizontalWobble}px,${startY * 0.54}px,0)`, offset: 0.42 },
    { transform: `translate3d(${-horizontalWobble * 0.45}px,-14px,0)`, offset: 0.84 },
    { transform: "translate3d(0,7px,0)", offset: 0.94 },
    { transform: "translate3d(0,0,0)", offset: 1 }
  ];
  const liveDropFrames = [
    { x: 0, y: startY, rotation: 0, offset: 0 },
    { x: horizontalWobble, y: startY * 0.54, rotation: 0, offset: 0.42 },
    { x: -horizontalWobble * 0.45, y: -14, rotation: 0, offset: 0.84 },
    { x: 0, y: 7, rotation: 0, offset: 0.94 },
    { x: 0, y: 0, rotation: 0, offset: 1 }
  ];
  const dropOptions = {
    duration,
    easing: "cubic-bezier(.36,.02,.24,1)",
    fill: "forwards"
  };
  const baseDropFrames = dropFrames.map(frame => ({ ...frame, opacity: 1 }));
  const drop = image.animate(baseDropFrames, dropOptions);
  const dropFinished = liveAura
    ? runSynchronizedDiceMotions(liveAura, [{
        animation: drop,
        index,
        frames: liveDropFrames,
        duration,
        delay: 0,
        bezier: [0.36, 0.02, 0.24, 1]
      }])
    : drop.finished.catch(() => {});

  await dropFinished;

  // Atomic handoff: remove the DOM snapshot before revealing the real mesh,
  // then render both changes in the same JavaScript turn. The browser therefore
  // never paints the snapshot and the Three.js die on top of each other.
  applyDropLandingPose(index);
  if (isSelectedMain) setMainTintProgress(1);
  image.remove();
  if (liveAura) endLiveMainAuraTransition({ renderAfterRestore: false });
  die.visible = true;
  syncDiceShadow(index, 1, true);
  renderSceneWithDiceLayers();
  if (isSelectedMain) resumeMainPlasmaAnimation();
}

function captureVisibleDiceCover({ excludeMainAura = false } = {}) {
  if (!renderer?.domElement) return null;
  const canvas = renderer.domElement;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;

  const auraVisibility = excludeMainAura
    ? getMainAuraSprites().map(aura => aura.visible)
    : null;
  let dataUrl = null;
  try {
    if (auraVisibility) setMainAuraVisibility(false);
    renderSceneWithDiceLayers();
    dataUrl = canvas.toDataURL("image/png");
  } catch (error) {
    console.warn("Dice cover snapshot failed", error);
  } finally {
    if (auraVisibility) {
      getMainAuraSprites().forEach((aura, auraIndex) => {
        aura.visible = auraVisibility[auraIndex];
      });
    }
    renderSceneWithDiceLayers();
  }
  if (!dataUrl) return null;

  const image = document.createElement("img");
  image.className = "dice-drop-snapshot dice-exit-capture-cover";
  image.alt = "";
  image.src = dataUrl;
  Object.assign(image.style, {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    zIndex: "653"
  });
  document.body.append(image);
  return image;
}

function waitForPaintFrames(count = 2) {
  return new Promise(resolve => {
    const step = () => {
      count -= 1;
      if (count <= 0) resolve();
      else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

async function playCountSelectionExit() {
  if (!diceMeshes.length) return;

  // Fall starts with the existing contact and releases it quickly. A selected
  // Main keeps this same live shadow in the WebGL lifecycle as its aura.
  diceShadowMeshes.forEach((shadow, index) => {
    if (shadow.visible) startDiceShadowFall(index, 150);
  });
  renderSceneWithDiceLayers();

  // Keep one unchanged full-scene frame over the visible WebGL canvas while
  // individual die snapshots are captured. captureDieSnapshot temporarily
  // isolates each mesh; without this cover those internal capture renders can
  // become visible as a one-frame blink immediately before the fall.
  const canvas = renderer?.domElement || null;
  const hasLiveMainAura =
    selectedMain !== "Random" &&
    mainTintProgress > 0 &&
    diceMeshes[0]?.visible;
  if (hasLiveMainAura) {
    setMainTintProgress(1);
    pauseMainPlasmaAnimation();
    updateMainPlasmaTime(performance.now() / 1000);
    renderSceneWithDiceLayers();
  }
  const cover = captureVisibleDiceCover({ excludeMainAura: hasLiveMainAura });
  const previousCanvasVisibility = canvas?.style.visibility || "";
  if (cover && canvas) {
    // Data-URL images can be appended before their first composited frame.
    // Hiding WebGL in the same task caused the single pre-fall flash on iOS.
    // Two RAFs guarantees a painted cover without using image.decode(), which
    // previously proved unsafe for this PWA startup path.
    await waitForPaintFrames(2);
    if (!hasLiveMainAura) canvas.style.visibility = "hidden";
  }

  const snapshots = [];
  diceMeshes.forEach((die, index) => {
    if (!die.visible) return;
    const isSelectedMain = index === 0 && selectedMain !== "Random";

    const snapshot = captureDieSnapshot(index, { excludeMainAura: isSelectedMain });
    if (!snapshot) return;

    const image = document.createElement("img");
    image.className = "dice-drop-snapshot dice-count-exit-snapshot";
    image.alt = "";
    image.src = snapshot.dataUrl;
    Object.assign(image.style, {
      left: `${snapshot.rect.left}px`,
      top: `${snapshot.rect.top}px`,
      width: `${snapshot.rect.width}px`,
      height: `${snapshot.rect.height}px`,
      transformOrigin: "50% 58%",
      opacity: "1",
      // Preserve the resting scene hierarchy during the DOM-snapshot exit:
      // the main/middle die must stay above both rear dice for every frame.
      zIndex: index === 0 ? "652" : "650"
    });
    document.body.append(image);


    snapshots.push({ image, index, rect: snapshot.rect, isSelectedMain });
  });

  if (!snapshots.length) {
    cover?.remove();
    if (canvas) canvas.style.visibility = previousCanvasVisibility;
    resumeMainPlasmaAnimation();
    return;
  }

  document.body.classList.add("dice-drop-overlay");
  const liveAura = hasLiveMainAura
    ? beginLiveMainAuraTransition({ zIndex: 651, transformOrigin: "50% 58%" })
    : null;
  if (!liveAura) {
    diceMeshes.forEach(die => { die.visible = false; });
    diceShadowMeshes.forEach((_, index) => setDiceShadowState(index, 0, false));
    renderSceneWithDiceLayers();
  } else {
    // Support dice are now the real live meshes in the same framebuffer as
    // the aura. Their old DOM snapshots remain only as invisible animation
    // clocks, preventing duplicate/brighter dice during the Fall.
    snapshots.forEach(({ image, isSelectedMain }) => {
      if (!isSelectedMain) image.style.visibility = "hidden";
    });
  }

  // Ensure the individual snapshots themselves have reached the compositor
  // before removing the full-scene cover. This closes the second possible
  // one-frame gap in the fall handoff.
  await waitForPaintFrames(2);

  // The animated exit snapshots are now ready. Swap them atomically for the
  // temporary cover and reveal the already-cleared WebGL canvas underneath.
  cover?.remove();
  if (canvas && !liveAura) canvas.style.visibility = previousCanvasVisibility;

  const animations = [];
  const synchronizedTracks = [];
  snapshots.forEach(({ image, index, rect, isSelectedMain }) => {
    const direction = index === 1 ? -1 : 1;
    const travelY = window.innerHeight - rect.top + rect.height + 180;
    const travelX = direction * (18 + index * 7);
    const rotation = direction * (16 + index * 5);
    const movementFrames = [
      { transform: "translate3d(0,0,0) rotate(0deg)", opacity: 1, offset: 0 },
      { transform: `translate3d(${travelX * 0.18}px,18px,0) rotate(${rotation * 0.15}deg)`, opacity: 1, offset: 0.18 },
      { transform: `translate3d(${travelX * 0.52}px,${travelY * 0.38}px,0) rotate(${rotation * 0.58}deg)`, opacity: 1, offset: 0.55 },
      { transform: `translate3d(${travelX}px,${travelY}px,0) rotate(${rotation}deg)`, opacity: 0.96, offset: 1 }
    ];
    const liveMovementFrames = [
      { x: 0, y: 0, rotation: 0, offset: 0 },
      { x: travelX * 0.18, y: 18, rotation: rotation * 0.15, offset: 0.18 },
      { x: travelX * 0.52, y: travelY * 0.38, rotation: rotation * 0.58, offset: 0.55 },
      { x: travelX, y: travelY, rotation, offset: 1 }
    ];
    const options = {
      duration: 434,
      delay: index * 24,
      easing: "cubic-bezier(.42,0,.82,.54)",
      fill: "forwards"
    };
    const baseMovementFrames = movementFrames.map(frame => ({ ...frame, opacity: 1 }));
    const movement = image.animate(baseMovementFrames, options);
    animations.push(movement);
    if (liveAura) {
      synchronizedTracks.push({
        animation: movement,
        index,
        frames: liveMovementFrames,
        duration: options.duration,
        delay: options.delay,
        bezier: [0.42, 0, 0.82, 0.54]
      });
    }
  });

  if (liveAura) {
    await runSynchronizedDiceMotions(liveAura, synchronizedTracks);
  } else {
    await Promise.all(animations.map(animation => animation.finished.catch(() => {})));
  }
  snapshots.forEach(({ image }) => image.remove());
  if (liveAura) endLiveMainAuraTransition({ renderAfterRestore: false });
  document.body.classList.remove("dice-drop-overlay");
  resumeMainPlasmaAnimation();
}

async function transitionDiceCount(requestedCount) {
  if (![1, 2, 3].includes(requestedCount)) return;

  if (requestedCount === wordCount) {
    syncDiceCountButtons();
    return;
  }

  if (rollInProgress || introActive || snapshotDropActive) {
    pendingDiceCount = requestedCount;
    return;
  }

  introIsStartup = false;
  introActive = true;
  snapshotDropActive = true;

  try {
    await playCountSelectionExit();

    const resizedRoll = currentRoll.slice(0, requestedCount);
    if (resizedRoll.length < requestedCount) {
      const generatedRoll = makeRoll(requestedCount);
      for (let index = resizedRoll.length; index < requestedCount; index++) {
        if (typeof generatedRoll[index] === "string") resizedRoll.push(generatedRoll[index]);
      }
    }

    wordCount = requestedCount;
    currentRoll = resizedRoll;
    renderDice(currentRoll, false);

    diceMeshes.forEach(die => { die.visible = false; });
    diceShadowMeshes.forEach((_, index) => setDiceShadowState(index, 0, false));
    renderSceneWithDiceLayers();

    // playTopDrop refuses to start while introActive is true, so hand over the
    // scene lock explicitly between fall and drop.
    snapshotDropActive = false;
    introActive = false;

    await playTopDrop(false);

    diceMeshes.forEach((die, index) => {
      const active = index < wordCount && Boolean(getDicePose(index, wordCount));
      die.visible = active;
      if (!active && diceShadowMeshes[index]) diceShadowMeshes[index].visible = false;
    });
    renderSceneWithDiceLayers();

    registerSecretInput(String(wordCount));
  } catch (error) {
    console.error("Recovered from dice-count transition error:", error);
  } finally {
    snapshotDropActive = false;
    introActive = false;
    document.body.classList.remove("dice-drop-overlay");
    syncDiceCountButtons();
    queueMicrotask(flushPendingDiceInput);
  }
}

function enforceActiveDiceSlots() {
  for (let index = 0; index < diceMeshes.length; index++) {
    const die = diceMeshes[index];
    const shadow = diceShadowMeshes[index];
    const pose = getDicePose(index, wordCount);
    const active = index < wordCount && Boolean(pose);

    if (!active) {
      die.visible = false;
      die.userData.rolling = false;
      die.userData.layout = null;
      if (shadow) shadow.visible = false;
      continue;
    }

    // Visibility/state invariant only. Animation owns transforms while active.
    if (!introActive && !die.userData.rolling) {
      applyCanonicalDicePose(index, wordCount);
    }
  }
}

async function playTopDrop(isStartup = false) {
  if (!diceMeshes.length || introActive) return;

  introIsStartup = isStartup;
  introActive = true;
  snapshotDropActive = true;

  const sequence = wordCount === 3 ? [1, 2, 0]
    : wordCount === 2 ? [1, 0]
      : [0];

  try {
    setMainTintProgress(selectedMain !== "Random" ? 1 : 0);

    diceMeshes.forEach((die, index) => {
      const active = index < wordCount && Boolean(die.userData.layout);
      die.visible = false;
      die.userData.rolling = false;
      setDiceShadowState(index, 0, false);

      if (!active) {
        die.userData.layout = null;
        if (diceShadowMeshes[index]) diceShadowMeshes[index].visible = false;
      }
    });
    renderSceneWithDiceLayers();

    for (const index of sequence) {
      if (index >= wordCount || !diceMeshes[index]?.userData.layout) continue;
      await animateSingleDieDrop(index, 784);
      await wait(70);
    }
  } catch (error) {
    console.error("Recovered from dice drop error:", error);
  } finally {
    diceMeshes.forEach((die, index) => {
      const active = index < wordCount && Boolean(getDicePose(index, wordCount));
      die.visible = active;
      die.userData.rolling = false;

      if (active) {
        applyCanonicalDicePose(index, wordCount);
        syncDiceShadow(index, 1, true);
      } else if (diceShadowMeshes[index]) {
        diceShadowMeshes[index].visible = false;
      }
    });

    if (selectedMain !== "Random") {
      setMainTintProgress(1);
      resumeMainPlasmaAnimation();
    }

    snapshotDropActive = false;
    introActive = false;
    document.body.classList.remove("dice-drop-overlay");
    renderSceneWithDiceLayers();
    syncDiceCountButtons();
    queueMicrotask(flushPendingDiceInput);
  }
}

function finishIntroRoll() {
  // Freeze every die at the exact final subject/face before the overlay is
  // removed. There is deliberately no extra spin or settling phase here.
  diceMeshes.forEach((die, index) => {
    const target = die.userData.dropTargetPosition;
    const rotation = die.userData.dropTargetRotation;
    if (target) die.position.copy(target);
    if (rotation) die.rotation.copy(rotation);
    die.scale.setScalar(getCanonicalDiceSize(die, index));
    syncDiceShadow(index, 1, true);
  });
  renderSceneWithDiceLayers();

  introActive = false;
  exitDropOverlay();

  // Re-apply the canonical stage coordinates immediately after restoring the
  // original renderer/camera. These coordinates represent the same visual
  // landing pose and prevent a second, visible correction animation.
  diceMeshes.forEach((die, index) => {
    if (index >= wordCount || !getDicePose(index, wordCount)) return;
    applyCanonicalDicePose(index, wordCount);
    die.userData.rolling = false;
    syncDiceShadow(index, 1, true);
  });
  renderSceneWithDiceLayers();

  const resolve = introResolve;
  introResolve = null;
  if (resolve) resolve();
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

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  // Cap DPR at 2.0. The previous 2.5 cap made the normal roll noticeably
  // fill-rate heavy on high-DPI phones, especially while the internal plasma
  // remains visible on a locked Main die. 2.0 keeps the premium edge quality
  // while cutting the number of shaded pixels substantially.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.0));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.00; // premium-toy sidequest: gentler highlight rolloff
  // All visible shadows are the custom contact-shadow meshes below. Keeping a
  // WebGL shadow map enabled added GPU work every frame without changing the
  // approved look, so leave it off for smoother mobile rolls.
  renderer.shadowMap.enabled = false;
  ensureGroundShadowLayer();
  sceneWrap.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xfffbf2, 1.48));

  const key = new THREE.DirectionalLight(0xfff4df, 1.72);
  // Permanent dice-light rule: all directional illumination originates
  // directly above the centre of the dice composition.
  key.position.set(0, 10.5, 0);
  key.castShadow = false;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xe8efff, 0.38);
  fill.position.set(0, 7.5, 0);
  scene.add(fill);

  mainGlowLight = new THREE.PointLight(MAIN_VFX_CONFIG.glowLightHex, 0, 5.2, 2);
  mainGlowLight.position.set(0, 0.25, 2.35);
  scene.add(mainGlowLight);

  floor = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 12),
    new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.20 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.58;
  floor.receiveShadow = true;
  scene.add(floor);

  // Step 5.10.14c: do not add the warm floor-glow plane.
  // Its additive #fff8e8 texture was clipped by the WebGL canvas and produced
  // a visible horizontal colour seam where the dice stage ended.
  floorGlow = null;

  resizeRenderer();
  animate();
}


function makeFloorGlowTexture() {
  if (floorGlowTexture) return floorGlowTexture;

  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(256, 128, 4, 256, 128, 246);
  gradient.addColorStop(0.00, "rgba(255,248,232,0.40)");
  gradient.addColorStop(0.36, "rgba(255,248,232,0.18)");
  gradient.addColorStop(0.72, "rgba(255,248,232,0.05)");
  gradient.addColorStop(1.00, "rgba(255,248,232,0.00)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  floorGlowTexture = new THREE.CanvasTexture(canvas);
  floorGlowTexture.colorSpace = THREE.SRGBColorSpace;
  return floorGlowTexture;
}

function makeShadowDieBottomTexture() {
  if (shadowDieBottomTexture) return shadowDieBottomTexture;

  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");

  // One blurred rounded-square pass. Keeping transparent canvas around the
  // path prevents the plane edge from becoming a visible rectangle.
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const inset = 92;
  const radius = 92;
  const x = inset;
  const y = inset;
  const w = canvas.width - inset * 2;
  const h = canvas.height - inset * 2;
  ctx.save();
  ctx.filter = "blur(40px)";
  ctx.fillStyle = "rgba(0,0,0,0.72)";
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  shadowDieBottomTexture = new THREE.CanvasTexture(canvas);
  shadowDieBottomTexture.colorSpace = THREE.SRGBColorSpace;
  return shadowDieBottomTexture;
}

function makeProjectedGroundContactGeometry() {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(18 * 3);
  const attribute = new THREE.BufferAttribute(positions, 3);
  attribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("position", attribute);
  geometry.setDrawRange(0, 0);
  return geometry;
}

function shadowCross(origin, a, b) {
  return (a.x - origin.x) * (b.z - origin.z)
    - (a.z - origin.z) * (b.x - origin.x);
}

function updateProjectedGroundContact(
  shadow,
  quaternion,
  scaleX,
  scaleY,
  scaleZ,
  featherScaleX,
  featherScaleZ
) {
  const core = shadow.userData.coreMesh;
  const feather = shadow.userData.featherMesh;
  const points = shadow.userData.projectedPoints;
  if (!core || !feather || !points) return;

  SHADOW_CUBE_CORNERS.forEach((corner, index) => {
    shadowProjectionVector
      .set(corner[0] * scaleX, corner[1] * scaleY, corner[2] * scaleZ)
      .applyQuaternion(quaternion);
    points[index].x = shadowProjectionVector.x;
    points[index].z = shadowProjectionVector.z;
  });

  points.sort((a, b) => a.x === b.x ? a.z - b.z : a.x - b.x);
  const lower = shadow.userData.lowerHull;
  const upper = shadow.userData.upperHull;
  lower.length = 0;
  upper.length = 0;

  points.forEach(point => {
    while (
      lower.length >= 2
      && shadowCross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0
    ) {
      lower.pop();
    }
    lower.push(point);
  });

  for (let index = points.length - 1; index >= 0; index -= 1) {
    const point = points[index];
    while (
      upper.length >= 2
      && shadowCross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0
    ) {
      upper.pop();
    }
    upper.push(point);
  }

  lower.pop();
  upper.pop();
  const hull = shadow.userData.projectedHull;
  hull.length = 0;
  hull.push(...lower, ...upper);

  const attribute = core.geometry.getAttribute("position");
  const positions = attribute.array;
  let vertexOffset = 0;
  for (let index = 1; index < hull.length - 1; index += 1) {
    [hull[0], hull[index], hull[index + 1]].forEach(point => {
      positions[vertexOffset++] = point.x;
      positions[vertexOffset++] = 0;
      positions[vertexOffset++] = point.z;
    });
  }
  positions.fill(0, vertexOffset);
  core.geometry.setDrawRange(0, vertexOffset / 3);
  attribute.needsUpdate = true;

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  hull.forEach(point => {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minZ = Math.min(minZ, point.z);
    maxZ = Math.max(maxZ, point.z);
  });

  // The feather is deliberately larger than the projected solid underside.
  // Its texture supplies the rounded, soft edge while the polygon supplies the
  // continuously changing Roll silhouette.
  const width = Math.max(0.01, maxX - minX);
  const depth = Math.max(0.01, maxZ - minZ);
  feather.position.x = (minX + maxX) * 0.5;
  feather.position.z = (minZ + maxZ) * 0.5;
  feather.scale.set(width * featherScaleX, depth * featherScaleZ, 1);
}

function ensureGroundShadowLayer() {
  if (groundShadowCanvas || !diceStageEl) return groundShadowCanvas;
  groundShadowCanvas = document.createElement("canvas");
  groundShadowCanvas.className = "dice-ground-shadow-canvas";
  groundShadowCanvas.setAttribute("aria-hidden", "true");
  groundShadowContext = groundShadowCanvas.getContext("2d");
  diceStageEl.insertBefore(groundShadowCanvas, sceneWrap);
  return groundShadowCanvas;
}

function projectShadowPointToStage(x, y, z, canvasRect, stageRect, scaleX, scaleY) {
  shadowScreenProjection.set(x, y, z).project(camera);
  const screenX = canvasRect.left + (shadowScreenProjection.x + 1) * 0.5 * canvasRect.width;
  const screenY = canvasRect.top + (1 - shadowScreenProjection.y) * 0.5 * canvasRect.height;
  return {
    x: (screenX - stageRect.left) * scaleX,
    y: (screenY - stageRect.top) * scaleY
  };
}

function traceShadowCore(context, shadow, canvasRect, stageRect, scaleX, scaleY) {
  return traceScaledShadowCore(
    context,
    shadow,
    canvasRect,
    stageRect,
    scaleX,
    scaleY,
    1
  );
}

function traceScaledShadowCore(
  context,
  shadow,
  canvasRect,
  stageRect,
  scaleX,
  scaleY,
  footprintScale = 1
) {
  const hull = shadow.userData.projectedHull;
  if (!hull?.length) return false;
  const center = hull.reduce(
    (total, point) => ({ x: total.x + point.x, z: total.z + point.z }),
    { x: 0, z: 0 }
  );
  center.x /= hull.length;
  center.z /= hull.length;

  const projectedPoints = hull.map(point => {
    const scaledX = center.x + (point.x - center.x) * footprintScale;
    const scaledZ = center.z + (point.z - center.z) * footprintScale;
    return projectShadowPointToStage(
      shadow.position.x + scaledX,
      shadow.position.y,
      shadow.position.z + scaledZ,
      canvasRect,
      stageRect,
      scaleX,
      scaleY
    );
  });
  if (projectedPoints.length < 3) return false;

  // Round the projected underside itself. The corner distance is relative to
  // both neighbouring edges, so the radius remains natural while the shadow
  // changes shape during Roll.
  const roundedCorners = projectedPoints.map((point, index) => {
    const previous = projectedPoints[(index - 1 + projectedPoints.length) % projectedPoints.length];
    const next = projectedPoints[(index + 1) % projectedPoints.length];
    const previousLength = Math.hypot(previous.x - point.x, previous.y - point.y);
    const nextLength = Math.hypot(next.x - point.x, next.y - point.y);
    const radius = Math.min(previousLength, nextLength) * 0.22;
    return {
      point,
      start: {
        x: point.x + ((previous.x - point.x) / Math.max(previousLength, 0.0001)) * radius,
        y: point.y + ((previous.y - point.y) / Math.max(previousLength, 0.0001)) * radius
      },
      end: {
        x: point.x + ((next.x - point.x) / Math.max(nextLength, 0.0001)) * radius,
        y: point.y + ((next.y - point.y) / Math.max(nextLength, 0.0001)) * radius
      }
    };
  });

  context.beginPath();
  context.moveTo(roundedCorners[0].start.x, roundedCorners[0].start.y);
  roundedCorners.forEach((corner, index) => {
    if (index > 0) context.lineTo(corner.start.x, corner.start.y);
    context.quadraticCurveTo(
      corner.point.x,
      corner.point.y,
      corner.end.x,
      corner.end.y
    );
  });
  context.closePath();
  return true;
}

function renderGroundShadowLayer() {
  if (!groundShadowCanvas || !groundShadowContext || !renderer || !camera || !diceStageEl) return;

  const stageRect = diceStageEl.getBoundingClientRect();
  const canvasRect = renderer.domElement.getBoundingClientRect();
  const localWidth = diceStageEl.clientWidth;
  const localHeight = diceStageEl.clientHeight;
  if (!stageRect.width || !stageRect.height || !canvasRect.width || !canvasRect.height) return;

  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const overlayHeight = localHeight + GROUND_SHADOW_OVERFLOW;
  const targetWidth = Math.max(1, Math.round(localWidth * pixelRatio));
  const targetHeight = Math.max(1, Math.round(overlayHeight * pixelRatio));
  if (groundShadowCanvas.width !== targetWidth || groundShadowCanvas.height !== targetHeight) {
    groundShadowCanvas.width = targetWidth;
    groundShadowCanvas.height = targetHeight;
    groundShadowCanvas.style.height = `${overlayHeight}px`;
  }

  const context = groundShadowContext;
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, localWidth, overlayHeight);
  const scaleX = localWidth / stageRect.width;
  const scaleY = localHeight / stageRect.height;

  diceShadowMeshes.forEach(shadow => {
    if (!shadow?.visible) return;
    const strength = THREE.MathUtils.clamp(
      shadow.userData.visualOpacity || 0,
      0,
      1
    );
    if (strength <= 0) return;

    // The feather uses the exact same projected underside as the square core.
    // At 1.4× total size it adds precisely one fifth of the original footprint
    // to the top, bottom, left and right. Twenty bands fade the edge to zero.
    const blurRadius = Math.max(12, Math.min(26, localWidth * 0.046));
    context.save();
    context.fillStyle = "#000000";
    context.globalAlpha = 0.42 * strength;
    context.filter = `blur(${blurRadius}px)`;
    if (
      traceScaledShadowCore(
        context,
        shadow,
        canvasRect,
        stageRect,
        scaleX,
        scaleY,
        1.17
      )
    ) {
      context.fill();
    }
    context.restore();
  });
}

function placeShadowDieBottom(shadow, die) {
  if (!shadow || !die) return;

  // Keep the contact plate directly below the die's world position. Moving it
  // to the rotated underside centre shifts it sideways on pitched dice and
  // creates a visible gap, making the die appear to float even more.
  shadow.position.x = die.position.x;
  shadow.position.z = die.position.z;

  // The plate stays flat on the floor and only follows the die's horizontal
  // heading. Pitch and roll must not move the resting contact shadow sideways.
  shadowProjectedXAxis.set(1, 0, 0).applyQuaternion(die.quaternion);
  shadowProjectedXAxis.y = 0;
  if (shadowProjectedXAxis.lengthSq() > 0.000001) {
    shadowProjectedXAxis.normalize();
    shadow.rotation.z = -Math.atan2(shadowProjectedXAxis.z, shadowProjectedXAxis.x);
  }
}

function createShadowDieBottom(layout, index) {
  const size = layout[6];
  const footprintWidth = size * 1.78;
  const footprintDepth = size * 1.24;
  const material = new THREE.MeshBasicMaterial({
    map: makeShadowDieBottomTexture(),
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    depthTest: true,
    alphaTest: 0,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
    side: THREE.DoubleSide
  });
  const geometry = new THREE.PlaneGeometry(footprintWidth, footprintDepth);
  const shadow = new THREE.Mesh(geometry, material);
  shadow.rotation.x = -Math.PI / 2;
  shadow.rotation.z = -layout[4];
  shadow.position.set(layout[0], -1.577 + index * 0.0002, layout[2]);
  shadow.renderOrder = -1;
  shadow.userData.restYaw = layout[4];
  shadow.userData.dieSize = size;
  shadow.userData.baseOpacity = 0.24;
  scene.add(shadow);
  return shadow;
}

function applyDiceShadowVisual(index, closeness = 1, visible = true) {
  const shadow = diceShadowMeshes[index];
  const die = diceMeshes[index];
  if (!shadow || !die) return;

  const amount = THREE.MathUtils.clamp(closeness, 0, 1);
  if (!visible || amount <= 0 || !die.userData.layout) {
    shadow.visible = false;
    shadow.userData.visualOpacity = 0;
    if (shadow.userData.coreMaterial) shadow.userData.coreMaterial.opacity = 0;
    if (shadow.userData.featherMaterial) shadow.userData.featherMaterial.opacity = 0;
    return;
  }

  // Ground Contact belongs to the slot, not to the animated transform. It
  // always occupies the canonical idle footprint while visibility follows the
  // die lifecycle. This prevents the shadow from floating with a Roll/Drop.
  const layout = shadow.userData.layout || die.userData.layout;
  const size = shadow.userData.dieSize || die.userData.diceSize || 1;
  const yaw = layout?.[4] || 0;

  // Calculate the lowest point of the canonical rounded cube. Every count has
  // its own idle pitch/roll, so one global floor height leaves visible gaps.
  // The result is still a fixed idle anchor and never reads the animated die.
  shadowContactEuler.set(layout?.[3] || 0, yaw, layout?.[5] || 0);
  shadowContactQuaternion.setFromEuler(shadowContactEuler);
  shadowContactAxisX.set(1, 0, 0).applyQuaternion(shadowContactQuaternion);
  shadowContactAxisY.set(0, 1, 0).applyQuaternion(shadowContactQuaternion);
  shadowContactAxisZ.set(0, 0, 1).applyQuaternion(shadowContactQuaternion);
  const verticalAxisSum =
    Math.abs(shadowContactAxisX.y)
    + Math.abs(shadowContactAxisY.y)
    + Math.abs(shadowContactAxisZ.y);
  // RoundedBoxGeometry is an inner box with a 0.11-radius rounded shell. Using
  // the sharp cube corners here would still leave the contact plate too low.
  const roundedRadius = 0.11;
  const verticalExtent = size * (
    (0.5 - roundedRadius) * verticalAxisSum + roundedRadius
  );
  const contactY = (layout?.[1] || 0) - verticalExtent - 0.006;

  shadow.position.set(
    layout?.[0] || 0,
    contactY + index * 0.0002,
    layout?.[2] || 0
  );
  shadow.rotation.set(0, 0, 0);
  shadow.scale.set(1, 1, 1);

  const core = shadow.userData.coreMesh;
  const feather = shadow.userData.featherMesh;
  const coreMaterial = shadow.userData.coreMaterial;
  const featherMaterial = shadow.userData.featherMaterial;

  const followsLiveRoll = (
    die.userData.rolling
    || die.userData.shakeRolling
    || die.userData.shakeSettling
  ) && !introActive;
  const footprintQuaternion = followsLiveRoll
    ? die.quaternion
    : shadowContactQuaternion;
  const footprintScaleX = followsLiveRoll ? die.scale.x : size;
  const footprintScaleY = followsLiveRoll ? die.scale.y : size;
  const footprintScaleZ = followsLiveRoll ? die.scale.z : size;
  const featherScaleX = followsLiveRoll ? 1.58 : 1.92;
  const featherScaleZ = followsLiveRoll ? 1.72 : 2.10;
  if (followsLiveRoll) {
    shadow.position.x = die.position.x;
    shadow.position.z = die.position.z;
  }
  updateProjectedGroundContact(
    shadow,
    footprintQuaternion,
    footprintScaleX,
    footprintScaleY,
    footprintScaleZ,
    featherScaleX,
    featherScaleZ
  );

  const fade = THREE.MathUtils.smootherstep(amount, 0, 1);
  shadow.userData.visualOpacity = Math.pow(fade, 1.18);
  const arrivalSpread = THREE.MathUtils.lerp(1.08, 1, fade);
  if (core) core.scale.set(arrivalSpread, 1, arrivalSpread);
  if (feather) {
    feather.scale.x *= arrivalSpread;
    feather.scale.y *= arrivalSpread;
  }
  if (coreMaterial) {
    coreMaterial.opacity =
      (shadow.userData.baseCoreOpacity || 0.19) * Math.pow(fade, 1.10);
  }
  if (featherMaterial) {
    featherMaterial.opacity =
      (shadow.userData.baseFeatherOpacity || 0.58) * Math.pow(fade, 1.32);
  }
  shadow.visible = true;
}

function setDiceShadowState(index, closeness = 1, visible = true) {
  const shadow = diceShadowMeshes[index];
  if (!shadow) return;
  shadow.userData.dropFade = null;
  shadow.userData.fallFade = null;
  applyDiceShadowVisual(index, closeness, visible);
}

function syncDiceShadow(index, closeness = 1, visible = true) {
  const shadow = diceShadowMeshes[index];
  if (!shadow) return;
  shadow.userData.dropFade = null;
  shadow.userData.fallFade = null;
  applyDiceShadowVisual(index, closeness, visible);
}

function startDiceShadowDrop(index, duration) {
  const shadow = diceShadowMeshes[index];
  if (!shadow) return;

  shadow.userData.dropFade = {
    startedAt: performance.now(),
    duration: Math.max(1, duration)
  };
  shadow.userData.fallFade = null;
  applyDiceShadowVisual(index, 0, false);
}

function startDiceShadowFall(index, duration = 150) {
  const shadow = diceShadowMeshes[index];
  if (!shadow) return;

  shadow.userData.dropFade = null;
  shadow.userData.fallFade = {
    startedAt: performance.now(),
    duration: Math.max(1, duration)
  };
  applyDiceShadowVisual(index, 1, true);
}

function updateDiceShadowLifecycles(nowMilliseconds) {
  diceShadowMeshes.forEach((shadow, index) => {
    const fall = shadow?.userData?.fallFade;
    if (fall) {
      const progress = THREE.MathUtils.clamp(
        (nowMilliseconds - fall.startedAt) / fall.duration,
        0,
        1
      );
      const contact = 1 - THREE.MathUtils.smootherstep(progress, 0, 1);
      applyDiceShadowVisual(index, contact, contact > 0.002);
      if (progress >= 1) {
        shadow.userData.fallFade = null;
        applyDiceShadowVisual(index, 0, false);
      }
      return;
    }

    const fade = shadow?.userData?.dropFade;
    if (!fade) return;

    const progress = THREE.MathUtils.clamp(
      (nowMilliseconds - fade.startedAt) / fade.duration,
      0,
      1
    );
    const contact = THREE.MathUtils.smoothstep(progress, 0.34, 0.96);
    applyDiceShadowVisual(index, contact, contact > 0.002);

    if (progress >= 1) {
      shadow.userData.dropFade = null;
      applyDiceShadowVisual(index, 1, true);
    }
  });
}

function getDiceTexture(text, textColor = "#111111") {
  const key = `${textColor}::${String(text || "")}`;
  if (!diceTextureCache.has(key)) {
    const texture = makeTextTexture(text, textColor);
    texture.userData.sharedDiceTexture = true;
    diceTextureCache.set(key, texture);
  }
  return diceTextureCache.get(key);
}

function createDiceFaceMaterial(text, textColor = "#111111") {
  return new THREE.MeshPhysicalMaterial({
    map: getDiceTexture(text, textColor),
    roughness: 0.26,
    metalness: 0,
    clearcoat: 0.48,
    clearcoatRoughness: 0.24,
    transparent: false,
    opacity: 1,
    depthTest: true,
    depthWrite: true
  });
}

function buildDiceMaterials(finalWord, layout, index) {
  const visibleFaceIndex = getLandingFaceIndex(layout);
  const allFaces = makeFaceWords(finalWord, visibleFaceIndex);
  const mainTextColor = "#000000";
  return allFaces.map((faceWord) => createDiceFaceMaterial(faceWord, mainTextColor));
}

function disposeDiceMaterials(materials) {
  if (!Array.isArray(materials)) return;
  materials.forEach((material) => material?.dispose());
}

function warmDiceTextures({ awaitCompletion = false } = {}) {
  const token = ++textureWarmupToken;
  const words = [...new Set(deck.map(item => item?.word).filter(Boolean))];

  textureWarmupPromise = new Promise(resolve => {
    let index = 0;

    const warmBatch = (deadline) => {
      if (token !== textureWarmupToken) {
        resolve();
        return;
      }

      // Small batches prevent a long iPhone main-thread stall while the splash
      // is visible. By the time the app opens, all subject textures are cached.
      let count = 0;
      while (
        index < words.length &&
        count < 6 &&
        (!deadline || deadline.timeRemaining() > 3)
      ) {
        getDiceTexture(words[index], "#111111");
        index += 1;
        count += 1;
      }

      if (index >= words.length) {
        resolve();
        return;
      }

      if ("requestIdleCallback" in window) {
        requestIdleCallback(warmBatch, { timeout: 80 });
      } else {
        setTimeout(() => warmBatch(null), 0);
      }
    };

    if ("requestIdleCallback" in window) {
      requestIdleCallback(warmBatch, { timeout: 80 });
    } else {
      setTimeout(() => warmBatch(null), 0);
    }
  });

  return awaitCompletion ? textureWarmupPromise : Promise.resolve();
}

function prepareDiceResult(words) {
  diceMeshes.forEach((die, index) => {
    const nextWord = words[index];
    if (!die || !die.visible || typeof nextWord !== "string") return;

    // A fixed Main is the same permanent slot, simply locked.
    if (index === 0 && selectedMain !== "Random") {
      die.userData.materialsCommitted = true;
      die.userData.pendingFaceTexture = null;
      return;
    }

    const faceIndex = die.userData.visibleFaceIndex;
    die.userData.pendingFaceIndex = faceIndex;
    die.userData.pendingFaceTexture = getDiceTexture(nextWord, "#000000");
    die.userData.materialsCommitted = false;
  });
}

function commitPendingDiceMaterials(die) {
  const pendingTexture = die?.userData?.pendingFaceTexture;
  const faceIndex = die?.userData?.pendingFaceIndex;
  if (!pendingTexture || !Number.isInteger(faceIndex) || die.userData.materialsCommitted) return;

  const material = die.material?.[faceIndex];
  if (material) {
    material.map = pendingTexture;

    if (die === diceMeshes[0] && mainPlasmaOverlayMesh) {
      mainPlasmaOverlayMesh.children.forEach(child => {
        if (!child.isMesh || !Array.isArray(child.material)) return;
        const shaderMaterial = child.material[faceIndex];
        if (shaderMaterial?.uniforms?.baseMap) {
          shaderMaterial.uniforms.baseMap.value = pendingTexture;
        }
      });
    }
  }

  die.userData.pendingFaceTexture = null;
  die.userData.pendingFaceIndex = null;
  die.userData.materialsCommitted = true;
}

function renderSceneWithDiceLayers() {
  const mainDie = diceMeshes[0];

  // With only one active die there is nothing to layer: one ordinary pass.
  if (!mainDie?.visible || wordCount <= 1) {
    renderer.autoClear = true;
    renderer.render(scene, camera);
    return;
  }

  // Pass 1: complete rear composition, but without slot 0.
  const mainWasVisible = mainDie.visible;
  const mainShadow = diceShadowMeshes[0];
  // Capture every shadow state before temporarily hiding the Main. Previously
  // this snapshot was taken after mainShadow.visible had already been set to
  // false, so every render permanently restored the Main shadow as hidden.
  // Roll appeared to work only because its animation re-enabled the shadow on
  // every frame; Drop/Idle/Fall had no such per-frame rescue.
  const shadowVisibility = diceShadowMeshes.map(shadow => shadow.visible);
  const mainShadowWasVisible = shadowVisibility[0] || false;
  mainDie.visible = false;
  if (mainShadow) mainShadow.visible = false;
  renderer.autoClear = true;
  renderer.render(scene, camera);

  // Pass 2: preserve the colour buffer, clear depth only, then draw the same
  // permanent Main slot in front. This pipeline is identical for Random and
  // fixed Main and therefore cannot diverge between modes.
  const rearVisibility = diceMeshes.slice(1).map(die => die.visible);
  const floorVisible = floor?.visible;

  mainDie.visible = mainWasVisible;
  if (mainShadow) mainShadow.visible = mainShadowWasVisible;
  diceMeshes.slice(1).forEach(die => { die.visible = false; });
  diceShadowMeshes.slice(1).forEach(shadow => { shadow.visible = false; });
  if (floor) floor.visible = false;

  renderer.autoClear = false;
  renderer.clearDepth();
  renderer.render(scene, camera);

  renderer.autoClear = true;
  diceMeshes.slice(1).forEach((die, i) => { die.visible = rearVisibility[i]; });
  diceShadowMeshes.forEach((shadow, i) => { shadow.visible = shadowVisibility[i]; });
  if (floor) floor.visible = floorVisible;
}

function createPersistentDiceMaterials() {
  return Array.from({ length: 6 }, () => {
    // Never expose a placeholder word on an uninitialised face.
    // Real subject textures are assigned before an active slot becomes visible.
    const material = createDiceFaceMaterial("", "#000000");
    return material;
  });
}

function createPersistentDiceSlot(index) {
  // Unit geometry preserves the exact proportional bevel from the old
  // size-specific geometry. Layout size is now a transform, not a rebuild.
  const geometry = new RoundedBoxGeometry(1, 1, 1, 28, 0.11);
  geometry.computeVertexNormals();

  const materials = createPersistentDiceMaterials();
  // All dice keep the exact same opaque physical material behavior.
  // Foreground separation is composited in renderSceneWithDiceLayers().
  materials.forEach(material => {
    material.transparent = false;
    material.opacity = 1;
    material.depthTest = true;
    material.depthWrite = true;
  });

  const mesh = new THREE.Mesh(geometry, materials);
  mesh.name = `dice-slot-${index}`;
  mesh.renderOrder = index === 0 ? 10 : 1;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.visible = false;

  mesh.userData.base = new THREE.Vector3();
  mesh.userData.layout = null;
  mesh.userData.startRot = new THREE.Euler();
  mesh.userData.endRot = new THREE.Euler();
  mesh.userData.startPosition = new THREE.Vector3();
  mesh.userData.startTime = 0;
  mesh.userData.duration = 1;
  mesh.userData.delay = index * 0.06;
  mesh.userData.rolling = false;
  mesh.userData.shakeRolling = false;
  mesh.userData.shakeSettling = false;
  mesh.userData.visibleFaceIndex = 4;
  mesh.userData.diceSize = 1;
  mesh.userData.materialsCommitted = true;

  scene.add(mesh);
  return mesh;
}

function createPersistentShadowSlot(index) {
  const group = new THREE.Group();
  group.position.y = -1.577 + index * 0.0002;
  group.visible = false;

  // A transparent duplicate of the rounded underside supplies the dense
  // contact seam. It is intentionally subtle: most of it is occluded by the
  // resin, while the exposed edge makes the die feel physically planted.
  const coreMaterial = new THREE.MeshBasicMaterial({
    color: 0x050505,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
    side: THREE.DoubleSide
  });
  const core = new THREE.Mesh(
    makeProjectedGroundContactGeometry(),
    coreMaterial
  );
  core.position.y = 0.00035;
  core.frustumCulled = false;
  // Projection/state remains in Three.js; the visible pixels are drawn on the
  // overflow layer behind the complete live dice/VFX scene.
  core.visible = false;
  // Ground contact renders after the additive aura so its darkest seam is not
  // washed away, but depth testing still keeps it below the opaque resin.
  core.renderOrder = 9;
  group.add(core);

  // A separate feather surrounds the underside. Unlike the core it extends
  // toward the camera, so the forward Main keeps the same visible grounding as
  // the two support dice.
  const featherMaterial = new THREE.MeshBasicMaterial({
    map: makeShadowDieBottomTexture(),
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: true,
    alphaTest: 0,
    polygonOffset: false,
    toneMapped: false,
    side: THREE.DoubleSide
  });
  const feather = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    featherMaterial
  );
  feather.rotation.x = -Math.PI / 2;
  feather.position.y = 0;
  feather.renderOrder = 8;
  feather.visible = false;
  group.add(feather);

  group.userData.coreMesh = core;
  group.userData.featherMesh = feather;
  group.userData.coreMaterial = coreMaterial;
  group.userData.featherMaterial = featherMaterial;
  group.userData.baseCoreOpacity = 0.035;
  group.userData.baseFeatherOpacity = 0.68;
  group.userData.projectedPoints = SHADOW_CUBE_CORNERS.map(() => ({ x: 0, z: 0 }));
  group.userData.lowerHull = [];
  group.userData.upperHull = [];
  group.userData.projectedHull = [];
  group.userData.dieSize = 1;
  group.userData.layout = null;
  group.userData.dropFade = null;
  group.userData.fallFade = null;
  group.userData.visualOpacity = 0;
  scene.add(group);
  return group;
}

function ensureDiceSlots() {
  if (diceSlotsInitialized) return;

  diceMeshes = [0, 1, 2].map(index => createPersistentDiceSlot(index));
  diceShadowMeshes = [0, 1, 2].map(index => createPersistentShadowSlot(index));
  diceSlotsInitialized = true;

  // Create expensive VFX resources once behind startup. Random keeps them hidden
  // and updateMainPlasmaTime performs no shader animation work in that state.
  ensureMainPlasmaOverlay();
  setMainTintProgress(0);
}

function updateSlotFaceTextures(die, finalWord, layout) {
  const visibleFaceIndex = getLandingFaceIndex(layout);
  const allFaces = makeFaceWords(finalWord, visibleFaceIndex);

  die.userData.visibleFaceIndex = visibleFaceIndex;
  allFaces.forEach((faceWord, faceIndex) => {
    const material = die.material[faceIndex];
    if (!material) return;
    material.map = getDiceTexture(faceWord, "#000000");

    if (die === diceMeshes[0] && mainPlasmaOverlayMesh) {
      mainPlasmaOverlayMesh.children.forEach(child => {
        if (!child.isMesh || !Array.isArray(child.material)) return;
        const shaderMaterial = child.material[faceIndex];
        if (shaderMaterial?.uniforms?.baseMap) {
          shaderMaterial.uniforms.baseMap.value = material.map;
        }
      });
    }
  });

  die.userData.pendingFaceTexture = null;
  die.userData.pendingFaceIndex = null;
  die.userData.materialsCommitted = true;
}

function applyLayoutToDiceSlot(index, word, layout, visible, animateIn = false) {
  const die = diceMeshes[index];
  const shadow = diceShadowMeshes[index];
  if (!die || !shadow) return;

  die.visible = visible;
  shadow.visible = visible;
  die.userData.rolling = false;

  if (!visible || !layout || typeof word !== "string") {
    die.userData.layout = null;
    return;
  }

  const size = layout[6];
  die.userData.layout = layout;
  die.userData.diceSize = size;
  applyCanonicalDicePose(index, wordCount);

  updateSlotFaceTextures(die, word, layout);

  shadow.userData.layout = layout;
  shadow.userData.dieSize = size;
  syncDiceShadow(index, animateIn ? 0 : 1, !animateIn);
}

function renderDice(words, animateIn = false) {
  ensureDiceSlots();

  const layout = getDiceComposite(words.length);

  for (let index = 0; index < 3; index++) {
    const visible = index < words.length && Boolean(layout[index]);
    applyLayoutToDiceSlot(
      index,
      visible ? words[index] : "",
      visible ? layout[index] : null,
      visible,
      animateIn
    );
  }

  // The same Main slot owns VFX in every count. Selection only toggles state.
  updateMainSelectionGlow();

  if (animateIn) {
    renderSceneWithDiceLayers();
    requestAnimationFrame(() => startDiceAnimation());
  }
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

function makeTextTexture(text, textColor = "#111111") {
  const c = document.createElement("canvas");
  c.width = c.height = 1024;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const bg = ctx.createLinearGradient(0, 0, 1024, 1024);
  bg.addColorStop(0, "#fffdf8");
  bg.addColorStop(0.62, "#f6f1e8");
  bg.addColorStop(1, "#e4ddd2");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1024, 1024);

  const shine = ctx.createRadialGradient(330, 245, 70, 512, 512, 790);
  shine.addColorStop(0, "rgba(255,255,255,.20)");
  shine.addColorStop(0.55, "rgba(255,255,255,.04)");
  shine.addColorStop(1, "rgba(67,52,36,.060)");
  ctx.fillStyle = shine;
  ctx.fillRect(0, 0, 1024, 1024);

  // Very subtle printed-plastic face depth.
  ctx.strokeStyle = "rgba(255,255,255,.16)";
  ctx.lineWidth = 18;
  ctx.strokeRect(42, 42, 940, 940);

  // Draw upright text for the current final landing/render pose.
  ctx.save();
  ctx.translate(512, 512);
  drawDiceText(ctx, text, textColor);
  ctx.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function drawDiceText(ctx, text, textColor = "#111111") {
  const raw = String(text || "").trim();
  const lines = buildTextLines(raw);
  const maxWidth = 720;
  const maxHeight = 620;

  let fontSize = estimateFontSize(lines);
  fontSize = fitFontSize(ctx, lines, fontSize, maxWidth, maxHeight);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = textColor;
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
  if (parts.length <= 1) return parts.length ? parts : [""];

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

function setRollRenderPerformanceMode(active) {
  // v2.4: no visual state switch during Roll. The preferred dimmer one-layer
  // look is now permanent, so toggling shader layers here would reintroduce a
  // brightness jump and an end-of-roll hitch.
}


async function roll(options = { countIt: true }) {
  if (!deck.length) return;

  if (rollInProgress || introActive || snapshotDropActive) {
    pendingRollRequest = true;
    return;
  }

  rollInProgress = true;
  setRollRenderPerformanceMode(true);
  closeMainHint();
  rollButton.classList.add("rolling");

  try {
    const nextRoll = makeRoll(wordCount);
    currentRoll = nextRoll;
    prepareDiceResult(nextRoll);

    const rollDurationMs = startDiceAnimation();

    await wait(rollDurationMs + 45);

    if (options.countIt) incrementCounter();
  } catch (error) {
    console.error("Recovered from Roll error:", error);
  } finally {
    rollButton.classList.remove("rolling");
    rollInProgress = false;
    setRollRenderPerformanceMode(false);
    syncDiceCountButtons();
    queueMicrotask(flushPendingDiceInput);
  }
}

function startDiceAnimation({ preserveCurrentPose = false } = {}) {
  const now = performance.now() / 1000;
  const fixedMain = selectedMain !== "Random";
  let maxEndSeconds = 0;

  diceMeshes.forEach((die, index) => {
    const p = die.userData.layout;
    const keepMainStill = fixedMain && index === 0;

    // Permanent slots outside the active 1/2/3 composition have no layout.
    // They must never enter the Roll path or read pose coordinates.
    if (!die.visible || !p) {
      die.userData.rolling = false;
      return;
    }

    // Button Roll starts from the canonical composite. Shake hands its current
    // live transform into this same landing lifecycle without a visual jump.
    if (!preserveCurrentPose) applyCanonicalDicePose(index, wordCount);

    if (keepMainStill) {
      syncDiceShadow(index, 1, true);
      die.userData.rolling = false;
      die.rotation.set(p[3], p[4], p[5]);
      return;
    }

    // Rolling dice start without a shadow. The normal per-frame closeness logic
    // brings it in only as the die approaches the table.
    setDiceShadowState(index, 0, false);

    // Restored verbatim movement values from the supplied working live file.
    const strengthVariation = 0.94 + Math.random() * 0.12;
    const timingVariation = (Math.random() - 0.5) * 0.06;
    die.userData.startTime = now;
    die.userData.duration = 1.34 + index * 0.07 + timingVariation;
    die.userData.delay = index * (0.045 + Math.random() * 0.018);
    die.userData.rolling = true;
    die.userData.startRot.copy(die.rotation);
    die.userData.startPosition.copy(die.position);
    const nextLandingRotation = (current, target, extraTurns) => {
      const completedTurns = Math.ceil((current - target) / (Math.PI * 2));
      return target + (completedTurns + extraTurns) * Math.PI * 2;
    };
    die.userData.endRot.set(
      preserveCurrentPose ? nextLandingRotation(die.rotation.x, p[3], 2) : p[3] + 4 * Math.PI * 2,
      preserveCurrentPose ? nextLandingRotation(die.rotation.y, p[4], 2) : p[4] + 4 * Math.PI * 2,
      preserveCurrentPose ? nextLandingRotation(die.rotation.z, p[5], 1) : p[5] + 2 * Math.PI * 2
    );
    die.userData.physicsStrength = (index === 0 ? 0.72 : 0.54) * strengthVariation;
    die.userData.wobbleAmplitude = (index === 0 ? 0.050 : 0.040) * (0.9 + Math.random() * 0.2);
    die.userData.wobbleFrequency = 6.2 + Math.random() * 1.4;
    die.userData.wobblePhase = Math.random() * Math.PI * 2;
    maxEndSeconds = Math.max(maxEndSeconds, die.userData.delay + die.userData.duration);
  });

  return Math.ceil(maxEndSeconds * 1000);
}

function landingBounce(progress, strength = 0.54) {
  // One continuous lift-and-land arc. Squaring sin gives zero velocity at both
  // ends, so there are no piecewise impact boundaries for the eye to read as
  // micro-stutters.
  const arc = Math.sin(Math.PI * THREE.MathUtils.clamp(progress, 0, 1));
  return arc * arc * strength;
}

function landingSquash() {
  // Keep the resin cube rigid during a normal roll. The previous three Gaussian
  // impact squashes created visible stop/start beats near the end of the roll.
  return { y: 1, xz: 1 };
}

function dampedWobble(progress, amplitude, frequency, phase) {
  // Only start after the main travel phase, then quickly lose energy.
  const start = 0.72;
  if (progress <= start) return 0;
  const local = (progress - start) / (1 - start);
  const damping = Math.exp(-5.6 * local);
  return Math.sin(local * frequency + phase) * amplitude * damping;
}


function animate() {
  requestAnimationFrame(animate);
  const t = performance.now() / 1000;
  updateMainPlasmaTime(t);
  updateDiceShadowLifecycles(t * 1000);

  if (introActive && snapshotDropActive) {
    // DOM snapshots own the visible drop. The Three scene stays frozen at the
    // exact landing poses and is only revealed as each snapshot lands.
  } else if (introActive) {
    let allFinished = true;

    diceMeshes.forEach((die, index) => {
      const delay = die.userData.dropDelay || 0;
      const duration = die.userData.dropDuration || 1.34;
      const local = (t - introStartTime - delay) / duration;
      const p = THREE.MathUtils.clamp(local, 0, 1);
      if (local < 1) allFinished = false;

      const target = die.userData.dropTargetPosition;
      const targetRotation = die.userData.dropTargetRotation;
      const start = die.userData.dropStartPosition;
      if (!target || !targetRotation || !start) return;

      if (local <= 0) {
        die.position.copy(start);
        setDiceShadowState(index, 0, false);
        return;
      }

      const impact = die.userData.dropImpact || 0.82;
      if (p < impact) {
        const air = p / impact;
        // A literal vertical fall from above the device: x/z never drift.
        const gravity = air * air;
        const settle = THREE.MathUtils.smootherstep(air, 0, 1);
        const wobbleEnvelope = Math.sin(Math.PI * air) * (1 - 0.30 * air);
        const wobble = Math.sin(air * die.userData.dropWobbleFrequency + die.userData.dropWobblePhase)
          * die.userData.dropWobbleAmplitude * wobbleEnvelope;

        die.position.x = target.x;
        die.position.y = lerp(start.y, target.y, gravity);
        die.position.z = target.z;
        die.rotation.x = lerp(targetRotation.x - 0.20, targetRotation.x, settle) + wobble;
        die.rotation.y = lerp(targetRotation.y + (index === 1 ? -0.16 : 0.16), targetRotation.y, settle);
        die.rotation.z = lerp(targetRotation.z + (index === 1 ? 0.12 : -0.12), targetRotation.z, settle) - wobble * 0.75;
        die.scale.setScalar(getCanonicalDiceSize(die, index));

        // Contact shadow is absent in the air and fades in only near the floor.
        const closeness = THREE.MathUtils.smoothstep(air, 0.72, 1);
        syncDiceShadow(index, closeness, closeness > 0.01);
      } else {
        const landed = THREE.MathUtils.clamp((p - impact) / (1 - impact), 0, 1);
        // One small vertical bounce, with no squash/morph and no post-landing spin.
        const bounce = Math.sin(landed * Math.PI) * die.userData.dropStrength * (1 - landed);
        die.position.set(target.x, target.y + bounce, target.z);
        die.rotation.copy(targetRotation);
        die.scale.setScalar(getCanonicalDiceSize(die, index));
        syncDiceShadow(index, 1 - Math.min(0.24, bounce * 0.75), true);
      }
    });

    if (allFinished) finishIntroRoll();
  } else {
    // Exact original ROLL movement, with only the selected Main optionally locked.
    diceMeshes.forEach((die, index) => {
      const u = die.userData;
      if (u.shakeRolling) {
        const delta = Math.min(Math.max(t - (u.shakeLastTime || t), 0), 0.04);
        u.shakeLastTime = t;
        const force = 0.34 + shakeIntensity * 0.96;
        const speed = (5.8 + shakeIntensity * 12.5) * (u.shakeAxisBias || 1);
        u.shakePhase = (u.shakePhase || 0) + delta * speed;

        die.rotation.x += delta * speed * 1.16;
        die.rotation.y += delta * speed * 0.91;
        die.rotation.z += delta * speed * 0.72;
        die.position.x = u.base.x + Math.sin(u.shakePhase * 1.31 + index) * 0.055 * force;
        die.position.y = u.base.y + 0.08 + Math.abs(Math.sin(u.shakePhase * 1.87)) * 0.16 * force;
        die.position.z = u.base.z + Math.cos(u.shakePhase * 1.13 + index * 0.8) * 0.045 * force;
        die.scale.setScalar(getCanonicalDiceSize(die, index));
        syncDiceShadow(index, 0.54 - shakeIntensity * 0.22, true);
        return;
      }

      if (u.shakeSettling) {
        const p = THREE.MathUtils.clamp(
          (t - u.startTime - u.delay) / Math.max(u.duration, 0.001),
          0,
          1
        );
        if (p <= 0) return;

        // Start in the live Shake direction, then gently hand control to the
        // predetermined canonical landing face. The temporary forward arc
        // returns to zero at the end, so the final pose remains exact.
        const eased = p * p * (3 - 2 * p);
        die.quaternion.slerpQuaternions(
          u.shakeSettleStartQuaternion,
          u.shakeSettleEndQuaternion,
          eased
        );
        const forwardAngle =
          Math.sin(Math.PI * p) * (u.shakeSettleForwardAngle || 0);
        u.shakeSettleOffsetQuaternion.setFromAxisAngle(
          u.shakeSettleAxis,
          forwardAngle
        );
        die.quaternion.multiply(u.shakeSettleOffsetQuaternion);
        die.position.x = lerp(u.startPosition.x, u.base.x, eased);
        die.position.z = lerp(u.startPosition.z, u.base.z, eased);
        const settleLift = Math.sin(Math.PI * p)
          * (0.055 + Math.min(u.shakeSettleAngle || 0, Math.PI) * 0.014);
        die.position.y = lerp(u.startPosition.y, u.base.y, eased) + settleLift;
        die.scale.setScalar(getCanonicalDiceSize(die, index));

        const shadowStrength = THREE.MathUtils.smoothstep(p, 0.08, 1);
        syncDiceShadow(index, 0.42 + shadowStrength * 0.58, true);

        if (p >= 1) {
          commitPendingDiceMaterials(die);
          u.shakeSettling = false;
          applyCanonicalDicePose(index, wordCount);
          syncDiceShadow(index, 1, true);
        }
        return;
      }

      if (!u.rolling) {
        // Static slots/shadows are already at their canonical transform.
        return;
      }

      const p = Math.min(Math.max((t - u.startTime - u.delay) / u.duration, 0), 1);
      if (p <= 0) return;
      const e = easeInOutCubic(p);

      die.rotation.x = lerp(u.startRot.x, u.endRot.x, e);
      die.rotation.y = lerp(u.startRot.y, u.endRot.y, e);
      die.rotation.z = lerp(u.startRot.z, u.endRot.z, e);

      // The landing face is fully turned away at this fixed point in the
      // existing roll path for every supported 1/2/3-dice layout. Commit once
      // here, before the final approach, so the die cannot land on the old word
      // and then visibly switch after stopping.
      if (!u.materialsCommitted && p >= 0.38) {
        commitPendingDiceMaterials(die);
      }

      const bounce = landingBounce(p, u.physicsStrength);
      const squash = landingSquash(p, index);
      const wobble = dampedWobble(p, u.wobbleAmplitude, u.wobbleFrequency, u.wobblePhase);

      die.position.y = lerp(u.startPosition.y, u.base.y, e) + bounce;
      const rollEnvelope = Math.pow(Math.sin(Math.PI * p), 2.0);
      die.position.x = lerp(u.startPosition.x, u.base.x, e)
        + Math.sin(p * Math.PI * 2.0 + index * 0.55) * rollEnvelope * 0.030;
      die.position.z = lerp(u.startPosition.z, u.base.z, e);
      die.rotation.x += wobble;
      die.rotation.z -= wobble * 0.72;
      const canonicalSize = getCanonicalDiceSize(die, index);
      die.scale.set(
        canonicalSize * squash.xz,
        canonicalSize * squash.y,
        canonicalSize * squash.xz
      );
      syncDiceShadow(index, 1 - Math.min(0.45, bounce * 0.55), true);

      if (p >= 1) {
        commitPendingDiceMaterials(die);
        u.rolling = false;
        applyCanonicalDicePose(index, wordCount);
        syncDiceShadow(index, 1, true);
      }
    });
  }

  renderSceneWithDiceLayers();
  renderGroundShadowLayer();
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
    showMainHint();
  }
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
  if (!counterEl) return;

  const nextValue = Math.max(0, Math.trunc(Number(count || 0)));
  const previousValue = displayedCounterValue;
  const formatted = formatNumber(nextValue);
  const prefix = formatted.slice(0, -1);
  const nextDigit = formatted.slice(-1);
  const shouldRollDigit = previousValue !== null && nextValue === previousValue + 1;
  const animationToken = ++counterAnimationToken;

  displayedCounterValue = nextValue;
  counterEl.setAttribute("aria-label", `${formatted} tattoo ideas rolled`);
  counterEl.classList.remove("counter-rolling");

  if (!shouldRollDigit) {
    counterEl.innerHTML = `
      <span class="counter-number">
        <span class="counter-prefix">${prefix}</span><span class="counter-digit-window"><span class="counter-digit counter-digit-static">${nextDigit}</span></span>
      </span><span class="counter-label">&nbsp;tattoo ideas rolled</span>
    `;
    return;
  }

  const previousDigit = formatNumber(previousValue).slice(-1);
  counterEl.innerHTML = `
    <span class="counter-number">
      <span class="counter-prefix">${prefix}</span><span class="counter-digit-window">
        <span class="counter-digit counter-digit-old">${previousDigit}</span>
        <span class="counter-digit counter-digit-new">${nextDigit}</span>
      </span>
    </span><span class="counter-label">&nbsp;tattoo ideas rolled</span>
  `;

  requestAnimationFrame(() => {
    if (animationToken === counterAnimationToken) counterEl.classList.add("counter-rolling");
  });

  window.setTimeout(() => {
    if (animationToken !== counterAnimationToken) return;
    counterEl.classList.remove("counter-rolling");
    counterEl.innerHTML = `
      <span class="counter-number">
        <span class="counter-prefix">${prefix}</span><span class="counter-digit-window"><span class="counter-digit counter-digit-static">${nextDigit}</span></span>
      </span><span class="counter-label">&nbsp;tattoo ideas rolled</span>
    `;
  }, 540);
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

// Start only after the entire ES module has evaluated.
// v2.20 called init() too early: setupThree() synchronously read
// MAIN_VFX_CONFIG while that const was still in the ES-module TDZ.
init().catch(error => {
  console.error("Tattoo Dice initialization failed:", error);
  window.__TATTOO_DICE_INIT_ERROR__ = error;
});
