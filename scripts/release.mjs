#!/usr/bin/env node
/**
 * Release helper for TerraStudio.
 *
 * Replaces release-please with a plain tag-driven flow:
 *   1. Bump versions in apps/desktop/package.json, Cargo.toml, packages/cli/package.json
 *   2. Commit the bump (atomic "chore: release vX.Y.Z")
 *   3. Create a lightweight tag vX.Y.Z pointing at that commit
 *   4. Print instructions to push
 *
 * The GitHub Actions release workflow (.github/workflows/release.yml) fires on
 * the tag push and handles the rest: creates the GitHub Release with auto-
 * generated notes, builds Tauri installers, builds CLI binaries, and publishes
 * the CLI to npm.
 *
 * Usage:
 *   pnpm release 0.51.3
 *   pnpm release 0.51.3 --push     # also push commit + tag in one go
 */

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const args = process.argv.slice(2);
const version = args.find((a) => !a.startsWith('--'));
const shouldPush = args.includes('--push');

if (!version) {
  console.error('Usage: pnpm release <version> [--push]');
  console.error('Example: pnpm release 0.51.3');
  process.exit(1);
}

if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
  console.error(`Invalid version format: "${version}". Expected semver (e.g. 0.51.3)`);
  process.exit(1);
}

const tag = `v${version}`;

// ── Preflight ────────────────────────────────────────────────────────────────
function sh(cmd, opts = {}) {
  return execSync(cmd, { cwd: root, stdio: 'pipe', encoding: 'utf8', ...opts }).trim();
}

function shStream(cmd) {
  execSync(cmd, { cwd: root, stdio: 'inherit' });
}

// Check tag doesn't already exist
const existingTag = sh(`git tag --list ${tag}`);
if (existingTag) {
  console.error(`✗ Tag ${tag} already exists locally.`);
  console.error(`  Delete it first: git tag -d ${tag}`);
  process.exit(1);
}

// Check remote tag doesn't exist
try {
  const remoteTag = sh(`git ls-remote --tags origin ${tag}`);
  if (remoteTag) {
    console.error(`✗ Tag ${tag} already exists on origin.`);
    console.error(`  Pick a higher version, or delete remote with: git push --delete origin ${tag}`);
    process.exit(1);
  }
} catch {
  // offline is fine
}

// Check working tree has only the version-bump changes (or is clean)
const status = sh('git status --porcelain');
if (status) {
  console.error('✗ Working tree is not clean. Commit or stash changes first:');
  console.error(status);
  process.exit(1);
}

// ── Bump versions ────────────────────────────────────────────────────────────
console.log(`\n→ Bumping to ${version}...`);
shStream(`node scripts/version-bump.mjs ${version}`);

// ── Commit + tag ─────────────────────────────────────────────────────────────
const bumped = [
  'apps/desktop/package.json',
  'apps/desktop/src-tauri/Cargo.toml',
  'packages/cli/package.json',
];

console.log('\n→ Committing bump...');
shStream(`git add ${bumped.join(' ')}`);

const cargoLockChanged = sh('git status --porcelain apps/desktop/src-tauri/Cargo.lock');
if (cargoLockChanged) {
  shStream('git add apps/desktop/src-tauri/Cargo.lock');
}

shStream(`git commit -m "chore: release ${tag}"`);

console.log(`\n→ Creating tag ${tag}...`);
shStream(`git tag ${tag}`);

// ── Push or instruct ─────────────────────────────────────────────────────────
if (shouldPush) {
  console.log('\n→ Pushing commit + tag...');
  shStream('git push');
  shStream(`git push origin ${tag}`);
  console.log(`\n✓ Released ${tag}. GitHub Actions will build + publish.`);
  console.log(`  Watch: gh run list --workflow=release.yml --limit 3`);
} else {
  console.log(`\n✓ Local release prepared.`);
  console.log(`  Review: git log -1 --stat`);
  console.log(`  Push:   git push && git push origin ${tag}`);
  console.log(`  Or re-run with --push to send both in one shot.`);
}
