/**
 * Webvisor Server - Node.js 22 LTS
 * Main server entry point
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SessionStore } from './storage/SessionStore.js';
import { createWebvisorRoutes } from './routes/webvisor.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = join(__dirname, '../..');

// Configuration
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const DATA_PATH = process.env.DATA_PATH || join(PROJECT_ROOT, 'data/sessions');
const RETENTION_DAYS = parseInt(process.env.RETENTION_DAYS || '15', 10);

// MIME types for static files
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Initialize session store
const sessionStore = new SessionStore({
  storagePath: DATA_PATH,
  retentionDays: RETENTION_DAYS
});

// Initialize routes
const webvisorRoutes = createWebvisorRoutes(sessionStore);

/**
 * Converts Node.js IncomingMessage to Web Request
 * @param {import('node:http').IncomingMessage} req
 * @returns {Request}
 */
function toWebRequest(req) {
  const protocol = req.socket.encrypted ? 'https' : 'http';
  const url = `${protocol}://${req.headers.host}${req.url}`;

  const init = {
    method: req.method,
    headers: req.headers
  };

  // Add body for POST/PUT/PATCH
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    init.body = req;
    init.duplex = 'half';
  }

  return new Request(url, init);
}

/**
 * Sends a Web Response through Node.js ServerResponse
 * @param {Response} webResponse
 * @param {import('node:http').ServerResponse} res
 */
async function sendWebResponse(webResponse, res) {
  res.statusCode = webResponse.status;

  for (const [key, value] of webResponse.headers) {
    res.setHeader(key, value);
  }

  if (webResponse.body) {
    const reader = webResponse.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
  }

  res.end();
}

/**
 * Serves static files
 * @param {string} filePath
 * @returns {Response}
 */
async function serveStatic(filePath) {
  try {
    const fullPath = join(PROJECT_ROOT, filePath);
    const content = await readFile(fullPath);
    const ext = extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    return new Response(content, {
      status: 200,
      headers: { 'Content-Type': contentType }
    });
  } catch (error) {
    return new Response('Not Found', { status: 404 });
  }
}

/**
 * Main request handler
 * @param {Request} req
 * @returns {Response}
 */
async function handleRequest(req) {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  // Add CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  let response;

  // API Routes
  if (path.startsWith('/api/webvisor')) {
    // POST /api/webvisor/events
    if (path === '/api/webvisor/events' && method === 'POST') {
      response = await webvisorRoutes.postEvents(req);
    }
    // GET /api/webvisor/sessions
    else if (path === '/api/webvisor/sessions' && method === 'GET') {
      response = await webvisorRoutes.listSessions(req);
    }
    // GET/DELETE /api/webvisor/sessions/:id
    else if (path.startsWith('/api/webvisor/sessions/')) {
      const sessionId = path.split('/')[4];
      if (method === 'GET') {
        response = await webvisorRoutes.getSession(req, sessionId);
      } else if (method === 'DELETE') {
        response = await webvisorRoutes.deleteSession(req, sessionId);
      }
    }

    if (!response) {
      response = new Response(
        JSON.stringify({ error: 'Not Found' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  }
  // Static files
  else if (path === '/' || path === '/index.html') {
    response = await serveStatic('index.html');
  }
  else if (path.startsWith('/css/') || path.startsWith('/js/') || path.startsWith('/assets/')) {
    response = await serveStatic(path.slice(1));
  }
  // Client SDK
  else if (path === '/webvisor.js') {
    response = await serveStatic('dist/webvisor.js');
  }
  else {
    response = new Response('Not Found', { status: 404 });
  }

  // Add CORS headers to response
  const newHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders)) {
    newHeaders.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}

// Create and start server
const server = createServer(async (req, res) => {
  try {
    const webRequest = toWebRequest(req);
    const response = await handleRequest(webRequest);
    await sendWebResponse(response, res);
  } catch (error) {
    console.error('[Server] Error:', error);
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
});

// Initialize and start
sessionStore.init().then(() => {
  server.listen(PORT, HOST, () => {
    console.log(`
╔═══════════════════════════════════════════════════╗
║           Webvisor Server Started                 ║
╠═══════════════════════════════════════════════════╣
║  URL: http://${HOST}:${PORT}
║  Data: ${DATA_PATH}
║  Retention: ${RETENTION_DAYS} days
╚═══════════════════════════════════════════════════╝
    `);
  });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Server] Shutting down...');
  sessionStore.close();
  server.close(() => {
    console.log('[Server] Goodbye!');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  sessionStore.close();
  server.close(() => {
    process.exit(0);
  });
});

export { server, sessionStore };
