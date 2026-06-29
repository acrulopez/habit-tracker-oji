import { createMMKV, type MMKV } from "react-native-mmkv";

// The subset of the MMKV API the app relies on. Keeping it small lets unit
// tests inject a plain in-memory implementation (see createMemoryKv) instead of
// the native module.
export type Kv = Pick<
  MMKV,
  "getString" | "set" | "remove" | "getAllKeys" | "contains"
>;

let instance: Kv | null = null;

/**
 * Shared MMKV instance. On iOS, because an `AppGroup` is set in Info.plist and
 * no `path` is provided, MMKV stores into the App Group container (so it can be
 * shared with extensions later if needed).
 */
export function getKv(): Kv {
  if (!instance) {
    instance = createMMKV({ id: "habits" });
  }
  return instance;
}

/** Test seam: swap the backing store (e.g. with createMemoryKv()). */
export function setKvForTesting(kv: Kv | null): void {
  instance = kv;
}

/** A dependency-free in-memory Kv, used by unit tests. */
export function createMemoryKv(): Kv {
  const map = new Map<string, string>();
  return {
    getString: (key) => map.get(key),
    set: (key, value) => {
      map.set(key, String(value));
    },
    remove: (key) => {
      const had = map.has(key);
      map.delete(key);
      return had;
    },
    getAllKeys: () => Array.from(map.keys()),
    contains: (key) => map.has(key),
  };
}
