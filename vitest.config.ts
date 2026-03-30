/// <reference types="vitest" />
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));

/**
 * Redirect every @traqula/* import through vite's TypeScript transform so that
 * coverage is measured on the original source files regardless of whether a
 * test imports by package name or by relative path.  Longer/more-specific
 * names must come before any name that is a prefix of theirs (e.g.
 * rules-sparql-1-1-adjust before rules-sparql-1-1) because vite applies the
 * first matching alias.
 */
const workspaceAliases: Record<string, string> = {
  '@traqula/algebra-transformations-1-1': resolve(root, 'packages/algebra-transformations-1-1/lib/index.ts'),
  '@traqula/algebra-transformations-1-2': resolve(root, 'packages/algebra-transformations-1-2/lib/index.ts'),
  '@traqula/chevrotain': resolve(root, 'packages/chevrotain/lib/index.ts'),
  '@traqula/core': resolve(root, 'packages/core/lib/index.ts'),
  '@traqula/rules-sparql-1-1-adjust': resolve(root, 'packages/rules-sparql-1-1-adjust/lib/index.ts'),
  '@traqula/rules-sparql-1-1': resolve(root, 'packages/rules-sparql-1-1/lib/index.ts'),
  '@traqula/rules-sparql-1-2': resolve(root, 'packages/rules-sparql-1-2/lib/index.ts'),
  '@traqula/test-utils': resolve(root, 'packages/test-utils/lib/index.ts'),
  '@traqula/algebra-sparql-1-1': resolve(root, 'engines/algebra-sparql-1-1/lib/index.ts'),
  '@traqula/algebra-sparql-1-2': resolve(root, 'engines/algebra-sparql-1-2/lib/index.ts'),
  '@traqula/generator-sparql-1-1': resolve(root, 'engines/generator-sparql-1-1/lib/index.ts'),
  '@traqula/generator-sparql-1-2': resolve(root, 'engines/generator-sparql-1-2/lib/index.ts'),
  '@traqula/parser-sparql-1-1-adjust': resolve(root, 'engines/parser-sparql-1-1-adjust/lib/index.ts'),
  '@traqula/parser-sparql-1-1': resolve(root, 'engines/parser-sparql-1-1/lib/index.ts'),
  '@traqula/parser-sparql-1-2': resolve(root, 'engines/parser-sparql-1-2/lib/index.ts'),
};

export default defineConfig({
  resolve: {
    alias: workspaceAliases,
  },
  test: {
    coverage: {
      enabled: true,
      provider: 'v8',
      include: [
        'packages/*/lib/**/*.ts',
        'engines/*/lib/**/*.ts',
      ],
    },
    include: [
      'engines/*/test/**/*.test.ts',
      'packages/*/test/**/*.test.ts',
    ],
    typecheck: {
      enabled: true,
      include: [
        '**/test/**/*.types.test.ts',
      ],
    },
    benchmark: {
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
      ],
    },
  },
});

