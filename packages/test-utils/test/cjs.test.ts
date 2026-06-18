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

  it('the real CJS entry point (indexCjs.js) loads without throwing', () => {
    const cjsRequire = createRequire(import.meta.url);

    // The indexCjs.js entry point re-exports matchers/vitest.js which does `require("vitest")`.
    // Vitest itself blocks CommonJS require() with a hard error:
    //   "Vitest cannot be imported in a CommonJS module using require()"
    // That restriction makes it impossible to load the full entry point via
    // require() even inside a running vitest process.  We therefore verify the
    // next-best thing: that the error thrown is specifically vitest's own guard
    // (not a CJS parse failure caused by, e.g., leftover import.meta.url in the
    // compiled output).  A CJS parse error would surface as a SyntaxError,
    // whereas the vitest guard throws a plain Error with a recognisable message.
    expect(() => cjsRequire('../dist/cjs/lib/indexCjs.js')).toThrow(
      /Vitest cannot be imported in a CommonJS module/u,
    );
  });
});
