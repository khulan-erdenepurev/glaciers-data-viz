import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        prototype: fileURLToPath(new URL('./index.html', import.meta.url)),
        overview: fileURLToPath(new URL('./overview.html', import.meta.url)),
      },
    },
  },
});
