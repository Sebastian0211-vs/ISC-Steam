import { readFile } from 'node:fs/promises';
import path from 'node:path';

// Parses and validates isc.json (spec: docs/ISC_MANIFEST.md).
// Throws Error with a student-readable message on any problem.

export class ManifestError extends Error {}

function fail(msg) {
  throw new ManifestError(`isc.json: ${msg}`);
}

function relPath(p, field) {
  if (typeof p !== 'string' || !p.trim()) fail(`"${field}" must be a non-empty path`);
  const clean = p.replaceAll('\\', '/').trim();
  if (clean.startsWith('/') || clean.includes('..')) fail(`"${field}" must be a repo-relative path without ".." (got "${p}")`);
  return clean;
}

export async function readManifest(repoDir) {
  let raw;
  try {
    raw = await readFile(path.join(repoDir, 'isc.json'), 'utf8');
  } catch {
    fail('file not found at the repository root. See docs/ISC_MANIFEST.md');
  }

  let m;
  try {
    m = JSON.parse(raw);
  } catch (err) {
    fail(`invalid JSON — ${err.message}`);
  }

  if (m.iscVersion !== 1) fail('"iscVersion" must be 1');
  if (typeof m.title !== 'string' || !m.title.trim() || m.title.length > 80) fail('"title" is required (max 80 chars)');
  if (typeof m.shortDescription !== 'string' || !m.shortDescription.trim() || m.shortDescription.length > 200) {
    fail('"shortDescription" is required (max 200 chars)');
  }
  if (typeof m.mainClass !== 'string' || !/^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/.test(m.mainClass)) {
    fail('"mainClass" is required and must be a valid class name (e.g. "Main" or "game.Main")');
  }

  const JFX_MODULES = ['base', 'graphics', 'controls', 'fxml', 'media', 'swing', 'web'];
  const javafx = m.javafx === true;
  let javafxModules = [];
  if (javafx) {
    const wanted = Array.isArray(m.javafxModules) ? m.javafxModules.map((x) => String(x).toLowerCase()) : ['controls', 'media'];
    for (const mod of wanted) {
      if (!JFX_MODULES.includes(mod)) fail(`"javafxModules" contains unknown module "${mod}" (allowed: ${JFX_MODULES.join(', ')})`);
    }
    javafxModules = [...new Set(['base', 'graphics', ...wanted])]; // base+graphics are always required
  }

  const tags = Array.isArray(m.tags) ? m.tags.slice(0, 8).map((t) => String(t).toLowerCase().trim()) : [];
  const authors = Array.isArray(m.authors) ? m.authors.slice(0, 10).map((a) => String(a).trim()) : [];
  const sources = (Array.isArray(m.sources) && m.sources.length ? m.sources : ['src']).map((s, i) => relPath(s, `sources[${i}]`));
  const resources = (Array.isArray(m.resources) ? m.resources : sources).map((r, i) => relPath(r, `resources[${i}]`));
  const screenshots = (Array.isArray(m.screenshots) ? m.screenshots.slice(0, 6) : []).map((s, i) => relPath(s, `screenshots[${i}]`));

  return {
    title: m.title.trim(),
    shortDescription: m.shortDescription.trim(),
    description: typeof m.description === 'string' ? m.description.trim().slice(0, 8000) : m.shortDescription.trim(),
    version: typeof m.version === 'string' && m.version.trim() ? m.version.trim().slice(0, 30) : '1.0.0',
    authors,
    tags,
    controls: typeof m.controls === 'string' ? m.controls.trim().slice(0, 300) : '',
    year: Number.isInteger(m.year) ? m.year : new Date().getFullYear(),
    engine: {
      name: m.engine?.name ? String(m.engine.name).toLowerCase() : 'fungraphics',
      version: m.engine?.version ? String(m.engine.version) : '',
    },
    scalaVersion: typeof m.scalaVersion === 'string' ? m.scalaVersion : '2.13',
    javafx,
    javafxModules,
    mainClass: m.mainClass,
    sources,
    resources,
    cover: m.cover ? relPath(m.cover, 'cover') : null,
    screenshots,
  };
}
