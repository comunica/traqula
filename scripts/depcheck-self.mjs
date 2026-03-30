/**
 * Runs depcheck for the current package, automatically adding the package's
 * own name to --ignores so that test files importing the public API by package
 * name (a common monorepo pattern) are not flagged as missing dependencies.
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const { name } = JSON.parse(readFileSync('./package.json', 'utf8'));

try {
  execSync(`depcheck --ignores="vitest,esbuild,${name}"`, { stdio: 'inherit' });
} catch (e) {
  process.exit(e.status ?? 1);
}
