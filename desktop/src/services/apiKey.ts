import { invoke } from "@tauri-apps/api/core";

export async function saveApiKey(
  keyName: string,
  plaintext: string,
): Promise<void> {
  await invoke<void>("save_api_key", { keyName, plaintextKey: plaintext });
}

// Returns `true` when `<app_data_dir>/<keyName>.enc` is present on disk.
export async function apiKeyExists(keyName: string): Promise<boolean> {
  return invoke<boolean>("api_key_exists", { keyName });
}
