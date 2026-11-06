import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';

const port = process.env.PORT ? Number(process.env.PORT) : 5173;
const basePath = process.env.BASE_PATH || '/';

// Dev-only: serves the same /api/radar-* functions that Vercel runs in production
// (api/radar-sec.ts and api/radar-news.ts at the repository root).
function radarApi(): Plugin {
  return {
    name: 'nv-radar-api',
    configureServer(server) {
      const repoRoot = path.resolve(import.meta.dirname, '..', '..');
      const env = loadEnv('development', repoRoot, '');
      if (env.SEC_USER_AGENT && !process.env.SEC_USER_AGENT) process.env.SEC_USER_AGENT = env.SEC_USER_AGENT;
      for (const name of ['radar-sec', 'radar-news']) {
        server.middlewares.use(`/api/${name}`, async (req: IncomingMessage, res: ServerResponse) => {
          try {
            const mod = await server.ssrLoadModule(path.resolve(repoRoot, 'api', `${name}.ts`));
            await (mod.default as (a: IncomingMessage, b: ServerResponse) => Promise<void>)(req, res);
          } catch {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'internal' }));
          }
        });
      }
    },
  };
}

export default defineConfig({
  base: basePath,
  envDir: path.resolve(import.meta.dirname, '..', '..'),
  plugins: [
    react(),
    tailwindcss(),
    radarApi(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  // Global Radar: pre-bundle its heavy 3D dependencies when the dev server starts. Left to lazy
  // discovery, the first visit re-bundles them mid-session (slow first open, page reload).
  optimizeDeps: {
    include: ['three', 'three/examples/jsm/controls/OrbitControls.js', 'topojson-client'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
  },
  server: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
    fs: {
      strict: true,
    },
    proxy: {
      '/b3-index-proxy': {
        target: 'https://dadosb3.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/b3-index-proxy/, ''),
      },
      // Proxy Yahoo Finance chart API to avoid CORS — no API key required
      '/yf-proxy': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/yf-proxy/, ''),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      },
    },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
