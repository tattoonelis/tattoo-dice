const resultEl = document.getElementById("result");
const rollBtn = document.getElementById("rollBtn");
const countButtons = document.querySelectorAll("[data-count]");
const counterEl = document.getElementById("rollCounter");

let selectedCount = 3;
let deck = [];

const SECRET_CODE = "332211";
let codeBuffer = "";
const hiddenMessages = ["Keep drawing"];
const COUNTER_ENDPOINT = "/.netlify/functions/roll-counter";

async function init() {
  await loadDeck();
  bindControls();
  await loadCounter();
}

async function loadDeck() {
  try {
    const response = await fetch("./decks/classic.json", { cache: "no-store" });
    deck = await response.json();
  } catch (error) {
    console.error("Could not load deck:", error);
    deck = [];
  }
}

function bindControls() {
  countButtons.forEach(button => {
    button.addEventListener("click", () => {
      selectedCount = Number(button.dataset.count);
      countButtons.forEach(btn => btn.classList.remove("active"));
      button.classList.add("active");
      codeBuffer = (codeBuffer + selectedCount).slice(-SECRET_CODE.length);
      if (codeBuffer === SECRET_CODE) {
        showHiddenMessage();
        codeBuffer = "";
      }
    });
  });

  if (rollBtn) {
    rollBtn.addEventListener("click", async () => {
      const roll = makeRoll(selectedCount);
      resultEl.textContent = roll.join(" - ");
      await incrementCounter();
    });
  }
}

function showHiddenMessage() {
  const message = hiddenMessages[Math.floor(Math.random() * hiddenMessages.length)];
  resultEl.textContent = message;
}

function makeRoll(count) {
  if (!deck.length) return ["No deck loaded"];

  const plan = count === 1
    ? ["main"]
    : count === 2
      ? ["main", "detail"]
      : ["main", "detail", "effect"];

  const chosen = [];
  const usedWords = new Set();
  const usedFamilies = new Set();

  for (const slot of plan) {
    let picked = pickFromSlot(slot, usedWords, usedFamilies);
    if (!picked && slot === "effect") picked = pickFromSlot("detail", usedWords, usedFamilies);
    if (!picked && slot === "detail") picked = pickFromSlot("main", usedWords, usedFamilies);
    if (!picked) break;
    chosen.push(picked.word);
    usedWords.add(picked.word);
    usedFamilies.add(familyOf(picked));
  }
  return chosen;
}

function pickFromSlot(slot, usedWords, usedFamilies) {
  const options = deck.filter(item => {
    if ((item.slot || item.group) !== slot) return false;
    if (usedWords.has(item.word)) return false;
    if (usedFamilies.has(familyOf(item))) return false;
    return true;
  });
  return options.length ? weightedPick(options) : null;
}

function familyOf(item) {
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

async function loadCounter() {
  if (!counterEl) return;
  try {
    const response = await fetch(COUNTER_ENDPOINT, { method: "GET", cache: "no-store" });
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
    const response = await fetch(COUNTER_ENDPOINT, { method: "POST" });
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

init();
