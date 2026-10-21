import * as THREE from 'three';
import { Health } from './combat';
import type { BotMode } from './config';
import { findPath } from './navigation';
import { box, capsuleAt, type World, materials } from './world';
import type { Player } from './player';

const red = new THREE.MeshStandardMaterial({ color: 0xa34737, roughness: 0.85 });
const armor = new THREE.MeshStandardMaterial({ color: 0x5f332d, roughness: 0.8 });
const visor = new THREE.MeshStandardMaterial({ color: 0xf9bd76, emissive: 0xb96722, emissiveIntensity: 0.35, roughness: 0.25 });
const FALL_DURATION = 0.15;
const CORPSE_LIFETIME = 3;
export class Bot {
  health = new Health();
  mesh = new THREE.Group();
  legs: THREE.Mesh[] = [];
  private arms: THREE.Mesh[] = [];
  private marker: THREE.Mesh;
  private deathTime = 0;
  mode: BotMode = 'patrol';
  position: THREE.Vector3;
  path: number[] = [];
  repath = 0;
  reaction = 0;
  shotCooldown = 0;
  respawnRemaining = 0;
  lastSeen: THREE.Vector3 | null = null;
  searchRemaining = 0;
  walkTime = 0;
  hitFlash = 0;
  constructor(readonly id: number, scene: THREE.Scene, spawn: THREE.Vector3) {
    this.position = spawn.clone();
    this.mesh.rotation.order = 'YXZ';
    box(this.mesh, [0.56, 0.65, 0.34], [0, 1.1, 0], red);
    box(this.mesh, [0.46, 0.4, 0.09], [0, 1.14, -0.21], armor);
    const head = box(this.mesh, [0.38, 0.36, 0.38], [0, 1.63, 0], red);
    head.userData.zone = 'head';
    const face = box(this.mesh, [0.3, 0.105, 0.03], [0, 1.65, -0.205], visor);
    face.userData.zone = 'head';
    for (const x of [-0.17, 0.17]) this.legs.push(box(this.mesh, [0.21, 0.7, 0.24], [x, 0.42, 0], materials.black));
    for (const x of [-0.38, 0.38]) {
      const arm = box(this.mesh, [0.18, 0.58, 0.22], [x, 1.04, -0.08], red); arm.rotation.x = -0.35;
      this.arms.push(arm);
    }
    box(this.mesh, [0.13, 0.15, 0.66], [0.28, 1.14, -0.45], materials.black);
    const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), new THREE.MeshBasicMaterial({ color: 0xf3b29a }));
    marker.position.y = 2.08; marker.raycast = () => {}; this.mesh.add(marker);
    this.marker = marker;
    this.mesh.traverse(object => { object.userData.bot = id; });
    this.mesh.position.copy(this.position); scene.add(this.mesh);
  }
  get eye() { return this.position.clone().add(new THREE.Vector3(0, 1.6, 0)); }
  hit(damage: number) {
    if (!this.health.alive) return false;
    this.hitFlash = 0.12;
    const dead = this.health.damage(damage);
    if (dead) {
      this.mode = 'dead'; this.deathTime = 0; this.respawnRemaining = 4; this.path = [];
      this.marker.visible = false;
      this.legs.forEach(leg => leg.rotation.x = 0);
    }
    return dead;
  }
  update(dt: number, world: World, player: Player, bots: Bot[], shoot: (origin: THREE.Vector3, target: THREE.Vector3) => void) {
    if (!this.health.alive) {
      this.respawnRemaining -= dt;
      this.deathTime += dt;
      const t = Math.min(this.deathTime / FALL_DURATION, 1);
      const fall = t * t * (3 - 2 * t);
      this.mesh.rotation.x = fall * Math.PI / 2;
      // 倒地后略微抬高模型，使身体贴地而不陷入地面。
      this.mesh.position.copy(this.position).y += Math.sin(this.mesh.rotation.x) * 0.22;
      this.arms.forEach((arm, i) => {
        arm.rotation.x = -0.35 * (1 - fall);
        arm.rotation.z = (i === 0 ? 1 : -1) * fall * 0.35;
      });
      this.mesh.visible = this.deathTime < CORPSE_LIFETIME;
      if (this.respawnRemaining <= 0) {
        this.position.copy(world.safestSpawn([player.feet, ...bots.filter(b => b !== this && b.health.alive).map(b => b.position)]));
        this.health.reset(); this.mesh.visible = true; this.mode = 'patrol'; this.reaction = 0; this.lastSeen = null; this.repath = 0;
        this.deathTime = 0; this.mesh.rotation.x = 0; this.mesh.rotation.z = 0; this.marker.visible = true;
        this.arms.forEach(arm => { arm.rotation.x = -0.35; arm.rotation.z = 0; });
        this.mesh.position.copy(this.position);
      }
      this.mesh.updateMatrixWorld(true);
      return;
    }
    this.shotCooldown = Math.max(0, this.shotCooldown - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    const distance = this.position.distanceTo(player.feet);
    const canSee = player.health.alive && distance < 25 && world.segmentClear(this.eye, player.eye);
    if (canSee) {
      this.lastSeen = player.feet.clone(); this.searchRemaining = 5;
      this.reaction += dt;
      this.mode = distance < 17 ? 'attack' : 'chase';
      if (this.reaction >= 0.8 && this.shotCooldown === 0) {
        this.shotCooldown = 1 + Math.random() * 0.35;
        const aim = player.feet.add(new THREE.Vector3(0, player.crouched ? 0.65 : 1.1, 0));
        aim.x += (Math.random() - 0.5) * (0.6 + distance * 0.055);
        aim.y += (Math.random() - 0.5) * (0.5 + distance * 0.035);
        shoot(this.eye, aim);
      }
    } else {
      this.reaction = 0; this.searchRemaining -= dt;
      this.mode = this.lastSeen && this.searchRemaining > 0 ? 'search' : 'patrol';
    }
    this.repath -= dt;
    if (this.repath <= 0) {
      this.repath = 0.8 + this.id * 0.07;
      const start = world.nearestNode(this.position);
      if (this.mode === 'chase' || this.mode === 'search') {
        this.path = findPath(world.nodes, start, world.nearestNode(this.lastSeen!)).slice(1);
      } else if (this.mode === 'attack') {
        // Short navigable sidesteps keep the target moving without sliding through cover.
        const options = world.nodes[start].neighbors.filter(id => {
          const n = world.nodes[id]; return Math.hypot(n.x - player.feet.x, n.z - player.feet.z) > 6;
        });
        if (this.path.length === 0 && options.length) this.path = [options[Math.floor(Math.random() * options.length)]];
      } else if (!this.path.length) {
        const target = Math.floor(Math.random() * world.nodes.length);
        this.path = findPath(world.nodes, start, target).slice(1);
      }
    }
    let moved = false;
    if (this.path.length) {
      const n = world.nodes[this.path[0]];
      const delta = new THREE.Vector3(n.x - this.position.x, 0, n.z - this.position.z);
      if (delta.length() < 0.14) this.path.shift();
      else {
        const step = delta.normalize().multiplyScalar(Math.min(this.mode === 'attack' ? 1.2 * dt : 2.5 * dt, this.position.distanceTo(new THREE.Vector3(n.x,n.y,n.z))));
        const next = this.position.clone().add(step); next.y = world.groundHeight(next.x, next.z) + 0.025;
        // Keep agents separated, and validate every step against actual geometry.
        const occupied = bots.some(b => b !== this && b.health.alive && b.position.distanceTo(next) < 0.65);
        if (!occupied && world.clearAt(next)) { this.position.copy(next); moved = true; }
        else { this.path = []; this.repath = 0; }
        if (!canSee) this.mesh.rotation.y = Math.atan2(-delta.x, -delta.z);
      }
    }
    if (canSee) this.mesh.rotation.y = Math.atan2(this.position.x - player.feet.x, this.position.z - player.feet.z);
    this.walkTime += moved ? dt * 9 : 0;
    this.legs.forEach((leg, index) => leg.rotation.x = moved ? Math.sin(this.walkTime + index * Math.PI) * 0.35 : 0);
    this.mesh.position.copy(this.position);
    this.mesh.updateMatrixWorld(true);
  }
  intersectsRay(ray: THREE.Ray) {
    const body = capsuleAt(this.position);
    const pointOnRay = new THREE.Vector3(), pointOnSegment = new THREE.Vector3();
    return ray.distanceSqToSegment(body.start, body.end, pointOnRay, pointOnSegment) <= body.radius ** 2;
  }
}
