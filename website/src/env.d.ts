/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly WORKOS_API_KEY: string;
  readonly WORKOS_CLIENT_ID: string;
  readonly WORKOS_COOKIE_PASSWORD: string;
  readonly WORKOS_APP_BASE_URL?: string;
  readonly WORKOS_POST_LOGIN_ROUTE?: string;
  readonly WORKOS_COOKIE_SECURE?: "true" | "false";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace App {
  interface Locals {
    user: import("./lib/workos").SafeUser | null;
  }
}
