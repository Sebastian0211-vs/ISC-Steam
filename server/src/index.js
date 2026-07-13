import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'node:path';
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { connectDB, dbReady } from './config/db.js';
import { requireDB } from './middleware/requireDB.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import { initPresence } from './services/presence.js';
import authRouter from './routes/auth.js';
import gamesRouter from './routes/games.js';
import adminRouter from './routes/admin.js';
import socialRouter from './routes/social.js';
import libraryRouter from './routes/library.js';
import usersRouter from './routes/users.js';
import User from './models/User.js';
import { getAnnouncement, listReleases } from './controllers/announcementController.js';

const app = express();
const port = process.env.PORT ?? 5174;

// server version, read from server/package.json at startup
const pkgPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../package.json');
const version = JSON.parse(readFileSync(pkgPath, 'utf8')).version;

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function absoluteUrl(origin, value) {
  return new URL(value, `${origin.replace(/\/$/, '')}/`).href;
}

function profileHtml(indexHtml, user, origin) {
  const displayName = user.displayName || user.username;
  const title = `${displayName} (@${user.username}) - ISC Steam`;
  const description = (user.bio || `${displayName}'s profile on ISC Steam.`)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
  const profileUrl = absoluteUrl(origin, `/user/${encodeURIComponent(user.username)}`);
  const imagePath = user.bannerUrl() || user.avatarUrl() || '/favicon.svg';
  const imageUrl = absoluteUrl(origin, imagePath);

  const tags = [
    `<meta name="description" content="${escapeHtml(description)}" />`,
    '<meta property="og:type" content="profile" />',
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${escapeHtml(profileUrl)}" />`,
    `<meta property="og:image" content="${escapeHtml(imageUrl)}" />`,
    `<meta property="og:image:alt" content="${escapeHtml(`${displayName}'s profile image`)}" />`,
    '<meta property="og:site_name" content="ISC Steam" />',
    `<meta property="profile:username" content="${escapeHtml(user.username)}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(imageUrl)}" />`,
    `<link rel="canonical" href="${escapeHtml(profileUrl)}" />`,
  ].join('\n    ');

  return indexHtml
    .replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(title)}</title>`)
    .replace('</head>', `    ${tags}\n  </head>`);
}

app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173' }));
app.use(express.json());
app.use(morgan('dev'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version, db: dbReady() ? 'connected' : 'disconnected', time: new Date().toISOString() });
});

app.use('/api/auth', requireDB, authRouter);
app.use('/api/games', requireDB, gamesRouter);
app.use('/api/admin', requireDB, adminRouter);
app.use('/api/social', requireDB, socialRouter);
app.use('/api/library', requireDB, libraryRouter);
app.use('/api/users', requireDB, usersRouter);
app.get('/api/announcement', requireDB, getAnnouncement);
app.get('/api/releases', listReleases);

// In production, serve the built client (client/dist) from the same origin.
const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
if (existsSync(clientDist)) {
  const indexHtml = readFileSync(path.join(clientDist, 'index.html'), 'utf8');

  // Link-preview crawlers do not run the React profile request. Render the
  // profile's Open Graph metadata into the initial HTML response instead.
  app.get('/user/:username', async (req, res, next) => {
    try {
      // Preserve the SPA's existing degraded mode when MongoDB is unavailable.
      if (!dbReady()) return res.type('html').send(indexHtml);
      const user = await User.findOne({ username: String(req.params.username).toLowerCase() });
      if (!user) return res.type('html').send(indexHtml);

      const origin = process.env.PUBLIC_ORIGIN
        || process.env.CLIENT_ORIGIN
        || `${req.protocol}://${req.get('host')}`;
      res.type('html').send(profileHtml(indexHtml, user, origin));
    } catch (err) {
      next(err);
    }
  });

  app.use(express.static(clientDist));
  // SPA fallback: any non-API route returns index.html
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use(notFound);
app.use(errorHandler);

const server = createServer(app);
initPresence(server, process.env.CLIENT_ORIGIN ?? 'http://localhost:5173');
server.listen(port, () => console.log(`[api] listening on http://localhost:${port}`));
connectDB(); // non-blocking: the API is usable immediately, data routes 503 until connected
