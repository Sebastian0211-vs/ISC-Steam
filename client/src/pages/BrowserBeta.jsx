import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { TagRow } from '../components/GameCard.jsx';

function formatSize(bytes) {
  if (!bytes) return 'Web module';
  return bytes > 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.ceil(bytes / 1024)} KB`;
}

function BrowserGameCard({ game }) {
  return (
    <Link to={`/beta/${game.slug}`} className="beta-game-card">
      <div className="beta-cover">
        {game.coverUrl
          ? <img src={game.coverUrl} alt={`${game.title} cover`} loading="lazy" />
          : <span className="cover-fallback">{game.title}</span>}
        <span className="beta-play-mark" aria-hidden="true">▶</span>
        <span className="beta-ribbon">Proof of work</span>
      </div>
      <div className="beta-card-body">
        <div className="beta-card-title">
          <h3>{game.title}</h3>
          <span className="beta-origin optimized">Optimized</span>
        </div>
        <p>{game.shortDescription}</p>
        <div className="beta-card-meta">
          <TagRow tags={game.tags} max={3} />
          <span>{formatSize(game.browserSize)}</span>
        </div>
      </div>
    </Link>
  );
}

export default function BrowserBeta() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiUnavailable, setApiUnavailable] = useState(false);

  useEffect(() => {
    api.get('/games?browser=1')
      .then((items) => setGames(items.filter((game) => game.browserOptimized)))
      .catch(() => setApiUnavailable(true))
      .finally(() => setLoading(false));
  }, []);

  const featured = games.find((game) => game.slug === 'isctaker') ?? games[0];

  return (
    <>
      <section className="beta-hero">
        <div className="container beta-hero-grid">
          <div className="beta-hero-copy">
            <span className="beta-label">Experimental · no installation</span>
            <p className="eyebrow">ISC Steam Labs</p>
            <h1>A working browser-game <span>prototype.</span></h1>
            <p>
              ISCtaker proves that ISC Steam can host the player, canvas, fullscreen mode,
              and generated controls while a game-owned <code>game.js</code> handles gameplay.
            </p>
            {featured && <Link className="btn btn-primary" to={`/beta/${featured.slug}`}>Play {featured.title}</Link>}
          </div>
          {featured ? (
            <Link to={`/beta/${featured.slug}`} className="beta-feature-card">
              {featured.coverUrl && <img src={featured.coverUrl} alt={`${featured.title} browser build`} />}
              <div className="beta-feature-overlay">
                <span>Optimized proof of work</span>
                <strong>{featured.title}</strong>
                <small>Native game.js · sandboxed by ISC Steam</small>
              </div>
            </Link>
          ) : (
            <div className="beta-feature-card beta-feature-empty">
              <div className="beta-feature-overlay">
                <span>Proof of work</span>
                <strong>ISCtaker browser build</strong>
                <small>{loading ? 'Checking the game database…' : 'No published optimized build is available.'}</small>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="section">
        <div className="container">
          <p className="eyebrow">Playable prototype</p>
          <h2 className="section-title">Optimized for the browser</h2>
          {apiUnavailable && <p className="notice">The game database is unavailable, so the prototype cannot be listed right now.</p>}
          {!loading && !apiUnavailable && games.length === 0 && <p>No optimized browser build is published yet.</p>}
          <div className="beta-grid">
            {games.map((game) => <BrowserGameCard key={game.slug} game={game} />)}
          </div>
        </div>
      </section>

      <section className="beta-how">
        <div className="container">
          <p className="eyebrow">Why this is not automatic yet</p>
          <h2>FunGraphics games share an engine, not a browser contract</h2>
          <div className="beta-challenges">
            <article><strong>Desktop runtime</strong><p>FunGraphics runs on the JVM and uses desktop Java graphics APIs that browsers do not provide.</p></article>
            <article><strong>Rendering & timing</strong><p>Games mix engine calls, custom drawing, threads, and blocking loops in ways that cannot all map safely to one global script.</p></article>
            <article><strong>Assets & audio</strong><p>Browser loading is asynchronous, paths resolve differently, and sound waits for a user interaction.</p></article>
            <article><strong>Project differences</strong><p>Direct Java APIs, input assumptions, and engine versions create game-specific compatibility gaps.</p></article>
          </div>
          <p className="beta-direction">
            The next useful step is an ISC toolkit for future FunGraphics and gdx2d games: a small,
            documented API for rendering, input, assets, accounts, and multiplayer. Games that adopt
            that contract could become browser-ready predictably; existing games still need a tailored port.
          </p>
          <Link to="/docs/manifest">Read the optimized game.js manifest →</Link>
        </div>
      </section>
    </>
  );
}
