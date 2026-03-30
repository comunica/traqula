/* eslint-disable import/no-nodejs-modules */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Walk up from the current file's location to find the package root
// (identified by package.json).  This works whether the file is loaded
// directly from lib/ (via vitest aliases) or from dist/esm/lib/ after build.
function findPackageRoot(startDir: string): string {
  let dir = startDir;
  while (dir !== path.dirname(dir)) {
    if (existsSync(path.join(dir, 'package.json'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  throw new Error(`Could not find package root starting from ${startDir}`);
}

const staticsPath = path.join(
  findPackageRoot(path.dirname(fileURLToPath(import.meta.url))),
  'statics',
);

export function getStaticFilePath(...paths: string[]): string {
  return path.join(staticsPath, ...paths);
}
