/* eslint-disable import/no-nodejs-modules */
import type { PathLike } from 'node:fs';
import type { FileHandle } from 'node:fs/promises';
import fsp from 'node:fs/promises';

export async function readFile(path: PathLike | FileHandle, encoding: BufferEncoding = 'utf-8'): Promise<string> {
  const content = await fsp.readFile(path, encoding);
  return content.replaceAll(/\r?\n/gu, '\n');
}
