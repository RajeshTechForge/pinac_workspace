/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly WORKOS_API_KEY: string;
  readonly WORKOS_CLIENT_ID: string;
  readonly COOKIE_PASSWORD: string;
  readonly APP_BASE_URL?: string;
  readonly POST_LOGIN_ROUTE?: string;
  readonly COOKIE_SECURE?: "true" | "false";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace App {
  interface Locals {
    user: import("./lib/workos").SafeUser | null;
  }
}
