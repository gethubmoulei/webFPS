import { describe, expect, it } from 'vitest';
import {
  DAMAGE_INDICATOR_LIFE, DamageIndicators, MAX_DAMAGE_MARKS,
  bearingFromDelta, damageSeverity, damageShape, normalizeAngle, screenAngle,
} from '../src/damage-indicators';

describe('受击方向换算', () => {
  it('世界方位与屏幕方向对应正前、右、后、左', () => {
    expect(bearingFromDelta(0, -1)).toBeCloseTo(Math.PI);
    expect(screenAngle(bearingFromDelta(0, -1), 0)).toBeCloseTo(0);
    expect(screenAngle(bearingFromDelta(1, 0), 0)).toBeCloseTo(Math.PI / 2);
    expect(Math.abs(screenAngle(bearingFromDelta(0, 1), 0))).toBeCloseTo(Math.PI);
    expect(screenAngle(bearingFromDelta(-1, 0), 0)).toBeCloseTo(-Math.PI / 2);
  });
  it('视角旋转后仍指向攻击者的世界方向', () => {
    const yaw = Math.PI / 2;
    expect(screenAngle(bearingFromDelta(-1, 0), yaw)).toBeCloseTo(0);
    expect(screenAngle(bearingFromDelta(0, -1), yaw)).toBeCloseTo(Math.PI / 2);
    expect(screenAngle(bearingFromDelta(1, 0), yaw)).toBeCloseTo(Math.PI);
  });
  it('角度归一化保持在 ±π 内', () => {
    expect(normalizeAngle(Math.PI * 2 + 0.5)).toBeCloseTo(0.5);
    expect(normalizeAngle(-Math.PI * 3)).toBeCloseTo(-Math.PI);
    expect(normalizeAngle(Math.PI * 3)).toBeCloseTo(Math.PI);
  });
});

describe('受击强度与形状', () => {
  it('伤害越高尖锐度越高，且有最小值', () => {
    expect(damageSeverity(0)).toBe(0.35);
    expect(damageSeverity(4)).toBe(0.35);
    expect(damageSeverity(8)).toBeCloseTo(2 / 3);
    expect(damageSeverity(12)).toBe(1);
    expect(damageSeverity(100)).toBe(1);
    expect(damageSeverity(8)).toBeLessThan(damageSeverity(12));
  });
  it('高伤害楔块更窄、更长、更亮', () => {
    const body = damageShape(damageSeverity(8)), head = damageShape(damageSeverity(12));
    expect(head.halfAngle).toBeLessThan(body.halfAngle);
    expect(head.outerScale).toBeGreaterThan(body.outerScale);
    expect(head.alpha).toBeGreaterThan(body.alpha);
  });
});

describe('受击指示生命周期', () => {
  it('同方向合并并刷新，伤害取较高值', () => {
    const indicators = new DamageIndicators();
    indicators.add(0, 8);
    indicators.add(0.05, 12);
    expect(indicators.marks).toHaveLength(1);
    expect(indicators.marks[0].severity).toBe(1);
    indicators.update(1);
    expect(indicators.marks[0].life).toBeCloseTo(DAMAGE_INDICATOR_LIFE - 1);
    indicators.add(0, 8);
    expect(indicators.marks[0].life).toBe(DAMAGE_INDICATOR_LIFE);
  });
  it('不同方向独立显示，寿命结束后移除', () => {
    const indicators = new DamageIndicators();
    indicators.add(0, 8);
    indicators.add(Math.PI, 12);
    expect(indicators.marks).toHaveLength(2);
    indicators.update(1);
    expect(indicators.marks).toHaveLength(2);
    indicators.update(0.2);
    expect(indicators.marks).toHaveLength(0);
  });
  it('最多保留固定数量的方向，超出时丢弃最旧项', () => {
    const indicators = new DamageIndicators();
    for (let i = 0; i < MAX_DAMAGE_MARKS + 2; i++) indicators.add(i * 0.5, 8);
    expect(indicators.marks).toHaveLength(MAX_DAMAGE_MARKS);
    indicators.clear();
    expect(indicators.marks).toHaveLength(0);
  });
});
