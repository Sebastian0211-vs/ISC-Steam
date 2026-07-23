const EXAMPLE = `{
  "iscVersion": 1,
  "title": "Grid Quest",
  "shortDescription": "Navigate compact puzzle rooms, collect keys, and reach the exit.",
  "description": "Longer store-page text…",
  "version": "1.0.0",
  "authors": ["Alex Martin", "Camille Rey"],
  "tags": ["puzzle", "2d", "keyboard"],
  "cover": "src/res/banner.png",
  "screenshots": ["src/res/screenshot1.png"],
  "engine": { "name": "fungraphics", "version": "1.5.15" },
  "scalaVersion": "2.13",
  "mainClass": "Main",
  "sources": ["src"],
  "resources": ["src/res"],
  "controls": "Arrow keys to move · R reset",
  "year": 2026
}`;

const OPTIMIZED_BROWSER = `"browser": {
  "runtime": "canvas-module",
  "directory": "web",
  "entry": "game.js",
  "viewport": { "width": 960, "height": 600 },
  "controlsPreset": "directional-action",
  "inputs": {
    "hint": { "code": "KeyH", "label": "Hint", "mode": "press" }
  }
}`;

const FIELDS = [
  ['iscVersion', 'yes', 'Manifest format version - currently 1.'],
  ['title', 'yes', 'Display name in the store (max 80 chars).'],
  ['shortDescription', 'yes', 'One-liner shown on store cards (max 200 chars).'],
  ['mainClass', 'yes', 'Fully-qualified entry object, e.g. "Main" or "game.Main".'],
  ['description', 'no', 'Long store-page text; defaults to shortDescription.'],
  ['version', 'no', 'Game version, defaults to 1.0.0.'],
  ['authors', 'no', 'Display names of the team.'],
  ['tags', 'no', 'Lowercase genre tags (max 8), used for store filtering.'],
  ['cover', 'no', 'Repo-relative path to the store banner (~2:1 ratio).'],
  ['screenshots', 'no', 'Repo-relative image paths, max 6.'],
  ['engine.version', 'no', 'FunGraphics version; auto-detected from fungraphics-*.jar in your repo.'],
  ['scalaVersion', 'no', 'Scala version used to compile; defaults to 2.13.'],
  ['javafx', 'no', 'true if the game uses JavaFX - the build bundles the JavaFX jars for every OS.'],
  ['javafxModules', 'no', 'JavaFX modules to bundle (default ["controls", "media"]); base and graphics are always included.'],
  ['sources', 'no', 'Directories with .scala sources - defaults to ["src"].'],
  ['resources', 'no', 'Directories bundled into the jar (sprites, audio, levels); defaults to sources.'],
  ['browser', 'no', 'Optimized game.js target for the experimental browser player.'],
  ['controls', 'no', 'Short keyboard-controls line shown on the store page.'],
  ['year', 'no', 'Cohort year.'],
];

export default function ManifestDocs() {
  return (
    <section className="section">
      <div className="container">
        <p className="eyebrow">For publishers</p>
        <h1 className="section-title" style={{ fontSize: 'var(--text-xl)' }}>The isc.json manifest</h1>
        <p style={{ maxWidth: '46rem' }}>
          Put an <code>isc.json</code> file at the root of your Git repository for full metadata. When you submit the repo,
          the platform clones it, reads this manifest when present, compiles your game with <code>scalac</code> against
          FunGraphics, and packages a runnable download - cover art and screenshots included.
        </p>

        <h2>Example</h2>
        <pre className="build-log" style={{ maxHeight: 'none' }}>{EXAMPLE}</pre>

        <h2 style={{ marginTop: 'var(--space-4)' }}>Fields</h2>
        <table className="table">
          <thead>
            <tr><th>Field</th><th>Required</th><th>Meaning</th></tr>
          </thead>
          <tbody>
            {FIELDS.map(([field, required, meaning]) => (
              <tr key={field}>
                <td className="mono">{field}</td>
                <td>{required}</td>
                <td>{meaning}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 style={{ marginTop: 'var(--space-4)' }}>Build requirements</h2>
        <p style={{ maxWidth: '46rem' }}>
          Your repo must compile with plain <code>scalac</code> (no sbt plugins or IDE-only setup), include
          its <code>fungraphics-*.jar</code> at the root or rely on the server's vendored copy, and load
          resources from the classpath or paths relative to the source root. If a build fails, the full
          compiler log appears on your dashboard.
        </p>

        <h2 style={{ marginTop: 'var(--space-4)' }}>Browser Beta</h2>
        <p style={{ maxWidth: '46rem' }}>
          Browser play currently requires a native module at <code>web/game.js</code>; it does not
          automatically convert FunGraphics bytecode. Add this object to <code>isc.json</code> and the
          pipeline will package the files. Successful builds receive the derived <strong>optimized</strong> tag.
        </p>
        <pre className="build-log" style={{ maxHeight: 'none' }}>{OPTIMIZED_BROWSER}</pre>
        <p style={{ maxWidth: '46rem' }}>
          The module exports <code>mount({'{ canvas, api }'})</code>. ISC Steam owns the canvas and controls;
          assets stay relative to <code>game.js</code>. See the repository documentation for the full contract.
        </p>

        <h2 style={{ marginTop: 'var(--space-4)' }}>Using JavaFX?</h2>
        <p style={{ maxWidth: '46rem' }}>
          Set <code>"javafx": true</code> and the build bundles the JavaFX jars for every OS into your
          package. Important: your <code>mainClass</code> must <strong>not</strong> extend{' '}
          <code>javafx.application.Application</code> - use a plain wrapper object that calls{' '}
          <code>Application.launch(classOf[MyGameApp], args: _*)</code> and point <code>mainClass</code> at it.
        </p>
      </div>
    </section>
  );
}
