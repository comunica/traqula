#!/usr/bin/env node
import {
  readJsonInput,
  runJsonlService,
  writeTextOutput,
} from '@traqula/cli-utils';
import { traqulaIndentation, traqulaNewlineAlternative } from '@traqula/core';
import type { SparqlGeneratorContext, Path, Query, Update } from '@traqula/rules-sparql-1-1';
import { Command } from 'commander';
import { createGeneratorCliRuntime, handleGeneratorCliRequest } from '../lib/cli.js';

const program = new Command()
  .name('traqula-generator-sparql-1-1')
  .description('Generate SPARQL 1.1 text from a Traqula AST JSON input.')
  .option('-i, --input <path>', 'Read AST JSON from file (defaults to stdin)')
  .option('-o, --output <path>', 'Write generated SPARQL to file (defaults to stdout)')
  .option('--path', 'Treat input AST as a SPARQL path')
  .option('--compact', 'Disable pretty printing and newlines')
  .option('--indent <count>', 'Configure indentation width')
  .option('--newline-alt <text>', 'Separator used when compact mode disables newlines')
  .option('--service', 'Run JSONL service mode over stdio')
  .addHelpText('after', `
Service request format:
  {"id":"1","ast":{...},"path":false,"context":{...}}`);

interface Options {
  input?: string;
  output?: string;
  path?: boolean;
  compact?: boolean;
  indent?: string;
  newlineAlt?: string;
  service?: boolean;
}

function parseNonNegativeInt(value: string, option: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid value for --${option}: must be a non-negative integer`);
  }
  return parsed;
}

function createDefaultContext(opts: Options): Partial<SparqlGeneratorContext> {
  const context: Partial<SparqlGeneratorContext> = {};

  if (opts.indent !== undefined) {
    context.indentInc = parseNonNegativeInt(opts.indent, 'indent');
  }

  if (opts.newlineAlt !== undefined) {
    context[traqulaNewlineAlternative] = opts.newlineAlt;
  }

  if (opts.compact) {
    context[traqulaIndentation] = -1;
    context.indentInc = 0;
  }

  return context;
}

program.action(async(opts: Options) => {
  const runtime = createGeneratorCliRuntime(createDefaultContext(opts));

  if (opts.service) {
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

  const ast = await readJsonInput<Query | Update | Path>(opts.input);
  const output = opts.path ?
    handleGeneratorCliRequest(runtime, { ast: <Path> ast, path: true }) :
    handleGeneratorCliRequest(runtime, { ast: <Query | Update> ast });
  await writeTextOutput(output, opts.output);
});

program.parseAsync().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Unknown error'}\n`);
  process.exitCode = 1;
});
