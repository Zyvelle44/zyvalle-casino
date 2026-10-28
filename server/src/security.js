import jwt from 'jsonwebtoken';
import { timingSafeEqual } from 'node:crypto';
import { query } from './db.js';

const production = process.env.NODE_ENV === 'production';

export const cookieOptions = {
  httpOnly: true,
  secure: production,
  sameSite: 'lax',
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export function signUser(user) {
  return jwt.sign(
    { sub: String(user.id), role: user.role },
    process.env.SESSION_SECRET,
    { expiresIn: '7d', issuer: 'zyvalle-bet', audience: 'zyvalle-bet-web' },
  );
}

function parseIdentity(data) {
  const id = Number(data.sub);
  if (!Number.isSafeInteger(id) || id < 1 || !['user', 'admin'].includes(data.role)) {
    throw new Error('Invalid session claims');
  }
  return { id, role: data.role };
}

export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.zy_session;
    if (!token) return res.status(401).json({ error: 'Please sign in first.' });
    const data = jwt.verify(token, process.env.SESSION_SECRET, {
      issuer: 'zyvalle-bet',
      audience: 'zyvalle-bet-web',
      algorithms: ['HS256'],
    });
    const identity = parseIdentity(data);
    const rows = await query('SELECT id, role, status FROM users WHERE id=? LIMIT 1', [identity.id]);
    const user = rows[0];
    if (!user || user.status !== 'active' || !['user', 'admin'].includes(user.role)) {
      res.clearCookie('zy_session', cookieOptions);
      return res.status(401).json({ error: 'Your account is unavailable. Please sign in again.' });
    }
    req.auth = { id: Number(user.id), role: user.role };
    next();
  } catch (error) {
    if (error?.name === 'JsonWebTokenError' || error?.name === 'TokenExpiredError' || error?.name === 'NotBeforeError') {
      return res.status(401).json({ error: 'Your session is invalid or has expired.' });
    }
    next(error);
  }
}

export function requireAdmin(req, res, next) {
  if (req.auth?.role !== 'admin') {
    return res.status(403).json({ error: 'Administrator access is required.' });
  }
  next();
}

export async function optionalAuth(req, res, next) {
  try {
    const token = req.cookies?.zy_session;
    if (!token) {
      req.auth = null;
      return next();
    }
    const data = jwt.verify(token, process.env.SESSION_SECRET, {
      issuer: 'zyvalle-bet',
      audience: 'zyvalle-bet-web',
      algorithms: ['HS256'],
    });
    const identity = parseIdentity(data);
    const rows = await query('SELECT id, role, status FROM users WHERE id=? LIMIT 1', [identity.id]);
    const user = rows[0];
    if (!user || user.status !== 'active' || !['user', 'admin'].includes(user.role)) {
      req.auth = null;
      res.clearCookie('zy_session', cookieOptions);
      return next();
    }
    req.auth = { id: Number(user.id), role: user.role };
    next();
  } catch (error) {
    if (error?.name === 'JsonWebTokenError' || error?.name === 'TokenExpiredError' || error?.name === 'NotBeforeError') {
      req.auth = null;
      return next();
    }
    next(error);
  }
}

export function csrfProtection(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  const configuredOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
  const origin = req.get('origin');
  if (origin && origin !== configuredOrigin) {
    return res.status(403).json({ error: 'Request origin is not allowed.' });
  }

  const cookieToken = req.cookies?.zy_csrf;
  const headerToken = req.get('x-csrf-token');
  if (
    typeof cookieToken !== 'string' ||
    typeof headerToken !== 'string' ||
    cookieToken.length < 32 ||
    headerToken.length !== cookieToken.length
  ) {
    return res.status(403).json({ error: 'CSRF validation failed. Refresh the page and try again.' });
  }

  const a = Buffer.from(cookieToken);
  const b = Buffer.from(headerToken);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return res.status(403).json({ error: 'CSRF validation failed. Refresh the page and try again.' });
  }
  next();
}
