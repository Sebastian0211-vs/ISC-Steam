import { Router } from 'express';
import { listItems, createItem, updateItem, deleteItem } from '../controllers/itemController.js';

const router = Router();

router.get('/', listItems);
router.post('/', createItem);
router.patch('/:id', updateItem);
router.delete('/:id', deleteItem);

export default router;
