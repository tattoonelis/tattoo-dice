const SUPABASE_URL="https://gkcsiqgsovbbavunibmv.supabase.co";
const SUPABASE_KEY="sb_publishable_la1MqfOB-NqB0pMK1_ruJg_0UUZKrAV";
const CANON_TABLE="canon_subjects";
const ADMIN_PIN="231189";
const STORAGE_KEY="tattooDiceCanonV2";
const LEGACY_STORAGE_KEY="tattooDiceCanonV1";
const WEIGHTS={0:.25,1:2,2:6,3:12};

let db=null;
let currentTheme="classic";
let familySubjectId="";
let pinInput="";
let initialized=false;
let cloudAvailable=false;
const saveTimers=new Map();

const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];

initPin();
if("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(()=>{});

function initPin(){
  $("#pinKeypad").addEventListener("click",event=>{
    const key=event.target.closest("[data-pin]");
    const action=event.target.closest("[data-action]");
    if(key&&pinInput.length<ADMIN_PIN.length)pinInput+=key.dataset.pin;
    if(action?.dataset.action==="clear")pinInput="";
    if(action?.dataset.action==="back")pinInput=pinInput.slice(0,-1);
    $$("#pinDots i").forEach((dot,index)=>dot.classList.toggle("filled",index<pinInput.length));
    if(pinInput.length!==ADMIN_PIN.length)return;
    if(pinInput===ADMIN_PIN){
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
  const seed=await fetch("./canon-seed.json",{cache:"no-store"}).then(response=>{
    if(!response.ok)throw new Error("Canon seed could not be loaded.");
    return response.json();
  });
  db=mergeDatabase(seed,loadLocal());
  await loadCloudSubjects();
  renderThemeTabs();
  renderRows();
  setSaveStatus("SAVED","saved");
}

function bindEvents(){
  $("#themeTabs").addEventListener("click",event=>{
    const button=event.target.closest("[data-theme]");if(!button)return;
    currentTheme=button.dataset.theme;renderThemeTabs();renderRows();
  });
  $("#wordSearch").addEventListener("input",renderRows);
  $("#addWordButton").addEventListener("click",addWord);
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
}

function mergeDatabase(seed,local){
  const result={schemaVersion:2,themes:seed.themes,subjects:seed.subjects.map(subject=>normalizeSubject(subject,seed.themes))};
  if(!local||!Array.isArray(local.subjects))return result;
  const localById=new Map(local.subjects.map(subject=>[subject.id,subject]));
  result.subjects=result.subjects.map(subject=>localById.has(subject.id)?normalizeSubject(localById.get(subject.id),result.themes):subject);
  for(const subject of local.subjects){
    if(!result.subjects.some(item=>item.id===subject.id))result.subjects.push(normalizeSubject(subject,result.themes));
  }
  return result;
}

function normalizeSubject(subject,themes=db?.themes||[]){
  const validThemes=new Set(themes.map(theme=>theme.id));
  const slots=[...new Set((subject.slots||[]).filter(slot=>["main","detail","effect"].includes(slot)))];
  const score=Math.max(0,Math.min(3,Number(subject.score)||0));
  return{
    id:String(subject.id||slug(subject.name)||`subject-${Date.now()}`),
    name:String(subject.name||"New Word"),
    active:subject.active!==false,
    themes:[...new Set((subject.themes||["classic"]).filter(theme=>validThemes.has(theme)))],
    slots:slots.length?slots:["detail"],score,weight:WEIGHTS[score],
    family:String(subject.family||slug(subject.name)||"other"),
    notes:String(subject.notes||""),
    updatedAt:subject.updatedAt||subject.change?.updatedAt||null
  };
}

function loadLocal(){
  try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||localStorage.getItem(LEGACY_STORAGE_KEY)||"null");}catch{return null;}
}
function saveLocal(){localStorage.setItem(STORAGE_KEY,JSON.stringify(db));}

async function loadCloudSubjects(){
  try{
    const response=await supabaseFetch(`${CANON_TABLE}?select=id,payload,updated_at&limit=1000`);
    if(!response.ok)throw new Error(await response.text());
    const rows=await response.json();
    for(const row of rows){
      const subject=normalizeSubject(row.payload,db.themes);
      if(!subject.themes.length)continue;
      const index=db.subjects.findIndex(item=>item.id===row.id);
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

function renderThemeTabs(){
  $("#themeTabs").innerHTML=db.themes.map(theme=>`<button type="button" data-theme="${escapeHtml(theme.id)}" class="${theme.id===currentTheme?"active":""}">${escapeHtml(theme.name.toUpperCase())}</button>`).join("");
}
function visibleSubjects(){
  const search=$("#wordSearch").value.trim().toLowerCase();
  return db.subjects.filter(subject=>subject.active&&subject.themes.includes(currentTheme)&&(!search||subject.name.toLowerCase().includes(search)||subject.family.toLowerCase().includes(search))).sort((a,b)=>a.name.localeCompare(b.name));
}
function renderRows(){
  const subjects=visibleSubjects();
  $("#visibleCount").textContent=subjects.length;
  $("#emptyState").hidden=subjects.length>0;
  $("#wordRows").innerHTML=subjects.map(subject=>rowTemplate(subject)).join("");
}
function rowTemplate(subject){
  return`<tr data-subject-id="${escapeHtml(subject.id)}">
    <td class="word-cell"><input class="word-input" data-field="name" value="${escapeHtml(subject.name)}" maxlength="60" aria-label="Word"></td>
    <td><div class="score-picker" aria-label="Score">${[0,1,2,3].map(score=>`<button type="button" data-score="${score}" class="${score===subject.score?"active":""}">${score}</button>`).join("")}</div></td>
    <td class="weight-cell">${formatWeight(subject.weight)}</td>
    ${["main","detail","effect"].map(slot=>`<td><button type="button" data-slot="${slot}" class="slot-button ${slot} ${subject.slots.includes(slot)?"active":""}" aria-pressed="${subject.slots.includes(slot)}">${subject.slots.includes(slot)?"✓":"·"}</button></td>`).join("")}
    <td><button type="button" class="family-button" data-family-open title="${escapeHtml(subject.family)}">${escapeHtml(subject.family.toUpperCase())}</button></td>
    <td><input class="notes-input" data-field="notes" value="${escapeHtml(subject.notes)}" maxlength="800" placeholder="Optional note" aria-label="Notes"></td>
    <td><button type="button" class="remove-button" data-remove aria-label="Remove from theme">×</button></td>
  </tr>`;
}

function handleRowClick(event){
  const row=event.target.closest("[data-subject-id]");if(!row)return;
  const subject=getSubject(row.dataset.subjectId);if(!subject)return;
  const scoreButton=event.target.closest("[data-score]");
  if(scoreButton){subject.score=Number(scoreButton.dataset.score);subject.weight=WEIGHTS[subject.score];touch(subject);renderRows();return;}
  const slotButton=event.target.closest("[data-slot]");
  if(slotButton){
    const slot=slotButton.dataset.slot;
    subject.slots=subject.slots.includes(slot)?subject.slots.filter(item=>item!==slot):[...subject.slots,slot];
    if(!subject.slots.length){subject.slots=[slot];toast("A word needs at least one dice column.");return;}
    touch(subject);renderRows();return;
  }
  if(event.target.closest("[data-family-open]")){openFamilyDialog(subject);return;}
  if(event.target.closest("[data-remove]"))removeFromTheme(subject);
}
function handleRowInput(event){
  const input=event.target.closest("[data-field]");const row=event.target.closest("[data-subject-id]");if(!input||!row)return;
  const subject=getSubject(row.dataset.subjectId);if(!subject)return;
  subject[input.dataset.field]=input.value;touch(subject,false);
}
function getSubject(id){return db.subjects.find(subject=>subject.id===id);}

function addWord(){
  let name="New Word";let number=1;while(db.subjects.some(subject=>subject.name===name))name=`New Word ${++number}`;
  const subject={id:uniqueId(name),name,active:true,themes:[currentTheme],slots:["detail"],score:1,weight:2,family:"other",notes:"",updatedAt:new Date().toISOString()};
  db.subjects.push(subject);touch(subject);$("#wordSearch").value="";renderRows();
  requestAnimationFrame(()=>{const input=$(`[data-subject-id="${subject.id}"] .word-input`);input?.focus();input?.select();input?.scrollIntoView({block:"center"});});
  toast(`New word added to ${themeName(currentTheme)}.`);
}
function removeFromTheme(subject){
  if(!confirm(`Remove ${subject.name} from ${themeName(currentTheme)}?`))return;
  subject.themes=subject.themes.filter(theme=>theme!==currentTheme);
  if(!subject.themes.length)subject.active=false;
  touch(subject);renderRows();toast(`${subject.name} removed from ${themeName(currentTheme)}.`);
}

function openFamilyDialog(subject){
  familySubjectId=subject.id;$("#familyWord").textContent=subject.name;$("#familySearch").value="";renderFamilyResults();$("#familyDialog").showModal();
}
function allFamilies(){return [...new Set(db.subjects.map(subject=>subject.family).filter(Boolean))].sort((a,b)=>a.localeCompare(b));}
function renderFamilyResults(){
  const subject=getSubject(familySubjectId);const search=$("#familySearch").value.trim().toLowerCase();
  $("#familyResults").innerHTML=allFamilies().filter(family=>!search||family.toLowerCase().includes(search)).map(family=>`<button type="button" data-family="${escapeHtml(family)}" class="${subject?.family===family?"current":""}">${escapeHtml(family.toUpperCase())}</button>`).join("");
}
function setFamily(value){
  const family=value.trim().toLowerCase();const subject=getSubject(familySubjectId);if(!family||!subject){toast("Choose or type a family.");return;}
  subject.family=family;touch(subject);$("#familyDialog").close();renderRows();toast(`${subject.name}: ${family}`);
}

function touch(subject,rerender=false){
  subject.updatedAt=new Date().toISOString();subject.weight=WEIGHTS[subject.score];saveLocal();setSaveStatus("SAVING","saving");
  clearTimeout(saveTimers.get(subject.id));
  saveTimers.set(subject.id,setTimeout(async()=>{
    try{await saveCloudSubject(subject);setSaveStatus("SAVED TO CLOUD","saved");}
    catch{cloudAvailable=false;setStorageBadge("LOCAL");setSaveStatus("SAVED LOCALLY","saved");}
  },650));
  if(rerender)renderRows();
}
function setSaveStatus(message,state){const element=$("#saveStatus");element.textContent=message;element.className=`save-state ${state||""}`;}

function openDataDialog(){
  const name=themeName(currentTheme);$("#dataDialogTitle").textContent=name;$("#exportThemeButton").textContent=`EXPORT ${name.toUpperCase()}.JSON`;setStorageBadge(cloudAvailable?"CLOUD":"LOCAL");$("#dataDialog").showModal();
}
function exportThemeJson(){
  const subjects=db.subjects.filter(subject=>subject.active&&subject.themes.includes(currentTheme));
  const deck=subjects.flatMap(subject=>subject.slots.map(slot=>({word:subject.name,score:subject.score,weight:subject.weight,family:subject.family,slot}))).sort((a,b)=>a.word.localeCompare(b.word)||a.slot.localeCompare(b.slot));
  downloadJson(deck,`${currentTheme}.json`);toast(`${currentTheme}.json exported with ${deck.length} dice records.`);
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
  try{for(const subject of db.subjects){await saveCloudSubject(subject);saved++;}toast(`${saved} words synced to shared storage.`);setSaveStatus("SAVED TO CLOUD","saved");}
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
