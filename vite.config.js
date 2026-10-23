import { defineConfig } from 'vite';

// Relative base so the production build works from any sub-path
// (GitHub Pages project sites, a plain file server, or `vite preview`).
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 900
  },
  server: {
    port: 5173,
    open: false
  }
});
