const FAVORITES_KEY = "tattooDiceFavoritesV1";
const AI_MESSAGE = `Tattoo Dice will never become an AI image generator.

It's built to spark creativity by combining carefully curated tattoo ideas into unique tattoo concepts.

Now get off your lazy ass and draw it yourself.`;

const favoriteToggle = document.getElementById("favoriteToggle");
const favoritesScreen = document.getElementById("favoritesPage");
const favoritesStack = document.getElementById("favoritesPageStack");
const favoritesEmpty = document.getElementById("favoritesPageEmpty");
const favoritesPosition = document.getElementById("favoritesPosition");
const aiImageScreen = document.getElementById("aiPage");
const aboutScreen = document.getElementById("aboutScreen");
const privacyScreen = document.getElementById("privacyScreen");
const aiFavoriteTrack = document.getElementById("aiPageSelectorTrack");
const aiGenerateButton = document.getElementById("aiPageGenerateButton");
const aiImageIntro = document.querySelector(".ai-page-controls");
const aiLoading = document.getElementById("aiGeneratorWindow");
const aiLoadingStatus = document.getElementById("aiPageStatus");
const aiProgressBar = document.getElementById("aiPageProgressBar");
const aiProgressValue = document.getElementById("aiPageProgressValue");
const aiReveal = document.getElementById("aiPageArtwork");
const aiTypewriter = document.getElementById("aiPageTypewriter");
const aiFinishButton = document.getElementById("aiPageFinishButton");
const aiSelector = document.getElementById("aiPageSelector");
const aiBackButton = document.getElementById("aiPageBackButton");
const aiSaveButton = document.getElementById("aiPageSaveButton");
const themeTrack = document.getElementById("themeTrack");
const classicChoice = document.getElementById("classicThemeChoice");
const fantasyChoice = document.getElementById("fantasyThemeChoice");
const counterElement = document.getElementById("counter");
const favoritesThemeButton = document.getElementById("favoritesThemeButton");
const favoritesRemoveButton = document.getElementById("favoritesRemoveButton");
const homeStage = document.querySelector(".stage");

let bridge = window.TattooDiceBridge || null;
let favorites = loadFavorites();
let currentFavoriteIndex = 0;
let previousRoll = null;
let previousRollPending = false;
let previousHintShown = false;
let activeExpansionScreen = null;
let aiRunning = false;
let aiFavoriteIndex = 0;
let counterBeforeFeaturePage = "";
let counterAriaBeforeFeaturePage = "";
let favoriteRemovalActive = false;
const favoriteCardCache = new Map();

function loadFavorites() {
  try {
    const parsed = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter(item => Array.isArray(item?.words)) : [];
  } catch {
    return [];
  }
}

function saveFavorites() {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  rebuildFavoriteCache();
  updateHeart();
}

function favoriteKey(snapshot) {
  if (!snapshot) return "";
  return JSON.stringify([
    snapshot.theme,
    snapshot.count,
    snapshot.selectedMain,
    snapshot.subjectIds || snapshot.words
  ]);
}

function currentState() {
  return bridge?.getState?.() || null;
}

function dispatchPointerUp(element) {
  element?.dispatchEvent(new PointerEvent("pointerup", {
    bubbles: false,
    cancelable: true,
    pointerType: "mouse"
  }));
}

function openExpansionScreen(screen) {
  if (!screen || aiRunning) return;
  if (activeExpansionScreen && activeExpansionScreen !== screen) {
    activeExpansionScreen.classList.remove("open");
    activeExpansionScreen.setAttribute("aria-hidden", "true");
  }
  activeExpansionScreen = screen;
  screen.classList.add("open");
  screen.setAttribute("aria-hidden", "false");
  document.body.classList.add("expansion-screen-open");
  if (screen.classList.contains("feature-page")) {
    document.body.classList.add("feature-page-open");
    homeStage?.setAttribute("aria-hidden", "true");
    if (!counterBeforeFeaturePage && counterElement) {
      counterBeforeFeaturePage = counterElement.innerHTML;
      counterAriaBeforeFeaturePage = counterElement.getAttribute("aria-label") || "";
    }
  }
  if (screen === favoritesScreen) updateFavoritesPageCounter();
  bridge?.closeMenu?.();
}

function openFromMenu(screen, beforeOpen) {
  bridge?.closeMenu?.();
  window.setTimeout(() => {
    beforeOpen?.();
    openExpansionScreen(screen);
  }, 0);
}

function closeExpansionScreen() {
  if (!activeExpansionScreen || aiRunning) return;
  activeExpansionScreen.classList.remove("open");
  activeExpansionScreen.setAttribute("aria-hidden", "true");
  activeExpansionScreen = null;
  document.body.classList.remove("expansion-screen-open");
  document.body.classList.remove("feature-page-open");
  homeStage?.removeAttribute("aria-hidden");
  if (counterElement && counterBeforeFeaturePage) {
    counterElement.innerHTML = counterBeforeFeaturePage;
    if (counterAriaBeforeFeaturePage) counterElement.setAttribute("aria-label", counterAriaBeforeFeaturePage);
    else counterElement.removeAttribute("aria-label");
    counterBeforeFeaturePage = "";
    counterAriaBeforeFeaturePage = "";
  }
}

function updateThemeTrack(preferredTheme) {
  const fantasyActive = preferredTheme
    ? preferredTheme === "fantasy"
    : fantasyChoice?.classList.contains("active");
  themeTrack?.classList.toggle("show-fantasy", Boolean(fantasyActive));
  if (fantasyChoice) {
    const locked = fantasyChoice.classList.contains("locked");
    const label = fantasyChoice.querySelector("span");
    const desired = locked ? "FANTASY 🔒" : "FANTASY";
    if (label && label.textContent !== desired) label.textContent = desired;
  }
}

function selectAdjacentTheme(direction) {
  const showingFantasy = themeTrack?.classList.contains("show-fantasy");
  const targetFantasy = direction > 0 ? true : false;
  if (showingFantasy === targetFantasy) return;
  updateThemeTrack(targetFantasy ? "fantasy" : "classic");
}

function updateHeart() {
  const snapshot = currentState();
  const index = snapshot ? favorites.findIndex(item => favoriteKey(item) === favoriteKey(snapshot)) : -1;
  const active = index >= 0;
  favoriteToggle?.classList.toggle("is-favorite", active);
  favoriteToggle?.setAttribute("aria-pressed", String(active));
  favoriteToggle?.setAttribute("aria-label", active ? "Remove this roll from favorites" : "Save this roll to favorites");
}

function clearHeartImmediately() {
  favoriteToggle?.classList.remove("is-favorite", "favorite-pop");
  favoriteToggle?.setAttribute("aria-pressed", "false");
  favoriteToggle?.setAttribute("aria-label", "Save this roll to favorites");
}

function showFavoriteFeedback(message) {
  if (favoriteToggle) {
    favoriteToggle.classList.remove("favorite-pop");
    void favoriteToggle.offsetWidth;
    favoriteToggle.classList.add("favorite-pop");
    window.setTimeout(() => favoriteToggle.classList.remove("favorite-pop"), 360);
  }
  bridge?.showNotice?.(message, 1800);
}

function toggleCurrentFavorite() {
  const snapshot = currentState();
  if (!snapshot?.words?.length || !bridge?.isIdle?.()) return;
  const key = favoriteKey(snapshot);
  const existingIndex = favorites.findIndex(item => favoriteKey(item) === key);

  if (existingIndex >= 0) {
    favorites.splice(existingIndex, 1);
    showFavoriteFeedback("REMOVED FROM FAVORITES");
  } else {
    favorites.unshift({ ...snapshot, savedAt: Date.now() });
    showFavoriteFeedback("ADDED TO FAVORITES");
  }
  saveFavorites();
}

function favoriteCode(snapshot) {
  let hash = 2166136261;
  const input = favoriteKey(snapshot);
  for (let index = 0; index < input.length; index++) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `TD-${Math.abs(hash >>> 0).toString(36).toUpperCase().slice(0, 6).padStart(6, "0")}`;
}

function createFavoriteCard(snapshot) {
  const key = favoriteKey(snapshot);
  const card = document.createElement("article");
  card.className = "favorite-card";
  card.dataset.favoriteKey = key;

  const rank = snapshot.count === 1 ? "A" : String(snapshot.count);
  const makeCorner = inverted => {
    const corner = document.createElement("div");
    corner.className = `favorite-card-corner${inverted ? " favorite-card-corner-bottom" : ""}`;
    const value = document.createElement("span");
    value.className = "favorite-card-rank";
    value.textContent = rank;
    const suit = document.createElement("span");
    suit.className = "favorite-card-suit";
    suit.textContent = "\u2665";
    corner.append(value, suit);
    return corner;
  };
  card.append(makeCorner(false), makeCorner(true));

  const dice = document.createElement("div");
  dice.className = `favorite-card-hearts favorite-card-hearts-${snapshot.count}`;
  snapshot.words.forEach((word, index) => {
    const heart = document.createElement("div");
    heart.className = "favorite-card-heart";
    if (snapshot.selectedMain !== "Random" && index === 0) heart.classList.add("is-main");
    const artwork = document.createElement("span");
    artwork.className = "favorite-card-heart-art";
    artwork.textContent = "\u2665";
    const label = document.createElement("span");
    label.className = "favorite-card-heart-label";
    label.textContent = word;
    const wordLength = String(word).trim().length;
    if (wordLength >= 9) label.classList.add("medium");
    if (wordLength >= 12) label.classList.add("long");
    if (wordLength >= 16) label.classList.add("extra-long");
    heart.append(artwork, label);
    dice.append(heart);
  });
  card.append(dice);

  return card;
}

function rebuildFavoriteCache() {
  const liveKeys = new Set(favorites.map(favoriteKey));
  for (const key of favoriteCardCache.keys()) {
    if (!liveKeys.has(key)) favoriteCardCache.delete(key);
  }
  favorites.forEach(item => {
    const key = favoriteKey(item);
    if (!favoriteCardCache.has(key)) favoriteCardCache.set(key, createFavoriteCard(item));
  });
  populateAiFavorites();
}

function filteredFavorites() {
  return favorites;
}

function updateFavoritesPageCounter() {
  if (!counterElement || activeExpansionScreen !== favoritesScreen) return;
  const total = filteredFavorites().length;
  counterElement.innerHTML = `<span class="feature-counter-value">${total.toLocaleString("en-US")}</span> <span>TATTOO IDEAS SAVED</span>`;
  counterElement.setAttribute("aria-label", `${total.toLocaleString("en-US")} tattoo ideas saved`);
}

function renderFavoriteStack(entryDirection = 0) {
  if (!favoritesStack) return;
  const visibleFavorites = filteredFavorites();
  currentFavoriteIndex = Math.min(currentFavoriteIndex, Math.max(0, visibleFavorites.length - 1));
  favoritesStack.replaceChildren();
  favoritesEmpty.hidden = visibleFavorites.length > 0;
  favoritesStack.hidden = visibleFavorites.length === 0;
  if (favoritesPosition) favoritesPosition.textContent = "";
  favoritesThemeButton.textContent = "RESTACK";
  updateFavoritesPageCounter();

  if (!visibleFavorites.length) {
    favoritesRemoveButton.disabled = true;
    return;
  }
  favoritesRemoveButton.disabled = false;
  const card = favoriteCardCache.get(favoriteKey(visibleFavorites[currentFavoriteIndex]));
  if (!card) return;
  card.style.transform = "";
  card.style.transition = "";
  card.style.opacity = "";
  card.style.setProperty("--stack-index", "0");
  card.classList.add("is-current");
  card.classList.remove("is-next", "favorite-card-returning", "favorite-card-removing");
  favoritesStack.append(card);

  /* Keep the next complete card ready underneath the current card. This avoids
     exposing a blank deck layer while a swipe is leaving the screen. */
  const nextFavorite = visibleFavorites[currentFavoriteIndex + 1];
  if (nextFavorite) {
    const nextCard = favoriteCardCache.get(favoriteKey(nextFavorite));
    if (nextCard) {
      nextCard.style.transform = "";
      nextCard.style.transition = "";
      nextCard.style.opacity = "";
      nextCard.style.setProperty("--stack-index", "1");
      nextCard.classList.add("is-next");
      nextCard.classList.remove("is-current", "favorite-card-returning", "favorite-card-removing");
      favoritesStack.prepend(nextCard);
    }
  }
}

function moveFavorite(direction) {
  const visibleFavorites = filteredFavorites();
  if (direction <= 0 || currentFavoriteIndex >= visibleFavorites.length - 1) return;
  currentFavoriteIndex += 1;
  renderFavoriteStack(direction);
}

async function removeCurrentFavorite() {
  if (favoriteRemovalActive) return;
  const current = filteredFavorites()[currentFavoriteIndex];
  if (!current) return;
  const card = favoritesStack?.querySelector(".favorite-card.is-current");
  favoriteRemovalActive = true;
  favoritesRemoveButton.disabled = true;
  if (card) {
    card.classList.add("favorite-card-removing");
    await new Promise(resolve => {
      const timer = window.setTimeout(resolve, 760);
      card.addEventListener("animationend", () => {
        window.clearTimeout(timer);
        resolve();
      }, { once: true });
    });
  }
  const index = favorites.findIndex(item => favoriteKey(item) === favoriteKey(current));
  if (index >= 0) favorites.splice(index, 1);
  currentFavoriteIndex = Math.min(currentFavoriteIndex, Math.max(0, filteredFavorites().length - 1));
  saveFavorites();
  renderFavoriteStack();
  favoriteRemovalActive = false;
}

function restackFavoriteDeck() {
  currentFavoriteIndex = 0;
  renderFavoriteStack();
}

function populateAiFavorites() {
  if (!aiFavoriteTrack) return;
  aiFavoriteTrack.replaceChildren();
  aiFavoriteIndex = Math.min(aiFavoriteIndex, Math.max(0, favorites.length - 1));
  if (!favorites.length) {
    const empty = document.createElement("div");
    empty.className = "ai-favorite-name empty";
    empty.textContent = "SAVE A FAVORITE FIRST";
    aiFavoriteTrack.append(empty);
    aiGenerateButton.disabled = true;
    return;
  }
  favorites.forEach(item => {
    const name = document.createElement("div");
    name.className = "ai-favorite-name";
    name.textContent = item.words.join(" · ");
    aiFavoriteTrack.append(name);
  });
  aiGenerateButton.disabled = false;
  updateAiFavoriteTrack();
}

function updateAiFavoriteTrack(direction = 0) {
  if (!aiFavoriteTrack || !favorites.length) return;
  aiFavoriteTrack.classList.toggle("moving-left", direction > 0);
  aiFavoriteTrack.classList.toggle("moving-right", direction < 0);
  aiFavoriteTrack.style.transform = `translateX(${-aiFavoriteIndex * 100}%)`;
}

function moveAiFavorite(direction) {
  if (favorites.length < 2) return;
  const next = Math.max(0, Math.min(favorites.length - 1, aiFavoriteIndex + direction));
  if (next === aiFavoriteIndex) return;
  aiFavoriteIndex = next;
  updateAiFavoriteTrack(direction);
}

const wait = milliseconds => new Promise(resolve => window.setTimeout(resolve, milliseconds));

async function runAiEasterEgg() {
  if (aiRunning || !favorites.length) return;
  aiRunning = true;
  bridge?.setUiLocked?.(true);
  aiGenerateButton.disabled = true;
  aiBackButton.disabled = true;
  aiSaveButton.disabled = true;
  aiImageIntro.classList.add("is-locked");
  aiLoading.classList.add("is-running");
  aiLoading.setAttribute("aria-hidden", "false");
  aiReveal.classList.remove("is-previewing", "is-complete");
  document.getElementById("aiPageBubble")?.classList.remove("is-active");
  aiSelector?.classList.remove("is-replaced");
  aiSelector?.removeAttribute("aria-hidden");
  aiFinishButton.classList.remove("ready");
  aiFinishButton.setAttribute("aria-hidden", "true");
  aiTypewriter.textContent = "";

  const start = performance.now();
  const total = 10600;
  let progress = 0;
  while (progress < 100) {
    const elapsed = performance.now() - start;
    if (elapsed < 6500) progress = Math.min(89, elapsed / 6500 * 89);
    else if (elapsed < 8550) progress = 89;
    else progress = Math.min(100, 89 + (elapsed - 8550) / (total - 8550) * 11);

    const rounded = Math.floor(progress);
    aiProgressBar.style.width = `${progress}%`;
    aiProgressValue.textContent = `${rounded}%`;
    aiLoadingStatus.textContent = rounded < 26
      ? "Reading your favorite…"
      : rounded < 58
        ? "Composing tattoo image…"
        : rounded < 80
          ? "Rendering shapes and color…"
          : rounded === 89
          ? `Generating artwork${".".repeat(Math.floor(elapsed / 520) % 3 + 1)}`
          : "Finishing the final artwork…";
    if (progress >= 80) aiReveal.classList.add("is-previewing");
    if (progress >= 100) break;
    await wait(110);
  }

  aiLoading.classList.remove("is-running");
  aiLoadingStatus.textContent = "IMAGE FINISHED";
  aiProgressValue.textContent = "100%";
  aiProgressBar.style.width = "100%";
  aiReveal.classList.add("is-complete");
  aiReveal.setAttribute("aria-hidden", "false");
  await wait(260);
  document.getElementById("aiPageBubble")?.classList.add("is-active");
  await wait(430);
  for (let index = 0; index <= AI_MESSAGE.length; index++) {
    aiTypewriter.textContent = AI_MESSAGE.slice(0, index);
    await wait(index < 42 ? 31 : 20);
  }
  aiSelector?.classList.add("is-replaced");
  aiSelector?.setAttribute("aria-hidden", "true");
  aiFinishButton.classList.add("ready");
  aiFinishButton.removeAttribute("aria-hidden");
  aiImageIntro.classList.remove("is-locked");
  aiBackButton.disabled = false;
  aiSaveButton.disabled = false;
  bridge?.setUiLocked?.(false);
  aiRunning = false;
}

function resetAiScreen() {
  aiImageIntro.classList.remove("is-locked");
  aiLoading.classList.remove("is-running");
  aiLoading.removeAttribute("aria-hidden");
  aiReveal.classList.remove("is-previewing", "is-complete");
  aiReveal.setAttribute("aria-hidden", "true");
  document.getElementById("aiPageBubble")?.classList.remove("is-active");
  aiSelector?.classList.remove("is-replaced");
  aiSelector?.removeAttribute("aria-hidden");
  aiFinishButton.classList.remove("ready");
  aiFinishButton.setAttribute("aria-hidden", "true");
  aiProgressBar.style.width = "0";
  aiProgressValue.textContent = "0%";
  aiLoadingStatus.textContent = favorites.length ? "Choose a favorite to begin." : "Save a favorite first.";
  aiTypewriter.textContent = "";
  aiGenerateButton.disabled = favorites.length === 0;
  aiBackButton.disabled = false;
  aiSaveButton.disabled = true;
}

function setupFavoriteStackGesture() {
  if (!favoritesStack) return;
  let tracking = null;
  const cancelDrag = () => {
    const card = favoritesStack.querySelector(".favorite-card.is-current");
    if (card) {
      card.style.transform = "";
      card.style.transition = "";
    }
    tracking = null;
  };
  favoritesStack.addEventListener("pointerdown", event => {
    if (currentFavoriteIndex >= filteredFavorites().length - 1 || favoriteRemovalActive) return;
    const card = event.target.closest(".favorite-card.is-current");
    if (!card) return;
    const rect = card.getBoundingClientRect();
    tracking = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      card,
      rotationFactor: Math.max(-1, Math.min(1, (event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2))),
      horizontal: false
    };
    favoritesStack.setPointerCapture(event.pointerId);
  });
  favoritesStack.addEventListener("pointermove", event => {
    if (!tracking || event.pointerId !== tracking.id) return;
    const dx = event.clientX - tracking.x;
    const dy = event.clientY - tracking.y;
    if (!tracking.horizontal) {
      if (Math.abs(dy) > 14 && Math.abs(dy) > Math.abs(dx)) return cancelDrag();
      if (Math.abs(dx) < 9) return;
      tracking.horizontal = true;
      tracking.card.style.transition = "none";
    }
    event.preventDefault();
    const rotate = Math.max(-6, Math.min(6, dx / 28 * -tracking.rotationFactor));
    tracking.card.style.transform = `translateX(${dx}px) rotate(${rotate}deg)`;
  }, { passive: false });
  favoritesStack.addEventListener("pointerup", event => {
    if (!tracking || event.pointerId !== tracking.id) return;
    const dx = event.clientX - tracking.x;
    const dy = event.clientY - tracking.y;
    const exitDirection = dx < 0 ? -1 : 1;
    const completes = Math.abs(dx) > Math.min(88, favoritesStack.clientWidth * .24)
      && Math.abs(dx) > Math.abs(dy);
    if (completes) {
      const card = tracking.card;
      card.style.transition = "transform .64s cubic-bezier(.18,.74,.18,1), opacity .54s ease";
      card.style.transform = `translateX(${exitDirection * 120}%) rotate(${exitDirection * 4}deg)`;
      card.style.opacity = "0";
      window.setTimeout(() => moveFavorite(1), 590);
    } else {
      tracking.card.style.transition = "transform .48s cubic-bezier(.2,.8,.2,1)";
      tracking.card.style.transform = "";
    }
    tracking = null;
  });
  favoritesStack.addEventListener("pointercancel", cancelDrag);
  favoritesStack.addEventListener("lostpointercapture", () => {
    if (tracking) cancelDrag();
  });
  window.addEventListener("blur", cancelDrag);
  window.addEventListener("resize", cancelDrag, { passive: true });
  window.addEventListener("orientationchange", cancelDrag, { passive: true });
}

function setupPreviousRollGesture() {
  const stage = document.getElementById("diceStage3d");
  if (!stage) return;
  let gesture = null;

  const cleanup = (restored = false) => {
    const active = gesture;
    if (!active) return;
    active.layer?.remove();
    stage.classList.remove("previous-gesture-active");
    bridge?.setGestureActive?.(false);
    if (restored) {
      previousRoll = null;
      updateHeart();
    }
    gesture = null;
  };

  const settle = complete => {
    if (!gesture?.started) return cleanup(false);
    gesture.layer.classList.add("settling");
    const width = stage.getBoundingClientRect().width;
    gesture.track.style.transform = `translate3d(${complete ? width : 0}px, 0, 0)`;
    window.setTimeout(() => {
      if (complete) bridge?.restoreRollSnapshot?.(previousRoll);
      cleanup(complete);
    }, 690);
  };

  stage.addEventListener("pointerdown", event => {
    if (!previousRoll || !bridge?.isIdle?.() || activeExpansionScreen) return;
    if (event.clientX < 22 || event.clientX > window.innerWidth - 22) return;
    gesture = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      started: false
    };
    stage.setPointerCapture(event.pointerId);
  });

  stage.addEventListener("pointermove", event => {
    if (!gesture || event.pointerId !== gesture.id) return;
    const dx = Math.max(0, event.clientX - gesture.startX);
    const dy = event.clientY - gesture.startY;
    if (!gesture.started) {
      if (Math.abs(dy) > 16 && Math.abs(dy) > dx) return cleanup(false);
      if (dx < 13) return;

      const currentSource = bridge.captureCurrentPreview();
      const previousSource = bridge.captureRollPreview(previousRoll);
      if (!currentSource || !previousSource) return cleanup(false);
      bridge.hideNotice?.();
      bridge.setGestureActive?.(true);
      const layer = document.createElement("div");
      layer.className = "previous-roll-layer";
      const current = new Image();
      current.className = "previous-roll-frame previous-roll-current";
      current.src = currentSource;
      const previous = new Image();
      previous.className = "previous-roll-frame previous-roll-previous";
      previous.src = previousSource;
      const track = document.createElement("div");
      track.className = "previous-roll-track";
      track.append(previous, current);
      layer.append(track);
      stage.append(layer);
      stage.classList.add("previous-gesture-active");
      gesture = { ...gesture, started: true, layer, track };
    }

    event.preventDefault();
    const width = stage.getBoundingClientRect().width;
    const distance = Math.min(width, dx);
    gesture.track.style.transform = `translate3d(${distance}px, 0, 0)`;
  }, { passive: false });

  stage.addEventListener("pointerup", event => {
    if (!gesture || event.pointerId !== gesture.id) return;
    const dx = event.clientX - gesture.startX;
    settle(Boolean(gesture.started && dx > stage.getBoundingClientRect().width * .28));
  });
  stage.addEventListener("pointercancel", () => settle(false));
  window.addEventListener("blur", () => settle(false));
  window.addEventListener("resize", () => settle(false), { passive: true });
  window.addEventListener("orientationchange", () => settle(false), { passive: true });
}

let guidePreviousRollDemo = null;

function stopGuidePreviousRollDemo() {
  if (!guidePreviousRollDemo) return;
  guidePreviousRollDemo.layer?.remove();
  guidePreviousRollDemo.stage?.classList.remove("previous-gesture-active");
  guidePreviousRollDemo = null;
}

function startGuidePreviousRollDemo() {
  stopGuidePreviousRollDemo();
  const stage = document.getElementById("diceStage3d");
  if (!stage || !bridge?.isIdle?.()) return;

  const currentSource = bridge.captureCurrentPreview();
  const previousSource = previousRoll
    ? bridge.captureRollPreview(previousRoll)
    : currentSource;
  if (!currentSource || !previousSource) return;

  const layer = document.createElement("div");
  layer.className = "previous-roll-layer guide-previous-roll-demo";
  const current = new Image();
  current.className = "previous-roll-frame previous-roll-current";
  current.src = currentSource;
  const previous = new Image();
  previous.className = "previous-roll-frame previous-roll-previous";
  previous.src = previousSource;
  const track = document.createElement("div");
  track.className = "previous-roll-track";
  track.append(previous, current);
  layer.append(track);
  stage.append(layer);
  stage.classList.add("previous-gesture-active");

  guidePreviousRollDemo = {
    stage,
    layer,
    track
  };
}

function bindInterface() {
  const onPointerUp = (element, handler) => element?.addEventListener("pointerup", event => {
    event.preventDefault();
    event.stopPropagation();
    handler();
  }, { passive: false });

  onPointerUp(document.getElementById("themePrevButton"), () => selectAdjacentTheme(-1));
  onPointerUp(document.getElementById("themeNextButton"), () => selectAdjacentTheme(1));
  onPointerUp(document.getElementById("favoritesMenuButton"), () => {
    openFromMenu(favoritesScreen, () => {
      currentFavoriteIndex = 0;
      renderFavoriteStack();
    });
  });
  onPointerUp(document.getElementById("guideMenuButton"), () => {
    bridge?.closeMenu?.();
    bridge?.openGuide?.();
  });
  onPointerUp(document.getElementById("aiImageMenuButton"), () => {
    openFromMenu(aiImageScreen, () => {
      resetAiScreen();
      populateAiFavorites();
    });
  });
  onPointerUp(document.getElementById("aboutMenuButton"), () => openFromMenu(aboutScreen));
  onPointerUp(document.getElementById("privacyMenuButton"), () => openFromMenu(privacyScreen));
  document.querySelectorAll("[data-close-expansion]").forEach(element => {
    element.addEventListener("click", closeExpansionScreen);
  });
  document.getElementById("favoritesBackButton")?.addEventListener("click", closeExpansionScreen);
  favoritesRemoveButton?.addEventListener("click", removeCurrentFavorite);
  favoritesThemeButton?.addEventListener("click", restackFavoriteDeck);
  aiBackButton?.addEventListener("click", closeExpansionScreen);
  favoriteToggle?.addEventListener("click", toggleCurrentFavorite);
  aiGenerateButton?.addEventListener("click", runAiEasterEgg);
  onPointerUp(document.getElementById("aiPagePrev"), () => moveAiFavorite(-1));
  onPointerUp(document.getElementById("aiPageNext"), () => moveAiFavorite(1));
  aiFinishButton?.addEventListener("click", () => {
    resetAiScreen();
    closeExpansionScreen();
  });
  aiSaveButton?.addEventListener("click", () => {
    if (aiRunning || aiSaveButton.disabled) return;
    aiLoadingStatus.textContent = "IMAGE SAVED";
    window.setTimeout(() => {
      if (!aiRunning && aiReveal?.classList.contains("is-complete")) {
        aiLoadingStatus.textContent = "IMAGE FINISHED";
      }
    }, 1800);
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeExpansionScreen();
  });

  const themeObserver = new MutationObserver(() => updateThemeTrack());
  if (classicChoice) themeObserver.observe(classicChoice, { attributes: true, attributeFilter: ["class"] });
  if (fantasyChoice) themeObserver.observe(fantasyChoice, { attributes: true, attributeFilter: ["class"] });
  const fantasyLabel = document.getElementById("fantasyThemeLabel");
  if (fantasyLabel) themeObserver.observe(fantasyLabel, { childList: true, characterData: true, subtree: true });
}

function onBridgeReady(nextBridge) {
  if (bridge) return;
  bridge = nextBridge || window.TattooDiceBridge;
  updateHeart();
}

window.addEventListener("tattoo-dice:bridge-ready", event => onBridgeReady(event.detail?.bridge));
window.addEventListener("tattoo-dice:before-new-roll", event => {
  previousRoll = event.detail?.snapshot || null;
  previousRollPending = true;
  clearHeartImmediately();
  bridge?.hideNotice?.();
});
window.addEventListener("tattoo-dice:roll-settled", () => {
  previousRollPending = false;
  updateHeart();
  if (previousRoll && !previousHintShown) {
    previousHintShown = true;
    const hint = matchMedia("(pointer: coarse)").matches
      ? "SWIPE RIGHT: LAST ROLL"
      : "DRAG RIGHT: LAST ROLL";
    bridge?.showNotice?.(hint, 10000);
  }
});
window.addEventListener("tattoo-dice:roll-context-changed", () => {
  if (previousRollPending) return;
  previousRoll = null;
  bridge?.hideNotice?.();
  clearHeartImmediately();
});
window.addEventListener("tattoo-dice:roll-restored", updateHeart);
window.addEventListener("tattoo-dice:guide-step", event => {
  stopGuidePreviousRollDemo();
  if (event.detail?.id === "previous-roll") startGuidePreviousRollDemo();
});
window.addEventListener("tattoo-dice:guide-close", stopGuidePreviousRollDemo);

rebuildFavoriteCache();
bindInterface();
setupFavoriteStackGesture();
setupPreviousRollGesture();
updateThemeTrack();
if (bridge) updateHeart();
