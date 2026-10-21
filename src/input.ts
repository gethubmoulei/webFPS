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
  onLockChange: (locked: boolean) => void = () => {};
  constructor(readonly canvas: HTMLCanvasElement) {
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
      this.yaw -= e.movementX * 0.002;
      this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch - e.movementY * 0.002));
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
  async lock() { await this.canvas.requestPointerLock(); }
  unlock() { this.clear(); if (this.locked) document.exitPointerLock(); }
  consume(code: string) { const value = this.pressed.has(code); this.pressed.delete(code); return value; }
  clear() { this.keys.clear(); this.pressed.clear(); this.mouseDown = false; this.rightDown = false; this.shotPressed = false; this.wheel = 0; }
}
