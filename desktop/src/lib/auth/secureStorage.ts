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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Shape of the token bundle written to encrypted storage.
 * The `user` field is a snapshot from the most recent token exchange/refresh.
 */
export interface StoredTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
  /** Unix timestamp (ms) at which the access token expires. */
  readonly expiresAt: number;
  /** WorkOS user ID — used to identify the logged-in user without decoding the JWT. */
  readonly userId: string;
  readonly userEmail: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Encrypts and persists the token bundle.
 * Overwrites any previously stored tokens.
 * @throws if the Rust command fails (disk full, permission error, etc.).
 */
export async function saveTokens(tokens: StoredTokens): Promise<void> {
  const payload = JSON.stringify(tokens);
  await invoke<void>("auth_save_tokens", { jsonPayload: payload });
}

/**
 * Decrypts and returns the stored token bundle, or `null` if none exists
 * (i.e. the user has never logged in on this device, or tokens were cleared).
 * @throws if decryption fails (corrupt file, master key mismatch).
 */
export async function getTokens(): Promise<StoredTokens | null> {
  const raw = await invoke<string | null>("auth_get_tokens");
  if (raw === null) return null;
  return JSON.parse(raw) as StoredTokens;
}

/**
 * Deletes the stored token bundle from disk.
 * Safe to call even when no tokens are stored (no-op in that case).
 * @throws if the Rust command fails (permission error, etc.).
 */
export async function clearTokens(): Promise<void> {
  await invoke<void>("auth_clear_tokens");
}
