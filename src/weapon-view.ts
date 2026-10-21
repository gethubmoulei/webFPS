import * as THREE from 'three';
import { box, materials } from './world';
import type { Arsenal } from './combat';
import type { WeaponId } from './config';
import type { Player } from './player';

export class WeaponView {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(65, 1, 0.01, 10);
  root = new THREE.Group();
  rifle = new THREE.Group();
  pistol = new THREE.Group();
  sniper = new THREE.Group();
  shotgun = new THREE.Group();
  flash: THREE.Mesh;
  recoil = 0;
  flashTime = 0;
  time = 0;
  aim = 0;
  private sniperBolt?: THREE.Mesh;
  private flashZ: Record<WeaponId, number> = { rifle: -1.03, pistol: -0.44, sniper: -1.42, shotgun: -1.08 };
  private aimPose: Record<WeaponId, { x: number; y: number; z: number }> = {
    rifle: { x: 0, y: -0.15, z: -0.52 },
    pistol: { x: 0, y: -0.13, z: -0.44 },
    sniper: { x: 0, y: -0.12, z: -0.44 },
    shotgun: { x: 0.02, y: -0.22, z: -0.72 },
  };
  constructor() {
    this.scene.add(new THREE.HemisphereLight(0xf5f1d5, 0x4d6057, 3));
    const light = new THREE.DirectionalLight(0xffe8ca, 3); light.position.set(-2, 4, 1); this.scene.add(light);
    this.scene.add(this.root); this.root.add(this.rifle, this.pistol, this.sniper, this.shotgun); this.root.scale.setScalar(0.65);
    const gun = new THREE.MeshStandardMaterial({ color: 0x52605a, metalness: 0.2, roughness: 0.53 });
    const steel = new THREE.MeshStandardMaterial({ color: 0x303b37, metalness: 0.25, roughness: 0.48 });
    box(this.rifle, [0.14, 0.17, 0.55], [0, 0, -0.2], gun);
    box(this.rifle, [0.11, 0.12, 0.34], [0, -0.01, -0.6], steel);
    box(this.rifle, [0.052, 0.055, 0.28], [0, 0.02, -0.88], steel);
    box(this.rifle, [0.12, 0.2, 0.27], [0, -0.025, 0.16], gun);
    const mag = box(this.rifle, [0.09, 0.27, 0.14], [0, -0.2, -0.2], steel); mag.rotation.x = -0.15;
    box(this.rifle, [0.08, 0.19, 0.1], [0, -0.15, 0.03], steel);
    box(this.rifle, [0.14, 0.02, 0.62], [0, 0.1, -0.27], steel);
    for (let z = -0.68; z < -0.35; z += 0.045) box(this.rifle, [0.125, 0.02, 0.015], [0, 0.07, z], materials.trim);
    box(this.rifle, [0.08, 0.035, 0.13], [0, 0.17, -0.18], steel);
    for (const x of [-0.045, 0.045]) box(this.rifle, [0.014, 0.1, 0.1], [x, 0.13, -0.18], steel);
    box(this.rifle, [0.04, 0.075, 0.045], [0, 0.085, -0.73], steel);
    box(this.rifle, [0.018, 0.04, 0.025], [0, 0.135, -0.73], materials.orange);
    box(this.rifle, [0.145, 0.06, 0.12], [0, 0.005, -0.17], materials.orange);
    box(this.pistol, [0.11, 0.12, 0.34], [0, 0, -0.24], steel);
    box(this.pistol, [0.1, 0.045, 0.3], [0, 0.07, -0.24], gun);
    const grip = box(this.pistol, [0.09, 0.24, 0.13], [0, -0.15, -0.13], gun); grip.rotation.x = -0.2;
    box(this.pistol, [0.026, 0.025, 0.025], [0, 0.105, -0.36], materials.orange);
    // Sniper: long barrel, box scope and a sliding bolt handle.
    box(this.sniper, [0.13, 0.16, 0.62], [0, 0, -0.25], gun);
    box(this.sniper, [0.1, 0.12, 0.42], [0, -0.01, -0.72], steel);
    box(this.sniper, [0.045, 0.045, 0.5], [0, 0.03, -1.12], steel);
    box(this.sniper, [0.12, 0.18, 0.3], [0, -0.025, 0.14], gun);
    box(this.sniper, [0.14, 0.22, 0.38], [0, -0.04, 0.38], gun);
    box(this.sniper, [0.1, 0.1, 0.34], [0, 0.19, -0.18], steel);
    box(this.sniper, [0.12, 0.14, 0.05], [0, 0.19, -0.37], materials.orange);
    box(this.sniper, [0.09, 0.12, 0.05], [0, 0.19, 0.01], steel);
    box(this.sniper, [0.05, 0.06, 0.05], [0, 0.13, -0.02], steel);
    this.sniperBolt = box(this.sniper, [0.13, 0.035, 0.035], [0.1, 0.055, -0.08], steel);
    box(this.sniper, [0.05, 0.12, 0.12], [0, -0.16, -0.14], steel);
    // Shotgun: thick barrel, tube magazine and pump handle.
    box(this.shotgun, [0.15, 0.17, 0.5], [0, 0, -0.2], gun);
    box(this.shotgun, [0.1, 0.1, 0.6], [0, 0.03, -0.72], steel);
    box(this.shotgun, [0.075, 0.075, 0.48], [0, -0.065, -0.63], steel);
    box(this.shotgun, [0.13, 0.1, 0.24], [0, -0.055, -0.65], materials.trim);
    box(this.shotgun, [0.13, 0.2, 0.3], [0, -0.02, 0.16], gun);
    box(this.shotgun, [0.14, 0.24, 0.36], [0, -0.05, 0.38], gun);
    box(this.shotgun, [0.11, 0.13, 0.2], [0, -0.02, 0.24], gun);
    box(this.shotgun, [0.03, 0.03, 0.04], [0, 0.085, -1.02], materials.orange);
    const glove = new THREE.MeshStandardMaterial({ color: 0x5d6453, roughness: 1 });
    const arm = new THREE.MeshStandardMaterial({ color: 0x727b61, roughness: 1 });
    for (const weapon of [this.rifle, this.pistol, this.sniper, this.shotgun]) {
      box(weapon, [0.12, 0.15, 0.15], [0, -0.16, -0.02], glove);
      const forearm = box(weapon, [0.15, 0.15, 0.4], [0.07, -0.24, 0.2], arm); forearm.rotation.z = 0.3; forearm.rotation.y = 0.25;
    }
    for (const [weapon, z] of [[this.rifle, -0.52], [this.sniper, -0.72], [this.shotgun, -0.62]] as const) {
      box(weapon, [0.12, 0.13, 0.18], [-0.07, -0.09, z], glove);
      const support = box(weapon, [0.14, 0.14, 0.5], [-0.2, -0.21, z + 0.26], arm); support.rotation.y = -0.5; support.rotation.x = 0.3;
    }
    this.flash = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), new THREE.MeshBasicMaterial({ color: 0xffdd8c, transparent: true, opacity: 0.95 }));
    this.flash.scale.set(0.8, 0.8, 2.4); this.root.add(this.flash); this.flash.visible = false;
  }
  fire() { this.recoil = 1; this.flashTime = 0.055; }
  update(dt: number, arsenal: Arsenal, player: Player, aiming: boolean) {
    this.time += dt; this.recoil = Math.max(0, this.recoil - dt * 8); this.flashTime = Math.max(0, this.flashTime - dt);
    this.aim = THREE.MathUtils.lerp(this.aim, aiming ? 1 : 0, 1 - Math.exp(-dt * 16));
    const selected = arsenal.selected;
    this.rifle.visible = selected === 'rifle'; this.pistol.visible = selected === 'pistol';
    this.sniper.visible = selected === 'sniper'; this.shotgun.visible = selected === 'shotgun';
    const scoped = selected === 'sniper' && this.aim > 0.8;
    this.root.visible = player.health.alive && !scoped;
    this.flash.visible = this.flashTime > 0; this.flash.position.set(0, 0.02, this.flashZ[selected]);
    this.flash.rotation.z = this.time * 47;
    const bob = (player.moving && player.grounded ? Math.sin(this.time * (player.sprinting ? 14 : 10)) * 0.014 : Math.sin(this.time * 1.7) * 0.002) * (1 - this.aim * 0.82);
    const reloadProgress = arsenal.reloading ? Math.sin((1 - arsenal.reloadRemaining / arsenal.config.reload) * Math.PI) : 0;
    if (this.sniperBolt) {
      const boltProgress = selected === 'sniper' && arsenal.config.bolt && arsenal.boltRemaining > 0
        ? 1 - arsenal.boltRemaining / arsenal.config.bolt : 0;
      const cycle = Math.sin(boltProgress * Math.PI);
      this.sniperBolt.position.x = 0.1 + cycle * 0.07;
      this.sniperBolt.rotation.z = cycle * 0.35;
    }
    const pose = this.aimPose[selected];
    this.root.position.set(
      THREE.MathUtils.lerp(0.25, pose.x, this.aim),
      THREE.MathUtils.lerp(-0.27, pose.y, this.aim) + bob - reloadProgress * 0.18,
      THREE.MathUtils.lerp(-0.5, pose.z, this.aim) + this.recoil * 0.065,
    );
    this.root.rotation.set(
      this.recoil * 0.08 - reloadProgress * 0.3,
      -0.02 * (1 - this.aim),
      reloadProgress * -0.5 + (player.sprinting ? -0.15 : 0),
    );
  }
  resize(w: number, h: number) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
}
