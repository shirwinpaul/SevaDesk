import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { decryptJson, deriveKey, encryptJson, PBKDF2_ITERATIONS, randomBytes } from "@/lib/secure/crypto";
import { EncryptedStore, LockedError } from "@/lib/secure/store";
import { decryptBackup, exportBackup, importBackup } from "@/lib/secure/backup";
import { AutoLock } from "@/lib/secure/autolock";
import { passphraseStrength } from "@/lib/secure/strength";
import { VaultSession } from "@/lib/secure/session";

const IT = 1_000; // low iteration count keeps tests fast; production uses PBKDF2_ITERATIONS
const PASS = "fake test passphrase 123";
let n = 0;
const dbName = () => `test-db-${Date.now()}-${n++}`;
const FAKE_CASE = { id: "c1", name: "Kavya Testperson", phone: "98765 43210" }; // fictional

describe("crypto primitives", () => {
  it("uses a high PBKDF2 iteration count by default", () => {
    expect(PBKDF2_ITERATIONS).toBeGreaterThanOrEqual(600_000);
  });

  it("encrypt/decrypt round-trip", async () => {
    const key = await deriveKey(PASS, randomBytes(16), IT);
    const sealed = await encryptJson(key, FAKE_CASE);
    expect(await decryptJson(key, sealed)).toEqual(FAKE_CASE);
  });

  it("wrong key fails (throws, never returns garbage)", async () => {
    const salt = randomBytes(16);
    const sealed = await encryptJson(await deriveKey(PASS, salt, IT), FAKE_CASE);
    await expect(decryptJson(await deriveKey("wrong passphrase!!", salt, IT), sealed)).rejects.toThrow();
  });

  it("AAD mismatch fails (records cannot be swapped)", async () => {
    const key = await deriveKey(PASS, randomBytes(16), IT);
    const sealed = await encryptJson(key, FAKE_CASE, "cases/c1");
    await expect(decryptJson(key, sealed, "cases/c2")).rejects.toThrow();
  });

  it("tampered ciphertext fails", async () => {
    const key = await deriveKey(PASS, randomBytes(16), IT);
    const sealed = await encryptJson(key, FAKE_CASE);
    const chars = atob(sealed.ct).split("");
    chars[0] = String.fromCharCode(chars[0]!.charCodeAt(0) ^ 1);
    await expect(decryptJson(key, { iv: sealed.iv, ct: btoa(chars.join("")) })).rejects.toThrow();
  });

  it("unique IV per encryption", async () => {
    const key = await deriveKey(PASS, randomBytes(16), IT);
    const ivs = new Set<string>();
    for (let i = 0; i < 50; i++) ivs.add((await encryptJson(key, "same")).iv);
    expect(ivs.size).toBe(50);
  });
});

describe("EncryptedStore", () => {
  it("creates vault with stored random salt and verifies passphrase", async () => {
    const s = new EncryptedStore(dbName());
    expect(await s.exists()).toBe(false);
    await s.create(PASS, IT);
    const meta = await s.getMeta();
    expect(meta?.salt).toBeTruthy();
    expect(atob(meta!.salt).length).toBe(16);
    expect(meta?.iterations).toBe(IT);
    expect(s.isUnlocked).toBe(true);
    expect(await s.verify(PASS)).toBe(true);
    expect(await s.verify("nope nope nope")).toBe(false);
  });

  it("two vaults get different salts", async () => {
    const a = new EncryptedStore(dbName());
    const b = new EncryptedStore(dbName());
    await a.create(PASS, IT);
    await b.create(PASS, IT);
    expect((await a.getMeta())!.salt).not.toBe((await b.getMeta())!.salt);
  });

  it("round-trips records and unlocks again after lock", async () => {
    const name = dbName();
    const s = new EncryptedStore(name);
    await s.create(PASS, IT);
    await s.put("cases", "c1", FAKE_CASE);
    s.lock();
    expect(s.isUnlocked).toBe(false);
    await expect(s.get("cases", "c1")).rejects.toBeInstanceOf(LockedError);
    const s2 = new EncryptedStore(name); // fresh instance = app reload
    expect(await s2.unlock(PASS)).toBe(true);
    expect(await s2.get("cases", "c1")).toEqual(FAKE_CASE);
  });

  it("wrong passphrase fails safely (returns false, stays locked)", async () => {
    const s = new EncryptedStore(dbName());
    await s.create(PASS, IT);
    s.lock();
    expect(await s.unlock("not the right one")).toBe(false);
    expect(s.isUnlocked).toBe(false);
    await expect(s.getAll("cases")).rejects.toBeInstanceOf(LockedError);
  });

  it("data at rest is unreadable without the key", async () => {
    const s = new EncryptedStore(dbName());
    await s.create(PASS, IT);
    await s.put("cases", "c1", FAKE_CASE);
    const raw = JSON.stringify(await s.rawRecords());
    expect(raw).not.toContain("Kavya");
    expect(raw).not.toContain("98765");
  });

  it("unique IV per record", async () => {
    const s = new EncryptedStore(dbName());
    await s.create(PASS, IT);
    for (let i = 0; i < 10; i++) await s.put("cases", `c${i}`, FAKE_CASE);
    const ivs = new Set((await s.rawRecords()).map((r) => r.sealed.iv));
    expect(ivs.size).toBe(10);
  });

  it("erase removes everything", async () => {
    const name = dbName();
    const s = new EncryptedStore(name);
    await s.create(PASS, IT);
    await s.put("cases", "c1", FAKE_CASE);
    await s.erase();
    const s2 = new EncryptedStore(name);
    expect(await s2.exists()).toBe(false);
  });
});

describe("encrypted backup", () => {
  it("export/import round-trip into a fresh vault with a separate passphrase", async () => {
    const a = new EncryptedStore(dbName());
    await a.create(PASS, IT);
    await a.put("cases", "c1", FAKE_CASE);
    await a.put("notes", "n1", { text: "Fake note" });
    const file = await exportBackup(a, "separate backup phrase", IT);
    expect(file).not.toContain("Kavya");
    expect(JSON.parse(file).salt).toBeTruthy();

    const b = new EncryptedStore(dbName());
    await b.create("another device phrase", IT);
    await b.put("cases", "old", { stale: true });
    await importBackup(b, file, "separate backup phrase");
    expect(await b.get("cases", "c1")).toEqual(FAKE_CASE);
    expect(await b.get("cases", "old")).toBeUndefined();
    expect(await b.getAll("notes")).toHaveLength(1);
  });

  it("wrong backup passphrase fails and leaves current data untouched", async () => {
    const a = new EncryptedStore(dbName());
    await a.create(PASS, IT);
    await a.put("cases", "c1", FAKE_CASE);
    const file = await exportBackup(a, PASS, IT);
    await a.put("cases", "c2", { keep: true });
    await expect(importBackup(a, file, "wrong phrase here")).rejects.toThrow("BACKUP_INVALID");
    expect(await a.get("cases", "c2")).toEqual({ keep: true });
  });

  it("rejects a malformed file", async () => {
    await expect(decryptBackup("not json", PASS)).rejects.toThrow("BACKUP_INVALID");
    await expect(decryptBackup(JSON.stringify({ format: "other" }), PASS)).rejects.toThrow("BACKUP_INVALID");
  });
});

describe("auto-lock timing", () => {
  function setup(idleMs = 5 * 60_000, hiddenMs = 2 * 60_000) {
    let t = 0;
    const onLock = vi.fn();
    const al = new AutoLock({ idleMs, hiddenMs, now: () => t, onLock });
    return { al, onLock, advance: (ms: number) => (t += ms) };
  }

  it("locks after the idle timeout, not before", () => {
    const { al, onLock, advance } = setup();
    advance(4 * 60_000 + 59_000);
    expect(al.tick()).toBe(false);
    advance(1_000);
    expect(al.tick()).toBe(true);
    expect(onLock).toHaveBeenCalledTimes(1);
    expect(al.tick()).toBe(false); // only once
  });

  it("activity resets the idle timer", () => {
    const { al, onLock, advance } = setup();
    advance(4 * 60_000);
    al.activity();
    advance(4 * 60_000);
    al.tick();
    expect(onLock).not.toHaveBeenCalled();
  });

  it("locks when the tab was hidden too long (checked on return)", () => {
    const { al, onLock, advance } = setup();
    al.hidden();
    advance(2 * 60_000);
    al.visible();
    expect(onLock).toHaveBeenCalledTimes(1);
  });

  it("short hide does not lock", () => {
    const { al, onLock, advance } = setup();
    al.hidden();
    advance(30_000);
    al.visible();
    expect(onLock).not.toHaveBeenCalled();
  });
});

describe("session state clearing on lock", () => {
  const Item = z.object({ id: z.string(), name: z.string() });

  it("clears decrypted cache and blocks reads after lock", async () => {
    const s = new VaultSession(dbName());
    await s.init();
    expect(s.getSnapshot().status).toBe("none");
    await s.create(PASS, IT);
    await s.save("cases", Item, { id: "c1", name: "Fake Person" });
    expect(await s.list("cases", Item)).toHaveLength(1);
    expect(s.cachedCollections).toBe(1);
    s.lock();
    expect(s.getSnapshot().status).toBe("locked");
    expect(s.cachedCollections).toBe(0);
    await expect(s.list("cases", Item)).rejects.toBeInstanceOf(LockedError);
    expect(await s.unlock(PASS)).toBe(true);
    expect(await s.list("cases", Item)).toHaveLength(1);
  });

  it("skips invalid records instead of crashing", async () => {
    const s = new VaultSession(dbName());
    await s.create(PASS, IT);
    await s.store.put("cases", "bad", { nope: 1 });
    await s.save("cases", Item, { id: "c1", name: "Fake" });
    expect(await s.list("cases", Item)).toHaveLength(1);
  });
});

describe("passphrase strength", () => {
  it("scores weak and strong phrases", () => {
    expect(passphraseStrength("short")).toBe(0);
    expect(passphraseStrength("aaaaaaaaaaaa")).toBe(0);
    expect(passphraseStrength("blue mango river 42 tea")).toBeGreaterThanOrEqual(3);
  });
});
