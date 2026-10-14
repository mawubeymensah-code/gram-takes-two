import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createApp } from '../server.mjs';
import { validateEvents } from '../events.mjs';
import { validateSubmission } from '../validation.mjs';

const token = 'test-only-admin-token-not-a-real-secret';
const interest = { name: 'Test Member', email: 'TEST@example.com', category: 'Volunteering', message: 'Happy to help.', consent: true, website: '' };
async function setup(options = {}) {
  const app = createApp({ dbPath: ':memory:', adminToken: token, events: [], ...options });
  app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening');
  const origin = `http://127.0.0.1:${app.server.address().port}`;
  return { origin, async close() { await new Promise(resolve => app.server.close(resolve)); app.close(); } };
}
async function submit(origin, endpoint = 'interest', value = interest, headers = {}) {
  return fetch(`${origin}/api/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, ...headers }, body: JSON.stringify(value) });
}
async function exportRows(origin, authorization = `Bearer ${token}`) {
  return fetch(`${origin}/api/admin/submissions`, { headers: { Authorization: authorization } });
}

test('membership interest and contact are saved and exported only to the organizer', async () => {
  const app = await setup();
  try {
    const response = await submit(app.origin); assert.equal(response.status, 201);
    assert.match((await response.json()).message, /Saved for organizer review/);
    const contact = await submit(app.origin, 'contact', { ...interest, category: 'Community partnership', message: 'Can we discuss an event?' });
    assert.equal(contact.status, 201);
    assert.equal((await exportRows(app.origin, 'Bearer wrong')).status, 401);
    const result = await (await exportRows(app.origin)).json();
    assert.equal(result.submissions.length, 2);
    assert.equal(result.submissions[1].email, 'test@example.com');
    assert.equal(result.submissions[0].kind, 'contact');
  } finally { await app.close(); }
});
test('invalid email, absent consent, and oversize text never reach the database', async () => {
  const app = await setup();
  try {
    for (const value of [{ ...interest, email: 'invalid' }, { ...interest, consent: false }, { ...interest, message: 'x'.repeat(2001) }])
      assert.equal((await submit(app.origin, 'interest', value)).status, 400);
    assert.equal((await (await exportRows(app.origin)).json()).submissions.length, 0);
  } finally { await app.close(); }
});
test('SQL metacharacters are stored as data and cannot damage the table', async () => {
  const app = await setup();
  try {
    const value = { ...interest, name: "Robert'); DROP TABLE submissions;--", message: '<script>alert(1)</script>' };
    assert.equal((await submit(app.origin, 'interest', value)).status, 201);
    const rows = (await (await exportRows(app.origin)).json()).submissions;
    assert.equal(rows[0].name, value.name); assert.equal(rows[0].message, value.message);
  } finally { await app.close(); }
});
test('cross-origin posts, invalid JSON, and large bodies are rejected', async () => {
  const app = await setup();
  try {
    assert.equal((await submit(app.origin, 'interest', interest, { Origin: 'https://other.example' })).status, 403);
    const invalid = await fetch(`${app.origin}/api/interest`, { method: 'POST', headers: { Origin: app.origin, 'Content-Type': 'application/json' }, body: '{bad}' });
    assert.equal(invalid.status, 400);
    assert.equal((await submit(app.origin, 'interest', { ...interest, message: 'x'.repeat(20000) })).status, 413);
  } finally { await app.close(); }
});
test('honeypot submissions are acknowledged without storing personal information', async () => {
  const app = await setup();
  try {
    assert.equal((await submit(app.origin, 'interest', { ...interest, website: 'bot.example' })).status, 201);
    assert.equal((await (await exportRows(app.origin)).json()).submissions.length, 0);
  } finally { await app.close(); }
});
test('rate limit prevents repeated submissions', async () => {
  const app = await setup({ rateLimit: 1 });
  try {
    assert.equal((await submit(app.origin)).status, 201);
    const limited = await submit(app.origin);
    assert.equal(limited.status, 429); assert.equal(limited.headers.get('retry-after'), '3600');
  } finally { await app.close(); }
});
test('submissions survive a server restart using an on-disk SQLite database', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'gram-tests-'));
  const dbPath = join(dir, 'submissions.sqlite');
  let app = await setup({ dbPath });
  try {
    await submit(app.origin); await app.close(); app = await setup({ dbPath });
    assert.equal((await (await exportRows(app.origin)).json()).submissions.length, 1);
  } finally { await app.close(); rmSync(dir, { recursive: true, force: true }); }
});
test('event data, static files, and security headers are served without exposing private files', async () => {
  const event = { id: 'test', title: 'Test fixture only', description: 'Test event', location: 'Test room', category: 'Community', start: '2027-01-01T18:00:00-06:00' };
  const app = await setup({ events: [event] });
  try {
    const page = await fetch(app.origin); assert.equal(page.status, 200);
    assert.match(page.headers.get('content-security-policy'), /script-src 'self'/);
    assert.match(await page.text(), /Gram Takes Two/);
    assert.deepEqual((await (await fetch(`${app.origin}/api/events`)).json()).events, [event]);
    assert.equal((await fetch(`${app.origin}/server.mjs`)).status, 404);
    assert.equal((await fetch(`${app.origin}/data/submissions.sqlite`)).status, 404);
  } finally { await app.close(); }
});
test('configuration validates event timestamps and admin credential strength', () => {
  assert.throws(() => validateEvents([{ id: 'bad' }]), /Invalid event/);
  assert.throws(() => createApp({ dbPath: ':memory:', adminToken: 'short' }), /32 characters/);
  assert.throws(() => validateSubmission({ ...interest, category: 'Unknown' }, 'interest'), /category/);
});
