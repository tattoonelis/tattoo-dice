const SUPABASE_URL="https://gkcsiqgsovbbavunibmv.supabase.co";
const SUPABASE_KEY="sb_publishable_la1MqfOB-NqB0pMK1_ruJg_0UUZKrAV";
const CANON_TABLE="canon_subjects";
const ADMIN_PIN="231189";
const STORAGE_KEY="tattooDiceCanonV3";
const PREVIOUS_STORAGE_KEY="tattooDiceCanonV2";
const LEGACY_STORAGE_KEY="tattooDiceCanonV1";
const WEIGHTS={0:.25,1:2,2:6,3:12};

let db=null;
let currentTheme="classic";
let familySubjectId="";
let pinInput="";
let initialized=false;
let cloudAvailable=false;
let pendingThemeWords=new Set();
const saveTimers=new Map();

const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];

initPin();
if("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(()=>{});

function initPin(){
  if(sessionStorage.getItem("tattooDiceAdminUnlocked")==="true"){
    $("#pinGate").classList.add("hidden");
    document.body.classList.remove("canon-locked");
    $("#app").setAttribute("aria-hidden","false");
    if(!initialized)initialize();
    return;
  }
  $("#pinKeypad").addEventListener("click",event=>{
    const key=event.target.closest("[data-pin]");
    const action=event.target.closest("[data-action]");
    if(key&&pinInput.length<ADMIN_PIN.length)pinInput+=key.dataset.pin;
    if(action?.dataset.action==="clear")pinInput="";
    if(action?.dataset.action==="back")pinInput=pinInput.slice(0,-1);
    $$("#pinDots i").forEach((dot,index)=>dot.classList.toggle("filled",index<pinInput.length));
    if(pinInput.length!==ADMIN_PIN.length)return;
    if(pinInput===ADMIN_PIN){
      sessionStorage.setItem("tattooDiceAdminUnlocked","true");
      $("#pinGate").classList.add("hidden");
      document.body.classList.remove("canon-locked");
      $("#app").setAttribute("aria-hidden","false");
      if(!initialized)initialize();
    }else{
      $("#pinStatus").textContent="Incorrect PIN";
      setTimeout(()=>{pinInput="";$("#pinStatus").textContent="";$$("#pinDots i").forEach(dot=>dot.classList.remove("filled"));},450);
    }
  });
}

async function initialize(){
  initialized=true;
  bindEvents();
  setSaveStatus("LOADING","saving");
  const [seed,fantasyWords]=await Promise.all([
    fetch("./canon-seed.json",{cache:"no-store"}).then(response=>{if(!response.ok)throw new Error("Canon seed could not be loaded.");return response.json();}),
    fetch("./fantasy-words.json",{cache:"no-store"}).then(response=>{if(!response.ok)throw new Error("Fantasy words could not be loaded.");return response.json();})
  ]);
  db=mergeDatabase(seed,loadLocal());
  await loadCloudThemeCatalog();
  await loadCloudSubjects();
  ensureFantasyWords(fantasyWords);
  saveLocal();
  renderThemeTabs();
  renderRows();
  setSaveStatus("SAVED","saved");
}

function bindEvents(){
  $("#themeTabs").addEventListener("click",event=>{
    const lock=event.target.closest("[data-theme-lock]");if(lock){togglePublicTheme(lock.dataset.themeLock);return;}
    const button=event.target.closest("[data-theme]");if(!button)return;
    currentTheme=button.dataset.theme;renderThemeTabs();renderRows();
  });
  $("#wordSearch").addEventListener("input",renderRows);
  $("#addWordButton").addEventListener("click",addWord);
  $("#addThemeButton").addEventListener("click",openThemeBuilder);
  $("#wordRows").addEventListener("click",handleRowClick);
  $("#wordRows").addEventListener("input",handleRowInput);
  $("#dataButton").addEventListener("click",openDataDialog);
  $("#exportThemeButton").addEventListener("click",exportThemeJson);
  $("#exportBackupButton").addEventListener("click",exportBackup);
  $("#backupInput").addEventListener("change",event=>importBackup(event.target.files[0]));
  $("#syncAllButton").addEventListener("click",syncAll);
  $("#familySearch").addEventListener("input",renderFamilyResults);
  $("#familyResults").addEventListener("click",event=>{
    const button=event.target.closest("[data-family]");if(!button)return;
    setFamily(button.dataset.family);
  });
  $("#saveNewFamily").addEventListener("click",()=>setFamily($("#familySearch").value));
  $("#themeWordSearch").addEventListener("input",renderThemeWordChoices);
  $("#themeWordList").addEventListener("change",handleThemeWordChoice);
  $("#selectAllThemeWords").addEventListener("click",selectAllThemeWords);
  $("#clearThemeWords").addEventListener("click",()=>{pendingThemeWords.clear();renderThemeWordChoices();});
  $("#createThemeButton").addEventListener("click",createThemeFromSelection);
}

function mergeDatabase(seed,local){
  const themes=mergeThemes(seed.themes,local?.themes);
  const result={schemaVersion:3,themes,subjects:seed.subjects.map(subject=>normalizeSubject(subject,themes))};
  if(!local||!Array.isArray(local.subjects))return result;
  const localById=new Map(local.subjects.map(subject=>[subject.id,subject]));
  result.subjects=result.subjects.map(subject=>localById.has(subject.id)?normalizeSubject(localById.get(subject.id),result.themes,subject):subject);
  for(const subject of local.subjects){
    if(!result.subjects.some(item=>item.id===subject.id))result.subjects.push(normalizeSubject(subject,result.themes));
  }
  return result;
}

function mergeThemes(...lists){
  const themes=new Map();
  lists.flatMap(list=>Array.isArray(list)?list:[]).forEach(theme=>{
    const id=slug(theme?.id||theme?.name);if(!id)return;
    const previous=themes.get(id)||{};
    themes.set(id,{id,name:String(theme.name||previous.name||id),publicUnlocked:id==="classic"||theme.publicUnlocked===true||(theme.publicUnlocked==null&&previous.publicUnlocked===true)});
  });
  return [...themes.values()];
}

function normalizeSubject(subject,themes=db?.themes||[],fallback={}){
  const validThemes=new Set(themes.map(theme=>theme.id));
  const profiles={};
  for(const [theme,profile] of Object.entries(fallback.profiles||{})){if(validThemes.has(theme))profiles[theme]=normalizeProfile(profile);}
  if(subject.profiles&&typeof subject.profiles==="object"){
    for(const [theme,profile] of Object.entries(subject.profiles)){if(validThemes.has(theme))profiles[theme]=normalizeProfile(profile,profiles[theme]);}
  }else{
    const legacyThemes=[...new Set((subject.themes||["classic"]).filter(theme=>validThemes.has(theme)))];
    legacyThemes.forEach(theme=>{profiles[theme]=normalizeProfile({included:true,active:subject.active!==false,slots:subject.slots,score:subject.score,family:subject.family,notes:subject.notes,blockedWith:subject.blockedWith,requires:subject.requires,updatedAt:subject.updatedAt},profiles[theme]);});
  }
  return{
    id:String(subject.id||slug(subject.name)||`subject-${Date.now()}`),
    name:String(subject.name||"New Word"),
    active:subject.active!==false,
    profiles,
    updatedAt:subject.updatedAt||subject.change?.updatedAt||fallback.updatedAt||null
  };
}

function normalizeProfile(profile={},fallback={}){
  const slots=[...new Set((profile.slots??fallback.slots??[]).filter(slot=>["main","detail","effect"].includes(slot)))];
  const score=Math.max(0,Math.min(3,Number(profile.score??fallback.score??0)||0));
  return{
    included:(profile.included??fallback.included??true)!==false,
    active:(profile.active??fallback.active??true)!==false,
    slots,
    score,
    weight:WEIGHTS[score],
    family:String(profile.family??fallback.family??"").trim().toLowerCase(),
    notes:String(profile.notes??fallback.notes??""),
    blockedWith:normalizeWordList(profile.blockedWith??fallback.blockedWith),
    requires:normalizeWordList(profile.requires??fallback.requires),
    updatedAt:profile.updatedAt||fallback.updatedAt||null
  };
}

function cloneProfile(profile){return normalizeProfile(JSON.parse(JSON.stringify(profile||{})));}
function profileFor(subject,theme=currentTheme){return subject?.profiles?.[theme]||null;}
function includedInTheme(subject,theme=currentTheme){const profile=profileFor(subject,theme);return subject?.active!==false&&Boolean(profile)&&profile.included!==false;}
function profileReady(profile){return Boolean(profile?.active!==false&&profile?.slots?.length&&profile?.family);}
function ensureFantasyWords(words){
  if(!Array.isArray(words))return;
  if(!db.themes.some(theme=>theme.id==="fantasy"))db.themes.push({id:"fantasy",name:"Fantasy",publicUnlocked:false});
  for(const rawName of words){
    const name=String(rawName||"").trim();if(!name)continue;
    let subject=db.subjects.find(item=>item.name.localeCompare(name,"en",{sensitivity:"base"})===0);
    if(!subject){subject={id:uniqueId(name),name,active:true,profiles:{},updatedAt:null};db.subjects.push(subject);}
    if(Object.prototype.hasOwnProperty.call(subject.profiles,"fantasy"))continue;
    const classic=profileFor(subject,"classic");
    subject.profiles.fantasy=classic?cloneProfile({...classic,included:true}):normalizeProfile({included:true,active:true,score:0,slots:[],family:"",notes:"",blockedWith:[],requires:[]});
  }
}

function normalizeWordList(value){return [...new Set((Array.isArray(value)?value:[]).map(item=>String(item||"").trim()).filter(Boolean))];}

function loadLocal(){
  try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||localStorage.getItem(PREVIOUS_STORAGE_KEY)||localStorage.getItem(LEGACY_STORAGE_KEY)||"null");}catch{return null;}
}
function saveLocal(){localStorage.setItem(STORAGE_KEY,JSON.stringify(db));}

async function loadCloudThemeCatalog(){
  try{
    const response=await supabaseFetch(`${CANON_TABLE}?id=eq.__themes&select=payload&limit=1`);
    if(!response.ok)throw new Error(await response.text());
    const rows=await response.json();
    db.themes=mergeThemes(db.themes,rows?.[0]?.payload?.themes);
  }catch{}
}

async function loadCloudSubjects(){
  try{
    const response=await supabaseFetch(`${CANON_TABLE}?select=id,payload,updated_at&limit=1000`);
    if(!response.ok)throw new Error(await response.text());
    const rows=await response.json();
    for(const row of rows){
      if(String(row.id||"").startsWith("__deck_"))continue;
      const index=db.subjects.findIndex(item=>item.id===row.id);
      const subject=normalizeSubject(row.payload,db.themes,index>=0?db.subjects[index]:{});
      if(!Object.keys(subject.profiles||{}).length)continue;
      const localTime=Date.parse(db.subjects[index]?.updatedAt||0);
      const cloudTime=Date.parse(row.updated_at||subject.updatedAt||0);
      if(index<0)db.subjects.push(subject);else if(cloudTime>=localTime)db.subjects[index]=subject;
    }
    cloudAvailable=true;setStorageBadge("CLOUD");saveLocal();
  }catch{cloudAvailable=false;setStorageBadge("LOCAL");}
}

function setStorageBadge(text){
  $("#storageBadge").textContent=text;
  $("#storageNote").textContent=text==="CLOUD"?"Shared storage is active. A local safety copy is saved as well.":"Local safety copy active. Use Sync All after the Canon table is ready in Supabase.";
}
function supabaseFetch(path,options={}){
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`,{...options,headers:{apikey:SUPABASE_KEY,authorization:`Bearer ${SUPABASE_KEY}`,...options.headers}});
}
async function saveCloudSubject(subject){
  const updatedAt=subject.updatedAt||new Date().toISOString();
  const response=await supabaseFetch(`${CANON_TABLE}?on_conflict=id`,{method:"POST",headers:{"Content-Type":"application/json",Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify([{id:subject.id,payload:subject,updated_at:updatedAt}])});
  if(!response.ok)throw new Error(await response.text());
  cloudAvailable=true;setStorageBadge("CLOUD");
}
async function saveCloudSubjects(subjects){
  const rows=subjects.map(subject=>({id:subject.id,payload:subject,updated_at:subject.updatedAt||new Date().toISOString()}));
  if(!rows.length)return;
  const response=await supabaseFetch(`${CANON_TABLE}?on_conflict=id`,{method:"POST",headers:{"Content-Type":"application/json",Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify(rows)});
  if(!response.ok)throw new Error(await response.text());
}
async function publishThemeCatalog(){
  const updatedAt=new Date().toISOString();
  const row={id:"__themes",payload:{schemaVersion:1,themes:db.themes,updatedAt},updated_at:updatedAt};
  const response=await supabaseFetch(`${CANON_TABLE}?on_conflict=id`,{method:"POST",headers:{"Content-Type":"application/json",Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify([row])});
  if(!response.ok)throw new Error(await response.text());
}

async function publishLiveDeck(theme=currentTheme){
  await publishThemeCatalog();
  const updatedAt=new Date().toISOString();
  const rows=[{
    id:`__deck_${theme}`,
    payload:{schemaVersion:1,theme,entries:buildThemeDeck(theme),publishedAt:updatedAt},
    updated_at:updatedAt
  }];
  const response=await supabaseFetch(`${CANON_TABLE}?on_conflict=id`,{method:"POST",headers:{"Content-Type":"application/json",Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify(rows)});
  if(!response.ok)throw new Error(await response.text());
}

function openThemeBuilder(){
  pendingThemeWords=new Set();
  $("#newThemeName").value="";$("#themeWordSearch").value="";
  renderThemeWordChoices();$("#themeDialog").showModal();
  requestAnimationFrame(()=>$("#newThemeName").focus());
}
function selectableThemeSubjects(){
  const search=$("#themeWordSearch").value.trim().toLowerCase();
  return db.subjects.filter(subject=>subject.active&&(!search||subject.name.toLowerCase().includes(search)||(profileFor(subject,"classic")?.family||"").includes(search))).sort((a,b)=>a.name.localeCompare(b.name));
}
function renderThemeWordChoices(){
  $("#themeWordList").innerHTML=selectableThemeSubjects().map(subject=>`<label class="theme-word-choice"><input type="checkbox" data-theme-subject="${escapeHtml(subject.id)}" ${pendingThemeWords.has(subject.id)?"checked":""}><span>${escapeHtml(subject.name)}</span></label>`).join("");
  $("#themeSelectionCount").textContent=pendingThemeWords.size;
}
function handleThemeWordChoice(event){
  const input=event.target.closest("[data-theme-subject]");if(!input)return;
  if(input.checked)pendingThemeWords.add(input.dataset.themeSubject);else pendingThemeWords.delete(input.dataset.themeSubject);
  $("#themeSelectionCount").textContent=pendingThemeWords.size;
}
function selectAllThemeWords(){
  selectableThemeSubjects().forEach(subject=>pendingThemeWords.add(subject.id));renderThemeWordChoices();
}
async function createThemeFromSelection(){
  const name=$("#newThemeName").value.trim();const id=slug(name);
  if(!name||!id){toast("Enter a theme name.");return;}
  if(db.themes.some(theme=>theme.id===id)){toast("That theme already exists.");return;}
  if(!pendingThemeWords.size){toast("Select at least one existing word.");return;}
  const selected=db.subjects.filter(subject=>pendingThemeWords.has(subject.id));
  const updatedAt=new Date().toISOString();
  db.themes.push({id,name,publicUnlocked:false});
  selected.forEach(subject=>{
    const source=profileFor(subject,"classic")||profileFor(subject,currentTheme);
    subject.profiles[id]=source?cloneProfile({...source,included:true}):normalizeProfile({included:true,active:true,score:0,slots:[],family:""});
    subject.profiles[id].updatedAt=updatedAt;subject.updatedAt=updatedAt;
  });
  currentTheme=id;saveLocal();renderThemeTabs();renderRows();$("#themeDialog").close();setSaveStatus("SAVING","saving");
  try{await saveCloudSubjects(selected);await publishLiveDeck(id);cloudAvailable=true;setStorageBadge("CLOUD");setSaveStatus("LIVE","saved");toast(`${name} created with ${selected.length} words.`);}
  catch{cloudAvailable=false;setStorageBadge("LOCAL");setSaveStatus("SAVED LOCALLY","saved");toast(`${name} created locally. Use Sync All when cloud is available.`);}
}

function renderThemeTabs(){
  $("#themeTabs").innerHTML=db.themes.map(theme=>`<div class="theme-tab ${theme.id===currentTheme?"active":""}"><button type="button" data-theme="${escapeHtml(theme.id)}">${escapeHtml(theme.name.toUpperCase())}</button><button type="button" class="theme-lock ${theme.publicUnlocked?"unlocked":"locked"}" data-theme-lock="${escapeHtml(theme.id)}" aria-label="${theme.publicUnlocked?"Lock":"Unlock"} ${escapeHtml(theme.name)} for public" ${theme.id==="classic"?"disabled":""}>${theme.publicUnlocked?"OPEN":"LOCK"}</button></div>`).join("");
}
function visibleSubjects(){
  const search=$("#wordSearch").value.trim().toLowerCase();
  return db.subjects.filter(subject=>includedInTheme(subject)&&(!search||subject.name.toLowerCase().includes(search)||(profileFor(subject)?.family||"").includes(search))).sort((a,b)=>a.name.localeCompare(b.name));
}
function renderRows(){
  const subjects=visibleSubjects();
  $("#visibleCount").textContent=subjects.length;
  $("#emptyState").hidden=subjects.length>0;
  $("#wordRows").innerHTML=subjects.map(subject=>rowTemplate(subject)).join("");
}
function rowTemplate(subject){
  const profile=profileFor(subject);const ready=profileReady(profile);
  return`<tr data-subject-id="${escapeHtml(subject.id)}" class="${ready?"":"incomplete"}">
    <td class="word-cell"><input class="word-input" data-field="name" value="${escapeHtml(subject.name)}" maxlength="60" aria-label="Word"></td>
    <td><div class="score-picker" aria-label="Score">${[0,1,2,3].map(score=>`<button type="button" data-score="${score}" class="${score===profile.score?"active":""}">${score}</button>`).join("")}</div></td>
    <td class="weight-cell">${formatWeight(profile.weight)}</td>
    ${["main","detail","effect"].map(slot=>`<td><button type="button" data-slot="${slot}" class="slot-button ${slot} ${profile.slots.includes(slot)?"active":""}" aria-pressed="${profile.slots.includes(slot)}">${profile.slots.includes(slot)?"✓":"·"}</button></td>`).join("")}
    <td><button type="button" class="family-button ${profile.family?"":"unassigned"}" data-family-open title="${escapeHtml(profile.family||"Unassigned")}">${escapeHtml(profile.family?profile.family.toUpperCase():"UNASSIGNED")}</button></td>
    <td><input class="notes-input" data-field="notes" value="${escapeHtml(profile.notes)}" maxlength="800" placeholder="${ready?"Optional note":"Complete slots + family"}" aria-label="Notes"></td>
    <td><button type="button" class="remove-button" data-remove aria-label="Remove from theme">×</button></td>
  </tr>`;
}

function handleRowClick(event){
  const row=event.target.closest("[data-subject-id]");if(!row)return;
  const subject=getSubject(row.dataset.subjectId);if(!subject)return;
  const profile=profileFor(subject);if(!profile)return;
  const scoreButton=event.target.closest("[data-score]");
  if(scoreButton){profile.score=Number(scoreButton.dataset.score);profile.weight=WEIGHTS[profile.score];touch(subject);renderRows();return;}
  const slotButton=event.target.closest("[data-slot]");
  if(slotButton){
    const slot=slotButton.dataset.slot;
    profile.slots=profile.slots.includes(slot)?profile.slots.filter(item=>item!==slot):[...profile.slots,slot];
    touch(subject);renderRows();return;
  }
  if(event.target.closest("[data-family-open]")){openFamilyDialog(subject);return;}
  if(event.target.closest("[data-remove]"))removeFromTheme(subject);
}
function handleRowInput(event){
  const input=event.target.closest("[data-field]");const row=event.target.closest("[data-subject-id]");if(!input||!row)return;
  const subject=getSubject(row.dataset.subjectId);if(!subject)return;
  if(input.dataset.field==="name")subject.name=input.value;else{const profile=profileFor(subject);if(!profile)return;profile[input.dataset.field]=input.value;}
  touch(subject,false);
}
function getSubject(id){return db.subjects.find(subject=>subject.id===id);}

function addWord(){
  let name="New Word";let number=1;while(db.subjects.some(subject=>subject.name===name))name=`New Word ${++number}`;
  const subject={id:uniqueId(name),name,active:true,profiles:{[currentTheme]:normalizeProfile({included:true,active:true,slots:[],score:0,family:"",notes:"",blockedWith:[],requires:[]})},updatedAt:new Date().toISOString()};
  db.subjects.push(subject);touch(subject);$("#wordSearch").value="";renderRows();
  requestAnimationFrame(()=>{const input=$(`[data-subject-id="${subject.id}"] .word-input`);input?.focus();input?.select();input?.scrollIntoView({block:"center"});});
  toast(`New word added to ${themeName(currentTheme)}.`);
}
function removeFromTheme(subject){
  if(!confirm(`Remove ${subject.name} from ${themeName(currentTheme)}?`))return;
  const profile=profileFor(subject);if(!profile)return;profile.included=false;
  touch(subject);renderRows();toast(`${subject.name} removed from ${themeName(currentTheme)}.`);
}

function openFamilyDialog(subject){
  familySubjectId=subject.id;$("#familyWord").textContent=subject.name;$("#familySearch").value="";renderFamilyResults();$("#familyDialog").showModal();
}
function allFamilies(){return [...new Set(db.subjects.filter(subject=>includedInTheme(subject)).map(subject=>profileFor(subject)?.family).filter(Boolean))].sort((a,b)=>a.localeCompare(b));}
function renderFamilyResults(){
  const subject=getSubject(familySubjectId);const search=$("#familySearch").value.trim().toLowerCase();
  const profile=profileFor(subject);$("#familyResults").innerHTML=allFamilies().filter(family=>!search||family.toLowerCase().includes(search)).map(family=>`<button type="button" data-family="${escapeHtml(family)}" class="${profile?.family===family?"current":""}">${escapeHtml(family.toUpperCase())}</button>`).join("");
}
function setFamily(value){
  const family=value.trim().toLowerCase();const subject=getSubject(familySubjectId);if(!family||!subject){toast("Choose or type a family.");return;}
  const profile=profileFor(subject);if(!profile)return;profile.family=family;touch(subject);$("#familyDialog").close();renderRows();toast(`${subject.name}: ${family}`);
}

function touch(subject,rerender=false,theme=currentTheme){
  const profile=profileFor(subject,theme);const updatedAt=new Date().toISOString();subject.updatedAt=updatedAt;if(profile){profile.updatedAt=updatedAt;profile.weight=WEIGHTS[profile.score];}saveLocal();setSaveStatus("SAVING","saving");
  const timerKey=`${subject.id}:${theme}`;clearTimeout(saveTimers.get(timerKey));
  saveTimers.set(timerKey,setTimeout(async()=>{
    try{await saveCloudSubject(subject);await publishLiveDeck(theme);setSaveStatus("LIVE","saved");}
    catch{cloudAvailable=false;setStorageBadge("LOCAL");setSaveStatus("SAVED LOCALLY","saved");}
  },650));
  if(rerender)renderRows();
}
function setSaveStatus(message,state){const element=$("#saveStatus");element.textContent=message;element.className=`save-state ${state||""}`;}

function openDataDialog(){
  const name=themeName(currentTheme);$("#dataDialogTitle").textContent=name;$("#exportThemeButton").textContent=`EXPORT ${name.toUpperCase()}.JSON`;setStorageBadge(cloudAvailable?"CLOUD":"LOCAL");$("#dataDialog").showModal();
}
function currentThemeRecord(){return db.themes.find(theme=>theme.id===currentTheme);}
async function togglePublicTheme(themeId=currentTheme){
  const theme=db.themes.find(item=>item.id===themeId);if(!theme)return;
  if(theme.id==="classic")return;
  theme.publicUnlocked=!theme.publicUnlocked;saveLocal();renderThemeTabs();setSaveStatus("SAVING","saving");
  try{await publishThemeCatalog();setSaveStatus(theme.publicUnlocked?"PUBLIC":"LOCKED","saved");toast(`${theme.name} is now ${theme.publicUnlocked?"available":"locked"} in the Live App.`);}
  catch{theme.publicUnlocked=!theme.publicUnlocked;saveLocal();renderThemeTabs();setSaveStatus("SAVED LOCALLY","saved");toast("Public status could not be updated.");}
}
function exportThemeJson(){
  const deck=buildThemeDeck(currentTheme);
  downloadJson(deck,`${currentTheme}.json`);toast(`${currentTheme}.json exported with ${deck.length} dice records.`);
}
function buildThemeDeck(theme){
  return db.subjects.filter(subject=>includedInTheme(subject,theme)&&profileReady(profileFor(subject,theme))).flatMap(subject=>{
    const profile=profileFor(subject,theme);return profile.slots.map(slot=>{
    const entry={word:subject.name,score:profile.score,weight:profile.weight,slot,family:profile.family};
    if(profile.blockedWith?.length)entry.blockedWith=[...profile.blockedWith];
    if(profile.requires?.length)entry.requires=[...profile.requires];
    return entry;
  });}).sort((a,b)=>a.word.localeCompare(b.word)||a.slot.localeCompare(b.slot));
}
function exportBackup(){downloadJson({...db,exportedAt:new Date().toISOString()},`tattoo-dice-canon-backup-${dateStamp()}.json`);toast("Safe Canon backup exported.");}
async function importBackup(file){
  if(!file)return;
  try{
    const parsed=JSON.parse(await file.text());if(!Array.isArray(parsed.subjects))throw new Error();
    db=mergeDatabase(db,parsed);saveLocal();renderThemeTabs();renderRows();toast(`${parsed.subjects.length} words restored locally. Use Sync All for cloud.`);
  }catch{toast("That backup is not a valid Canon file.");}
  $("#backupInput").value="";
}
async function syncAll(){
  setStorageBadge("SYNCING");let saved=0;
  try{for(const subject of db.subjects){await saveCloudSubject(subject);saved++;}await publishLiveDeck(currentTheme);toast(`${saved} words synced; ${themeName(currentTheme)} published live.`);setSaveStatus("LIVE","saved");}
  catch{cloudAvailable=false;setStorageBadge("LOCAL");toast("Shared table is not ready. Run canon/setup.sql once.");}
}

function themeName(id){return db.themes.find(theme=>theme.id===id)?.name||id;}
function slug(value){return String(value||"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");}
function uniqueId(name){const base=slug(name)||"subject";let id=base;let number=1;while(db.subjects.some(subject=>subject.id===id))id=`${base}-${++number}`;return id;}
function formatWeight(value){return Number(value)%1?Number(value).toFixed(2).replace(/0+$/,""):String(Number(value));}
function dateStamp(){return new Date().toISOString().slice(0,10);}
function downloadJson(value,filename){downloadBlob(`${JSON.stringify(value,null,2)}\n`,filename,"application/json;charset=utf-8");}
function downloadBlob(content,filename,type){const url=URL.createObjectURL(new Blob([content],{type}));const link=document.createElement("a");link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),500);}
function toast(message){const element=$("#toast");element.textContent=message;element.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>element.classList.remove("show"),2500);}
function escapeHtml(value){return String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}
