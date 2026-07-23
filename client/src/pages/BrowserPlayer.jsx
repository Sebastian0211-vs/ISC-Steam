import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { TagRow } from '../components/GameCard.jsx';
import BrowserGameFrame from '../components/BrowserGameFrame.jsx';

export default function BrowserPlayer() {
  const { slug } = useParams();
  const [game, setGame] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api.get(`/games/${slug}`)
      .then((remote) => {
        if (!active) return;
        if (remote.browserPlayable && remote.playUrl) setGame(remote);
        else setError('This game does not have a published Browser Beta build yet.');
      })
      .catch(() => {
        if (!active) return;
        setError('Browser game not found.');
      });
    return () => { active = false; };
  }, [slug]);

  if (error) {
    return (
      <section className="section">
        <div className="container">
          <p className="eyebrow">Browser Beta</p>
          <h1>Not playable here yet</h1>
          <p>{error}</p>
          <Link className="btn btn-secondary" to="/beta">← Back to Browser Beta</Link>
        </div>
      </section>
    );
  }

  if (!game) return <section className="section"><div className="container"><p>Loading browser build…</p></div></section>;

  return (
    <>
      <div className="browser-player-head">
        <div className="container">
          <div>
            <p className="eyebrow"><Link to="/beta">Browser Beta</Link> / {game.title}</p>
            <h1>{game.title}</h1>
          </div>
          <div className="browser-session-status"><span />{game.browserOptimized ? 'Optimized web build' : 'Platform-owned player'}</div>
        </div>
      </div>

      <section className="section browser-player-section">
        <div className="container browser-player-layout">
          <BrowserGameFrame game={game} />

          <aside className="browser-player-info">
            {game.coverUrl && <img src={game.coverUrl} alt="" />}
            <span className={`beta-label${game.browserOptimized ? ' optimized' : ''}`}>
              {game.browserOptimized ? 'Optimized for web' : 'Browser Beta'}
            </span>
            <h2>{game.title}</h2>
            <p>{game.shortDescription}</p>
            <TagRow tags={game.tags} max={5} />
            {game.controls && (
              <div className="browser-controls">
                <strong>Controls</strong>
                <p>{game.controls}</p>
              </div>
            )}
            <div className="browser-safety-note">
              <strong>No installation</strong>
              <p>This game runs inside an isolated frame and cannot access your ISC Steam account data.</p>
            </div>
            <Link className="btn btn-secondary" to={`/game/${game.slug}`}>View store page</Link>
          </aside>
        </div>
      </section>
    </>
  );
}
