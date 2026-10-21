import * as THREE from 'three';
import { Octree } from 'three/addons/math/Octree.js';
import { Capsule } from 'three/addons/math/Capsule.js';
import { PLAYER } from './config';
import type { NavNode } from './navigation';

export const materials = {
  sand: new THREE.MeshStandardMaterial({ color: 0xc2b49a, roughness: 0.95 }),
  wall: new THREE.MeshStandardMaterial({ color: 0xd4c4a5, roughness: 0.9 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x46544c, roughness: 0.85 }),
  trim: new THREE.MeshStandardMaterial({ color: 0x727665, roughness: 0.9 }),
  orange: new THREE.MeshStandardMaterial({ color: 0xe6a151, roughness: 0.75 }),
  black: new THREE.MeshStandardMaterial({ color: 0x242d2b, roughness: 0.7 }),
};
export function box(parent: THREE.Object3D, size: number[], pos: number[], material: THREE.Material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size as [number, number, number]), material);
  mesh.position.set(...pos as [number, number, number]);
  mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
export function capsuleAt(feet: THREE.Vector3, height = PLAYER.height) {
  return new Capsule(feet.clone().add(new THREE.Vector3(0, PLAYER.radius, 0)), feet.clone().add(new THREE.Vector3(0, height - PLAYER.radius, 0)), PLAYER.radius);
}

export class World {
  solids = new THREE.Group();
  details = new THREE.Group();
  octree = new Octree();
  nodes: NavNode[] = [];
  spawns = [new THREE.Vector3(0, 0.03, 24), new THREE.Vector3(-24, 0.03, -24), new THREE.Vector3(24, 0.03, -24), new THREE.Vector3(-24, 0.03, 22), new THREE.Vector3(24, 0.03, 23), new THREE.Vector3(5, 3.03, -19)];
  private ray = new THREE.Raycaster();
  constructor(scene: THREE.Scene) {
    scene.add(this.solids, this.details);
    box(this.solids, [60, 1, 60], [0, -0.5, 0], materials.sand);
    for (const x of [-30, 30]) box(this.solids, [0.8, 4, 60], [x, 2, 0], materials.wall);
    for (const z of [-30, 30]) box(this.solids, [60, 4, 0.8], [0, 2, z], materials.wall);
    for (let n = -27; n <= 27; n += 6) {
      for (const x of [-29.4, 29.4]) box(this.details, [0.5, 4.4, 0.5], [x, 2.2, n], materials.trim);
      for (const z of [-29.4, 29.4]) box(this.details, [0.5, 4.4, 0.5], [n, 2.2, z], materials.trim);
    }
    this.building(-17, -10, '01', 'OPERATIONS');
    this.building(16, 9, '02', 'SUPPLY DEPOT');
    box(this.solids, [12, 3, 8], [5, 1.5, -19], materials.wall);
    this.ramp(5, -15, -5, 4, 3);
    for (const x of [-0.8, 10.8]) box(this.solids, [0.35, 1, 8], [x, 3.5, -19], materials.trim);
    box(this.solids, [12, 1, 0.35], [5, 3.5, -22.8], materials.trim);
    this.sign('ELEVATED / 03', 5, 2, -14.98, 5, 0.9);
    this.container(-15, 9, 8, 3, 3.5);
    this.container(19, -13, 3.5, 3, 8);
    for (const [x, z, w, d] of [[-4, -4, 5, 1], [15, -2, 6, 1], [-21, 20, 4, 1], [5, 14, 5, 1], [-7, -21, 1, 6]]) {
      box(this.solids, [w, 1.25, d], [x, 0.625, z], materials.wall);
      box(this.details, [w + 0.04, 0.12, d + 0.04], [x, 1.25, z], materials.trim);
    }
    for (const [x, z, s] of [[-3, 3, 1.8], [11, -5, 1.6], [-24, 1, 2], [22, 19, 1.6], [-10, -1, 1.4], [0, -26, 1.5]]) this.crate(x, z, s);
    // 1.15 m clearance: standing players and bots cannot enter this passage.
    box(this.solids, [0.4, 1.5, 6], [-9.2, 0.75, 8], materials.dark);
    box(this.solids, [0.4, 1.5, 6], [-4.8, 0.75, 8], materials.dark);
    box(this.solids, [4.8, 0.35, 6], [-7, 1.325, 8], materials.dark);
    this.sign('LOW CLEARANCE', -7, 1.34, 11.02, 3.8, 0.3);
    this.sign('RANGE 07', 0, 2.5, -29.57, 12, 1.8);
    this.sign('LIVE FIRE / TRAINING SECTOR', -16, 2.2, -29.57, 10, 0.75);
    // Ground markings, drainage and a spawn ring provide scale without textures.
    for (const x of [-26, 26]) box(this.details, [0.08, 0.008, 54], [x, 0.01, 0], materials.trim);
    for (let z = -25; z < 27; z += 3) box(this.details, [0.14, 0.012, 1.25], [0, 0.012, z], materials.wall);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.65, 1.72, 48), new THREE.MeshBasicMaterial({ color: 0xe9dbaf, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.018, 24); this.details.add(ring);
    for (const [x, z] of [[-26, -26], [26, -26], [-26, 26], [26, 26]]) {
      box(this.details, [0.16, 7, 0.16], [x, 3.5, z], materials.black);
      box(this.details, [1.4, 0.35, 0.4], [x, 7, z], materials.black);
      box(this.details, [1.2, 0.15, 0.43], [x, 6.95, z], new THREE.MeshStandardMaterial({ color: 0xffe7ba, emissive: 0xffcd83, emissiveIntensity: 0.6 }));
    }
    // Distant angular hills create a desert silhouette beyond the playable boundary.
    const hillMat = new THREE.MeshStandardMaterial({ color: 0xb8b5a3, roughness: 1 });
    for (let i = 0; i < 18; i++) {
      const angle = i / 18 * Math.PI * 2;
      const hill = new THREE.Mesh(new THREE.ConeGeometry(16 + i % 4 * 4, 10 + i % 5 * 4, 4), hillMat);
      hill.position.set(Math.cos(angle) * 88, 1, Math.sin(angle) * 88); hill.rotation.y = i * 1.3; this.details.add(hill);
    }
    this.solids.updateMatrixWorld(true); this.octree.fromGraphNode(this.solids);
    this.makeNavigation();
  }
  private building(x: number, z: number, number: string, name: string) {
    box(this.solids, [0.5, 4.2, 9], [x - 5, 2.1, z], materials.wall);
    box(this.solids, [0.5, 4.2, 9], [x + 5, 2.1, z], materials.wall);
    box(this.solids, [10, 4.2, 0.5], [x, 2.1, z - 4.5], materials.wall);
    for (const offset of [-3.3, 3.3]) box(this.solids, [3.4, 4.2, 0.5], [x + offset, 2.1, z + 4.5], materials.wall);
    box(this.solids, [3.2, 1.1, 0.5], [x, 3.65, z + 4.5], materials.wall);
    box(this.solids, [10.7, 0.3, 9.7], [x, 4.35, z], materials.trim);
    box(this.details, [10.1, 0.14, 0.04], [x, 2.7, z + 4.77], materials.orange);
    this.sign(number, x - 3.25, 1.8, z + 4.77, 2, 1.7);
    this.sign(name, x, 3.65, z + 4.77, 6, 0.65);
    this.crate(x - 3, z - 2, 1.4);
    box(this.details, [2, 0.06, 0.8], [x, 4.15, z], new THREE.MeshBasicMaterial({ color: 0xffefcb }));
  }
  private crate(x: number, z: number, size: number) {
    box(this.solids, [size, size, size], [x, size / 2, z], materials.trim);
    for (const dx of [-size * 0.35, size * 0.35]) box(this.details, [0.12, size + 0.03, size + 0.03], [x + dx, size / 2, z], materials.dark);
    box(this.details, [size + 0.02, 0.1, size + 0.02], [x, size * 0.75, z], materials.dark);
  }
  private container(x: number, z: number, w: number, h: number, d: number) {
    box(this.solids, [w, h, d], [x, h / 2, z], materials.dark);
    for (let offset = -w / 2 + 0.25; offset < w / 2; offset += 0.5) {
      for (const side of [-1, 1]) box(this.details, [0.08, h - 0.2, 0.08], [x + offset, h / 2, z + side * (d / 2 + 0.02)], materials.trim);
    }
    for (let offset = -d / 2 + 0.25; offset < d / 2; offset += 0.5) {
      for (const side of [-1, 1]) box(this.details, [0.08, h - 0.2, 0.08], [x + side * (w / 2 + 0.02), h / 2, z + offset], materials.trim);
    }
    this.sign('R07 / STORAGE', x, 1.8, z + d / 2 + 0.07, Math.min(w - 0.3, 4), 0.5);
  }
  private ramp(x: number, back: number, front: number, width: number, height: number) {
    const l = x - width / 2, r = x + width / 2;
    const vertices = [l,0,front, r,0,front, r,height,back, l,height,back, l,0,back, r,0,back];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setIndex([0,1,2, 0,2,3, 0,3,4, 1,5,2, 4,3,2, 4,2,5, 0,4,5, 0,5,1]); geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, materials.wall); mesh.castShadow = true; mesh.receiveShadow = true; this.solids.add(mesh);
  }
  private sign(text: string, x: number, y: number, z: number, width: number, height: number) {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#2c3731'; ctx.fillRect(0, 0, 1024, 256);
    ctx.fillStyle = '#e9e5cc'; ctx.font = 'bold 110px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 512, 138, 960);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({ map: texture, roughness: 1 }));
    sign.position.set(x, y, z); this.details.add(sign);
  }
  groundHeight(x: number, z: number) {
    if (x > -1 && x < 11 && z > -23 && z < -15) return 3;
    if (x >= 3 && x <= 7 && z >= -15 && z <= -5) return (-5 - z) * 0.3;
    return 0;
  }
  clearAt(pos: THREE.Vector3, height = PLAYER.height) {
    const hit = this.octree.capsuleIntersect(capsuleAt(pos.clone().add(new THREE.Vector3(0, 0.025, 0)), height));
    return !hit || (hit.normal.y > 0.65 && hit.depth < 0.12);
  }
  segmentClear(a: THREE.Vector3, b: THREE.Vector3) {
    const delta = b.clone().sub(a); const length = delta.length();
    if (length < 0.01) return true;
    this.ray.set(a, delta.normalize()); this.ray.far = length;
    return this.ray.intersectObjects(this.solids.children, false).length === 0;
  }
  nearestNode(pos: THREE.Vector3) {
    let best = 0, dist = Infinity;
    for (const node of this.nodes) {
      const d = (node.x - pos.x) ** 2 + (node.z - pos.z) ** 2 + (node.y - pos.y) ** 2 * 4;
      if (d < dist) { dist = d; best = node.id; }
    }
    return best;
  }
  private makeNavigation() {
    const lookup = new Map<string, number>();
    for (let x = -27; x <= 27; x += 2) for (let z = -27; z <= 27; z += 2) {
      const y = this.groundHeight(x, z);
      if (!this.clearAt(new THREE.Vector3(x, y, z))) continue;
      const id = this.nodes.length; this.nodes.push({ id, x, y, z, neighbors: [] }); lookup.set(`${x},${z}`, id);
    }
    for (const node of this.nodes) for (const [dx, dz] of [[2,0],[-2,0],[0,2],[0,-2]]) {
      const id = lookup.get(`${node.x + dx},${node.z + dz}`); if (id === undefined) continue;
      const next = this.nodes[id]; if (Math.abs(next.y - node.y) > 0.7) continue;
      let clear = true;
      for (let t = 0.2; t < 1; t += 0.2) {
        const x = node.x + dx * t, z = node.z + dz * t;
        if (!this.clearAt(new THREE.Vector3(x, this.groundHeight(x,z), z))) { clear = false; break; }
      }
      if (clear) node.neighbors.push(id);
    }
  }
  safestSpawn(enemies: THREE.Vector3[]) {
    return this.spawns.reduce((best, point) => {
      const score = (p: THREE.Vector3) => Math.min(...enemies.map(e => e.distanceToSquared(p)), 1e6);
      return score(point) > score(best) ? point : best;
    }, this.spawns[0]).clone();
  }
}
