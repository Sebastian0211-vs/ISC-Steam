# Game Session Wrapper — Design

Status: draft, not implemented.

## Problem

Games are spawned as external processes (`desktop/games.js`). Many student games
simply exit when a run ends (game over, window closed). The player is dumped back
to the launcher with no feedback and no quick way to play again. There is also no
way to interact with a running game session (restart it, kill a hung one, see the
log) without digging into the install folder.

## Constraints

- Games are packaged Scala/Java (JavaFX/Swing) apps. There is no DirectX/OpenGL
  swapchain to hook, so a Steam-style injected overlay is off the table. A
  transparent window tracked to the game window would need per-OS native APIs
  and breaks on fullscreen — also rejected.
- Everything we need already flows through `games.js`: the `running` map holds
  the child process, `finish()` sees the exit code, session duration, log tail,
  and `launch.log` path. The wrapper is purely additive.
- The web client detects the desktop build via `window.iscSteam` (preload.js)
  and receives `isc:game-event` broadcasts (`started` / `exited`).

## Chosen shape

Three layers, buildable independently, in this order:

### 1. Post-exit panel (core)

A small Electron `BrowserWindow` (local HTML, ~420×260, frameless, centered)
shown by `finish()` whenever a session ends after the game showed a window
(skip it for launch failures — the existing error dialog already covers those).

Contents:

- Title, cover thumbnail (from `meta.coverUrl`), session duration, exit code.
- **Play again** → calls `play(appUrl, slug)` again.
- **Open log** → `shell.openPath(launch.log)`.
- **Open folder** → existing `openFolder(slug)`.
- Crash variant (nonzero exit): shows the captured log tail inline and a
  **Report to publisher** button (opens the game's store page, or posts the
  tail + log to a future `/api/games/:slug/reports` endpoint).
- Optional: star rating that forwards to the existing store rating endpoint,
  only shown if the player hasn't rated the game yet.
- "Don't show this again for this game" checkbox → persisted in
  `iscsteam.json` as `noExitPanel: [slug]`.

### 2. In-launcher "Now playing" bar (cheap, no new window)

The launcher already receives `started`/`exited` events. Add a slim bar in the
web client (client-side only) while a session is running: cover, title, live
timer, **Restart** and **Stop** buttons. Requires two new IPC handlers:

- `isc:stop(slug)` → `child.kill()` (with a `taskkill /pid /t` fallback on
  Windows since .bat launchers spawn a java child — kill the tree, not cmd).
- `isc:restart(slug)` → stop, wait for exit, play again.

### 3. Session options (later, per-game)

- **Loop mode**: per-game toggle ("relaunch automatically when the game
  exits cleanly") for arcade-style games — guard with a max-relaunch counter
  and a cancel window (e.g. the post-exit panel shows "Relaunching in 5s…
  [Cancel]") to avoid infinite crash loops.
- Cumulative local playtime per game (sum of session seconds, stored in the
  game's `.iscsteam.json` meta), shown in the library and on the exit panel.
- Chat toasts while playing: main window is usually behind the game; forward
  Socket.IO chat events to a corner toast via the OS `Notification` API
  (already have the AppUserModelId set up for Windows toasts).

## Implementation notes

- `finish()` currently deletes the session before it can be reused — keep a
  `lastSession` map (`slug → { exitCode, seconds, logFile, tail }`) so the
  panel and "Play again" have what they need after cleanup.
- Killing the process tree on Windows: the tracked `child` is `cmd.exe`;
  `child.kill()` orphans the JVM. Use
  `spawn('taskkill', ['/pid', child.pid, '/t', '/f'])`.
  On Linux, spawn with `detached: true` and kill `-pid` (process group).
- The post-exit panel is main-process-owned (new `desktop/session-ui/` folder
  with a static HTML file + tiny preload), so it works even if the web app is
  offline.
- Restart must debounce: disable the button until the `exited` event arrives,
  or `running.has(slug)` will reject the relaunch.
- Discord rich presence: `restart` should not flicker — keep `setPlaying`
  active across an immediate relaunch.

## Rollout order

1. Process-tree kill + `stop`/`restart` IPC (prerequisite for everything).
2. Post-exit panel with Play again / Open log / Open folder.
3. Now-playing bar in the client.
4. Loop mode, playtime, crash report, rating prompt.
