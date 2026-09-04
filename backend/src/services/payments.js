'use strict';

const ORANGE_SANDBOX_URL = 'https://api.orange.com/orange-money-webpay/dev/v1';
const ORANGE_PROD_URL = 'https://api.orange.com/orange-money-webpay/bw/v1';

function isConfigured() {
  return Boolean(process.env.OM_MERCHANT_KEY && process.env.OM_CLIENT_ID && process.env.OM_CLIENT_SECRET);
}

async function getOrangeMoneyToken() {
  const clientId = process.env.OM_CLIENT_ID;
  const clientSecret = process.env.OM_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Orange Money OAuth credentials not configured');
  const creds = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch('https://api.orange.com/oauth/v3/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Orange Money token error: ${res.status} ${text}`);
  }
  const data = await res.json();
  if (!data.access_token) throw new Error('Orange Money token missing access_token');
  return data.access_token;
}

async function initiateOrangeMoneyPayment({ amount, phone, orderId, externalRef, callbackUrl, notifUrl }) {
  if (!isConfigured()) {
    if (process.env.NODE_ENV === 'production' && process.env.PAYMENT_ALLOW_UNCONFIGURED !== 'true') {
      throw new Error('Payment provider not configured for production');
    }
    return {
      mode: 'sandbox_unconfigured',
      payment_url: null,
      payment_token: null,
      notif_token: null,
      order_id: orderId,
      amount,
      currency: 'BWP',
      message:
        'Orange Money credentials not set. Payment remains awaiting_confirmation until a verified webhook arrives.',
    };
  }

  const apiBase = process.env.OM_API_URL || (process.env.OM_ENV === 'production' ? ORANGE_PROD_URL : ORANGE_SANDBOX_URL);
  const token = await getOrangeMoneyToken();
  const body = {
    merchant_key: process.env.OM_MERCHANT_KEY,
    currency: 'BWP',
    order_id: externalRef || String(orderId),
    amount: Number(amount).toFixed(2),
    return_url: callbackUrl,
    cancel_url: callbackUrl,
    notif_url: notifUrl,
    lang: 'en',
    reference: `Kopano-${orderId}`,
  };
  if (phone) body.customer_msisdn = String(phone).replace(/^\+/, '');

  const res = await fetch(`${apiBase}/webpayment`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || `Orange Money HTTP ${res.status}`);
  return {
    mode: process.env.OM_ENV === 'production' ? 'live' : 'sandbox',
    payment_url: data.payment_url || data.paymentUrl,
    payment_token: data.payment_token || data.pay_token,
    notif_token: data.notif_token || externalRef,
    raw: data,
  };
}

/**
 * Orange Money Transaction Status API. Confirms a SUCCESS notification
 * before marking an order paid. Skipped only when merchant credentials
 * are absent (tests / unconfigured sandbox).
 */
async function confirmOrangeMoneyStatus({ payToken, orderId, amount }) {
  if (!isConfigured()) {
    return { ok: false, skipped: true, reason: 'provider_not_configured' };
  }
  if (!payToken) {
    return { ok: false, skipped: false, reason: 'missing_pay_token' };
  }
  const apiBase = process.env.OM_API_URL || (process.env.OM_ENV === 'production' ? ORANGE_PROD_URL : ORANGE_SANDBOX_URL);
  const token = await getOrangeMoneyToken();
  const res = await fetch(`${apiBase}/transactionstatus`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      order_id: String(orderId),
      amount: Number(amount).toFixed(2),
      pay_token: payToken,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, skipped: false, reason: data.message || `HTTP ${res.status}`, raw: data };
  const status = String(data.status || data.payment_status || '').toLowerCase();
  const ok = ['success', 'successful', 'paid', 'completed', '0', '00'].includes(status);
  return { ok, skipped: false, status, raw: data };
}

module.exports = { initiateOrangeMoneyPayment, isConfigured, confirmOrangeMoneyStatus };
