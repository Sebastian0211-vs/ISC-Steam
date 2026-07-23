# The `isc.json` manifest

Every game submitted to ISC Steam should have an **`isc.json`** file at the root of its
Git repository. The platform clones the repo, reads this file when present, compiles the game and
packages it - no manual uploads needed.


If `isc.json` is missing, ISC Steam falls back to minimal metadata from `README*` and simple Scala source detection.

## Minimal example

```json
{
  "iscVersion": 1,
  "title": "Grid Quest",
  "shortDescription": "Navigate compact puzzle rooms, collect keys, and reach the exit.",
  "mainClass": "Main",
  "cover": "src/res/banner.png"
}
```

## Full example

```json
{
  "iscVersion": 1,
  "title": "Grid Quest",
  "shortDescription": "Navigate compact puzzle rooms, collect keys, and reach the exit.",
  "description": "Grid Quest challenges players to solve compact rooms filled with obstacles, locked doors, and moving hazards.\n\nMade for the ISC 1st-year course at HES-SO Valais.",
  "version": "1.0.0",
  "authors": ["Alex Martin", "Camille Rey"],
  "tags": ["puzzle", "2d", "keyboard"],
  "cover": "src/res/banner.png",
  "screenshots": ["src/res/screenshot1.png", "src/res/screenshot2.png"],
  "engine": { "name": "fungraphics", "version": "1.5.15" },
  "scalaVersion": "2.13",
  "mainClass": "Main",
  "sources": ["src"],
  "resources": ["src/res"],
  "controls": "Arrow keys to move · R reset · H hint",
  "year": 2026
}
```

## Fields

| Field | Required | Default | Meaning |
| --- | --- | --- | --- |
| `iscVersion` | yes | - | Manifest format version. Currently `1`. |
| `title` | yes | - | Display name in the store (max 80 chars). |
| `shortDescription` | yes | - | One-liner shown on store cards (max 200 chars). |
| `mainClass` | yes | - | Fully-qualified entry object (the one with `main` / `App`). |
| `description` | no | shortDescription | Long store-page text. Plain text, `\n\n` for paragraphs. |
| `version` | no | `1.0.0` | Game version; shown on the store page and in the package name. |
| `authors` | no | `[]` | Display names of the team. |
| `tags` | no | `[]` | Lowercase genre/feature tags (max 8) used for store filtering. |
| `cover` | no | - | Repo-relative path to the store banner (PNG/JPG, ~2:1 ratio ideal). |
| `screenshots` | no | `[]` | Repo-relative paths, max 6. |
| `engine.name` | no | `fungraphics` | Engine identifier. |
| `engine.version` | no | detected | FunGraphics version. If the repo contains `fungraphics-*.jar` it is detected automatically. |
| `scalaVersion` | no | `2.13` | Scala version used to compile. The builder selects a matching `scalac` installation. |
| `javafx` | no | `false` | Set to `true` if the game uses JavaFX. The build merges the JavaFX jars (all platforms) into the package. |
| `javafxModules` | no | `["controls", "media"]` | JavaFX modules to bundle: `controls`, `media`, `swing`, `fxml`, `web` (`base` and `graphics` are always included). |
| `sources` | no | `["src"]` | Directories containing `.scala` sources. |
| `resources` | no | sources | Directories whose non-source files are bundled into the jar (sprites, audio, levels). Paths are kept **relative to the source root**, so `src/res/x.png` is loaded in-game as `/res/x.png`. |
| `browser` | no | - | Optimized `game.js` target for the experimental browser player. |
| `controls` | no | - | Short line describing keyboard controls, shown on the store page. |
| `year` | no | current | Cohort/class year. |

## Build requirements

The build server compiles your sources with `scalac` against the FunGraphics jar,
then produces a runnable fat jar wrapped in a zip with `run.bat` / `run.sh` launchers.

For the build to succeed your repo must:

1. preferably contain `isc.json` at the root,
2. compile with plain `scalac` (no sbt plugins, no IDE-only setup),
3. include its engine/dependency jars (`fungraphics-*.jar`, `gdx2d-*.jar`, etc.) at the repo root or under `libs/`, rely on the version vendored on the server, or declare Maven dependencies in `build.sbt`/README with sbt syntax,
4. load resources from the classpath or from paths relative to the source root (as FunGraphics examples do).

For repos without `isc.json`, the fallback looks for:

- title and description in the first README heading/paragraphs,
- authors or controls with simple lines like `Authors: Alice, Bob` or `Controls: arrows`,
- the entry point in Scala sources via `object Main extends App` or `def main`.

Scala version fallback order: `build.sbt`, `.scala-version`, README text, dependency
jar names such as `ujson_2.13-...jar` or `scala-library-2.13.14.jar`, then `2.13`.

If a build fails, the full compiler log is visible on your publisher dashboard.

## Browser Beta builds

Browser Beta is currently a proof of work, not an automatic Scala converter.
A game opts in with a native JavaScript module in its own repository:

```json
"browser": {
  "runtime": "canvas-module",
  "directory": "web",
  "entry": "game.js",
  "viewport": { "width": 900, "height": 563 },
  "controlsPreset": "directional-action",
  "inputs": {
    "hint": { "code": "KeyH", "label": "Hint", "mode": "press" }
  }
}
```

A successful package receives the derived **optimized** tag. ISC Steam validates
and stores the static files, then provides the page, canvas, sandbox, fullscreen
mode, and manifest-driven controls. Browser packaging failure does not discard a
successful desktop package.

`controlsPreset` accepts `none`, `directional`, `directional-action`,
`platformer`, `wasd`, or `custom`; explicit inputs add or replace actions. The
server does not execute repository-provided build commands, so generated web
files must already be committed. See [the optimized game.js guide](./OPTIMIZED_WEB_GAME.md)
for the module API, asset/audio rules, and a complete example.

## Using JavaFX

Since Java 11, JavaFX is not bundled with Java - a plain `java -jar` fails with
*"JavaFX runtime components are missing"*. If your game uses JavaFX, set `"javafx": true`
and the platform bundles the JavaFX jars for Windows, macOS (Intel + Apple Silicon) and Linux
into your package.

One requirement: **your `mainClass` must not extend `javafx.application.Application`**
(the Java launcher refuses to start those without JavaFX modules installed). Use a plain
wrapper object instead, and point `mainClass` at it:

```scala
object Launcher {
  def main(args: Array[String]): Unit =
    javafx.application.Application.launch(classOf[MyGameApp], args: _*)
}
```
