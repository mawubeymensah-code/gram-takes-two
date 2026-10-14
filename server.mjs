import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { timingSafeEqual } from 'node:crypto';
import { InputError, validateSubmission } from './validation.mjs';
import { validateEvents } from './events.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const staticFiles = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
]);
const MAX_BODY = 16 * 1024;
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }

export function createApp({ dbPath = resolve(root, 'data/submissions.sqlite'), adminToken = '',
                            publicOrigin = '', events = null, rateLimit = 8 } = {}) {
  if (adminToken && adminToken.length < 32) throw new Error('GRAM_ADMIN_TOKEN must have at least 32 characters.');
  if (publicOrigin && new URL(publicOrigin).origin !== publicOrigin) throw new Error('GRAM_PUBLIC_ORIGIN must be an exact URL origin.');
  const calendar = validateEvents(events ?? JSON.parse(readFileSync(resolve(root, 'public/events.json'), 'utf8')));
  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`pragma journal_mode=WAL;
    create table if not exists submissions (
      id integer primary key autoincrement, kind text not null check(kind in ('interest','contact')),
      name text not null,email text not null,category text not null,message text not null,
      created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );`);
  const insert = db.prepare('insert into submissions(kind,name,email,category,message) values (?,?,?,?,?)');
  const visitors = new Map();
  function rateAllowed(ip) {
    const now = Date.now();
    for (const [key, value] of visitors) if (now - value.since > 3600000) visitors.delete(key);
    if (!visitors.has(ip)) { if (visitors.size >= 10000) return false; visitors.set(ip, { since: now, count: 0 }); }
    const value = visitors.get(ip); value.count++;
    return value.count <= rateLimit;
  }
  function send(response, status, body, type = 'application/json; charset=utf-8') {
    response.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" });
    response.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
  }
  const server = http.createServer(async (request, response) => {
    try {
      const requestOrigin = publicOrigin || `http://${request.headers.host}`;
      const path = new URL(request.url, requestOrigin).pathname;
      if (request.method === 'GET' && staticFiles.has(path)) {
        const [name, type] = staticFiles.get(path);
        return send(response, 200, readFileSync(resolve(root, 'public', name)), type);
      }
      if (request.method === 'GET' && path === '/api/events') {
        return send(response, 200, { events: calendar });
      }
      if (request.method === 'GET' && path === '/api/admin/submissions') {
        const supplied = (request.headers.authorization || '').replace(/^Bearer /, '');
        const expected = Buffer.from(adminToken), actual = Buffer.from(supplied);
        if (!adminToken || expected.length !== actual.length || !timingSafeEqual(expected, actual))
          throw new HttpError(401, 'Unauthorized.');
        const rows = db.prepare('select * from submissions order by id desc').all();
        return send(response, 200, { submissions: rows });
      }
      if (request.method === 'POST' && ['/api/interest', '/api/contact'].includes(path)) {
        if (request.headers.origin !== requestOrigin) throw new HttpError(403, 'Submit this form from the organization website.');
        if (!rateAllowed(request.socket.remoteAddress || 'unknown')) {
          response.setHeader('Retry-After', '3600');
          throw new HttpError(429, 'Too many submissions. Please try again in an hour.');
        }
        if ((request.headers['content-type'] || '').split(';')[0] !== 'application/json') throw new HttpError(415, 'Use JSON form data.');
        if (Number(request.headers['content-length']) > MAX_BODY) throw new HttpError(413, 'The submission is too large.');
        const chunks = []; let bytes = 0;
        for await (const chunk of request) {
          bytes += chunk.length;
          if (bytes > MAX_BODY) throw new HttpError(413, 'The submission is too large.');
          chunks.push(chunk);
        }
        let input;
        try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new HttpError(400, 'The submission could not be read.'); }
        if (input && typeof input === 'object' && input.website) return send(response, 201, { message: 'Submission received.' });
        const value = validateSubmission(input, path === '/api/interest' ? 'interest' : 'contact');
        const saved = insert.run(value.kind, value.name, value.email, value.category, value.message);
        return send(response, 201, { id: Number(saved.lastInsertRowid), message: 'Saved for organizer review. This form does not send email.' });
      }
      throw new HttpError(404, 'Page not found.');
    } catch (issue) {
      const status = issue instanceof HttpError ? issue.status : issue instanceof InputError ? 400 : 500;
      send(response, status, { error: status === 500 ? 'The submission could not be saved. Please try again later.' : issue.message });
    }
  });
  server.headersTimeout = 15000;
  server.requestTimeout = 20000;
  return { server, close: () => db.close() };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const app = createApp({ dbPath: process.env.GRAM_DB_PATH || resolve(root, 'data/submissions.sqlite'),
    adminToken: process.env.GRAM_ADMIN_TOKEN || '', publicOrigin: process.env.GRAM_PUBLIC_ORIGIN || '' });
  const port = Number(process.env.PORT || 3001);
  app.server.listen(port, '0.0.0.0', () => console.log(`Gram Takes Two is available on port ${port}.`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => app.server.close(() => { app.close(); process.exit(0); }));
}
