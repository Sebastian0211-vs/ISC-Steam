import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const SECRET = process.env.JWT_SECRET ?? 'dev-only-secret-change-me';
const EXPIRES_IN = '7d';

export function signToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role }, SECRET, { expiresIn: EXPIRES_IN });
}

function readToken(req) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  // Allows plain <a download> links: /api/...?token=...
  if (typeof req.query.token === 'string') return req.query.token;
  return null;
}

/** Attaches req.user if a valid token is present; never rejects. */
export async function optionalAuth(req, res, next) {
  try {
    const token = readToken(req);
    if (token) {
      const payload = jwt.verify(token, SECRET);
      req.user = await User.findById(payload.sub);
    }
  } catch {
    /* invalid/expired token → treated as anonymous */
  }
  next();
}

/** Rejects with 401 unless a valid token resolves to an existing user. */
export async function requireAuth(req, res, next) {
  const token = readToken(req);
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    const payload = jwt.verify(token, SECRET);
    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ error: 'Account no longer exists' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/** Role gate. Admins pass every gate. Usage: requireRole('student') */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (req.user.role === 'admin' || roles.includes(req.user.role)) return next();
    return res.status(403).json({ error: `Requires role: ${roles.join(' or ')}` });
  };
}
