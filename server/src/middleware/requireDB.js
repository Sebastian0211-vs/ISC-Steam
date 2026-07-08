import { dbReady } from '../config/db.js';

// Guards data routes so the API degrades gracefully when MongoDB is down.
export function requireDB(req, res, next) {
  if (!dbReady()) {
    return res.status(503).json({ error: 'Database unavailable. Start MongoDB (npm run db:up) and retry.' });
  }
  next();
}
