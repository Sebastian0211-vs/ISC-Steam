import Item from '../models/Item.js';

export async function listItems(req, res, next) {
  try {
    const items = await Item.find().sort({ createdAt: -1 });
    res.json(items);
  } catch (err) {
    next(err);
  }
}

export async function createItem(req, res, next) {
  try {
    const item = await Item.create({ title: req.body.title, notes: req.body.notes });
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
}

export async function updateItem(req, res, next) {
  try {
    const item = await Item.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json(item);
  } catch (err) {
    next(err);
  }
}

export async function deleteItem(req, res, next) {
  try {
    const item = await Item.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
