import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import logoWhite from '../assets/logo/isc-inline-white.svg';

const FACETS = [
  {
    color: 'var(--isc-sky)',
    title: 'Vite + React client',
    text: 'Fast dev server with hot reload, React Router, and the ISC theme as CSS variables.',
  },
  {
    color: 'var(--isc-mint)',
    title: 'Express API',
    text: 'A /api server with an example CRUD resource, validation errors, and a health endpoint.',
  },
  {
    color: 'var(--isc-lavender)',
    title: 'MongoDB',
    text: 'Mongoose models with timestamps, plus a one-command local database via Docker.',
  },
  {
    color: 'var(--isc-rose)',
    title: 'Shared identity',
    text: 'Official logos, the facet palette, and reusable UI classes documented in the style guide.',
  },
];

export default function Home() {
  const [health, setHealth] = useState({ state: 'checking' });

  useEffect(() => {
    let active = true;
    api
      .get('/health')
      .then((data) => active && setHealth({ state: 'up', db: data.db }))
      .catch(() => active && setHealth({ state: 'down' }));
    return () => {
      active = false;
    };
  }, []);

  const dot =
    health.state === 'checking' ? '' : health.state === 'down' ? 'err' : health.db === 'connected' ? 'ok' : 'warn';
  const text =
    health.state === 'checking'
      ? 'checking api…'
      : health.state === 'down'
        ? 'api unreachable — run: npm run dev:server'
        : `api up · mongodb ${health.db}`;

  return (
    <>
      <section className="hero">
        <div className="container">
          <img src={logoWhite} alt="ISC" className="hero-logo" />
          <h1>
            One template, <span className="accent">every app</span>.
          </h1>
          <p>
            Clone it, rename it, replace the Items demo with your own resources. The visual identity,
            API conventions, and project structure stay consistent across projects.
          </p>
          <div className="statusline" role="status">
            <span className={`dot ${dot}`} aria-hidden="true" />
            <span>{text}</span>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <p className="eyebrow">what's inside</p>
          <h2 className="section-title">The stack</h2>
          <div className="facet-grid">
            {FACETS.map((f) => (
              <article key={f.title} className="card facet-card" style={{ '--facet': f.color }}>
                <h3>{f.title}</h3>
                <p style={{ marginBottom: 0 }}>{f.text}</p>
              </article>
            ))}
          </div>
          <p style={{ marginTop: 'var(--space-4)' }}>
            Start with the <Link to="/items">Items demo</Link> to see the full client → API → database
            round trip, then check the <Link to="/style-guide">style guide</Link> before building new screens.
          </p>
        </div>
      </section>
    </>
  );
}
