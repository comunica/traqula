/* eslint-disable import/no-nodejs-modules */
import fs from 'node:fs/promises';

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
