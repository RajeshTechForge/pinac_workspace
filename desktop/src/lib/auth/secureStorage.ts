/**
 * secureStorage.ts — TypeScript facade for storing WorkOS auth tokens securely.
 *
 * STORAGE BACKEND: The existing AES-128-GCM encrypted-file mechanism in
 * `secure_storage.rs` (Rust side).  The encryption key is a 16-byte random
 * master key stored in the app data directory (`master.key`).
 *
 * TRADEOFF NOTE: This approach does NOT use the OS keychain (macOS Keychain,
 * Windows Credential Manager, Linux libsecret/Secret Service).  The master key
 * lives as a plaintext file in the app data directory, which means a local
 * attacker with filesystem read access could decrypt the tokens.  This is
 * equivalent to the protection offered by many Electron apps.
 *
 * TO UPGRADE: Swap the three Rust commands for tauri-plugin-stronghold or
 * a per-platform keychain plugin (tauri-plugin-keychain on macOS, etc.).
 * The TypeScript API surface below is intentionally stable so the swap is
 * transparent to all callers.
 */

import { invoke } from "@tauri-apps/api/core";

export interface StoredTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: number;
  readonly userId: string;
  readonly userEmail: string;
}

export async function saveTokens(tokens: StoredTokens): Promise<void> {
  const payload = JSON.stringify(tokens);
  await invoke<void>("auth_save_tokens", { jsonPayload: payload });
}

export async function getTokens(): Promise<StoredTokens | null> {
  const raw = await invoke<string | null>("auth_get_tokens");
  if (raw === null) return null;
  return JSON.parse(raw) as StoredTokens;
}

export async function clearTokens(): Promise<void> {
  await invoke<void>("auth_clear_tokens");
}
