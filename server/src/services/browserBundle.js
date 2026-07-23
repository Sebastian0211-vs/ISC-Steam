import { readdir, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { deleteFile, uploadFromPath } from '../config/gridfs.js';

const DEFAULT_MAX_FILES = 500;
const DEFAULT_MAX_BYTES = 100 * 1024 * 1024;

const CONTENT_TYPES = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.wasm', 'application/wasm'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.avif', 'image/avif'],
  ['.svg', 'image/svg+xml'],
  ['.ico', 'image/x-icon'],
  ['.mp3', 'audio/mpeg'],
  ['.ogg', 'audio/ogg'],
  ['.wav', 'audio/wav'],
  ['.m4a', 'audio/mp4'],
  ['.aac', 'audio/aac'],
  ['.flac', 'audio/flac'],
  ['.mp4', 'video/mp4'],
  ['.webm', 'video/webm'],
  ['.ogv', 'video/ogg'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
  ['.ttf', 'font/ttf'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.csv', 'text/csv; charset=utf-8'],
  ['.xml', 'application/xml; charset=utf-8'],
  ['.atlas', 'text/plain; charset=utf-8'],
  ['.fnt', 'text/plain; charset=utf-8'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'],
  ['.gltf', 'model/gltf+json'],
  ['.glb', 'model/gltf-binary'],
  ['.map', 'application/json; charset=utf-8'],
  ['.data', 'application/octet-stream'],
  ['.dat', 'application/octet-stream'],
  ['.mem', 'application/octet-stream'],
  ['.pak', 'application/octet-stream'],
  ['.bin', 'application/octet-stream'],
]);

function positiveLimit(value, fallback) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function contentType(filename) {
  return CONTENT_TYPES.get(path.extname(filename).toLowerCase()) ?? null;
}

async function collectBrowserFiles(root) {
  const files = [];

  async function walk(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isSymbolicLink()) {
        throw new Error(`Browser bundle may not contain symbolic links (${entry.name})`);
      }
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(absolute);
        continue;
      }
      if (!entry.isFile()) continue;

      const relative = path.relative(root, absolute).replaceAll('\\', '/');
      const type = contentType(relative);
      if (!type) {
        throw new Error(`Unsupported browser asset type: ${relative}`);
      }
      const info = await stat(absolute);
      files.push({ absolute, path: relative, contentType: type, size: info.size });
    }
  }

  await walk(root);
  files.sort((a, b) => a.path.localeCompare(b.path));
  return files;
}

function previousBrowserState(game) {
  return {
    files: game.browserFiles.map((file) => file.toObject()),
    meta: {
      browserEntry: game.browserEntry,
      browserRuntime: game.browserRuntime,
      browserControlsPreset: game.browserControlsPreset,
      browserViewport: game.browserViewport?.toObject?.() ?? game.browserViewport,
      browserInputs: game.browserInputs.map((input) => input.toObject()),
      browserSize: game.browserSize,
      browserBuiltAt: game.browserBuiltAt,
      browserBuildStatus: game.browserBuildStatus,
      browserBuildLog: game.browserBuildLog,
    },
  };
}

async function persistBrowserBundle(game, files, spec, logMessage) {
  const uploaded = [];
  try {
    for (const file of files) {
      const fileId = await uploadFromPath(
        file.absolute,
        `${game.slug}/browser/${game.commit || 'build'}/${file.path}`,
        file.contentType,
      );
      uploaded.push({ path: file.path, fileId, contentType: file.contentType, size: file.size });
    }
  } catch (err) {
    for (const file of uploaded) await deleteFile(file.fileId);
    throw err;
  }

  const previous = previousBrowserState(game);
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  game.browserFiles = uploaded;
  game.browserEntry = spec.entry;
  game.browserRuntime = spec.runtime;
  game.browserControlsPreset = spec.controlsPreset;
  game.browserViewport = spec.viewport;
  game.browserInputs = spec.inputs;
  game.browserSize = totalSize;
  game.browserBuiltAt = new Date();
  game.browserBuildStatus = 'success';
  game.browserBuildLog = logMessage ?? `Browser bundle ready: ${files.length} files, ${(totalSize / 1024 / 1024).toFixed(1)} MB`;

  try {
    await game.save();
  } catch (err) {
    for (const file of uploaded) await deleteFile(file.fileId);
    game.browserFiles = previous.files;
    Object.assign(game, previous.meta);
    throw err;
  }

  for (const file of previous.files) await deleteFile(file.fileId);
  return { files: files.length, size: totalSize };
}

export async function installBrowserBundle(game, repoDir, spec) {
  const repoRoot = await realpath(repoDir);
  const requestedRoot = path.resolve(repoDir, spec.directory);
  const browserRoot = await realpath(requestedRoot).catch(() => {
    throw new Error(`Browser directory not found: ${spec.directory}`);
  });

  if (browserRoot !== repoRoot && !browserRoot.startsWith(`${repoRoot}${path.sep}`)) {
    throw new Error('Browser directory resolves outside the game repository');
  }

  const files = await collectBrowserFiles(browserRoot);
  const maxFiles = positiveLimit(process.env.BROWSER_BUILD_MAX_FILES, DEFAULT_MAX_FILES);
  const maxBytes = positiveLimit(process.env.BROWSER_BUILD_MAX_BYTES, DEFAULT_MAX_BYTES);
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);

  if (!files.length) throw new Error(`Browser directory is empty: ${spec.directory}`);
  if (files.length > maxFiles) throw new Error(`Browser bundle has ${files.length} files; limit is ${maxFiles}`);
  if (totalSize > maxBytes) {
    throw new Error(`Browser bundle is ${(totalSize / 1024 / 1024).toFixed(1)} MB; limit is ${(maxBytes / 1024 / 1024).toFixed(0)} MB`);
  }
  if (!files.some((file) => file.path === spec.entry)) {
    throw new Error(`Browser entry file not found inside ${spec.directory}: ${spec.entry}`);
  }

  return persistBrowserBundle(game, files, spec);
}

export async function removeBrowserBundle(game) {
  const previous = game.browserFiles.map((file) => file.fileId);
  game.browserFiles = [];
  game.browserEntry = '';
  game.browserRuntime = 'canvas-module';
  game.browserControlsPreset = 'none';
  game.browserViewport = { width: 960, height: 600 };
  game.browserInputs = [];
  game.browserSize = 0;
  game.browserBuiltAt = undefined;
  game.browserBuildStatus = 'none';
  game.browserBuildLog = '';
  await game.save();
  for (const fileId of previous) await deleteFile(fileId);
}
