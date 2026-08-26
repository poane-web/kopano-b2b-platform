'use strict';

const crypto = require('crypto');

/**
 * Orange Money WebPay merchant notification (official contract).
 *
 * Initiation (`POST /webpayment`) returns pay_token, payment_url, notif_token.
 * After the customer pays, Orange POSTs to the merchant `notif_url`:
 *
 *   { "status": "SUCCESS" | "FAILED", "notif_token": "<from /webpayment>", "txnid": "MP..." }
 *
 * Sources (not guessed):
 * - Orange Developer OM WebPay (om-webpay): notif_url is the server-to-server callback.
 * - Orange WebPay getting-started / public integration guides (2026):
 *   callback carries SUCCESS + notif_token; merchant must match notif_token stored
 *   at initiation, then confirm via Transaction Status (`pay_token`, order_id, amount).
 * - Open-source Orange Money WebPay adapters (e.g. mrrootc/orange-money-bundle):
 *   required fields `status`, `notif_token`, `txnid`; spoofing protection is
 *   notif_token match. No HMAC header is documented or implemented.
 *
 * Orange Money WebPay does **not** HMAC-sign this callback. There is no
 * canonical JSON, selected-field MAC, or raw-body signature in the provider spec.
 *
 * Kopano therefore:
 * 1. Captures the RAW request bytes and parses JSON from those bytes
 *    (never re-serializes req.body).
 * 2. Authenticates the callback by looking up the unguessable `notif_token`
 *    stored at initiation (provider spec).
 * 3. When merchant credentials exist, confirms SUCCESS via Transaction Status
 *    API before marking paid (provider spec).
 * 4. If a signature header is present (test adapter / optional reverse-proxy
 *    signing), verifies HMAC-SHA256 over the RAW bytes. JSON.stringify(parsed)
 *    is never used for HMAC — key order/whitespace would diverge from the wire.
 */

function timingSafeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function normalizeSignature(sig) {
  const s = String(sig || '').trim();
  if (s.toLowerCase().startsWith('sha256=')) return s.slice(7);
  return s;
}

function hmacHex(rawBody, secret) {
  const buf = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody || '', 'utf8');
  return crypto.createHmac('sha256', secret).update(buf).digest('hex');
}

function verifyRawHmac(rawBody, signatureHeader, secret) {
  if (!secret) return { ok: false, reason: 'no_secret' };
  const sig = normalizeSignature(signatureHeader);
  if (!sig) return { ok: false, reason: 'missing_signature' };
  const expected = hmacHex(rawBody, secret);
  if (!timingSafeEqual(sig, expected)) return { ok: false, reason: 'bad_signature' };
  return { ok: true };
}

function parseRawJson(rawBody) {
  const buf = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody || '', 'utf8');
  const text = buf.toString('utf8').trim();
  if (!text) return {};
  return JSON.parse(text);
}

function extractNotifToken(body) {
  if (!body || typeof body !== 'object') return null;
  const token = body.notif_token || body.notifToken || null;
  return token ? String(token) : null;
}

function extractExternalRef(body) {
  if (!body || typeof body !== 'object') return null;
  const ref = body.notif_token || body.external_reference || body.order_id || body.txnid || body.reference;
  return ref ? String(ref) : null;
}

function classifyStatus(body) {
  const providerStatus = String(body.status || body.payment_status || body.result || '').toLowerCase();
  const successStatuses = ['success', 'successful', 'paid', 'completed', '0', '00'];
  const failStatuses = ['failed', 'fail', 'cancelled', 'canceled', 'rejected'];
  const expireStatuses = ['expired', 'timeout', 'timed_out'];
  if (successStatuses.includes(providerStatus) || body.success === true) return 'success';
  if (expireStatuses.includes(providerStatus)) return 'expired';
  if (failStatuses.includes(providerStatus)) return 'failed';
  return 'ignored';
}

module.exports = {
  timingSafeEqual,
  hmacHex,
  verifyRawHmac,
  parseRawJson,
  extractNotifToken,
  extractExternalRef,
  classifyStatus,
};
