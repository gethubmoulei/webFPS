import type { WeaponId } from './config';

const SHOT_SOUND: Record<WeaponId, { freq: number; end: number; duration: number; volume: number; noise: number }> = {
  rifle: { freq: 115, end: 35, duration: 0.1, volume: 0.075, noise: 0.13 },
  pistol: { freq: 160, end: 35, duration: 0.1, volume: 0.075, noise: 0.13 },
  sniper: { freq: 72, end: 28, duration: 0.18, volume: 0.11, noise: 0.19 },
  shotgun: { freq: 88, end: 30, duration: 0.14, volume: 0.1, noise: 0.21 },
};

export class GameAudio {
  context: AudioContext | null = null;
  muted = false;
  async init() { this.context ??= new AudioContext(); await this.context.resume(); }
  tone(freq: number, duration: number, volume: number, type: OscillatorType = 'triangle', end = freq) {
    if (!this.context || this.muted) return;
    const ctx = this.context, oscillator = ctx.createOscillator(), gain = ctx.createGain();
    oscillator.type = type; oscillator.frequency.setValueAtTime(freq, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, end), ctx.currentTime + duration);
    gain.gain.setValueAtTime(volume, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    oscillator.connect(gain); gain.connect(ctx.destination); oscillator.start(); oscillator.stop(ctx.currentTime + duration);
  }
  shot(weapon: WeaponId = 'rifle') {
    const sound = SHOT_SOUND[weapon];
    this.tone(sound.freq, sound.duration, sound.volume, 'sawtooth', sound.end);
    if (!this.context || this.muted) return;
    const ctx = this.context, buffer = ctx.createBuffer(1, ctx.sampleRate * sound.duration, ctx.sampleRate);
    const data = buffer.getChannelData(0); for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 3;
    const source = ctx.createBufferSource(), gain = ctx.createGain(); source.buffer = buffer; gain.gain.value = sound.noise;
    source.connect(gain); gain.connect(ctx.destination); source.start();
  }
  hit(headshot = false) { this.tone(headshot ? 1480 : 1100, headshot ? 0.09 : 0.07, 0.04, 'sine', headshot ? 920 : 700); }

  hurt() {
    this.tone(160, 0.18, 0.12, 'sine', 45);
    this.tone(320, 0.07, 0.035, 'triangle', 80);
  }
  reload() { this.tone(350, 0.09, 0.04, 'square', 150); }
}
