import { PLAYER, WEAPON_ORDER, WEAPONS, type WeaponConfig, type WeaponId } from './config';

export const MAX_HEALTH = 100;
export type HitZone = 'body' | 'head';
export interface ShotDamage { damage: number; falloff: number; headshot: boolean; distance: number; }

export class Health {
  value = MAX_HEALTH;
  sinceDamage = 0;
  get alive() { return this.value > 0; }
  damage(amount: number): boolean {
    if (!this.alive) return false;
    const applied = Math.max(0, amount);
    if (applied === 0) return false;
    this.sinceDamage = 0;
    this.value = Math.max(0, this.value - applied);
    return !this.alive;
  }
  /** Regenerates only after `delay` seconds without damage; returns health restored. */
  regen(dt: number, delay: number, rate: number): number {
    this.sinceDamage += Math.max(0, dt);
    if (!this.alive || this.value >= MAX_HEALTH || this.sinceDamage < delay) return 0;
    const before = this.value;
    this.value = Math.min(MAX_HEALTH, this.value + Math.max(0, rate) * Math.max(0, dt));
    return this.value - before;
  }
  reset() { this.value = MAX_HEALTH; this.sinceDamage = 0; }
}

export function damageFalloff(weapon: WeaponConfig, distance: number): number {
  const d = Number.isFinite(distance) ? Math.max(0, distance) : 0;
  if (d <= weapon.falloffStart) return 1;
  const span = Math.max(0.001, weapon.falloffEnd - weapon.falloffStart);
  const t = Math.min(1, (d - weapon.falloffStart) / span);
  const min = Math.min(1, Math.max(0, weapon.minDamageFactor));
  return 1 - t * (1 - min);
}

export function resolveShotDamage(weapon: WeaponConfig, distance: number, zone: HitZone = 'body'): ShotDamage {
  const d = Number.isFinite(distance) ? Math.max(0, distance) : 0;
  const falloff = damageFalloff(weapon, d);
  const headshot = zone === 'head';
  const multiplier = headshot ? Math.max(1, weapon.headshotMultiplier) : 1;
  return { damage: Math.max(1, Math.round(weapon.damage * falloff * multiplier)), falloff, headshot, distance: d };
}

export interface SpreadState { moving: boolean; crouched: boolean; aiming: boolean; }

export function shotSpread(weapon: WeaponConfig, state: SpreadState): number {
  const base = Math.max(0, weapon.spread);
  return base
    * (state.moving ? 1.8 : 1)
    * (state.crouched ? 0.65 : 1)
    * (state.aiming ? weapon.aimSpreadScale : 1);
}

export function isHeadshotHeight(heightAboveFeet: number, crouched: boolean): boolean {
  return heightAboveFeet >= (crouched ? PLAYER.crouchHeight : PLAYER.height) - PLAYER.headZone;
}

function fullAmmo(): Record<WeaponId, number> {
  return {
    rifle: WEAPONS.rifle.capacity, pistol: WEAPONS.pistol.capacity,
    sniper: WEAPONS.sniper.capacity, shotgun: WEAPONS.shotgun.capacity,
  };
}

export class Arsenal {
  selected: WeaponId = 'rifle';
  ammo: Record<WeaponId, number> = fullAmmo();
  cooldown = 0;
  reloadRemaining = 0;
  boltRemaining = 0;
  get config() { return WEAPONS[this.selected]; }
  get reloading() { return this.reloadRemaining > 0; }
  switchTo(id: WeaponId) {
    if (id === this.selected) return;
    this.selected = id;
    this.reloadRemaining = 0;
    this.cooldown = Math.max(this.cooldown, 0.22);
  }
  cycle(direction: number) {
    if (!direction) return;
    const index = WEAPON_ORDER.indexOf(this.selected);
    const next = WEAPON_ORDER[(index + Math.sign(direction) + WEAPON_ORDER.length) % WEAPON_ORDER.length];
    this.switchTo(next);
  }
  reload() {
    if (this.reloading || this.ammo[this.selected] >= this.config.capacity) return false;
    this.reloadRemaining = this.config.reload;
    return true;
  }
  update(dt: number) {
    const step = Math.max(0, dt);
    this.cooldown = Math.max(0, this.cooldown - step);
    this.boltRemaining = Math.max(0, this.boltRemaining - step);
    if (this.reloading) {
      this.reloadRemaining -= step;
      if (this.config.reloadStyle === 'shell') {
        while (this.reloadRemaining <= 0 && this.ammo[this.selected] < this.config.capacity) {
          this.ammo[this.selected]++;
          this.reloadRemaining = this.ammo[this.selected] >= this.config.capacity ? 0 : this.reloadRemaining + this.config.reload;
        }
        if (this.reloadRemaining < 0) this.reloadRemaining = 0;
      } else if (this.reloadRemaining <= 0) {
        this.ammo[this.selected] = this.config.capacity;
        this.reloadRemaining = 0;
      }
    }
    if (!this.reloading && this.ammo[this.selected] === 0) this.reload();
  }
  fire() {
    const config = this.config;
    if (this.cooldown > 0 || this.ammo[this.selected] <= 0) return false;
    if (this.reloading) {
      if (config.reloadStyle !== 'shell') return false;
      this.reloadRemaining = 0;
    }
    if (config.bolt && this.boltRemaining > 0) return false;
    this.ammo[this.selected]--;
    this.cooldown = 1 / config.rate;
    if (config.bolt) this.boltRemaining = config.bolt;
    if (this.ammo[this.selected] === 0) this.reload();
    return true;
  }
  reset() { this.ammo = fullAmmo(); this.cooldown = 0; this.reloadRemaining = 0; this.boltRemaining = 0; }
}
