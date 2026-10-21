export interface NavNode { id: number; x: number; y: number; z: number; neighbors: number[]; }
const distance = (a: NavNode, b: NavNode) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export function findPath(nodes: NavNode[], start: number, goal: number): number[] {
  if (!nodes[start] || !nodes[goal]) return [];
  const open = new Set([start]);
  const came = new Map<number, number>();
  const cost = new Map([[start, 0]]);
  const score = new Map([[start, distance(nodes[start], nodes[goal])]]);
  while (open.size) {
    let current = -1, best = Infinity;
    for (const id of open) if ((score.get(id) ?? Infinity) < best) { current = id; best = score.get(id)!; }
    if (current === goal) {
      const path = [current];
      while (came.has(current)) { current = came.get(current)!; path.unshift(current); }
      return path;
    }
    open.delete(current);
    for (const id of nodes[current].neighbors) {
      const nextCost = cost.get(current)! + distance(nodes[current], nodes[id]);
      if (nextCost >= (cost.get(id) ?? Infinity)) continue;
      came.set(id, current); cost.set(id, nextCost);
      score.set(id, nextCost + distance(nodes[id], nodes[goal])); open.add(id);
    }
  }
  return [];
}
