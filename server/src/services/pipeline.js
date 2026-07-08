import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, mkdir, readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';
import Game from '../models/Game.js';
import { readManifest, ManifestError } from './manifest.js';
import { uploadFromBuffer, uploadFromPath, deleteFile } from '../config/gridfs.js';

const run = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VENDOR_DIR = path.join(__dirname, '..', '..', 'vendor');

const GIT_TIMEOUT = 120000;
const COMPILE_TIMEOUT = 300000;
const MAX_BUFFER = 16 * 1024 * 1024;

// JavaFX support: per-platform jars are fetched from Maven Central once and
// cached in server/vendor/javafx-cache. Merging all platforms into the fat
// jar makes one download run on Windows, macOS (Intel + Apple Silicon) and Linux.
const JAVAFX_VERSION = process.env.JAVAFX_VERSION ?? '17.0.13';
const JAVAFX_PLATFORMS = ['win', 'linux', 'mac', 'mac-aarch64'];
const JAVAFX_CACHE = path.join(VENDOR_DIR, 'javafx-cache');

/* ---------------------------------------------------------------- queue --
   One build at a time: scalac is heavy and student servers are small. */

const queue = [];
let busy = false;

export function enqueueBuild(gameId) {
  queue.push(gameId.toString());
  if (!busy) void drain();
}

async function drain() {
  busy = true;
  while (queue.length) {
    const id = queue.shift();
    try {
      await buildGame(id);
    } catch (err) {
      console.error(`[build] unhandled failure for ${id}:`, err);
    }
  }
  busy = false;
}

/* ---------------------------------------------------------------- build -- */

class BuildLog {
  constructor(game) {
    this.game = game;
    this.lines = [];
  }
  async phase(status, msg) {
    this.add(msg);
    this.game.buildStatus = status;
    this.game.buildLog = this.text();
    await this.game.save();
  }
  add(msg) {
    for (const line of String(msg).split('\n')) {
      this.lines.push(`[${new Date().toISOString().slice(11, 19)}] ${line}`);
    }
  }
  text() {
    return this.lines.join('\n').slice(-100000);
  }
}

async function buildGame(gameId) {
  const game = await Game.findById(gameId);
  if (!game) return;
  const log = new BuildLog(game);
  const work = await mkdtemp(path.join(tmpdir(), 'isc-build-'));
  const repoDir = path.join(work, 'repo');

  try {
    // 1 — clone -----------------------------------------------------------
    await log.phase('cloning', `Cloning ${game.repoUrl}${game.branch ? ` (branch ${game.branch})` : ''} …`);
    await ensureTool('git', ['--version'], 'git is not installed on the build server');
    const cloneArgs = ['clone', '--depth', '1', ...(game.branch ? ['--branch', game.branch] : []), game.repoUrl, repoDir];
    await run('git', cloneArgs, { timeout: GIT_TIMEOUT, maxBuffer: MAX_BUFFER });
    const { stdout: commit } = await run('git', ['-C', repoDir, 'rev-parse', 'HEAD'], { timeout: GIT_TIMEOUT });
    game.commit = commit.trim().slice(0, 12);
    log.add(`At commit ${game.commit}`);

    // 2 — manifest + metadata ---------------------------------------------
    const m = await readManifest(repoDir);
    log.add(`Manifest OK: "${m.title}" v${m.version} (main: ${m.mainClass})`);
    Object.assign(game, {
      title: m.title,
      shortDescription: m.shortDescription,
      description: m.description,
      version: m.version,
      authors: m.authors,
      tags: m.tags,
      controls: m.controls,
      year: m.year,
      engine: m.engine,
      mainClass: m.mainClass,
    });

    // media: replace previous files in GridFS
    const oldMedia = game.media;
    game.media = [];
    if (m.cover) await importImage(game, repoDir, m.cover, 'cover', log);
    for (const shot of m.screenshots) await importImage(game, repoDir, shot, 'screenshot', log);
    for (const old of oldMedia) await deleteFile(old.fileId);
    await game.save();

    // 3 — compile ----------------------------------------------------------
    await log.phase('building', 'Collecting sources …');
    const sourceDirs = m.sources.map((s) => path.join(repoDir, s));
    const scalaFiles = [];
    for (const dir of sourceDirs) await collect(dir, (f) => f.endsWith('.scala'), scalaFiles);
    if (!scalaFiles.length) throw new ManifestError(`No .scala files found under: ${m.sources.join(', ')}`);
    log.add(`${scalaFiles.length} Scala source file(s)`);

    const engineJar = await findEngineJar(repoDir, log);
    const jfxJars = m.javafx ? await ensureJavaFxJars(m.javafxModules, log) : [];
    if (m.javafx) {
      log.add(`JavaFX ${JAVAFX_VERSION} enabled (modules: ${m.javafxModules.join(', ')})`);
      log.add('Note: mainClass must NOT extend javafx.application.Application — use a plain wrapper object that calls Application.launch(...).');
    }
    const classesDir = path.join(work, 'classes');
    await mkdir(classesDir);

    await ensureTool('scalac', ['-version'], 'scalac is not installed on the build server (install Scala 2.13)');
    const argsFile = path.join(work, 'sources.txt');
    await writeFile(argsFile, scalaFiles.map((f) => `"${f.replaceAll('\\', '/')}"`).join('\n'));
    const classpath = [engineJar, ...jfxJars].filter(Boolean).join(path.delimiter);
    log.add(`Compiling with scalac${engineJar ? ` against ${path.basename(engineJar)}` : ''} …`);
    try {
      await run('scalac', ['-classpath', classpath, '-d', classesDir, `@${argsFile}`], {
        timeout: COMPILE_TIMEOUT,
        maxBuffer: MAX_BUFFER,
        shell: process.platform === 'win32',
      });
    } catch (err) {
      throw new BuildFailure(`Compilation failed:\n${err.stderr || err.stdout || err.message}`);
    }
    log.add('Compilation OK');

    // 4 — package ----------------------------------------------------------
    await log.phase('packaging', 'Assembling runnable jar …');
    const jar = new AdmZip();
    const seen = new Set();
    const put = (entryName, data) => {
      const name = entryName.replaceAll('\\', '/');
      if (seen.has(name) || name.endsWith('/')) return;
      seen.add(name);
      jar.addFile(name, data);
    };

    put('META-INF/MANIFEST.MF', Buffer.from(`Manifest-Version: 1.0\r\nMain-Class: ${m.mainClass}\r\nCreated-By: ISC Steam\r\n\r\n`));

    // compiled classes
    const classFiles = [];
    await collect(classesDir, () => true, classFiles);
    for (const f of classFiles) put(path.relative(classesDir, f), await readFile(f));

    // engine + scala runtime + (optionally) JavaFX, merged in
    for (const dep of [engineJar, await findScalaLibrary(log), ...jfxJars].filter(Boolean)) {
      mergeJar(jar, seen, dep);
      log.add(`Merged ${path.basename(dep)}`);
    }

    // resources (sprites, audio, levels) — path kept relative to the source root
    let resCount = 0;
    for (const resDir of m.resources) {
      const abs = path.join(repoDir, resDir);
      const files = [];
      await collect(abs, (f) => !f.endsWith('.scala') && !f.endsWith('.java'), files);
      const root = m.sources.find((s) => (resDir + '/').startsWith(s + '/')) ?? '';
      for (const f of files) {
        put(path.relative(path.join(repoDir, root), f), await readFile(f));
        resCount += 1;
      }
    }
    log.add(`Bundled ${resCount} resource file(s)`);

    // 5 — zip with launchers ------------------------------------------------
    const jarName = `${game.slug}.jar`;
    const zip = new AdmZip();
    zip.addFile(`${game.slug}/${jarName}`, jar.toBuffer());
    zip.addFile(`${game.slug}/run.sh`, Buffer.from(runSh(jarName, m.title)), '', 0o755 << 16);
    zip.addFile(`${game.slug}/run.bat`, Buffer.from(runBat(jarName, m.title)));
    zip.addFile(`${game.slug}/README.txt`, Buffer.from(readmeTxt(m, game)));
    const zipBuffer = zip.toBuffer();

    const oldPackage = game.packageFileId;
    game.packageFileId = await uploadFromBuffer(zipBuffer, `${game.slug}-${m.version}.zip`, 'application/zip');
    game.packageSize = zipBuffer.length;
    if (oldPackage) await deleteFile(oldPackage);

    game.builtAt = new Date();
    await log.phase('success', `Done — package ${(zipBuffer.length / 1024 / 1024).toFixed(1)} MB`);
  } catch (err) {
    const msg = err instanceof ManifestError || err instanceof BuildFailure ? err.message : `Unexpected error: ${err.message}`;
    log.add(msg);
    game.buildStatus = 'failed';
    game.buildLog = log.text();
    await game.save().catch(() => {});
  } finally {
    await rm(work, { recursive: true, force: true }).catch(() => {});
  }
}

class BuildFailure extends Error {}

/* --------------------------------------------------------------- helpers -- */

async function ensureTool(cmd, args, message) {
  try {
    await run(cmd, args, { timeout: 15000, shell: process.platform === 'win32' });
  } catch {
    throw new BuildFailure(message);
  }
}

async function collect(dir, filter, out) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return; // missing dir → skip silently, manifest may list optional dirs
  }
  for (const e of entries) {
    if (e.name === '.git') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) await collect(full, filter, out);
    else if (filter(full)) out.push(full);
  }
}

async function findEngineJar(repoDir, log) {
  // 1) fungraphics-*.jar committed at the repo root (the ISC convention)
  const candidates = [];
  await collect(repoDir, (f) => /fungraphics.*\.jar$/i.test(path.basename(f)), candidates);
  if (candidates[0]) {
    log.add(`Using engine jar from repo: ${path.basename(candidates[0])}`);
    return candidates[0];
  }
  // 2) vendored on the server (server/vendor/*.jar)
  const vendored = [];
  await collect(VENDOR_DIR, (f) => f.endsWith('.jar'), vendored);
  if (vendored[0]) {
    log.add(`Using vendored engine jar: ${path.basename(vendored[0])}`);
    return vendored[0];
  }
  log.add('Warning: no FunGraphics jar found (repo root or server/vendor) — compiling without engine');
  return null;
}

async function findScalaLibrary(log) {
  if (process.env.SCALA_LIBRARY_JAR) return process.env.SCALA_LIBRARY_JAR;
  // Derive from the scalac install: <scala-home>/lib/scala-library.jar
  try {
    const which = process.platform === 'win32' ? 'where' : 'which';
    const { stdout } = await run(which, ['scalac'], { timeout: 10000, shell: process.platform === 'win32' });
    const scalacPath = stdout.split('\n')[0].trim();
    const { realpath } = await import('node:fs/promises');
    const real = await realpath(scalacPath);
    const lib = path.join(path.dirname(real), '..', 'lib', 'scala-library.jar');
    await stat(lib);
    return lib;
  } catch {
    log.add('Warning: scala-library.jar not found — set SCALA_LIBRARY_JAR in server/.env. The game may not run standalone.');
    return null;
  }
}

/** Download (once) and cache the per-platform JavaFX jars from Maven Central. */
async function ensureJavaFxJars(modules, log) {
  const jars = [];
  await mkdir(JAVAFX_CACHE, { recursive: true });
  for (const mod of modules) {
    for (const plat of JAVAFX_PLATFORMS) {
      const name = `javafx-${mod}-${JAVAFX_VERSION}-${plat}.jar`;
      const dest = path.join(JAVAFX_CACHE, name);
      try {
        await stat(dest);
      } catch {
        const url = `https://repo1.maven.org/maven2/org/openjfx/javafx-${mod}/${JAVAFX_VERSION}/${name}`;
        log.add(`Downloading ${name} …`);
        let res;
        try {
          res = await fetch(url);
        } catch (err) {
          throw new BuildFailure(`Could not reach Maven Central for JavaFX (${name}): ${err.message}`);
        }
        if (!res.ok) throw new BuildFailure(`Could not download JavaFX (${name}): HTTP ${res.status}`);
        await writeFile(dest, Buffer.from(await res.arrayBuffer()));
      }
      jars.push(dest);
    }
  }
  return jars;
}

/** Merge a dependency jar's entries into the fat jar, skipping signatures. */
function mergeJar(target, seen, jarPath) {
  const dep = new AdmZip(jarPath);
  for (const entry of dep.getEntries()) {
    const name = entry.entryName;
    if (entry.isDirectory) continue;
    if (name === 'META-INF/MANIFEST.MF' || /^META-INF\/.*\.(SF|DSA|RSA)$/i.test(name) || name === 'module-info.class') continue;
    if (seen.has(name)) continue;
    seen.add(name);
    target.addFile(name, entry.getData());
  }
}

async function importImage(game, repoDir, rel, kind, log) {
  const abs = path.join(repoDir, rel);
  try {
    await stat(abs);
  } catch {
    log.add(`Warning: ${kind} image not found: ${rel} — skipped`);
    return;
  }
  const ext = path.extname(rel).toLowerCase();
  const contentType = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp' }[ext];
  if (!contentType) {
    log.add(`Warning: unsupported ${kind} format "${ext}" — skipped`);
    return;
  }
  const fileId = await uploadFromPath(abs, `${game.slug}-${kind}${ext}`, contentType);
  game.media.push({ fileId, contentType, kind });
  log.add(`Imported ${kind}: ${rel}`);
}

/* -------------------------------------------------------------- launchers -- */

const runSh = (jar, title) => `#!/bin/sh
# ${title} — packaged by ISC Steam
cd "$(dirname "$0")"
if ! command -v java >/dev/null 2>&1; then
  echo "Java is required to play ${title}. Install it from https://adoptium.net and retry."
  exit 1
fi
exec java -jar "${jar}"
`;

const runBat = (jar, title) => `@echo off\r
rem ${title} — packaged by ISC Steam\r
cd /d "%~dp0"\r
where java >nul 2>nul\r
if errorlevel 1 (\r
  echo Java is required to play ${title}. Install it from https://adoptium.net and retry.\r
  pause\r
  exit /b 1\r
)\r
java -jar "${jar}"\r
`;

const readmeTxt = (m, game) => `${m.title} v${m.version}
${'='.repeat(m.title.length + m.version.length + 2)}

${m.shortDescription}

By: ${m.authors.join(', ') || 'ISC students'}
${m.controls ? `Controls: ${m.controls}\n` : ''}
How to play
-----------
Windows : double-click run.bat
macOS / Linux : ./run.sh   (or: java -jar ${game.slug}.jar)

Requires Java 11+ — https://adoptium.net

Packaged by ISC Steam from ${game.repoUrl} (commit ${game.commit}).
Made with FunGraphics at HES-SO Valais.
`;
