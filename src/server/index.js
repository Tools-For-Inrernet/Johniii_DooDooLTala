/**
 * Webvisor Server - Node.js 22 LTS with PostgreSQL
 * Main server entry point
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PostgresStore } from './storage/PostgresStore.js';
import { createWebvisorRoutes } from './routes/webvisor.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = join(__dirname, '../..');

// Configuration
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// PostgreSQL Configuration
const PG_CONFIG = {
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432', 10),
  database: process.env.PG_DATABASE || 'webvisor',
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || 'postgres',
  retentionDays: parseInt(process.env.RETENTION_DAYS || '15', 10)
};

// MIME types for static files - FIXED for module scripts
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

// Initialize PostgreSQL store
const store = new PostgresStore(PG_CONFIG);

// Initialize routes
let webvisorRoutes;

/**
 * Reads request body as JSON
 * @param {import('node:http').IncomingMessage} req
 * @returns {Promise<object>}
 */
async function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Gets client IP address from request
 * @param {import('node:http').IncomingMessage} req
 * @returns {string}
 */
function getClientIP(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIP = req.headers['x-real-ip'];
  if (realIP) {
    return realIP;
  }
  return req.socket.remoteAddress || 'unknown';
}

/**
 * Serves static files with proper MIME types
 * @param {string} filePath
 * @returns {Promise<{status: number, headers: object, body: Buffer|string}>}
 */
async function serveStatic(filePath) {
  try {
    // Normalize path and prevent directory traversal
    const safePath = filePath.replace(/\.\./g, '').replace(/\/+/g, '/');
    const fullPath = join(PROJECT_ROOT, safePath);

    const content = await readFile(fullPath);
    const ext = extname(fullPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    return {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600'
      },
      body: content
    };
  } catch (error) {
    return {
      status: 404,
      headers: { 'Content-Type': 'text/plain' },
      body: 'Not Found'
    };
  }
}

/**
 * Sends response
 * @param {import('node:http').ServerResponse} res
 * @param {number} status
 * @param {object} headers
 * @param {*} body
 */
function sendResponse(res, status, headers, body) {
  res.writeHead(status, headers);
  res.end(body);
}

/**
 * Sends JSON response
 * @param {import('node:http').ServerResponse} res
 * @param {number} status
 * @param {object} data
 */
function sendJSON(res, status, data) {
  sendResponse(res, status, { 'Content-Type': 'application/json' }, JSON.stringify(data));
}

/**
 * Main request handler
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 */
async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;
  const method = req.method;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return sendResponse(res, 204, {}, '');
  }

  try {
    // API Routes
    if (path.startsWith('/api/webvisor')) {
      const clientIP = getClientIP(req);

      // POST /api/webvisor/events
      if (path === '/api/webvisor/events' && method === 'POST') {
        const body = await readBody(req);
        body.clientIP = clientIP;
        const result = await webvisorRoutes.postEvents(body);
        return sendJSON(res, result.status, result.data);
      }

      // GET /api/webvisor/sessions
      if (path === '/api/webvisor/sessions' && method === 'GET') {
        const limit = parseInt(url.searchParams.get('limit') || '50', 10);
        const offset = parseInt(url.searchParams.get('offset') || '0', 10);
        const result = await webvisorRoutes.listSessions({ limit, offset });
        return sendJSON(res, result.status, result.data);
      }

      // GET /api/webvisor/sessions/:id
      const sessionMatch = path.match(/^\/api\/webvisor\/sessions\/([^/]+)$/);
      if (sessionMatch && method === 'GET') {
        const result = await webvisorRoutes.getSession(sessionMatch[1]);
        return sendJSON(res, result.status, result.data);
      }

      // DELETE /api/webvisor/sessions/:id
      if (sessionMatch && method === 'DELETE') {
        const result = await webvisorRoutes.deleteSession(sessionMatch[1]);
        return sendJSON(res, result.status, result.data);
      }

      // GET /api/webvisor/visitors
      if (path === '/api/webvisor/visitors' && method === 'GET') {
        const result = await webvisorRoutes.listVisitors();
        return sendJSON(res, result.status, result.data);
      }

      return sendJSON(res, 404, { error: 'Not Found' });
    }

    // Static files
    let filePath;
    if (path === '/' || path === '/index.html') {
      filePath = 'index.html';
    } else if (path === '/monitor' || path === '/monitor.html') {
      filePath = 'monitor.html';
    } else if (path === '/sample' || path === '/sample.html') {
      filePath = 'sample.html';
    } else if (path.startsWith('/src/') || path.startsWith('/css/') || path.startsWith('/js/') || path.startsWith('/assets/')) {
      filePath = path.slice(1);
    } else {
      filePath = path.slice(1);
    }

    const staticResult = await serveStatic(filePath);
    return sendResponse(res, staticResult.status, staticResult.headers, staticResult.body);

  } catch (error) {
    console.error('[Server] Error:', error);
    return sendJSON(res, 500, { error: 'Internal Server Error' });
  }
}

// Create server
const server = createServer(handleRequest);

// Initialize and start
async function start() {
  try {
    console.log('[Server] Connecting to PostgreSQL...');
    await store.init();
    console.log('[Server] PostgreSQL connected and tables created');

    webvisorRoutes = createWebvisorRoutes(store);

    server.listen(PORT, HOST, () => {
      console.log(`
╔═══════════════════════════════════════════════════════════╗
║              Webvisor Server Started                      ║
╠═══════════════════════════════════════════════════════════╣
║  Server:    http://${HOST}:${PORT}
║  Monitor:   http://${HOST}:${PORT}/monitor
║  Sample:    http://${HOST}:${PORT}/sample
║  Database:  PostgreSQL (${PG_CONFIG.host}:${PG_CONFIG.port})
║  Retention: ${PG_CONFIG.retentionDays} days
╚═══════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('[Server] Failed to start:', error.message);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n[Server] Shutting down...');
  await store.close();
  server.close(() => {
    console.log('[Server] Goodbye!');
    process.exit(0);
  });
});

process.on('SIGTERM', async () => {
  await store.close();
  server.close(() => process.exit(0));
});

start();

export { server, store };
