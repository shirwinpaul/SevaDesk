// Encrypted IndexedDB store. Every record value is AES-GCM encrypted with the key
// derived from the user's passphrase; only the collection name, record id and an
// updatedAt timestamp are stored in the clear (needed for indexing).
// The key is held in memory only while unlocked and dropped on lock().

import { openDB, deleteDB, type DBSchema, type IDBPDatabase } from "idb";
import { decryptJson, deriveKey, encryptJson, fromB64, PBKDF2_ITERATIONS, randomBytes, SALT_BYTES, toB64, type Sealed } from "./crypto";

export const DEFAULT_DB_NAME = "sevadesk";
const CHECK_VALUE = "sevadesk-vault-ok";

export interface VaultMeta {
  v: 1;
  /** base64 random salt for PBKDF2 (stored so the key can be re-derived) */
  salt: string;
  iterations: number;
  /** A known value encrypted with the key — used to verify the passphrase. */
  check: Sealed;
  createdAt: string;
}

export interface EncryptedRecord {
  col: string;
  id: string;
  sealed: Sealed;
  updatedAt: number;
}

interface SevaSchema extends DBSchema {
  meta: { key: string; value: VaultMeta };
  records: { key: [string, string]; value: EncryptedRecord; indexes: { "by-col": string } };
}

export type CollectionDump = Record<string, Array<{ id: string; value: unknown }>>;

export class LockedError extends Error {
  constructor() {
    super("Vault is locked");
    this.name = "LockedError";
  }
}

/** AAD binds each ciphertext to its collection + id. */
const aadFor = (col: string, id: string) => `${col}/${id}`;

export class EncryptedStore {
  private dbPromise: Promise<IDBPDatabase<SevaSchema>> | null = null;
  private key: CryptoKey | null = null;

  constructor(private readonly dbName: string = DEFAULT_DB_NAME) {}

  private db(): Promise<IDBPDatabase<SevaSchema>> {
    if (!this.dbPromise) {
      this.dbPromise = openDB<SevaSchema>(this.dbName, 1, {
        upgrade(db) {
          db.createObjectStore("meta");
          const rec = db.createObjectStore("records", { keyPath: ["col", "id"] });
          rec.createIndex("by-col", "col");
        },
      });
    }
    return this.dbPromise;
  }

  private requireKey(): CryptoKey {
    if (!this.key) throw new LockedError();
    return this.key;
  }

  get isUnlocked(): boolean {
    return this.key !== null;
  }

  async exists(): Promise<boolean> {
    return (await (await this.db()).get("meta", "vault")) !== undefined;
  }

  async getMeta(): Promise<VaultMeta | undefined> {
    return (await this.db()).get("meta", "vault");
  }

  /** First-run setup: random salt, derive key, store salt + check value. Leaves the vault unlocked. */
  async create(passphrase: string, iterations: number = PBKDF2_ITERATIONS): Promise<void> {
    if (await this.exists()) throw new Error("Vault already exists");
    const salt = randomBytes(SALT_BYTES);
    const key = await deriveKey(passphrase, salt, iterations);
    const meta: VaultMeta = {
      v: 1,
      salt: toB64(salt),
      iterations,
      check: await encryptJson(key, CHECK_VALUE, "meta/check"),
      createdAt: new Date().toISOString(),
    };
    await (await this.db()).put("meta", meta, "vault");
    this.key = key;
  }

  /** Returns true if the passphrase is correct. A wrong passphrase never throws or unlocks. */
  async unlock(passphrase: string): Promise<boolean> {
    const meta = await this.getMeta();
    if (!meta) return false;
    try {
      const key = await deriveKey(passphrase, fromB64(meta.salt), meta.iterations);
      const check = await decryptJson<string>(key, meta.check, "meta/check");
      if (check !== CHECK_VALUE) return false;
      this.key = key;
      return true;
    } catch {
      return false;
    }
  }

  /** Verify a passphrase without changing lock state (e.g. before export). */
  async verify(passphrase: string): Promise<boolean> {
    const meta = await this.getMeta();
    if (!meta) return false;
    try {
      const key = await deriveKey(passphrase, fromB64(meta.salt), meta.iterations);
      return (await decryptJson<string>(key, meta.check, "meta/check")) === CHECK_VALUE;
    } catch {
      return false;
    }
  }

  /** Drop the key from memory. Encrypted data stays on disk. */
  lock(): void {
    this.key = null;
  }

  async put(col: string, id: string, value: unknown): Promise<void> {
    const key = this.requireKey();
    const sealed = await encryptJson(key, value, aadFor(col, id));
    await (await this.db()).put("records", { col, id, sealed, updatedAt: Date.now() });
  }

  async get<T = unknown>(col: string, id: string): Promise<T | undefined> {
    const key = this.requireKey();
    const rec = await (await this.db()).get("records", [col, id]);
    if (!rec) return undefined;
    return decryptJson<T>(key, rec.sealed, aadFor(col, id));
  }

  async getAll<T = unknown>(col: string): Promise<T[]> {
    const key = this.requireKey();
    const recs = await (await this.db()).getAllFromIndex("records", "by-col", col);
    return Promise.all(recs.map((r) => decryptJson<T>(key, r.sealed, aadFor(r.col, r.id))));
  }

  async delete(col: string, id: string): Promise<void> {
    this.requireKey();
    await (await this.db()).delete("records", [col, id]);
  }

  /** Raw encrypted rows — used by tests to prove data is unreadable at rest. */
  async rawRecords(): Promise<EncryptedRecord[]> {
    return (await this.db()).getAll("records");
  }

  /** Decrypt everything (for encrypted backup export). */
  async dumpAll(): Promise<CollectionDump> {
    const key = this.requireKey();
    const out: CollectionDump = {};
    for (const r of await this.rawRecords()) {
      (out[r.col] ??= []).push({ id: r.id, value: await decryptJson(key, r.sealed, aadFor(r.col, r.id)) });
    }
    return out;
  }

  /** Replace ALL records with the given dump, re-encrypted under the current key. */
  async replaceAll(dump: CollectionDump): Promise<void> {
    const key = this.requireKey();
    // Encrypt first (async crypto cannot run inside an IDB transaction), then write atomically.
    const rows: EncryptedRecord[] = [];
    for (const [col, items] of Object.entries(dump)) {
      for (const { id, value } of items) {
        rows.push({ col, id, sealed: await encryptJson(key, value, aadFor(col, id)), updatedAt: Date.now() });
      }
    }
    const db = await this.db();
    const tx = db.transaction("records", "readwrite");
    await tx.store.clear();
    for (const row of rows) await tx.store.put(row);
    await tx.done;
  }

  /** Permanently delete the whole database from this device. */
  async erase(): Promise<void> {
    this.key = null;
    if (this.dbPromise) {
      (await this.dbPromise).close();
      this.dbPromise = null;
    }
    await deleteDB(this.dbName);
  }
}
