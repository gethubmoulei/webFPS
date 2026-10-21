import * as THREE from 'three';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { World } from '../src/world';
import { Player } from '../src/player';
import type { Input } from '../src/input';
import { findPath } from '../src/navigation';
import { Bot } from '../src/bots';

let world: World;
beforeAll(() => {
  // Textures are not rendered in these tests; all map geometry and collision are real.
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, fillText() {} }) }) });
  world = new World(new THREE.Scene());
  vi.unstubAllGlobals();
});
function controls(...keys: string[]) {
  const input = { keys: new Set(keys), pressed: new Set<string>(), yaw: 0, consume(code: string) { const value = this.pressed.has(code); this.pressed.delete(code); return value; } };
  return input as unknown as Input;
}
function advance(player: Player, input: Input, seconds: number, firing = false) {
  for (let i = 0; i < Math.round(seconds * 120); i++) player.update(1/120,input,world,firing);
}

describe('实际地图胶囊体碰撞', () => {
  it('持续接地且外墙不可穿越', () => {
    const player = new Player(); player.teleport(new THREE.Vector3(27,0.04,24));
    const input = controls('KeyD'); advance(player,input,3);
    expect(player.feet.x).toBeLessThan(29.3); expect(player.feet.y).toBeCloseTo(0,2); expect(player.grounded, JSON.stringify({feet:player.feet,velocity:player.velocity})).toBe(true);
  });
  it('可步行上斜坡并到达平台，也可沿斜坡返回地面', () => {
    const player = new Player(); player.teleport(new THREE.Vector3(5,0.04,-3));
    const input = controls('KeyW'); advance(player,input,3.3);
    expect(player.feet.z).toBeLessThan(-15); expect(player.feet.y).toBeCloseTo(3,1);
    input.keys = new Set(['KeyS']); advance(player,input,3.5);
    expect(player.feet.z).toBeGreaterThan(-5); expect(player.feet.y).toBeCloseTo(0,1);
  });
  it('低顶通道只允许下蹲进入，离开后才可站起', () => {
    const player = new Player(); player.teleport(new THREE.Vector3(-7,0.04,13));
    const input = controls('KeyW'); advance(player,input,1);
    expect(player.feet.z).toBeGreaterThan(11.25);
    input.keys.add('KeyC'); advance(player,input,1.2);
    expect(player.feet.z).toBeLessThan(10); expect(player.crouched).toBe(true);
    input.keys.clear(); advance(player,input,0.5); expect(player.crouched).toBe(true);
    input.keys.add('KeyS'); advance(player,input,2); expect(player.crouched).toBe(false);
  });
  it('跳跃约 1.2 米，空中不能二次跳跃', () => {
    const player = new Player(), input = controls(); advance(player,input,0.3);
    input.pressed.add('Space'); let peak = 0;
    for (let i = 0; i < 100; i++) {
      if (i === 18) input.pressed.add('Space');
      player.update(1/120,input,world,false); peak = Math.max(peak,player.feet.y);
    }
    expect(peak).toBeGreaterThan(1.1); expect(peak).toBeLessThan(1.25); expect(player.grounded).toBe(true);
  });
  it('斜向移动不会更快', () => {
    const start = new THREE.Vector3(10,0.04,24), straight = new Player(), diagonal = new Player();
    straight.teleport(start); diagonal.teleport(start);
    advance(straight,controls('KeyD'),1); advance(diagonal,controls('KeyD','KeyW'),1);
    const planar = (p: Player) => Math.hypot(p.feet.x-start.x,p.feet.z-start.z);
    expect(planar(diagonal)).toBeCloseTo(planar(straight),3);
  });
  it('重生保护挡伤害，死亡计时与恢复状态正确', () => {
    const player = new Player(); expect(player.takeDamage(100)).toBe(false); expect(player.health.value).toBe(100);
    advance(player,controls(),2.1); expect(player.takeDamage(100)).toBe(true);
    advance(player,controls(),1); expect(player.respawnRemaining).toBeCloseTo(2);
    player.respawn(world.spawns[1]); expect(player.health.value).toBe(100); expect(player.protection).toBe(2);
  });
});

describe('自动回血与角色动作', () => {
  it('受伤后延迟回血，回满即止，再次受伤重新计时', () => {
    const player = new Player();
    advance(player, controls(), 2.1);
    player.takeDamage(50); expect(player.health.value).toBe(50);
    advance(player, controls(), 3.8); expect(player.health.value).toBe(50);
    advance(player, controls(), 0.4);
    expect(player.health.value).toBeGreaterThan(50); expect(player.regenerating).toBe(true);
    advance(player, controls(), 10);
    expect(player.health.value).toBe(100); expect(player.regenerating).toBe(false);
    player.takeDamage(30); advance(player, controls(), 3.8);
    expect(player.health.value).toBe(70);
    advance(player, controls(), 0.4); expect(player.health.value).toBeGreaterThan(70);
  });
  it('奔跑快于步行，开火时回落步行', () => {
    const start = new THREE.Vector3(0,0.04,24);
    const walk = new Player(), run = new Player(), firing = new Player();
    walk.teleport(start); run.teleport(start); firing.teleport(start);
    advance(walk, controls('KeyW'), 1);
    advance(run, controls('KeyW','ShiftLeft'), 1);
    advance(firing, controls('KeyW','ShiftLeft'), 1, true);
    const distance = (player: Player) => Math.hypot(player.feet.x - start.x, player.feet.z - start.z);
    expect(run.sprinting).toBe(true); expect(firing.sprinting).toBe(false);
    expect(distance(run)).toBeGreaterThan(distance(walk) + 1);
    expect(distance(firing)).toBeLessThan(distance(run));
  });
  it('人机头部与身体命中区域可区分', () => {
    const bot = new Bot(0, new THREE.Scene(), new THREE.Vector3(0,0.025,0));
    bot.mesh.updateMatrixWorld(true);
    const rayAt = (y: number) => new THREE.Raycaster(new THREE.Vector3(0,y,5), new THREE.Vector3(0,0,-1));
    expect(rayAt(1.63).intersectObject(bot.mesh,true)[0]?.object.userData.zone).toBe('head');
    expect(rayAt(1.1).intersectObject(bot.mesh,true)[0]?.object.userData.zone).toBeUndefined();
  });
});

describe('实际地图导航与视线', () => {
  it('出生点、两座建筑内部、平台均连接主导航网络', () => {
    const origin = world.nearestNode(world.spawns[0]);
    for (const point of [...world.spawns, new THREE.Vector3(-17,0,-10),new THREE.Vector3(16,0,9),new THREE.Vector3(5,3,-19)]) {
      expect(findPath(world.nodes,origin,world.nearestNode(point)).length).toBeGreaterThan(0);
    }
  });
  it('墙体阻挡视线，开放区域视线通畅', () => {
    expect(world.segmentClear(new THREE.Vector3(-23,1.5,-10),new THREE.Vector3(-17,1.5,-10))).toBe(false);
    expect(world.segmentClear(new THREE.Vector3(0,1.5,24),new THREE.Vector3(0,1.5,18))).toBe(true);
  });
});

describe('人机生命周期与反应', () => {
  it('致命命中后逐渐倒地，三秒后隐藏，尸体不会行动或再次结算击杀', () => {
    const player = new Player(), bot = new Bot(0,new THREE.Scene(),world.spawns[1]);
    const position = bot.position.clone(); const shoot = vi.fn();
    bot.mesh.rotation.y = 1.2;
    expect(bot.hit(100)).toBe(true); expect(bot.mesh.visible).toBe(true);
    expect(bot.mesh.rotation.x).toBe(0);
    bot.update(0.3,world,player,[bot],shoot);
    expect(bot.mesh.rotation.x).toBeGreaterThan(0); expect(bot.mesh.rotation.x).toBeLessThan(Math.PI / 2);
    expect(bot.mesh.rotation.y).toBe(1.2); expect(bot.position.equals(position)).toBe(true);
    bot.update(0.4,world,player,[bot],shoot);
    expect(bot.mesh.rotation.x).toBeCloseTo(Math.PI / 2); expect(bot.mesh.visible).toBe(true);
    const bounds = new THREE.Box3().setFromObject(bot.mesh);
    expect(bounds.min.y).toBeGreaterThanOrEqual(position.y - 0.01);
    expect(bot.hit(100)).toBe(false);
    bot.update(2.29,world,player,[bot],shoot); expect(bot.mesh.visible).toBe(true);
    bot.update(0.02,world,player,[bot],shoot); expect(bot.mesh.visible).toBe(false);
    expect(bot.health.alive).toBe(false); expect(shoot).not.toHaveBeenCalled();
  });

  it('阵亡四秒后重生，恢复模型与血量', () => {
    const player = new Player(), bot = new Bot(0,new THREE.Scene(),world.spawns[1]);
    expect(bot.hit(100)).toBe(true); expect(bot.hit(100)).toBe(false);
    bot.update(3.9,world,player,[bot],()=>{}); expect(bot.health.alive).toBe(false); expect(bot.mesh.visible).toBe(false);
    bot.update(0.11,world,player,[bot],()=>{}); expect(bot.health.value).toBe(100); expect(bot.mesh.visible).toBe(true);
    expect(bot.mesh.rotation.x).toBe(0); expect(bot.mesh.rotation.z).toBe(0);
    expect(bot.mesh.position.equals(bot.position)).toBe(true);
    expect(bot.hit(100)).toBe(true); bot.update(0.3,world,player,[bot],()=>{});
    expect(bot.mesh.visible).toBe(true); expect(bot.mesh.rotation.x).toBeLessThan(Math.PI / 2);
  });
  it('发现玩家后先反应，再按不快于每秒一发的速度射击', () => {
    const player = new Player(), bot = new Bot(0,new THREE.Scene(),new THREE.Vector3(0,0.025,19));
    let shots = 0; const shoot = () => shots++;
    for(let i=0;i<84;i++)bot.update(1/120,world,player,[bot],shoot);
    expect(shots).toBe(0);
    for(let i=0;i<30;i++)bot.update(1/120,world,player,[bot],shoot);
    expect(shots).toBe(1);
    for(let i=0;i<48;i++)bot.update(1/120,world,player,[bot],shoot);
    expect(shots).toBe(1);
  });
});
