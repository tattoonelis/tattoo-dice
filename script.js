let wordCount = 3;
let deck = [];
let secretSequence = "";
let hiddenActive = false;
let rollInProgress = false;

const result = document.getElementById("result");
const rollButton = document.getElementById("rollButton");
const diceOptions = document.querySelectorAll(".dice-option");
const counterEl = document.getElementById("counter");

const SECRET_CODE = "332211";
const HIDDEN_MESSAGE = "Keep drawing";
const COUNTER_ENDPOINT = "/.netlify/functions/roll-counter";

init();

async function init() {
  await loadDeck();
  result.textContent = makeRoll(wordCount).join(" - ");
  await loadCounter();

  diceOptions.forEach(button => {
    button.addEventListener("click", () => {
      wordCount = Number(button.dataset.count);
      diceOptions.forEach(b => b.classList.remove("active"));
      button.classList.add("active");
      registerSecretInput(String(wordCount));

      if (!hiddenActive && !rollInProgress) {
        result.textContent = makeRoll(wordCount).join(" - ");
      }
    });
  });

  rollButton.addEventListener("click", () => {
    hiddenActive = false;
    roll({ countIt: true });
  });
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
  result.classList.add("rolling");
  rollButton.classList.add("rolling");

  let ticks = 0;
  const interval = setInterval(() => {
    result.textContent = makeRoll(wordCount).join(" - ");
    ticks++;

    if (ticks >= 12) {
      clearInterval(interval);
      result.textContent = makeRoll(wordCount).join(" - ");
      result.classList.remove("rolling");
      rollButton.classList.remove("rolling");
      rollInProgress = false;

      if (options.countIt) incrementCounter();
    }
  }, 65);
}

function makeRoll(count) {
  const plan = count === 1 ? ["main"] : count === 2 ? ["main", "detail"] : ["main", "detail", "effect"];
  const chosen = [];
  const usedFamilies = new Set();

  for (const slot of plan) {
    let picked = pickForSlot(slot, usedFamilies);
    if (!picked && slot === "effect") picked = pickForSlot("detail", usedFamilies);
    if (!picked && slot === "detail") picked = pickForSlot("main", usedFamilies);
    if (!picked) continue;

    chosen.push(picked.word);
    usedFamilies.add(getFamily(picked));
  }

  return chosen.length ? chosen : ["Roll again"];
}

function pickForSlot(slot, usedFamilies) {
  const options = deck.filter(item => item.slot === slot && !usedFamilies.has(getFamily(item)));
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
  result.classList.remove("rolling");
  rollButton.classList.remove("rolling");
  result.textContent = HIDDEN_MESSAGE;
}

async function loadCounter() {
  if (!counterEl) return;

  try {
    const response = await fetch(COUNTER_ENDPOINT, { method: "GET", cache: "no-store" });
    if (!response.ok) throw new Error("Counter request failed");
    const data = await response.json();
    renderCounter(data.count || 0);
  } catch (error) {
    console.warn("Counter unavailable:", error);
    counterEl.textContent = "";
  }
}

async function incrementCounter() {
  if (!counterEl) return;

  try {
    const response = await fetch(COUNTER_ENDPOINT, { method: "POST" });
    if (!response.ok) throw new Error("Counter increment failed");
    const data = await response.json();
    renderCounter(data.count || 0);
  } catch (error) {
    console.warn("Counter increment unavailable:", error);
  }
}

function renderCounter(count) {
  counterEl.textContent = `${formatNumber(count)} tattoo ideas rolled`;
}

function formatNumber(number) {
  return new Intl.NumberFormat("en-US").format(Number(number || 0));
}
