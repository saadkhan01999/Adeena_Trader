import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/**
 * ============================================
 * Vite Configuration
 * ============================================
 * https://vitejs.dev/config/
 */
/**
 * Emit the list of built files for the service worker to precache.
 *
 * The worker is hand-written and cannot know the content-hashed filenames
 * Vite produces. Without this it can only cache assets as they are requested -
 * and on a first visit the worker is not yet controlling the page, so the very
 * requests that load the app bypass it entirely. The app would then fail to
 * open offline until the user happened to reload twice while online, which is
 * not something anyone will do on purpose.
 */
const swManifest = () => ({
  name: 'adeena-sw-manifest',
  apply: 'build',
  generateBundle(_options, bundle) {
    const files = Object.keys(bundle)
      .filter((f) => /\.(js|css)$/.test(f))
      .map((f) => `/${f}`);

    this.emitFile({
      type: 'asset',
      fileName: 'sw-manifest.json',
      source: JSON.stringify({ files }, null, 2),
    });
  },
});

export default defineConfig({
  plugins: [react(), swManifest()],

  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },

  server: {
    port: 8000,
    // `host: true` binds to every interface, so the shop can open the app from
    // a phone on the same wifi during development.
    host: true,
    proxy: {
      // Same-origin API and uploads in development, which keeps the refresh
      // cookie first-party and avoids CORS entirely.
      '/api': { target: 'http://localhost:5000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:5000', changeOrigin: true },
    },
  },

  preview: { port: 8000, host: true },

  build: {
    outDir: 'dist',
    sourcemap: false,
    // Below this, an asset is inlined as a data URI rather than fetched
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 700,

    rollupOptions: {
      output: {
        /**
         * Split the heavy libraries into their own long-lived chunks.
         *
         * Charts (recharts + d3) are ~400 kB and are only needed on the
         * dashboard and reports; motion is used everywhere but changes rarely.
         * Separating them means a code change to the app does not invalidate
         * the cached vendor bundles, which matters on a slow connection.
         */
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;

          // PDF and image tooling is left for Rollup to place. It is reached
          // only through a dynamic import in utils/documentExport, so Rollup
          // gives it an async chunk fetched the first time someone exports.
          //
          // Naming it here instead - as a manual chunk - is what made it
          // EAGER: a manually named chunk becomes part of the entry's static
          // graph, so 640 kB was preloaded on every visit for the majority of
          // users who never export anything. Returning undefined hands the
          // decision back to Rollup, which splits it correctly.
          if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('canvg')
              || id.includes('dompurify') || id.includes('rgbcolor')
              // jspdf's transitive runtime helpers. Without these two the
              // helpers alone fell through to the shared `vendor` chunk and
              // were loaded eagerly - 115 kB on every visit to support a
              // feature almost nobody opens.
              || id.includes('@babel/runtime') || id.includes('core-js')) {
            return undefined;
          }

          if (id.includes('recharts') || id.includes('d3-') || id.includes('victory-vendor')) {
            return 'vendor-charts';
          }
          if (id.includes('framer-motion') || id.includes('motion-dom') || id.includes('motion-utils')) {
            return 'vendor-motion';
          }
          if (id.includes('react-router')) return 'vendor-router';
          if (id.includes('lucide-react')) return 'vendor-icons';
          if (id.includes('/react/') || id.includes('react-dom') || id.includes('scheduler')) {
            return 'vendor-react';
          }
          if (id.includes('axios') || id.includes('zustand') || id.includes('zod')) {
            return 'vendor-core';
          }
          return 'vendor';
        },
      },
    },
  },
});
