import * as THREE from 'three';
import { BOT, FIXED_STEP, type GamePhase } from './config';
import { World } from './world';
import { Input } from './input';
import { Player } from './player';
import { Arsenal, isHeadshotHeight, resolveShotDamage, shotSpread } from './combat';
import { Bot } from './bots';
import { WeaponView } from './weapon-view';
import { GameAudio } from './audio';
import { HUD } from './hud';
import { bearingFromDelta } from './damage-indicators';
import './style.css';

interface Tracer { line: THREE.Line; remaining: number; }
export class Game {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 230);
  world: World;
  input: Input;
  player = new Player();
  arsenal = new Arsenal();
  weapon = new WeaponView();
  audio = new GameAudio();
  hud: HUD;
  bots: Bot[];
  phase: GamePhase = 'ready';
  kills = 0;
  deaths = 0;
  elapsed = 0;
  hitTime = 0;
  feedTime = 0;
  private tracers: Tracer[] = [];
  private raycaster = new THREE.Raycaster();
  private accumulator = 0;
  private lastFrame = performance.now();
  private fps = 60;
  private cameraHeight = 1.68;
  get aiming() { return this.input.rightDown && this.player.health.alive && !this.arsenal.reloading; }
  constructor(app: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.22;
    this.renderer.domElement.id = 'game-canvas'; this.renderer.domElement.tabIndex = 0;
    this.renderer.domElement.setAttribute('aria-label', '第一人称射击训练场');
    app.append(this.renderer.domElement);
    this.scene.background = new THREE.Color(0xc8d7d2); this.scene.fog = new THREE.Fog(0xc8d7d2, 45, 155);
    this.scene.add(new THREE.HemisphereLight(0xe8f0dc, 0x74745b, 2.5));
    const sun = new THREE.DirectionalLight(0xffe4b2, 3.2); sun.position.set(-22, 38, 16); sun.castShadow = true;
    sun.shadow.mapSize.set(2048,2048); sun.shadow.camera.left = -42; sun.shadow.camera.right = 42; sun.shadow.camera.top = 42; sun.shadow.camera.bottom = -42;
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 100; sun.shadow.normalBias = 0.03; sun.shadow.bias = -0.00015; this.scene.add(sun);
    this.world = new World(this.scene);
    this.bots = [1,2,3,5].map((spawn, id) => new Bot(id, this.scene, this.world.spawns[spawn]));
    this.input = new Input(this.renderer.domElement);
    this.hud = new HUD(app); this.hud.phase('ready');
    this.hud.onStart(() => void this.start());
    this.hud.onSound(() => this.toggleSound());
    this.input.onLockChange = locked => {
      this.phase = locked ? 'playing' : this.phase === 'ready' ? 'ready' : 'paused';
      this.accumulator = 0; this.lastFrame = performance.now(); this.hud.phase(this.phase);
    };
    document.addEventListener('pointerlockerror', () => this.hud.error('鼠标锁定失败，请使用桌面浏览器并再次点击开始。'));
    this.renderer.domElement.addEventListener('webglcontextlost', e => {
      e.preventDefault(); this.input.unlock(); this.hud.error('图形上下文已丢失，请刷新页面重新载入。');
    });
    window.addEventListener('resize', () => this.resize()); this.resize();
    this.renderer.setAnimationLoop(now => this.frame(now));
  }
  async start() {
    try {
      // Keep requestPointerLock directly inside the user's activation event.
      const lock = this.input.lock(); void this.audio.init().catch(() => {}); await lock;
    } catch { this.hud.error('无法锁定鼠标，请再次点击，或在独立的 Chrome / Edge 窗口打开。'); }
  }
  private toggleSound() { this.audio.muted = !this.audio.muted; this.hud.muted(this.audio.muted); }
  private resize() {
    this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth,innerHeight); this.weapon.resize(innerWidth,innerHeight);
  }
  private cameraPose(dt: number) {
    this.cameraHeight = THREE.MathUtils.lerp(this.cameraHeight, this.player.crouched ? 0.93 : 1.68, 1 - Math.exp(-dt * 20));
    this.camera.position.copy(this.player.feet).add(new THREE.Vector3(0, this.cameraHeight, 0));
    this.camera.rotation.set(this.input.pitch, this.input.yaw, 0, 'YXZ');
    this.camera.updateMatrixWorld(true);
  }
  private step(dt: number) {
    this.elapsed += dt; this.hitTime = Math.max(0, this.hitTime - dt); this.feedTime = Math.max(0,this.feedTime - dt);
    if (this.input.consume('KeyM')) this.toggleSound();
    if (this.player.health.alive) {
      if (this.input.consume('Digit1')) this.arsenal.switchTo('rifle');
      if (this.input.consume('Digit2')) this.arsenal.switchTo('pistol');
      if (this.input.consume('Digit3')) this.arsenal.switchTo('sniper');
      if (this.input.consume('Digit4')) this.arsenal.switchTo('shotgun');
      if (this.input.wheel) { this.arsenal.cycle(this.input.wheel); this.input.wheel = 0; }
      if (this.input.consume('KeyR') && this.arsenal.reload()) this.audio.reload();
    }
    this.arsenal.update(dt);
    const aiming = this.aiming;
    const trigger = this.arsenal.config.automatic ? this.input.mouseDown : this.input.shotPressed;
    this.player.update(dt, this.input, this.world, trigger || this.arsenal.cooldown > 0 || aiming);
    this.cameraPose(dt);
    if (this.player.health.alive && trigger && this.arsenal.fire()) this.shoot(aiming);
    this.input.shotPressed = false;
    if (!this.player.health.alive && this.player.respawnRemaining <= 0) {
      this.player.respawn(this.world.safestSpawn(this.bots.filter(b=>b.health.alive).map(b=>b.position)));
      this.arsenal.reset(); this.hud.clearDamage(); this.input.clear(); this.input.pitch = 0;
      const p = this.player.feet; this.input.yaw = Math.atan2(p.x,p.z);
    }
    for (const bot of this.bots) bot.update(dt,this.world,this.player,this.bots,(a,b)=>this.enemyShoot(a,b));
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i]; t.remaining -= dt;
      if (t.remaining <= 0) { this.scene.remove(t.line); t.line.geometry.dispose(); (t.line.material as THREE.Material).dispose(); this.tracers.splice(i,1); }
    }
    this.weapon.update(dt,this.arsenal,this.player,this.aiming);
  }
  private shoot(aiming: boolean) {
    const weapon = this.arsenal.config;
    const pellets = weapon.pellets ?? 1;
    const spread = shotSpread(weapon, { moving: this.player.moving, crouched: this.player.crouched, aiming });
    const muzzle = this.camera.position.clone().add(new THREE.Vector3(0, -0.12, 0));
    this.scene.updateMatrixWorld(true);
    let hits = 0, headshots = 0, totalDamage = 0, nearest = Infinity;
    const killed = new Set<number>();
    for (let i = 0; i < pellets; i++) {
      const direction = this.camera.getWorldDirection(new THREE.Vector3());
      direction.x += (Math.random() - 0.5) * spread; direction.y += (Math.random() - 0.5) * spread; direction.normalize();
      this.raycaster.set(this.camera.position, direction); this.raycaster.far = weapon.range;
      const intersections = this.raycaster.intersectObjects([...this.world.solids.children, ...this.bots.filter(b=>b.health.alive).map(b=>b.mesh)],true);
      const hit = intersections[0];
      const endpoint = hit ? hit.point : this.camera.position.clone().addScaledVector(direction, weapon.range);
      if (hit && typeof hit.object.userData.bot === 'number') {
        const bot = this.bots[hit.object.userData.bot];
        const distance = this.camera.position.distanceTo(hit.point);
        const shot = resolveShotDamage(weapon, distance, hit.object.userData.zone === 'head' ? 'head' : 'body');
        hits++; totalDamage += shot.damage; nearest = Math.min(nearest, distance);
        if (shot.headshot) headshots++;
        if (bot.hit(shot.damage)) killed.add(bot.id);
      }
      this.addTracer(muzzle, endpoint, 0xf9da94);
    }
    if (hits > 0) {
      this.hitTime = headshots > 0 ? 0.3 : 0.18;
      this.hud.hitmarker(totalDamage, headshots > 0, nearest, hits);
      this.audio.hit(headshots > 0);
      if (killed.size) {
        this.kills += killed.size; this.feedTime = 3;
        const ids = [...killed].sort((a,b) => a - b).map(id => `人机 ${String(id + 1).padStart(2,'0')}`);
        const label = `${weapon.label}${headshots > 0 ? ' 爆头' : ''} · ${Math.round(nearest)}m`;
        this.hud.feed(`你  ·  ${label}  →  ${ids.join(' / ')}`);
      }
    }
    this.weapon.fire(); this.audio.shot(weapon.id);
    this.input.pitch = Math.min(1.45, this.input.pitch + weapon.recoil);
  }
  private enemyShoot(origin: THREE.Vector3, target: THREE.Vector3) {
    const direction = target.clone().sub(origin).normalize(); this.raycaster.set(origin,direction); this.raycaster.far = 80;
    const obstacle = this.raycaster.intersectObjects(this.world.solids.children,false)[0];
    let end = obstacle ? obstacle.point : origin.clone().addScaledVector(direction,80);
    if (this.player.health.alive) {
      const rayPoint = new THREE.Vector3(), segmentPoint = new THREE.Vector3();
      const capsule = this.player.collider;
      const dist = this.raycaster.ray.distanceSqToSegment(capsule.start,capsule.end,rayPoint,segmentPoint);
      if (dist <= capsule.radius ** 2 && origin.distanceTo(rayPoint) <= origin.distanceTo(end)) {
        end = rayPoint;
        const headshot = isHeadshotHeight(rayPoint.y - this.player.feet.y, this.player.crouched);
        const damage = Math.round(BOT.damage * (headshot ? BOT.headshotMultiplier : 1));
        const feet = this.player.feet, before = this.player.health.value;
        const died = this.player.takeDamage(damage);
        if (this.player.health.value < before) {
          const dx = origin.x - feet.x, dz = origin.z - feet.z;
          if (Math.hypot(dx, dz) > 0.01) this.hud.hitFrom(bearingFromDelta(dx, dz), damage);
        }
        if (died) {
          this.deaths++; this.input.clear(); this.feedTime = 3;
          this.hud.feed(headshot ? '你被爆头 · 即将返回训练场' : '你已阵亡 · 即将返回训练场');
        }
      }
    }
    this.addTracer(origin,end,0xe99168);
    this.audio.tone(90,0.06,0.008,'triangle',40);
  }
  private addTracer(a: THREE.Vector3,b: THREE.Vector3,color: number) {
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a,b]), new THREE.LineBasicMaterial({color,transparent:true,opacity:0.6}));
    this.scene.add(line); this.tracers.push({line,remaining:0.065});
  }
  private frame(now: number) {
    const rawDt = (now - this.lastFrame) / 1000; const dt = Math.min(Math.max(rawDt,0),0.075); this.lastFrame = now;
    this.fps = THREE.MathUtils.lerp(this.fps,1 / Math.max(rawDt,0.001),0.035);
    const aiming = this.phase === 'playing' && this.aiming;
    if (this.phase === 'playing') {
      this.accumulator += dt;
      while (this.accumulator >= FIXED_STEP) { this.step(FIXED_STEP); this.accumulator -= FIXED_STEP; }
      const fov = aiming ? this.arsenal.config.aimFov : this.player.sprinting ? 82 : 75;
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov,fov,1 - Math.exp(-dt * 8)); this.camera.updateProjectionMatrix();
      this.cameraPose(dt);
    } else if (this.phase === 'ready') {
      this.camera.position.set(36 + Math.sin(now * 0.00007) * 2,29,39); this.camera.lookAt(-2,0,-5);
    }
    this.hud.aiming(aiming, aiming && this.arsenal.selected === 'sniper');
    this.hud.update(this.player,this.arsenal,this.bots,this.kills,this.deaths,this.hitTime,this.feedTime,this.fps);
    if (this.phase === 'playing') this.hud.updateDamage(dt, this.input.yaw);
    this.hud.drawMap(this.world,this.player,this.bots,this.input.yaw,now / 1000);
    this.renderer.autoClear = true; this.renderer.render(this.scene,this.camera);
    if (this.phase !== 'ready') { this.renderer.autoClear = false; this.renderer.clearDepth(); this.renderer.render(this.weapon.scene,this.weapon.camera); }
  }
}

try {
  const game = new Game(document.querySelector('#app')!);
  // Development-only inspection hook for deterministic physics and lifecycle checks.
  if (import.meta.env.DEV) Object.assign(window, { __RANGE__: game });
} catch (error) {
  console.error(error);
  document.querySelector('#app')!.innerHTML = '<div style="padding:60px;font-family:sans-serif;color:#e4ebcc"><h1>训练场加载失败</h1><p>请使用支持 WebGL 2 的桌面 Chrome / Edge，开启硬件加速后刷新页面。</p></div>';
}
