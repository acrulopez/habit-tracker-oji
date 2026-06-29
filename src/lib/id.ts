import * as Crypto from "expo-crypto";

function fallbackUuid(): string {
  // RFC4122-ish v4 fallback for environments without native crypto.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function generateId(): string {
  try {
    return Crypto.randomUUID();
  } catch {
    return fallbackUuid();
  }
}
