"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { z } from "zod";
import { getSession } from "@/lib/secure/session";
import { defaultSettings, SettingsSchema, type Settings } from "@/types/models";

const SERVER_SNAPSHOT = { status: "loading" as const, version: 0 };

export function useVault() {
  const session = getSession();
  const snap = useSyncExternalStore(session.subscribe, session.getSnapshot, () => SERVER_SNAPSHOT);
  return { session, ...snap };
}

/** Live, decrypted, validated view of one collection. Re-reads after every save/lock. */
export function useCollection<S extends z.ZodType>(col: string, schema: S) {
  const { session, status, version } = useVault();
  const [items, setItems] = useState<z.infer<S>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (status !== "unlocked") return;
    let alive = true;
    session
      .list(col, schema)
      .then((list) => {
        if (!alive) return;
        setItems(list);
        setError(false);
      })
      .catch(() => {
        if (alive) setError(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [session, status, version, col, schema]);

  const save = useCallback(
    (item: z.input<S> & { id: string }) => session.save(col, schema, item),
    [session, col, schema],
  );
  const remove = useCallback((itemId: string) => session.remove(col, itemId), [session, col]);

  return { items: status === "unlocked" ? items : [], loading, error, save, remove };
}

export function useSettings() {
  const { items, loading, save } = useCollection("settings", SettingsSchema);
  const settings: Settings = items[0] ?? defaultSettings();
  const update = useCallback(
    (patch: Partial<Settings>) => save({ ...settings, ...patch, id: "main" }),
    [save, settings],
  );
  return { settings, loading, update };
}

export function newId(): string {
  return crypto.randomUUID();
}
