import { Platform } from "react-native";
import { ExtensionStorage } from "@bacons/apple-targets";
import { APP_GROUP, PENDING_TOGGLES_KEY } from "../config";
import { habitRepository } from "../data/habitRepository";
import { parsePendingToggles } from "./pendingToggles";
import { syncWidget } from "./syncWidget";

/**
 * Apply any completions toggled from the iOS widget while the app was away.
 * The widget's App Intent appends each toggle to a pending queue in the App
 * Group UserDefaults; here we drain that queue into MMKV.
 *
 * Uses absolute `setCompletion` (not a relative toggle), so re-applying the same
 * entry is idempotent. We apply first and clear the queue only afterwards, so a
 * crash mid-loop cannot silently lose widget taps.
 *
 * No-op on Android (its widget writes MMKV directly via the headless task).
 */
export function reconcileWidgetToggles(): boolean {
  if (Platform.OS !== "ios") return false;

  const storage = new ExtensionStorage(APP_GROUP);
  const raw = storage.get(PENDING_TOGGLES_KEY);
  const pending = parsePendingToggles(raw);

  if (pending.length === 0) {
    // Clear any malformed/empty residue so it doesn't accumulate.
    if (raw) storage.remove(PENDING_TOGGLES_KEY);
    return false;
  }

  for (const toggle of pending) {
    habitRepository.setCompletion(toggle.habitId, toggle.date, toggle.done);
  }
  storage.remove(PENDING_TOGGLES_KEY);

  // Re-publish a fresh snapshot so the widget reflects the reconciled state.
  syncWidget();
  return true;
}
