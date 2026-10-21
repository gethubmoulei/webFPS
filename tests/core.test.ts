import { describe, expect, it } from 'vitest';
import { Arsenal, Health, damageFalloff, isHeadshotHeight, resolveShotDamage } from '../src/combat';
import { WEAPONS } from '../src/config';
import { findPath, type NavNode } from '../src/navigation';

describe('伤害与死亡', () => {
  it('伤害扣血，致命伤只结算一次', () => {
    const health = new Health();
    expect(health.damage(34)).toBe(false); expect(health.value).toBe(66);
    expect(health.damage(100)).toBe(true); expect(health.value).toBe(0);
    expect(health.damage(20)).toBe(false);
    health.reset(); expect(health.alive).toBe(true); expect(health.value).toBe(100);
  });
  it('负伤害不回血', () => { const health = new Health(); health.damage(-20); expect(health.value).toBe(100); });
  it('脱战延迟后按速率回血，回满即止', () => {
    const health = new Health(); health.damage(40); expect(health.value).toBe(60);
    expect(health.regen(3.9, 4, 12)).toBe(0); expect(health.value).toBe(60);
    expect(health.regen(0.2, 4, 12)).toBeCloseTo(2.4);
    expect(health.value).toBeCloseTo(62.4);
    health.regen(10, 4, 12); expect(health.value).toBe(100);
    expect(health.regen(1, 4, 12)).toBe(0);
  });
  it('再次受伤重置回血计时，死亡与零伤害不触发回血', () => {
    const health = new Health(); health.damage(20); health.regen(2, 4, 12);
    health.damage(0); health.damage(-5); expect(health.sinceDamage).toBe(2);
    health.damage(10); expect(health.sinceDamage).toBe(0);
    health.damage(100); health.regen(10, 4, 12); expect(health.value).toBe(0);
    health.reset(); expect(health.value).toBe(100); expect(health.sinceDamage).toBe(0);
  });
});
describe('爆头与距离衰减', () => {
  it('近距离不衰减，中远距离线性下降并在终点封底', () => {
    const rifle = WEAPONS.rifle;
    expect(damageFalloff(rifle, 0)).toBe(1);
    expect(damageFalloff(rifle, 18)).toBe(1);
    expect(damageFalloff(rifle, 39)).toBeCloseTo(0.775);
    expect(damageFalloff(rifle, 60)).toBeCloseTo(0.55);
    expect(damageFalloff(rifle, 100)).toBeCloseTo(0.55);
    expect(resolveShotDamage(rifle, 39).damage).toBe(16);
    expect(resolveShotDamage(rifle, 100).damage).toBe(11);
  });
  it('爆头按倍率结算，且与距离衰减叠加', () => {
    expect(resolveShotDamage(WEAPONS.rifle, 10, 'head')).toMatchObject({ damage: 40, headshot: true });
    expect(resolveShotDamage(WEAPONS.rifle, 39, 'head')).toMatchObject({ damage: 31, headshot: true });
    expect(resolveShotDamage(WEAPONS.pistol, 10, 'head').damage).toBe(68);
    expect(resolveShotDamage(WEAPONS.pistol, 25, 'head').damage).toBe(51);
    expect(resolveShotDamage(WEAPONS.rifle, 39, 'body')).toMatchObject({ damage: 16, headshot: false });
  });
  it('衰减伤害最低为 1', () => {
    const weak = { ...WEAPONS.rifle, damage: 0.4 };
    expect(resolveShotDamage(weak, 100).damage).toBe(1);
  });
  it('站立与下蹲使用不同的爆头高度阈值', () => {
    expect(isHeadshotHeight(1.41, false)).toBe(false);
    expect(isHeadshotHeight(1.42, false)).toBe(true);
    expect(isHeadshotHeight(0.66, true)).toBe(false);
    expect(isHeadshotHeight(0.67, true)).toBe(true);
  });
});
describe('武器弹药与时序', () => {
  it('射速限制与空弹匣阻止射击', () => {
    const arsenal = new Arsenal();
    expect(arsenal.fire()).toBe(true); expect(arsenal.fire()).toBe(false);
    for (let i = 1; i < 30; i++) { arsenal.update(0.125); expect(arsenal.fire()).toBe(true); }
    arsenal.update(1); expect(arsenal.ammo.rifle).toBe(0); expect(arsenal.fire()).toBe(false);
  });
  it('换弹完成前不能射击，完成后恢复弹匣', () => {
    const arsenal = new Arsenal(); arsenal.fire(); arsenal.reload();
    arsenal.update(1.5); expect(arsenal.fire()).toBe(false); expect(arsenal.ammo.rifle).toBe(29);
    arsenal.update(0.11); expect(arsenal.ammo.rifle).toBe(30); expect(arsenal.fire()).toBe(true);
  });
  it('切枪取消换弹但保留各自弹药', () => {
    const arsenal = new Arsenal(); arsenal.fire(); arsenal.reload(); arsenal.update(0.5);
    arsenal.switchTo('pistol'); expect(arsenal.reloading).toBe(false);
    arsenal.update(0.3); arsenal.fire(); expect(arsenal.ammo.pistol).toBe(11);
    arsenal.update(5); arsenal.switchTo('rifle'); expect(arsenal.ammo.rifle).toBe(29);
    arsenal.reset(); expect(arsenal.ammo).toEqual({rifle:30,pistol:12,sniper:5,shotgun:8});
  });
  it('满弹匣不换弹，重复换弹不会延长计时', () => {
    const arsenal = new Arsenal(); expect(arsenal.reload()).toBe(false);
    arsenal.fire(); arsenal.reload(); arsenal.update(0.5); expect(arsenal.reload()).toBe(false);
    expect(arsenal.reloadRemaining).toBeCloseTo(1.1);
  });
});
describe('A* 绕障导航', () => {
  const nodes: NavNode[] = [
    {id:0,x:0,y:0,z:0,neighbors:[1]}, {id:1,x:0,y:0,z:2,neighbors:[0,2]},
    {id:2,x:2,y:0,z:2,neighbors:[1,3]}, {id:3,x:2,y:0,z:0,neighbors:[2]},
    {id:4,x:8,y:0,z:0,neighbors:[]},
  ];
  it('使用可达邻接边绕行，不直接穿过障碍', () => { expect(findPath(nodes,0,3)).toEqual([0,1,2,3]); });
  it('不可达、原地和无效节点均有确定结果', () => {
    expect(findPath(nodes,0,4)).toEqual([]); expect(findPath(nodes,0,0)).toEqual([0]); expect(findPath(nodes,0,99)).toEqual([]);
  });
});
