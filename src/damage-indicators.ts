export const DAMAGE_INDICATOR_LIFE = 1.1;
export const MAX_DAMAGE_MARKS = 6;
export const DAMAGE_SEVERITY_FLOOR = 0.35;
export const DAMAGE_SEVERITY_REFERENCE = 12;
const MERGE_ANGLE = 0.18;

export interface DamageMark { bearing: number; severity: number; life: number; }
export interface DamageShape { halfAngle: number; outerScale: number; alpha: number; }

export function normalizeAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

/** World bearing to an attacker: 0 = +Z, PI/2 = +X. */
export function bearingFromDelta(dx: number, dz: number): number {
  return Math.atan2(dx, dz);
}

/** Screen-space direction: 0 = front, positive = clockwise/right, range [-PI, PI]. */
export function screenAngle(bearing: number, yaw: number): number {
  return normalizeAngle(yaw + Math.PI - bearing);
}

export function damageSeverity(damage: number): number {
  const value = Number.isFinite(damage) ? Math.max(0, damage) : 0;
  return Math.min(1, Math.max(DAMAGE_SEVERITY_FLOOR, value / DAMAGE_SEVERITY_REFERENCE));
}

export function damageShape(severity: number): DamageShape {
  const s = Number.isFinite(severity) ? Math.min(1, Math.max(0, severity)) : 0;
  return {
    halfAngle: (34 - 18 * s) * Math.PI / 180,
    outerScale: 1.18 + 0.4 * s,
    alpha: 0.55 + 0.4 * s,
  };
}

export class DamageIndicators {
  readonly marks: DamageMark[] = [];

  add(bearing: number, damage: number): void {
    const severity = damageSeverity(damage);
    const existing = this.marks.find(mark => Math.abs(normalizeAngle(mark.bearing - bearing)) < MERGE_ANGLE);
    if (existing) {
      existing.bearing = bearing;
      existing.severity = Math.max(existing.severity, severity);
      existing.life = DAMAGE_INDICATOR_LIFE;
      return;
    }
    this.marks.push({ bearing, severity, life: DAMAGE_INDICATOR_LIFE });
    if (this.marks.length > MAX_DAMAGE_MARKS) this.marks.shift();
  }

  update(dt: number): number {
    const step = Math.max(0, dt);
    for (let i = this.marks.length - 1; i >= 0; i--) {
      this.marks[i].life -= step;
      if (this.marks[i].life <= 0) this.marks.splice(i, 1);
    }
    return this.marks.length;
  }

  clear(): void { this.marks.length = 0; }
}
