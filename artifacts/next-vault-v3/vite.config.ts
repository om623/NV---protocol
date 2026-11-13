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
    {
      // Development diagnostics only (a dev-server hook; it does not exist in production builds). Logs when a browser connects
      // Vite's own HMR WebSocket, with the page origin: it shows whether the edge in front of the dev server delivers WebSockets
      // at all and whether it keeps the Origin header. No URL, token or payload is logged.
      name: 'nv-ws-diagnostics',
      configureServer(server) {
        server.ws.on('connection', (socket, req) => {
          const t0 = Date.now();
          console.info(`[ws-diag] HMR client connected, origin=${req?.headers?.origin ?? '-'}`);
          socket.on('close', () => console.info(`[ws-diag] HMR client closed after ${Date.now() - t0} ms`));
        });
      },
    },
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
    // Pre-bundled at server start: left to lazy discovery, the first WalletConnect open would re-bundle mid-session and reload the page.
    include: ['three', 'three/examples/jsm/controls/OrbitControls.js', 'topojson-client', 'qrcode', '@walletconnect/ethereum-provider'],
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
      // WalletConnect relay for the dev server and the Arc Studio Preview. The Preview page is served under a
      // "connect-src 'self'" policy, so the browser may only open a WebSocket to its own origin. lib/walletConnect.ts
      // points the SDK at /wc-relay when running in development, and this forwards it to the Reown relay. The browser's
      // Origin header is passed through untouched (the Reown domain allowlist checks it). Production builds never use
      // this path (see lib/walletConnect.ts) and `preview` has no proxy, so production keeps the direct relay.
      '/wc-relay': {
        target: 'https://relay.walletconnect.org',
        changeOrigin: true,
        ws: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/wc-relay\/?/, '/'),
        configure: (proxy) => {
          // Development diagnostics, one line per relay connection. Safe by construction: it logs counters, durations, the page
          // origin and header NAMES only. It never logs a URL, a query string, a header value (other than the origin) or a payload,
          // because the URL carries the relay auth token.
          let seq = 0;
          let namesLogged = false;
          proxy.on('proxyReqWs', (proxyReq, req, socket) => {
            const id = ++seq;
            const t0 = Date.now();
            // Subprotocol, negotiated one hop at a time (RFC 6455, section 4.2.2). The edge in front of the dev server (the Arc Studio
            // Preview) opens the WebSocket offering a subprotocol, and a strict WebSocket client aborts, here with close code 1011, when
            // the 101 does not select one of the offered values. The Reown relay speaks no subprotocol: it ignores the offer and never
            // selects anything. So this proxy, acting as the WebSocket server toward the edge, selects the first offered value in the
            // 101, and the request to the relay goes out without the header, exactly like a direct SDK connection (the relay is never
            // asked for something it cannot honour). Only valid RFC 7230 tokens are echoed, so nothing from the client can inject a header.
            const offered = String(req.headers['sec-websocket-protocol'] ?? '').split(',')[0].trim();
            const selected = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(offered) ? offered : '';
            if (selected) {
              proxyReq.removeHeader('sec-websocket-protocol');
              // prependListener: run before the proxy's own 'upgrade' handler, which writes proxyRes.headers into the 101 sent downstream.
              proxyReq.prependListener('upgrade', (res) => {
                if (!res.headers['sec-websocket-protocol']) res.headers['sec-websocket-protocol'] = selected;
              });
            }
            console.info(`[wc-relay] #${id} upgrade requested, origin=${req.headers.origin ?? '-'}, extensions=${req.headers['sec-websocket-extensions'] ? 'offered' : 'none'}, subprotocol=${selected ? 'offered and selected in the 101' : req.headers['sec-websocket-protocol'] ? 'offered but not a valid token (left as is)' : 'none offered'}`);
            if (!namesLogged) {
              namesLogged = true;
              const hidden = new Set(['cookie', 'authorization', 'sec-websocket-key']);
              console.info(`[wc-relay] header names of the first upgrade: ${Object.keys(req.headers).filter((h) => !hidden.has(h)).sort().join(',')}`);
              // Values only for a fixed list of non-sensitive routing headers (they identify the edge in front of the dev server).
              const shown = ['host', 'x-forwarded-proto', 'x-forwarded-host', 'forwarded', 'via', 'user-agent', 'sec-websocket-version', 'connection', 'upgrade'];
              console.info(`[wc-relay] routing headers of the first upgrade: ${shown.filter((h) => req.headers[h]).map((h) => `${h}=${String(req.headers[h]).slice(0, 90)}`).join(' | ')}`);
            }
            proxyReq.on('upgrade', (res) => console.info(`[wc-relay] #${id} relay accepted the upgrade (101), extensions=${res.headers['sec-websocket-extensions'] ? 'negotiated' : 'none'}`));
            proxyReq.on('response', (res) => console.warn(`[wc-relay] #${id} relay refused the upgrade: HTTP ${res.statusCode}`));
            socket.on('close', () => console.info(`[wc-relay] #${id} closed after ${Date.now() - t0} ms, browser->relay ${socket.bytesRead} B, relay->browser ${socket.bytesWritten} B`));
          });
          proxy.on('error', (err) => console.warn(`[wc-relay] proxy error: ${err.message}`));
        },
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
