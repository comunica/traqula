import * as fs from 'node:fs';

/**
 * Read input from stdin, a file path, or a string argument.
 * @param arg - The argument to read from (file path or string)
 * @param isFile - Whether the argument is a file path
 * @returns Promise resolving to the input string
 */
export async function readInput(arg?: string, isFile = false): Promise<string> {
  if (arg) {
    if (isFile) {
      return fs.promises.readFile(arg, 'utf8');
    }
    return arg;
  }

  // Read from stdin
  return new Promise((resolve, reject) => {
    let input = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      input += String(chunk);
    });
    process.stdin.on('end', () => {
      resolve(input);
    });
    process.stdin.on('error', reject);
  });
}

/**
 * Write output to stdout.
 * @param content - The content to write
 */
export function writeOutput(content: string): void {
  process.stdout.write(`${content}\n`);
}

/**
 * Write error message to stderr and exit with error code.
 * @param message - The error message
 * @param exitCode - The exit code (default: 1)
 */
export function exitWithError(message: string, exitCode = 1): never {
  process.stderr.write(`Error: ${message}\n`);
  // eslint-disable-next-line unicorn/no-process-exit -- This is a CLI utility, process.exit is expected
  process.exit(exitCode);
  // TypeScript requires this for 'never' return type
  throw new Error('Unreachable');
}
