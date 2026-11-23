import * as THREE from 'three';
import { applyDamage, calculateShotDamage, getMissionOutcome, transferReloadAmmo } from './combat-rules.mjs';
import { calculateWeaponPose } from './weapon-feel.mjs';

const canvas = document.querySelector('#game-canvas');
const hud = document.querySelector('#hud');
const menuScreen = document.querySelector('#menu-screen');
const endScreen = document.querySelector('#end-screen');
const touchControls = document.querySelector('#touch-controls');
const pauseHint = document.querySelector('#pause-hint');
const toast = document.querySelector('#toast');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x91a0a8);
scene.fog = new THREE.FogExp2(0x89969a, 0.0125);

const camera = new THREE.PerspectiveCamera(76, window.innerWidth / window.innerHeight, 0.08, 150);
camera.rotation.order = 'YXZ';
camera.position.set(0, 1.7, 23);
scene.add(camera);

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const center = new THREE.Vector2(0, 0);
const worldOccluders = [];
const solidBoxes = [];
const coverPoints = [];
const enemies = [];
const particles = [];
const tracers = [];

const state = {
  mode: 'menu', health: 100, kills: 0, totalEnemies: 8, startTime: 0, elapsed: 0,
  yaw: 0, pitch: 0, isAiming: false, isSprinting: false, isGrounded: true,
  verticalVelocity: 0, bobTime: 0, recoil: 0, damageFlash: 0, hitMarker: 0,
  toastTimer: 0, reloadTimer: 0, reloadDuration: 1.45, fireHeld: false,
  lastShot: 0, lastEnemyShot: 0, stamina: 100,
};

const keys = Object.create(null);
const touchMove = { forward: false, back: false, left: false, right: false };
const touchActions = { shoot: false, ads: false };
let audioContext = null;
let activeWeaponIndex = 1;
let weaponRoot = null;
let muzzleLight = null;
let muzzleSprite = null;
let muzzleTimer = 0;
let toastTimeout = null;

const weaponDefs = [
  { name: 'COMPACT PISTOL', short: 'PISTOL', magazineSize: 12, reserveStart: 48, damage: 42, fireInterval: 0.29, spread: 0.008, range: 65, reload: 1.15, recoil: 0.045, color: 0x343a3d, barrel: 0.34, width: 0.14, height: 0.14 },
  { name: 'ASSAULT RIFLE', short: 'RIFLE', magazineSize: 30, reserveStart: 90, damage: 34, fireInterval: 0.115, spread: 0.014, range: 90, reload: 1.55, recoil: 0.028, color: 0x343d3d, barrel: 0.55, width: 0.18, height: 0.17 },
  { name: 'MARKSMAN RIFLE', short: 'MARKSMAN', magazineSize: 5, reserveStart: 25, damage: 95, fireInterval: 0.78, spread: 0.002, range: 120, reload: 1.9, recoil: 0.09, color: 0x424344, barrel: 0.82, width: 0.2, height: 0.18 },
];
const weaponStates = weaponDefs.map((w) => ({ ammo: w.magazineSize, reserve: w.reserveStart }));

const materials = {
  concrete: new THREE.MeshStandardMaterial({ color: 0x777b78, roughness: 0.94 }),
  darkConcrete: new THREE.MeshStandardMaterial({ color: 0x3f494a, roughness: 0.92 }),
  asphalt: new THREE.MeshStandardMaterial({ color: 0x333a3b, roughness: 1 }),
  sandbag: new THREE.MeshStandardMaterial({ color: 0x77715e, roughness: 1 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x4b5658, metalness: 0.72, roughness: 0.52 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x6f8b8f, roughness: 0.24, metalness: 0.25, emissive: 0x17272b, emissiveIntensity: 0.3 }),
  amber: new THREE.MeshStandardMaterial({ color: 0xd3a04e, emissive: 0x5b3510, emissiveIntensity: 0.55 }),
};

function addSolid(mesh, x, z, width, depth, height, y = height / 2) {
  mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh);
  worldOccluders.push(mesh);
  solidBoxes.push({ minX: x - width / 2, maxX: x + width / 2, minZ: z - depth / 2, maxZ: z + depth / 2, minY: 0, maxY: height });
  return mesh;
}
function makeBox(width, height, depth, material, x, y, z, parent = scene) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function addWindowBand(x, y, z, width, height, depth, count, material = materials.glass) {
  const gap = 0.45; const each = (width - gap * (count + 1)) / count;
  for (let i = 0; i < count; i++) makeBox(each, height, depth, material, x - width / 2 + gap + each / 2 + i * (each + gap), y, z);
}

function buildEnvironment() {
  scene.add(new THREE.HemisphereLight(0xdce5e5, 0x42413a, 1.45));
  const sun = new THREE.DirectionalLight(0xffe2b7, 2.4);
  sun.position.set(-22, 35, 18); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -42; sun.shadow.camera.right = 42; sun.shadow.camera.top = 42; sun.shadow.camera.bottom = -42; sun.shadow.bias = -0.00025; scene.add(sun);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), materials.asphalt);
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.04; ground.receiveShadow = true; scene.add(ground);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(11, 78), new THREE.MeshStandardMaterial({ color: 0x414849, roughness: 1 }));
  road.rotation.x = -Math.PI / 2; road.position.set(0, -0.025, 0); road.receiveShadow = true; scene.add(road);
  const laneMat = new THREE.MeshBasicMaterial({ color: 0xb8a77d, transparent: true, opacity: 0.3 });
  for (let z = -31; z < 30; z += 8) { const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 3.5), laneMat); dash.rotation.x = -Math.PI / 2; dash.position.set(0, 0.005, z); scene.add(dash); }
  const buildings = [
    { x: -24, z: -22, w: 15, d: 17, h: 13, c: 0x646a68 }, { x: 24, z: -23, w: 15, d: 16, h: 15, c: 0x5b6262 },
    { x: -24, z: 21, w: 15, d: 17, h: 11, c: 0x74736b }, { x: 24, z: 21, w: 15, d: 17, h: 14, c: 0x626966 },
  ];
  for (const b of buildings) {
    const shell = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), new THREE.MeshStandardMaterial({ color: b.c, roughness: 0.95 }));
    addSolid(shell, b.x, b.z, b.w, b.d, b.h, b.h / 2);
    const frontZ = b.z + Math.sign(-b.z) * (b.d / 2 + 0.035);
    addWindowBand(b.x, b.h * 0.67, frontZ, b.w * 0.72, 1.1, 0.08, 4); addWindowBand(b.x, b.h * 0.34, frontZ, b.w * 0.72, 1.1, 0.08, 4);
    for (let i = 0; i < 3; i++) makeBox(0.12, b.h * 0.92, 0.12, materials.darkConcrete, b.x - b.w * 0.42 + i * b.w * 0.42, b.h * 0.46, frontZ + 0.08);
  }
  const coverData = [[-5.8, 10.5, 4.8, 1.0, 1.25], [5.5, 6.0, 4.0, 1.0, 1.15], [-10.5, -4.5, 3.2, 1.0, 1.3], [10.2, -9.0, 3.8, 1.0, 1.2], [-2.5, -16.0, 4.5, 1.1, 1.35], [8.2, 17.2, 3.2, 1.0, 1.15], [-13.5, 16.0, 2.4, 2.2, 1.6], [14.2, 1.0, 2.5, 2.2, 1.7]];
  for (const [x, z, w, d, h] of coverData) {
    const block = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), Math.random() > 0.5 ? materials.sandbag : materials.darkConcrete);
    addSolid(block, x, z, w, d, h, h / 2); coverPoints.push(new THREE.Vector3(x, 0, z));
    if (w > d) for (let i = 0; i < 3; i++) makeBox(0.05, 0.06, d + 0.04, materials.amber, x - w / 2 + 0.6 + i * (w - 1.2) / 2, h * 0.55, z);
  }
  const container = new THREE.Mesh(new THREE.BoxGeometry(5.5, 2.7, 2.6), new THREE.MeshStandardMaterial({ color: 0x596a68, metalness: 0.55, roughness: 0.72 }));
  addSolid(container, 15.8, -18.2, 5.5, 2.6, 2.7, 1.35);
  for (let i = 0; i < 9; i++) makeBox(0.055, 2.4, 0.05, materials.metal, 13.4 + i * 0.56, 1.35, -16.86);
  const wreck = new THREE.Group();
  const body = makeBox(3.7, 0.85, 1.75, new THREE.MeshStandardMaterial({ color: 0x55534a, metalness: 0.48, roughness: 0.85 }), 0, 0.75, 0, wreck); body.rotation.y = -0.22;
  for (const x of [-1.15, 1.15]) for (const z of [-0.82, 0.82]) { const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.2, 12), new THREE.MeshStandardMaterial({ color: 0x202526, roughness: 1 })); wheel.rotation.z = Math.PI / 2; wheel.position.set(x, 0.4, z); wreck.add(wheel); }
  wreck.position.set(-15.8, 0, 2.2); wreck.rotation.y = 0.25; scene.add(wreck);
  solidBoxes.push({ minX: -17.8, maxX: -13.8, minZ: 1.1, maxZ: 3.3, minY: 0, maxY: 1.7 }); worldOccluders.push(body);
  for (const [x, z] of [[-7, -25], [7, -25], [-7, 25], [7, 25]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 6.5, 8), materials.metal); pole.position.set(x, 3.25, z); pole.castShadow = true; scene.add(pole);
    makeBox(1.4, 0.08, 0.08, materials.metal, x + (x < 0 ? 0.65 : -0.65), 6.35, z);
    const lamp = new THREE.PointLight(0xffc77d, 1.2, 13, 2); lamp.position.set(x + (x < 0 ? 1.2 : -1.2), 6.15, z); scene.add(lamp);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffd49a })); bulb.position.copy(lamp.position); scene.add(bulb);
  }
  const rubbleMat = new THREE.MeshStandardMaterial({ color: 0x77746b, roughness: 1 });
  for (let i = 0; i < 55; i++) { const x = (Math.random() - 0.5) * 48; const z = (Math.random() - 0.5) * 54; if (Math.abs(x) < 7 && Math.abs(z) < 25) continue; const size = 0.12 + Math.random() * 0.32; const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(size, 0), rubbleMat); rock.position.set(x, size * 0.55, z); rock.rotation.set(Math.random(), Math.random(), Math.random()); rock.castShadow = true; scene.add(rock); }
  for (const [x, z, color] of [[-19, -2, 0xff9a55], [19, 13, 0x86a5b0], [0, -27, 0xffc27a]]) { const light = new THREE.PointLight(color, 0.65, 18, 2); light.position.set(x, 2.8, z); scene.add(light); }
}
function createWeaponModel(index) {
  if (weaponRoot) camera.remove(weaponRoot);
  weaponRoot = new THREE.Group(); const def = weaponDefs[index];
  const metal = new THREE.MeshStandardMaterial({ color: def.color, metalness: 0.78, roughness: 0.36 });
  const polymer = new THREE.MeshStandardMaterial({ color: 0x20282a, metalness: 0.18, roughness: 0.8 });
  const accent = new THREE.MeshStandardMaterial({ color: 0x9b7949, metalness: 0.55, roughness: 0.5 });
  makeBox(def.width, def.height, def.barrel * 0.95, metal, 0, 0, 0, weaponRoot);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, def.barrel, 10), metal); barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.01, -def.barrel * 0.72); weaponRoot.add(barrel);
  const grip = makeBox(def.width * 0.72, def.height * 1.35, def.width * 0.72, polymer, 0.015, -def.height * 0.88, def.barrel * 0.1, weaponRoot); grip.rotation.x = -0.18;
  if (index !== 0) { const mag = makeBox(def.width * 0.72, def.height * 1.15, def.width * 0.8, polymer, 0, -def.height * 1.35, -0.015, weaponRoot); mag.rotation.x = -0.08; makeBox(def.width * 1.2, 0.035, def.barrel * 0.35, accent, 0, def.height * 0.68, -0.04, weaponRoot); }
  if (index === 2) { const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.28, 12), polymer); scope.rotation.x = Math.PI / 2; scope.position.set(0, def.height * 0.95, -0.12); weaponRoot.add(scope); makeBox(def.width * 0.9, 0.08, 0.28, polymer, 0, -0.02, def.barrel * 0.62, weaponRoot); }
  else if (index === 1) makeBox(def.width * 0.72, 0.09, 0.28, polymer, 0, def.height * 0.85, -0.04, weaponRoot);
  weaponRoot.position.set(0.38, -0.31, -0.64); weaponRoot.rotation.set(-0.04, -0.06, 0); camera.add(weaponRoot);
  muzzleLight = new THREE.PointLight(0xffb75e, 0, 4, 2); muzzleLight.position.set(0, 0, -def.barrel * 1.2); weaponRoot.add(muzzleLight);
  muzzleSprite = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffd18b, transparent: true, opacity: 0 })); muzzleSprite.position.copy(muzzleLight.position); weaponRoot.add(muzzleSprite);
}

function createEnemy(x, z, index) {
  const root = new THREE.Group(); root.position.set(x, 0, z); root.rotation.y = Math.atan2(camera.position.x - x, camera.position.z - z);
  const armor = new THREE.MeshStandardMaterial({ color: index % 2 ? 0x5a4540 : 0x4e4b47, roughness: 0.82, metalness: 0.16 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x202629, roughness: 0.85 });
  const skin = new THREE.MeshStandardMaterial({ color: 0x9a8976, roughness: 0.9 });
  const accent = new THREE.MeshStandardMaterial({ color: 0x9c4037, emissive: 0x2d0806, roughness: 0.65 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.82, 0.34), armor); torso.position.y = 1.12; torso.castShadow = true; root.add(torso);
  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.48, 0.38), dark); vest.position.set(0, 1.17, -0.015); vest.castShadow = true; root.add(vest);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), skin); head.position.y = 1.72; head.castShadow = true; root.add(head);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.245, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.56), dark); helmet.position.y = 1.78; root.add(helmet);
  const visor = makeBox(0.34, 0.08, 0.045, accent, 0, 1.73, -0.19, root);
  const armPivots = [];
  for (const side of [-1, 1]) { const pivot = new THREE.Group(); pivot.position.set(side * 0.39, 1.38, -0.01); const arm = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.58, 0.2), armor); arm.position.y = -0.27; arm.castShadow = true; pivot.add(arm); const glove = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.22), dark); glove.position.set(0, -0.55, -0.05); pivot.add(glove); root.add(pivot); armPivots.push(pivot); }
  const legs = [];
  for (const side of [-1, 1]) { const leg = new THREE.Group(); leg.position.set(side * 0.17, 0.76, 0); const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.68, 0.25), dark); thigh.position.y = -0.28; thigh.castShadow = true; leg.add(thigh); root.add(leg); legs.push(leg); }
  const gun = makeBox(0.12, 0.13, 0.72, dark, 0.12, 1.16, -0.48, root);
  gun.rotation.x = 0.08;
  const gunBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.35, 8), materials.metal); gunBarrel.rotation.x = Math.PI / 2; gunBarrel.position.set(0.12, 1.17, -0.98); root.add(gunBarrel);
  scene.add(root);
  const healthBar = new THREE.Group();
  const barBg = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.07), new THREE.MeshBasicMaterial({ color: 0x171c1e, transparent: true, opacity: 0.8, depthTest: false }));
  const barFill = new THREE.Mesh(new THREE.PlaneGeometry(0.68, 0.035), new THREE.MeshBasicMaterial({ color: 0xd65b4c, depthTest: false }));
  barFill.position.z = 0.01; healthBar.add(barBg, barFill); healthBar.position.y = 2.2; root.add(healthBar);
  const enemy = { root, torso, head, armPivots, legs, healthBar, barFill, health: 100, maxHealth: 100, alive: true, index,
    speed: 1.05 + Math.random() * 0.35, fireCooldown: 0.8 + Math.random() * 1.1, strafeDir: Math.random() > 0.5 ? 1 : -1,
    strafeTimer: 1.4 + Math.random() * 2, phase: Math.random() * Math.PI * 2, state: 'advance', targetCover: null, hurtFlash: 0 };
  for (const part of [torso, vest, head, helmet, visor, gun, gunBarrel, ...armPivots.flatMap((p) => p.children), ...legs.flatMap((p) => p.children)]) part.userData.enemy = enemy;
  enemyMeshes.push(torso, vest, head, helmet, visor, gun, gunBarrel, ...armPivots.flatMap((p) => p.children), ...legs.flatMap((p) => p.children));
  enemies.push(enemy); return enemy;
}
const enemyMeshes = [];

function spawnEnemies() {
  const spawns = [[-13, -17], [12, -15], [-15, -3], [15, 8], [-8, 17], [7, 15], [-2, -23], [2, -10]];
  spawns.slice(0, state.totalEnemies).forEach(([x, z], i) => createEnemy(x, z, i)); updateEnemyCount();
}
function updateEnemyCount() {
  const remaining = enemies.filter((e) => e.alive).length; const el = document.querySelector('#enemy-count'); if (el) el.textContent = String(remaining).padStart(2, '0');
}
function showToast(message, duration = 1500) {
  toast.textContent = message; toast.classList.remove('hidden'); state.toastTimer = duration / 1000;
  if (toastTimeout) clearTimeout(toastTimeout); toastTimeout = setTimeout(() => toast.classList.add('hidden'), duration);
}
function initAudio() {
  if (!audioContext) { const AudioCtx = window.AudioContext || window.webkitAudioContext; if (AudioCtx) audioContext = new AudioCtx(); }
  if (audioContext?.state === 'suspended') audioContext.resume();
}
function playTone(frequency, duration, type = 'square', gainValue = 0.035, slide = 0) {
  if (!audioContext) return; const osc = audioContext.createOscillator(); const gain = audioContext.createGain(); osc.type = type;
  osc.frequency.setValueAtTime(frequency, audioContext.currentTime);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, frequency + slide), audioContext.currentTime + duration);
  gain.gain.setValueAtTime(gainValue, audioContext.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
  osc.connect(gain); gain.connect(audioContext.destination); osc.start(); osc.stop(audioContext.currentTime + duration);
}
function playShotSound(index) { const base = [180, 115, 82][index]; playTone(base, 0.095, 'sawtooth', index === 2 ? 0.055 : 0.035, -base * 0.55); playTone(base * 2.7, 0.035, 'square', 0.012, -base * 1.5); }
function spawnImpact(point, color = 0xe0b56e, count = 5) {
  for (let i = 0; i < count; i++) { const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.025 + Math.random() * 0.025, 5, 5), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 })); mesh.position.copy(point); const velocity = new THREE.Vector3((Math.random() - 0.5) * 3.2, Math.random() * 2.4, (Math.random() - 0.5) * 3.2); scene.add(mesh); particles.push({ mesh, velocity, life: 0.22 + Math.random() * 0.2, maxLife: 0.42 }); }
}
function spawnTracer(start, end, color = 0xffc16d) { const geometry = new THREE.BufferGeometry().setFromPoints([start.clone(), end.clone()]); const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8 }); const line = new THREE.Line(geometry, material); scene.add(line); tracers.push({ line, life: 0.11 }); }

function setWeapon(index, silent = false) {
  if (state.reloadTimer > 0) { if (!silent) showToast('换弹期间不能切换武器', 850); return; }
  activeWeaponIndex = THREE.MathUtils.clamp(index, 0, weaponDefs.length - 1); createWeaponModel(activeWeaponIndex);
  const def = weaponDefs[activeWeaponIndex]; document.querySelector('#weapon-name').textContent = def.name;
  document.querySelector('#weapon-slot').textContent = String(activeWeaponIndex + 1).padStart(2, '0'); updateAmmoHud();
  if (!silent) showToast(`切换武器 · ${def.short}`, 900);
}
function updateAmmoHud() { const ammo = weaponStates[activeWeaponIndex]; document.querySelector('#ammo-current').textContent = String(ammo.ammo).padStart(2, '0'); document.querySelector('#ammo-reserve').textContent = String(ammo.reserve).padStart(2, '0'); }
function startReload() {
  if (state.mode !== 'playing' || state.reloadTimer > 0) return; const def = weaponDefs[activeWeaponIndex]; const ammo = weaponStates[activeWeaponIndex];
  if (ammo.ammo >= def.magazineSize || ammo.reserve <= 0) { showToast(ammo.reserve <= 0 ? '备用弹药耗尽' : '弹匣已满', 900); return; }
  state.reloadDuration = def.reload; state.reloadTimer = def.reload; document.querySelector('#reload-indicator').classList.remove('hidden'); playTone(420, 0.07, 'triangle', 0.02, -100);
}
function finishReload() {
  const def = weaponDefs[activeWeaponIndex]; const ammo = weaponStates[activeWeaponIndex]; const transfer = transferReloadAmmo(ammo.ammo, ammo.reserve, def.magazineSize);
  ammo.ammo = transfer.ammo; ammo.reserve = transfer.reserve; state.reloadTimer = 0; document.querySelector('#reload-indicator').classList.add('hidden'); updateAmmoHud(); playTone(650, 0.055, 'triangle', 0.018, 120);
}
function updateHealthHud() {
  document.querySelector('#health-number').textContent = String(Math.max(0, Math.ceil(state.health)));
  const fill = document.querySelector('#health-fill'); fill.style.width = `${Math.max(0, state.health)}%`; fill.style.background = state.health < 30 ? '#d94d47' : state.health < 60 ? '#d5a04d' : '#d6b36e';
}
function damagePlayer(amount) {
  if (state.mode !== 'playing') return; state.health = applyDamage(state.health, amount); state.damageFlash = 0.55; updateHealthHud(); playTone(95, 0.13, 'sawtooth', 0.025, -50); if (state.health <= 0) finishGame(false);
}
function markHit() {
  state.hitMarker = 0.16; const marker = document.querySelector('#hit-marker'); marker.style.opacity = '1'; marker.style.color = '#f2d18e'; setTimeout(() => { marker.style.opacity = '0'; }, 120);
}
function damageEnemy(enemy, amount, point) {
  if (!enemy.alive) return; enemy.health = applyDamage(enemy.health, amount); enemy.hurtFlash = 0.12; enemy.barFill.scale.x = Math.max(0.001, enemy.health / enemy.maxHealth); enemy.barFill.position.x = -0.34 * (1 - enemy.health / enemy.maxHealth); enemy.healthBar.visible = true;
  spawnImpact(point, 0xd36b57, 4); markHit();
  if (enemy.health <= 0) { enemy.alive = false; enemy.root.visible = false; state.kills += 1; updateEnemyCount(); playTone(520, 0.09, 'triangle', 0.025, 220); showToast('目标已清除', 700); if (getMissionOutcome(state.kills, state.totalEnemies, state.health) === 'won') finishGame(true); }
}
function shoot() {
  if (state.mode !== 'playing' || state.reloadTimer > 0) return; const def = weaponDefs[activeWeaponIndex]; const ammo = weaponStates[activeWeaponIndex]; const now = performance.now() / 1000;
  if (now - state.lastShot < def.fireInterval) return;
  if (ammo.ammo <= 0) { showToast('弹匣为空 · 按 R 换弹', 850); state.lastShot = now; return; }
  state.lastShot = now; ammo.ammo -= 1; updateAmmoHud(); playShotSound(activeWeaponIndex); state.recoil = Math.min(0.16, state.recoil + def.recoil); muzzleTimer = 0.055;
  if (muzzleLight) muzzleLight.intensity = 5.5; if (muzzleSprite) muzzleSprite.material.opacity = 0.95;
  const spread = state.isAiming ? def.spread * 0.42 : def.spread; raycaster.setFromCamera(center, camera);
  raycaster.ray.direction.x += (Math.random() - 0.5) * spread; raycaster.ray.direction.y += (Math.random() - 0.5) * spread; raycaster.ray.direction.z += (Math.random() - 0.5) * spread; raycaster.ray.direction.normalize(); raycaster.far = def.range;
  const hits = raycaster.intersectObjects([...worldOccluders, ...enemyMeshes], false);
  if (hits.length) { const hit = hits[0]; if (hit.object.userData.enemy) { const damage = calculateShotDamage(def.damage, hit.object === hit.object.userData.enemy.head); damageEnemy(hit.object.userData.enemy, damage, hit.point); } else spawnImpact(hit.point, 0xe0b56e, 5); }
}
function hasLineOfSight(from, to) {
  const direction = to.clone().sub(from); const distance = direction.length(); direction.normalize(); raycaster.set(from, direction); raycaster.far = distance; return raycaster.intersectObjects(worldOccluders, false).length === 0;
}
function nearestCover(from, threat) {
  let best = null; let bestScore = Infinity;
  for (const point of coverPoints) { const away = point.clone().sub(threat); away.y = 0; away.normalize(); const candidate = point.clone().addScaledVector(away, 1.35); const score = candidate.distanceToSquared(from) + Math.max(0, 10 - candidate.distanceTo(threat)) * 4; if (score < bestScore) { bestScore = score; best = candidate; } }
  return best;
}
function canEnemyMove(position, dx, dz) {
  const x = position.x + dx; const z = position.z + dz; if (Math.abs(x) > 31 || Math.abs(z) > 31) return false;
  for (const box of solidBoxes) { const radius = 0.42; if (x + radius > box.minX && x - radius < box.maxX && z + radius > box.minZ && z - radius < box.maxZ) return false; }
  return true;
}
function moveEnemy(enemy, direction, distance) {
  const dx = direction.x * distance; const dz = direction.z * distance;
  if (canEnemyMove(enemy.root.position, dx, 0)) enemy.root.position.x += dx;
  else if (canEnemyMove(enemy.root.position, 0, dz)) enemy.root.position.z += dz;
  else { enemy.strafeDir *= -1; const side = new THREE.Vector3(-direction.z, 0, direction.x).multiplyScalar(enemy.strafeDir); if (canEnemyMove(enemy.root.position, side.x * distance, side.z * distance)) enemy.root.position.addScaledVector(side, distance); }
}
function updateEnemies(dt) {
  const playerPos = camera.position.clone();
  for (const enemy of enemies) {
    if (!enemy.alive) continue; const pos = enemy.root.position; const toPlayer = new THREE.Vector3(playerPos.x - pos.x, 0, playerPos.z - pos.z); const distance = toPlayer.length(); const direction = toPlayer.clone().normalize();
    const headPos = new THREE.Vector3(pos.x, 1.65, pos.z); const visible = hasLineOfSight(headPos, new THREE.Vector3(playerPos.x, 1.35, playerPos.z));
    enemy.strafeTimer -= dt; if (enemy.strafeTimer <= 0) { enemy.strafeDir *= -1; enemy.strafeTimer = 1.6 + Math.random() * 2.2; }
    if (enemy.health < 48 && !enemy.targetCover) { enemy.targetCover = nearestCover(pos, playerPos); enemy.state = 'retreat'; }
    if (enemy.state === 'retreat' && enemy.targetCover) { const retreatDir = enemy.targetCover.clone().sub(pos); retreatDir.y = 0; if (retreatDir.length() > 1.1) moveEnemy(enemy, retreatDir.normalize(), enemy.speed * dt * 1.15); else if (visible) enemy.state = 'engage'; }
    else if (distance > 10.5) { enemy.state = 'advance'; moveEnemy(enemy, direction, enemy.speed * dt); }
    else if (distance > 4.5) { enemy.state = 'engage'; const side = new THREE.Vector3(-direction.z, 0, direction.x).multiplyScalar(enemy.strafeDir); moveEnemy(enemy, side, enemy.speed * dt * 0.45); }
    enemy.root.lookAt(new THREE.Vector3(playerPos.x, 0, playerPos.z)); enemy.root.rotation.y += Math.PI;
    enemy.phase += dt * (distance > 6 ? 7 : 3); enemy.legs[0].rotation.x = Math.sin(enemy.phase) * (distance > 6 ? 0.55 : 0.12); enemy.legs[1].rotation.x = -enemy.legs[0].rotation.x;
    enemy.armPivots[0].rotation.x = Math.sin(enemy.phase) * 0.08; enemy.armPivots[1].rotation.x = -0.12; enemy.healthBar.quaternion.copy(camera.quaternion); enemy.healthBar.visible = enemy.health < enemy.maxHealth; if (enemy.hurtFlash > 0) enemy.hurtFlash -= dt;
    enemy.fireCooldown -= dt;
    if (visible && distance < 25 && enemy.fireCooldown <= 0 && state.mode === 'playing') { enemy.fireCooldown = 1.15 + Math.random() * 1.2; const start = new THREE.Vector3(pos.x, 1.2, pos.z).add(direction.clone().multiplyScalar(0.45)); const end = new THREE.Vector3(playerPos.x, 1.35, playerPos.z); spawnTracer(start, end, 0xe36c55); playTone(145, 0.045, 'square', 0.008, -70); if (Math.random() < (distance < 10 ? 0.38 : 0.24)) damagePlayer(distance < 10 ? 9 : 6); }
  }
}
function canPlayerOccupy(x, z) {
  const radius = 0.34; if (Math.abs(x) > 31 || Math.abs(z) > 31) return false;
  for (const box of solidBoxes) if (x + radius > box.minX && x - radius < box.maxX && z + radius > box.minZ && z - radius < box.maxZ) return false;
  return true;
}
function updatePlayer(dt) {
  const forwardInput = (keys.KeyW || touchMove.forward ? 1 : 0) - (keys.KeyS || touchMove.back ? 1 : 0);
  const sideInput = (keys.KeyD || touchMove.right ? 1 : 0) - (keys.KeyA || touchMove.left ? 1 : 0);
  const input = new THREE.Vector2(sideInput, forwardInput); if (input.lengthSq() > 1) input.normalize();
  const forward = new THREE.Vector3(-Math.sin(state.yaw), 0, -Math.cos(state.yaw)); const right = new THREE.Vector3(Math.cos(state.yaw), 0, -Math.sin(state.yaw));
  const move = new THREE.Vector3().addScaledVector(forward, input.y).addScaledVector(right, input.x); const moving = move.lengthSq() > 0.001;
  state.isSprinting = (keys.ShiftLeft || keys.ShiftRight) && moving && state.stamina > 1 && !state.isAiming; const speed = state.isSprinting ? 7.8 : state.isAiming ? 3.0 : 5.1;
  if (state.isSprinting) state.stamina = Math.max(0, state.stamina - dt * 24); else state.stamina = Math.min(100, state.stamina + dt * 16);
  document.querySelector('#stamina-text').textContent = `STAMINA ${Math.round(state.stamina)}%`;
  if (moving) { move.normalize().multiplyScalar(speed * dt); if (canPlayerOccupy(camera.position.x + move.x, camera.position.z)) camera.position.x += move.x; if (canPlayerOccupy(camera.position.x, camera.position.z + move.z)) camera.position.z += move.z; state.bobTime += dt * (state.isSprinting ? 13 : 9); }
  else state.bobTime += dt * 2;
  if ((keys.Space || keys.Spacebar) && state.isGrounded) { state.verticalVelocity = 5.1; state.isGrounded = false; keys.Space = false; }
  if (!state.isGrounded) { state.verticalVelocity -= 13.5 * dt; camera.position.y += state.verticalVelocity * dt; if (camera.position.y <= 1.7) { camera.position.y = 1.7; state.verticalVelocity = 0; state.isGrounded = true; } }
  const bob = moving && state.isGrounded ? Math.sin(state.bobTime) * (state.isSprinting ? 0.045 : 0.025) : 0; if (state.isGrounded) camera.position.y = 1.7 + bob;
  camera.rotation.set(state.pitch, state.yaw, 0, 'YXZ'); document.querySelector('#status-text').textContent = state.isSprinting ? 'SPRINTING' : state.isAiming ? 'AIMING' : 'COMBAT READY';
}
function updateWeapon(dt) {
  if (!weaponRoot) return;
  state.recoil = Math.max(0, state.recoil - dt * 0.42);
  const moving = Boolean(
    keys.KeyW || keys.KeyA || keys.KeyS || keys.KeyD ||
    touchMove.forward || touchMove.back || touchMove.left || touchMove.right
  );
  const reloadProgress = state.reloadTimer > 0
    ? 1 - state.reloadTimer / Math.max(0.001, state.reloadDuration)
    : 0;
  const pose = calculateWeaponPose({
    time: state.elapsed,
    aiming: state.isAiming,
    sprinting: state.isSprinting,
    moving,
    reloading: state.reloadTimer > 0,
    reloadProgress,
    recoil: state.recoil,
    weaponIndex: activeWeaponIndex,
  });
  weaponRoot.position.x += (pose.x - weaponRoot.position.x) * Math.min(1, dt * 12);
  weaponRoot.position.y += (pose.y - weaponRoot.position.y) * Math.min(1, dt * 12);
  weaponRoot.position.z += (pose.z - weaponRoot.position.z) * Math.min(1, dt * 12);
  weaponRoot.rotation.x += (pose.rotationX - weaponRoot.rotation.x) * Math.min(1, dt * 14);
  weaponRoot.rotation.y += (pose.rotationY - weaponRoot.rotation.y) * Math.min(1, dt * 10);
  weaponRoot.rotation.z += (pose.rotationZ - weaponRoot.rotation.z) * Math.min(1, dt * 10);
  camera.fov += (pose.fov - camera.fov) * Math.min(1, dt * 10);
  camera.updateProjectionMatrix();
  if (muzzleTimer > 0) {
    muzzleTimer -= dt;
    if (muzzleTimer <= 0) {
      if (muzzleLight) muzzleLight.intensity = 0;
      if (muzzleSprite) muzzleSprite.material.opacity = 0;
    }
  }
}
function updateEffects(dt) {
  for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.life -= dt; p.mesh.position.addScaledVector(p.velocity, dt); p.velocity.y -= 7 * dt; p.mesh.material.opacity = Math.max(0, p.life / p.maxLife); if (p.life <= 0) { scene.remove(p.mesh); p.mesh.geometry.dispose(); p.mesh.material.dispose(); particles.splice(i, 1); } }
  for (let i = tracers.length - 1; i >= 0; i--) { const t = tracers[i]; t.life -= dt; t.line.material.opacity = Math.max(0, t.life / 0.11) * 0.8; if (t.life <= 0) { scene.remove(t.line); t.line.geometry.dispose(); t.line.material.dispose(); tracers.splice(i, 1); } }
  if (state.damageFlash > 0) { state.damageFlash = Math.max(0, state.damageFlash - dt * 1.6); document.querySelector('#damage-flash').style.opacity = String(state.damageFlash); }
}
function finishGame(victory) {
  if (state.mode !== 'playing') return; state.mode = victory ? 'won' : 'lost'; document.exitPointerLock?.(); hud.classList.add('hidden'); touchControls.classList.add('hidden'); pauseHint.classList.add('hidden'); endScreen.classList.remove('hidden');
  document.querySelector('#end-eyebrow').textContent = victory ? 'MISSION COMPLETE' : 'MISSION FAILED'; document.querySelector('#end-title').textContent = victory ? '区域已清除' : '行动中止';
  document.querySelector('#end-description').textContent = victory ? '所有敌方单位已失去战斗能力。街区控制权已恢复。' : '你已失去继续执行任务的能力。重新部署并调整战术。';
  document.querySelector('#result-kills').textContent = String(state.kills).padStart(2, '0'); document.querySelector('#result-health').textContent = String(Math.max(0, Math.ceil(state.health))).padStart(3, '0');
  const totalSeconds = Math.floor(state.elapsed); document.querySelector('#result-time').textContent = `${String(Math.floor(totalSeconds / 60)).padStart(2, '0')}:${String(totalSeconds % 60).padStart(2, '0')}`;
}
function resetGame() {
  for (const enemy of enemies) scene.remove(enemy.root); enemies.length = 0; enemyMeshes.length = 0;
  for (const p of particles) scene.remove(p.mesh); particles.length = 0; for (const t of tracers) scene.remove(t.line); tracers.length = 0;
  state.health = 100; state.kills = 0; state.elapsed = 0; state.yaw = 0; state.pitch = 0; state.isAiming = false; state.isGrounded = true; state.verticalVelocity = 0; state.recoil = 0; state.damageFlash = 0; state.reloadTimer = 0; state.stamina = 100; state.lastShot = 0; state.mode = 'playing';
  camera.position.set(0, 1.7, 23); camera.rotation.set(0, 0, 0); camera.fov = 76; camera.updateProjectionMatrix();
  for (let i = 0; i < weaponStates.length; i++) { weaponStates[i].ammo = weaponDefs[i].magazineSize; weaponStates[i].reserve = weaponDefs[i].reserveStart; }
  setWeapon(1, true); updateHealthHud(); spawnEnemies(); state.startTime = performance.now() / 1000; hud.classList.remove('hidden'); menuScreen.classList.add('hidden'); endScreen.classList.add('hidden'); document.querySelector('#reload-indicator').classList.add('hidden');
  if (matchMedia('(pointer: coarse)').matches) touchControls.classList.remove('hidden'); else canvas.requestPointerLock?.();
}
function pauseGame() { if (state.mode !== 'playing' || matchMedia('(pointer: coarse)').matches) return; if (document.pointerLockElement !== canvas) { state.mode = 'paused'; pauseHint.classList.remove('hidden'); } }
function resumeGame() { if (state.mode === 'paused' && !matchMedia('(pointer: coarse)').matches) { state.mode = 'playing'; canvas.requestPointerLock?.(); pauseHint.classList.add('hidden'); } }
function updateGame(dt) {
  if (state.mode !== 'playing') return; state.elapsed = performance.now() / 1000 - state.startTime; updatePlayer(dt); updateEnemies(dt); updateWeapon(dt); updateEffects(dt);
  if (state.reloadTimer > 0) { state.reloadTimer -= dt; if (state.reloadTimer <= 0) finishReload(); }
  if (state.fireHeld || touchActions.shoot) shoot(); document.querySelector('#crosshair').style.transform = `translate(-50%, -50%) scale(${1 + state.recoil * 2})`;
}
function onMouseMove(event) { if (state.mode !== 'playing' || document.pointerLockElement !== canvas) return; state.yaw -= event.movementX * 0.0021; state.pitch -= event.movementY * 0.0018; state.pitch = THREE.MathUtils.clamp(state.pitch, -1.45, 1.45); }
function bindInput() {
  document.addEventListener('keydown', (event) => { keys[event.code] = true; if (state.mode !== 'playing') return; if (event.code === 'KeyR') startReload(); if (event.code === 'Digit1') setWeapon(0); if (event.code === 'Digit2') setWeapon(1); if (event.code === 'Digit3') setWeapon(2); if (event.code === 'Space') event.preventDefault(); });
  document.addEventListener('keyup', (event) => { keys[event.code] = false; }); document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mousedown', (event) => { if (state.mode !== 'playing') return; if (event.button === 0) state.fireHeld = true; if (event.button === 2) state.isAiming = true; });
  document.addEventListener('mouseup', (event) => { if (event.button === 0) state.fireHeld = false; if (event.button === 2) state.isAiming = false; });
  document.addEventListener('contextmenu', (event) => event.preventDefault());
  document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement === canvas) pauseHint.classList.add('hidden'); else if (state.mode === 'playing' && !matchMedia('(pointer: coarse)').matches) pauseGame(); });
  canvas.addEventListener('click', () => { if (state.mode === 'paused' && !matchMedia('(pointer: coarse)').matches) resumeGame(); });
  document.querySelector('#start-button').addEventListener('click', () => { initAudio(); resetGame(); }); document.querySelector('#restart-button').addEventListener('click', () => { initAudio(); resetGame(); });
  document.querySelectorAll('[data-move]').forEach((button) => { const key = button.dataset.move; button.addEventListener('pointerdown', (event) => { event.preventDefault(); touchMove[key] = true; button.setPointerCapture(event.pointerId); }); const release = () => { touchMove[key] = false; }; button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release); });
  document.querySelectorAll('[data-action]').forEach((button) => {
    const action = button.dataset.action;
    button.addEventListener('pointerdown', (event) => { event.preventDefault(); event.stopPropagation(); if (action === 'shoot') touchActions.shoot = true; if (action === 'ads') state.isAiming = true; if (action === 'reload') startReload(); if (action === 'weapon') setWeapon((activeWeaponIndex + 1) % weaponDefs.length); button.setPointerCapture(event.pointerId); });
    const release = () => { if (action === 'shoot') touchActions.shoot = false; if (action === 'ads') state.isAiming = false; };
    button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release);
  });
  const lookPad = document.querySelector('#look-pad'); let lookPointer = null; let lastX = 0; let lastY = 0;
  lookPad.addEventListener('pointerdown', (event) => { if (state.mode !== 'playing') return; lookPointer = event.pointerId; lastX = event.clientX; lastY = event.clientY; lookPad.setPointerCapture(event.pointerId); });
  lookPad.addEventListener('pointermove', (event) => { if (lookPointer !== event.pointerId) return; const dx = event.clientX - lastX; const dy = event.clientY - lastY; lastX = event.clientX; lastY = event.clientY; state.yaw -= dx * 0.006; state.pitch = THREE.MathUtils.clamp(state.pitch - dy * 0.005, -1.45, 1.45); });
  const endLook = () => { lookPointer = null; }; lookPad.addEventListener('pointerup', endLook); lookPad.addEventListener('pointercancel', endLook);
}
function animate() { requestAnimationFrame(animate); const dt = Math.min(clock.getDelta(), 0.04); updateGame(dt); renderer.render(scene, camera); }
function onResize() { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75)); }

buildEnvironment(); setWeapon(1, true); bindInput(); window.addEventListener('resize', onResize);
if (matchMedia('(pointer: coarse)').matches) document.querySelector('.controls-card')?.classList.add('hidden');
updateHealthHud(); animate();
