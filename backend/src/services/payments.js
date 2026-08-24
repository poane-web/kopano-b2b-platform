// backend/src/services/payments.js
const ORANGE_MONEY_CONFIG = {
  merchantId: process.env.OM_MERCHANT_ID,
  merchantKey: process.env.OM_MERCHANT_KEY,
  apiUrl: 'https://api.orange.com/orange-money-webpay/dev/v1', // sandbox
  // Production: https://api.orange.com/orange-money-webpay/prod/v1
};

async function initiateOrangeMoneyPayment({ amount, phone, orderId, callbackUrl }) {
  const body = {
    merchant_key: ORANGE_MONEY_CONFIG.merchantKey,
    currency: 'BWP',
    order_id: orderId,
    amount: amount.toString(),
    return_url: callbackUrl,
    cancel_url: callbackUrl,
    notif_url: `${process.env.API_URL}/payments/webhook/orange-money`,
    lang: 'en',
    reference: `Kopano-${orderId}`,
  };
  
  const res = await fetch(`${ORANGE_MONEY_CONFIG.apiUrl}/payment`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${await getOrangeMoneyToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  
  return res.json(); // { payment_url, payment_token, notif_token }
}

async function getOrangeMoneyToken() {
  // OAuth2 client credentials flow
  const creds = Buffer.from(`${process.env.OM_CLIENT_ID}:${process.env.OM_CLIENT_SECRET}`).toString('base64');
  const res = await fetch('https://api.orange.com/oauth/v3/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  return data.access_token;
}
// DPO CreateToken request
const dpoPayload = {
  CompanyToken: process.env.DPO_COMPANY_TOKEN,
  Request: 'createToken',
  Transaction: {
    PaymentAmount: amount,
    PaymentCurrency: 'BWP',
    CompanyRef: orderId,
    RedirectURL: callbackUrl,
    BackURL: cancelUrl,
    customerPhone: phone,
  }
};