// @ts-check
import { defineConfig } from "astro/config";
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from "@tailwindcss/vite";
import react from "@astrojs/react";

// https://astro.build/config
export default defineConfig({
  output: "server",
  integrations: [react()],

  vite: {
    plugins: [tailwindcss()],
    ssr: {
      noExternal: ['@lobehub/icons'],
    },
  },
  adapter: cloudflare({
    imageService: 'compile',
  }),
});
