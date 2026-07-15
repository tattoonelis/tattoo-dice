import { initAdminDice, setAdminDiceDeck, showAdminDice } from "./admin-dice.js";

function initAdminPwa(){
  if("serviceWorker" in navigator){navigator.serviceWorker.register("./sw.js").catch(()=>{});}
  const standalone=window.matchMedia("(display-mode: standalone)").matches||window.navigator.standalone===true;
  const ios=/iphone|ipad|ipod/i.test(navigator.userAgent);
  if(ios&&!standalone){const hint=document.getElementById("installHint");if(hint){hint.hidden=false;setTimeout(()=>{hint.hidden=true;},8500);}}
}

const SUPABASE_URL = "https://gkcsiqgsovbbavunibmv.supabase.co";
const SUPABASE_KEY = "sb_publishable_la1MqfOB-NqB0pMK1_ruJg_0UUZKrAV";
const TABLE = "admin_rankings";
const MILESTONE_MESSAGES = {"5": "Nice. 5% done. We’re officially rolling.", "10": "Damn son. 10% done. Keep going.", "15": "15%. Your taste is becoming data.", "20": "20% done. This formula is getting smarter.", "25": "Quarter done. Not bad, tattoo wizard.", "30": "30%. You’re cooking now.", "35": "35% done. Bad rolls are getting nervous.", "40": "40%. The deck is starting to fear you.", "45": "45%. Almost halfway, you magnificent bastard.", "50": "Halfway there. Holy sh*t.", "55": "55%. No turning back now.", "60": "60% done. The formula is learning your language.", "65": "65%. That’s a suspicious amount of dedication.", "70": "70%. You’re bullying this deck into shape.", "75": "Three quarters done. Absolute machine.", "80": "80%. The finish line is sweating.", "85": "85%. Almost disgustingly productive.", "90": "90%. Final stretch, don’t get soft now.", "95": "95%. Five percent between you and glory.", "100": "You did it, m*therf*cker!"};
const ADMIN_PIN = "231189";

const WEIGHT_BY_SCORE = {0: 0.25, 1: 2, 2: 6, 3: 12};

let deck = [];
let currentRoll = [];
let selectedRating = "open";
let records = [];
let storageMode = "supabase";
let adminPinInput = "";
let adminUnlocked = false;

const themeSelect = document.getElementById("themeSelect");
const diceCount = document.getElementById("diceCount");
const mainSelect = document.getElementById("mainSelect");
const rollButton = document.getElementById("rollButton");
const rejectButton = document.getElementById("rejectButton");
const approveButton = document.getElementById("approveButton");
const mehButton = document.getElementById("mehButton");
const resultWords = document.getElementById("resultWords");
const resultTheme = document.getElementById("resultTheme");
const resultCount = document.getElementById("resultCount");
const noteInput = document.getElementById("noteInput");
const saveButton = document.getElementById("saveButton");
const skipButton = document.getElementById("skipButton");
const statusMessage = document.getElementById("statusMessage");
const rankingBody = document.getElementById("rankingBody");
const recentList = document.getElementById("recentList");
const exportButton = document.getElementById("exportButton");
const refreshButton = document.getElementById("refreshButton");
const statsToggle=document.getElementById("statsToggle");
const statsDrawer=document.getElementById("statsDrawer");
const progressTheme=document.getElementById("progressTheme");
const progressPercent=document.getElementById("progressPercent");
const progressFill=document.getElementById("progressFill");
const progressCount=document.getElementById("progressCount");
const milestoneOverlay=document.getElementById("milestoneOverlay");
const milestonePercent=document.getElementById("milestonePercent");
const milestoneText=document.getElementById("milestoneText");

const adminPinGate = document.getElementById("adminPinGate");
const adminPinDisplay = document.getElementById("adminPinDisplay");
const adminPinKeypad = document.getElementById("adminPinKeypad");
const adminPinStatus = document.getElementById("adminPinStatus");
const adminDiceScene = document.getElementById("adminDiceScene");


initAdminPin();


function initAdminPin(){
  initAdminPwa();
  setMilestoneVisible(false);
  if(adminDiceScene && !adminDiceScene.dataset.ready){
    initAdminDice(adminDiceScene);
    adminDiceScene.dataset.ready = "true";
  }
  updateAdminPinDisplay();

  adminPinKeypad?.addEventListener("click", event => {
    const key = event.target.closest("[data-pin-key]");
    const action = event.target.closest("[data-pin-action]");

    if(key){
      if(adminPinInput.length < ADMIN_PIN.length){
        adminPinInput += key.dataset.pinKey;
        updateAdminPinDisplay();
      }

      if(adminPinInput.length === ADMIN_PIN.length){
        if(adminPinInput === ADMIN_PIN){
          adminUnlocked = true;
          document.body.classList.remove("admin-locked");
          adminPinGate.classList.add("hidden");
          adminPinGate.setAttribute("aria-hidden","true");
          adminPinStatus.textContent = "";
          init();
        }else{
          adminPinStatus.textContent = "Incorrect PIN";
          setTimeout(() => {
            adminPinInput = "";
            updateAdminPinDisplay();
            adminPinStatus.textContent = "";
          },450);
        }
      }
      return;
    }

    if(action?.dataset.pinAction === "clear"){
      adminPinInput = "";
      adminPinStatus.textContent = "";
      updateAdminPinDisplay();
    }

    if(action?.dataset.pinAction === "backspace"){
      adminPinInput = adminPinInput.slice(0,-1);
      adminPinStatus.textContent = "";
      updateAdminPinDisplay();
    }
  });
}

function updateAdminPinDisplay(){
  [...(adminPinDisplay?.children || [])].forEach((dot,index) => {
    dot.classList.toggle("filled",index < adminPinInput.length);
  });
}


async function init(){
  bindEvents();
  await loadDeck();
  roll();
  await refreshRecords();
}

function bindEvents(){
  themeSelect.addEventListener("change", async () => {
    await loadDeck();
    updateProgress();
    roll();
  });
  diceCount.addEventListener("change", roll);
  mainSelect.addEventListener("change", roll);
  rollButton?.addEventListener("click", roll);

  document.querySelectorAll("[data-rating]").forEach(button => {
    button.addEventListener("click", () => {
      selectedRating = button.dataset.rating;
      document.querySelectorAll("[data-rating]").forEach(other => {
        other.classList.toggle("active", other === button);
      });
    });
  });

  saveButton?.addEventListener("click", saveCurrent);
  skipButton?.addEventListener("click", roll);
  refreshButton.addEventListener("click", refreshRecords);
  rejectButton?.addEventListener("click", () => saveVerdict("down"));
  approveButton?.addEventListener("click", () => saveVerdict("up"));
  mehButton?.addEventListener("click", () => saveVerdict("meh"));
  milestoneOverlay?.addEventListener("pointerup", hideMilestoneOverlay);
  exportButton.addEventListener("click", exportCsv);
  statsToggle?.addEventListener("click",()=>setStatsDrawer(true));
  statsDrawer?.querySelectorAll("[data-close-stats]").forEach(el=>el.addEventListener("click",()=>setStatsDrawer(false)));
  rankingBody?.addEventListener("click", event => {
    const button = event.target.closest("[data-delete-key]");
    if(button) deleteRanking(button.dataset.deleteKey);
  });
}

async function loadDeck(){
  const theme = themeSelect.value;
  const response = await fetch(`../decks/${theme}.json`, {cache:"no-store"});
  if(!response.ok) throw new Error(`Could not load ${theme} deck.`);
  deck = await response.json();
  setAdminDiceDeck(deck);

  // Accept either explicit weight or derive it from score.
  deck = deck.map(item => ({
    ...item,
    weight: Number(item.weight ?? WEIGHT_BY_SCORE[Number(item.score)] ?? 1)
  }));

  const mains = [...new Set(
    deck
      .filter(item => item.slot === "main" && Number(item.score) >= 3)
      .map(item => item.word)
  )].sort((a,b) => a.localeCompare(b));

  mainSelect.innerHTML = '<option value="Random">Random</option>';
  mains.forEach(word => {
    const option = document.createElement("option");
    option.value = word;
    option.textContent = word;
    mainSelect.append(option);
  });
}

function roll(){
  const count = Number(diceCount.value);
  currentRoll = makeRoll(count);
  renderRoll();
  noteInput.value = "";
  selectedRating = "open";
  setStatus("");
}

function makeRoll(count){
  const plan = count === 1
    ? ["main"]
    : count === 2
      ? ["main","detail"]
      : ["main","detail","effect"];

  const chosen = [];
  const chosenWords = new Set();
  const usedFamilies = new Set();
  const forced = mainSelect.value;

  if(forced !== "Random"){
    const item = deck.find(entry => entry.slot === "main" && entry.word === forced);
    if(item){
      chosen.push(item);
      chosenWords.add(item.word);
      if(item.family) usedFamilies.add(item.family);
    }
  }

  for(let index = chosen.length; index < plan.length; index++){
    const slot = plan[index];
    let picked = pickForSlot(slot, usedFamilies, chosenWords);

    if(!picked && slot === "effect"){
      picked = pickForSlot("detail", usedFamilies, chosenWords);
    }
    if(!picked && slot === "detail"){
      picked = pickForSlot("main", usedFamilies, chosenWords);
    }
    if(!picked) break;

    chosen.push(picked);
    chosenWords.add(picked.word);
    if(picked.family) usedFamilies.add(picked.family);
  }

  return chosen;
}

function pickForSlot(slot, usedFamilies, chosenWords){
  let candidates = deck.filter(item =>
    item.slot === slot &&
    !chosenWords.has(item.word) &&
    (!item.family || !usedFamilies.has(item.family))
  );

  if(!candidates.length){
    candidates = deck.filter(item =>
      item.slot === slot &&
      !chosenWords.has(item.word)
    );
  }

  return weightedChoice(candidates);
}

function weightedChoice(items){
  if(!items.length) return null;
  const total = items.reduce((sum,item) => sum + Math.max(.001,Number(item.weight)||1),0);
  let cursor = Math.random() * total;
  for(const item of items){
    cursor -= Math.max(.001,Number(item.weight)||1);
    if(cursor <= 0) return item;
  }
  return items[items.length - 1];
}

function renderRoll(){
  const words = currentRoll.map(item => item.word);
  showAdminDice(words, true);
  resultTheme.textContent = capitalise(themeSelect.value);
  resultCount.textContent = `${words.length} ${words.length === 1 ? "die" : "dice"}`;
}

function setRating(rating){
  selectedRating = rating;
  document.querySelectorAll("[data-rating]").forEach(button => {
    button.classList.toggle("active", button.dataset.rating === rating);
  });
}

async function saveVerdict(rating){
  selectedRating = rating;
  await saveCurrent();
}

async function saveCurrent(){
  if(!currentRoll.length) return;

  const words = currentRoll.map(item => item.word);
  const savedTheme = themeSelect.value;
  const beforeThemeCount = records.filter(item => item.theme === savedTheme).length;
  const record = {
    theme: themeSelect.value,
    dice_count: words.length,
    selected_main: mainSelect.value,
    words,
    combination_key: canonicalKey(themeSelect.value, words),
    rating: selectedRating,
    note: noteInput.value.trim() || null,
    user_agent: navigator.userAgent.slice(0,500)
  };

  if(saveButton) saveButton.disabled = true;
  setStatus("Saving…");

  try{
    await insertSupabase(record);
    storageMode = "supabase";
    setStatus("Saved. Rolling next combination…","success");
  }catch(error){
    storageMode = "local";
    saveLocal(record);
    setStatus("Saved locally. Run admin/setup.sql in Supabase for shared storage.","error");
  }finally{
    if(saveButton) saveButton.disabled = false;
    await refreshRecords();
    const afterThemeCount = records.filter(item => item.theme === savedTheme).length;
    maybeShowMilestone(savedTheme,beforeThemeCount,afterThemeCount);
    setTimeout(roll,260);
  }
}

async function insertSupabase(record){
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}`,{
    method:"POST",
    headers:{
      apikey:SUPABASE_KEY,
      authorization:`Bearer ${SUPABASE_KEY}`,
      "Content-Type":"application/json",
      Prefer:"return=minimal"
    },
    body:JSON.stringify(record)
  });

  if(!response.ok){
    throw new Error(await response.text());
  }
}

async function refreshRecords(){
  try{
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/${TABLE}?select=*&order=created_at.desc&limit=5000`,
      {
        headers:{
          apikey:SUPABASE_KEY,
          authorization:`Bearer ${SUPABASE_KEY}`
        }
      }
    );
    if(!response.ok) throw new Error(await response.text());
    records = await response.json();
    storageMode = "supabase";
  }catch(error){
    records = loadLocal();
    storageMode = "local";
  }
  renderDashboard();
}


function setMilestoneVisible(visible){
  if(!milestoneOverlay) return;
  milestoneOverlay.hidden = !visible;
  milestoneOverlay.classList.toggle("show",visible);
  milestoneOverlay.setAttribute("aria-hidden",String(!visible));
}

function milestoneStorageKey(theme){
  return `tattooDiceAdminMilestones_${theme}`;
}

function getSeenMilestones(theme){
  try{
    return new Set(JSON.parse(localStorage.getItem(milestoneStorageKey(theme)) || "[]"));
  }catch{
    return new Set();
  }
}

function markMilestoneSeen(theme,percent){
  const seen = getSeenMilestones(theme);
  seen.add(percent);
  localStorage.setItem(
    milestoneStorageKey(theme),
    JSON.stringify([...seen].sort((a,b) => a-b))
  );
}

function maybeShowMilestone(theme,beforeCount,afterCount){
  if(!milestoneOverlay || afterCount <= beforeCount) return;

  const beforePercent = Math.floor((beforeCount / 3000) * 100);
  const afterPercent = Math.min(100,Math.floor((afterCount / 3000) * 100));
  const reached = Math.floor(afterPercent / 5) * 5;

  if(reached < 5 || reached <= beforePercent || !MILESTONE_MESSAGES[reached]) return;
  if(getSeenMilestones(theme).has(reached)) return;

  markMilestoneSeen(theme,reached);
  milestonePercent.textContent = `${reached}%`;
  milestoneText.textContent = MILESTONE_MESSAGES[reached];
  setMilestoneVisible(true);
}

function hideMilestoneOverlay(){
  setMilestoneVisible(false);
}

function setStatsDrawer(open){statsDrawer?.classList.toggle("open",open);statsDrawer?.setAttribute("aria-hidden",String(!open));}
function updateProgress(){const theme=themeSelect.value;const count=records.filter(i=>i.theme===theme).length;const percent=Math.min(100,count/3000*100);progressTheme.textContent=`${capitalise(theme)} progress`;progressPercent.textContent=`${percent.toFixed(percent>=10?0:1)}%`;progressFill.style.width=`${percent}%`;progressCount.textContent=count;}
function renderDashboard(){
  const up = records.filter(item => item.rating === "up").length;
  const down = records.filter(item => item.rating === "down").length;
  const meh = records.filter(item => item.rating === "meh").length;
  const open = records.filter(item => item.rating === "open").length;

  document.getElementById("totalRatings").textContent = records.length;
  document.getElementById("upRatings").textContent = up;
  document.getElementById("downRatings").textContent = down;
  document.getElementById("mehRatings").textContent = meh;
  document.getElementById("openRatings").textContent = open;
  updateProgress();

  const groups = new Map();
  records.forEach(record => {
    const key = record.combination_key || canonicalKey(record.theme,record.words || []);
    if(!groups.has(key)){
      groups.set(key,{
        key,
        theme:record.theme,
        words:record.words || [],
        up:0,down:0,meh:0,open:0,total:0
      });
    }
    const group = groups.get(key);
    group[record.rating] = (group[record.rating] || 0) + 1;
    group.total += 1;
  });

  const ranked = [...groups.values()]
    .map(group => ({
      ...group,
      net:(group.up*2)+group.meh-(group.down*2),
      verdict:(group.up*2+group.meh)>(group.down*2)?"up":(group.down*2)>(group.up*2+group.meh)?"down":"open"
    }))
    .sort((a,b) => b.total-a.total || Math.abs(b.net)-Math.abs(a.net));

  rankingBody.innerHTML = ranked.length
    ? ranked.map(group => `
      <tr>
        <td>${group.words.map(escapeHtml).join(" + ")}</td>
        <td>${capitalise(group.theme)}</td>
        <td>${group.up}</td>
        <td>${group.down}</td>
        <td>${group.meh}</td>
        <td>${group.open}</td>
        <td class="verdict-${group.verdict}">${verdictLabel(group.verdict)}</td>
        <td>${group.net > 0 ? "+" : ""}${group.net}</td>
        <td><button class="delete-ranking-button" type="button" data-delete-key="${escapeHtml(group.key)}" aria-label="Delete ranking">×</button></td>
      </tr>
    `).join("")
    : '<tr><td colspan="9" class="empty-cell">No saved rankings yet.</td></tr>';

  const notes = records.filter(item => item.note).slice(0,30);
  recentList.innerHTML = notes.length
    ? notes.map(item => `
      <article class="recent-item">
        <strong>${(item.words || []).map(escapeHtml).join(" + ")}</strong>
        <p>${escapeHtml(item.note)}</p>
        <small>${verdictLabel(item.rating)} · ${capitalise(item.theme)} · ${formatDate(item.created_at)}</small>
      </article>
    `).join("")
    : '<p class="empty-cell">No notes yet.</p>';

  if(storageMode === "local"){
    setStatus("Local fallback active. Shared cross-device storage needs the included Supabase SQL.","error");
  }
}


async function deleteRanking(combinationKey){
  if(!combinationKey) return;
  if(!window.confirm("Delete this complete ranking and all votes for it?")) return;

  setStatus("Deleting ranking…");

  try{
    if(storageMode === "supabase"){
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/${TABLE}?combination_key=eq.${encodeURIComponent(combinationKey)}`,
        {
          method:"DELETE",
          headers:{
            apikey:SUPABASE_KEY,
            authorization:`Bearer ${SUPABASE_KEY}`,
            Prefer:"return=minimal"
          }
        }
      );
      if(!response.ok) throw new Error(await response.text());
    }else{
      const remaining = loadLocal().filter(item =>
        (item.combination_key || canonicalKey(item.theme,item.words || [])) !== combinationKey
      );
      localStorage.setItem("tattooDiceAdminRankings",JSON.stringify(remaining));
    }

    records = records.filter(item =>
      (item.combination_key || canonicalKey(item.theme,item.words || [])) !== combinationKey
    );
    renderDashboard();
    setStatus("Ranking deleted.","success");
  }catch(error){
    setStatus("Could not delete. Run the updated admin/setup.sql once in Supabase.","error");
  }
}

function saveLocal(record){
  const local = loadLocal();
  local.unshift({
    id:crypto.randomUUID?.() || String(Date.now()),
    created_at:new Date().toISOString(),
    ...record
  });
  localStorage.setItem("tattooDiceAdminRankings",JSON.stringify(local.slice(0,5000)));
}
function loadLocal(){
  try{
    return JSON.parse(localStorage.getItem("tattooDiceAdminRankings") || "[]");
  }catch{
    return [];
  }
}

function exportCsv(){
  const header = ["created_at","theme","dice_count","selected_main","words","rating","note","combination_key"];
  const rows = records.map(record => [
    record.created_at || "",
    record.theme || "",
    record.dice_count || "",
    record.selected_main || "",
    (record.words || []).join(" + "),
    record.rating || "",
    record.note || "",
    record.combination_key || ""
  ]);
  const csv = [header,...rows]
    .map(row => row.map(csvCell).join(","))
    .join("\n");
  downloadBlob(csv,"tattoo-dice-admin-rankings.csv","text/csv;charset=utf-8");
}

function canonicalKey(theme,words){
  return `${theme}|${[...words].map(word => word.trim().toLowerCase()).sort().join("|")}`;
}
function verdictLabel(value){
  return value === "up" ? "Positive" : value === "down" ? "Negative" : value === "meh" ? "Meh" : "Open";
}
function capitalise(value){
  return value ? value.charAt(0).toUpperCase()+value.slice(1) : "";
}
function formatDate(value){
  if(!value) return "Local";
  return new Intl.DateTimeFormat("en-GB",{dateStyle:"medium",timeStyle:"short"}).format(new Date(value));
}
function setStatus(message,type=""){
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;
}
function csvCell(value){
  const text = String(value ?? "");
  return `"${text.replaceAll('"','""')}"`;
}
function downloadBlob(content,filename,type){
  const url = URL.createObjectURL(new Blob([content],{type}));
  const link = document.createElement("a");
  link.href=url;
  link.download=filename;
  link.click();
  URL.revokeObjectURL(url);
}
function escapeHtml(value){
  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
