const resultEl = document.getElementById("result");
const rollButton = document.getElementById("rollButton");
const countButtons = document.querySelectorAll("[data-count]");
const counterEl = document.getElementById("counter");

let selectedCount = 3;
let deck = [];

const SECRET_CODE = "332211";
let codeBuffer = "";
const HIDDEN_MESSAGE = "Keep drawing";

const COUNTER_ENDPOINT = "/.netlify/functions/roll-counter";

init();

async function init() {
  await loadDeck();
  bindControls();
  await loadCounter();
}

async function loadDeck() {
  try {
    const response = await fetch("./decks/classic.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Deck request failed");
    deck = await response.json();
  } catch (error) {
    console.error("Could not load deck:", error);
    deck = [];
  }
}

function bindControls() {
  countButtons.forEach(button => {
    button.addEventListener("click", () => {
      selectedCount = Number(button.dataset.count || 3);

      countButtons.forEach(btn => btn.classList.remove("active"));
      button.classList.add("active");

      codeBuffer = `${codeBuffer}${selectedCount}`.slice(-SECRET_CODE.length);

      if (codeBuffer === SECRET_CODE) {
        resultEl.textContent = HIDDEN_MESSAGE;
        codeBuffer = "";
      }
    });
  });

  if (rollButton) {
    rollButton.addEventListener("click", async () => {
      const words = makeRoll(selectedCount);
      resultEl.textContent = words.join(" - ");
      await incrementCounter();
    });
  }
}

function makeRoll(count) {
  if (!deck.length) return ["No deck loaded"];

  // Original Tattoo Dice feel:
  // 1 = Main
  // 2 = Main + Detail
  // 3 = Main + Detail + Effect
  const plan =
    count === 1 ? ["main"] :
    count === 2 ? ["main", "detail"] :
    ["main", "detail", "effect"];

  const chosen = [];
  const usedFamilies = new Set();

  for (const slot of plan) {
    let picked = pickSlot(slot, usedFamilies);

    // Keep the requested amount of words, but do not force bad doubles.
    if (!picked && slot === "effect") picked = pickSlot("detail", usedFamilies);
    if (!picked && slot === "detail") picked = pickSlot("main", usedFamilies);

    if (!picked) continue;

    chosen.push(picked.word);
    usedFamilies.add(getFamily(picked));
  }

  return chosen.length ? chosen : ["Roll again"];
}

function pickSlot(slot, usedFamilies) {
  const options = deck.filter(item => {
    const itemSlot = item.slot || item.group || "main";
    if (itemSlot !== slot) return false;

    const family = getFamily(item);
    if (usedFamilies.has(family)) return false;

    // Extra safety: effects, flowers and weapons should not stack by family.
    if (slot === "effect" && hasAnyEffectFamily(usedFamilies) && isEffect(item)) return false;

    return true;
  });

  if (!options.length) return null;
  return weightedPick(options);
}

function getFamily(item) {
  return item.family || item.word.toLowerCase().replace(/\s+/g, "-");
}

function isEffect(item) {
  return (item.slot || item.group) === "effect";
}

function hasAnyEffectFamily(usedFamilies) {
  return ["fire", "water", "smoke", "lightning", "blood", "skin-rip"].some(family => usedFamilies.has(family));
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

async function loadCounter() {
  if (!counterEl) return;

  try {
    const response = await fetch(COUNTER_ENDPOINT, {
      method: "GET",
      cache: "no-store"
    });

    if (!response.ok) throw new Error("Counter request failed");

    const data = await response.json();
    renderCounter(data.count || 0);
  } catch (error) {
    console.warn("Counter unavailable:", error);
    renderCounter(0);
  }
}

async function incrementCounter() {
  if (!counterEl) return;

  try {
    const response = await fetch(COUNTER_ENDPOINT, {
      method: "POST"
    });

    if (!response.ok) throw new Error("Counter increment failed");

    const data = await response.json();
    renderCounter(data.count || 0);
  } catch (error) {
    console.warn("Counter increment unavailable:", error);
  }
}

function renderCounter(count) {
  if (!counterEl) return;
  counterEl.textContent = `${formatNumber(count)} tattoo ideas rolled`;
}

function formatNumber(number) {
  return new Intl.NumberFormat("en-US").format(Number(number || 0));
}
