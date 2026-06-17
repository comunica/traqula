/**
 * Verifies that the compiled CJS artifact can be loaded with require() and
 * that getStaticFilePath() returns an existing path.  This guards against
 * regressions where the CJS output contains import.meta.url and therefore
 * fails at parse time in a CommonJS context.
 */

import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

describe('cjs build artifact', () => {
  it('getStaticFilePath() returns an existing statics directory via the CJS dist', () => {
    const cjsRequire = createRequire(import.meta.url);

    // Load only utils.js from the CJS dist (avoids the vitest import in matchers/vitest.js).
    const utils = <typeof import('../lib/generators/utils.js')>
      cjsRequire('../dist/cjs/lib/generators/utils.js');

    // Simulate what dist/cjs/lib/indexCjs.js does at startup: call _initStaticsRoot with the
    // directory of the CJS entry file so the walk-up finds the correct package root.
    const indexCjsDir = path.dirname(fileURLToPath(new URL('../dist/cjs/lib/indexCjs.js', import.meta.url)));
    utils._initStaticsRoot(indexCjsDir);

    const staticsPath = utils.getStaticFilePath();
    expect(existsSync(staticsPath)).toBe(true);
    expect(staticsPath).toMatch(/statics$/u);
  });
});
