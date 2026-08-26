'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const multer = require('multer');

const authRoutes = require('./routes/auth');
const groupsRoutes = require('./routes/groups');
const ordersRoutes = require('./routes/orders');
const paymentsRoutes = require('./routes/payments');
const adminRoutes = require('./routes/admin');
const referralsRoutes = require('./routes/referrals');
const supplierRoutes = require('./routes/supplier');
const agentsRoutes = require('./routes/agents');
const { authenticate, requireAdmin } = require('./middleware/auth');

function createApp({ db, disableRateLimit = false } = {}) {
  const app = express();
  const isProd = process.env.NODE_ENV === 'production';

  if (process.env.TRUST_PROXY === '1' || isProd) app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  const allowedOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (!isProd) return callback(null, true);
        if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) return callback(null, true);
        return callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Idempotency-Key', 'X-Request-Id', 'X-Om-Signature'],
    })
  );

  // Orange Money notif_url: HMAC (if present) is over RAW bytes, then JSON is parsed.
  app.use(
    '/api/payments/webhook',
    express.raw({ type: () => true, limit: process.env.JSON_BODY_LIMIT || '100kb' }),
    (req, res, next) => {
      const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
      req.rawBody = buf;
      const text = buf.toString('utf8').trim();
      if (!text) {
        req.body = {};
        return next();
      }
      try {
        req.body = JSON.parse(text);
      } catch {
        return res.status(400).json({ error: 'Invalid JSON', code: 'INVALID_JSON' });
      }
      next();
    }
  );
  app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '50kb' }));

  if (!isProd && process.env.SILENT_LOGS !== 'true') app.use(morgan('dev'));

  app.locals.db = db;

  const skipLimit = disableRateLimit || process.env.DISABLE_RATE_LIMIT === 'true';
  if (!skipLimit) {
    app.use(
      '/api',
      rateLimit({
        windowMs: 15 * 60 * 1000,
        max: parseInt(process.env.RATE_LIMIT_MAX || '300', 10),
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Too many requests', code: 'RATE_LIMIT' },
      })
    );
  }

  const authLimiter = skipLimit
    ? (_req, _res, next) => next()
    : rateLimit({
        windowMs: 15 * 60 * 1000,
        max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '20', 10),
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Too many authentication attempts', code: 'AUTH_RATE_LIMIT' },
      });

  const paymentLimiter = skipLimit
    ? (_req, _res, next) => next()
    : rateLimit({
        windowMs: 15 * 60 * 1000,
        max: parseInt(process.env.PAYMENT_RATE_LIMIT_MAX || '30', 10),
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Too many payment attempts', code: 'PAYMENT_RATE_LIMIT' },
      });

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', service: 'kopano-api', time: new Date().toISOString() });
  });

  app.get('/ready', async (_req, res) => {
    try {
      const ok = await db.healthCheck();
      if (!ok) throw new Error('db check failed');
      res.status(200).json({ status: 'ready', database: 'up' });
    } catch {
      res.status(503).json({ status: 'not_ready', database: 'down' });
    }
  });

  app.use('/api/auth', authLimiter, authRoutes);
  app.use('/api/groups', groupsRoutes);
  app.use('/api/orders', ordersRoutes);
  app.use('/api/payments', paymentLimiter, paymentsRoutes);
  app.use('/api/referrals', referralsRoutes);
  app.use('/api/admin', authenticate, requireAdmin, adminRoutes);
  app.use('/api/supplier-app', supplierRoutes);
  app.use('/api/wholesaler', supplierRoutes);
  app.use('/api/agents', agentsRoutes);

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
  });

  app.use((err, _req, res, _next) => {
    if (err && err.message === 'Not allowed by CORS') {
      return res.status(403).json({ error: 'CORS blocked', code: 'CORS' });
    }
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: 'File upload error', code: 'UPLOAD_ERROR' });
    }
    console.error('Unhandled error', { message: err?.message, name: err?.name });
    const status = err.status || err.statusCode || 500;
    res.status(status).json({
      error: isProd ? 'Internal server error' : err.message || 'Internal server error',
      code: err.code || 'SERVER_ERROR',
    });
  });

  return app;
}

module.exports = { createApp };
