const SUPABASE_URL="https://gkcsiqgsovbbavunibmv.supabase.co";
const SUPABASE_KEY="sb_publishable_la1MqfOB-NqB0pMK1_ruJg_0UUZKrAV";
const CANON_TABLE="canon_subjects";
const RANKINGS_TABLE="admin_rankings";
const ADMIN_PIN="231189";
const STORAGE_KEY="tattooDiceCanonV1";
const WEIGHTS={0:.25,1:2,2:6,3:12};

let db=null;
let currentSubjectId="";
let currentView="subject";
let exportTheme="classic";
let testDiceCount=3;
let currentTest=null;
let relationMode="boost";
let saveTimer=0;
let pinInput="";
let initialized=false;
let cloudAvailable=false;
let historyBySubject=new Map();
let historyRowKeys=new Set();

const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];

initPin();
if("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(()=>{});

function initPin(){
  $("#pinKeypad").addEventListener("click",event=>{
    const key=event.target.closest("[data-pin]");
    const action=event.target.closest("[data-action]");
    if(key && pinInput.length<ADMIN_PIN.length) pinInput+=key.dataset.pin;
    if(action?.dataset.action==="clear") pinInput="";
    if(action?.dataset.action==="back") pinInput=pinInput.slice(0,-1);
    $$("#pinDots i").forEach((dot,index)=>dot.classList.toggle("filled",index<pinInput.length));
    if(pinInput.length===ADMIN_PIN.length){
      if(pinInput===ADMIN_PIN){
        $("#pinGate").classList.add("hidden");
        document.body.classList.remove("canon-locked");
        $("#app").setAttribute("aria-hidden","false");
        if(!initialized) initialize();
      }else{
        $("#pinStatus").textContent="Incorrect PIN";
        setTimeout(()=>{pinInput="";$("#pinStatus").textContent="";$$("#pinDots i").forEach(dot=>dot.classList.remove("filled"));},450);
      }
    }
  });
}

async function initialize(){
  initialized=true;
  bindEvents();
  setSaveStatus("Loading…","saving");
  const seed=await fetch("./canon-seed.json",{cache:"no-store"}).then(response=>{
    if(!response.ok) throw new Error("Canon seed could not be loaded.");
    return response.json();
  });
  db=mergeDatabase(seed,loadLocal());
  await loadCloudSubjects();
  currentSubjectId=db.subjects.find(subject=>subject.name==="Dog")?.id || db.subjects[0]?.id;
  renderStaticChoices();
  renderSubject();
  renderQueue();
  renderExport();
  if(db.imports?.rankings?.rows) applyHistoryRows(db.imports.rankings.rows,false);
  if(db.imports?.highlights?.rows) applyHistoryRows(db.imports.highlights.rows,true);
  loadAdminHistory().then(()=>{renderSubjectMeta();renderQueue();}).catch(()=>{});
  setSaveStatus("Saved","saved");
}

function bindEvents(){
  $$("[data-view]").forEach(button=>button.addEventListener("click",()=>setView(button.dataset.view)));
  $("#subjectSearch").addEventListener("input",renderSearchResults);
  $("#subjectSearch").addEventListener("focus",renderSearchResults);
  document.addEventListener("pointerdown",event=>{if(!event.target.closest(".subject-picker")) $("#searchResults").hidden=true;});
  $("#newSubjectButton").addEventListener("click",addSubject);
  $("#previousSubject").addEventListener("click",()=>stepSubject(-1));
  $("#nextSubject").addEventListener("click",()=>stepSubject(1));
  $("#nameInput").addEventListener("input",()=>updateField("name",$("#nameInput").value));
  $("#activeInput").addEventListener("change",()=>updateField("active",$("#activeInput").checked));
  $("#familyInput").addEventListener("input",()=>updateField("family",$("#familyInput").value));
  $("#notesInput").addEventListener("input",()=>updateField("notes",$("#notesInput").value));
  $("#slotChips").addEventListener("click",event=>toggleArrayChoice(event,"slot","slots"));
  $("#scoreButtons").addEventListener("click",event=>{
    const button=event.target.closest("[data-score]"); if(!button) return;
    const subject=getCurrentSubject(); subject.score=Number(button.dataset.score); subject.weight=WEIGHTS[subject.score];
    markChanged(subject,"score"); scheduleSave(subject); renderScore(subject);
  });
  $("#themeChips").addEventListener("click",event=>toggleArrayChoice(event,"theme","themes"));
  $("#useChips").addEventListener("click",event=>toggleArrayChoice(event,"use","uses"));
  $$("[data-add-relation]").forEach(button=>button.addEventListener("click",()=>openRelationDialog(button.dataset.addRelation)));
  $("#relationSearch").addEventListener("input",renderRelationResults);
  $("#relationResults").addEventListener("click",event=>{
    const button=event.target.closest("[data-relation-id]"); if(!button) return;
    const subject=getCurrentSubject(); const partner=db.subjects.find(item=>item.id===button.dataset.relationId); if(!partner) return;
    const list=subject.relations[relationMode] || (subject.relations[relationMode]=[]);
    if(!list.includes(partner.name)) list.push(partner.name);
    markChanged(subject,"relations"); scheduleSave(subject); renderRelations(subject); $("#relationDialog").close();
  });
  $$("[data-test-count]").forEach(button=>button.addEventListener("click",()=>{testDiceCount=Number(button.dataset.testCount);renderTestCount();generateTest();}));
  $("#nextTestButton").addEventListener("click",generateTest);
  $("#testHighlight").addEventListener("click",()=>{
    const active=!$("#testHighlight").classList.contains("active");
    $("#testHighlight").classList.toggle("active",active); $("#testHighlight").setAttribute("aria-pressed",String(active));
    $("#testHighlight").textContent=active?"♥ STANDOUT":"♡ STANDOUT";
  });
  $$("[data-test-rating]").forEach(button=>button.addEventListener("click",()=>saveTestRating(button.dataset.testRating)));
  $("#exportThemes").addEventListener("click",event=>{const button=event.target.closest("[data-export-theme]");if(!button)return;exportTheme=button.dataset.exportTheme;renderExport();});
  $("#exportThemeButton").addEventListener("click",exportThemeJson);
  $("#exportBackupButton").addEventListener("click",exportBackup);
  $("#backupInput").addEventListener("change",event=>importBackup(event.target.files[0]));
  $("#rankingsInput").addEventListener("change",event=>importRankings(event.target.files[0],false));
  $("#highlightsInput").addEventListener("change",event=>importRankings(event.target.files[0],true));
  $("#syncAllButton").addEventListener("click",syncAll);
}

function mergeDatabase(seed,local){
  const merged=structuredClone(seed);
  if(!local || local.schemaVersion!==seed.schemaVersion || !Array.isArray(local.subjects)) return merged;
  const localMap=new Map(local.subjects.map(subject=>[subject.id,subject]));
  merged.subjects=seed.subjects.map(subject=>localMap.get(subject.id) || subject);
  local.subjects.forEach(subject=>{if(!merged.subjects.some(item=>item.id===subject.id)) merged.subjects.push(subject);});
  merged.imports=local.imports || {};
  return merged;
}

function loadLocal(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||"null");}catch{return null;}}
function saveLocal(){localStorage.setItem(STORAGE_KEY,JSON.stringify(db));}

async function loadCloudSubjects(){
  try{
    const response=await supabaseFetch(`${CANON_TABLE}?select=id,payload,updated_at&limit=1000`);
    if(!response.ok) throw new Error(await response.text());
    const rows=await response.json();
    rows.forEach(row=>{
      const index=db.subjects.findIndex(subject=>subject.id===row.id);
      const local=index>=0?db.subjects[index]:null;
      const localTime=Date.parse(local?.change?.updatedAt||0);
      const cloudTime=Date.parse(row.updated_at||row.payload?.change?.updatedAt||0);
      if(!local || cloudTime>=localTime){if(index>=0) db.subjects[index]=row.payload; else db.subjects.push(row.payload);}
    });
    cloudAvailable=true; setStorageBadge("CLOUD"); saveLocal();
  }catch{
    cloudAvailable=false; setStorageBadge("LOCAL");
  }
}

function setStorageBadge(text){$("#storageBadge").textContent=text;$("#storageNote").textContent=text==="CLOUD"?"Shared storage is active. Local storage remains the immediate safety copy.":"Local safety copy active. Run canon/setup.sql once, then tap Sync All for cross-device storage.";}

function supabaseFetch(path,options={}){
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`,{...options,headers:{apikey:SUPABASE_KEY,authorization:`Bearer ${SUPABASE_KEY}`,...options.headers}});
}

async function saveCloudSubject(subject){
  const updatedAt=subject.change?.updatedAt || new Date().toISOString();
  const response=await supabaseFetch(`${CANON_TABLE}?on_conflict=id`,{
    method:"POST",headers:{"Content-Type":"application/json",Prefer:"resolution=merge-duplicates,return=minimal"},
    body:JSON.stringify([{id:subject.id,payload:subject,updated_at:updatedAt}])
  });
  if(!response.ok) throw new Error(await response.text());
  cloudAvailable=true; setStorageBadge("CLOUD");
}

function getCurrentSubject(){return db.subjects.find(subject=>subject.id===currentSubjectId);}
function sortedSubjects(){return [...db.subjects].sort((a,b)=>a.name.localeCompare(b.name));}

function renderStaticChoices(){
  $("#themeChips").innerHTML=db.themes.map(theme=>`<button type="button" data-theme="${escapeHtml(theme.id)}">${escapeHtml(theme.name.toUpperCase())}</button>`).join("");
  $("#useChips").innerHTML=db.uses.map(use=>`<button type="button" data-use="${escapeHtml(use.id)}">${escapeHtml(use.name.toUpperCase())}</button>`).join("");
  $("#exportThemes").innerHTML=db.themes.map(theme=>`<button type="button" data-export-theme="${escapeHtml(theme.id)}">${escapeHtml(theme.name.toUpperCase())}</button>`).join("");
}

function renderSubject(){
  const subject=getCurrentSubject(); if(!subject) return;
  $("#subjectSearch").value=subject.name;
  $("#nameInput").value=subject.name;
  $("#activeInput").checked=Boolean(subject.active);
  $("#familyInput").value=subject.family||"";
  $("#notesInput").value=subject.notes||"";
  $$("[data-theme]").forEach(button=>button.classList.toggle("active",subject.themes.includes(button.dataset.theme)));
  $$("[data-slot]").forEach(button=>button.classList.toggle("active",subject.slots.includes(button.dataset.slot)));
  $$("[data-use]").forEach(button=>button.classList.toggle("active",subject.uses.includes(button.dataset.use)));
  renderScore(subject);renderRelations(subject);renderSubjectMeta();
}

function renderScore(subject){
  $$("[data-score]").forEach(button=>button.classList.toggle("active",Number(button.dataset.score)===subject.score));
  $("#weightLabel").textContent=`weight ${formatWeight(subject.weight)}`;
}

function renderRelations(subject){
  ["boost","avoid"].forEach(type=>{
    const host=$(`#${type}Chips`); const entries=subject.relations?.[type]||[];
    host.innerHTML=entries.map(name=>`<button type="button" data-remove-relation="${type}" data-name="${escapeHtml(name)}" title="Tap to remove">${escapeHtml(name)} ×</button>`).join("");
    host.querySelectorAll("[data-remove-relation]").forEach(button=>button.addEventListener("click",()=>{
      subject.relations[type]=subject.relations[type].filter(name=>name!==button.dataset.name);
      markChanged(subject,"relations");scheduleSave(subject);renderRelations(subject);
    }));
  });
}

function renderSubjectMeta(){
  const subject=getCurrentSubject(); if(!subject) return;
  const sorted=sortedSubjects(); const index=sorted.findIndex(item=>item.id===subject.id);
  $("#subjectPosition").textContent=`${index+1} / ${sorted.length}`;
  const badge=$("#changeBadge"); badge.textContent=(subject.change?.state||"baseline").toUpperCase(); badge.className=subject.change?.state||"baseline";
  const history=historyBySubject.get(subject.name.toLowerCase());
  $("#historySummary").textContent=history?`${history.up} yes · ${history.meh} meh · ${history.down} no · ${history.highlights||0} ♥`:"No test history";
}

function renderSearchResults(){
  const term=$("#subjectSearch").value.trim().toLowerCase();
  const matches=sortedSubjects().filter(subject=>!term || subject.name.toLowerCase().includes(term)).slice(0,30);
  const host=$("#searchResults"); host.innerHTML=matches.map(subject=>`<button type="button" data-select-subject="${escapeHtml(subject.id)}">${escapeHtml(subject.name)}${subject.active?"":" · REMOVED"}</button>`).join("");
  host.hidden=false;
  host.querySelectorAll("[data-select-subject]").forEach(button=>button.addEventListener("click",()=>selectSubject(button.dataset.selectSubject)));
}

function selectSubject(id){currentSubjectId=id;$("#searchResults").hidden=true;renderSubject();}
function stepSubject(direction){const sorted=sortedSubjects();const index=sorted.findIndex(subject=>subject.id===currentSubjectId);selectSubject(sorted[(index+direction+sorted.length)%sorted.length].id);}

function addSubject(){
  let number=1; let name="New Subject"; while(db.subjects.some(subject=>subject.name===name)) name=`New Subject ${++number}`;
  const subject={id:uniqueId(name),name,active:true,themes:["classic"],slots:["detail"],score:1,weight:2,family:uniqueId(name),uses:[],notes:"",relations:{avoid:[],boost:[]},change:{state:"new",changedFields:["subject"],updatedAt:new Date().toISOString()},testing:{target:30,completed:0,ratings:{up:0,meh:0,down:0},notes:[],highlights:0}};
  db.subjects.push(subject);currentSubjectId=subject.id;scheduleSave(subject);renderSubject();renderQueue();renderExport();
  $("#nameInput").focus();$("#nameInput").select();toast("New subject added. It needs 30 targeted tests.");
}

function updateField(field,value){
  const subject=getCurrentSubject(); subject[field]=value;
  if(field==="name") $("#subjectSearch").value=value;
  markChanged(subject,field);scheduleSave(subject);renderSubjectMeta();
}

function toggleArrayChoice(event,dataName,field){
  const button=event.target.closest(`[data-${dataName}]`); if(!button) return;
  const subject=getCurrentSubject(); const value=button.dataset[dataName]; const values=new Set(subject[field]);
  values.has(value)?values.delete(value):values.add(value);
  if(field==="slots" && values.size===0){toast("Select at least one die role.");return;}
  if(field==="themes" && values.size===0){toast("Select at least one theme.");return;}
  subject[field]=[...values];button.classList.toggle("active",values.has(value));markChanged(subject,field);scheduleSave(subject);renderExport();
}

function markChanged(subject,field){
  subject.change ||= {state:"baseline",changedFields:[],updatedAt:null};
  subject.testing ||= {target:0,completed:0,ratings:{up:0,meh:0,down:0},notes:[],highlights:0};
  const wasSettled=["baseline","tested"].includes(subject.change.state);
  if(subject.change.state!=="new") subject.change.state="changed";
  if(!subject.change.changedFields.includes(field)) subject.change.changedFields.push(field);
  subject.change.updatedAt=new Date().toISOString();
  const target=subject.change.state==="new"?30:!subject.active?10:["slots","themes","active"].includes(field)?24:12;
  if(wasSettled){subject.testing.completed=0;subject.testing.ratings={up:0,meh:0,down:0};subject.testing.notes=[];subject.testing.highlights=0;}
  subject.testing.target=Math.max(subject.testing.target||0,target);
  renderSubjectMeta();renderQueue();renderExport();
}

function scheduleSave(subject){
  saveLocal();setSaveStatus("Saving…","saving");clearTimeout(saveTimer);
  saveTimer=setTimeout(async()=>{
    try{await saveCloudSubject(subject);setSaveStatus("Saved to cloud","saved");}
    catch{cloudAvailable=false;setStorageBadge("LOCAL");setSaveStatus("Saved locally","saved");}
  },650);
}

function setSaveStatus(message,state){const el=$("#saveStatus");el.textContent=message;el.className=state||"";}

function setView(view){
  currentView=view;$$("[data-view]").forEach(button=>button.classList.toggle("active",button.dataset.view===view));
  $$("[data-view-panel]").forEach(panel=>{const active=panel.dataset.viewPanel===view;panel.hidden=!active;panel.classList.toggle("active",active);});
  if(view==="test"){renderQueue();generateTest();} if(view==="export") renderExport();
}

function testQueue(){return db.subjects.filter(subject=>["new","changed"].includes(subject.change?.state) && (subject.testing?.completed||0)<(subject.testing?.target||0));}

function renderQueue(){const queue=testQueue();$("#queueBadge").textContent=queue.length;}

function renderTestCount(){$$("[data-test-count]").forEach(button=>button.classList.toggle("active",Number(button.dataset.testCount)===testDiceCount));}

function generateTest(){
  renderTestCount();const queue=testQueue();const preferred=queue.find(subject=>subject.id===currentSubjectId);const focus=preferred||queue[0];
  if(!focus){currentTest=null;$("#testHeading").textContent="Nothing to test";$("#testProgress").textContent="0 / 0";$("#testReason").textContent="New and changed subjects appear here automatically.";$("#testCombination").innerHTML="<span>All targeted tests are complete.</span>";$("#testMeterFill").style.width="0%";return;}
  currentSubjectId=focus.id;
  const theme=focus.themes[0]||"classic";
  const combination=makeTargetedRoll(focus,theme,testDiceCount);
  currentTest={focusId:focus.id,theme,combination,highlight:false};
  $("#testHeading").textContent=focus.name;
  $("#testProgress").textContent=`${focus.testing.completed} / ${focus.testing.target}`;
  $("#testReason").textContent=!focus.active?`Removal regression · ${theme}`:`${focus.change.state} · ${focus.change.changedFields.join(", ")} · ${theme}`;
  $("#testMeterFill").style.width=`${Math.min(100,focus.testing.completed/Math.max(1,focus.testing.target)*100)}%`;
  $("#testCombination").innerHTML=combination.map(item=>`<strong class="${item.subject.id===focus.id?"target":""}">${escapeHtml(item.subject.name)}<small>${escapeHtml(item.slot)}</small></strong>`).join("");
  $("#testCombination").querySelectorAll("small").forEach(el=>{el.style.display="block";el.style.fontSize="6px";el.style.color="#777";el.style.marginTop="2px";});
  $("#testNote").value="";$("#testHighlight").classList.remove("active");$("#testHighlight").setAttribute("aria-pressed","false");$("#testHighlight").textContent="♡ STANDOUT";
}

function makeTargetedRoll(focus,theme,count){
  let plan=count===2?["main","detail"]:["main","detail","effect"];
  const entries=[];const chosenIds=new Set();const families=new Set();
  if(focus.active){
    let eligible=focus.slots.filter(slot=>plan.includes(slot));
    if(!eligible.length){const slot=focus.slots[0];plan=plan.map((item,index)=>index===plan.length-1?slot:item);eligible=[slot];}
    const forcedSlot=eligible[Math.floor(Math.random()*eligible.length)];
    entries.push({slot:forcedSlot,subject:focus});chosenIds.add(focus.id);if(focus.family)families.add(focus.family);
  }
  for(const slot of plan){
    if(entries.some(entry=>entry.slot===slot)) continue;
    let candidates=db.subjects.filter(subject=>subject.active&&subject.themes.includes(theme)&&subject.slots.includes(slot)&&!chosenIds.has(subject.id)&&(!subject.family||!families.has(subject.family))&&!relationConflict(focus,subject));
    if(!candidates.length)candidates=db.subjects.filter(subject=>subject.active&&subject.themes.includes(theme)&&subject.slots.includes(slot)&&!chosenIds.has(subject.id));
    const picked=weightedChoice(candidates);if(!picked)continue;entries.push({slot,subject:picked});chosenIds.add(picked.id);if(picked.family)families.add(picked.family);
  }
  return plan.map(slot=>entries.find(entry=>entry.slot===slot)).filter(Boolean);
}

function relationConflict(a,b){return (a.relations?.avoid||[]).includes(b.name)||(b.relations?.avoid||[]).includes(a.name);}
function weightedChoice(items){if(!items.length)return null;const total=items.reduce((sum,item)=>sum+Math.max(.001,Number(item.weight)||1),0);let cursor=Math.random()*total;for(const item of items){cursor-=Math.max(.001,Number(item.weight)||1);if(cursor<=0)return item;}return items[items.length-1];}

function saveTestRating(rating){
  if(!currentTest)return;const subject=db.subjects.find(item=>item.id===currentTest.focusId);if(!subject)return;
  subject.testing.completed=Math.min(subject.testing.target,subject.testing.completed+1);subject.testing.ratings[rating]=(subject.testing.ratings[rating]||0)+1;
  const note=$("#testNote").value.trim();if(note)subject.testing.notes.unshift({createdAt:new Date().toISOString(),rating,words:currentTest.combination.map(item=>item.subject.name),note});
  if($("#testHighlight").classList.contains("active"))subject.testing.highlights=(subject.testing.highlights||0)+1;
  subject.change.updatedAt=new Date().toISOString();
  if(subject.testing.completed>=subject.testing.target)subject.change.state="tested";
  saveLocal();scheduleSave(subject);renderQueue();toast("Test saved.");generateTest();
}

function renderExport(){
  if(!db)return;$$("[data-export-theme]").forEach(button=>button.classList.toggle("active",button.dataset.exportTheme===exportTheme));
  const theme=db.themes.find(item=>item.id===exportTheme);const subjects=db.subjects.filter(subject=>subject.active&&subject.themes.includes(exportTheme));const records=subjects.reduce((sum,subject)=>sum+subject.slots.length,0);const pending=subjects.filter(subject=>["new","changed"].includes(subject.change?.state)).length;
  $("#exportSubjects").textContent=subjects.length;$("#exportRecords").textContent=records;$("#exportPending").textContent=pending;$("#exportWarning").textContent=`${testQueue().length} pending`;$("#exportThemeButton").textContent=`EXPORT ${theme.name.toUpperCase()}.JSON`;
}

function exportThemeJson(){
  const subjects=db.subjects.filter(subject=>subject.active&&subject.themes.includes(exportTheme));
  const deck=subjects.flatMap(subject=>subject.slots.map(slot=>({word:subject.name,score:subject.score,weight:subject.weight,family:subject.family,slot}))).sort((a,b)=>a.word.localeCompare(b.word)||a.slot.localeCompare(b.slot));
  downloadJson(deck,`${exportTheme}.json`);toast(`${exportTheme}.json exported with ${deck.length} slot records.`);
}

function exportBackup(){const backup={...db,exportedAt:new Date().toISOString()};downloadJson(backup,`tattoo-dice-canon-backup-${dateStamp()}.json`);toast("Safe canon backup exported.");}

async function importBackup(file){
  if(!file)return;
  try{const parsed=JSON.parse(await file.text());if(parsed.schemaVersion!==1||!Array.isArray(parsed.subjects))throw new Error();db=mergeDatabase(db,parsed);saveLocal();currentSubjectId=db.subjects[0]?.id;renderStaticChoices();renderSubject();renderQueue();renderExport();toast(`${parsed.subjects.length} subjects restored locally. Tap Sync All for cloud.`);}catch{toast("That backup is not a valid Canon file.");}
  $("#backupInput").value="";
}

async function importRankings(file,highlights){
  if(!file)return;
  try{const rows=parseCsv(await file.text());applyHistoryRows(rows,highlights);db.imports ||= {};db.imports[highlights?"highlights":"rankings"]={file:file.name,count:rows.length,importedAt:new Date().toISOString(),rows};saveLocal();renderSubjectMeta();toast(`${rows.length} ${highlights?"highlights":"rankings"} imported.`);}catch{toast("Could not read that CSV export.");}
  $(highlights?"#highlightsInput":"#rankingsInput").value="";
}

async function syncAll(){
  setStorageBadge("SYNCING");let saved=0;
  try{for(const subject of db.subjects){await saveCloudSubject(subject);saved++;}toast(`${saved} subjects synced to shared storage.`);}
  catch{cloudAvailable=false;setStorageBadge("LOCAL");toast("Shared table is not ready. Run canon/setup.sql once.");}
}

async function loadAdminHistory(){
  try{
    const all=[];let offset=0;const pageSize=1000;
    while(true){const response=await supabaseFetch(`${RANKINGS_TABLE}?select=created_at,theme,dice_count,words,rating,note&order=created_at.desc&limit=${pageSize}&offset=${offset}`);if(!response.ok)throw new Error();const rows=await response.json();all.push(...rows);if(rows.length<pageSize)break;offset+=pageSize;}
    applyHistoryRows(all,false);
  }catch{}
}

function applyHistoryRows(rows,highlights){
  for(const row of rows){
    const words=Array.isArray(row.words)?row.words:String(row.words||"").split("+").map(word=>word.trim()).filter(Boolean);
    const rowKey=[highlights?"highlight":"ranking",row.created_at||"",row.combination_key||words.join("|"),row.rating||""].join("|");
    if(historyRowKeys.has(rowKey)) continue;
    historyRowKeys.add(rowKey);
    words.forEach(word=>{
      const key=word.toLowerCase();const history=historyBySubject.get(key)||{up:0,meh:0,down:0,open:0,highlights:0,notes:[],partners:new Map()};
      if(highlights)history.highlights++;else{const rating=String(row.rating||"open").toLowerCase();history[rating]=(history[rating]||0)+1;if(row.note)history.notes.push(row.note);}
      words.filter(partner=>partner.toLowerCase()!==key).forEach(partner=>history.partners.set(partner,(history.partners.get(partner)||0)+1));
      historyBySubject.set(key,history);
    });
  }
}

function parseCsv(text){
  const rows=[];let row=[];let cell="";let quoted=false;
  for(let index=0;index<text.length;index++){const char=text[index];if(char==='"'){if(quoted&&text[index+1]==='"'){cell+='"';index++;}else quoted=!quoted;}else if(char===","&&!quoted){row.push(cell);cell="";}else if((char==="\n"||char==="\r")&&!quoted){if(char==="\r"&&text[index+1]==="\n")index++;row.push(cell);if(row.some(value=>value!==""))rows.push(row);row=[];cell="";}else cell+=char;}
  if(cell||row.length){row.push(cell);rows.push(row);}const headers=(rows.shift()||[]).map(value=>value.trim());return rows.map(values=>Object.fromEntries(headers.map((header,index)=>[header,values[index]||""])));
}

function openRelationDialog(mode){relationMode=mode;$("#relationTitle").textContent=mode==="boost"?"Boost partner":"Avoid partner";$("#relationSearch").value="";renderRelationResults();$("#relationDialog").showModal();setTimeout(()=>$("#relationSearch").focus(),0);}
function renderRelationResults(){const term=$("#relationSearch").value.trim().toLowerCase();const subject=getCurrentSubject();const existing=new Set(subject.relations?.[relationMode]||[]);const matches=sortedSubjects().filter(item=>item.id!==subject.id&&!existing.has(item.name)&&(!term||item.name.toLowerCase().includes(term))).slice(0,50);$("#relationResults").innerHTML=matches.map(item=>`<button type="button" data-relation-id="${escapeHtml(item.id)}">${escapeHtml(item.name)}</button>`).join("");}

function uniqueId(name){const base=name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"subject";let id=base;let number=1;while(db.subjects.some(subject=>subject.id===id))id=`${base}-${++number}`;return id;}
function formatWeight(value){return Number(value)%1?Number(value).toFixed(2).replace(/0+$/,""):String(Number(value));}
function dateStamp(){return new Date().toISOString().slice(0,10);}
function downloadJson(value,filename){downloadBlob(JSON.stringify(value,null,2)+"\n",filename,"application/json;charset=utf-8");}
function downloadBlob(content,filename,type){const url=URL.createObjectURL(new Blob([content],{type}));const link=document.createElement("a");link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),500);}
function toast(message){const el=$("#toast");el.textContent=message;el.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove("show"),2500);}
function escapeHtml(value){return String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}
