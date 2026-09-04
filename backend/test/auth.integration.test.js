'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createTestDb, startServer, request, seedUser } = require('./helpers');

describe('authentication', async () => {
  let db, srv, base;

  before(async () => {
    db = await createTestDb();
    srv = await startServer(db);
    base = srv.base;
  });

  after(async () => {
    await new Promise((r) => srv.server.close(r));
  });

  it('registers a business', async () => {
    const res = await request(base, 'POST', '/api/auth/register', {
      body: { phone: '+26771230001', pin: '1234', businessName: 'Tuckshop One', category: 'retail' },
    });
    assert.equal(res.status, 201);
    assert.ok(res.json.token);
    assert.ok(res.json.refreshToken);
    assert.equal(res.json.user.role, 'customer');
  });

  it('rejects duplicate registration', async () => {
    const res = await request(base, 'POST', '/api/auth/register', {
      body: { phone: '071230001', pin: '1234', businessName: 'Dup', category: 'retail' },
    });
    assert.equal(res.status, 409);
  });

  it('logs in with PIN', async () => {
    const res = await request(base, 'POST', '/api/auth/login', {
      body: { phone: '+26771230001', pin: '1234' },
    });
    assert.equal(res.status, 200);
    assert.ok(res.json.token);
  });

  it('rejects wrong PIN', async () => {
    const res = await request(base, 'POST', '/api/auth/login', {
      body: { phone: '+26771230001', pin: '9999' },
    });
    assert.equal(res.status, 401);
  });

  it('locks after repeated failures', async () => {
    const u = await seedUser(db, { phone: '+26771230002', pin: '1111', businessName: 'LockMe' });
    for (let i = 0; i < 5; i++) {
      await request(base, 'POST', '/api/auth/login', { body: { phone: u.phone, pin: '0000' } });
    }
    const res = await request(base, 'POST', '/api/auth/login', { body: { phone: u.phone, pin: '1111' } });
    assert.equal(res.status, 423);
  });

  it('refreshes access token', async () => {
    const reg = await request(base, 'POST', '/api/auth/register', {
      body: { phone: '+26771230003', pin: '2222', businessName: 'Refresh Co', category: 'food' },
    });
    const res = await request(base, 'POST', '/api/auth/refresh', { body: { refreshToken: reg.json.refreshToken } });
    assert.equal(res.status, 200);
    assert.ok(res.json.token);
  });

  it('rejects invalid refresh token', async () => {
    const res = await request(base, 'POST', '/api/auth/refresh', { body: { refreshToken: 'not-a-token' } });
    assert.equal(res.status, 401);
  });

  it('rejects expired/invalid access token on /me', async () => {
    const res = await request(base, 'GET', '/api/auth/me', { token: 'abc.def.ghi' });
    assert.equal(res.status, 401);
  });

  it('returns profile with valid token', async () => {
    const reg = await request(base, 'POST', '/api/auth/register', {
      body: { phone: '+26771230004', pin: '3333', businessName: 'Me Co', category: 'beauty' },
    });
    const me = await request(base, 'GET', '/api/auth/me', { token: reg.json.token });
    assert.equal(me.status, 200);
    assert.equal(me.json.business_name, 'Me Co');
  });

  it('rate limiter does not 500 when a proxy sends Forwarded', async () => {
    const { createApp } = require('../src/app');
    const limited = createApp({ db, disableRateLimit: false });
    const extra = await new Promise((resolve) => {
      const server = limited.listen(0, '127.0.0.1', () => {
        resolve({ server, base: `http://127.0.0.1:${server.address().port}` });
      });
    });
    try {
      const res = await request(extra.base, 'GET', '/api/groups', {
        headers: { Forwarded: 'for=203.0.113.10', 'X-Forwarded-For': '203.0.113.10' },
      });
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.json));
    } finally {
      await new Promise((r) => extra.server.close(r));
    }
  });
});
