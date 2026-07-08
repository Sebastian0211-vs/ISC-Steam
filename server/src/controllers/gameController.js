import Game from '../models/Game.js';
import { enqueueBuild } from '../services/pipeline.js';
import { openDownload, fileInfo, deleteFile } from '../config/gridfs.js';

const REPO_URL_RE = /^https:\/\/(github\.com|gitlab\.com|githepia\.hesge\.ch)\/[\w.-]+\/[\w.-]+?(\.git)?$/;

function slugify(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 50);
}

function canManage(user, game) {
  return user && (user.role === 'admin' || game.owner.toString() === user._id.toString());
}

/* ------------------------------------------------------------------ store -- */

// GET /api/games?search=&tag=&sort=new|popular|title&featured=1
export async function listGames(req, res, next) {
  try {
    const filter = { published: true, buildStatus: 'success' };
    if (req.query.tag) filter.tags = String(req.query.tag).toLowerCase();
    if (req.query.featured) filter.featured = true;
    if (req.query.search) filter.$text = { $search: String(req.query.search) };

    const sort = { popular: { downloads: -1 }, title: { title: 1 }, new: { builtAt: -1 } }[req.query.sort] ?? { featured: -1, builtAt: -1 };
    const games = await Game.find(filter).sort(sort).limit(100);
    res.json(games.map((g) => g.toStore()));
  } catch (err) {
    next(err);
  }
}

// GET /api/games/tags — distinct tags across published games (for filters)
export async function listTags(req, res, next) {
  try {
    const tags = await Game.distinct('tags', { published: true });
    res.json(tags.sort());
  } catch (err) {
    next(err);
  }
}

// GET /api/games/:slug
export async function getGame(req, res, next) {
  try {
    const game = await Game.findOne({ slug: req.params.slug });
    if (!game) return res.status(404).json({ error: 'Game not found' });
    if (!game.published && !canManage(req.user, game)) return res.status(404).json({ error: 'Game not found' });
    res.json(game.toStore());
  } catch (err) {
    next(err);
  }
}

// GET /api/games/:slug/media/:mediaId — cover / screenshots (public)
export async function getMedia(req, res, next) {
  try {
    const game = await Game.findOne({ slug: req.params.slug });
    const media = game?.media.id(req.params.mediaId);
    if (!media) return res.status(404).json({ error: 'Media not found' });
    res.set('Content-Type', media.contentType);
    res.set('Cache-Control', 'public, max-age=86400');
    openDownload(media.fileId)
      .on('error', () => res.status(404).end())
      .pipe(res);
  } catch (err) {
    next(err);
  }
}

// GET /api/games/:slug/download — any logged-in account (visitors included)
export async function downloadGame(req, res, next) {
  try {
    const game = await Game.findOne({ slug: req.params.slug });
    if (!game || (!game.published && !canManage(req.user, game))) return res.status(404).json({ error: 'Game not found' });
    if (game.buildStatus !== 'success' || !game.packageFileId) {
      return res.status(409).json({ error: 'No package available for this game yet' });
    }
    const info = await fileInfo(game.packageFileId);
    if (!info) return res.status(404).json({ error: 'Package file missing' });

    await Game.updateOne({ _id: game._id }, { $inc: { downloads: 1 } });
    res.set('Content-Type', 'application/zip');
    res.set('Content-Length', info.length);
    res.set('Content-Disposition', `attachment; filename="${game.slug}-${game.version}.zip"`);
    openDownload(game.packageFileId)
      .on('error', next)
      .pipe(res);
  } catch (err) {
    next(err);
  }
}

/* -------------------------------------------------------------- publisher -- */

// POST /api/games  { repoUrl, branch?, slug? } — students & admins
export async function createGame(req, res, next) {
  try {
    const repoUrl = String(req.body.repoUrl ?? '').trim().replace(/\/$/, '');
    if (!REPO_URL_RE.test(repoUrl)) {
      return res.status(400).json({ error: 'repoUrl must be a public https git URL (github.com / gitlab.com / githepia)' });
    }
    const slug = slugify(req.body.slug || repoUrl.split('/').pop().replace(/\.git$/, ''));
    if (!slug) return res.status(400).json({ error: 'Could not derive a slug from the repo URL' });
    if (await Game.findOne({ slug })) return res.status(409).json({ error: `A game with slug "${slug}" already exists` });

    const game = await Game.create({
      slug,
      owner: req.user._id,
      repoUrl,
      branch: String(req.body.branch ?? '').trim(),
      title: slug, // placeholder until isc.json is imported
      buildStatus: 'queued',
      buildLog: 'Queued …',
    });
    enqueueBuild(game._id);
    res.status(201).json(game.toStore());
  } catch (err) {
    next(err);
  }
}

// GET /api/games/mine — publisher dashboard (includes build state + log)
export async function listMine(req, res, next) {
  try {
    const filter = req.user.role === 'admin' ? {} : { owner: req.user._id };
    const games = await Game.find(filter).sort({ updatedAt: -1 }).populate('owner', 'username displayName');
    res.json(games.map((g) => ({
      ...g.toStore(),
      buildLog: g.buildLog,
      branch: g.branch,
      commit: g.commit,
      owner: { username: g.owner?.username, displayName: g.owner?.displayName || g.owner?.username },
    })));
  } catch (err) {
    next(err);
  }
}

// POST /api/games/:slug/rebuild — re-clone, re-import isc.json, re-package
export async function rebuildGame(req, res, next) {
  try {
    const game = await Game.findOne({ slug: req.params.slug });
    if (!game) return res.status(404).json({ error: 'Game not found' });
    if (!canManage(req.user, game)) return res.status(403).json({ error: 'Not your game' });
    if (['queued', 'cloning', 'building', 'packaging'].includes(game.buildStatus)) {
      return res.status(409).json({ error: 'A build is already running for this game' });
    }
    game.buildStatus = 'queued';
    game.buildLog = 'Queued …';
    await game.save();
    enqueueBuild(game._id);
    res.json(game.toStore());
  } catch (err) {
    next(err);
  }
}

// PATCH /api/games/:slug — owner edits repo/branch; admin can publish/feature
export async function updateGame(req, res, next) {
  try {
    const game = await Game.findOne({ slug: req.params.slug });
    if (!game) return res.status(404).json({ error: 'Game not found' });
    if (!canManage(req.user, game)) return res.status(403).json({ error: 'Not your game' });

    if (typeof req.body.repoUrl === 'string') {
      const url = req.body.repoUrl.trim().replace(/\/$/, '');
      if (!REPO_URL_RE.test(url)) return res.status(400).json({ error: 'Invalid repoUrl' });
      game.repoUrl = url;
    }
    if (typeof req.body.branch === 'string') game.branch = req.body.branch.trim();
    if (req.user.role === 'admin') {
      if (typeof req.body.published === 'boolean') game.published = req.body.published;
      if (typeof req.body.featured === 'boolean') game.featured = req.body.featured;
    }
    await game.save();
    res.json(game.toStore());
  } catch (err) {
    next(err);
  }
}

// DELETE /api/games/:slug — owner or admin; cleans GridFS
export async function deleteGame(req, res, next) {
  try {
    const game = await Game.findOne({ slug: req.params.slug });
    if (!game) return res.status(404).json({ error: 'Game not found' });
    if (!canManage(req.user, game)) return res.status(403).json({ error: 'Not your game' });
    if (game.packageFileId) await deleteFile(game.packageFileId);
    for (const media of game.media) await deleteFile(media.fileId);
    await game.deleteOne();
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
