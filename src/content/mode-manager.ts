import type { Mode } from '../shared/types';

export class ModeManager {
  mode: Mode = 'normal'; count = 0;
  private readonly listeners = new Set<(mode: Mode) => void>();
  private readonly cleanup = new Map<Mode, () => void>();
  enter(mode: Mode): void { this.cleanup.get(this.mode)?.(); this.mode = mode; this.count = 0; this.listeners.forEach((listener) => listener(mode)); }
  exit(): void { this.enter('normal'); }
  setCount(count: number): void { this.count = Math.max(1, count); }
  onChange(listener: (mode: Mode) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  onCleanup(mode: Mode, callback: () => void): void { this.cleanup.set(mode, callback); }
}
