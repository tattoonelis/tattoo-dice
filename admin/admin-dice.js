import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

let scene;
let camera;
let renderer;
let floor;
let host;
let deck = [];
let diceMeshes = [];
let running = false;

const layouts = {
  1: [[0.00, -0.24, 0.34, -0.82, 0.10, 0.00, 2.42]],
  2: [
    [-0.92, -0.30, 0.38, -0.82, 0.20, -0.06, 1.92],
    [ 0.92, -0.08,-0.52, -0.78,-0.28,  0.10, 1.72]
  ],
  3: [
    [ 0.00, -0.34, 0.56, -0.82, 0.10, 0.00, 2.06],
    [-2.06, -0.04,-0.66, -0.78, 0.36,-0.13, 1.66],
    [ 2.06, -0.04,-0.66, -0.78,-0.36, 0.13, 1.66]
  ]
};

const FACE_NORMALS = [
  new THREE.Vector3(1,0,0), new THREE.Vector3(-1,0,0),
  new THREE.Vector3(0,1,0), new THREE.Vector3(0,-1,0),
  new THREE.Vector3(0,0,1), new THREE.Vector3(0,0,-1)
];

export function initAdminDice(element){
  host = element;
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(29,1,.1,100);
  camera.position.set(0,6.8,7.1);
  camera.lookAt(0,-.55,0);

  renderer = new THREE.WebGLRenderer({antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1,2.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff,1.35));

  const key = new THREE.DirectionalLight(0xfff4dd,2.15);
  key.position.set(-2.8,8.8,7.2);
  key.castShadow = true;
  key.shadow.mapSize.set(2048,2048);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xe6efff,.28);
  fill.position.set(4.5,4.6,2.4);
  scene.add(fill);

  floor = new THREE.Mesh(
    new THREE.PlaneGeometry(20,12),
    new THREE.ShadowMaterial({color:0x000000,opacity:.32})
  );
  floor.rotation.x = -Math.PI/2;
  floor.position.y = -1.58;
  floor.receiveShadow = true;
  scene.add(floor);

  resize();
  window.addEventListener("resize",resize);
  animate();
}

export function setAdminDiceDeck(nextDeck){
  deck = Array.isArray(nextDeck) ? nextDeck : [];
}

export function showAdminDice(words, animateRoll = true){
  if(!scene) return;

  diceMeshes.forEach(mesh => {
    scene.remove(mesh);
    if(Array.isArray(mesh.material)){
      mesh.material.forEach(material => {
        material.map?.dispose();
        material.dispose();
      });
    }
    mesh.geometry?.dispose();
  });
  diceMeshes = [];

  const selected = words.slice(0,3);
  const layout = layouts[selected.length] || layouts[3];

  selected.forEach((word,index) => {
    const p = layout[index];
    const mesh = createTextDie(word,p);
    mesh.renderOrder = index === 0 ? 2 : 1;
    mesh.position.set(p[0],p[1],p[2]);
    mesh.rotation.set(p[3],p[4],p[5]);
    mesh.userData.base = mesh.position.clone();
    mesh.userData.layout = p;
    mesh.userData.startRot = new THREE.Euler();
    mesh.userData.endRot = new THREE.Euler();
    mesh.userData.startTime = 0;
    mesh.userData.duration = 1;
    mesh.userData.delay = index * .06;
    mesh.userData.rolling = false;
    mesh.castShadow = index === 0;
    mesh.receiveShadow = true;
    scene.add(mesh);
    diceMeshes.push(mesh);
  });

  if(animateRoll) startDiceAnimation();
}

function createTextDie(finalWord,layout){
  const size = layout[6];
  const visibleFaceIndex = getLandingFaceIndex(layout);
  const allFaces = makeFaceWords(finalWord,visibleFaceIndex);

  const materials = allFaces.map(faceWord => new THREE.MeshPhysicalMaterial({
    map:makeTextTexture(faceWord),
    roughness:.36,
    metalness:0,
    clearcoat:.22,
    clearcoatRoughness:.42,
    transparent:false,
    opacity:1,
    depthTest:true,
    depthWrite:true
  }));

  const geometry = new RoundedBoxGeometry(size,size,size,28,size*.11);
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry,materials);
}

function getLandingFaceIndex(layout){
  const position = new THREE.Vector3(layout[0],layout[1],layout[2]);
  const euler = new THREE.Euler(layout[3],layout[4],layout[5]);
  const toCamera = camera.position.clone().sub(position).normalize();
  let bestIndex = 4;
  let bestDot = -Infinity;

  FACE_NORMALS.forEach((normal,index) => {
    const dot = normal.clone().applyEuler(euler).normalize().dot(toCamera);
    if(dot > bestDot){
      bestDot = dot;
      bestIndex = index;
    }
  });
  return bestIndex;
}

function makeFaceWords(finalWord,visibleFaceIndex){
  const words = [];
  const used = new Set([finalWord]);
  for(let i=0;i<6;i++){
    words.push(i === visibleFaceIndex ? finalWord : randomDeckWord(used));
  }
  return words;
}

function randomDeckWord(used){
  if(!deck.length) return "Tattoo";
  for(let attempts=0;attempts<50;attempts++){
    const word = deck[Math.floor(Math.random()*deck.length)]?.word || "Tattoo";
    if(!used.has(word)){
      used.add(word);
      return word;
    }
  }
  return "Tattoo";
}

function makeTextTexture(text){
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const bg = ctx.createLinearGradient(0,0,1024,1024);
  bg.addColorStop(0,"#fff9eb");
  bg.addColorStop(.62,"#eadfcc");
  bg.addColorStop(1,"#c7bda8");
  ctx.fillStyle = bg;
  ctx.fillRect(0,0,1024,1024);

  const shine = ctx.createRadialGradient(330,245,70,512,512,790);
  shine.addColorStop(0,"rgba(255,255,255,.20)");
  shine.addColorStop(.55,"rgba(255,255,255,.04)");
  shine.addColorStop(1,"rgba(0,0,0,.075)");
  ctx.fillStyle = shine;
  ctx.fillRect(0,0,1024,1024);

  ctx.strokeStyle = "rgba(255,255,255,.16)";
  ctx.lineWidth = 18;
  ctx.strokeRect(42,42,940,940);

  ctx.save();
  ctx.translate(512,512);
  drawDiceText(ctx,text);
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function drawDiceText(ctx,text){
  const raw = String(text || "Roll").trim();
  const lines = buildTextLines(raw);
  const maxWidth = 720;
  const maxHeight = 620;
  let fontSize = fitFontSize(ctx,lines,estimateFontSize(lines),maxWidth,maxHeight);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#111";
  ctx.strokeStyle = "rgba(255,255,255,.16)";
  ctx.lineWidth = Math.max(2,fontSize*.018);
  ctx.font = `900 ${fontSize}px "Arial Rounded MT Bold","Arial Rounded MT",Arial,sans-serif`;

  const lineHeight = fontSize*.94;
  const startY = -((lines.length-1)*lineHeight)/2;
  lines.forEach((line,index) => {
    const y = startY + index*lineHeight;
    ctx.strokeText(line,0,y);
    ctx.fillText(line,0,y);
  });
}

function buildTextLines(text){
  const parts = text.split(/\s+/).filter(Boolean);
  return parts.length ? parts : ["Roll"];
}

function estimateFontSize(lines){
  const longest = lines.reduce((a,b) => a.length >= b.length ? a : b,"");
  let size = 218;
  if(longest.length >= 16) size = 72;
  else if(longest.length >= 14) size = 84;
  else if(longest.length >= 12) size = 98;
  else if(longest.length >= 10) size = 116;
  else if(longest.length >= 8) size = 140;
  else if(longest.length >= 6) size = 170;
  else if(longest.length >= 5) size = 194;
  if(lines.length >= 2) size = Math.min(size,154);
  if(lines.length >= 3) size = Math.min(size,116);
  if(lines.length >= 4) size = Math.min(size,86);
  return size;
}

function fitFontSize(ctx,lines,start,maxWidth,maxHeight){
  let size = start;
  while(size > 42){
    ctx.font = `900 ${size}px "Arial Rounded MT Bold","Arial Rounded MT",Arial,sans-serif`;
    const widest = Math.max(...lines.map(line => ctx.measureText(line).width));
    const height = lines.length*size*.94;
    if(widest <= maxWidth && height <= maxHeight) return size;
    size -= 4;
  }
  return size;
}

function startDiceAnimation(){
  const now = performance.now()/1000;
  running = true;

  diceMeshes.forEach((die,index) => {
    const p = die.userData.layout;
    const strengthVariation = .94 + Math.random()*.12;
    const timingVariation = (Math.random()-.5)*.06;

    die.userData.startTime = now;
    die.userData.duration = 1.34 + index*.07 + timingVariation;
    die.userData.delay = index*(.045 + Math.random()*.018);
    die.userData.rolling = true;
    die.userData.startRot.copy(die.rotation);
    die.userData.endRot.set(
      p[3] + 4*Math.PI*2,
      p[4] + 4*Math.PI*2,
      p[5] + 2*Math.PI*2
    );
    die.userData.physicsStrength = (index === 0 ? .72 : .54)*strengthVariation;
    die.userData.wobbleAmplitude = (index === 0 ? .085 : .065)*(.9+Math.random()*.2);
    die.userData.wobbleFrequency = 10.5 + Math.random()*2.2;
    die.userData.wobblePhase = Math.random()*Math.PI*2;
  });
}

function landingBounce(progress,strength=.54){
  if(progress < .58) return Math.sin(progress/.58*Math.PI)*strength*.86;
  if(progress < .77) return Math.sin((progress-.58)/.19*Math.PI)*strength*.72;
  if(progress < .91) return Math.sin((progress-.77)/.14*Math.PI)*strength*.36;
  return Math.sin(Math.min((progress-.91)/.09,1)*Math.PI)*strength*.14;
}

function landingSquash(progress,index=0){
  const impact1 = Math.exp(-Math.pow((progress-.58)/.020,2));
  const impact2 = Math.exp(-Math.pow((progress-.77)/.017,2));
  const impact3 = Math.exp(-Math.pow((progress-.91)/.013,2));
  const amount = (impact1*.075 + impact2*.034 + impact3*.014)*(index === 0 ? 1 : .84);
  return {y:1-amount,xz:1+amount*.64};
}

function dampedWobble(progress,amplitude,frequency,phase){
  const start = .66;
  if(progress <= start) return 0;
  const local = (progress-start)/(1-start);
  return Math.sin(local*frequency+phase)*amplitude*Math.exp(-4.8*local);
}

function animate(){
  requestAnimationFrame(animate);
  const t = performance.now()/1000;

  diceMeshes.forEach((die,index) => {
    if(!die.userData.rolling) return;
    const elapsed = t-die.userData.startTime-die.userData.delay;
    if(elapsed < 0) return;

    const progress = Math.min(Math.max(elapsed/die.userData.duration,0),1);
    const spinProgress = Math.min(progress/.58,1);
    const easedSpin = easeInOutCubic(spinProgress);
    const p = die.userData.layout;

    if(progress < .58){
      die.rotation.x = lerp(die.userData.startRot.x,die.userData.endRot.x,easedSpin);
      die.rotation.y = lerp(die.userData.startRot.y,die.userData.endRot.y,easedSpin);
      die.rotation.z = lerp(die.userData.startRot.z,die.userData.endRot.z,easedSpin);
    }else{
      die.rotation.x = p[3];
      die.rotation.y = p[4];
      die.rotation.z = p[5] + dampedWobble(
        progress,
        die.userData.wobbleAmplitude,
        die.userData.wobbleFrequency,
        die.userData.wobblePhase
      );
    }

    const bounce = landingBounce(progress,die.userData.physicsStrength);
    die.position.x = die.userData.base.x;
    die.position.y = die.userData.base.y + bounce;
    die.position.z = die.userData.base.z;

    const squash = landingSquash(progress,index);
    die.scale.set(squash.xz,squash.y,squash.xz);

    if(progress >= 1){
      die.userData.rolling = false;
      die.position.copy(die.userData.base);
      die.rotation.set(p[3],p[4],p[5]);
      die.scale.set(1,1,1);
    }
  });

  running = diceMeshes.some(die => die.userData.rolling);
  renderer?.render(scene,camera);
}

function resize(){
  if(!host || !renderer || !camera) return;
  const rect = host.getBoundingClientRect();
  const width = Math.max(1,rect.width);
  const height = Math.max(1,rect.height);
  renderer.setSize(width,height,false);
  camera.aspect = width/height;
  camera.updateProjectionMatrix();
}

function lerp(a,b,t){ return a+(b-a)*t; }
function easeInOutCubic(x){
  return x < .5 ? 4*x*x*x : 1-Math.pow(-2*x+2,3)/2;
}
