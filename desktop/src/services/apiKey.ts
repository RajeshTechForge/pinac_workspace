import { invoke } from "@tauri-apps/api/core";

/**
 * Persists an encrypted copy of an API key to `<app_data_dir>/<keyName>.enc`
 * via the Tauri backend.
 *
 * `keyName` must be the `apiKeyName` value from `config.toml` for the
 * chosen provider (e.g. `"GEMINI_API_KEY"`). The plaintext string crosses
 * the IPC boundary exactly once and must be dropped by the caller immediately
 * after this resolves.
 *
 * @throws {string} Human-readable error forwarded from the Rust command.
 */
export async function saveApiKey(keyName: string, plaintext: string): Promise<void> {
  await invoke<void>("save_api_key", { keyName, plaintextKey: plaintext });
}

/**
 * Returns `true` when `<app_data_dir>/<keyName>.enc` is present on disk.
 *
 * `keyName` must match the `apiKeyName` from `config.toml` for the provider
 * being queried. Does not decrypt or return any key material.
 *
 * @throws {string} Human-readable error forwarded from the Rust command.
 */
export async function apiKeyExists(keyName: string): Promise<boolean> {
  return invoke<boolean>("api_key_exists", { keyName });
}
