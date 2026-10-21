import type { Arsenal } from './combat';
import type { Player } from './player';
import type { Bot } from './bots';
import type { World } from './world';
import type { GamePhase } from './config';
import { DamageIndicators, damageShape, screenAngle } from './damage-indicators';

const icon = '<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M5 12V5h7m8 0h7v7m0 8v7h-7m-8 0H5v-7M16 8v16M8 16h16" stroke="currentColor" stroke-width="2"/><circle cx="16" cy="16" r="4" stroke="currentColor"/></svg>';
export class HUD {
  root: HTMLDivElement;
  map: HTMLCanvasElement;
  private damageCanvas: HTMLCanvasElement;
  private damageCtx: CanvasRenderingContext2D;
  private damageIndicators = new DamageIndicators();
  private damageVisible = false;
  private el: Record<string, HTMLElement> = {};
  private cached: Record<string, string> = {};
  private lastMap = 0;
  constructor(app: HTMLElement) {
    this.root = document.createElement('div'); this.root.id = 'interface';
    this.root.innerHTML = `
      <div id="scope" class="scope" aria-hidden="true"></div>
      <header class="topbar"><a class="brand" href="./" aria-label="RANGE 07 首页">${icon}<span>RANGE<span class="brand-number">07</span></span><i></i><small>战术训练场</small></a><div class="session"><span class="status-dot"></span>LOCAL SESSION<span class="divider">/</span><span id="phase-label">待命</span></div><button id="sound" class="sound" title="切换音效" aria-label="关闭音效">声音 <span id="sound-state">开启</span><span class="sound-bars">▂▅▃▇</span></button></header>
      <div class="top-game"><div class="sector"><span>训练区域</span><strong>SECTOR 07 <i>/ 自由交战</i></strong></div><div class="scoreboard"><div><span>击杀</span><strong id="kills">00</strong></div><b>:</b><div><span>死亡</span><strong id="deaths">00</strong></div><i></i><div><span>在线人机</span><strong><em id="bots-alive">4</em><small>/ 4</small></strong></div></div></div>
      <section id="menu" class="menu"><div class="brief"><div class="eyebrow"><span></span> FIELD EXERCISE — 001</div><h1>准备好，<br>进入<span>训练场。</span></h1><p class="intro">检查装备，寻找掩体。<br>在这片沙地上，练习你的下一次精准命中。</p><div class="tags"><span>第一人称</span><span>自由交战</span><span>4 名人机</span></div><button id="start" class="start"><span id="start-label">开始训练</span><span class="button-arrow">↗</span></button><p id="start-help" class="start-help"><span class="tiny-mouse">◉</span> 点击进入 · 鼠标控制视角 · ESC 暂停</p><div class="mission"><span class="mission-index">01 /</span><div><strong>没有倒计时。只有下一次进步。</strong><p>无限重生 · 四种武器 · 真实掩体碰撞</p></div></div></div><aside class="map-card"><div class="card-heading"><span class="status-dot"></span>区域简报<span class="card-code">R07—TACTICAL</span></div><canvas id="minimap" width="480" height="480" aria-label="训练场地图"></canvas><div class="map-caption"><strong>沙地训练基地</strong><span>60 × 60 M</span></div><div class="map-legend"><span><i class="legend-player"></i>你的位置</span><span><i class="legend-enemy"></i>敌方单位</span><span>高台 / 建筑 / 掩体</span></div></aside></section>
      <div id="crosshair" class="crosshair"><i></i><i></i><i></i><i></i><b></b></div><div id="hitmarker" class="hitmarker">×</div><div id="hit-info" class="hit-info"></div><div id="hurt" class="hurt"></div><canvas id="damage-ring" class="damage-ring" aria-hidden="true"></canvas>
      <div id="notice" class="notice"></div><div id="death-screen" class="death-screen" hidden><span>训练尚未结束</span><strong>重新集结</strong><p><b id="respawn-count">3</b> 秒后返回训练场</p></div>
      <div id="kill-feed" class="kill-feed"></div>
      <footer class="bottom"><div class="health-card"><div class="health-label"><span class="health-cross">+</span><span>生命体征 <small>VITALS</small></span><span id="stance" class="stance">站立</span></div><div class="health-value"><strong id="health">100</strong><span>/ 100</span><b id="protection">准备就绪</b></div><div class="health-track"><div id="health-fill"></div></div></div><div class="controls"><span><kbd>W A S D</kbd>移动</span><span><kbd>SPACE</kbd>跳跃</span><span><kbd>SHIFT</kbd>奔跑</span><span><kbd>C</kbd>下蹲</span><span><kbd>R</kbd>换弹</span><span><kbd>右键</kbd>瞄准</span><span><kbd>1 – 4</kbd>切枪</span></div><div class="weapon-card"><div class="weapon-name"><span id="weapon-name">突击步枪</span><span id="weapon-label">AR–07</span></div><div class="weapon-data"><svg viewBox="0 0 180 60" fill="currentColor" aria-hidden="true"><path d="M5 17h29l8 7h59v-7h8v6h37v8h25v6h-33v6H83l5 15H73l-8-15H51l-5 13H35l3-19H20L5 43zm51 10v6h39v-6z"/></svg><div><strong id="ammo">30</strong><span>/ <b id="capacity">30</b></span></div></div><div class="weapon-bottom"><span id="reload-status">备用弹药 ∞</span><span><b id="slot-rifle" class="active-slot">1</b><b id="slot-pistol">2</b><b id="slot-sniper">3</b><b id="slot-shotgun">4</b></span></div><div class="reload-track"><div id="reload-fill"></div></div></div></footer>
      <div class="corner-meta"><span><i></i> WEBGL · <b id="fps">60</b> FPS</span><span>RANGE 07 / TRAINING BUILD 1.0</span></div>`;
    app.append(this.root);
    this.root.querySelectorAll<HTMLElement>('[id]').forEach(e => this.el[e.id] = e);
    this.map = this.el.minimap as HTMLCanvasElement;
    this.damageCanvas = this.el['damage-ring'] as HTMLCanvasElement;
    this.damageCtx = this.damageCanvas.getContext('2d')!;
  }
  onStart(fn: () => void) { this.el.start.addEventListener('click', fn); }
  onSound(fn: () => void) { this.el.sound.addEventListener('click', fn); }
  setText(id: string, value: string) { if (this.cached[id] !== value) { this.el[id].textContent = value; this.cached[id] = value; } }
  hitmarker(damage: number, headshot: boolean, distance: number, pellets = 1) {
    const count = pellets > 1 ? ` · ${pellets} 弹丸` : '';
    this.el['hit-info'].textContent = `${headshot ? '爆头 ' : ''}${damage}${count} · ${Math.round(distance)}m`;
    this.el.hitmarker.classList.toggle('headshot', headshot);
    this.el['hit-info'].classList.toggle('headshot', headshot);
  }
  aiming(aiming: boolean, scoped: boolean) {
    this.root.classList.toggle('aiming', aiming);
    this.root.classList.toggle('scoped', scoped);
  }
  hitFrom(bearing: number, damage: number) { this.damageIndicators.add(bearing, damage); }
  updateDamage(dt: number, yaw: number) {
    this.damageIndicators.update(dt);
    const active = this.damageIndicators.marks.length > 0;
    if (!active && !this.damageVisible) return;
    this.drawDamage(yaw);
    this.damageVisible = active;
  }
  clearDamage() {
    this.damageIndicators.clear();
    this.damageCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.damageCtx.clearRect(0, 0, this.damageCanvas.width, this.damageCanvas.height);
    this.damageVisible = false;
  }
  private drawDamage(yaw: number) {
    const width = innerWidth, height = innerHeight;
    const dpr = Math.min(devicePixelRatio, 2);
    const pixelWidth = Math.max(1, Math.round(width * dpr)), pixelHeight = Math.max(1, Math.round(height * dpr));
    if (this.damageCanvas.width !== pixelWidth || this.damageCanvas.height !== pixelHeight) {
      this.damageCanvas.width = pixelWidth; this.damageCanvas.height = pixelHeight;
    }
    const ctx = this.damageCtx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    if (!this.damageIndicators.marks.length) return;
    const cx = width / 2, cy = height / 2;
    const base = Math.min(width, height) * 0.13;
    const inner = base * 0.9;
    ctx.shadowColor = '#ff2a1a';
    for (const mark of this.damageIndicators.marks) {
      const shape = damageShape(mark.severity);
      const fade = Math.min(1, mark.life / 0.45);
      const angle = screenAngle(mark.bearing, yaw) - Math.PI / 2;
      const outer = base * shape.outerScale;
      const gradient = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
      gradient.addColorStop(0, 'rgba(255,85,60,0)');
      gradient.addColorStop(0.55, `rgba(255,55,38,${shape.alpha * fade * 0.75})`);
      gradient.addColorStop(1, `rgba(255,30,22,${shape.alpha * fade})`);
      ctx.fillStyle = gradient;
      ctx.shadowBlur = (10 + 12 * mark.severity) * fade;
      ctx.beginPath();
      ctx.arc(cx, cy, inner, angle - shape.halfAngle, angle + shape.halfAngle);
      ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
      ctx.closePath(); ctx.fill();
    }
    ctx.shadowBlur = 0;
  }
  muted(value: boolean) { this.setText('sound-state', value ? '关闭' : '开启'); this.el.sound.setAttribute('aria-label', value ? '开启音效' : '关闭音效'); }
  phase(phase: GamePhase) {
    this.root.classList.toggle('playing', phase === 'playing');
    this.root.classList.toggle('paused', phase === 'paused');
    this.el.menu.hidden = phase === 'playing';
    this.setText('phase-label', phase === 'playing' ? '训练中' : phase === 'paused' ? '已暂停' : '待命');
    this.setText('start-label', phase === 'paused' ? '继续训练' : '开始训练');
    (this.el.start as HTMLButtonElement).disabled = false;
    if (phase !== 'playing') {
      this.root.classList.remove('aiming', 'scoped');
      this.clearDamage();
    }
    const title = this.root.querySelector('h1')!;
    title.innerHTML = phase === 'paused' ? '稍作休整，<br>再<span>返回战场。</span>' : '准备好，<br>进入<span>训练场。</span>';
  }
  error(message: string) { this.setText('start-help', message); (this.el.start as HTMLButtonElement).disabled = false; }
  feed(text: string) { this.setText('kill-feed', text); }
  update(player: Player, arsenal: Arsenal, bots: Bot[], kills: number, deaths: number, hitTime: number, feedTime: number, fps: number) {
    this.setText('kills', String(kills).padStart(2,'0')); this.setText('deaths', String(deaths).padStart(2,'0'));
    this.setText('bots-alive', String(bots.filter(b => b.health.alive).length));
    const health = Math.round(player.health.value);
    this.setText('health', String(health)); this.el['health-fill'].style.width = `${player.health.value}%`;
    this.el['health-fill'].classList.toggle('low', health <= 30);
    this.el['health-fill'].classList.toggle('regen', player.regenerating);
    this.setText('stance', !player.health.alive ? '阵亡' : player.crouched ? '下蹲' : !player.grounded ? '跳跃' : player.sprinting ? '奔跑' : '站立');
    this.setText('protection',
      player.protection > 0 ? `保护 ${player.protection.toFixed(1)}s`
      : player.regenerating ? '恢复中'
      : !player.health.alive ? '生命体征消失'
      : health <= 30 ? '生命垂危'
      : health < 100 ? `恢复 ${Math.ceil(player.regenDelayRemaining)}s`
      : '状态正常');
    const weapon = arsenal.config, ammo = arsenal.ammo[arsenal.selected], reloading = arsenal.reloading;
    this.setText('weapon-name', weapon.name); this.setText('weapon-label', weapon.label);
    this.setText('ammo', String(ammo).padStart(2,'0')); this.setText('capacity', String(weapon.capacity));
    this.setText('reload-status',
      reloading
        ? weapon.reloadStyle === 'shell'
          ? `装填 ${ammo}/${weapon.capacity} · ${arsenal.reloadRemaining.toFixed(1)}s`
          : `换弹中 ${arsenal.reloadRemaining.toFixed(1)}s`
        : weapon.bolt && arsenal.boltRemaining > 0 ? `拉栓中 ${arsenal.boltRemaining.toFixed(1)}s`
        : ammo === 0 ? '按 R 装填弹药'
        : '备用弹药 ∞');
    this.el['reload-fill'].style.width = reloading ? `${(1 - arsenal.reloadRemaining / weapon.reload) * 100}%` : '0%';
    this.el['slot-rifle'].classList.toggle('active-slot', arsenal.selected === 'rifle');
    this.el['slot-pistol'].classList.toggle('active-slot', arsenal.selected === 'pistol');
    this.el['slot-sniper'].classList.toggle('active-slot', arsenal.selected === 'sniper');
    this.el['slot-shotgun'].classList.toggle('active-slot', arsenal.selected === 'shotgun');
    this.el.hurt.style.opacity = String(player.damageFlash);
    this.el.hitmarker.style.opacity = String(Math.min(1, hitTime * 8));
    this.el['hit-info'].style.opacity = String(Math.min(1, hitTime * 6));
    this.el['kill-feed'].style.opacity = feedTime > 0 ? '1' : '0';
    this.el['death-screen'].hidden = player.health.alive;
    this.setText('respawn-count', String(Math.max(1, Math.ceil(player.respawnRemaining))));
    this.setText('notice',
      !player.health.alive ? ''
      : reloading ? (weapon.reloadStyle === 'shell' ? '正在逐发装填' : '正在装填弹药')
      : weapon.bolt && arsenal.boltRemaining > 0 ? '拉栓中'
      : ammo === 0 ? '弹匣已空 · 按 R 换弹'
      : player.protection > 0 ? '重生保护中'
      : '');
    this.setText('fps', String(Math.round(fps)));
  }
  drawMap(world: World, player: Player, bots: Bot[], yaw: number, now: number) {
    if (now - this.lastMap < 0.1) return; this.lastMap = now;
    const ctx = this.map.getContext('2d')!; const s = 480 / 64;
    ctx.clearRect(0,0,480,480); ctx.fillStyle = '#202b27'; ctx.fillRect(0,0,480,480);
    ctx.strokeStyle = '#34413a'; ctx.lineWidth = 1;
    for (let i = 0; i <= 480; i += 30) { ctx.beginPath(); ctx.moveTo(i,0);ctx.lineTo(i,480);ctx.moveTo(0,i);ctx.lineTo(480,i);ctx.stroke(); }
    ctx.save(); ctx.translate(240,240); ctx.scale(s,s);
    ctx.strokeStyle = '#85917a'; ctx.lineWidth = 0.22; ctx.strokeRect(-30,-30,60,60);
    for (const object of world.solids.children) {
      if (object.position.y < 0 || object.type !== 'Mesh') continue;
      const mesh = object as import('three').Mesh;
      mesh.geometry.computeBoundingBox(); const bounds = mesh.geometry.boundingBox!;
      ctx.fillStyle = object.position.y > 3 ? '#8d9275' : '#606d5b';
      ctx.fillRect(bounds.min.x + object.position.x, bounds.min.z + object.position.z, bounds.max.x - bounds.min.x, bounds.max.z - bounds.min.z);
    }
    ctx.font = '1.6px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#dce1c4';
    ctx.fillText('01',-17,-9); ctx.fillText('02',16,10); ctx.fillText('03',5,-19);
    for (const bot of bots) if (bot.health.alive) { ctx.fillStyle = '#e99075'; ctx.fillRect(bot.position.x - 0.55, bot.position.z - 0.55, 1.1, 1.1); }
    const pos = player.feet; ctx.translate(pos.x,pos.z); ctx.rotate(-yaw);
    ctx.fillStyle = '#d5ef8b'; ctx.beginPath();ctx.moveTo(0,-1.2);ctx.lineTo(-0.85,0.8);ctx.lineTo(0,0.4);ctx.lineTo(0.85,0.8);ctx.closePath();ctx.fill();
    ctx.restore(); ctx.fillStyle = '#a3b399'; ctx.font = '13px monospace'; ctx.fillText('N ↑', 18,25);
  }
}
