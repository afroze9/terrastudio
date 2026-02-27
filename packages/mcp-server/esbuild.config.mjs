import { build } from 'esbuild';
import module from 'node:module';

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/mcp-server.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  banner: {
    js: [
      '#!/usr/bin/env node',
      // Create a require() shim for CJS dependencies bundled into ESM
      'import { createRequire as __createRequire } from "node:module";',
      'const require = __createRequire(import.meta.url);',
    ].join('\n'),
  },
  // Don't bundle Node.js builtins — they're available at runtime
  external: module.builtinModules.flatMap((m) => [m, `node:${m}`]),
  sourcemap: true,
  minify: false,
});
