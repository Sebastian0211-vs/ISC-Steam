import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import {
  listFriends, addFriend, acceptFriend, removeFriend,
  listMessages, sendMessage, sendImage, getChatImage, markRead,
} from '../controllers/socialController.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

router.use(requireAuth);

router.get('/friends', listFriends);
router.post('/friends', addFriend);
router.post('/friends/:friendshipId/accept', acceptFriend);
router.delete('/friends/:friendshipId', removeFriend);

router.get('/messages/:userId', listMessages);
router.post('/messages/:userId', sendMessage);
router.post('/messages/:userId/image', upload.single('image'), sendImage);
router.post('/messages/:userId/read', markRead);

router.get('/media/:messageId', getChatImage);

export default router;
