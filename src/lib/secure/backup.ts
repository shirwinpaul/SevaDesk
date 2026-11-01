// Encrypted backup files. The whole decrypted dump is re-encrypted with a key derived
// from the backup passphrase (main or separate) and a NEW random salt, so a backup
// file is useless without its passphrase.

import { z } from "zod";
import { decryptJson, deriveKey, encryptJson, fromB64, PBKDF2_ITERATIONS, randomBytes, SALT_BYTES, toB64 } from "./crypto";
import type { CollectionDump, EncryptedStore } from "./store";

export const BACKUP_FORMAT = "sevadesk-backup";

const BackupFileSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  v: z.literal(1),
  createdAt: z.string(),
  salt: z.string().min(1),
  iterations: z.number().int().positive(),
  iv: z.string().min(1),
  ct: z.string().min(1),
});
export type BackupFile = z.infer<typeof BackupFileSchema>;

const DumpSchema = z.record(z.string(), z.array(z.object({ id: z.string(), value: z.unknown() })));

export async function encryptDump(
  dump: CollectionDump,
  passphrase: string,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await deriveKey(passphrase, salt, iterations);
  const sealed = await encryptJson(key, dump, BACKUP_FORMAT);
  const file: BackupFile = {
    format: BACKUP_FORMAT,
    v: 1,
    createdAt: new Date().toISOString(),
    salt: toB64(salt),
    iterations,
    ...sealed,
  };
  return JSON.stringify(file);
}

/** Throws a plain Error("BACKUP_INVALID") for a bad file OR a wrong passphrase. */
export async function decryptBackup(fileText: string, passphrase: string): Promise<CollectionDump> {
  let file: BackupFile;
  try {
    file = BackupFileSchema.parse(JSON.parse(fileText));
  } catch {
    throw new Error("BACKUP_INVALID");
  }
  try {
    const key = await deriveKey(passphrase, fromB64(file.salt), file.iterations);
    const dump = await decryptJson(key, { iv: file.iv, ct: file.ct }, BACKUP_FORMAT);
    return DumpSchema.parse(dump);
  } catch {
    throw new Error("BACKUP_INVALID");
  }
}

export async function exportBackup(store: EncryptedStore, passphrase: string, iterations?: number): Promise<string> {
  return encryptDump(await store.dumpAll(), passphrase, iterations);
}

/** Decrypts first; only if that succeeds does it replace the current data. */
export async function importBackup(store: EncryptedStore, fileText: string, passphrase: string): Promise<void> {
  const dump = await decryptBackup(fileText, passphrase);
  await store.replaceAll(dump);
}
