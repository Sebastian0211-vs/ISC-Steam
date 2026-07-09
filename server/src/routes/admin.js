import { Router } from 'express';
import { listUsers, setRole, deleteUser, listAllGames, stats } from '../controllers/adminController.js';
import { setAnnouncement } from '../controllers/announcementController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth, requireRole('admin'));

router.get('/stats', stats);
router.get('/users', listUsers);
router.patch('/users/:id', setRole);
router.delete('/users/:id', deleteUser);
router.get('/games', listAllGames);
router.put('/announcement', setAnnouncement);

export default router;
