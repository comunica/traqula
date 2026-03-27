/* eslint-disable import/no-nodejs-modules */
import fs from 'node:fs/promises';
import { createInterface } from 'node:readline';

export type CliArgValue = boolean | string | string[];

export interface ParsedCliArgs {
  readonly positionals: string[];
  readonly flags: Readonly<Record<string, CliArgValue>>;
}

export function parseCliArgs(argv: readonly string[]): ParsedCliArgs {
  const positionals: string[] = [];
  const flags: Record<string, CliArgValue> = {};

  let positionalOnly = false;
  for (let index = 0; index < argv.length; index++) {
    const value = argv[index];
    if (positionalOnly) {
      positionals.push(value);
      continue;
    }
    if (value === '--') {
      positionalOnly = true;
      continue;
    }
    if (!value.startsWith('-') || value === '-') {
      positionals.push(value);
      continue;
    }

    if (value.startsWith('--')) {
      const withNoPrefix = value.slice(2);
      const equalIndex = withNoPrefix.indexOf('=');
      const flag = equalIndex >= 0 ? withNoPrefix.slice(0, equalIndex) : withNoPrefix;
      const inlineValue = equalIndex >= 0 ? withNoPrefix.slice(equalIndex + 1) : undefined;
      if (flag.startsWith('no-')) {
        flags[flag.slice(3)] = false;
        continue;
      }
      if (inlineValue !== undefined) {
        assignFlagValue(flags, flag, inlineValue);
        continue;
      }
      const next = argv[index + 1];
      if (next !== undefined && (!next.startsWith('-') || next === '-')) {
        assignFlagValue(flags, flag, next);
        index++;
      } else {
        flags[flag] = true;
      }
      continue;
    }

    const shortFlags = value.slice(1);
    for (let shortIndex = 0; shortIndex < shortFlags.length; shortIndex++) {
      const shortFlag = shortFlags[shortIndex];
      if (shortIndex < shortFlags.length - 1) {
        flags[shortFlag] = true;
        continue;
      }
      const next = argv[index + 1];
      if (next !== undefined && (!next.startsWith('-') || next === '-')) {
        assignFlagValue(flags, shortFlag, next);
        index++;
      } else {
        flags[shortFlag] = true;
      }
    }
  }

  return { positionals, flags };
}

function assignFlagValue(flags: Record<string, CliArgValue>, key: string, value: string): void {
  const current = flags[key];
  if (current === undefined || typeof current === 'boolean') {
    flags[key] = value;
  } else if (Array.isArray(current)) {
    current.push(value);
  } else {
    flags[key] = [ current, value ];
  }
}

export function getFlag(args: ParsedCliArgs, ...names: string[]): CliArgValue | undefined {
  for (const name of names) {
    const value = args.flags[name];
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

export function getFlagAsString(args: ParsedCliArgs, ...names: string[]): string | undefined {
  const flag = getFlag(args, ...names);
  if (flag === undefined || typeof flag === 'boolean') {
    return undefined;
  }
  return Array.isArray(flag) ? flag.at(-1) : flag;
}

export function getFlagAsBoolean(args: ParsedCliArgs, ...names: string[]): boolean {
  const flag = getFlag(args, ...names);
  if (flag === undefined) {
    return false;
  }
  if (typeof flag === 'boolean') {
    return flag;
  }
  const value = Array.isArray(flag) ? flag.at(-1) : flag;
  return value !== 'false' && value !== '0';
}

export function getFlagAsStrings(args: ParsedCliArgs, ...names: string[]): string[] {
  const flag = getFlag(args, ...names);
  if (flag === undefined || typeof flag === 'boolean') {
    return [];
  }
  return Array.isArray(flag) ? flag : [ flag ];
}

export async function readTextInput(filePath?: string): Promise<string> {
  if (filePath) {
    return fs.readFile(filePath, 'utf8');
  }

  const chunks: string[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === 'string' ? chunk : (<Buffer> chunk).toString('utf8'));
  }
  return chunks.join('');
}

export async function writeTextOutput(text: string, filePath?: string): Promise<void> {
  if (filePath) {
    await fs.writeFile(filePath, text, 'utf8');
    return;
  }
  process.stdout.write(text);
  if (!text.endsWith('\n')) {
    process.stdout.write('\n');
  }
}

export async function readJsonInput<T>(filePath?: string): Promise<T> {
  const text = await readTextInput(filePath);
  return <T> JSON.parse(text);
}

export async function writeJsonOutput(value: unknown, pretty: boolean, filePath?: string): Promise<void> {
  const spacing = pretty ? 2 : undefined;
  const output = `${JSON.stringify(value, null, spacing)}\n`;
  await writeTextOutput(output, filePath);
}

export interface JsonlResponse {
  readonly id?: number | string;
  readonly ok: boolean;
  readonly result?: unknown;
  readonly error?: { readonly message: string };
}

export async function runJsonlService(
  handler: (request: unknown) => Promise<unknown> | unknown,
): Promise<void> {
  const rl = createInterface({ input: process.stdin, crlfDelay: Number.POSITIVE_INFINITY });
  for await (const lineRaw of rl) {
    const line = lineRaw.trim();
    if (line.length === 0) {
      continue;
    }
    let request: unknown;
    try {
      request = JSON.parse(line);
    } catch {
      process.stdout.write(`${JSON.stringify({ ok: false, error: { message: 'Invalid JSON request' }})}\n`);
      continue;
    }

    const id =
      typeof request === 'object' && request !== null ? (<Record<string, unknown>> request).id : undefined;
    try {
      const result = await handler(request);
      const response: JsonlResponse = {
        id: typeof id === 'number' || typeof id === 'string' ? id : undefined,
        ok: true,
        result,
      };
      process.stdout.write(`${JSON.stringify(response)}\n`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const response: JsonlResponse = {
        id: typeof id === 'number' || typeof id === 'string' ? id : undefined,
        ok: false,
        error: { message },
      };
      process.stdout.write(`${JSON.stringify(response)}\n`);
    }
  }
}

export function parsePrefixMappings(values: readonly string[]): Record<string, string> {
  const prefixes: Record<string, string> = {};
  for (const entry of values) {
    const separator = entry.indexOf('=');
    if (separator <= 0 || separator === entry.length - 1) {
      throw new Error(`Invalid prefix mapping '${entry}', expected prefix=iri`);
    }
    const key = entry.slice(0, separator);
    const value = entry.slice(separator + 1);
    prefixes[key] = value;
  }
  return prefixes;
}
