import { existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

/**
 * Resolve the project path from an optional argument.
 *
 * If a path is provided, returns it as-is (resolved to absolute).
 * If omitted, walks up from cwd looking for a directory containing a .tstudio file.
 * Exits with an error if no project is found.
 */
export function resolveProjectPath(pathArg?: string): string {
  if (pathArg) {
    return resolve(pathArg);
  }

  // Walk up from cwd looking for a .tstudio file
  let dir = resolve(process.cwd());
  const root = dirname(dir) === dir ? dir : undefined; // filesystem root guard

  while (true) {
    if (hasTstudioFile(dir)) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir || parent === root) {
      break;
    }
    dir = parent;
  }

  console.error('No .tstudio project found in current directory or any parent.');
  console.error('Either run this command from a project directory, or pass the path explicitly.');
  process.exit(1);
}

function hasTstudioFile(dir: string): boolean {
  if (!existsSync(dir)) return false;
  try {
    return readdirSync(dir).some((f) => f.endsWith('.tstudio'));
  } catch {
    return false;
  }
}
