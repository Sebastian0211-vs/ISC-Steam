// Topbar widgets: UserMenu (avatar dropdown), PatchNotesBell, AnnouncementBanner.
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from './../context/AuthContext.jsx';
import { useSocial } from './../context/SocialContext.jsx';
import { Avatar } from './profile/ProfileBits.jsx';

function useClickOutside(open, close) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) close();
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open, close]);
  return ref;
}

export function UserMenu() {
  const { user, logout } = useAuth();
  const social = useSocial();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(open, () => setOpen(false));

  if (!user) return null;

  function onLogout() {
    setOpen(false);
    logout();
    navigate('/');
  }

  const state = social?.appearOffline ? 'offline' : social?.playing ? 'ingame' : social?.idle ? 'idle' : 'online';

  return (
    <div className="user-menu" ref={ref}>
      <button
        type="button"
        className="user-menu-button"
        onClick={() => setOpen((o) => !o)}
        title={user.displayName}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Avatar user={{ displayName: user.displayName, avatarUrl: user.avatarUrl }} size={34} />
        <span className={`presence-dot ${state}`} />
      </button>

      {open && (
        <div className="topbar-dropdown" role="menu">
          <div className="topbar-dropdown-head">
            <strong>{user.displayName}</strong>
            <small>@{user.username}</small>
          </div>
          <Link to={`/user/${user.username}`} onClick={() => setOpen(false)}>View profile</Link>
          <Link to="/library" onClick={() => setOpen(false)}>Library</Link>
          {social && (
            <label className="topbar-dropdown-toggle">
              <input
                type="checkbox"
                checked={social.appearOffline}
                onChange={(e) => social.setAppearOffline(e.target.checked)}
              />
              Appear offline
            </label>
          )}
          <button type="button" onClick={onLogout}>Sign out</button>
        </div>
      )}
    </div>
  );
}

export function PatchNotesBell() {
  const [releases, setReleases] = useState([]);
  const [open, setOpen] = useState(false);
  const [unseen, setUnseen] = useState(false);
  const ref = useClickOutside(open, () => setOpen(false));

  useEffect(() => {
    api.get('/releases')
      .then((d) => {
        setReleases(d.releases);
        if (d.releases[0] && localStorage.getItem('lastSeenRelease') !== d.releases[0].tag) {
          setUnseen(true);
        }
      })
      .catch(() => {});
  }, []);

  function toggle() {
    setOpen((o) => !o);
    if (!open && releases[0]) {
      localStorage.setItem('lastSeenRelease', releases[0].tag);
      setUnseen(false);
    }
  }

  return (
    <div className="user-menu" ref={ref}>
      <button type="button" className="bell-button" onClick={toggle} title="Patch notes" aria-label="Patch notes">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unseen && <span className="bell-badge" />}
      </button>

      {open && (
        <div className="topbar-dropdown patch-notes" role="menu">
          <div className="topbar-dropdown-head"><strong>Patch notes</strong></div>
          {releases.length === 0 && <p className="social-empty">No releases yet.</p>}
          {releases.slice(0, 5).map((r) => (
            <article key={r.tag} className="patch-note">
              <header>
                <a href={r.url} target="_blank" rel="noreferrer">{r.name}</a>
                <time dateTime={r.publishedAt}>{new Date(r.publishedAt).toLocaleDateString()}</time>
              </header>
              {r.body && <pre>{r.body.slice(0, 600)}</pre>}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export function AnnouncementBanner() {
  const [announcement, setAnnouncement] = useState(null);

  useEffect(() => {
    api.get('/announcement')
      .then((d) => {
        if (d.announcement && localStorage.getItem('dismissedAnnouncement') !== d.announcement.id) {
          setAnnouncement(d.announcement);
        }
      })
      .catch(() => {});
  }, []);

  if (!announcement) return null;

  function dismiss() {
    localStorage.setItem('dismissedAnnouncement', announcement.id);
    setAnnouncement(null);
  }

  return (
    <div className="announcement-banner" role="status">
      <span className="announcement-text">
        📣 {announcement.text}
        {announcement.link && (
          <>
            {' '}
            <a href={announcement.link} target="_blank" rel="noreferrer">Learn more</a>
          </>
        )}
      </span>
      <button type="button" onClick={dismiss} aria-label="Dismiss announcement">✕</button>
    </div>
  );
}
