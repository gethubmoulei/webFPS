import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Input } from '../src/input';

const storageKey = 'range07.mouseSensitivity';
let doc: EventTarget;
let storage: Map<string, string>;

beforeEach(() => {
  doc = new EventTarget();
  storage = new Map();
  vi.stubGlobal('document', doc);
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
});
afterEach(() => vi.unstubAllGlobals());

const createInput = () => new Input(new EventTarget() as HTMLCanvasElement);
const move = (x: number, y: number) => doc.dispatchEvent(Object.assign(new Event('mousemove'), { movementX: x, movementY: y }));

describe('鼠标原始输入', () => {
  it('在用户激活事件内立即请求原始输入，每次恢复都保持相同模式', async () => {
    const requestPointerLock = vi.fn().mockResolvedValue(undefined);
    const canvas = Object.assign(new EventTarget(), { requestPointerLock }) as unknown as HTMLCanvasElement;
    const input = new Input(canvas);
    const lock = input.lock();
    expect(requestPointerLock).toHaveBeenCalledWith({ unadjustedMovement: true });
    await lock;
    await input.lock();
    expect(requestPointerLock.mock.calls).toEqual([[{ unadjustedMovement: true }], [{ unadjustedMovement: true }]]);
  });

  it('平台不支持原始输入时回退到普通锁定', async () => {
    const requestPointerLock = vi.fn()
      .mockRejectedValueOnce(new DOMException('unsupported', 'NotSupportedError'))
      .mockResolvedValueOnce(undefined);
    const canvas = Object.assign(new EventTarget(), { requestPointerLock }) as unknown as HTMLCanvasElement;
    await new Input(canvas).lock();
    expect(requestPointerLock.mock.calls).toEqual([[{ unadjustedMovement: true }], []]);
  });

  it('权限或安全错误直接上报，不重复申请', async () => {
    const error = new DOMException('denied', 'NotAllowedError');
    const requestPointerLock = vi.fn().mockRejectedValue(error);
    const canvas = Object.assign(new EventTarget(), { requestPointerLock }) as unknown as HTMLCanvasElement;
    await expect(new Input(canvas).lock()).rejects.toBe(error);
    expect(requestPointerLock).toHaveBeenCalledTimes(1);
  });

  it('兼容不返回 Promise 的旧版锁定接口', async () => {
    const requestPointerLock = vi.fn();
    const canvas = Object.assign(new EventTarget(), { requestPointerLock }) as unknown as HTMLCanvasElement;
    await expect(new Input(canvas).lock()).resolves.toBeUndefined();
    expect(requestPointerLock).toHaveBeenCalledTimes(1);
  });
});

describe('鼠标灵敏度', () => {
  it('狙击开镜按基础灵敏度的 35% 转向，退出开镜立即恢复且不改动保存值', () => {
    let scoped = false;
    const input = new Input(new EventTarget() as HTMLCanvasElement, () => scoped);
    input.locked = true; input.setSensitivity(2);
    move(100, 50);
    expect(input.yaw).toBeCloseTo(-0.4); expect(input.pitch).toBeCloseTo(-0.2);
    scoped = true;
    move(100, 50);
    expect(input.yaw).toBeCloseTo(-0.54); expect(input.pitch).toBeCloseTo(-0.27);
    scoped = false;
    move(100, 50);
    expect(input.yaw).toBeCloseTo(-0.94); expect(input.pitch).toBeCloseTo(-0.47);
    expect(input.sensitivity).toBe(2); expect(storage.get(storageKey)).toBe('2');
  });

  it('默认保留原手感，调节后水平与垂直转向按相同倍率变化', () => {
    const input = createInput(); input.locked = true;
    move(100, 50);
    expect(input.yaw).toBeCloseTo(-0.2); expect(input.pitch).toBeCloseTo(-0.1);
    input.setSensitivity(2);
    move(100, 50);
    expect(input.yaw).toBeCloseTo(-0.6); expect(input.pitch).toBeCloseTo(-0.3);
    input.setSensitivity(0.5);
    move(100, 50);
    expect(input.yaw).toBeCloseTo(-0.7); expect(input.pitch).toBeCloseTo(-0.35);
  });

  it('未锁定时不转向，高灵敏度仍受俯仰角度限制', () => {
    const input = createInput(); input.setSensitivity(3);
    move(100, 100); expect(input.yaw).toBe(0); expect(input.pitch).toBe(0);
    input.locked = true;
    move(0, 10000); expect(input.pitch).toBe(-1.45);
    move(0, -10000); expect(input.pitch).toBe(1.45);
  });

  it('保存设置并在下次创建时恢复', () => {
    const input = createInput(); input.setSensitivity(1.7);
    expect(storage.get(storageKey)).toBe('1.7');
    expect(createInput().sensitivity).toBe(1.7);
  });

  it.each(['garbage', '', '0', '-1', '4', 'Infinity'])('忽略无效的已保存值 %j', saved => {
    storage.set(storageKey, saved);
    expect(createInput().sensitivity).toBe(1);
  });

  it('限制调节范围并忽略非有限数值', () => {
    const input = createInput();
    input.setSensitivity(0); expect(input.sensitivity).toBe(0.1);
    input.setSensitivity(10); expect(input.sensitivity).toBe(3);
    input.setSensitivity(NaN); expect(input.sensitivity).toBe(3);
  });

  it('存储不可用时仍能启动和调节', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
    });
    const input = createInput(); expect(input.sensitivity).toBe(1);
    input.setSensitivity(0.8); expect(input.sensitivity).toBe(0.8);
  });
});
