import { Router } from 'express';
import {
  listGames, listTags, getGame, getMedia, downloadGame,
  createGame, listMine, rebuildGame, updateGame, deleteGame,
} from '../controllers/gameController.js';
import { optionalAuth, requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// store (public)
router.get('/', listGames);
router.get('/tags', listTags);
router.get('/mine', requireAuth, requireRole('student'), listMine);
router.get('/:slug', optionalAuth, getGame);
router.get('/:slug/media/:mediaId', getMedia);

// downloads require an account (any role)
router.get('/:slug/download', requireAuth, downloadGame);

// publishing (students & admins)
router.post('/', requireAuth, requireRole('student'), createGame);
router.post('/:slug/rebuild', requireAuth, requireRole('student'), rebuildGame);
router.patch('/:slug', requireAuth, requireRole('student'), updateGame);
router.delete('/:slug', requireAuth, requireRole('student'), deleteGame);

export default router;
