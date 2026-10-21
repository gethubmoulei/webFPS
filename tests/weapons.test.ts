import { describe, expect, it } from 'vitest';
import { Arsenal, resolveShotDamage, shotSpread } from '../src/combat';
import { WEAPONS, WEAPON_ORDER } from '../src/config';

describe('四把武器与切换', () => {
  it('按固定顺序循环，并保留各自弹药', () => {
    const arsenal = new Arsenal();
    expect(WEAPON_ORDER).toEqual(['rifle', 'pistol', 'sniper', 'shotgun']);
    expect(arsenal.ammo).toEqual({ rifle: 30, pistol: 12, sniper: 5, shotgun: 8 });
    arsenal.cycle(1); expect(arsenal.selected).toBe('pistol');
    arsenal.cycle(1); expect(arsenal.selected).toBe('sniper');
    arsenal.cycle(1); expect(arsenal.selected).toBe('shotgun');
    arsenal.cycle(1); expect(arsenal.selected).toBe('rifle');
    arsenal.cycle(-1); expect(arsenal.selected).toBe('shotgun');
    arsenal.reset(); expect(arsenal.ammo).toEqual({ rifle: 30, pistol: 12, sniper: 5, shotgun: 8 });
    expect(arsenal.boltRemaining).toBe(0); expect(arsenal.selected).toBe('shotgun');
  });
  it('四把武器均有有效瞄准参数，狙击枪倍率最强', () => {
    for (const id of WEAPON_ORDER) {
      expect(WEAPONS[id].aimFov).toBeGreaterThan(0);
      expect(WEAPONS[id].aimFov).toBeLessThan(75);
      expect(WEAPONS[id].aimSpreadScale).toBeGreaterThan(0);
      expect(WEAPONS[id].aimSpreadScale).toBeLessThan(1);
    }
    expect(WEAPONS.sniper.aimFov).toBeLessThan(WEAPONS.rifle.aimFov);
    expect(WEAPONS.sniper.aimSpreadScale).toBeLessThan(WEAPONS.rifle.aimSpreadScale);
  });
});

describe('散布', () => {
  it('狙击枪腰射随机、开镜收束，所有武器瞄准都会降低散布', () => {
    const idle = { moving: false, crouched: false, aiming: false };
    const moving = { moving: true, crouched: false, aiming: false };
    const aimed = { moving: false, crouched: false, aiming: true };
    const sniperHip = shotSpread(WEAPONS.sniper, idle), sniperAim = shotSpread(WEAPONS.sniper, aimed);
    expect(sniperHip).toBeCloseTo(0.03);
    expect(sniperAim).toBeCloseTo(0.0009);
    expect(sniperHip).toBeGreaterThan(0.01);
    expect(sniperAim).toBeLessThan(0.002);
    expect(shotSpread(WEAPONS.shotgun, aimed)).toBeLessThan(shotSpread(WEAPONS.shotgun, idle));
    expect(shotSpread(WEAPONS.rifle, moving)).toBeGreaterThan(shotSpread(WEAPONS.rifle, idle));
    for (const id of WEAPON_ORDER) expect(shotSpread(WEAPONS[id], aimed)).toBeLessThan(shotSpread(WEAPONS[id], idle));
  });
});

describe('狙击枪', () => {
  it('身体 60、爆头 120，且不受距离衰减', () => {
    expect(resolveShotDamage(WEAPONS.sniper, 5, 'body').damage).toBe(60);
    expect(resolveShotDamage(WEAPONS.sniper, 5, 'head').damage).toBe(120);
    expect(resolveShotDamage(WEAPONS.sniper, 140, 'body').damage).toBe(60);
    expect(resolveShotDamage(WEAPONS.sniper, 140, 'head').damage).toBe(120);
  });
  it('每发之后拉栓，拉栓完成前无法再次开火', () => {
    const arsenal = new Arsenal(); arsenal.switchTo('sniper'); arsenal.update(0.22);
    expect(arsenal.fire()).toBe(true); expect(arsenal.ammo.sniper).toBe(4);
    expect(arsenal.boltRemaining).toBeCloseTo(1.1);
    expect(arsenal.fire()).toBe(false);
    arsenal.update(1); expect(arsenal.fire()).toBe(false);
    arsenal.update(0.11); expect(arsenal.fire()).toBe(true); expect(arsenal.ammo.sniper).toBe(3);
  });
  it('打空后自动换弹，切枪可打断', () => {
    const arsenal = new Arsenal(); arsenal.switchTo('sniper'); arsenal.update(0.22);
    for (let i = 0; i < 5; i++) { if (i > 0) arsenal.update(1.12); expect(arsenal.fire()).toBe(true); }
    expect(arsenal.ammo.sniper).toBe(0); expect(arsenal.reloading).toBe(true);
    arsenal.switchTo('rifle'); expect(arsenal.reloading).toBe(false); expect(arsenal.ammo.sniper).toBe(0);
  });
});

describe('霰弹枪', () => {
  it('每发 10 弹丸，身体 15 / 爆头 30，0.6 秒射击间隔', () => {
    expect(WEAPONS.shotgun.pellets).toBe(10);
    expect(resolveShotDamage(WEAPONS.shotgun, 8, 'body').damage).toBe(15);
    expect(resolveShotDamage(WEAPONS.shotgun, 8, 'head').damage).toBe(30);
    const arsenal = new Arsenal(); arsenal.switchTo('shotgun'); arsenal.update(0.22);
    expect(arsenal.fire()).toBe(true); expect(arsenal.ammo.shotgun).toBe(7);
    expect(arsenal.fire()).toBe(false);
    arsenal.update(0.59); expect(arsenal.fire()).toBe(false);
    arsenal.update(0.02); expect(arsenal.fire()).toBe(true); expect(arsenal.ammo.shotgun).toBe(6);
  });
  it('空弹后自动逐发装填，切换武器取消但保留已装弹药', () => {
    const arsenal = new Arsenal(); arsenal.switchTo('shotgun'); arsenal.update(0.22);
    for (let i = 0; i < 8; i++) { if (i > 0) arsenal.update(0.61); expect(arsenal.fire()).toBe(true); }
    expect(arsenal.ammo.shotgun).toBe(0); expect(arsenal.reloading).toBe(true);
    arsenal.update(0.45); expect(arsenal.ammo.shotgun).toBe(1); expect(arsenal.reloading).toBe(true);
    arsenal.update(0.45); expect(arsenal.ammo.shotgun).toBe(2);
    arsenal.switchTo('rifle'); expect(arsenal.reloading).toBe(false); expect(arsenal.ammo.shotgun).toBe(2);
    arsenal.switchTo('shotgun'); arsenal.update(0.01);
    expect(arsenal.reloading).toBe(false); expect(arsenal.ammo.shotgun).toBe(2);
  });
  it('一次性留足时间可逐发装满并自动停止', () => {
    const arsenal = new Arsenal(); arsenal.switchTo('shotgun');
    arsenal.ammo.shotgun = 0; expect(arsenal.reload()).toBe(true);
    arsenal.update(0.45 * 8 + 0.1);
    expect(arsenal.ammo.shotgun).toBe(8); expect(arsenal.reloading).toBe(false);
  });
  it('装填中开火会打断装填，保留原剩余与已装填弹药', () => {
    const arsenal = new Arsenal(); arsenal.switchTo('shotgun'); arsenal.update(0.22);
    arsenal.ammo.shotgun = 3;
    expect(arsenal.reload()).toBe(true);
    arsenal.update(0.45);
    expect(arsenal.ammo.shotgun).toBe(4);
    expect(arsenal.fire()).toBe(true);
    expect(arsenal.reloading).toBe(false);
    expect(arsenal.ammo.shotgun).toBe(3);
  });
  it('没有已装填弹药时开火不会打断装填', () => {
    const arsenal = new Arsenal(); arsenal.switchTo('shotgun'); arsenal.update(0.22);
    arsenal.ammo.shotgun = 0; expect(arsenal.reload()).toBe(true);
    expect(arsenal.fire()).toBe(false);
    expect(arsenal.reloading).toBe(true);
    arsenal.update(0.45);
    expect(arsenal.ammo.shotgun).toBe(1);
    expect(arsenal.fire()).toBe(true);
    expect(arsenal.ammo.shotgun).toBe(0);
    expect(arsenal.reloading).toBe(true);
  });
  it('距离越远伤害越低', () => {
    expect(resolveShotDamage(WEAPONS.shotgun, 20, 'body').damage).toBe(11);
    expect(resolveShotDamage(WEAPONS.shotgun, 20, 'head').damage).toBe(21);
    expect(resolveShotDamage(WEAPONS.shotgun, 35, 'body').damage).toBe(5);
    expect(resolveShotDamage(WEAPONS.shotgun, 35, 'head').damage).toBe(11);
    expect(resolveShotDamage(WEAPONS.shotgun, 100, 'body').damage).toBe(5);
  });
});

describe('自动换弹', () => {
  it('步枪打空自动换弹，切枪打断后切回会重新开始', () => {
    const arsenal = new Arsenal();
    for (let i = 0; i < 30; i++) { expect(arsenal.fire()).toBe(true); arsenal.update(0.13); }
    expect(arsenal.ammo.rifle).toBe(0); expect(arsenal.reloading).toBe(true);
    arsenal.switchTo('pistol'); expect(arsenal.reloading).toBe(false); expect(arsenal.ammo.rifle).toBe(0);
    arsenal.switchTo('rifle'); arsenal.update(0.01);
    expect(arsenal.reloading).toBe(true);
  });
});
