import { invoke } from "@tauri-apps/api/core";

/**
 * Persists an encrypted copy of the API key inside the app's data directory
 * via the Tauri backend. The plaintext string is passed only once across the
 * IPC boundary and must be dropped by the caller immediately after this call.
 *
 * @throws {string} Human-readable error forwarded from the Rust command.
 */
export async function saveApiKey(plaintext: string): Promise<void> {
  await invoke<void>("save_api_key", { plaintextKey: plaintext });
}

/**
 * Returns `true` when an encrypted API key file is present in the app's
 * data directory. Does not decrypt or return any key material.
 *
 * @throws {string} Human-readable error forwarded from the Rust command.
 */
export async function apiKeyExists(): Promise<boolean> {
  return invoke<boolean>("api_key_exists");
}
