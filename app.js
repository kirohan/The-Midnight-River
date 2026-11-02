import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const $ = (id) => document.getElementById(id);
const canvas = $('river-canvas');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const clock = new THREE.Clock();
let renderer, scene, camera, water, boat, lanternLight, lanternFlame, moon, moonHalo, distantLaunch, cloudGroups = [], fireflies = [], floatingLeaves = [], wakeRings = [], villageLights = [], reeds = [], trees = [], launchLights = [], rippleEffects = [];
const soundElements = { river: $('river-audio'), insects: $('insect-audio'), wildlife: $('wildlife-audio'), horn: $('horn-audio'), creak: $('creak-audio'), plop: $('plop-audio') };
const soundLevels = { river: .32, insects: .14, wildlife: .18, effects: .25 };
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const riverSecrets = [
  {id:'water',title:'The river’s pulse',copy:'Even a small touch travels outward through the dark water.',clue:'Tap the water to send a ring across the surface.'},
  {id:'lantern',title:'The keeper’s lantern',copy:'A small amber flame keeps the boat visible in the wide dark.',clue:'Find the warm light on the fishing boat.'},
  {id:'moon',title:'The moon path',copy:'Clouds break the moonlight into silver fragments that move with the waves.',clue:'Look toward the pale moon above the river.'},
  {id:'fireflies',title:'Lights in the reeds',copy:'Tiny lights drift between the bamboo and trees, never keeping the same rhythm.',clue:'Tap a firefly near the riverbank.'},
  {id:'village',title:'A village still awake',copy:'Behind the fog, a few windows are still warm. Someone has not gone to sleep yet.',clue:'Find a distant house with a glowing window.'},
  {id:'ghat',title:'The old wooden ghat',copy:'The wet planks remember the people who crossed this river before midnight.',clue:'Look for the small landing at the river edge.'},
  {id:'launch',title:'A distant river launch',copy:'A larger vessel moves slowly beyond the mist, carrying its own small constellation of lights.',clue:'Search the horizon for the long, low silhouette.'},
  {id:'bamboo',title:'Bamboo after rain',copy:'The leaves barely move, but the night wind passes through them all the same.',clue:'Tap the dark bamboo grove on either bank.'},
  {id:'leaves',title:'Leaves on the current',copy:'Small leaves drift without hurry, carried by a current you can barely see.',clue:'Find a floating leaf on the water.'},
  {id:'stillness',title:'The night watcher',copy:'You stayed long enough for the river to stop feeling like a scene and start feeling like a place.',clue:'Spend one quiet minute in Explore Mode.'}
];
let discovered = new Set();
try { discovered = new Set(JSON.parse(localStorage.getItem('nishith-nodi-discoveries') || '[]')); } catch {}
let toastTimer = 0, exploreModeStartTime = 0, stillnessAwarded = false, fireflyPulseUntil = 0, moonPulseUntil = 0, lanternPulseUntil = 0, villagePulseUntil = 0, launchPulseUntil = 0, ambientRippleNextAt = 19;
let initialized = false, started = false, cinematicMode = true, soundEnabled = true, interfaceVisible = true;
let startTime = 0, currentTime = 0, previousCycle = -1, hornPlayed = false, birdPlayed = false, lastCaption = -1, exploreTarget = {x:0,y:0}, exploreCurrent = {x:0,y:0};
let audioTimerIds = [], ambienceStarted = false;
const DURATION = 120;
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;

const vertexShader = `
varying vec3 vWorldPosition;
varying float vWave;
uniform float uTime;
void main(){
  vec3 p = position;
  float t = uTime;
  float w1 = sin(p.x * 0.115 + t * 0.42) * 0.13;
  float w2 = sin(p.y * 0.18 - t * 0.31 + p.x * 0.035) * 0.075;
  float w3 = sin((p.x + p.y) * 0.062 + t * 0.24) * 0.11;
  float w4 = sin(p.x * 0.29 + p.y * 0.12 + t * 0.72) * 0.018;
  p.z += w1 + w2 + w3 + w4;
  vWave = w1 + w2 + w3 + w4;
  vec4 worldPos = modelMatrix * vec4(p, 1.0);
  vWorldPosition = worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}`;
const fragmentShader = `
#include <common>
#include <tonemapping_pars_fragment>
#include <colorspace_pars_fragment>
varying vec3 vWorldPosition;
varying float vWave;
uniform float uTime;
uniform float uMoonX;
uniform float uBoatX;
uniform float uBoatZ;
uniform float uLantern;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float noise(vec2 p){vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
void main(){
  vec2 p = vWorldPosition.xz;
  float n = noise(p*vec2(.19,.11)+vec2(uTime*.035,-uTime*.02));
  float n2 = noise(p*vec2(.47,.29)+vec2(-uTime*.08,uTime*.055));
  float depth = clamp((abs(p.x)-10.0)/48.0,0.0,1.0);
  vec3 deep = vec3(0.008,0.025,0.043);
  vec3 blue = vec3(0.025,0.075,0.105);
  vec3 color = mix(deep,blue,0.25 + n*.23 + n2*.1);
  float moonDrift = sin(p.y*.24 + uTime*.45)*.26 + sin(p.y*.071-uTime*.17)*.5;
  float moonDist = abs(p.x - (uMoonX + moonDrift));
  float moonBand = (1.0-smoothstep(.05,1.45 + abs(p.y)*.008,moonDist));
  float moonBroken = smoothstep(.12,.75,noise(vec2(p.x*2.8 + uTime*.15,p.y*.16))) * (.32 + .68*noise(vec2(p.x*1.3,p.y*.36-uTime*.1)));
  moonBand *= moonBroken * (1.0-depth*.45);
  color += vec3(.32,.43,.49)*moonBand*.82;
  float glint = smoothstep(.79,.98,n2) * smoothstep(.12,.42,abs(vWave));
  color += vec3(.12,.19,.22)*glint;
  float boatDist = abs(p.x-uBoatX);
  float alongBoat = exp(-abs(p.y-uBoatZ)*.055);
  float lanternBand = (1.0-smoothstep(.03,.52,boatDist))*alongBoat*uLantern;
  float lanternBreak = .35 + .65*noise(vec2(p.x*3.2,p.y*.32+uTime*.2));
  color += vec3(.62,.25,.065)*lanternBand*lanternBreak*.8;
  float wake = exp(-abs(p.x-uBoatX)*1.3)*exp(-abs(p.y-(uBoatZ+4.0))*.22)*.18;
  color += vec3(.12,.18,.2)*wake;
  float horizonFade = smoothstep(-390.0,-220.0,p.y);
  color = mix(color,vec3(.018,.038,.056),horizonFade*.32);
  float fog = 1.0-exp(-length(vec2(p.x*.045,(p.y+10.0)*.022))*.18);
  color = mix(color,vec3(.025,.06,.083),clamp(fog,0.0,.55));
  gl_FragColor = vec4(color,1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function makeMaterial(color, roughness=.9, extra={}) {
  return new THREE.MeshStandardMaterial({color, roughness, ...extra});
}
function randomRange(min,max){return min+Math.random()*(max-min)}
function addBox(parent, geo, material, position, scale, rotation={x:0,y:0,z:0}){
  const mesh = new THREE.Mesh(geo,material); mesh.position.set(...position); mesh.scale.set(...scale); mesh.rotation.set(rotation.x,rotation.y,rotation.z); parent.add(mesh); return mesh;
}
function makeGlowTexture(){
  const c=document.createElement('canvas');c.width=128;c.height=128;const ctx=c.getContext('2d');const g=ctx.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,224,166,0.9)');g.addColorStop(.15,'rgba(232,164,83,0.4)');g.addColorStop(.45,'rgba(150,190,210,0.08)');g.addColorStop(1,'rgba(150,190,210,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;return tex;
}
function makeMoonTexture(){
  const c=document.createElement('canvas');c.width=256;c.height=256;const ctx=c.getContext('2d');const g=ctx.createRadialGradient(128,128,5,128,128,128);g.addColorStop(0,'rgba(210,228,237,0.35)');g.addColorStop(.25,'rgba(145,178,198,0.16)');g.addColorStop(.58,'rgba(82,125,151,0.055)');g.addColorStop(1,'rgba(30,65,88,0)');ctx.fillStyle=g;ctx.fillRect(0,0,256,256);const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;return tex;
}
function addTree(x,z,side,scale=1){
  const group=new THREE.Group();group.position.set(x,0,z);group.scale.setScalar(scale);group.userData.interactionId='bamboo';scene.add(group);
  const trunkMat=makeMaterial(0x201c18,1);const leafMats=[makeMaterial(0x10241f,1),makeMaterial(0x162b24,1),makeMaterial(0x1b3028,1)];
  const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.13,.24,4.8,7),trunkMat);trunk.position.y=2.3;trunk.rotation.z=randomRange(-.12,.12);group.add(trunk);
  for(let i=0;i<5;i++){const radius=randomRange(1.15,2.05),h=randomRange(2.2,3.5);const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(1,1),leafMats[i%leafMats.length]);crown.scale.set(radius,h*.55,radius*.82);crown.position.set(randomRange(-.6,.6),randomRange(4.1,6.3),randomRange(-.55,.55));group.add(crown)}
  trees.push({group,baseX:x,phase:Math.random()*Math.PI*2,side});return group;
}
function addBambooGrove(x,z,side,count=7){
  const group=new THREE.Group();group.position.set(x,0,z);group.userData.interactionId='bamboo';scene.add(group);const bambooMat=makeMaterial(0x26352b,.92);const nodeMat=makeMaterial(0x48513a,.95);
  for(let i=0;i<count;i++){const h=randomRange(5,9),r=randomRange(.035,.07),stem=new THREE.Mesh(new THREE.CylinderGeometry(r*.8,r,h,6),bambooMat);stem.position.set(randomRange(-1.8,1.8),h/2,randomRange(-1.2,1.2));stem.rotation.z=randomRange(-.12,.12);stem.rotation.x=randomRange(-.06,.06);group.add(stem);for(let n=1;n<5;n++){const ring=new THREE.Mesh(new THREE.TorusGeometry(r*1.03,.009,3,7),nodeMat);ring.position.set(stem.position.x, h*n/5, stem.position.z);ring.rotation.x=Math.PI/2;group.add(ring)}for(let j=0;j<4;j++){const leaf=new THREE.Mesh(new THREE.ConeGeometry(.11,1.2,4),leafMatForBamboo);leaf.position.set(stem.position.x+randomRange(-.6,.6),h-randomRange(.2,1.4),stem.position.z+randomRange(-.5,.5));leaf.rotation.z=randomRange(-1.1,1.1);leaf.rotation.x=randomRange(-.6,.6);group.add(leaf)}}
  group.userData.baseX=x;group.userData.phase=Math.random()*6;reeds.push(group);return group;
}
const leafMatForBamboo=makeMaterial(0x1d3027,.95);
function addHouse(x,z,side,index){
  const group=new THREE.Group();group.position.set(x,0,z);group.userData.interactionId='village';scene.add(group);
  const wall=makeMaterial(index%2?0x302b25:0x272d2d,.95);const roof=makeMaterial(0x343b3d,.64,{metalness:.24});const trim=makeMaterial(0x181e20,1);const windowMat=new THREE.MeshStandardMaterial({color:0xe8a453,emissive:0x8a4c17,emissiveIntensity:randomRange(.5,1.1),roughness:.8});
  addBox(group,new THREE.BoxGeometry(1,1,1),wall,[0,1.25,0],[4.2,2.5,3.5]);
  const leftRoof=addBox(group,new THREE.BoxGeometry(2.55,.12,4.0),roof,[-1.02,2.72,0],[1,1,1],{z:-.25});
  const rightRoof=addBox(group,new THREE.BoxGeometry(2.55,.12,4.0),roof,[1.02,2.72,0],[1,1,1],{z:.25});
  addBox(group,new THREE.BoxGeometry(4.35,.12,.12),trim,[0,2.52,0],[1,1,1]);
  const faceX=side>0?-2.12:2.12;
  for(let i=0;i<2;i++){
    const win=addBox(group,new THREE.BoxGeometry(.06,.42,.46),windowMat,[faceX,1.45,(i-.5)*1.45],[1,1,1]);
    const glow=new THREE.PointLight(0xe8a453,.45,7,2);glow.position.set(faceX*1.18,1.5,(i-.5)*1.45);group.add(glow);villageLights.push({light:glow,phase:Math.random()*10,base:glow.intensity});
  }
  for(let i=-1;i<=1;i++){addBox(group,new THREE.BoxGeometry(.09,1.5,.09),trim,[i*1.65,.75,side>0?-1.78:1.78],[1,1,1]);}
  return group;
}
function addGhat(x,z,side){
  const group=new THREE.Group();group.position.set(x,0,z);group.rotation.y=side>0?0:Math.PI;group.userData.interactionId='ghat';scene.add(group);const wood=makeMaterial(0x29251f,.95);const post=makeMaterial(0x201c18,1);
  for(let i=0;i<5;i++)addBox(group,new THREE.BoxGeometry(4.5,.12,.38),wood,[side>0?-1.5:1.5,.35,-i*.43],[1,1,1]);
  for(let xoff of [-3.4,.4])for(let zoff of [-.1,-1.8])addBox(group,new THREE.BoxGeometry(.14,1.1,.14),post,[side>0?xoff:-xoff,.15,zoff],[1,1,1]);
  return group;
}
function createTerrain(){
  const terrainMat=makeMaterial(0x171d1b,1);const terrainGeo=new THREE.PlaneGeometry(72,460,45,90);const pos=terrainGeo.attributes.position;
  for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i);pos.setZ(i,Math.sin(x*.14+y*.04)*.22+Math.sin(y*.17)*.12)}terrainGeo.computeVertexNormals();
  for(const side of [-1,1]){const terrain=new THREE.Mesh(terrainGeo,terrainMat);terrain.rotation.x=-Math.PI/2;terrain.position.set(side*69,-.1,-145);scene.add(terrain);
    const shoreMat=makeMaterial(0x242a25,1);const shore=new THREE.Mesh(new THREE.BoxGeometry(2,.28,470),shoreMat);shore.position.set(side*33,-.04,-145);scene.add(shore);
    for(let i=0;i<11;i++){const z=-330+i*34+randomRange(-8,8);addTree(side*randomRange(39,54),z,side,randomRange(.7,1.2));}
    for(let i=0;i<5;i++){const z=-300+i*62+randomRange(-12,12);addBambooGrove(side*randomRange(35,43),z,side,randomRange(5,9)|0);}
    for(let i=0;i<7;i++){const z=-300+i*43+randomRange(-12,12);addHouse(side*randomRange(45,64),z,side,i);}
    for(let i=0;i<3;i++)addGhat(side*randomRange(31,34),-270+i*115+randomRange(-10,10),side);
  }
}
function createBoat(){
  const group=new THREE.Group();group.userData.interactionId='lantern';scene.add(group);group.position.set(-2,-.05,-50);boat=group;
  const hullMat=makeMaterial(0x3a271c,.86,{metalness:.02});const innerMat=makeMaterial(0x4b3424,.9);const plankMat=makeMaterial(0x57402b,.92);const ropeMat=makeMaterial(0x5d4b35,1);const darkMat=makeMaterial(0x171614,1);
  const stations=[[-3.8,.05],[-3.15,.38],[-2.25,.68],[-1.1,.83],[0,.88],[1.1,.83],[2.25,.68],[3.15,.38],[3.8,.05]];const cross=[[-.43,.13],[-.83,.52],[-.72,.63],[.72,.63],[.83,.52],[.43,.13]];const verts=[],indices=[];
  for(const [z,w] of stations){for(const [x,y] of cross){verts.push(x*(w/.83),y,z)}}
  const n=cross.length;for(let i=0;i<stations.length-1;i++){for(let j=0;j<n;j++){const a=i*n+j,b=i*n+(j+1)%n,c=(i+1)*n+(j+1)%n,d=(i+1)*n+j;indices.push(a,b,d,b,c,d)}}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.setIndex(indices);geo.computeVertexNormals();const hull=new THREE.Mesh(geo,hullMat);hull.material.side=THREE.DoubleSide;group.add(hull);
  // Inner deck and aged longitudinal planks.
  addBox(group,new THREE.BoxGeometry(1.35,.07,6.45),innerMat,[0,.48,0],[1,1,1]);
  for(let i=-3;i<=3;i++){const plank=addBox(group,new THREE.BoxGeometry(.17,.025,5.8),plankMat,[i*.18,.525,0],[1,1,1]);plank.rotation.y=randomRange(-.015,.015)}
  for(const z of [-2.5,-1.2,.2,1.55,2.55]){const width=Math.max(.15,Math.cos(Math.abs(z)/3.8*Math.PI/2)*1.6);addBox(group,new THREE.BoxGeometry(width,.1,.16),plankMat,[0,.58,z],[1,1,1]);}
  for(const side of [-1,1]){
    const rail=addBox(group,new THREE.BoxGeometry(.08,.1,5.8),plankMat,[side*.68,.62,.05],[1,1,1]);rail.rotation.y=side*.025;
    for(let i=0;i<5;i++){const peg=new THREE.Mesh(new THREE.CylinderGeometry(.035,.04,.2,6),darkMat);peg.position.set(side*.69,.66,-2.3+i*1.1);group.add(peg)}
  }
  // Coiled rope and a folded fishing net.
  const rope=new THREE.Mesh(new THREE.TorusGeometry(.28,.035,5,24),ropeMat);rope.rotation.x=Math.PI/2;rope.position.set(.35,.66,1.95);rope.scale.set(1,.75,1);group.add(rope);
  const netMat=new THREE.LineBasicMaterial({color:0x726a51,transparent:true,opacity:.45});const netGroup=new THREE.Group();netGroup.position.set(-.3,.64,1.1);group.add(netGroup);
  for(let i=0;i<7;i++){const pts=[];pts.push(new THREE.Vector3(-.35+i*.1,0,-.45));pts.push(new THREE.Vector3(-.28+i*.1,.05,.45));const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),netMat);netGroup.add(line)}
  for(let i=0;i<5;i++){const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-.4,.01,-.4+i*.2),new THREE.Vector3(.35,.03,-.35+i*.2)]),netMat);netGroup.add(line)}
  // Lantern body, glass, flame and warm light.
  const lantern=new THREE.Group();lantern.position.set(.08,.72,-.55);group.add(lantern);
  const brass=makeMaterial(0x5b4328,.42,{metalness:.48});const glass=new THREE.MeshStandardMaterial({color:0x9c9c7c,transparent:true,opacity:.2,roughness:.12,metalness:.08,side:THREE.DoubleSide});
  addBox(lantern,new THREE.BoxGeometry(.24,.07,.24),brass,[0,0,0],[1,1,1]);addBox(lantern,new THREE.BoxGeometry(.18,.27,.18),glass,[0,.17,0],[1,1,1]);addBox(lantern,new THREE.BoxGeometry(.26,.045,.26),brass,[0,.32,0],[1,1,1]);addBox(lantern,new THREE.BoxGeometry(.14,.04,.14),brass,[0,-.04,0],[1,1,1]);
  const flameMat=new THREE.MeshBasicMaterial({color:0xffb44f});lanternFlame=new THREE.Mesh(new THREE.SphereGeometry(.047,8,8),flameMat);lanternFlame.position.set(0,.16,0);lantern.add(lanternFlame);
  const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:makeGlowTexture(),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:.85}));glow.scale.set(4,4,1);glow.position.set(0,.2,0);lantern.add(glow);
  lanternLight=new THREE.PointLight(0xe8a453,2.1,12,2);lanternLight.position.set(0,.32,0);lantern.add(lanternLight);
  // A simple stern paddle and a low bamboo fishing pole.
  const paddle=addBox(group,new THREE.BoxGeometry(.09,.07,2.1),plankMat,[.62,.68,2.0],[1,1,1],{x:.12,z:-.1});addBox(group,new THREE.BoxGeometry(.28,.055,.48),plankMat,[.62,.68,3.0],[1,1,1],{x:.12,z:-.1});
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.018,.035,3.6,5),makeMaterial(0x5a5034,1));pole.position.set(-.45,1.25,1.3);pole.rotation.x=.38;pole.rotation.z=-.24;group.add(pole);
  // Wake rings are subtle surface cues rather than bright graphic circles.
  for(let i=0;i<4;i++){const ring=new THREE.Mesh(new THREE.TorusGeometry(1,.018,4,44),new THREE.MeshBasicMaterial({color:0x6c8b99,transparent:true,opacity:.14-i*.025,depthWrite:false}));ring.rotation.x=Math.PI/2;ring.position.set(0,.08,3.4+i*.75);ring.scale.set(1.25+i*.12,1,1);group.add(ring);wakeRings.push({mesh:ring,phase:i*.6,index:i})}
  boat.userData.lantern=lantern;boat.userData.baseX=-2;boat.userData.baseY=0;boat.userData.net=netGroup;
}
function createDistantLaunch(){
  const group=new THREE.Group();group.userData.interactionId='launch';group.position.set(11,.04,-142);group.scale.setScalar(.72);scene.add(group);distantLaunch=group;
  const hullMat=makeMaterial(0x11191d,.82,{metalness:.08});const deckMat=makeMaterial(0x242d31,.9);const cabinMat=makeMaterial(0x1b2428,.88);const roofMat=makeMaterial(0x11191d,.7);
  addBox(group,new THREE.BoxGeometry(2.7,.48,9.8),hullMat,[0,.25,0],[1,1,1]);
  addBox(group,new THREE.BoxGeometry(2.45,.12,8.7),deckMat,[0,.53,.05],[1,1,1]);
  addBox(group,new THREE.BoxGeometry(1.8,1.05,3.6),cabinMat,[0,1.08,-.35],[1,1,1]);
  addBox(group,new THREE.BoxGeometry(2.0,.12,3.9),roofMat,[0,1.66,-.35],[1,1,1]);
  const windowMat=new THREE.MeshBasicMaterial({color:0xe8a453});
  for(let side of [-1,1])for(let i=0;i<3;i++){const w=addBox(group,new THREE.BoxGeometry(.035,.18,.26),windowMat,[side*.91,1.17,-1.35+i*.95],[1,1,1]);w.userData.interactionId='launch';}
  const mast=new THREE.Mesh(new THREE.CylinderGeometry(.025,.035,1.8,5),makeMaterial(0x202b30,1));mast.position.set(.35,2.25,2.4);group.add(mast);
  const lightA=new THREE.PointLight(0xe8a453,.25,9,2);lightA.position.set(0,1.45,-.35);group.add(lightA);launchLights.push({light:lightA,base:.25,phase:0});
  const lightB=new THREE.PointLight(0x9bbbc9,.16,7,2);lightB.position.set(0,1.05,4.4);group.add(lightB);launchLights.push({light:lightB,base:.16,phase:1.7});
}

function createMoonAndSky(){
  const moonMat=new THREE.MeshStandardMaterial({color:0xc4d5dc,emissive:0x718a99,emissiveIntensity:.52,roughness:1});moon=new THREE.Mesh(new THREE.SphereGeometry(2.1,32,24),moonMat);moon.userData.interactionId='moon';moon.position.set(-13,23,-100);scene.add(moon);
  moonHalo=new THREE.Sprite(new THREE.SpriteMaterial({map:makeMoonTexture(),transparent:true,depthWrite:false,opacity:.8,blending:THREE.AdditiveBlending}));moonHalo.position.copy(moon.position);moonHalo.scale.set(22,22,1);scene.add(moonHalo);
  const moonLight=new THREE.DirectionalLight(0x9ab8ca,.8);moonLight.position.set(-18,28,-50);scene.add(moonLight);
  const hemi=new THREE.HemisphereLight(0x294354,0x080d0d,.55);scene.add(hemi);
  const starPositions=[];for(let i=0;i<520;i++){starPositions.push(randomRange(-120,120),randomRange(8,58),randomRange(-180,-30))}const starGeo=new THREE.BufferGeometry();starGeo.setAttribute('position',new THREE.Float32BufferAttribute(starPositions,3));const stars=new THREE.Points(starGeo,new THREE.PointsMaterial({color:0x9bb3c2,size:.12,transparent:true,opacity:.48,sizeAttenuation:true,depthWrite:false}));scene.add(stars);
  const cloudMat=new THREE.MeshBasicMaterial({color:0x1b2c38,transparent:true,opacity:.22,depthWrite:false,side:THREE.DoubleSide});
  for(let i=0;i<10;i++){const group=new THREE.Group();group.position.set(randomRange(-50,50),randomRange(15,30),randomRange(-145,-45));group.rotation.y=randomRange(-.2,.2);for(let j=0;j<5;j++){const cloud=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),cloudMat);cloud.scale.set(randomRange(5,12),randomRange(.45,1.25),randomRange(2,4));cloud.position.set((j-2)*randomRange(2.2,4.5),randomRange(-.4,.4),randomRange(-1.5,1.5));group.add(cloud)}scene.add(group);cloudGroups.push({group,baseX:group.position.x,speed:randomRange(.05,.16),phase:Math.random()*5})}
}
function createFireflies(){
  const glowTex=makeGlowTexture();
  for(let i=0;i<36;i++){const mat=new THREE.SpriteMaterial({map:glowTex,transparent:true,opacity:randomRange(.12,.5),depthWrite:false,blending:THREE.AdditiveBlending});const sprite=new THREE.Sprite(mat);sprite.userData.interactionId='fireflies';const side=Math.random()<.5?-1:1;sprite.position.set(side*randomRange(29,48),randomRange(.4,4),randomRange(-300,20));sprite.scale.setScalar(randomRange(.22,.65));scene.add(sprite);fireflies.push({sprite,baseY:sprite.position.y,baseX:sprite.position.x,phase:Math.random()*Math.PI*2,speed:randomRange(.35,1.1),side})}
}
function createFloatingLeaves(){
  const leafMats=[makeMaterial(0x27372b,.95),makeMaterial(0x39432b,.98),makeMaterial(0x172f2c,.9)];
  for(let i=0;i<30;i++){const leaf=new THREE.Mesh(new THREE.SphereGeometry(1,7,5),leafMats[i%leafMats.length]);leaf.userData.interactionId='leaves';leaf.scale.set(randomRange(.07,.17),.018,randomRange(.12,.28));leaf.position.set(randomRange(-28,28),.07,randomRange(-340,15));leaf.rotation.y=randomRange(0,Math.PI*2);scene.add(leaf);floatingLeaves.push({mesh:leaf,phase:Math.random()*10,speed:randomRange(.06,.24),drift:randomRange(-.09,.09)})}
  const plantMat=makeMaterial(0x1c3328,1);for(let i=0;i<8;i++){const x=(Math.random()<.5?-1:1)*randomRange(27,31),z=randomRange(-300,0);const group=new THREE.Group();group.position.set(x,.02,z);scene.add(group);for(let j=0;j<8;j++){const leaf=new THREE.Mesh(new THREE.ConeGeometry(.1,randomRange(.45,1.0),5),plantMat);leaf.position.set(randomRange(-.4,.4),randomRange(.08,.35),randomRange(-.4,.4));leaf.rotation.z=randomRange(-1.2,1.2);leaf.rotation.x=randomRange(-.8,.8);group.add(leaf)}floatingLeaves.push({mesh:group,phase:Math.random()*10,speed:.025,drift:randomRange(-.015,.015),isPlant:true})}
}
function initScene(){
  try{
    renderer=new THREE.WebGLRenderer({canvas,antialias:window.devicePixelRatio<2,alpha:false,powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.7));renderer.setSize(window.innerWidth,window.innerHeight,false);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
    scene=new THREE.Scene();scene.background=new THREE.Color(0x07111f);scene.fog=new THREE.FogExp2(0x07111f,.0068);
    camera=new THREE.PerspectiveCamera(54,window.innerWidth/window.innerHeight,.1,650);camera.position.set(0,2.4,14);camera.lookAt(0,1,-30);
    createMoonAndSky();createTerrain();createBoat();createDistantLaunch();createFireflies();createFloatingLeaves();
    const waterGeo=new THREE.PlaneGeometry(240,500,180,300);const waterMat=new THREE.ShaderMaterial({vertexShader,fragmentShader,uniforms:{uTime:{value:0},uMoonX:{value:-13},uBoatX:{value:-2},uBoatZ:{value:-50},uLantern:{value:1}},side:THREE.DoubleSide,transparent:false});water=new THREE.Mesh(waterGeo,waterMat);water.userData.interactionId='water';water.rotation.x=-Math.PI/2;water.position.set(0,0,-140);scene.add(water);
    const fill=new THREE.PointLight(0x24445a,.32,50,2);fill.position.set(0,6,-12);scene.add(fill);
    initialized=true;$('loading-screen').classList.add('done');
    $('webgl-fallback').hidden=true;
    animate();
  }catch(err){console.error('Could not initialize the WebGL scene:',err);$('loading-screen').classList.add('done');$('webgl-fallback').hidden=false;}
}
function smooth01(t){t=clamp(t,0,1);return t*t*(3-2*t)}
function keyframe(t,frames){if(t<=frames[0][0])return frames[0][1];for(let i=1;i<frames.length;i++){if(t<=frames[i][0]){const [t0,v0]=frames[i-1], [t1,v1]=frames[i];return lerp(v0,v1,smooth01((t-t0)/(t1-t0)))}}return frames[frames.length-1][1]}
function setCaption(index){
  if(index===lastCaption)return;lastCaption=index;const captions=[
    ['THE RIVER AT REST','Listen closely. The night is never silent.'],
    ['A LIGHT IN THE MIST','Somewhere ahead, a lantern is still awake.'],
    ['THE PASSING BOAT','Wood, water, and a small flame against the dark.'],
    ['ACROSS THE WATER','A distant launch carries its low call through the fog.'],
    ['A VILLAGE STILL AWAKE','A few windows glow softly beyond the wet riverbank.'],
    ['INTO THE DARKNESS','Stay a little longer. The river has more to show you.']
  ];const c=captions[index]||captions[0];$('caption-kicker').textContent=c[0];$('caption-line').textContent=c[1];$('cinema-caption').classList.add('visible');
}
function updateTimeline(now){
  if(!started)return;const raw=(now-startTime)/1000;const cycle=Math.floor(raw/DURATION);currentTime=raw%DURATION;
  if(cycle!==previousCycle){previousCycle=cycle;hornPlayed=false;birdPlayed=false;lastCaption=-1;ambientRippleNextAt=19+randomRange(0,9);$('end-credit').classList.remove('visible');}
  const t=currentTime;
  const camZ=keyframe(t,[[0,14],[12,12],[32,8],[60,3.8],[80,1.4],[100,2.4],[120,-1.8]]);
  const camY=keyframe(t,[[0,2.3],[12,2.2],[32,2.25],[60,2.5],[80,2.25],[100,2.2],[120,2.1]]);
  const boatZ=keyframe(t,[[0,-65],[12,-56],[32,-39],[60,-20],[80,-25],[100,-42],[120,-70]]);
  const boatX=keyframe(t,[[0,-4],[32,-3],[60,-1.4],[80,-.6],[100,.4],[120,1.5]]);
  const camX=Math.sin(t*.035)*.45;camera.position.set(camX+exploreCurrent.x,camY+exploreCurrent.y,camZ);
  const lookZ=keyframe(t,[[0,-38],[32,-30],[60,-20],[80,-25],[100,-32],[120,-42]]);camera.lookAt(exploreCurrent.x*.15,1.15+exploreCurrent.y*.1,lookZ);
  if(boat){boat.position.x=boatX;boat.position.z=boatZ;boat.position.y=-.02+Math.sin(t*1.15)*.085+Math.sin(t*.49)*.035;boat.rotation.z=Math.sin(t*.62)*.025;boat.rotation.x=Math.sin(t*.87)*.018;boat.rotation.y=Math.sin(t*.16)*.025;
    const lanternBoost=now<lanternPulseUntil?1.7:1;lanternLight.intensity=(1.55+Math.sin(t*8.7)*.12+Math.sin(t*13.1)*.06)*lanternBoost;lanternFlame.scale.set(1+Math.sin(t*10)*.12,1+Math.sin(t*7.5)*.18,1);water.material.uniforms.uBoatX.value=boatX;water.material.uniforms.uBoatZ.value=boatZ;water.material.uniforms.uLantern.value=(t<12?0.3:1)*(t>100?clamp((120-t)/20,.1,1):1);
    wakeRings.forEach(({mesh,phase,index})=>{mesh.position.x=boatX;mesh.position.z=boatZ+3.4+index*.75;mesh.position.y=.045;const pulse=1+((t*.35+phase)%1)*.5;mesh.scale.set((1.1+index*.16)*pulse,1,(.75+index*.1)*pulse);mesh.material.opacity=(.14-index*.025)*(0.6+0.4*Math.sin(t*1.2+phase))*(t>100?clamp((120-t)/20,.1,1):1)});
  }
  if(distantLaunch){distantLaunch.position.x=11+Math.sin(t*.035)*.65;distantLaunch.position.z=-142+Math.sin(t*.022)*1.2;distantLaunch.rotation.y=Math.sin(t*.04)*.025;}
  launchLights.forEach(({light,base,phase})=>{light.intensity=base*(.9+.1*Math.sin(t*.7+phase))*(now<launchPulseUntil?2.2:1)});
  if(moonHalo&&now<moonPulseUntil)moonHalo.material.opacity=.95;
  else if(moonHalo)moonHalo.material.opacity=.8;
  water.material.uniforms.uTime.value=clock.elapsedTime;
  cloudGroups.forEach(({group,baseX,speed,phase})=>{group.position.x=baseX+Math.sin(t*speed*.2+phase)*3+(t*speed*.035);group.position.y+=Math.sin(t*.13+phase)*.0007});
  fireflies.forEach(({sprite,baseY,baseX,phase,speed,side})=>{sprite.position.y=baseY+Math.sin(t*speed+phase)*.32;sprite.position.x=baseX+Math.sin(t*.12+phase)*.6;const pulse=now<fireflyPulseUntil?.32:0;sprite.material.opacity=clamp((.12+.26*(.5+.5*Math.sin(t*speed*2.4+phase))+(pulse*(.5+.5*Math.sin(t*4+phase))))*(t<7?.5:1),.05,.75)});
  floatingLeaves.forEach(({mesh,phase,speed,drift,isPlant})=>{if(!isPlant){mesh.position.z+=speed*.018;if(mesh.position.z>20)mesh.position.z=-360;mesh.position.x+=drift*.008;mesh.position.y=.07+Math.sin(t*.9+phase)*.012;mesh.rotation.y+=.0015}else{mesh.rotation.y=Math.sin(t*.25+phase)*.04}});
  trees.forEach(({group,phase})=>{group.rotation.z=Math.sin(t*.23+phase)*.006});reeds.forEach(g=>{g.rotation.z=Math.sin(t*.3+g.userData.phase)*.008});
  villageLights.forEach(({light,phase,base})=>{light.intensity=base*(.92+.08*Math.sin(t*.9+phase))*(now<villagePulseUntil?1.8:1)});
  const phaseIndex=t<12?0:t<32?1:t<60?2:t<80?3:t<100?4:5;setCaption(phaseIndex);
  $('progress-fill').style.width=`${(t/DURATION)*100}%`;
  $('end-credit').classList.toggle('visible',t>=108&&t<118);
  if(t>=62&&t<63&&!hornPlayed){hornPlayed=true;if(soundEnabled)playHorn()}
  if(t>=83&&t<84&&!birdPlayed){birdPlayed=true;if(soundEnabled)playBirdCall()}
  if(t>=ambientRippleNextAt){spawnRipple(new THREE.Vector3(randomRange(-19,19),0,randomRange(-78,-18)));ambientRippleNextAt=t+randomRange(19,34)}
  if(!cinematicMode&&exploreModeStartTime&&now-exploreModeStartTime>=60000&&!stillnessAwarded){stillnessAwarded=true;discoverSecret('stillness')}
  updateRippleEffects();
}
function animate(){if(!initialized)return;requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05);const now=performance.now();if(!started){water.material.uniforms.uTime.value=clock.elapsedTime;camera.position.x=Math.sin(clock.elapsedTime*.035)*.08;camera.lookAt(0,1,-30)}else{if(cinematicMode)updateTimeline(now);else{camera.position.x+=(exploreTarget.x-exploreCurrent.x)*Math.min(1,dt*1.8);camera.position.y+=(exploreTarget.y-exploreCurrent.y)*Math.min(1,dt*1.8);updateTimeline(now);camera.position.x+=Math.sin(clock.elapsedTime*.08)*.04;}}renderer.render(scene,camera);}
function resize(){if(!renderer||!camera)return;camera.aspect=window.innerWidth/window.innerHeight;camera.fov=window.innerWidth<600?58:54;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,window.innerWidth<700?1.25:1.7));renderer.setSize(window.innerWidth,window.innerHeight,false)}

// Naturalistic CC0 audio beds and one-shot effects are streamed from SFXMint.
// The site remains static; audio begins only after a user gesture.
function applySoundVolumes(){
  const levels={river:soundLevels.river,insects:soundLevels.insects,wildlife:soundLevels.wildlife,horn:soundLevels.effects,creak:soundLevels.effects,plop:soundLevels.effects};
  Object.entries(soundElements).forEach(([key,el])=>{if(el)el.volume=soundEnabled?(levels[key]??0):0;});
}
async function startAudio(){
  applySoundVolumes();
  const beds=[soundElements.river,soundElements.insects];
  let failures=0;
  for(const el of beds){if(!el)continue;try{if(el.paused)await el.play();}catch(err){failures++;console.warn('Ambient audio could not load:',el.src,err);}}
  if(!ambienceStarted){ambienceStarted=true;scheduleAmbientSounds();}
  $('audio-status').textContent=failures?'Some ambience files could not load. Check your internet connection.':'Atmosphere active · CC0 sound effects · adjust the mix above.';
}
function setSound(on){
  soundEnabled=on;$('sound-button').setAttribute('aria-pressed',String(on));$('sound-button').title=on?'Turn sound off':'Turn sound on';$('sound-label').textContent=on?'SOUND ON':'SOUND OFF';$('sound-icon').textContent=on?'◖))':'◖×';applySoundVolumes();
  if(on&&started)startAudio();else if(!on){[soundElements.river,soundElements.insects].forEach(el=>{if(el)el.pause()});$('audio-status').textContent='Sound is muted. Turn it back on whenever you like.';}
}
function setSoundLevel(key,value){soundLevels[key]=clamp(Number(value)/100,0,1);const output=$(key+'-volume-value');if(output)output.value=Math.round(soundLevels[key]*100)+'%';applySoundVolumes();}
function playEffect(name){const el=soundElements[name];if(!el||!soundEnabled)return;try{el.pause();el.currentTime=0;el.volume=soundLevels[name]??soundLevels.effects;el.play().catch(err=>console.warn('Sound effect unavailable:',el.src,err));}catch(err){console.warn('Sound effect could not play:',err)}}
function playHorn(){playEffect('horn')}
function playBirdCall(){playEffect('wildlife')}
function playCreak(){playEffect('creak')}
function playDrop(){playEffect('plop')}
function scheduleAmbientSounds(){
  if(!started)return;const delay=randomRange(15000,28000)*1;
  const id=setTimeout(()=>{if(!started)return;if(soundEnabled&&!cinematicMode){const r=Math.random();if(r<.22)playCreak();else if(r<.37)playBirdCall();}scheduleAmbientSounds()},delay);audioTimerIds.push(id);
}
function showDiscoveryToast(kicker,title,copy){
  const toast=$('discovery-toast');$('toast-kicker').textContent=kicker;$('toast-title').textContent=title;$('toast-copy').textContent=copy;toast.hidden=false;toast.classList.remove('show');requestAnimationFrame(()=>toast.classList.add('show'));clearTimeout(toastTimer);toastTimer=setTimeout(()=>{toast.classList.remove('show');setTimeout(()=>toast.hidden=true,450)},4200);
}
function renderJournal(){
  const list=$('journal-list');if(!list)return;list.innerHTML='';
  riverSecrets.forEach((secret,index)=>{const found=discovered.has(secret.id);const item=document.createElement('article');item.className='journal-entry'+(found?' found':'');item.innerHTML=`<span class="journal-entry-index">${String(index+1).padStart(2,'0')}</span><div class="journal-entry-copy"><strong>${found?secret.title:'Undiscovered detail'}</strong><p>${found?secret.copy:secret.clue}</p></div><span class="journal-entry-state">${found?'FOUND':'HIDDEN'}</span>`;list.appendChild(item)});
  const count=riverSecrets.filter(s=>discovered.has(s.id)).length;const percent=Math.round(count/riverSecrets.length*100);$('journal-progress-label').textContent=`${count} of ${riverSecrets.length} discovered`;$('journal-percent').textContent=percent+'%';$('journal-progress-fill').style.width=percent+'%';$('journal-label').textContent=`JOURNAL ${count}/${riverSecrets.length}`;
}
function discoverSecret(id){
  const secret=riverSecrets.find(s=>s.id===id);if(!secret||discovered.has(id))return false;discovered.add(id);try{localStorage.setItem('nishith-nodi-discoveries',JSON.stringify([...discovered]));}catch{}renderJournal();showDiscoveryToast('RIVER JOURNAL UPDATED',secret.title,secret.copy);return true;
}
function openJournal(){renderJournal();$('journal-panel').hidden=false;$('journal-button').setAttribute('aria-expanded','true');$('journal-panel').classList.add('show')}
function closeJournal(){const panel=$('journal-panel');panel.classList.remove('show');$('journal-button').setAttribute('aria-expanded','false');setTimeout(()=>panel.hidden=true,250)}
function openSoundscape(){$('soundscape-panel').hidden=false;$('soundscape-button').setAttribute('aria-expanded','true');$('soundscape-panel').classList.add('show')}
function closeSoundscape(){const panel=$('soundscape-panel');panel.classList.remove('show');$('soundscape-button').setAttribute('aria-expanded','false');setTimeout(()=>panel.hidden=true,250)}
function getInteractionId(object){let node=object;while(node&&node!==scene){if(node.userData&&node.userData.interactionId)return node.userData.interactionId;node=node.parent;}return null;}
function spawnRipple(point){
  if(!point)return;const group=new THREE.Group();group.position.set(point.x,.055,point.z);scene.add(group);
  for(let i=0;i<3;i++){const mat=new THREE.MeshBasicMaterial({color:i===0?0xb4c7d3:0x7898a9,transparent:true,opacity:.28-i*.055,depthWrite:false,side:THREE.DoubleSide});const ring=new THREE.Mesh(new THREE.TorusGeometry(.22+i*.12,.012,4,36),mat);ring.rotation.x=Math.PI/2;ring.position.y=i*.003;group.add(ring);}
  rippleEffects.push({group,start:clock.elapsedTime,duration:2.5});
}
function updateRippleEffects(){
  const now=clock.elapsedTime;for(let i=rippleEffects.length-1;i>=0;i--){const ripple=rippleEffects[i],age=(now-ripple.start)/ripple.duration;if(age>=1){scene.remove(ripple.group);ripple.group.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose()});rippleEffects.splice(i,1);continue;}ripple.group.children.forEach((ring,index)=>{const scale=.55+age*2.8+index*.28;ring.scale.set(scale,scale,scale);ring.material.opacity=(.26-index*.055)*(1-age);});}
}
function interactWithScene(id,point){
  if(id==='water'||!id){if(point)spawnRipple(point);playDrop();const wasNew=discoverSecret('water');if(!wasNew)showDiscoveryToast('THE RIVER ANSWERS','A ripple in the dark','Tap another part of the water and watch the rings fade.');return;}
  const messages={lantern:'The flame answers with a warmer glow.',moon:'The silver path shifts across the moving water.',fireflies:'A few small lights stir among the reeds.',village:'Warm windows appear to hold stories of their own.',ghat:'The old landing waits beside the dark water.',launch:'The distant launch moves beyond the fog.',bamboo:'The bamboo leaves stir in a small night breeze.',leaves:'A leaf turns slowly as the current carries it.'};
  if(id==='lantern'){lanternPulseUntil=performance.now()+3500;playCreak();}
  if(id==='moon'){moonPulseUntil=performance.now()+3500;}
  if(id==='fireflies'){fireflyPulseUntil=performance.now()+5000;}
  if(id==='village'){villagePulseUntil=performance.now()+3000;}
  if(id==='launch'){launchPulseUntil=performance.now()+3500;playHorn();}
  if(id==='ghat'&&point)spawnRipple(new THREE.Vector3(point.x,0,point.z));
  const secret=riverSecrets.find(s=>s.id===id);const wasNew=discoverSecret(id);if(!wasNew&&secret)showDiscoveryToast('FIELD NOTE',secret.title,messages[id]||secret.copy);
}
function onCanvasPointerDown(event){
  if(!started||cinematicMode||$('journal-panel').classList.contains('show')||$('soundscape-panel').classList.contains('show'))return;
  const rect=canvas.getBoundingClientRect();pointer.x=((event.clientX-rect.left)/rect.width)*2-1;pointer.y=-((event.clientY-rect.top)/rect.height)*2+1;raycaster.setFromCamera(pointer,camera);
  const hits=raycaster.intersectObjects(scene.children,true);let chosen=null,point=null;
  for(const hit of hits){const id=getInteractionId(hit.object);if(id){chosen=id;point=hit.point;break;}}
  if(!chosen)return;
  interactWithScene(chosen,point);
}
function startExperience(replay=false){if(!initialized)return;started=true;startTime=performance.now();currentTime=0;previousCycle=-1;hornPlayed=false;birdPlayed=false;lastCaption=-1;cinematicMode=true;exploreModeStartTime=0;stillnessAwarded=false;exploreTarget={x:0,y:0};exploreCurrent={x:0,y:0};$('intro-screen').classList.add('leaving');$('control-dock').hidden=false;$('progress-wrap').hidden=false;$('corner-mark').hidden=false;$('topbar').style.opacity='1';$('mode-button').classList.add('active');$('mode-button').setAttribute('aria-pressed','false');$('mode-button').querySelector('.dock-label').textContent='CINEMATIC';$('cinema-caption').classList.add('visible');$('end-credit').classList.remove('visible');$('interaction-hint').hidden=true;startAudio();if(replay){setCaption(0)}}
function setExploreMode(){cinematicMode=!cinematicMode;$('mode-button').classList.toggle('active',cinematicMode);$('mode-button').setAttribute('aria-pressed',String(!cinematicMode));$('mode-button').querySelector('.dock-label').textContent=cinematicMode?'CINEMATIC':'EXPLORE';$('mode-button').title=cinematicMode?'Switch to explore mode':'Switch to cinematic mode';if(!cinematicMode){exploreTarget={x:0,y:0};exploreCurrent={x:0,y:0};exploreModeStartTime=performance.now();$('interaction-hint').hidden=false;}else{$('interaction-hint').hidden=true;exploreModeStartTime=0;}}
function setInterfaceVisible(show){interfaceVisible=show;const ids=['topbar','control-dock','progress-wrap','corner-mark','cinema-caption','interaction-hint'];ids.forEach(id=>{$(id).style.opacity=show?'1':'0';$(id).style.pointerEvents=show?'auto':'none'});$('restore-ui-button').hidden=show;$('hide-ui-button').title=show?'Hide interface':'Show interface';}
function openCredits(){const panel=$('credits-panel'),backdrop=$('credits-backdrop');backdrop.hidden=false;panel.hidden=false;requestAnimationFrame(()=>{backdrop.classList.add('show');panel.classList.add('show')});$('credits-close').focus();}
function closeCredits(){const panel=$('credits-panel'),backdrop=$('credits-backdrop');panel.classList.remove('show');backdrop.classList.remove('show');setTimeout(()=>{panel.hidden=true;backdrop.hidden=true},320);$('credits-button').focus()}
async function toggleFullscreen(){try{if(!document.fullscreenElement){await $('experience').requestFullscreen?.();$('fullscreen-button').title='Exit fullscreen'}else{await document.exitFullscreen();$('fullscreen-button').title='Enter fullscreen'}}catch(e){console.warn('Fullscreen is not available:',e)}}
function onPointerMove(e){if(!started||cinematicMode)return;const nx=(e.clientX/window.innerWidth-.5)*2,ny=(e.clientY/window.innerHeight-.5)*2;exploreTarget.x=clamp(nx,-1,1)*1.6;exploreTarget.y=clamp(-ny,-1,1)*.65}
function onTouchMove(e){if(!started||cinematicMode||!e.touches[0])return;const t=e.touches[0];exploreTarget.x=clamp((t.clientX/window.innerWidth-.5)*2,-1,1)*1.3;exploreTarget.y=clamp((.5-t.clientY/window.innerHeight)*2,-1,1)*.45}

$('enter-button').addEventListener('click',()=>startExperience());$('mode-button').addEventListener('click',setExploreMode);$('sound-button').addEventListener('click',()=>setSound(!soundEnabled));$('soundscape-button').addEventListener('click',()=>{if($('soundscape-panel').hidden)openSoundscape();else closeSoundscape()});$('soundscape-close').addEventListener('click',closeSoundscape);$('journal-button').addEventListener('click',()=>{if($('journal-panel').hidden)openJournal();else closeJournal()});$('journal-close').addEventListener('click',closeJournal);$('replay-button').addEventListener('click',()=>startExperience(true));$('fullscreen-button').addEventListener('click',toggleFullscreen);$('credits-button').addEventListener('click',openCredits);$('credits-close').addEventListener('click',closeCredits);$('credits-backdrop').addEventListener('click',closeCredits);$('hide-ui-button').addEventListener('click',()=>setInterfaceVisible(false));$('restore-ui-button').addEventListener('click',()=>setInterfaceVisible(true));canvas.addEventListener('pointerdown',onCanvasPointerDown);window.addEventListener('resize',resize);window.addEventListener('pointermove',onPointerMove,{passive:true});window.addEventListener('touchmove',onTouchMove,{passive:true});
[['river-volume','river'],['insects-volume','insects'],['wildlife-volume','wildlife'],['effects-volume','effects']].forEach(([input,key])=>$(input).addEventListener('input',e=>setSoundLevel(key,e.target.value)));
document.addEventListener('fullscreenchange',()=>{$('fullscreen-button').title=document.fullscreenElement?'Exit fullscreen':'Enter fullscreen'});document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('credits-panel').hidden)closeCredits();if(!$('journal-panel').hidden)closeJournal();if(!$('soundscape-panel').hidden)closeSoundscape();}if(e.key.toLowerCase()==='m'&&started)setSound(!soundEnabled);if(e.key.toLowerCase()==='r'&&started)startExperience(true);if(e.key.toLowerCase()==='e'&&started)setExploreMode();if(e.key.toLowerCase()==='j'&&started){if($('journal-panel').hidden)openJournal();else closeJournal();}});
renderJournal();applySoundVolumes();

initScene();
