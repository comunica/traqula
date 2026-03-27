#!/usr/bin/env node
import {
  getFlagAsBoolean,
  getFlagAsString,
  parseCliArgs,
  readJsonInput,
  runJsonlService,
  writeTextOutput,
} from '@traqula/cli-utils';
import { traqulaIndentation, traqulaNewlineAlternative } from '@traqula/core';
import type { SparqlGeneratorContext, Path, Query, Update } from '@traqula/rules-sparql-1-1';
import { createGeneratorCliRuntime, handleGeneratorCliRequest } from '../lib/cli.js';

function printHelp(): void {
  process.stdout.write(`Usage: traqula-generator-sparql-1-1 [options]\n\n` +
    `Generate SPARQL 1.1 text from a Traqula AST JSON input.\n\n` +
    `Options:\n` +
    `  -i, --input <path>          Read AST JSON from file (defaults to stdin)\n` +
    `  -o, --output <path>         Write generated SPARQL to file (defaults to stdout)\n` +
    `      --path                  Treat input AST as a SPARQL path\n` +
    `      --compact               Disable pretty printing and newlines\n` +
    `      --indent <count>        Configure indentation width\n` +
    `      --newline-alt <text>    Separator used when compact mode disables newlines\n` +
    `      --service [jsonl]       Run JSONL service mode over stdio\n` +
    `  -h, --help                  Show this help text\n\n` +
    `Service request format:\n` +
    `  {"id":"1","ast":{...},"path":false,"context":{...}}\n`);
}

function parsePositiveInt(input: string, option: string): number {
  const parsed = Number.parseInt(input, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid value for --${option}: ${input}`);
  }
  return parsed;
}

function createDefaultContext(args: ReturnType<typeof parseCliArgs>): Partial<SparqlGeneratorContext> {
  const context: Partial<SparqlGeneratorContext> = {};

  const indent = getFlagAsString(args, 'indent');
  if (indent !== undefined) {
    context.indentInc = parsePositiveInt(indent, 'indent');
  }

  const newlineAlt = getFlagAsString(args, 'newline-alt');
  if (newlineAlt !== undefined) {
    context[traqulaNewlineAlternative] = newlineAlt;
  }

  if (getFlagAsBoolean(args, 'compact')) {
    context[traqulaIndentation] = -1;
    context.indentInc = 0;
  }

  return context;
}

async function run(): Promise<void> {
  const args = parseCliArgs(process.argv.slice(2));
  if (getFlagAsBoolean(args, 'help', 'h')) {
    printHelp();
    return;
  }

  const runtime = createGeneratorCliRuntime(createDefaultContext(args));
  if (getFlagAsBoolean(args, 'service')) {
    await runJsonlService((request: unknown) => {
      if (request === null || typeof request !== 'object') {
        throw new Error('Service request must be a JSON object');
      }
      const data = <{ ast?: unknown; path?: unknown; context?: unknown }> request;
      if (data.ast === undefined) {
        throw new Error('Missing property: ast');
      }
      if (data.path) {
        return handleGeneratorCliRequest(runtime, {
          ast: <Path> data.ast,
          path: true,
          context: <Partial<SparqlGeneratorContext> | undefined> data.context,
        });
      }
      return handleGeneratorCliRequest(runtime, {
        ast: <Query | Update> data.ast,
        context: <Partial<SparqlGeneratorContext> | undefined> data.context,
      });
    });
    return;
  }

  const ast = await readJsonInput<Query | Update | Path>(getFlagAsString(args, 'input', 'i'));
  const output = getFlagAsBoolean(args, 'path') ?
    handleGeneratorCliRequest(runtime, { ast: <Path> ast, path: true }) :
    handleGeneratorCliRequest(runtime, { ast: <Query | Update> ast });
  await writeTextOutput(output, getFlagAsString(args, 'output', 'o'));
}

run().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Unknown error'}\n`);
  process.exitCode = 1;
});
