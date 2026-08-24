'use strict';

const jwt = require('jsonwebtoken');

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET must be set to a strong value (min 32 chars) in production');
    }
    return process.env.JWT_SECRET_DEV_FALLBACK || 'kopano-dev-only-secret-do-not-use-in-prod-32c';
  }
  return secret;
}

function getRefreshSecret() {
  return process.env.JWT_REFRESH_SECRET || getJwtSecret();
}

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
  }
  const token = header.slice(7).trim();
  if (!token) {
    return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
  }
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    if (decoded.type === 'refresh') {
      return res.status(401).json({ error: 'Invalid token', code: 'INVALID_TOKEN' });
    }
    if (!decoded.userId && !decoded.supplierId && !decoded.agentId) {
      return res.status(401).json({ error: 'Invalid token', code: 'INVALID_TOKEN' });
    }
    req.user = {
      userId: decoded.userId || null,
      role: decoded.role || 'customer',
      supplierId: decoded.supplierId || null,
      agentId: decoded.agentId || null,
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid token', code: 'INVALID_TOKEN' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
    }
    const role = req.user.role || 'customer';
    if (!roles.includes(role)) {
      return res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });
    }
    next();
  };
}

const requireAdmin = requireRole('admin');
const requireSupplier = requireRole('supplier');
const requireAgent = requireRole('agent', 'admin');

function signToken(payload, expiresIn = process.env.JWT_EXPIRES_IN || '1h') {
  return jwt.sign(payload, getJwtSecret(), { expiresIn });
}

function signRefreshToken(payload) {
  const expiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
  return jwt.sign({ ...payload, type: 'refresh' }, getRefreshSecret(), { expiresIn });
}

function verifyRefreshToken(token) {
  const decoded = jwt.verify(token, getRefreshSecret());
  if (decoded.type !== 'refresh') throw new Error('Not a refresh token');
  return decoded;
}

const authMiddleware = authenticate;
const protect = authenticate;
const verifyToken = authenticate;

module.exports = {
  authenticate,
  authMiddleware,
  protect,
  verifyToken,
  requireRole,
  requireAdmin,
  requireSupplier,
  requireAgent,
  signToken,
  signRefreshToken,
  verifyRefreshToken,
  getJwtSecret,
};
