// App-wide vault session: one EncryptedStore, a small decrypted cache, and
// subscribers. lock() drops the key AND clears every decrypted value from memory.

import type { z } from "zod";
import { EncryptedStore } from "./store";

export type VaultStatus = "loading" | "none" | "locked" | "unlocked";

type Listener = () => void;

export class VaultSession {
  readonly store: EncryptedStore;
  private status: VaultStatus = "loading";
  private version = 0;
  private cache = new Map<string, unknown[]>();
  private listeners = new Set<Listener>();
  private snapshot = { status: this.status, version: this.version };

  constructor(dbName?: string) {
    this.store = new EncryptedStore(dbName);
  }

  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = () => this.snapshot;

  private emit(): void {
    this.version++;
    this.snapshot = { status: this.status, version: this.version };
    this.listeners.forEach((l) => l());
  }

  private setStatus(s: VaultStatus): void {
    this.status = s;
    this.emit();
  }

  async init(): Promise<void> {
    try {
      this.setStatus((await this.store.exists()) ? (this.store.isUnlocked ? "unlocked" : "locked") : "none");
    } catch {
      this.setStatus("none");
    }
  }

  async create(passphrase: string, iterations?: number): Promise<void> {
    await this.store.create(passphrase, iterations);
    this.setStatus("unlocked");
  }

  async unlock(passphrase: string): Promise<boolean> {
    const ok = await this.store.unlock(passphrase);
    if (ok) this.setStatus("unlocked");
    return ok;
  }

  lock(): void {
    this.store.lock();
    this.cache.clear();
    if (this.status !== "none") this.setStatus("locked");
  }

  async erase(): Promise<void> {
    this.cache.clear();
    await this.store.erase();
    this.setStatus("none");
  }

  get cachedCollections(): number {
    return this.cache.size;
  }

  /** Read a collection, validating each record. Invalid records are skipped, never crash the UI. */
  async list<S extends z.ZodType>(col: string, schema: S): Promise<z.infer<S>[]> {
    const hit = this.cache.get(col);
    if (hit) return hit as z.infer<S>[];
    const raw = await this.store.getAll(col);
    const items = raw.flatMap((r) => {
      const p = schema.safeParse(r);
      return p.success ? [p.data as z.infer<S>] : [];
    });
    if (this.store.isUnlocked) this.cache.set(col, items);
    return items;
  }

  async get<S extends z.ZodType>(col: string, itemId: string, schema: S): Promise<z.infer<S> | undefined> {
    const raw = await this.store.get(col, itemId);
    if (raw === undefined) return undefined;
    const p = schema.safeParse(raw);
    return p.success ? (p.data as z.infer<S>) : undefined;
  }

  async save<S extends z.ZodType>(col: string, schema: S, item: z.input<S> & { id: string }): Promise<z.infer<S>> {
    const parsed = schema.parse(item) as z.infer<S>;
    await this.store.put(col, item.id, parsed);
    this.cache.delete(col);
    this.emit();
    return parsed;
  }

  async remove(col: string, itemId: string): Promise<void> {
    await this.store.delete(col, itemId);
    this.cache.delete(col);
    this.emit();
  }

  /** After a backup restore, drop all cached data. */
  invalidateAll(): void {
    this.cache.clear();
    this.emit();
  }
}

let singleton: VaultSession | null = null;
export function getSession(): VaultSession {
  singleton ??= new VaultSession();
  return singleton;
}
