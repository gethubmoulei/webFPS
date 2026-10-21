export const PLAYER = { radius: 0.32, height: 1.8, crouchHeight: 1.05, headZone: 0.38, walk: 5, sprint: 8, crouch: 2.5, gravity: 22, jump: Math.sqrt(2 * 22 * 1.2), regenDelay: 4, regenRate: 12 };
export const WEAPON_ORDER = ['rifle', 'pistol', 'sniper', 'shotgun'] as const;
export type WeaponId = typeof WEAPON_ORDER[number];
export type ReloadStyle = 'magazine' | 'shell';
export interface WeaponConfig {
  id: WeaponId; name: string; label: string; damage: number; capacity: number; rate: number;
  reload: number; automatic: boolean; spread: number;
  headshotMultiplier: number; falloffStart: number; falloffEnd: number; minDamageFactor: number;
  range: number; aimFov: number; aimSpreadScale: number; recoil: number; reloadStyle: ReloadStyle;
  pellets?: number; bolt?: number;
}
export const WEAPONS: Record<WeaponId, WeaponConfig> = {
  rifle: {
    id: 'rifle', name: '突击步枪', label: 'AR–07', damage: 20, capacity: 30, rate: 8, reload: 1.6,
    automatic: true, spread: 0.005, headshotMultiplier: 2, falloffStart: 18, falloffEnd: 60, minDamageFactor: 0.55,
    range: 100, aimFov: 58, aimSpreadScale: 0.35, recoil: 0.009, reloadStyle: 'magazine',
  },
  pistol: {
    id: 'pistol', name: '半自动手枪', label: 'P–12', damage: 34, capacity: 12, rate: 3, reload: 1.2,
    automatic: false, spread: 0.002, headshotMultiplier: 2, falloffStart: 10, falloffEnd: 40, minDamageFactor: 0.5,
    range: 80, aimFov: 62, aimSpreadScale: 0.5, recoil: 0.018, reloadStyle: 'magazine',
  },
  sniper: {
    id: 'sniper', name: '栓动狙击枪', label: 'SR–05', damage: 60, capacity: 5, rate: 1, reload: 2.4,
    automatic: false, spread: 0.03, headshotMultiplier: 2, falloffStart: 1000, falloffEnd: 1000, minDamageFactor: 1,
    range: 150, aimFov: 30, aimSpreadScale: 0.03, recoil: 0.06, reloadStyle: 'magazine', bolt: 1.1,
  },
  shotgun: {
    id: 'shotgun', name: '战术霰弹枪', label: 'SG–08', damage: 15, capacity: 8, rate: 1 / 0.6, reload: 0.45,
    automatic: true, spread: 0.075, headshotMultiplier: 2, falloffStart: 8, falloffEnd: 35, minDamageFactor: 0.35,
    range: 45, aimFov: 66, aimSpreadScale: 0.85, recoil: 0.04, reloadStyle: 'shell', pellets: 10,
  },
};
export const BOT = { damage: 8, headshotMultiplier: 1.5 };
export type GamePhase = 'ready' | 'playing' | 'paused';
export type BotMode = 'patrol' | 'chase' | 'attack' | 'search' | 'dead';
export const MOUSE_SENSITIVITY = { min: 0.1, max: 3, step: 0.1, default: 1, sniperAimScale: 0.35 };
export const FIXED_STEP = 1 / 120;
