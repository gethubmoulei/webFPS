import { MOUSE_SENSITIVITY } from './config';

const SENSITIVITY_STORAGE_KEY = 'range07.mouseSensitivity';

export class Input {
  keys = new Set<string>();
  pressed = new Set<string>();
  mouseDown = false;
  rightDown = false;
  shotPressed = false;
  wheel = 0;
  yaw = 0;
  pitch = 0;
  locked = false;
  sensitivity = MOUSE_SENSITIVITY.default;
  onLockChange: (locked: boolean) => void = () => {};
  constructor(readonly canvas: HTMLCanvasElement, private readonly isScoped: () => boolean = () => false) {
    try {
      const saved = Number(localStorage.getItem(SENSITIVITY_STORAGE_KEY) ?? NaN);
      if (Number.isFinite(saved) && saved >= MOUSE_SENSITIVITY.min && saved <= MOUSE_SENSITIVITY.max) this.sensitivity = saved;
    } catch { /* 本地存储不可用时保留默认值。 */ }
    document.addEventListener('keydown', e => {
      if (!this.locked) return;
      if (e.code === 'Escape') { this.unlock(); return; }
      if (['Space', 'Tab', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyC', 'KeyR'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    document.addEventListener('keyup', e => this.keys.delete(e.code));
    document.addEventListener('mousemove', e => {
      if (!this.locked) return;
      const speed = 0.002 * this.sensitivity * (this.isScoped() ? MOUSE_SENSITIVITY.sniperAimScale : 1);
      this.yaw -= e.movementX * speed;
      this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch - e.movementY * speed));
    });
    document.addEventListener('mousedown', e => {
      if (!this.locked) return;
      if (e.button === 0) { this.mouseDown = true; this.shotPressed = true; }
      else if (e.button === 2) this.rightDown = true;
    });
    document.addEventListener('mouseup', e => {
      if (e.button === 0) this.mouseDown = false;
      else if (e.button === 2) this.rightDown = false;
    });
    canvas.addEventListener('wheel', e => { if (this.locked) { e.preventDefault(); this.wheel += Math.sign(e.deltaY); } }, { passive: false });
    document.addEventListener('contextmenu', e => { if (this.locked) e.preventDefault(); });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      this.clear(); this.onLockChange(this.locked);
    });
    window.addEventListener('blur', () => this.unlock());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.unlock(); });
  }
  async lock() {
    try {
      // 优先使用原始相对位移，避免系统鼠标加速影响转向。
      await this.canvas.requestPointerLock({ unadjustedMovement: true });
    } catch (error) {
      if (!(error instanceof DOMException) || error.name !== 'NotSupportedError') throw error;
      await this.canvas.requestPointerLock();
    }
  }
  setSensitivity(value: number) {
    if (!Number.isFinite(value)) return;
    this.sensitivity = Math.max(MOUSE_SENSITIVITY.min, Math.min(MOUSE_SENSITIVITY.max, value));
    try { localStorage.setItem(SENSITIVITY_STORAGE_KEY, String(this.sensitivity)); }
    catch { /* 本地存储不可用时仍允许本次调节。 */ }
  }
  unlock() { this.clear(); if (this.locked) document.exitPointerLock(); }
  consume(code: string) { const value = this.pressed.has(code); this.pressed.delete(code); return value; }
  clear() { this.keys.clear(); this.pressed.clear(); this.mouseDown = false; this.rightDown = false; this.shotPressed = false; this.wheel = 0; }
}
