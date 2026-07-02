let wordCount = 3;
let deck = [];
let secretSequence = "";

const result = document.getElementById("result");
const rollButton = document.getElementById("rollButton");
const diceOptions = document.querySelectorAll(".dice-option");
const counterEl = document.getElementById("counter");

const HIDDEN_MESSAGE = "Keep drawing.";
const HIDDEN_CHANCE = 0.0025;
const SECRET_CODE = "332211";

init();

async function init() {
  await loadDeck();

  result.textContent = makeRoll(wordCount).join(" - ");
  await loadCounter();

  diceOptions.forEach(button => {
    button.addEventListener("click", () => {
      const count = Number(button.dataset.count);
      wordCount = count;
      diceOptions.forEach(b => b.classList.remove("active"));
      button.classList.add("active");

      registerSecretInput(String(count));
      roll({ countIt: false, allowHidden: false });
    });
  });

  rollButton.addEventListener("click", () => roll({ countIt: true, allowHidden: true }));
}

async function loadDeck() {
  const response = await fetch("/decks/classic.json", { cache: "no-store" });
  deck = await response.json();
}

async function roll(options = { countIt: true, allowHidden: true }) {
  if (!deck.length) return;

  if (options.allowHidden && Math.random() < HIDDEN_CHANCE) {
    showHiddenMessage();
    return;
  }

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

      if (options.countIt) incrementCounter();
    }
  }, 65);
}

function makeRoll(count) {
  const chosen = [];
  const usedWords = new Set();
  const usedFamilies = new Set();
  const usedLimitedGroups = new Set();

  let safety = 0;

  while (chosen.length < count && safety < 250) {
    safety++;

    const options = deck.filter(item => {
      if (usedWords.has(item.word)) return false;

      const family = item.family || item.word;
      if (usedFamilies.has(family)) return false;

      // Keep the roll free, but avoid stacking elements that feel like the same job.
      if (item.group === "effect" && usedLimitedGroups.has("effect")) return false;
      if (item.group === "floral" && usedLimitedGroups.has("floral")) return false;
      if (item.group === "weapon" && usedLimitedGroups.has("weapon")) return false;

      return true;
    });

    if (options.length === 0) break;

    const picked = weightedPick(options);
    chosen.push(picked.word);
    usedWords.add(picked.word);
    usedFamilies.add(picked.family || picked.word);

    if (["effect", "floral", "weapon"].includes(picked.group)) {
      usedLimitedGroups.add(picked.group);
    }
  }

  return chosen;
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
    showHiddenMessage();
  }
}

function showHiddenMessage() {
  result.classList.remove("rolling");
  rollButton.classList.remove("rolling");
  result.textContent = HIDDEN_MESSAGE;
}

async function loadCounter() {
  counterEl.textContent = "Loading roll count...";

  try {
    const response = await fetch("/.netlify/functions/roll-counter", { cache: "no-store" });
    if (!response.ok) throw new Error("Counter request failed");
    const data = await response.json();
    updateCounter(data.count);
  } catch (error) {
    counterEl.textContent = "Ideas rolled: --";
  }
}

async function incrementCounter() {
  try {
    const response = await fetch("/.netlify/functions/roll-counter", {
      method: "POST",
      cache: "no-store"
    });
    if (!response.ok) throw new Error("Counter request failed");
    const data = await response.json();
    updateCounter(data.count);
  } catch (error) {
    counterEl.textContent = "Ideas rolled: --";
  }
}

function updateCounter(count) {
  if (typeof count !== "number") return;
  counterEl.textContent = `${formatNumber(count)} tattoo ideas rolled`;
}

function formatNumber(number) {
  return new Intl.NumberFormat("en-US").format(number);
}
