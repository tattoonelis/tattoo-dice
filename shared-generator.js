export const WEIGHT_BY_SCORE = Object.freeze({0:0.25,1:2,2:6,3:12});

const RATING_VALUE = Object.freeze({up:1,meh:0.35,down:0});
const MIN_RELATION_OBSERVATIONS = 3;
const PRIOR_STRENGTH = 8;

export function prepareDeck(rawDeck){
  if(!Array.isArray(rawDeck)) return [];
  return rawDeck
    .filter(item => item && typeof item.word === "string" && typeof item.slot === "string")
    .map(item => ({...item,weight:normaliseWeight(item)}));
}

export async function fetchCanonDeck({
  supabaseUrl,
  supabaseKey,
  theme,
  baselineDeck=[],
  table="canon_subjects"
}){
  const query=new URLSearchParams({id:`eq.__deck_${theme}`,select:"payload",limit:"1"});
  const response=await fetch(`${supabaseUrl}/rest/v1/${table}?${query}`,{
    cache:"no-store",
    headers:{apikey:supabaseKey,authorization:`Bearer ${supabaseKey}`}
  });
  if(!response.ok) throw new Error("Canon request failed");
  const rows=await response.json();
  const publishedDeck=rows?.[0]?.payload?.entries;
  if(!Array.isArray(publishedDeck)||!publishedDeck.length){
    if(Array.isArray(baselineDeck)&&baselineDeck.length) return prepareDeck(baselineDeck);
    throw new Error("Published Canon deck is empty");
  }
  return prepareDeck(publishedDeck);
}

export async function fetchCanonThemes({supabaseUrl,supabaseKey,table="canon_subjects",fallback=[]}){
  const query=new URLSearchParams({id:"eq.__themes",select:"payload",limit:"1"});
  const response=await fetch(`${supabaseUrl}/rest/v1/${table}?${query}`,{
    cache:"no-store",
    headers:{apikey:supabaseKey,authorization:`Bearer ${supabaseKey}`}
  });
  if(!response.ok)throw new Error("Canon theme request failed");
  const rows=await response.json();
  const themes=rows?.[0]?.payload?.themes;
  return Array.isArray(themes)&&themes.length?themes:fallback;
}

export function buildRelationshipModel(records,{theme}={}){
  const accepted=(Array.isArray(records)?records:[]).filter(record =>
    record &&
    (!theme || record.theme===theme) &&
    Object.prototype.hasOwnProperty.call(RATING_VALUE,record.rating) &&
    Array.isArray(record.words) &&
    record.words.length>=2
  );
  if(!accepted.length) return new Map();

  const baseline=accepted.reduce((sum,record)=>sum+RATING_VALUE[record.rating],0)/accepted.length;
  const evidence=new Map();

  accepted.forEach(record => {
    const words=[...new Set(record.words.map(normaliseWord).filter(Boolean))];
    for(let left=0;left<words.length;left++){
      for(let right=left+1;right<words.length;right++){
        const key=relationshipKey(words[left],words[right]);
        const stats=evidence.get(key)||{observations:0,up:0,meh:0,down:0,valueTotal:0};
        stats.observations+=1;
        stats[record.rating]+=1;
        stats.valueTotal+=RATING_VALUE[record.rating];
        evidence.set(key,stats);
      }
    }
  });

  const model=new Map();
  evidence.forEach((stats,key) => {
    if(stats.observations<MIN_RELATION_OBSERVATIONS) return;
    const posteriorQuality=(stats.valueTotal+baseline*PRIOR_STRENGTH)/(stats.observations+PRIOR_STRENGTH);
    const difference=posteriorQuality-baseline;
    const multiplier=difference<0
      ? clamp(Math.exp(difference*3),0.35,1)
      : clamp(1+difference*1.8,1,1.15);
    model.set(key,{...stats,baseline,posteriorQuality,multiplier});
  });
  return model;
}

export async function fetchRelationshipModel({supabaseUrl,supabaseKey,theme,table="admin_rankings"}){
  const pageSize=1000;
  const records=[];
  let offset=0;
  while(true){
    const query=new URLSearchParams({
      select:"theme,words,rating",
      theme:`eq.${theme}`,
      order:"created_at.asc",
      limit:String(pageSize),
      offset:String(offset)
    });
    const response=await fetch(`${supabaseUrl}/rest/v1/${table}?${query}`,{
      cache:"no-store",
      headers:{apikey:supabaseKey,authorization:`Bearer ${supabaseKey}`}
    });
    if(!response.ok) throw new Error("Ranking request failed");
    const page=await response.json();
    records.push(...page);
    if(page.length<pageSize) break;
    offset+=pageSize;
  }
  return buildRelationshipModel(records,{theme});
}

export function makeGeneratorRoll({
  deck,
  count=3,
  selectedMain="Random",
  seedWords=[],
  relationshipModel=new Map()
}){
  const safeDeck=Array.isArray(deck)?deck:[];
  const plan=count===1?["main"]:count===2?["main","detail"]:["main","detail","effect"];
  const chosen=[];
  const chosenWords=new Set();
  const usedFamilies=new Set();

  const addChosen=(item,wordOverride="") => {
    const word=wordOverride||item?.word;
    const key=normaliseWord(word);
    if(!key||chosenWords.has(key)) return false;
    const safeItem=item||{word:String(word).trim(),family:key};
    chosen.push(safeItem);
    chosenWords.add(key);
    usedFamilies.add(getFamily(safeItem));
    return true;
  };

  seedWords.slice(0,count).forEach((word,index) => {
    const key=normaliseWord(word);
    const matching=safeDeck.find(item=>normaliseWord(item.word)===key&&item.slot===plan[index])
      ||safeDeck.find(item=>normaliseWord(item.word)===key);
    addChosen(matching,matching?.word||String(word).trim());
  });

  if(!chosen.length&&selectedMain!=="Random"){
    const forced=safeDeck.find(item=>
      item.slot==="main"&&normaliseWord(item.word)===normaliseWord(selectedMain)
    );
    if(forced) addChosen(forced);
  }

  for(let index=chosen.length;index<plan.length;index++){
    const slot=plan[index];
    let picked=pickForSlot(safeDeck,slot,usedFamilies,chosenWords,chosen,relationshipModel);
    if(!picked&&slot==="effect") picked=pickForSlot(safeDeck,"detail",usedFamilies,chosenWords,chosen,relationshipModel);
    if(!picked&&slot==="detail") picked=pickForSlot(safeDeck,"main",usedFamilies,chosenWords,chosen,relationshipModel);
    if(!picked) continue;
    addChosen(picked);
  }
  return chosen;
}

function pickForSlot(deck,slot,usedFamilies,chosenWords,chosen,relationshipModel){
  const options=deck.filter(item =>
    item.slot===slot&&
    !chosenWords.has(normaliseWord(item.word))&&
    !usedFamilies.has(getFamily(item))&&
    requirementsMet(item,chosenWords)&&
    compatibilityMet(item,chosenWords)
  );
  return weightedPick(options,chosen,relationshipModel);
}

function weightedPick(items,chosen,relationshipModel){
  if(!items.length) return null;
  const weighted=items.map(item=>({
    item,
    weight:normaliseWeight(item)*combinedRelationshipMultiplier(relationshipModel,item.word,chosen)
  }));
  const total=weighted.reduce((sum,entry)=>sum+entry.weight,0);
  let cursor=Math.random()*total;
  for(const entry of weighted){
    cursor-=entry.weight;
    if(cursor<=0) return entry.item;
  }
  return weighted[weighted.length-1].item;
}

function combinedRelationshipMultiplier(model,candidateWord,chosen){
  const value=chosen.reduce((product,item)=>{
    const relation=model instanceof Map?model.get(relationshipKey(candidateWord,item.word)):null;
    return product*(relation?.multiplier||1);
  },1);
  return clamp(value,0.20,1.25);
}

function requirementsMet(item,chosenWords){
  if(!Array.isArray(item.requires)||!item.requires.length) return true;
  return item.requires.every(word=>chosenWords.has(normaliseWord(word)));
}

function compatibilityMet(item,chosenWords){
  if(chosenWords.has(normaliseWord(item.word))) return false;
  if(!Array.isArray(item.blockedWith)||!item.blockedWith.length) return true;
  return !item.blockedWith.some(word=>chosenWords.has(normaliseWord(word)));
}

function normaliseWeight(item){
  const explicit=Number(item?.weight);
  if(Number.isFinite(explicit)&&explicit>0) return explicit;
  return WEIGHT_BY_SCORE[Number(item?.score)]??1;
}

function getFamily(item){
  return item.family||normaliseWord(item.word).replace(/\s+/g,"-");
}

function relationshipKey(left,right){
  return [normaliseWord(left),normaliseWord(right)].sort().join("\u0000");
}

function normaliseWord(value){
  return String(value||"").trim().toLocaleLowerCase("en-US");
}

function clamp(value,min,max){return Math.min(max,Math.max(min,value));}
