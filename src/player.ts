import * as THREE from 'three';
import { PLAYER } from './config';
import { Health, MAX_HEALTH } from './combat';
import { capsuleAt, type World } from './world';
import type { Input } from './input';

export class Player {
  health = new Health();
  collider = capsuleAt(new THREE.Vector3(0, 0.03, 24));
  velocity = new THREE.Vector3();
  grounded = true;
  crouched = false;
  sprinting = false;
  protection = 2;
  respawnRemaining = 0;
  damageFlash = 0;
  moving = false;
  private groundProbe = new THREE.Raycaster();
  get feet() { return this.collider.start.clone().add(new THREE.Vector3(0, -PLAYER.radius, 0)); }
  get eye() { return this.feet.add(new THREE.Vector3(0, (this.crouched ? PLAYER.crouchHeight : PLAYER.height) - 0.12, 0)); }
  get regenDelayRemaining() { return Math.max(0, PLAYER.regenDelay - this.health.sinceDamage); }
  get regenerating() { return this.health.alive && this.health.value < MAX_HEALTH && this.health.sinceDamage >= PLAYER.regenDelay; }
  update(dt: number, input: Input, world: World, firing: boolean) {
    this.damageFlash = Math.max(0, this.damageFlash - dt * 1.8);
    this.protection = Math.max(0, this.protection - dt);
    if (!this.health.alive) { this.respawnRemaining -= dt; return; }
    this.health.regen(dt, PLAYER.regenDelay, PLAYER.regenRate);
    const wantsCrouch = input.keys.has('KeyC');
    if (wantsCrouch !== this.crouched) {
      const height = wantsCrouch ? PLAYER.crouchHeight : PLAYER.height;
      if (wantsCrouch || world.clearAt(this.feet, height)) {
        this.collider = capsuleAt(this.feet, height); this.crouched = wantsCrouch;
      }
    }
    const direction = new THREE.Vector3(Number(input.keys.has('KeyD')) - Number(input.keys.has('KeyA')), 0, Number(input.keys.has('KeyS')) - Number(input.keys.has('KeyW')));
    this.moving = direction.lengthSq() > 0;
    if (this.moving) direction.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), input.yaw);
    this.sprinting = (input.keys.has('ShiftLeft') || input.keys.has('ShiftRight')) && !this.crouched && !firing && this.moving;
    const speed = this.crouched ? PLAYER.crouch : this.sprinting ? PLAYER.sprint : PLAYER.walk;
    const smoothing = 1 - Math.exp(-dt * (this.grounded ? 20 : 7));
    this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, direction.x * speed, smoothing);
    this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, direction.z * speed, smoothing);
    if (input.consume('Space') && this.grounded && !this.crouched) { this.velocity.y = PLAYER.jump; this.grounded = false; }
    this.velocity.y -= PLAYER.gravity * dt;
    this.collider.translate(this.velocity.clone().multiplyScalar(dt));
    this.grounded = false;
    for (let i = 0; i < 4; i++) {
      const hit = world.octree.capsuleIntersect(this.collider); if (!hit) break;
      if (hit.normal.y > 0.65) this.grounded = true;
      const into = this.velocity.dot(hit.normal);
      if (into < 0) this.velocity.addScaledVector(hit.normal, -into);
      this.collider.translate(hit.normal.clone().multiplyScalar(hit.depth + 0.00001));
    }
    // Octree merges wall and floor contacts; a short foot probe preserves grounding at corners.
    if (!this.grounded && this.velocity.y <= 0.05) {
      this.groundProbe.set(this.feet.add(new THREE.Vector3(0, 0.06, 0)), new THREE.Vector3(0, -1, 0));
      this.groundProbe.far = 0.075;
      const support = this.groundProbe.intersectObjects(world.solids.children, false)[0];
      if (support?.face && support.face.normal.clone().transformDirection(support.object.matrixWorld).y > 0.65) {
        this.grounded = true; this.velocity.y = 0;
      }
    }
    if (this.grounded) this.velocity.y = Math.max(0, this.velocity.y);
    const feet = this.feet;
    if (feet.y < -8 || Math.abs(feet.x) > 32 || Math.abs(feet.z) > 32) this.teleport(world.spawns[0]);
  }
  takeDamage(amount: number) {
    if (this.protection > 0 || !this.health.alive) return false;
    this.damageFlash = 0.8;
    const died = this.health.damage(amount);
    if (died) { this.respawnRemaining = 3; this.velocity.set(0, 0, 0); }
    return died;
  }
  teleport(point: THREE.Vector3) { this.collider = capsuleAt(point); this.velocity.set(0,0,0); this.crouched = false; this.grounded = false; }
  respawn(point: THREE.Vector3) { this.teleport(point); this.health.reset(); this.protection = 2; this.respawnRemaining = 0; }
}
