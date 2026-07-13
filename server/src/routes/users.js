import { Router } from 'express';
import multer from 'multer';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import {
  getProfile, getActivity, resolveNames,
  updateProfile, uploadAvatar, uploadBanner, uploadBackground, getAvatar, getBanner, getBackground,
  listComments, addComment, deleteComment, likeComment,
} from '../controllers/userController.js';
import { UPLOAD_LIMITS } from '../config/uploadLimits.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: UPLOAD_LIMITS.image } });

// specific routes must come before /:username
router.get('/resolve', resolveNames);
router.patch('/me/profile', requireAuth, updateProfile);
router.post('/me/avatar', requireAuth, upload.single('image'), uploadAvatar);
router.post('/me/banner', requireAuth, upload.single('image'), uploadBanner);
router.post('/me/background', requireAuth, upload.single('image'), uploadBackground);

router.get('/:username', optionalAuth, getProfile);
router.get('/:username/activity', getActivity);
router.get('/:username/avatar', getAvatar);
router.get('/:username/banner', getBanner);
router.get('/:username/background', getBackground);

router.get('/:username/comments', optionalAuth, listComments);
router.post('/:username/comments', requireAuth, addComment);
router.delete('/:username/comments/:commentId', requireAuth, deleteComment);
router.post('/:username/comments/:commentId/like', requireAuth, likeComment);

export default router;
