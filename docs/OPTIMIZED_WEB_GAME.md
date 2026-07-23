# Optimized `game.js` browser builds

An optimized browser build is a JavaScript version of a game that renders
directly into ISC Steam's canvas. ISCtaker is the current proof of work; this is
an explicit web port, not an automatic conversion of desktop Scala bytecode.

ISC Steam marks a published game as **optimized** automatically when its
`isc.json` declares a `canvas-module` browser target. Do not add `optimized` to
the normal `tags` array; that label is derived from the successfully published
browser artifact.

## Repository layout

The browser output can live beside the normal Scala game:

```text
my-game/
|-- isc.json
|-- src/
|   `-- ... normal Scala game ...
`-- web/
    |-- game.js
    |-- sprites.png
    `-- music.ogg
```

ISC Steam owns the HTML page, canvas, sandbox, fullscreen UI, loading state,
and generated controls. The game repository supplies only static browser files.

## `isc.json` manifest

Add this `browser` object to the normal game manifest:

```json
{
  "iscVersion": 1,
  "title": "My Game",
  "shortDescription": "A short description of the game.",
  "mainClass": "Main",
  "browser": {
    "runtime": "canvas-module",
    "directory": "web",
    "entry": "game.js",
    "viewport": { "width": 960, "height": 600 },
    "controlsPreset": "directional-action",
    "inputs": {
      "hint": { "code": "KeyH", "label": "Hint", "mode": "press" }
    }
  }
}
```

Browser fields:

| Field | Required | Default | Meaning |
| --- | --- | --- | --- |
| `runtime` | yes | - | Use `canvas-module` for an optimized `game.js`. |
| `directory` | no | `web` | Repo-relative directory containing the static web build. |
| `entry` | no | `game.js` | ES module loaded by the ISC Steam player. `.js` and `.mjs` are accepted. |
| `viewport.width` | no | `960` | Logical canvas width, from 240 to 4096. |
| `viewport.height` | no | `600` | Logical canvas height, from 180 to 4096. |
| `controlsPreset` | no | `none` | `none`, `directional`, `directional-action`, `platformer`, `wasd`, or `custom`. |
| `inputs` | no | `{}` | Additional or replacement on-screen actions, up to 12 total. |

Each input maps an action name to a browser keyboard `code`. `mode` is
`press` for a single action or `hold` for movement that should repeat while the
button is held.

## Minimal `game.js`

The entry is an ES module exporting `mount`, or a default function. ISC Steam
calls it once with its canvas and runtime API:

```js
export async function mount({ canvas, api }) {
  const context = canvas.getContext('2d');
  const held = new Set();

  api.onInput(({ action, phase }) => {
    if (phase === 'down') held.add(action);
    else held.delete(action);
  });

  function frame() {
    updateGame(held);
    context.fillStyle = '#0b1020';
    context.fillRect(0, 0, canvas.width, canvas.height);
    drawGame(context);
    requestAnimationFrame(frame);
  }

  api.emit('started');
  requestAnimationFrame(frame);
}
```

## Runtime API

`mount({ canvas, api })` receives:

- `canvas`: the fixed-resolution ISC Steam canvas. Draw with Canvas 2D, WebGL,
  or a browser game library that can use an existing canvas.
- `api.onInput(listener)`: subscribes to generated controls. The listener gets
  `{ action, code, phase }`, where `phase` is `down` or `up`. It returns an
  unsubscribe function.
- `api.emit(type, detail)`: reports game state to the player. Useful event types
  are `started`, `level-complete`, `complete`, and `error`.

The host emits `ready` after `mount` resolves. A module should emit `started`
when gameplay actually begins.

## Assets and audio

Keep assets inside the declared browser directory and resolve them relative to
the module:

```js
const playerImage = new Image();
playerImage.src = new URL('./sprites.png', import.meta.url);

const music = new Audio(new URL('./music.ogg', import.meta.url));
```

Browsers may suspend audio until the first click, key press, or generated
control press. Start or resume music from that interaction.

## Packaging rules

The browser directory must:

1. contain the declared entry module,
2. contain only static files required at runtime,
3. use relative URLs for its own assets,
4. contain no symbolic links or paths outside the repository,
5. remain below 500 files and 100 MB by default.

The ISC Steam build server does not execute repository-provided `npm install`
or `npm run build` commands. If the optimized version uses TypeScript, a
bundler, or another build tool, compile it in the game's own development setup
or CI and commit the resulting static `web/` directory.

After pushing the manifest and browser files, rebuild the game from the
publisher dashboard. A successful `canvas-module` artifact receives the
**optimized** tag automatically.
