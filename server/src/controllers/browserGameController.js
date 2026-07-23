import path from 'node:path';
import Game from '../models/Game.js';
import { openDownload } from '../config/gridfs.js';

const INPUT_BRIDGE = `(() => {
  const keyForCode = (code) => {
    if (code === 'Space') return ' ';
    if (code.startsWith('Key')) return code.slice(3).toLowerCase();
    if (code.startsWith('Digit')) return code.slice(5);
    return code;
  };
  window.addEventListener('message', (event) => {
    const message = event.data;
    if (event.source !== window.parent || !message || message.source !== 'iscsteam-player' || message.type !== 'input') return;
    const code = String(message.code || '');
    if (!/^[A-Za-z][A-Za-z0-9]{0,30}$/.test(code)) return;
    const phase = message.phase === 'up' ? 'up' : 'down';
    const target = document.activeElement || document.body;
    if (target && typeof target.focus === 'function') target.focus({ preventScroll: true });
    target.dispatchEvent(new KeyboardEvent(phase === 'up' ? 'keyup' : 'keydown', {
      key: keyForCode(code), code, repeat: !!message.repeat, bubbles: true, cancelable: true,
    }));
    window.dispatchEvent(new CustomEvent('iscsteam-input', { detail: {
      action: String(message.action || ''), code, phase,
    }}));
  });
  window.parent.postMessage({ source: 'iscsteam-game', type: 'bridge-ready' }, '*');
})();`;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

function documentCsp() {
  return [
    "default-src 'self' data: blob:",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'self'",
    'sandbox allow-scripts allow-forms allow-pointer-lock',
  ].join('; ');
}

export function canvasModuleDocument(game) {
  const width = Number(game.browserViewport?.width) || 960;
  const height = Number(game.browserViewport?.height) || 600;
  const entry = JSON.stringify(`./${game.browserEntry}`).replaceAll('<', '\\u003c');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <title>${escapeHtml(game.title)}</title>
  <style>
    html,body{width:100%;height:100%;margin:0;overflow:hidden;background:#05060a;color:#fff;font-family:system-ui,sans-serif}
    body{display:grid;place-items:center}
    canvas{display:block;width:100%;height:100%;object-fit:contain;outline:0;touch-action:none}
    #error{display:none;position:fixed;inset:auto 1rem 1rem;padding:.75rem 1rem;background:#74133b;border-radius:.5rem}
  </style>
</head>
<body>
  <canvas id="isc-game" width="${width}" height="${height}" tabindex="0" aria-label="${escapeHtml(game.title)} game canvas"></canvas>
  <div id="error" role="alert"></div>
  <script>${INPUT_BRIDGE}</script>
  <script type="module">
    const canvas = document.querySelector('#isc-game');
    const inputListeners = new Set();
    window.addEventListener('iscsteam-input', (event) => inputListeners.forEach((listener) => listener(event.detail)));
    const api = Object.freeze({
      canvas,
      onInput(listener) { inputListeners.add(listener); return () => inputListeners.delete(listener); },
      emit(type, detail = {}) { window.parent.postMessage({ source: 'iscsteam-game', type, ...detail }, '*'); },
    });
    try {
      const gameModule = await import(${entry});
      const mount = gameModule.mount || gameModule.default;
      if (typeof mount !== 'function') throw new Error('Browser module must export mount({ canvas, api }) or a default function.');
      await mount({ canvas, api });
      canvas.focus({ preventScroll: true });
      api.emit('ready');
    } catch (error) {
      const panel = document.querySelector('#error');
      panel.textContent = 'Could not start this browser build: ' + error.message;
      panel.style.display = 'block';
      api.emit('error', { message: error.message });
    }
  </script>
</body>
</html>`;
}

function findBrowserGame(slug) {
  return Game.findOne({
    slug,
    published: true,
    browserBuildStatus: { $in: ['packaging', 'success', 'stale'] },
    'browserFiles.0': { $exists: true },
  });
}

export function parseByteRange(value, size) {
  if (!value) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(String(value).trim());
  if (!match || !Number.isSafeInteger(size) || size < 1) return { invalid: true };
  let start;
  let end;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix < 1) return { invalid: true };
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : size - 1;
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) {
    return { invalid: true };
  }
  return { start, end: Math.min(end, size - 1) };
}

function setBrowserHeaders(res, contentType, size, range) {
  res.set('Content-Type', contentType);
  res.set('Content-Length', String(range ? range.end - range.start + 1 : size));
  res.set('Content-Disposition', 'inline');
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Range');
  res.set('Access-Control-Expose-Headers', 'Accept-Ranges, Content-Length, Content-Range');
  res.set('Accept-Ranges', 'bytes');
  if (range) res.set('Content-Range', `bytes ${range.start}-${range.end}/${size}`);
  res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), hid=()');
  res.set('Cache-Control', /text\/html/i.test(contentType) ? 'no-store' : 'public, max-age=3600');
  res.set('Content-Security-Policy', documentCsp());
}

function requestPath(req, fallback) {
  const raw = String(req.params[0] ?? '').replaceAll('\\', '/');
  if (raw.includes('\0')) return null;
  const normalized = path.posix.normalize(raw || fallback).replace(/^\.\//, '');
  if (!normalized || normalized === '..' || normalized.startsWith('../') || normalized.startsWith('/')) return null;
  return normalized;
}

async function streamBrowserFile(req, res, next, rawPath, loadedGame) {
  try {
    const game = loadedGame ?? await findBrowserGame(req.params.slug);
    if (!game) return res.status(404).json({ error: 'Browser game not found' });

    if (rawPath !== undefined) req.params[0] = rawPath;
    const wanted = requestPath(req, game.browserEntry);
    if (!wanted) return res.status(400).json({ error: 'Invalid browser asset path' });
    const file = game.browserFiles.find((candidate) => candidate.path === wanted);
    if (!file) return res.status(404).json({ error: 'Browser asset not found' });

    const range = parseByteRange(req.headers.range, file.size);
    if (range?.invalid) {
      res.status(416).set('Content-Range', `bytes */${file.size}`);
      return res.end();
    }
    if (range) res.status(206);
    setBrowserHeaders(res, file.contentType, file.size, range);
    openDownload(file.fileId, range ? { start: range.start, end: range.end + 1 } : undefined)
      .on('error', next)
      .pipe(res);
  } catch (err) {
    next(err);
  }
}

export async function browserGameRoot(req, res, next) {
  const pathname = req.originalUrl.split('?')[0];
  if (!pathname.endsWith('/')) {
    return res.redirect(308, `${req.baseUrl}/${encodeURIComponent(req.params.slug)}/play/`);
  }
  try {
    const game = await findBrowserGame(req.params.slug);
    if (!game) return res.status(404).json({ error: 'Browser game not found' });
    if (game.browserRuntime === 'canvas-module') {
      const document = Buffer.from(canvasModuleDocument(game));
      setBrowserHeaders(res, 'text/html; charset=utf-8', document.length);
      return res.end(document);
    }
    return streamBrowserFile(req, res, next, '', game);
  } catch (err) {
    return next(err);
  }
}

export function browserGameFile(req, res, next) {
  return streamBrowserFile(req, res, next);
}
