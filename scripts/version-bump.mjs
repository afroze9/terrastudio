#!/usr/bin/env node
/**
 * Version bump script for TerraStudio.
 *
 * Single source of truth: apps/desktop/package.json
 *
 * Updates the version in:
 *   - apps/desktop/package.json       → source of truth; Vite reads it for __APP_VERSION__
 *   - apps/desktop/src-tauri/Cargo.toml → Rust crate version
 *   - packages/cli/package.json        → CLI reports this via `tstudio --version`
 *
 * tauri.conf.json reads its version from package.json automatically
 * ("version": "../package.json") — no manual update needed.
 *
 * Usage:
 *   pnpm version-bump 0.40.0
 *   node scripts/version-bump.mjs 0.40.0
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const newVersion = process.argv[2];
if (!newVersion) {
  console.error('Usage: node scripts/version-bump.mjs <version>');
  console.error('Example: node scripts/version-bump.mjs 0.40.0');
  process.exit(1);
}

if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(newVersion)) {
  console.error(`Invalid version format: "${newVersion}". Expected semver (e.g. 0.40.0)`);
  process.exit(1);
}

function bumpJson(filePath, label) {
  const data = JSON.parse(readFileSync(filePath, 'utf8'));
  const old = data.version;
  data.version = newVersion;
  writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`${label}: ${old} → ${newVersion}`);
}

function bumpToml(filePath, label) {
  const content = readFileSync(filePath, 'utf8');
  const updated = content.replace(/^version\s*=\s*"[^"]+"/m, `version = "${newVersion}"`);
  writeFileSync(filePath, updated, 'utf8');
  const old = content.match(/^version\s*=\s*"([^"]+)"/m)?.[1] ?? '?';
  console.log(`${label}: ${old} → ${newVersion}`);
}

// ── Update all version locations ─────────────────────────────────────────────
bumpJson(join(root, 'apps/desktop/package.json'),   'apps/desktop/package.json        ');
bumpToml(join(root, 'apps/desktop/src-tauri/Cargo.toml'), 'apps/desktop/src-tauri/Cargo.toml');
bumpJson(join(root, 'packages/cli/package.json'),   'packages/cli/package.json        ');

console.log(`\n✓ Version bumped to ${newVersion}`);
console.log('  tauri.conf.json auto-reads version from package.json — no update needed.');
