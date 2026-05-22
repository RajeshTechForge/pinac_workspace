import { invoke } from "@tauri-apps/api/core";
import type { AppConfig } from "../types";

export async function readAppConfig(): Promise<AppConfig> {
  return invoke<AppConfig>("read_config");
}
