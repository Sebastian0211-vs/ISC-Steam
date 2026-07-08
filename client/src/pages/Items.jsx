import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

// Example CRUD page wired to /api/items.
// Copy this pattern for your own resources, then delete the demo.
export default function Items() {
  const [items, setItems] = useState([]);
  const [title, setTitle] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      setItems(await api.get('/items'));
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function addItem(e) {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      const item = await api.post('/items', { title: title.trim() });
      setItems((prev) => [item, ...prev]);
      setTitle('');
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggle(item) {
    try {
      const updated = await api.patch(`/items/${item._id}`, { done: !item.done });
      setItems((prev) => prev.map((i) => (i._id === updated._id ? updated : i)));
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(item) {
    try {
      await api.delete(`/items/${item._id}`);
      setItems((prev) => prev.filter((i) => i._id !== item._id));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="section">
      <div className="container">
        <p className="eyebrow">demo resource</p>
        <h1 className="section-title">Items</h1>
        <p>
          A full round trip: React state → <code>/api/items</code> → Mongoose. Replace this page and
          the matching server files with your app's real resources.
        </p>

        <form className="item-form" onSubmit={addItem}>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add an item…"
            aria-label="Item title"
            maxLength={120}
          />
          <button className="btn btn-primary" type="submit" disabled={!title.trim()}>
            Add item
          </button>
        </form>

        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        {loading && <p className="mono">loading…</p>}
        {!loading && !error && items.length === 0 && (
          <p className="notice">No items yet. Add one above — it's stored in MongoDB.</p>
        )}

        <ul className="item-list">
          {items.map((item) => (
            <li key={item._id} className={`card item-row ${item.done ? 'done' : ''}`}>
              <input
                type="checkbox"
                checked={item.done}
                onChange={() => toggle(item)}
                aria-label={`Mark "${item.title}" as ${item.done ? 'not done' : 'done'}`}
              />
              <span className="title">{item.title}</span>
              <span className="badge badge-sky mono">{new Date(item.createdAt).toLocaleDateString()}</span>
              <button className="btn btn-ghost" onClick={() => remove(item)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
