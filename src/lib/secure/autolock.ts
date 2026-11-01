// Pure auto-lock timing logic (no timers inside, so it is easy to test).
// The UI calls activity()/hidden()/visible() on events and tick() every few seconds.

export interface AutoLockOptions {
  idleMs: number;
  hiddenMs: number;
  now?: () => number;
  onLock: () => void;
}

export class AutoLock {
  private lastActivity: number;
  private hiddenSince: number | null = null;
  private locked = false;
  private readonly now: () => number;

  constructor(private opts: AutoLockOptions) {
    this.now = opts.now ?? Date.now;
    this.lastActivity = this.now();
  }

  update(idleMs: number, hiddenMs: number): void {
    this.opts = { ...this.opts, idleMs, hiddenMs };
  }

  activity(): void {
    if (!this.locked) this.lastActivity = this.now();
  }

  hidden(): void {
    this.hiddenSince = this.now();
  }

  /** Browsers throttle timers in hidden tabs, so check immediately on return. */
  visible(): void {
    this.tick();
    this.hiddenSince = null;
  }

  /** Returns true if this call locked the app. */
  tick(): boolean {
    if (this.locked) return false;
    const t = this.now();
    const idle = t - this.lastActivity >= this.opts.idleMs;
    const hiddenTooLong = this.hiddenSince !== null && t - this.hiddenSince >= this.opts.hiddenMs;
    if (idle || hiddenTooLong) {
      this.locked = true;
      this.opts.onLock();
      return true;
    }
    return false;
  }

  get isLocked(): boolean {
    return this.locked;
  }
}
