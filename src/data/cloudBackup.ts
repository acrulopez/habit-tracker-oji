import { Platform } from "react-native";
import { generateId } from "../lib/id";
import { dateKeyToOffset, offsetToDateKey } from "../lib/dates";
import { habitRepository } from "./habitRepository";
import { getKv } from "./mmkv";
import type { Habit } from "./types";

/**
 * iCloud Key-Value Store backup.
 *
 * MMKV stays the on-device source of truth; this module mirrors it to the
 * free per-app 1 MB iCloud KVS bucket (NSUbiquitousKeyValueStore), which does
 * NOT consume the user's iCloud storage quota. It uses the signed-in iCloud
 * account with no login UI, so backup is automatic when available and silently
 * local-only otherwise.
 *
 * Conflict resolution is last-write-wins on a single blob keyed by
 * `lastModified`. The whole habit + completions store fits in one KVS value,
 * with completion dates encoded as day-offsets for headroom under the 1 MB cap.
 */

/** The single KVS key holding the whole backup blob. */
const CLOUD_KEY = "habitBackup";
const SCHEMA_VERSION = 1;

// Local MMKV bookkeeping (namespaced so it never collides with habits/completions:*).
const ENABLED_KEY = "backup:enabled";
const LAST_MODIFIED_KEY = "backup:lastModified"; // ISO of last local data change
const DEVICE_ID_KEY = "backup:deviceId";
const LAST_UPLOAD_KEY = "backup:lastUpload"; // ISO of last successful cloud write
const QUOTA_KEY = "backup:quotaExceeded";

/** Wait this long after the last change before uploading, to coalesce bursts. */
const DEBOUNCE_MS = 3000;

export type BackupBlob = {
  schemaVersion: number;
  lastModified: string;
  deviceId: string;
  habits: Habit[];
  completions: Record<string, number[]>; // habitId -> day offsets from epoch
};

// --- Lazy native-module access ------------------------------------------------
// Loaded via require() inside a guard so importing this module never pulls the
// native iOS code on Android or under Jest.
type CloudModule = typeof import("@nauverse/expo-cloud-settings");
let cloudModule: CloudModule | null | undefined;

function getCloud(): CloudModule | null {
  if (Platform.OS !== "ios") return null;
  if (cloudModule === undefined) {
    try {
      cloudModule = require("@nauverse/expo-cloud-settings") as CloudModule;
    } catch {
      cloudModule = null;
    }
  }
  return cloudModule;
}

/** True when iCloud KVS is usable (iOS + signed into iCloud). */
export function isCloudAvailable(): boolean {
  const cloud = getCloud();
  if (!cloud) return false;
  try {
    return cloud.isAvailable();
  } catch {
    return false;
  }
}

// --- Local flags / bookkeeping ------------------------------------------------

function nowIso(): string {
  return new Date().toISOString();
}

/** Backup defaults ON; only an explicit "false" disables it. */
export function isBackupEnabled(): boolean {
  return getKv().getString(ENABLED_KEY) !== "false";
}

export function setBackupEnabled(enabled: boolean): void {
  getKv().set(ENABLED_KEY, enabled ? "true" : "false");
  if (enabled) scheduleUpload();
}

/** ISO timestamp of the last successful upload, or null if never. */
export function getLastBackupTime(): string | null {
  return getKv().getString(LAST_UPLOAD_KEY) ?? null;
}

/** True if the last upload hit the 1 MB KVS quota (local copy kept intact). */
export function hasQuotaWarning(): boolean {
  return getKv().getString(QUOTA_KEY) === "true";
}

function getLocalLastModified(): string | null {
  return getKv().getString(LAST_MODIFIED_KEY) ?? null;
}

function getDeviceId(): string {
  const kv = getKv();
  let id = kv.getString(DEVICE_ID_KEY);
  if (!id) {
    id = generateId();
    kv.set(DEVICE_ID_KEY, id);
  }
  return id;
}

// --- Serialize / apply --------------------------------------------------------

/** Build the backup blob from the current on-device store. */
export function encode(): BackupBlob {
  const { habits, completions } = habitRepository.exportAll();
  const encoded: Record<string, number[]> = {};
  for (const [habitId, dates] of Object.entries(completions)) {
    encoded[habitId] = dates.map(dateKeyToOffset);
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    lastModified: getLocalLastModified() ?? nowIso(),
    deviceId: getDeviceId(),
    habits,
    completions: encoded,
  };
}

/** Write a remote blob into MMKV, adopting its timestamp so we don't bounce. */
function apply(blob: BackupBlob): void {
  const completions: Record<string, string[]> = {};
  for (const [habitId, offsets] of Object.entries(blob.completions ?? {})) {
    completions[habitId] = offsets.map(offsetToDateKey);
  }
  habitRepository.importAll(blob.habits ?? [], completions);
  getKv().set(LAST_MODIFIED_KEY, blob.lastModified);
}

// --- Upload -------------------------------------------------------------------

let uploadTimer: ReturnType<typeof setTimeout> | null = null;
let pendingUpload = false;

/** Mark the store dirty and schedule a debounced upload. */
export function scheduleUpload(): void {
  if (!isBackupEnabled()) return;
  getKv().set(LAST_MODIFIED_KEY, nowIso());
  pendingUpload = true;
  if (uploadTimer) clearTimeout(uploadTimer);
  uploadTimer = setTimeout(() => {
    uploadTimer = null;
    uploadNow();
  }, DEBOUNCE_MS);
}

/** Push a pending upload immediately (e.g. when the app backgrounds). */
export function flushPendingUpload(): void {
  if (!pendingUpload) return;
  if (uploadTimer) {
    clearTimeout(uploadTimer);
    uploadTimer = null;
  }
  uploadNow();
}

function uploadNow(): void {
  if (!isBackupEnabled()) {
    pendingUpload = false;
    return;
  }
  const cloud = getCloud();
  if (!cloud || !isCloudAvailable()) return; // stay pending; retry later
  try {
    cloud.setObject(CLOUD_KEY, encode());
    getKv().set(LAST_UPLOAD_KEY, nowIso());
    getKv().remove(QUOTA_KEY);
    pendingUpload = false;
  } catch (e) {
    // Never throw / drop data — keep the local copy and retry later.
    console.warn("[cloudBackup] upload failed", e);
  }
}

// --- Restore / pull -----------------------------------------------------------

let restoreAttempted = false;

/**
 * Cold-launch restore. Runs at most once per process. Applies the remote blob
 * when local is empty or the remote is strictly newer (last-write-wins).
 * Returns true if it changed local data (caller should refresh the UI).
 *
 * MUST be called after the widget-toggle reconcile so genuine local widget
 * taps (which bump lastModified) are never clobbered by a stale remote.
 */
export function restoreOnLaunch(): boolean {
  if (restoreAttempted) return false;
  restoreAttempted = true;
  if (!isBackupEnabled()) return false;
  return pullIfNewer();
}

function pullIfNewer(): boolean {
  const cloud = getCloud();
  if (!cloud || !isCloudAvailable()) return false;
  let remote: BackupBlob | null = null;
  try {
    remote = cloud.getObject<BackupBlob>(CLOUD_KEY);
  } catch (e) {
    console.warn("[cloudBackup] read failed", e);
    return false;
  }
  if (!remote || !Array.isArray(remote.habits)) return false;

  const local = getLocalLastModified();
  const localEmpty = habitRepository.exportAll().habits.length === 0;
  if (localEmpty || local === null || remote.lastModified > local) {
    apply(remote);
    return true;
  }
  return false;
}

// --- Multi-device change listener ---------------------------------------------

/**
 * Subscribe to iCloud store changes (another device pushing data, quota, or
 * account switches). Calls onApplied() after remote data is merged in so the
 * caller can refresh. Returns an unsubscribe function.
 */
export function registerCloudListener(onApplied: () => void): () => void {
  const cloud = getCloud();
  if (!cloud) return () => {};
  try {
    const sub = cloud.addChangeListener((event) => {
      if (event.reason === "quotaViolation") {
        getKv().set(QUOTA_KEY, "true");
        console.warn(
          "[cloudBackup] iCloud key-value store quota exceeded; keeping local copy",
        );
        return;
      }
      if (event.reason === "accountChange") {
        // iCloud sign-in/out/switch: re-evaluate against whatever account is now active.
        if (pullIfNewer()) onApplied();
        return;
      }
      // serverChange / initialSync: a newer value arrived from another device.
      if (!event.changedKeys.includes(CLOUD_KEY)) return;
      if (pullIfNewer()) onApplied();
    });
    return () => sub.remove();
  } catch (e) {
    console.warn("[cloudBackup] listener registration failed", e);
    return () => {};
  }
}
